"""Tests for: referral bonus, SMS OTP, simulated recharge / biller providers, demo-mode gating.
Run:  PGHOST=/tmp python3 -m unittest tests.test_features -v      (needs the same test database as the other tests)"""
import os, re, sys, unittest
from decimal import Decimal as D

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tests import _fastapi
from app import auth, config as C, ledger as L, providers
from app.ledger import LedgerError
from tests.psql_shim import PsqlDatabase
from tests.test_ledger import T0, MIN, err

try:
    from fastapi.testclient import TestClient
    from app.main import create_app
    HAVE_FASTAPI = True
except Exception:
    HAVE_FASTAPI = False

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEMA = os.path.join(ROOT, "schema.sql")
NID = "1234567890"


def reg(db, name, phone, ref="", now=T0):
    return L.register(db, name, phone, NID + phone[-3:], "2000-01-01", "1234", now=now, ref=ref)


class Base(unittest.TestCase):
    db = PsqlDatabase(host=os.getenv("PGHOST", "/tmp"))

    def setUp(self):
        self.db.reset(SCHEMA)
        self._saved = (C.REFERRAL_MAX_PER_REFERRER, C.REQUIRE_OTP, C.DEMO_MODE)

    def tearDown(self):
        C.REFERRAL_MAX_PER_REFERRER, C.REQUIRE_OTP, C.DEMO_MODE = self._saved

    def bal(self, uid):
        return L.get_wallet(self.db, uid)["balance"]

    def kinds(self, uid):
        with self.db.tx() as c:
            return [r["kind"] for r in c.all("SELECT kind FROM txs WHERE uid=%s ORDER BY ts, id", uid)]


class TestReferral(Base):
    def test_both_get_bonus_and_ledger_explains_it(self):
        a = reg(self.db, "Anika", "01711111111")
        self.assertEqual(a["referral_bonus"], "0.00")
        code = L.referral_code("01711111111")
        self.assertEqual(code, "UP711111111")
        b = reg(self.db, "Babul", "01822222222", ref=code)
        self.assertEqual(b["referral_bonus"], "50")
        self.assertEqual((self.bal(a["uid"]), self.bal(b["uid"])), (D("50"), D("50")))
        self.assertEqual(self.kinds(a["uid"]), ["referral"])
        self.assertEqual(self.kinds(b["uid"]), ["referral_new"])
        with self.db.tx() as c:
            self.assertEqual(c.one("SELECT referred_by FROM wallets WHERE uid=%s", b["uid"])["referred_by"], a["uid"])
            for w in c.all("SELECT uid, balance FROM wallets"):
                self.assertEqual(w["balance"], c.one("SELECT COALESCE(SUM(amount),0) s FROM txs WHERE uid=%s", w["uid"])["s"])
        info = L.referral_info(self.db, a["uid"])
        self.assertEqual((info["code"], info["friends_paid"], info["earned"]), (code, 1, "50.00"))

    def test_bad_codes_do_not_create_the_account(self):
        reg(self.db, "Anika", "01711111111")
        for bad in ("UP999999999", "XX711111111", "UP12", "UP71111111A"):
            self.assertEqual(err(reg, self.db, "Babul", "01822222222", ref=bad).code, "bad_referral", bad)
        self.assertIsNone(L.find_by_phone(self.db, "01822222222"))
        self.assertEqual(err(reg, self.db, "Anika2", "01711111111", ref="UP711111111").code, "bad_referral")   # a number cannot refer itself

    def test_a_friend_is_paid_for_at_most_max_signups(self):
        C.REFERRAL_MAX_PER_REFERRER = 2
        a = reg(self.db, "Anika", "01711111111")
        code = L.referral_code("01711111111")
        res = [reg(self.db, "F%d" % i, "0182222222%d" % i, ref=code)["referral_bonus"] for i in range(3)]
        self.assertEqual(res, ["50", "50", "0.00"])
        self.assertEqual(self.bal(a["uid"]), D("100"))
        self.assertIsNotNone(L.find_by_phone(self.db, "01822222222"))          # the 3rd account still exists
        # a new customer's own welcome bonus does not use up their own referral allowance
        self.assertEqual(self.kinds(a["uid"]), ["referral", "referral"])

    def test_bonus_wallet_is_not_free_money_to_withdraw_over_limits(self):
        b = reg(self.db, "Babul", "01822222222")
        self.assertEqual(self.bal(b["uid"]), D("0"))


class TestOtp(Base):
    def test_send_verify_once_only(self):
        code = L.create_otp(self.db, "01711111111", "register", now=T0)
        self.assertRegex(code, r"^\d{6}$")
        with self.db.tx() as c:
            self.assertNotIn(code, str(c.all("SELECT * FROM otps")))               # only a hash is stored
        self.assertTrue(L.verify_otp(self.db, "01711111111", "register", code, now=T0 + MIN))
        self.assertEqual(err(L.verify_otp, self.db, "01711111111", "register", code, now=T0 + MIN).code, "otp_invalid")   # one use only

    def test_wrong_tries_lock_and_expiry(self):
        code = L.create_otp(self.db, "01711111111", "register", now=T0)
        wrong = "000000" if code != "000000" else "111111"
        for i in range(C.OTP_MAX_TRIES):
            self.assertEqual(err(L.verify_otp, self.db, "01711111111", "register", wrong, now=T0).code, "otp_invalid")
        self.assertEqual(err(L.verify_otp, self.db, "01711111111", "register", code, now=T0).code, "otp_locked")   # even the right code
        code2 = L.create_otp(self.db, "01711111111", "register", now=T0 + 40_000)                                   # a new code resets tries
        self.assertEqual(err(L.verify_otp, self.db, "01711111111", "register", code2, now=T0 + 40_000 + C.OTP_TTL_S * 1000 + 1).code, "otp_invalid")

    def test_resend_cooldown_and_account_rules(self):
        L.create_otp(self.db, "01711111111", "register", now=T0)
        self.assertEqual(err(L.create_otp, self.db, "01711111111", "register", now=T0 + 1000).code, "rate_limited")
        self.assertIsNotNone(L.create_otp(self.db, "01711111111", "register", now=T0 + 31_000))
        reg(self.db, "Anika", "01733333333")
        self.assertEqual(err(L.create_otp, self.db, "01733333333", "register", now=T0).code, "conflict")           # already has an account
        self.assertIsNone(L.create_otp(self.db, "01744444444", "login", now=T0))                                   # unknown number: nothing sent
        self.assertIsNotNone(L.create_otp(self.db, "01733333333", "login", now=T0))
        self.assertEqual(err(L.create_otp, self.db, "123", "login").code, "bad_request")

    def test_proof_token_is_bound_to_phone_purpose_and_time(self):
        t = auth.issue_otp_token("01711111111", "register", now=1000)
        self.assertTrue(auth.otp_token_ok(t, "01711111111", "register", now=1001))
        self.assertFalse(auth.otp_token_ok(t, "01722222222", "register", now=1001))
        self.assertFalse(auth.otp_token_ok(t, "01711111111", "login", now=1001))
        self.assertFalse(auth.otp_token_ok(t, "01711111111", "register", now=1000 + C.OTP_TOKEN_TTL_S + 1))
        self.assertFalse(auth.otp_token_ok("", "01711111111", "register"))
        self.assertIsNone(auth.read_token(t))                                  # an OTP proof can never be used as a login token


class TestProviders(Base):
    def mk(self, uid="rahim", balance=5000):
        L.ensure_wallet(self.db, uid, uid.title(), now=T0, opening_balance=balance)
        L.set_pin(self.db, uid, "1234")

    def test_recharge_records_operator_and_fails_before_charging(self):
        self.mk()
        r = L.pay(self.db, "rahim", "recharge", 100, to_phone="01712345678", pin="1234", now=T0)
        self.assertEqual(self.bal("rahim"), D("4900"))
        with self.db.tx() as c:
            self.assertEqual(c.one("SELECT counterparty_name n FROM txs WHERE id=%s", r["tx_id"])["n"], "Grameenphone")
        e = err(L.pay, self.db, "rahim", "recharge", 100, to_phone="01712300000", pin="1234", now=T0)
        self.assertEqual(e.code, "provider_failed")
        self.assertEqual(self.bal("rahim"), D("4900"))                         # not charged
        self.assertEqual(err(L.pay, self.db, "rahim", "recharge", 5, to_phone="01712345678", pin="1234", now=T0).code, "bad_amount")
        self.assertEqual(err(L.pay, self.db, "rahim", "recharge", 1001, to_phone="01712345678", pin="1234", now=T0).code, "bad_amount")
        self.assertEqual(err(L.pay, self.db, "rahim", "recharge", 50, to_phone="12345", pin="1234", now=T0).code, "bad_phone")
        self.assertEqual(err(L.pay, self.db, "rahim", "recharge", 50, to_phone="01012345678", pin="1234", now=T0).code, "bad_phone")   # unknown prefix
        L.pay(self.db, "rahim", "recharge", 50, to_phone="01012345678", operator="robi", pin="1234", now=T0)                 # ported number: customer's choice wins
        with self.db.tx() as c:
            self.assertEqual(c.one("SELECT counterparty_name n FROM txs WHERE uid='rahim' ORDER BY ts DESC, id DESC LIMIT 1")["n"], "Robi")
        self.assertEqual(err(L.pay, self.db, "rahim", "recharge", 50, to_phone="01712345678", operator="nope", pin="1234", now=T0).code, "bad_request")

    def test_bill_with_biller_and_without(self):
        self.mk()
        r = L.pay(self.db, "rahim", "bill", 700, to_phone="12345678", biller="desco", pin="1234", now=T0)
        with self.db.tx() as c:
            self.assertEqual(c.one("SELECT counterparty_name n FROM txs WHERE id=%s", r["tx_id"])["n"], "DESCO (Dhaka North)")
        self.assertEqual(err(L.pay, self.db, "rahim", "bill", 700, to_phone="12345678", biller="nobody", pin="1234", now=T0).code, "bad_request")
        self.assertEqual(err(L.pay, self.db, "rahim", "bill", 700, to_phone="12 4", biller="desco", pin="1234", now=T0).code, "bad_account")
        self.assertEqual(err(L.pay, self.db, "rahim", "bill", 700, to_phone="90000000", biller="desco", pin="1234", now=T0).code, "provider_failed")
        self.assertEqual(self.bal("rahim"), D("4300"))
        L.pay(self.db, "rahim", "bill", 100, to_phone="x", pin="1234", now=T0)  # old style (free-text account, no biller) still works
        self.assertEqual(self.bal("rahim"), D("4200"))

    def test_lookup_is_stable_and_marked_simulated(self):
        a = providers.bill_lookup("titas", "A1234567")
        self.assertEqual(a, providers.bill_lookup("titas", "A1234567"))
        self.assertTrue(a["simulated"])
        self.assertNotEqual(a["due"], providers.bill_lookup("titas", "A1234568")["due"])
        self.assertEqual(err(providers.bill_lookup, "x", "A1234567").code, "bad_request")

    def test_billers_js_has_the_same_ids_as_the_server(self):
        js = open(os.path.join(os.path.dirname(ROOT), "upay-support-suite", "billers.js"), encoding="utf-8").read()
        ids = set(re.findall(r"\bid:'([a-z0-9]+)'", js.split("const BILLERS")[1].split("];")[0]))
        self.assertEqual(ids, set(providers.BILLER_IDS))


@unittest.skipUnless(HAVE_FASTAPI, "fastapi/httpx not installed")
class TestApi(Base):
    def setUp(self):
        super().setUp()
        self.c = TestClient(create_app(self.db, start_scheduler=False), raise_server_exceptions=False)
        C.DEMO_MODE = True

    def otp_token(self, phone, purpose):
        r = self.c.post("/api/auth/otp/send", json={"phone": phone, "purpose": purpose})
        self.assertEqual(r.status_code, 200, r.text)
        code = r.json()["demo_code"]
        r = self.c.post("/api/auth/otp/verify", json={"phone": phone, "purpose": purpose, "code": code})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["otp_token"]

    def body(self, phone="01711111111", **k):
        return {"name": "Anika", "phone": phone, "nid": NID + phone[-3:], "dob": "2000-01-01", "pin": "1234", **k}

    def test_demo_code_only_in_demo_mode(self):
        r = self.c.post("/api/auth/otp/send", json={"phone": "01711111111", "purpose": "register"})
        self.assertRegex(r.json()["demo_code"], r"^\d{6}$")
        C.DEMO_MODE = False
        r = self.c.post("/api/auth/otp/send", json={"phone": "01711111112", "purpose": "register"})
        self.assertEqual(r.status_code, 200); self.assertNotIn("demo_code", r.json())

    def test_otp_is_enforced_when_required(self):
        C.REQUIRE_OTP = True
        r = self.c.post("/api/auth/register", json=self.body())
        self.assertEqual((r.status_code, r.json()["error"]), (401, "otp_required"))
        self.assertIsNone(L.find_by_phone(self.db, "01711111111"))
        wrong = self.otp_token("01722222222", "register")                                   # proof for another number
        self.assertEqual(self.c.post("/api/auth/register", json=self.body(otp_token=wrong)).json()["error"], "otp_required")
        tok = self.otp_token("01711111111", "register")
        r = self.c.post("/api/auth/register", json=self.body(otp_token=tok))
        self.assertEqual(r.status_code, 200, r.text)
        # login: right PIN but no code -> otp_required; wrong PIN is still reported as wrong PIN
        self.assertEqual(self.c.post("/api/auth/login", json={"phone": "01711111111", "pin": "9999"}).json()["error"], "pin_wrong")
        r = self.c.post("/api/auth/login", json={"phone": "01711111111", "pin": "1234"})
        self.assertEqual((r.status_code, r.json()["error"]), (401, "otp_required"))
        r = self.c.post("/api/auth/login", json={"phone": "01711111111", "pin": "1234", "otp_token": self.otp_token("01711111111", "login")})
        self.assertEqual(r.status_code, 200, r.text)
        # a register proof cannot be used for login
        self.assertEqual(self.c.post("/api/auth/login", json={"phone": "01711111111", "pin": "1234", "otp_token": tok}).json()["error"], "otp_required")

    def test_otp_not_required_by_default(self):
        C.REQUIRE_OTP = False
        self.assertEqual(self.c.post("/api/auth/register", json=self.body()).status_code, 200)

    def test_otp_wrong_code_and_unknown_login_number(self):
        r = self.c.post("/api/auth/otp/send", json={"phone": "01711111111", "purpose": "register"})
        r = self.c.post("/api/auth/otp/verify", json={"phone": "01711111111", "purpose": "register", "code": "abcdef"})
        self.assertEqual((r.status_code, r.json()["error"]), (400, "otp_invalid"))
        r = self.c.post("/api/auth/otp/send", json={"phone": "01755555555", "purpose": "login"})   # unknown number looks exactly like a real send
        self.assertEqual(r.status_code, 200); self.assertNotIn("demo_code", r.json())

    def test_referral_through_the_api(self):
        a = self.c.post("/api/auth/register", json=self.body()).json()
        h = {"Authorization": "Bearer " + a["token"]}
        code = self.c.get("/api/referral", headers=h).json()["code"]
        b = self.c.post("/api/auth/register", json=self.body("01822222222", ref=code)).json()
        self.assertEqual(b["wallet"]["referral_bonus"], "50")
        self.assertEqual(float(self.c.get("/api/me", headers=h).json()["balance"]), 50.0)
        self.assertEqual(self.c.get("/api/referral", headers=h).json()["friends_paid"], 1)
        r = self.c.post("/api/auth/register", json=self.body("01933333333", ref="UP999999999"))
        self.assertEqual((r.status_code, r.json()["error"]), (400, "bad_referral"))
        hist = self.c.get("/api/history", headers=h).json()
        self.assertEqual(hist[0]["kind"], "referral")

    def test_billers_and_recharge_endpoints(self):
        self.assertEqual(self.c.get("/api/billers").status_code, 401)
        t = self.c.post("/api/auth/demo", json={"uid": "rahim", "name": "Rahim"}).json()["token"]
        h = {"Authorization": "Bearer " + t}
        d = self.c.get("/api/billers", headers=h).json()
        self.assertTrue(d["simulated"]); self.assertEqual({b["category"] for b in d["billers"]} >= {"electricity", "gas", "water", "internet"}, True)
        self.assertEqual({o["id"] for o in d["operators"]}, {"gp", "bl", "robi", "tt"})
        r = self.c.get("/api/billers/desco/lookup/12345678", headers=h)
        self.assertEqual(r.status_code, 200); self.assertTrue(r.json()["simulated"])
        self.assertEqual(self.c.get("/api/billers/zzz/lookup/12345678", headers=h).status_code, 400)
        self.c.post("/api/pin", headers=h, json={"new_pin": "1234"})
        r = self.c.post("/api/pay", headers=h, json={"service": "recharge", "amount": 100, "to_phone": "01712300000", "pin": "1234"})
        self.assertEqual((r.status_code, r.json()["error"]), (502, "provider_failed"))
        r = self.c.post("/api/pay", headers=h, json={"service": "recharge", "amount": 100, "to_phone": "01912345678", "operator": "bl", "pin": "1234"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(float(self.c.get("/api/me", headers=h).json()["balance"]), 12400.0)
        hist = self.c.get("/api/history", headers=h).json()
        self.assertEqual(hist[0]["counterparty_name"], "Banglalink")

    def test_demo_features_are_closed_in_production_mode(self):
        t = self.c.post("/api/auth/demo", json={"uid": "rahim", "name": "Rahim"}).json()["token"]
        h = {"Authorization": "Bearer " + t}
        C.DEMO_MODE = False
        self.assertEqual(self.c.post("/api/auth/demo", json={"uid": "zed", "name": "Z"}).status_code, 403)
        for p, b in (("/api/demo/add-money", {"amount": 100}), ("/api/demo/make-student", {}), ("/api/demo/reset-pin", {})):
            self.assertEqual(self.c.post(p, headers=h, json=b).status_code, 403, p)
        self.assertIn("UPAY_DEMO=false", self.c.get("/config.js").text.replace(" ", ""))
        C.DEMO_MODE = True
        self.assertIn("UPAY_DEMO=true", self.c.get("/config.js").text.replace(" ", ""))


if __name__ == "__main__":
    unittest.main(verbosity=2)
