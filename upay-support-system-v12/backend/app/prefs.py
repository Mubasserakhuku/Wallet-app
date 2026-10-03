"""Per-customer settings stored on the server so they survive a new phone: favourites, profile photo, reminders, saved billers.
Each key has a strict shape and size limit; the customer can only read and write their own rows."""
import json
import re
from typing import Any
from .ledger import LedgerError, now_ms

PHOTO_MAX = 300_000
_PHONE = re.compile(r"^01\d{9}$")


def _s(x: Any, n: int) -> str:
    return x.strip()[:n] if isinstance(x, str) else ""


def _list(v: Any, n: int) -> list:
    if not isinstance(v, list) or len(v) > n:
        raise LedgerError("bad_request", "Invalid list")
    return v


def _favs(v):
    out, seen = [], set()
    for x in _list(v, 100):
        p = x.get("phone") if isinstance(x, dict) else None
        if not isinstance(p, str) or not _PHONE.match(p):
            raise LedgerError("bad_phone", "Enter a valid mobile number")
        if p not in seen:
            seen.add(p)
            out.append({"phone": p, "name": _s(x.get("name"), 60)})
    return out


def _billers(v):
    out = []
    for x in _list(v, 50):
        if not isinstance(x, dict) or not _s(x.get("account"), 40):
            raise LedgerError("bad_request", "Account number is required")
        out.append({"id": _s(x.get("id"), 30) or str(now_ms()), "type": _s(x.get("type"), 40),
                    "account": _s(x.get("account"), 40), "label": _s(x.get("label"), 60)})
    return out


def _reminders(v):
    out = []
    for x in _list(v, 30):
        d = x.get("day") if isinstance(x, dict) else None
        if isinstance(d, bool) or not isinstance(d, int) or not 1 <= d <= 28:      # 1..28 so every month has that day
            raise LedgerError("bad_request", "Day must be between 1 and 28")
        a = x.get("amount", 0)
        if isinstance(a, bool) or not isinstance(a, (int, float)) or not 0 <= a <= 10_000_000:
            raise LedgerError("bad_amount", "Enter a valid amount")
        label = _s(x.get("label"), 60)
        if not label:
            raise LedgerError("bad_request", "Label is required")
        out.append({"id": _s(x.get("id"), 30) or str(now_ms()), "label": label, "day": d, "amount": a,
                    "type": _s(x.get("type"), 40), "account": _s(x.get("account"), 40), "done": _s(x.get("done"), 7)})
    return out


def _photo(v):
    if v in (None, ""):
        return ""
    if not isinstance(v, str) or not v.startswith("data:image/jpeg;base64,") or len(v) > PHOTO_MAX:
        raise LedgerError("bad_request", "Photo must be a small JPEG")
    return v


CLEAN = {"favs": _favs, "billers": _billers, "reminders": _reminders, "photo": _photo}


def _key(key: str) -> str:
    if key not in CLEAN:
        raise LedgerError("forbidden", "Not allowed")
    return key


def get_all(db, uid: str) -> dict:
    """Everything except the photo (it is big; the app asks for it separately)."""
    with db.tx() as c:
        rows = c.all("SELECT key, value FROM prefs WHERE uid=%s AND key<>'photo'", uid)
    out = {k: [] for k in CLEAN if k != "photo"}
    out.update({r["key"]: r["value"] for r in rows if r["key"] in out})
    return out


def get_one(db, uid: str, key: str):
    with db.tx() as c:
        r = c.one("SELECT value FROM prefs WHERE uid=%s AND key=%s", uid, _key(key))
    return r["value"] if r else ("" if key == "photo" else [])


def put(db, uid: str, key: str, value: Any):
    clean = CLEAN[_key(key)](value)
    with db.tx() as c:
        c.run("INSERT INTO prefs (uid,key,value,updated_at) VALUES (%s,%s,%s::jsonb,%s) "
              "ON CONFLICT (uid,key) DO UPDATE SET value=EXCLUDED.value, updated_at=EXCLUDED.updated_at",
              uid, key, json.dumps(clean), now_ms())
    return clean
