"""Live-chat Gemini auto-reply. An agent switches it ON per conversation (chat doc field `gem`); from then on every new customer
message in that chat gets a Gemini answer, until the agent switches it OFF (or escalates the chat).
Safety: the customer can never set `gem` (docs.customer_put keeps the stored value), fraud reports (dec = escalated) are never
auto-answered, Gemini runs in a background thread (the customer's request is not slowed down), and the answer is only appended if
nothing newer (agent reply, switch OFF, another customer message) happened while Gemini was thinking."""
from __future__ import annotations
import logging, time
from concurrent.futures import ThreadPoolExecutor
from . import docs, llm
from .ledger import LedgerError, now_ms

log = logging.getLogger("upay")
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="gemchat")
HISTORY = 12                       # last messages sent as context


def _stamp() -> str:
    return time.strftime("%H:%M")


def _history(msgs: list[dict]) -> list[dict]:
    out = []
    for m in msgs:
        f = m.get("f")
        if f == "sys":
            continue
        out.append({"role": "user" if f == "cu" else "model", "text": m.get("t", "")})
    return out[-HISTORY:]


def _pending(d: dict) -> dict | None:
    """The customer message that still needs an answer: the last non-system message, if it is the customer's."""
    real = [m for m in (d.get("msgs") or []) if m.get("f") != "sys"]
    return real[-1] if real and real[-1].get("f") == "cu" else None


def _note(d: dict, text: str) -> dict:
    d["audit"] = [*(d.get("audit") or []), f"{text} {_stamp()}"]
    return d


def set_gem(db, uid: str, on: bool, pool=_pool, run=None) -> dict:
    """Agent switch. Turning it ON also answers a customer message that is still waiting."""
    def patch(d: dict) -> dict:
        d["gem"], d["gemAt"] = bool(on), now_ms()
        if on and d.get("status") in ("needs_review",):
            d["status"] = "gem"
        return _note(d, "Gemini auto-reply " + ("ON" if on else "OFF"))
    out = docs.patch(db, "chats", uid, patch)
    if on and _pending(out):
        (run or pool.submit)(reply_now, db, uid)
    return out


def trigger(db, uid: str, pool=_pool, run=None) -> None:
    """Called after the customer saved the chat. Cheap check first; Gemini runs in the background."""
    d = docs.get(db, "chats", uid)
    if not d or not d.get("gem") or not _pending(d):
        return
    if (d.get("a") or {}).get("dec") == "escalated" and d.get("status") == "escalated":
        return
    (run or pool.submit)(reply_now, db, uid)


def reply_now(db, uid: str, transport=None) -> bool:
    """Blocking: ask Gemini and append the answer. Returns True when a reply was added."""
    d = docs.get(db, "chats", uid)
    if not d or not d.get("gem"):
        return False
    pend = _pending(d)
    if not pend:
        return False
    if (d.get("a") or {}).get("dec") == "escalated":                    # fraud reports stay with the fraud team
        docs.patch(db, "chats", uid, lambda x: _note(x, "Gemini skipped: fraud report waits for the fraud team") if not any(
            str(a).startswith("Gemini skipped: fraud") for a in (x.get("audit") or [])[-3:]) else x)
        return False
    topic = (d.get("a") or {}).get("policy", "")
    try:
        r = (llm.chat_reply(_history(d["msgs"]), topic, **({"transport": transport} if transport else {})))
    except LedgerError as e:
        log.warning("gemini chat reply failed for %s: %s", uid, e.code)
        docs.patch(db, "chats", uid, lambda x: _note(x, "Gemini could not answer (" + e.code + "), agent please reply"))
        return False
    added = {"ok": False}

    def patch(x: dict) -> dict:
        p2 = _pending(x)
        if not x.get("gem") or not p2 or p2.get("ts") != pend.get("ts"):     # switched off / agent answered / newer message: drop it
            return x
        ts = max(now_ms(), (x.get("last") or 0) + 1)
        x["msgs"] = [*x["msgs"], {"f": "ai", "t": r["reply"], "ts": ts, "g": 1}]
        x["status"], x["last"], x["unreadCust"] = "gem", ts, int(x.get("unreadCust") or 0) + 1
        added["ok"] = True
        return _note(x, "Gemini replied")
    docs.patch(db, "chats", uid, patch)
    return added["ok"]
