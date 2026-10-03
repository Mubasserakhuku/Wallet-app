"""All money logic. Every function takes a Database and runs inside ONE database transaction.

Rules that make it safe:
  * wallet rows are locked (SELECT ... FOR UPDATE) in sorted uid order, so concurrent payments queue up and cannot deadlock
  * balance checks and updates happen under that lock; CHECK (balance >= 0) is the backstop
  * fees, limits, student status and PIN are decided here, never trusted from the client
  * Idempotency-Key: a retried request can never charge twice
"""
from __future__ import annotations
import hashlib, hmac, json, secrets, time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from typing import Any

from . import config as C
from .db import IntegrityError

TWO = Decimal("0.01")
EXTERNAL = {"recharge", "cashout", "bill", "payment", "fund"}     # money leaves upay (to operator / agent / biller ...)
SERVICES = EXTERNAL | {"send"}


class LedgerError(Exception):
    def __init__(self, code: str, message: str = "", **extra: Any):
        super().__init__(message or code)
        self.code, self.message, self.extra = code, message or code, extra


# ------------------------------------------------------------------ small helpers
def now_ms() -> int:
    return int(time.time() * 1000)


def money(x: Any) -> Decimal:
    try:
        d = Decimal(str(x))
    except Exception:
        raise LedgerError("bad_amount", "Invalid amount")
    if not d.is_finite():
        raise LedgerError("bad_amount", "Invalid amount")
    return d.quantize(TWO, rounding=ROUND_DOWN)


def positive(x: Any) -> Decimal:
    d = money(x)
    if d <= 0:
        raise LedgerError("bad_amount", "Amount must be greater than zero")
    return d


def new_id(prefix: str) -> str:
    return prefix + format(int(time.time() * 1000), "x") + secrets.token_hex(3)


def new_trx() -> str:
    return "UP" + format(int(time.time() * 1000), "X") + secrets.token_hex(2).upper()


def _tz() -> timezone:
    return timezone(timedelta(minutes=C.TZ_OFFSET_MIN))


def day_start(ms: int) -> int:
    d = datetime.fromtimestamp(ms / 1000, _tz()).replace(hour=0, minute=0, second=0, microsecond=0)
    return int(d.timestamp() * 1000)


def month_start(ms: int) -> int:
    d = datetime.fromtimestamp(ms / 1000, _tz()).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return int(d.timestamp() * 1000)


def add_month(ms: int) -> int:
    d = datetime.fromtimestamp(ms / 1000, _tz())
    y, m = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    for day in (d.day, 30, 29, 28):                    # Jan 31 -> Feb 28
        try:
            return int(d.replace(year=y, month=m, day=day).timestamp() * 1000)
        except ValueError:
            continue
    raise AssertionError


def fee_for(service: str, amount: Decimal, student: bool) -> Decimal:
    if service != "cashout":
        return Decimal("0.00")                         # send money is free
    f = amount * C.CASHOUT_FEE * (C.STUDENT_FEE_FACTOR if student else 1)
    return f.quantize(TWO, rounding=ROUND_HALF_UP)


def is_student(w: dict) -> bool:
    return w["acct"] == "student" and bool(w["student_ok"])


def public_wallet(w: dict) -> dict:
    hidden = {"pin_hash", "pin_salt", "pin_fails", "pin_locked_until"}
    out = {k: v for k, v in w.items() if k not in hidden}
    out["has_pin"] = bool(w.get("pin_hash"))
    return out


# ------------------------------------------------------------------ wallets
def gen_phone(uid: str) -> str:
    h = int(hashlib.sha256(uid.encode()).hexdigest(), 16) % 10**9
    return "01" + str(h).zfill(9)


def ensure_wallet(db, uid: str, name: str, now: int | None = None, opening_balance: Any = 0) -> dict:
    now = now or now_ms()
    with db.tx() as c:
        c.run("INSERT INTO wallets (uid,name,phone,balance,created_at) VALUES (%s,%s,%s,%s,%s) ON CONFLICT (uid) DO NOTHING",
              uid, name, gen_phone(uid), money(opening_balance), now)
        return public_wallet(c.one("SELECT * FROM wallets WHERE uid=%s", uid))


def get_wallet(db, uid: str) -> dict:
    with db.tx() as c:
        w = c.one("SELECT * FROM wallets WHERE uid=%s", uid)
        if not w:
            raise LedgerError("not_found", "Wallet not found")
        w = public_wallet(w)
        w["buckets"] = c.all("SELECT name, amount FROM buckets WHERE uid=%s ORDER BY name", uid)
        w["saved"] = c.all("SELECT phone, name FROM saved_accounts WHERE uid=%s ORDER BY name", uid)
        w["rules"] = c.all("SELECT id, phone, name, amount, run_at, repeat, armed, done_at FROM rules WHERE uid=%s ORDER BY id", uid)
        g = c.one("SELECT name, phone FROM wallets WHERE uid=%s", w["guardian_uid"]) if w.get("guardian_uid") else None
        w["guardian_name"], w["guardian_phone"] = (g["name"], g["phone"]) if g else ("", "")
        return w


def find_by_phone(db, phone: str) -> dict | None:
    with db.tx() as c:
        w = c.one("SELECT uid, name, phone FROM wallets WHERE phone=%s", phone)
        return w


def _lock(c, *uids: str) -> dict[str, dict]:
    rows = c.all("SELECT * FROM wallets WHERE uid = ANY(%s) ORDER BY uid FOR UPDATE", sorted(set(uids)))
    return {r["uid"]: r for r in rows}


def _buckets(c, uid: str) -> list[dict]:
    return c.all("SELECT name, amount FROM buckets WHERE uid=%s ORDER BY name FOR UPDATE", uid)


def _free(w: dict, buckets: list[dict]) -> Decimal:
    return w["balance"] - sum((b["amount"] for b in buckets), Decimal(0))


# ------------------------------------------------------------------ PIN
def _hash_pin(pin: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), C.PIN_ITERATIONS).hex()


def _valid_pin(pin: Any) -> str:
    if not isinstance(pin, str) or len(pin) != 4 or not pin.isdigit():
        raise LedgerError("bad_pin_format", "PIN must be 4 digits")
    return pin


def set_pin(db, uid: str, new_pin: str, old_pin: str | None = None, now: int | None = None) -> None:
    now = now or now_ms()
    _valid_pin(new_pin)
    with db.tx() as c:
        w = _lock(c, uid).get(uid)
        if not w:
            raise LedgerError("not_found", "Wallet not found")
        has = bool(w["pin_hash"])
    if has:                                            # changing needs the current PIN (counts wrong tries, locks)
        check_pin(db, uid, old_pin, now)
    salt = secrets.token_hex(16)
    with db.tx() as c:
        c.run("UPDATE wallets SET pin_hash=%s, pin_salt=%s, pin_fails=0, pin_locked_until=0 WHERE uid=%s",
              _hash_pin(new_pin, salt), salt, uid)


def check_pin(db, uid: str, pin: Any, now: int | None = None) -> None:
    """Raises LedgerError. The failure counter is committed BEFORE raising, so brute force is really limited."""
    now = now or now_ms()
    err: LedgerError | None = None
    with db.tx() as c:
        w = _lock(c, uid).get(uid)
        if not w:
            err = LedgerError("not_found", "Wallet not found")
        elif not w["pin_hash"]:
            err = LedgerError("pin_required", "Set a PIN first")
        elif w["pin_locked_until"] > now:
            err = LedgerError("pin_locked", "Too many wrong PINs", retry_after_ms=w["pin_locked_until"] - now)
        elif not isinstance(pin, str) or not hmac.compare_digest(_hash_pin(pin, w["pin_salt"]), w["pin_hash"]):
            fails = w["pin_fails"] + 1
            if fails >= C.PIN_MAX_FAILS:
                c.run("UPDATE wallets SET pin_fails=0, pin_locked_until=%s WHERE uid=%s", now + C.PIN_LOCK_MS, uid)
                err = LedgerError("pin_locked", "Too many wrong PINs", retry_after_ms=C.PIN_LOCK_MS)
            else:
                c.run("UPDATE wallets SET pin_fails=%s WHERE uid=%s", fails, uid)
                err = LedgerError("pin_wrong", "Wrong PIN", attempts_left=C.PIN_MAX_FAILS - fails)
        elif w["pin_fails"]:
            c.run("UPDATE wallets SET pin_fails=0 WHERE uid=%s", uid)
    if err:
        raise err


# ------------------------------------------------------------------ core money movement
def _outgoing_since(c, uid: str, since: int) -> Decimal:
    r = c.one("SELECT COALESCE(SUM(-amount),0) AS s FROM txs WHERE uid=%s AND amount<0 AND NOT undone AND ts>=%s", uid, since)
    return r["s"]


def _check_limits(c, uid: str, total: Decimal, now: int) -> None:
    day = _outgoing_since(c, uid, day_start(now))
    if day + total > C.DAILY_LIMIT:
        raise LedgerError("limit_daily", "Daily limit exceeded", limit=str(C.DAILY_LIMIT), used=str(day))
    mon = _outgoing_since(c, uid, month_start(now))
    if mon + total > C.MONTHLY_LIMIT:
        raise LedgerError("limit_monthly", "Monthly limit exceeded", limit=str(C.MONTHLY_LIMIT), used=str(mon))


def _debit(c, w: dict, total: Decimal, bucket: str | None, now: int) -> Decimal:
    """Takes `total` out of wallet `w` (already locked). Returns the new balance."""
    if w["frozen"]:
        raise LedgerError("frozen", "Account is frozen")
    _check_limits(c, w["uid"], total, now)
    bks = _buckets(c, w["uid"])
    if bucket:
        if not is_student(w):
            raise LedgerError("not_student", "Buckets are for verified student accounts")
        b = next((b for b in bks if b["name"] == bucket), None)
        if not b:
            raise LedgerError("bucket_not_found", "Bucket not found")
        if b["amount"] < total:
            raise LedgerError("insufficient", "Not enough money in this bucket")
        c.run("UPDATE buckets SET amount = amount - %s WHERE uid=%s AND name=%s", total, w["uid"], bucket)
    elif _free(w, bks) < total:
        raise LedgerError("insufficient", "Insufficient balance")
    try:
        return c.one("UPDATE wallets SET balance = balance - %s WHERE uid=%s RETURNING balance", total, w["uid"])["balance"]
    except IntegrityError:
        raise LedgerError("insufficient", "Insufficient balance")


def _credit(c, uid: str, amount: Decimal, bucket: str | None = None) -> Decimal:
    nb = c.one("UPDATE wallets SET balance = balance + %s WHERE uid=%s RETURNING balance", amount, uid)["balance"]
    if bucket:
        if not c.run("UPDATE buckets SET amount = amount + %s WHERE uid=%s AND name=%s", amount, uid, bucket):
            raise LedgerError("bucket_not_found", "Receiver has no such bucket")
    c.run("UPDATE rules SET armed=true WHERE uid=%s AND done_at IS NULL", uid)   # money arrived: auto-transfers wake up
    return nb


def _insert_tx(c, **t: Any) -> str:
    t.setdefault("id", new_id("t"))
    cols = ["id", "uid", "kind", "amount", "fee", "balance_after", "ts", "counterparty_phone", "counterparty_name",
            "trx_id", "bucket", "peer_uid", "peer_tx_id", "auto", "idem_key"]
    vals = [t.get(k) if k in t else {"fee": Decimal(0), "counterparty_phone": "", "counterparty_name": "",
                                     "trx_id": "", "bucket": "", "auto": False}.get(k) for k in cols]
    c.run(f"INSERT INTO txs ({','.join(cols)}) VALUES ({','.join(['%s'] * len(cols))})", *vals)
    return t["id"]


def _result(tx: dict, replayed: bool = False) -> dict:
    return {"tx_id": tx["id"], "trx_id": tx["trx_id"], "kind": tx["kind"], "amount": -tx["amount"] - tx["fee"] if tx["amount"] < 0 else tx["amount"],
            "fee": tx["fee"], "balance": tx["balance_after"], "replayed": replayed}


def _saved_name(c, uid: str, phone: str) -> str:
    r = c.one("SELECT name FROM saved_accounts WHERE uid=%s AND phone=%s", uid, phone)
    return r["name"] if r else ""


def _transfer(c, now: int, payer_uid: str, payee_uid: str | None, amount: Decimal, *, kind_out: str, kind_in: str,
              phone: str = "", fee: Decimal | None = None, bucket_from: str | None = None, bucket_to: str | None = None,
              auto: bool = False, idem_key: str | None = None) -> dict:
    """Moves money payer -> payee (internal wallet) or payer -> outside (payee_uid None). One atomic unit."""
    ws = _lock(c, payer_uid, *([payee_uid] if payee_uid else []))
    me = ws.get(payer_uid)
    if not me:
        raise LedgerError("not_found", "Wallet not found")
    if payee_uid and payee_uid not in ws:
        raise LedgerError("recipient_not_found", "Recipient not found")
    fee = fee if fee is not None else fee_for(kind_out, amount, is_student(me))
    total = amount + fee
    new_bal = _debit(c, me, total, bucket_from, now)
    trx = new_trx()
    rname = ws[payee_uid]["name"] if payee_uid else _saved_name(c, payer_uid, phone)
    out_id = _insert_tx(c, uid=payer_uid, kind=kind_out, amount=-total, fee=fee, balance_after=new_bal, ts=now,
                        counterparty_phone=phone or (ws[payee_uid]["phone"] if payee_uid else ""), counterparty_name=rname,
                        trx_id=trx, bucket=bucket_from or "", peer_uid=payee_uid, auto=auto, idem_key=idem_key)
    if payee_uid:
        rb = _credit(c, payee_uid, amount, bucket_to)
        in_id = _insert_tx(c, uid=payee_uid, kind=kind_in, amount=amount, balance_after=rb, ts=now,
                           counterparty_phone=me["phone"], counterparty_name=me["name"], trx_id=trx,
                           bucket=bucket_to or "", peer_uid=payer_uid, peer_tx_id=out_id, auto=auto)
        c.run("UPDATE txs SET peer_tx_id=%s WHERE id=%s", in_id, out_id)
    return _result(c.one("SELECT * FROM txs WHERE id=%s", out_id))


def _replay(db, uid: str, idem_key: str) -> dict | None:
    with db.tx() as c:
        t = c.one("SELECT * FROM txs WHERE uid=%s AND idem_key=%s", uid, idem_key)
        return _result(t, replayed=True) if t else None


def _with_idem(db, uid: str, idem_key: str | None, fn) -> dict:
    if idem_key:
        prior = _replay(db, uid, idem_key)
        if prior:
            return prior
    try:
        with db.tx() as c:
            return fn(c)
    except IntegrityError:                              # two identical retries raced: the unique index let only one in
        if idem_key:
            prior = _replay(db, uid, idem_key)
            if prior:
                return prior
        raise LedgerError("conflict", "Could not complete, please retry")


def pay(db, uid: str, service: str, amount: Any, *, to_phone: str = "", bucket: str | None = None,
        pin: str | None = None, idem_key: str | None = None, now: int | None = None) -> dict:
    now = now or now_ms()
    if service not in SERVICES:
        raise LedgerError("bad_service", "Unknown service")
    amount = positive(amount)
    if idem_key:
        prior = _replay(db, uid, idem_key)
        if prior:
            return prior
    check_pin(db, uid, pin, now)

    def run(c):
        payee = None
        if service == "send":
            r = c.one("SELECT uid FROM wallets WHERE phone=%s", to_phone)
            if not r:
                raise LedgerError("recipient_not_found", "This number is not on upay 2.0")
            if r["uid"] == uid:
                raise LedgerError("self_send", "You cannot send to your own number")
            payee = r["uid"]
        return _transfer(c, now, uid, payee, amount, kind_out=service, kind_in="receive", phone=to_phone,
                         bucket_from=bucket, idem_key=idem_key)
    return _with_idem(db, uid, idem_key, run)


def add_money_demo(db, uid: str, amount: Any, now: int | None = None) -> dict:
    """DEMO ONLY (UPAY_DEMO_MODE=1). Production must credit only after the bank/card gateway confirms."""
    now = now or now_ms()
    amount = positive(amount)
    with db.tx() as c:
        _lock(c, uid)
        nb = _credit(c, uid, amount)
        tid = _insert_tx(c, uid=uid, kind="add", amount=amount, balance_after=nb, ts=now, trx_id=new_trx())
        return _result(c.one("SELECT * FROM txs WHERE id=%s", tid))


# ------------------------------------------------------------------ wrong-number cancel
def undo(db, uid: str, tx_id: str, now: int | None = None) -> dict:
    now = now or now_ms()
    with db.tx() as c:
        t = c.one("SELECT * FROM txs WHERE id=%s FOR UPDATE", tx_id)       # serialises two cancels of the same payment
        if not t or t["uid"] != uid:
            raise LedgerError("not_found", "Transaction not found")
        if t["kind"] != "send" or not t["peer_uid"]:
            raise LedgerError("forbidden", "Only Send Money can be cancelled")
        if t["undone"]:
            raise LedgerError("already_undone", "Already cancelled")
        if now > t["ts"] + C.UNDO_WINDOW_MS:
            raise LedgerError("undo_expired", "The cancel window has closed")
        ws = _lock(c, uid, t["peer_uid"])
        me, rcv = ws[uid], ws[t["peer_uid"]]
        if me["frozen"]:
            raise LedgerError("frozen", "Account is frozen")
        recent = [x for x in (me["undos"] or []) if now - x < 86_400_000]
        if len(recent) >= C.UNDO_MAX_PER_DAY:
            raise LedgerError("undo_limit", "Cancel limit reached for today, contact support")
        recv_amt = -t["amount"] - t["fee"]                # the receiver got `amount`; the sender paid amount + fee
        if _free(rcv, _buckets(c, rcv["uid"])) < recv_amt:
            raise LedgerError("recipient_spent", "The receiver already spent this money")
        c.run("UPDATE wallets SET balance = balance - %s WHERE uid=%s", recv_amt, rcv["uid"])
        c.run("UPDATE wallets SET balance = balance + %s, undos = %s::jsonb WHERE uid=%s",
              -t["amount"], json.dumps(recent + [now]), uid)
        if t["bucket"]:                                   # money goes back into the bucket it came from
            c.run("INSERT INTO buckets (uid,name,amount) VALUES (%s,%s,%s) ON CONFLICT (uid,name) DO UPDATE SET amount = buckets.amount + EXCLUDED.amount",
                  uid, t["bucket"], -t["amount"])
        c.run("UPDATE txs SET undone=true WHERE id = ANY(%s)", [t["id"], t["peer_tx_id"]])
        nb = c.one("SELECT balance FROM wallets WHERE uid=%s", uid)["balance"]
        return {"tx_id": tx_id, "refunded": -t["amount"], "balance": nb}


# ------------------------------------------------------------------ history
def history(db, uid: str, limit: int = 50, offset: int = 0, q: str = "", direction: str = "all") -> list[dict]:
    limit = max(1, min(int(limit), 500))
    sql = "SELECT * FROM txs WHERE uid=%s"
    args: list[Any] = [uid]
    if direction == "in":
        sql += " AND amount>0"
    elif direction == "out":
        sql += " AND amount<0"
    if q:
        sql += " AND (counterparty_phone ILIKE %s OR counterparty_name ILIKE %s OR trx_id ILIKE %s)"
        like = "%" + q.replace("%", "").replace("_", "") + "%"
        args += [like, like, like]
    sql += " ORDER BY ts DESC, id DESC LIMIT %s OFFSET %s"
    args += [limit, max(0, int(offset))]
    with db.tx() as c:
        return c.all(sql, *args)


# ------------------------------------------------------------------ student plan: buckets, saved accounts, auto transfer
def _need_student(w: dict | None) -> dict:
    if not w:
        raise LedgerError("not_found", "Wallet not found")
    if not is_student(w):
        raise LedgerError("not_student", "Verified student account required")
    return w


def bucket_add(db, uid: str, name: str, amount: Any) -> None:
    """Sets money aside (balance is unchanged). Cannot set aside more than the free balance."""
    name, amount = (name or "").strip(), positive(amount)
    if not name or len(name) > 40:
        raise LedgerError("bad_name", "Bucket name required")
    with db.tx() as c:
        w = _need_student(_lock(c, uid).get(uid))
        if _free(w, _buckets(c, uid)) < amount:
            raise LedgerError("insufficient", "Not enough free balance")
        c.run("INSERT INTO buckets (uid,name,amount) VALUES (%s,%s,%s) ON CONFLICT (uid,name) DO UPDATE SET amount = buckets.amount + EXCLUDED.amount",
              uid, name, amount)


def bucket_remove(db, uid: str, name: str) -> None:
    with db.tx() as c:
        _lock(c, uid)
        c.run("DELETE FROM buckets WHERE uid=%s AND name=%s", uid, name)    # money simply becomes free balance again


def create_rule(db, uid: str, phone: str, amount: Any, *, name: str = "", run_at: int = 0, repeat: bool = False,
                pin: str | None = None, now: int | None = None) -> int:
    now = now or now_ms()
    amount = positive(amount)
    if not (isinstance(phone, str) and len(phone) == 11 and phone.isdigit() and phone.startswith("01")):
        raise LedgerError("bad_phone", "Enter a valid mobile number")
    check_pin(db, uid, pin, now)
    with db.tx() as c:
        w = _need_student(_lock(c, uid).get(uid))
        if w["phone"] == phone:
            raise LedgerError("self_send", "You cannot send to your own number")
        name = (name or _saved_name(c, uid, phone) or "").strip()
        if name:
            c.run("INSERT INTO saved_accounts (uid,phone,name) VALUES (%s,%s,%s) ON CONFLICT (uid,phone) DO UPDATE SET name=EXCLUDED.name", uid, phone, name)
        return c.one("INSERT INTO rules (uid,phone,name,amount,run_at,repeat,armed) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                     uid, phone, name, amount, int(run_at or 0), bool(repeat), bool(repeat))["id"]


def delete_rule(db, uid: str, rule_id: int) -> None:
    with db.tx() as c:
        c.run("DELETE FROM rules WHERE id=%s AND uid=%s", rule_id, uid)


def run_due_rules(db, now: int | None = None, limit: int = 100) -> dict:
    """Called by the scheduler every few seconds, also when the app is closed. SKIP LOCKED lets several workers
    run at once without sending the same rule twice."""
    now = now or now_ms()
    sent = skipped = 0
    with db.tx() as c:
        rules = c.all("SELECT * FROM rules WHERE armed AND done_at IS NULL AND run_at <= %s ORDER BY id LIMIT %s FOR UPDATE SKIP LOCKED", now, limit)
        for r in rules:
            try:
                with c.savepoint():
                    me = c.one("SELECT * FROM wallets WHERE uid=%s", r["uid"])
                    if not me or not is_student(me):
                        raise LedgerError("not_student")
                    to = c.one("SELECT uid FROM wallets WHERE phone=%s", r["phone"])
                    _transfer(c, now, r["uid"], to["uid"] if to else None, r["amount"], kind_out="auto_send", kind_in="receive",
                              phone=r["phone"], fee=Decimal(0), auto=True)
                    if r["repeat"]:
                        nxt = add_month(r["run_at"] or now)
                        while nxt <= now:
                            nxt = add_month(nxt)
                        c.run("UPDATE rules SET run_at=%s, last_at=%s WHERE id=%s", nxt, now, r["id"])
                    else:
                        c.run("UPDATE rules SET done_at=%s, last_at=%s WHERE id=%s", now, now, r["id"])
                    sent += 1
            except LedgerError:
                skipped += 1                              # not enough money / limit / frozen: stays armed, tried again later
    return {"sent": sent, "skipped": skipped}


# ------------------------------------------------------------------ bill split
def split_create(db, uid: str, total: Any, phones: list[str], note: str = "", now: int | None = None) -> list[dict]:
    now = now or now_ms()
    total = positive(total)
    phones = list(dict.fromkeys(p.strip() for p in phones if p and p.strip()))
    if not phones:
        raise LedgerError("bad_request", "Add at least one friend")
    share = (total / (len(phones) + 1)).quantize(TWO, rounding=ROUND_DOWN)   # remainder stays with the requester
    if share <= 0:
        raise LedgerError("bad_amount", "Amount too small to split")
    out = []
    with db.tx() as c:
        me = _lock(c, uid).get(uid)
        if not me:
            raise LedgerError("not_found", "Wallet not found")
        for p in phones:
            w = c.one("SELECT uid FROM wallets WHERE phone=%s", p)
            if not w or w["uid"] == uid:
                raise LedgerError("recipient_not_found", f"Number not found: {p}")
            sid = new_id("s")
            c.run("INSERT INTO splits (id,from_uid,to_uid,amount,total,note,status,ts) VALUES (%s,%s,%s,%s,%s,%s,'open',%s)",
                  sid, uid, w["uid"], share, total, (note or "")[:80], now)
            out.append({"id": sid, "to": w["uid"], "amount": share})
    return out


def split_pay(db, uid: str, split_id: str, pin: str | None, now: int | None = None) -> dict:
    now = now or now_ms()
    check_pin(db, uid, pin, now)
    with db.tx() as c:
        s = c.one("SELECT * FROM splits WHERE id=%s FOR UPDATE", split_id)       # row lock: a double click pays once
        if not s or s["to_uid"] != uid:
            raise LedgerError("not_found", "Request not found")
        if s["status"] != "open":
            raise LedgerError("conflict", "Already " + s["status"])
        res = _transfer(c, now, uid, s["from_uid"], s["amount"], kind_out="split", kind_in="split")
        c.run("UPDATE splits SET status='paid' WHERE id=%s", split_id)
        return res


def split_decline(db, uid: str, split_id: str) -> None:
    with db.tx() as c:
        if not c.run("UPDATE splits SET status='declined' WHERE id=%s AND to_uid=%s AND status='open'", split_id, uid):
            raise LedgerError("conflict", "Request not open")


def splits_for(db, uid: str) -> dict:
    with db.tx() as c:
        return {"incoming": c.all("SELECT s.*, w.name AS from_name, w.phone AS from_phone FROM splits s JOIN wallets w ON w.uid=s.from_uid WHERE s.to_uid=%s ORDER BY s.ts DESC", uid),
                "outgoing": c.all("SELECT s.*, w.name AS to_name FROM splits s JOIN wallets w ON w.uid=s.to_uid WHERE s.from_uid=%s ORDER BY s.ts DESC", uid)}


# ------------------------------------------------------------------ guardian link
def guardian_request(db, student_uid: str, guardian_phone: str) -> None:
    with db.tx() as c:
        w = _need_student(_lock(c, student_uid).get(student_uid))
        g = c.one("SELECT uid FROM wallets WHERE phone=%s", guardian_phone)
        if not g or g["uid"] == student_uid:
            raise LedgerError("recipient_not_found", "Number not found")
        c.run("UPDATE wallets SET guardian_uid=%s, guardian_status='pending' WHERE uid=%s", g["uid"], student_uid)


def guardian_approve(db, guardian_uid: str, student_uid: str) -> None:
    with db.tx() as c:
        if not c.run("UPDATE wallets SET guardian_status='ok' WHERE uid=%s AND guardian_uid=%s AND guardian_status='pending'", student_uid, guardian_uid):
            raise LedgerError("not_found", "No pending request")


def guardian_remove(db, uid: str, student_uid: str) -> None:
    """The student or the guardian can end the link at any time."""
    with db.tx() as c:
        if not c.run("UPDATE wallets SET guardian_uid=NULL, guardian_status='' WHERE uid=%s AND (uid=%s OR guardian_uid=%s)", student_uid, uid, uid):
            raise LedgerError("not_found", "No such link")


def guardian_students(db, guardian_uid: str) -> list[dict]:
    """Students linked to this guardian. Bucket NAMES (not amounts) are shown only after the student approved the link."""
    with db.tx() as c:
        rows = c.all("SELECT uid, name, phone, guardian_status FROM wallets WHERE guardian_uid=%s ORDER BY name", guardian_uid)
        for r in rows:
            r["buckets"] = [b["name"] for b in c.all("SELECT name FROM buckets WHERE uid=%s ORDER BY name", r["uid"])] if r["guardian_status"] == "ok" else []
        return rows


def _linked(c, guardian_uid: str, student_uid: str) -> dict:
    w = c.one("SELECT * FROM wallets WHERE uid=%s", student_uid)
    if not w or w["guardian_uid"] != guardian_uid or w["guardian_status"] != "ok":
        raise LedgerError("forbidden", "Not linked to this student")
    return w


def guardian_send(db, guardian_uid: str, student_uid: str, amount: Any, bucket: str | None = None,
                  pin: str | None = None, now: int | None = None) -> dict:
    now = now or now_ms()
    amount = positive(amount)
    check_pin(db, guardian_uid, pin, now)
    with db.tx() as c:
        _linked(c, guardian_uid, student_uid)
        return _transfer(c, now, guardian_uid, student_uid, amount, kind_out="send", kind_in="receive", bucket_to=bucket or None)


def guardian_statement(db, guardian_uid: str, student_uid: str, now: int | None = None) -> list[dict]:
    now = now or now_ms()
    with db.tx() as c:
        _linked(c, guardian_uid, student_uid)
        g = c.one("SELECT name FROM wallets WHERE uid=%s", guardian_uid)
        c.run("UPDATE wallets SET guardian_seen_at=%s, guardian_seen_by=%s WHERE uid=%s", now, g["name"], student_uid)   # student gets told
        return c.all("SELECT * FROM txs WHERE uid=%s ORDER BY ts DESC, id DESC LIMIT %s", student_uid, C.GUARDIAN_STATEMENT_ROWS)


def guardian_seen_ack(db, student_uid: str, now: int | None = None) -> None:
    with db.tx() as c:
        c.run("UPDATE wallets SET guardian_seen_ack=%s WHERE uid=%s", now or now_ms(), student_uid)


# ------------------------------------------------------------------ admin
def admin_adjust(db, uid: str, delta: Any, now: int | None = None) -> dict:
    now = now or now_ms()
    d = money(delta)
    if d == 0:
        raise LedgerError("bad_amount", "Amount is zero")
    with db.tx() as c:
        w = _lock(c, uid).get(uid)
        if not w:
            raise LedgerError("not_found", "Wallet not found")
        if d < 0 and _free(w, _buckets(c, uid)) < -d:
            raise LedgerError("insufficient", "Would take the balance below the student's buckets")
        nb = c.one("UPDATE wallets SET balance = balance + %s WHERE uid=%s RETURNING balance", d, uid)["balance"]
        tid = _insert_tx(c, uid=uid, kind="admin", amount=d, balance_after=nb, ts=now, trx_id=new_trx())
        return _result(c.one("SELECT * FROM txs WHERE id=%s", tid))


def admin_set_frozen(db, uid: str, frozen: bool) -> None:
    with db.tx() as c:
        if not c.run("UPDATE wallets SET frozen=%s, frozen_by=%s, frozen_at=%s WHERE uid=%s",
                     bool(frozen), "admin" if frozen else "", now_ms() if frozen else 0, uid):
            raise LedgerError("not_found", "Wallet not found")


def self_freeze(db, uid: str, pin: Any, now: int | None = None) -> None:
    """Customer freezes their own wallet (lost / stolen phone). Needs the PIN, so it also works from a friend's phone after login.
    Only an admin can unfreeze, after checking who is asking. Freezing twice is harmless."""
    check_pin(db, uid, pin, now)
    with db.tx() as c:
        c.run("UPDATE wallets SET frozen_by=CASE WHEN frozen THEN frozen_by ELSE 'self' END, "
              "frozen_at=CASE WHEN frozen THEN frozen_at ELSE %s END, frozen=true WHERE uid=%s", now or now_ms(), uid)


def admin_set_student(db, uid: str, ok: bool) -> None:
    """Approving a student application. The ONLY way student_ok becomes true."""
    with db.tx() as c:
        if not c.run("UPDATE wallets SET student_ok=%s, acct=CASE WHEN %s THEN 'student' WHEN acct='student' THEN 'personal' ELSE acct END WHERE uid=%s",
                     bool(ok), bool(ok), uid):
            raise LedgerError("not_found", "Wallet not found")


def set_account_type(db, uid: str, acct: str) -> None:
    with db.tx() as c:
        w = _lock(c, uid).get(uid)
        if not w:
            raise LedgerError("not_found", "Wallet not found")
        if acct == "student" and not w["student_ok"]:
            raise LedgerError("forbidden", "Student accounts need admin approval")
        if acct not in ("personal", "islamic", "student"):
            raise LedgerError("bad_request", "Unknown account type")
        c.run("UPDATE wallets SET acct=%s WHERE uid=%s", acct, uid)


def demo_reset_pin(db, uid: str) -> None:
    with db.tx() as c:
        c.run("UPDATE wallets SET pin_hash=NULL, pin_salt=NULL, pin_fails=0, pin_locked_until=0 WHERE uid=%s", uid)


def admin_delete_wallet(db, uid: str) -> None:
    """DEMO ONLY: a real ledger is append-only. Removes the wallet and everything that belongs to it."""
    with db.tx() as c:
        c.run("DELETE FROM docs WHERE owner_uid=%s", uid)
        c.run("DELETE FROM splits WHERE from_uid=%s OR to_uid=%s", uid, uid)
        c.run("UPDATE txs SET peer_uid=NULL WHERE peer_uid=%s", uid)
        c.run("DELETE FROM wallets WHERE uid=%s", uid)


# ------------------------------------------------------------------ sign-up / login (number + 4-digit PIN)
def register(db, name: str, phone: str, nid: str, dob: str, pin: str, now: int | None = None) -> dict:
    """New customer: name, mobile number, NID, birth date, 4-digit PIN. The NID is stored only as a keyed hash + last 4 digits."""
    now = now or now_ms()
    name, phone, nid = (name or "").strip(), (phone or "").strip(), (nid or "").strip()
    if not 2 <= len(name) <= 80:
        raise LedgerError("bad_request", "Enter your full name")
    if not (len(phone) == 11 and phone.isdigit() and phone.startswith("01")):
        raise LedgerError("bad_request", "Enter an 11-digit mobile number")
    if not (nid.isdigit() and len(nid) in (10, 13, 17)):
        raise LedgerError("bad_request", "NID must be 10, 13 or 17 digits")
    try:
        d = datetime.strptime(dob or "", "%Y-%m-%d").date()
    except ValueError:
        raise LedgerError("bad_request", "Enter a valid birth date")
    if d > datetime.now(timezone.utc).date() or d.year < 1900:
        raise LedgerError("bad_request", "Enter a valid birth date")
    _valid_pin(pin)
    uid, salt = "u" + secrets.token_hex(8), secrets.token_hex(16)
    nid_hash = hmac.new(C.SECRET_KEY.encode(), nid.encode(), hashlib.sha256).hexdigest()
    try:
        with db.tx() as c:
            c.run("INSERT INTO wallets (uid,name,phone,balance,created_at,pin_hash,pin_salt,nid_hash,nid_last4,dob) "
                  "VALUES (%s,%s,%s,0,%s,%s,%s,%s,%s,%s)", uid, name, phone, now, _hash_pin(pin, salt), salt, nid_hash, nid[-4:], dob)
            return public_wallet(c.one("SELECT * FROM wallets WHERE uid=%s", uid))
    except IntegrityError:
        raise LedgerError("conflict", "An account with this number or NID already exists")


def login(db, phone: str, pin: str, now: int | None = None) -> dict:
    """Checks number + PIN (wrong tries are counted and lock the PIN, same as payments). Same error for unknown number and wrong PIN."""
    w = find_by_phone(db, (phone or "").strip())
    if not w:
        raise LedgerError("pin_wrong", "Wrong number or PIN")
    check_pin(db, w["uid"], pin, now)
    return get_wallet(db, w["uid"])
