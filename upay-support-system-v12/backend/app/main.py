"""upay API (FastAPI). Thin layer: authentication, validation and HTTP status mapping. All money rules live in ledger.py."""
from __future__ import annotations
import asyncio, logging, os, time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import auth, config as C, docs, ledger as L, prefs
from .ledger import LedgerError

log = logging.getLogger("upay")
STATUS = {"unauthorized": 401, "not_found": 404, "forbidden": 403, "frozen": 403, "not_student": 403, "pin_wrong": 401, "pin_locked": 423,
          "conflict": 409, "rate_limited": 429}


class Pay(BaseModel):
    service: str
    amount: str | float | int
    to_phone: str = ""
    bucket: Optional[str] = None
    pin: str = ""


class RegisterIn(BaseModel):
    name: str
    phone: str
    nid: str
    dob: str
    pin: str


class LoginIn(BaseModel):
    phone: str
    pin: str


class PinIn(BaseModel):
    new_pin: str
    old_pin: Optional[str] = None


class DemoLogin(BaseModel):
    uid: str = Field(min_length=2, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    name: str = Field(default="", max_length=60)


class BucketIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    amount: str | float | int


class RuleIn(BaseModel):
    phone: str
    amount: str | float | int
    name: str = ""
    run_at: int = 0
    repeat: bool = False
    pin: str = ""


class SplitIn(BaseModel):
    total: str | float | int
    phones: list[str] = Field(max_length=20)
    note: str = ""


class PinOnly(BaseModel):
    pin: str = ""


class GuardianSend(BaseModel):
    student_uid: str
    amount: str | float | int
    bucket: Optional[str] = None
    pin: str = ""


class PrefIn(BaseModel):
    value: Any = None


class PhoneIn(BaseModel):
    phone: str


class AcctIn(BaseModel):
    acct: str


class AmountIn(BaseModel):
    amount: str | float | int


class AdjustIn(BaseModel):
    uid: str
    delta: str | float | int


class FreezeIn(BaseModel):
    uid: str
    frozen: bool


class StudentIn(BaseModel):
    uid: str
    ok: bool


class Limiter:
    """Tiny in-memory sliding window (per process). Use Redis / the API gateway when running several workers."""
    def __init__(self):
        self.h: dict[str, deque] = defaultdict(deque)

    def hit(self, key: str, n: int, per_s: float) -> None:
        now, q = time.monotonic(), self.h[key]
        while q and now - q[0] > per_s:
            q.popleft()
        if len(q) >= n:
            raise LedgerError("rate_limited", "Too many requests, slow down")
        q.append(now)


def create_app(db=None, start_scheduler: bool = True) -> FastAPI:
    if db is None:
        from .db import PsycopgDatabase
        db = PsycopgDatabase(C.DATABASE_URL)
        db.init_schema(os.path.join(os.path.dirname(os.path.dirname(__file__)), "schema.sql"))
    lim = Limiter()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task = None

        async def loop():
            while True:                                   # sends due auto-transfers, even when no app is open
                try:
                    r = await asyncio.to_thread(L.run_due_rules, db)
                    if r["sent"]:
                        log.info("auto transfers sent: %s", r)
                except Exception:
                    log.exception("scheduler error")
                await asyncio.sleep(C.SCHEDULER_INTERVAL_S)
        if start_scheduler:
            task = asyncio.create_task(loop())
        yield
        if task:
            task.cancel()

    app = FastAPI(title="upay 2.0 API", version="1.0", lifespan=lifespan)
    app.state.db = db
    app.add_middleware(CORSMiddleware, allow_origins=C.CORS_ORIGINS, allow_methods=["*"],
                       allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Admin-Key"])

    @app.exception_handler(LedgerError)
    async def ledger_error(_: Request, e: LedgerError):
        return JSONResponse({"error": e.code, "message": e.message, **e.extra}, status_code=STATUS.get(e.code, 400))

    @app.exception_handler(Exception)
    async def unexpected(_: Request, e: Exception):
        log.exception("unhandled error")
        return JSONResponse({"error": "server_error", "message": "Something went wrong"}, status_code=500)

    def me(authorization: str | None = Header(default=None)) -> str:
        uid = auth.read_token(authorization[7:]) if authorization and authorization.startswith("Bearer ") else None
        if not uid:
            raise LedgerError("unauthorized", "Please sign in again")
        return uid

    def admin(x_admin_key: str | None = Header(default=None)) -> bool:
        if not auth.admin_ok(x_admin_key):
            raise LedgerError("forbidden", "Admin only")
        return True

    # ---------------- session
    @app.get("/api/health")
    def health():
        with db.tx() as c:
            c.one("SELECT 1 AS ok")
        return {"ok": True}

    @app.post("/api/auth/demo")
    def demo_login(b: DemoLogin):
        if not C.DEMO_MODE:
            raise LedgerError("forbidden", "Demo login is disabled")
        w = L.ensure_wallet(db, b.uid, b.name or ("Customer " + b.uid[-4:]), opening_balance=12500)
        return {"token": auth.issue_token(b.uid), "wallet": w}

    @app.post("/api/auth/register")
    def register(b: RegisterIn):
        lim.hit("reg:" + b.phone[:11], 5, 600)
        w = L.register(db, b.name, b.phone, b.nid, b.dob, b.pin)
        return {"token": auth.issue_token(w["uid"]), "wallet": w}

    @app.post("/api/auth/login")
    def login(b: LoginIn):
        lim.hit("login:" + b.phone[:11], 10, 60)
        w = L.login(db, b.phone, b.pin)
        return {"token": auth.issue_token(w["uid"]), "wallet": w}

    @app.get("/api/me")
    def get_me(uid: str = Depends(me)):
        return L.get_wallet(db, uid)

    @app.post("/api/pin")
    def set_pin(b: PinIn, uid: str = Depends(me)):
        L.set_pin(db, uid, b.new_pin, b.old_pin)
        return {"ok": True}

    @app.post("/api/freeze")
    def freeze_me(b: PinOnly, uid: str = Depends(me)):
        lim.hit("freeze:" + uid, 10, 60)
        L.self_freeze(db, uid, b.pin)
        return {"ok": True}

    @app.get("/api/prefs")
    def prefs_all(uid: str = Depends(me)):
        return prefs.get_all(db, uid)

    @app.get("/api/prefs/{key}")
    def prefs_one(key: str, uid: str = Depends(me)):
        return {"value": prefs.get_one(db, uid, key)}

    @app.put("/api/prefs/{key}")
    def prefs_put(key: str, b: PrefIn, uid: str = Depends(me)):
        lim.hit("prefs:" + uid, 60, 60)
        return {"value": prefs.put(db, uid, key, b.value)}

    @app.post("/api/account-type")
    def acct_type(b: AcctIn, uid: str = Depends(me)):
        L.set_account_type(db, uid, b.acct)
        return {"ok": True}

    # ---------------- money
    @app.get("/api/lookup/{phone}")
    def lookup(phone: str, uid: str = Depends(me)):
        lim.hit("lookup:" + uid, 30, 60)                  # stops people scanning numbers to learn names
        w = L.find_by_phone(db, phone)
        if not w:
            raise LedgerError("not_found", "Number not found on upay 2.0")
        return {"name": w["name"], "is_self": w["uid"] == uid}

    @app.post("/api/pay")
    def pay(b: Pay, uid: str = Depends(me), idempotency_key: str | None = Header(default=None)):
        lim.hit("pay:" + uid, 20, 60)
        return L.pay(db, uid, b.service, b.amount, to_phone=b.to_phone, bucket=b.bucket or None, pin=b.pin,
                     idem_key=(idempotency_key or "")[:80] or None)

    @app.post("/api/undo/{tx_id}")
    def undo(tx_id: str, uid: str = Depends(me)):
        return L.undo(db, uid, tx_id)

    @app.get("/api/history")
    def history(uid: str = Depends(me), limit: int = Query(50, le=500), offset: int = 0, q: str = "", direction: str = "all"):
        return L.history(db, uid, limit, offset, q, direction)

    # ---------------- student plan
    @app.post("/api/buckets")
    def bucket_add(b: BucketIn, uid: str = Depends(me)):
        L.bucket_add(db, uid, b.name, b.amount)
        return {"ok": True}

    @app.delete("/api/buckets/{name}")
    def bucket_del(name: str, uid: str = Depends(me)):
        L.bucket_remove(db, uid, name)
        return {"ok": True}

    @app.post("/api/rules")
    def rule_add(b: RuleIn, uid: str = Depends(me)):
        return {"id": L.create_rule(db, uid, b.phone, b.amount, name=b.name, run_at=b.run_at, repeat=b.repeat, pin=b.pin)}

    @app.delete("/api/rules/{rule_id}")
    def rule_del(rule_id: int, uid: str = Depends(me)):
        L.delete_rule(db, uid, rule_id)
        return {"ok": True}

    # ---------------- bill split
    @app.post("/api/splits")
    def split_new(b: SplitIn, uid: str = Depends(me)):
        return L.split_create(db, uid, b.total, b.phones, b.note)

    @app.get("/api/splits")
    def split_list(uid: str = Depends(me)):
        return L.splits_for(db, uid)

    @app.post("/api/splits/{sid}/pay")
    def split_pay(sid: str, b: PinOnly, uid: str = Depends(me)):
        lim.hit("pay:" + uid, 20, 60)
        return L.split_pay(db, uid, sid, b.pin)

    @app.post("/api/splits/{sid}/decline")
    def split_decline(sid: str, uid: str = Depends(me)):
        L.split_decline(db, uid, sid)
        return {"ok": True}

    # ---------------- guardian
    @app.post("/api/guardian/request")
    def g_request(b: PhoneIn, uid: str = Depends(me)):
        L.guardian_request(db, uid, b.phone)
        return {"ok": True}

    @app.get("/api/guardian/students")
    def g_students(uid: str = Depends(me)):
        return L.guardian_students(db, uid)

    @app.post("/api/guardian/approve/{student_uid}")
    def g_approve(student_uid: str, uid: str = Depends(me)):
        L.guardian_approve(db, uid, student_uid)
        return {"ok": True}

    @app.delete("/api/guardian/{student_uid}")
    def g_remove(student_uid: str, uid: str = Depends(me)):
        L.guardian_remove(db, uid, student_uid)
        return {"ok": True}

    @app.post("/api/guardian/send")
    def g_send(b: GuardianSend, uid: str = Depends(me)):
        lim.hit("pay:" + uid, 20, 60)
        return L.guardian_send(db, uid, b.student_uid, b.amount, b.bucket, b.pin)

    @app.get("/api/guardian/statement/{student_uid}")
    def g_statement(student_uid: str, uid: str = Depends(me)):
        return L.guardian_statement(db, uid, student_uid)

    @app.post("/api/guardian/seen-ack")
    def g_ack(uid: str = Depends(me)):
        L.guardian_seen_ack(db, uid)
        return {"ok": True}

    # ---------------- demo helpers (only when UPAY_DEMO_MODE=1)
    @app.post("/api/demo/add-money")
    def demo_add(b: AmountIn, uid: str = Depends(me)):
        if not C.DEMO_MODE:
            raise LedgerError("forbidden", "Disabled")
        return L.add_money_demo(db, uid, b.amount)

    @app.post("/api/demo/make-student")
    def demo_student(uid: str = Depends(me)):
        if not C.DEMO_MODE:
            raise LedgerError("forbidden", "Disabled")
        L.admin_set_student(db, uid, True)
        return {"ok": True}

    @app.post("/api/demo/reset-pin")
    def demo_pin(uid: str = Depends(me)):
        if not C.DEMO_MODE:
            raise LedgerError("forbidden", "Disabled")
        L.demo_reset_pin(db, uid)
        return {"ok": True}

    # ---------------- support documents (customer side: own documents only)
    @app.get("/api/docs/{collection}")
    def docs_mine(collection: str, uid: str = Depends(me), since: int = 0):
        if collection not in docs.CUSTOMER_COLLECTIONS:
            raise LedgerError("forbidden", "Not allowed")
        return docs.list_(db, collection, owner_uid=uid, since=since)

    @app.get("/api/docs/{collection}/{id_}")
    def docs_get(collection: str, id_: str, uid: str = Depends(me)):
        if collection not in docs.CUSTOMER_COLLECTIONS:
            raise LedgerError("forbidden", "Not allowed")
        d = docs.get(db, collection, id_)
        if d is None or d.get("uid") != uid:
            raise LedgerError("not_found", "Not found")
        return d

    @app.put("/api/docs/{collection}/{id_}")
    def docs_put(collection: str, id_: str, data: dict[str, Any], uid: str = Depends(me)):
        lim.hit("docs:" + uid, 60, 60)
        return docs.customer_put(db, uid, collection, id_, data)

    @app.delete("/api/docs/{collection}/{id_}")
    def docs_delete(collection: str, id_: str, uid: str = Depends(me)):
        docs.customer_delete(db, uid, collection, id_)
        return {"ok": True}

    @app.get("/api/config/{name}")
    def config_get(name: str, uid: str = Depends(me)):
        if name not in ("app", "faqs", "student"):
            raise LedgerError("forbidden", "Not allowed")
        return docs.get(db, "config", name) or {}

    # ---------------- admin (X-Admin-Key header)
    @app.get("/api/admin/wallets")
    def a_wallets(_: bool = Depends(admin)):
        with db.tx() as c:
            return [L.public_wallet(w) for w in c.all("SELECT * FROM wallets ORDER BY created_at")]

    @app.get("/api/admin/txs")
    def a_txs(_: bool = Depends(admin), limit: int = Query(200, le=1000)):
        with db.tx() as c:
            return c.all("SELECT * FROM txs ORDER BY ts DESC LIMIT %s", limit)

    @app.post("/api/admin/adjust")
    def a_adjust(b: AdjustIn, _: bool = Depends(admin)):
        return L.admin_adjust(db, b.uid, b.delta)

    @app.post("/api/admin/freeze")
    def a_freeze(b: FreezeIn, _: bool = Depends(admin)):
        L.admin_set_frozen(db, b.uid, b.frozen)
        return {"ok": True}

    @app.post("/api/admin/student")
    def a_student(b: StudentIn, _: bool = Depends(admin)):
        L.admin_set_student(db, b.uid, b.ok)
        return {"ok": True}

    @app.get("/api/admin/docs/{collection}")
    def a_docs(collection: str, _: bool = Depends(admin), since: int = 0):
        return docs.list_(db, collection, since=since)

    @app.get("/api/admin/docs/{collection}/{id_}")
    def a_docs_get(collection: str, id_: str, _: bool = Depends(admin)):
        d = docs.get(db, collection, id_)
        if d is None:
            raise LedgerError("not_found", "Not found")
        return d

    @app.put("/api/admin/docs/{collection}/{id_}")
    def a_docs_put(collection: str, id_: str, data: dict[str, Any], _: bool = Depends(admin)):
        owner = data.get("uid") if isinstance(data.get("uid"), str) else (id_ if collection == "chats" else None)
        docs.put_raw(db, collection, id_, data, owner)
        return {"ok": True}

    @app.delete("/api/admin/docs/{collection}/{id_}")
    def a_docs_del(collection: str, id_: str, _: bool = Depends(admin)):
        docs.delete(db, collection, id_)
        return {"ok": True}

    @app.delete("/api/admin/wallets/{uid}")
    def a_wallet_delete(uid: str, _: bool = Depends(admin)):
        if not C.DEMO_MODE:
            raise LedgerError("forbidden", "Wallets cannot be deleted outside demo mode (the ledger is append-only)")
        L.admin_delete_wallet(db, uid)
        return {"ok": True}

    @app.post("/api/admin/run-rules")
    def a_run_rules(_: bool = Depends(admin)):
        return L.run_due_rules(db)

    # ---------------- serve the web app from the same origin (no CORS needed): UPAY_STATIC_DIR, default ../upay-support-suite
    static = os.getenv("UPAY_STATIC_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "upay-support-suite"))
    if os.path.isdir(static):
        from fastapi.responses import Response
        from fastapi.staticfiles import StaticFiles

        @app.get("/config.js")
        def web_config():                                  # tells the web app to use this server instead of browser storage
            return Response('window.UPAY_API="";', media_type="application/javascript")
        app.mount("/", StaticFiles(directory=static, html=True), name="web")

    return app


def app_factory() -> FastAPI:          # uvicorn app.main:app_factory --factory
    return create_app()
