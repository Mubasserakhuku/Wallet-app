"""Money-logic tests against a REAL PostgreSQL (through tests/psql_shim.py when psycopg is not installed).
Run:  PGHOST=/tmp python3 -m unittest tests.test_ledger -v     (needs database upay_test, user upay)"""
import os, random, sys, threading, unittest
from decimal import Decimal as D

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import ledger as L
from app import config as C
from app.ledger import LedgerError
from tests.psql_shim import PsqlDatabase

SCHEMA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "schema.sql")
T0 = 1_790_000_000_000          # a fixed "now" (ms); tests move the clock explicitly
MIN, DAY = 60_000, 86_400_000


def err(fn, *a, **k):
    try:
        fn(*a, **k)
    except LedgerError as e:
        return e
    raise AssertionError("expected LedgerError")


class Base(unittest.TestCase):
    db = PsqlDatabase(host=os.getenv("PGHOST", "/tmp"))

    def setUp(self):
        self.db.reset(SCHEMA)
        self.opening = {}

    def mk(self, uid, balance=10000, student=False, pin="1234"):
        w = L.ensure_wallet(self.db, uid, uid.title(), now=T0, opening_balance=balance)
        self.opening[uid] = D(balance)
        if pin:
            L.set_pin(self.db, uid, pin)
        if student:
            L.admin_set_student(self.db, uid, True)
        return w

    def phone(self, uid):
        return L.get_wallet(self.db, uid)["phone"]

    def bal(self, uid):
        return L.get_wallet(self.db, uid)["balance"]

    def send(self, a, b, amt, now=T0, **k):
        return L.pay(self.db, a, "send", amt, to_phone=self.phone(b), pin="1234", now=now, **k)

    def audit(self):
        """Global invariants that must hold after ANY sequence of operations."""
        with self.db.tx() as c:
            for w in c.all("SELECT * FROM wallets"):
                self.assertGreaterEqual(w["balance"], 0, w["uid"])
                bsum = c.one("SELECT COALESCE(SUM(amount),0) s FROM buckets WHERE uid=%s", w["uid"])["s"]
                self.assertLessEqual(bsum, w["balance"], f"buckets exceed balance for {w['uid']}")
                tsum = c.one("SELECT COALESCE(SUM(amount),0) s FROM txs WHERE uid=%s", w["uid"])["s"]
                # ledger must explain the balance exactly: opening + all txs (cancelled ones are reversed by refunds, so skip undone pairs)
                undone = c.one("SELECT COALESCE(SUM(amount),0) s FROM txs WHERE uid=%s AND undone", w["uid"])["s"]
                self.assertEqual(w["balance"], self.opening.get(w["uid"], D(0)) + tsum - undone, f"ledger mismatch for {w['uid']}")


class TestFeesAndSend(Base):
    def test_fee_rounding(self):
        self.assertEqual(L.fee_for("cashout", D("1000"), False), D("18.50"))
        self.assertEqual(L.fee_for("cashout", D("1000"), True), D("14.80"))
        self.assertEqual(L.fee_for("cashout", D("33"), False), D("0.61"))
        self.assertEqual(L.fee_for("cashout", D("33"), True), D("0.49"))
        self.assertEqual(L.fee_for("send", D("5000"), True), D("0.00"))
        self.assertEqual(L.fee_for("recharge", D("100"), False), D("0.00"))

    def test_cashout_normal_and_student(self):
        self.mk("rahim", 5000); self.mk("sara", 5000, student=True)
        r = L.pay(self.db, "rahim", "cashout", 1000, to_phone="01711111111", pin="1234", now=T0)
        self.assertEqual((r["fee"], r["balance"]), (D("18.50"), D("3981.50")))
        r = L.pay(self.db, "sara", "cashout", 1000, to_phone="01711111111", pin="1234", now=T0)
        self.assertEqual((r["fee"], r["balance"]), (D("14.80"), D("3985.20")))
        self.audit()

    def test_student_flag_is_server_side_only(self):
        self.mk("rahim", 5000)
        e = err(L.set_account_type, self.db, "rahim", "student"); self.assertEqual(e.code, "forbidden")
        r = L.pay(self.db, "rahim", "cashout", 1000, to_phone="01711111111", pin="1234", now=T0)
        self.assertEqual(r["fee"], D("18.50"))       # no discount without admin approval

    def test_send_is_free_and_records_both_sides(self):
        self.mk("rahim", 5000); self.mk("karim", 100)
        r = self.send("rahim", "karim", 500)
        self.assertEqual(r["fee"], 0)
        self.assertEqual((self.bal("rahim"), self.bal("karim")), (D("4500.00"), D("600.00")))
        h = L.history(self.db, "rahim")[0]
        self.assertEqual((h["counterparty_name"], h["counterparty_phone"], h["balance_after"]), ("Karim", self.phone("karim"), D("4500.00")))
        k = L.history(self.db, "karim")[0]
        self.assertEqual((k["kind"], k["counterparty_name"], k["trx_id"]), ("receive", "Rahim", h["trx_id"]))
        self.audit()

    def test_send_errors_move_no_money(self):
        self.mk("rahim", 100); self.mk("karim", 100)
        self.assertEqual(err(L.pay, self.db, "rahim", "send", 500, to_phone=self.phone("karim"), pin="1234").code, "insufficient")
        self.assertEqual(err(L.pay, self.db, "rahim", "send", 5, to_phone="01999999999", pin="1234").code, "recipient_not_found")
        self.assertEqual(err(L.pay, self.db, "rahim", "send", 5, to_phone=self.phone("rahim"), pin="1234").code, "self_send")
        for bad in (0, -5, "abc", "NaN", "Infinity", None):
            self.assertEqual(err(L.pay, self.db, "rahim", "send", bad, to_phone=self.phone("karim"), pin="1234").code, "bad_amount")
        self.assertEqual(err(L.pay, self.db, "rahim", "teleport", 5, pin="1234").code, "bad_service")
        self.assertEqual((self.bal("rahim"), self.bal("karim")), (D("100.00"), D("100.00")))

    def test_three_decimals_are_truncated_not_rounded_up(self):
        self.mk("rahim", 100); self.mk("karim", 0)
        self.send("rahim", "karim", "10.999")
        self.assertEqual(self.bal("karim"), D("10.99"))

    def test_frozen_wallet_cannot_pay(self):
        self.mk("rahim", 100); self.mk("karim", 0)
        L.admin_set_frozen(self.db, "rahim", True)
        self.assertEqual(err(self.send, "rahim", "karim", 5).code, "frozen")
        L.admin_set_frozen(self.db, "rahim", False)
        self.send("rahim", "karim", 5)


class TestPin(Base):
    def test_pin_required_and_hashed(self):
        self.mk("rahim", 100, pin=None); self.mk("karim", 0)
        self.assertEqual(err(self.send, "rahim", "karim", 5).code, "pin_required")
        L.set_pin(self.db, "rahim", "4321")
        with self.db.tx() as c:
            w = c.one("SELECT pin_hash, pin_salt FROM wallets WHERE uid='rahim'")
        self.assertNotIn("4321", w["pin_hash"]); self.assertEqual(len(w["pin_hash"]), 64)
        self.assertNotIn("pin_hash", L.get_wallet(self.db, "rahim")); self.assertTrue(L.get_wallet(self.db, "rahim")["has_pin"])

    def test_bad_pin_format(self):
        self.mk("rahim", 100, pin=None)
        for p in ("12", "12345", "abcd", "", None, 1234):
            self.assertEqual(err(L.set_pin, self.db, "rahim", p).code, "bad_pin_format")

    def test_lockout_and_expiry(self):
        self.mk("rahim", 100); self.mk("karim", 0)
        pay = lambda pin, now: L.pay(self.db, "rahim", "send", 5, to_phone=self.phone("karim"), pin=pin, now=now)
        e = err(pay, "0000", T0); self.assertEqual((e.code, e.extra["attempts_left"]), ("pin_wrong", 2))
        e = err(pay, "0000", T0); self.assertEqual((e.code, e.extra["attempts_left"]), ("pin_wrong", 1))
        self.assertEqual(err(pay, "0000", T0).code, "pin_locked")
        self.assertEqual(err(pay, "1234", T0 + 30_000).code, "pin_locked")      # right PIN is refused while locked
        self.assertEqual(self.bal("rahim"), D("100.00"))
        pay("1234", T0 + 61_000)                                                 # lock expired
        self.assertEqual(self.bal("rahim"), D("95.00"))

    def test_counter_resets_after_success(self):
        self.mk("rahim", 100); self.mk("karim", 0)
        pay = lambda pin: L.pay(self.db, "rahim", "send", 5, to_phone=self.phone("karim"), pin=pin, now=T0)
        err(pay, "0000"); err(pay, "0000"); pay("1234")
        self.assertEqual(err(pay, "0000").extra["attempts_left"], 2)

    def test_change_pin_needs_old(self):
        self.mk("rahim", 100)
        self.assertEqual(err(L.set_pin, self.db, "rahim", "9999", old_pin="0000").code, "pin_wrong")
        L.set_pin(self.db, "rahim", "9999", old_pin="1234")
        L.check_pin(self.db, "rahim", "9999")

    def test_parallel_guessing_is_still_limited(self):
        self.mk("rahim", 100); self.mk("karim", 0)
        codes = []
        def guess(p):
            try:
                L.pay(self.db, "rahim", "send", 5, to_phone=self.phone("karim"), pin=p, now=T0); codes.append("ok")
            except LedgerError as e:
                codes.append(e.code)
        ts = [threading.Thread(target=guess, args=(f"{i:04d}",)) for i in range(1, 11)]   # 0001..0010, none is 1234
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(codes.count("pin_wrong"), 2); self.assertEqual(codes.count("pin_locked"), 8); self.assertNotIn("ok", codes)


class TestLimits(Base):
    def test_daily_then_next_day(self):
        self.mk("rahim", 500000); self.mk("karim", 0)
        self.send("rahim", "karim", 30000, now=T0)
        e = err(self.send, "rahim", "karim", 30000, now=T0 + MIN)
        self.assertEqual(e.code, "limit_daily"); self.assertEqual(e.extra["used"], "30000.00")
        self.send("rahim", "karim", 20000, now=T0 + MIN)                      # exactly the limit is allowed
        self.send("rahim", "karim", 30000, now=T0 + DAY)                      # next day
        self.assertEqual(self.bal("karim"), D("80000.00"))

    def test_limit_counts_fee(self):
        self.mk("rahim", 500000)
        L.pay(self.db, "rahim", "bill", 49000, to_phone="x", pin="1234", now=T0)
        self.assertEqual(err(L.pay, self.db, "rahim", "cashout", 1000, to_phone="x", pin="1234", now=T0).code, "limit_daily")   # 1000+18.5 > 1000 left

    def test_monthly(self):
        self.mk("rahim", 900000)
        for i in range(4):
            L.pay(self.db, "rahim", "bill", 49000, to_phone="x", pin="1234", now=T0 + i * DAY)
        self.assertEqual(err(L.pay, self.db, "rahim", "bill", 49000, to_phone="x", pin="1234", now=T0 + 4 * DAY).code, "limit_monthly")

    def test_cancelled_payment_does_not_use_up_limit(self):
        self.mk("rahim", 500000); self.mk("karim", 0)
        r = self.send("rahim", "karim", 40000)
        L.undo(self.db, "rahim", r["tx_id"], now=T0 + MIN)
        self.send("rahim", "karim", 40000, now=T0 + 2 * MIN)


class TestConcurrency(Base):
    def test_overspend_is_impossible(self):
        self.mk("rahim", 1000); self.mk("karim", 0)
        res = []
        def go():
            try:
                self.send("rahim", "karim", 100); res.append("ok")
            except LedgerError as e:
                res.append(e.code)
        ts = [threading.Thread(target=go) for _ in range(20)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(res.count("ok"), 10); self.assertEqual(res.count("insufficient"), 10)
        self.assertEqual((self.bal("rahim"), self.bal("karim")), (D("0.00"), D("1000.00")))
        self.audit()

    def test_random_stress_conserves_money(self):
        users = [f"u{i}" for i in range(6)]
        for u in users:
            self.mk(u, 1000)
        rnd = random.Random(7)
        plan = [(rnd.choice(users), rnd.choice(users), rnd.randint(1, 400)) for _ in range(120)]
        def worker(chunk):
            for a, b, amt in chunk:
                if a == b:
                    continue
                try:
                    self.send(a, b, amt)
                except LedgerError:
                    pass
        ts = [threading.Thread(target=worker, args=(plan[i::6],)) for i in range(6)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(sum(self.bal(u) for u in users), D("6000.00"))
        self.audit()

    def test_idempotency_key_sequential_and_concurrent(self):
        self.mk("rahim", 1000); self.mk("karim", 0)
        a = self.send("rahim", "karim", 100, idem_key="k1"); b = self.send("rahim", "karim", 100, idem_key="k1")
        self.assertEqual((a["tx_id"], b["tx_id"], b["replayed"]), (a["tx_id"], a["tx_id"], True))
        self.assertEqual(self.bal("rahim"), D("900.00"))
        out = []
        def go():
            out.append(self.send("rahim", "karim", 50, idem_key="k2")["tx_id"])
        ts = [threading.Thread(target=go) for _ in range(8)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(len(set(out)), 1); self.assertEqual(self.bal("rahim"), D("850.00"))
        self.audit()

    def test_double_cancel_refunds_once(self):
        self.mk("rahim", 1000); self.mk("karim", 0)
        r = self.send("rahim", "karim", 100)
        out = []
        def go():
            try:
                L.undo(self.db, "rahim", r["tx_id"], now=T0 + MIN); out.append("ok")
            except LedgerError as e:
                out.append(e.code)
        ts = [threading.Thread(target=go) for _ in range(5)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(out.count("ok"), 1); self.assertEqual(out.count("already_undone"), 4)
        self.assertEqual((self.bal("rahim"), self.bal("karim")), (D("1000.00"), D("0.00")))
        self.audit()


class TestUndo(Base):
    def test_cancel_returns_money_and_marks_both_sides(self):
        self.mk("rahim", 1000); self.mk("karim", 0)
        r = self.send("rahim", "karim", 100)
        u = L.undo(self.db, "rahim", r["tx_id"], now=T0 + 60_000)
        self.assertEqual(u["balance"], D("1000.00"))
        self.assertTrue(L.history(self.db, "rahim")[0]["undone"]); self.assertTrue(L.history(self.db, "karim")[0]["undone"])
        self.audit()

    def test_expired_spent_other_users_and_limit(self):
        self.mk("rahim", 1000); self.mk("karim", 0); self.mk("mallory", 0)
        r = self.send("rahim", "karim", 100)
        self.assertEqual(err(L.undo, self.db, "rahim", r["tx_id"], now=T0 + 121_000).code, "undo_expired")
        self.assertEqual(err(L.undo, self.db, "mallory", r["tx_id"], now=T0 + 1).code, "not_found")
        self.assertEqual(err(L.undo, self.db, "karim", L.history(self.db, "karim")[0]["id"], now=T0 + 1).code, "forbidden")
        self.send("karim", "mallory", 60)                                        # karim spends it
        self.assertEqual(err(L.undo, self.db, "rahim", r["tx_id"], now=T0 + 60_000).code, "recipient_spent")
        self.assertEqual(self.bal("rahim"), D("900.00"))
        self.send("mallory", "karim", 60)
        for i in range(3):
            x = self.send("rahim", "karim", 10, now=T0 + i * 1000); L.undo(self.db, "rahim", x["tx_id"], now=T0 + i * 1000 + 5)
        x = self.send("rahim", "karim", 10, now=T0 + 9000)
        self.assertEqual(err(L.undo, self.db, "rahim", x["tx_id"], now=T0 + 9100).code, "undo_limit")
        L.undo(self.db, "rahim", self.send("rahim", "karim", 10, now=T0 + 2 * DAY)["tx_id"], now=T0 + 2 * DAY + 1)   # 24 h window has passed: allowed
        self.audit()


class TestStudentPlan(Base):
    def test_bucket_rules(self):
        self.mk("sara", 1000, student=True); self.mk("rahim", 1000); self.mk("karim", 0)
        self.assertEqual(err(L.bucket_add, self.db, "rahim", "food", 100).code, "not_student")
        L.bucket_add(self.db, "sara", "food", 800)
        self.assertEqual(err(L.bucket_add, self.db, "sara", "tuition", 300).code, "insufficient")
        # free balance is only 200: bigger payments must fail, even though balance is 1000
        self.assertEqual(err(L.pay, self.db, "sara", "send", 300, to_phone=self.phone("karim"), pin="1234").code, "insufficient")
        L.pay(self.db, "sara", "send", 300, to_phone=self.phone("karim"), bucket="food", pin="1234", now=T0)
        w = L.get_wallet(self.db, "sara"); self.assertEqual((w["balance"], w["buckets"][0]["amount"]), (D("700.00"), D("500.00")))
        self.assertEqual(err(L.pay, self.db, "sara", "send", 600, to_phone=self.phone("karim"), bucket="food", pin="1234").code, "insufficient")
        self.assertEqual(err(L.pay, self.db, "sara", "send", 5, to_phone=self.phone("karim"), bucket="nope", pin="1234").code, "bucket_not_found")
        self.assertEqual(err(L.pay, self.db, "rahim", "send", 5, to_phone=self.phone("karim"), bucket="food", pin="1234").code, "not_student")
        self.audit()

    def test_cancel_restores_bucket(self):
        self.mk("sara", 1000, student=True); self.mk("karim", 0)
        L.bucket_add(self.db, "sara", "food", 500)
        r = L.pay(self.db, "sara", "send", 200, to_phone=self.phone("karim"), bucket="food", pin="1234", now=T0)
        L.undo(self.db, "sara", r["tx_id"], now=T0 + 1000)
        w = L.get_wallet(self.db, "sara"); self.assertEqual((w["balance"], w["buckets"][0]["amount"]), (D("1000.00"), D("500.00")))
        self.audit()

    def test_cancel_cannot_take_money_that_receiver_set_aside(self):
        self.mk("sara", 1000, student=True); self.mk("karim", 0)
        r = self.send("karim", "sara", 0) if False else None
        self.mk("rahim", 500)
        x = self.send("rahim", "sara", 500)
        L.bucket_add(self.db, "sara", "all", 1500)                               # sara earmarks everything
        self.assertEqual(err(L.undo, self.db, "rahim", x["tx_id"], now=T0 + 1000).code, "recipient_spent")
        self.audit()

    def test_auto_transfer_wakes_up_when_money_arrives(self):
        self.mk("sara", 1000, student=True); self.mk("mom", 1000); self.mk("friend", 0)
        rid = L.create_rule(self.db, "sara", self.phone("friend"), 300, name="Friend", pin="1234", now=T0)
        self.assertEqual(L.run_due_rules(self.db, T0 + 1)["sent"], 0)            # not armed yet
        self.send("mom", "sara", 50, now=T0 + 2)                                 # money arrives -> armed
        self.assertEqual(L.run_due_rules(self.db, T0 + 3)["sent"], 1)
        self.assertEqual(L.run_due_rules(self.db, T0 + 4)["sent"], 0)            # one-time rule is finished
        self.assertEqual((self.bal("sara"), self.bal("friend")), (D("750.00"), D("300.00")))
        h = [x for x in L.history(self.db, "sara") if x["kind"] == "auto_send"][0]
        self.assertTrue(h["auto"]); self.assertEqual(h["counterparty_name"], "Friend"); self.assertEqual(h["fee"], 0)
        self.audit()

    def test_run_at_in_the_future_and_monthly_repeat(self):
        self.mk("sara", 10000, student=True); self.mk("friend", 0)
        L.create_rule(self.db, "sara", self.phone("friend"), 100, run_at=T0 + DAY, repeat=True, pin="1234", now=T0)
        self.assertEqual(L.run_due_rules(self.db, T0)["sent"], 0)
        self.assertEqual(L.run_due_rules(self.db, T0 + DAY)["sent"], 1)
        self.assertEqual(L.run_due_rules(self.db, T0 + DAY + MIN)["sent"], 0)    # next one is a month away
        self.assertEqual(L.run_due_rules(self.db, T0 + 31 * DAY)["sent"], 1)
        self.assertEqual(self.bal("friend"), D("200.00"))
        self.audit()

    def test_rule_skipped_when_poor_then_sent_later(self):
        self.mk("sara", 50, student=True); self.mk("friend", 0); self.mk("mom", 500)
        L.create_rule(self.db, "sara", self.phone("friend"), 100, repeat=True, pin="1234", now=T0)
        self.assertEqual(L.run_due_rules(self.db, T0), {"sent": 0, "skipped": 1})
        self.send("mom", "sara", 100, now=T0 + 1)
        self.assertEqual(L.run_due_rules(self.db, T0 + 2)["sent"], 1)
        self.audit()

    def test_rule_to_unknown_number_and_rule_guards(self):
        self.mk("sara", 1000, student=True); self.mk("rahim", 1000)
        L.create_rule(self.db, "sara", "01799999999", 100, name="Landlord", repeat=True, pin="1234", now=T0)
        self.assertEqual(L.run_due_rules(self.db, T0)["sent"], 1); self.assertEqual(self.bal("sara"), D("900.00"))
        self.assertEqual(err(L.create_rule, self.db, "rahim", "01799999999", 10, pin="1234").code, "not_student")
        self.assertEqual(err(L.create_rule, self.db, "sara", "01799999999", 10, pin="0000").code, "pin_wrong")
        self.assertEqual(err(L.create_rule, self.db, "sara", "123", 10, pin="1234").code, "bad_phone")
        self.assertEqual(err(L.create_rule, self.db, "sara", self.phone("sara"), 10, pin="1234").code, "self_send")

    def test_two_schedulers_never_send_twice(self):
        self.mk("sara", 1000, student=True); self.mk("friend", 0)
        L.create_rule(self.db, "sara", self.phone("friend"), 100, repeat=True, pin="1234", now=T0)
        out = []
        ts = [threading.Thread(target=lambda: out.append(L.run_due_rules(self.db, T0 + 5)["sent"])) for _ in range(6)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual(sum(out), 1); self.assertEqual(self.bal("friend"), D("100.00"))

    def test_student_loses_status_rule_stops(self):
        self.mk("sara", 1000, student=True); self.mk("friend", 0)
        L.create_rule(self.db, "sara", self.phone("friend"), 100, repeat=True, pin="1234", now=T0)
        L.admin_set_student(self.db, "sara", False)
        self.assertEqual(L.run_due_rules(self.db, T0)["sent"], 0)


class TestSplitAndGuardian(Base):
    def test_split_shares_never_exceed_bill_and_pay_once(self):
        self.mk("rahim", 0); self.mk("karim", 500); self.mk("nusrat", 500)
        s = L.split_create(self.db, "rahim", 100, [self.phone("karim"), self.phone("nusrat"), self.phone("karim")], now=T0)
        self.assertEqual([x["amount"] for x in s], [D("33.33"), D("33.33")])   # duplicate ignored; shares are rounded DOWN, 66.66 <= 100, the rest stays with rahim
        sid = s[0]["id"]
        out = []
        def go():
            try:
                L.split_pay(self.db, s[0]["to"], sid, "1234", now=T0); out.append("ok")
            except LedgerError as e:
                out.append(e.code)
        ts = [threading.Thread(target=go) for _ in range(4)]
        [t.start() for t in ts]; [t.join() for t in ts]
        self.assertEqual((out.count("ok"), out.count("conflict")), (1, 3))
        self.assertEqual((self.bal("rahim"), self.bal(s[0]["to"])), (D("33.33"), D(500) - D("33.33")))
        L.split_decline(self.db, s[1]["to"], s[1]["id"])
        self.assertEqual(err(L.split_pay, self.db, s[1]["to"], s[1]["id"], "1234").code, "conflict")
        self.assertEqual(err(L.split_pay, self.db, "rahim", s[1]["id"], "1234").code, "not_found")   # not addressed to him
        self.audit()

    def test_split_unknown_number(self):
        self.mk("rahim", 0)
        self.assertEqual(err(L.split_create, self.db, "rahim", 100, ["01999999999"]).code, "recipient_not_found")
        self.assertEqual(err(L.split_create, self.db, "rahim", 100, []).code, "bad_request")

    def test_guardian_flow_and_privacy(self):
        self.mk("sara", 100, student=True); self.mk("abbu", 5000); self.mk("stranger", 100)
        L.bucket_add(self.db, "sara", "food", 50)
        self.assertEqual(err(L.guardian_send, self.db, "abbu", "sara", 100, "food", "1234").code, "forbidden")   # not linked
        L.guardian_request(self.db, "sara", self.phone("abbu"))
        self.assertEqual(err(L.guardian_send, self.db, "abbu", "sara", 100, "food", "1234").code, "forbidden")   # still pending
        self.assertEqual(err(L.guardian_approve, self.db, "stranger", "sara").code, "not_found")
        L.guardian_approve(self.db, "abbu", "sara")
        L.guardian_send(self.db, "abbu", "sara", 400, "food", "1234", now=T0)
        w = L.get_wallet(self.db, "sara"); self.assertEqual((w["balance"], w["buckets"][0]["amount"]), (D("500.00"), D("450.00")))
        self.assertEqual(err(L.guardian_send, self.db, "abbu", "sara", 10, "nope", "1234").code, "bucket_not_found")
        self.assertEqual(err(L.guardian_statement, self.db, "stranger", "sara").code, "forbidden")
        rows = L.guardian_statement(self.db, "abbu", "sara", now=T0 + 5)
        self.assertTrue(rows)
        w = L.get_wallet(self.db, "sara"); self.assertEqual((w["guardian_seen_at"], w["guardian_seen_by"]), (T0 + 5, "Abbu"))
        L.guardian_remove(self.db, "sara", "sara")                                                              # student ends the link
        self.assertEqual(err(L.guardian_statement, self.db, "abbu", "sara").code, "forbidden")
        self.audit()

    def test_guardian_statement_limited_to_15_rows(self):
        self.mk("sara", 100000, student=True); self.mk("abbu", 0); self.mk("f", 0)
        L.guardian_request(self.db, "sara", self.phone("abbu")); L.guardian_approve(self.db, "abbu", "sara")
        for i in range(20):
            self.send("sara", "f", 1, now=T0 + i)
        self.assertEqual(len(L.guardian_statement(self.db, "abbu", "sara")), 15)


class TestAdminAndHistory(Base):
    def test_adjust_respects_buckets(self):
        self.mk("sara", 1000, student=True)
        L.bucket_add(self.db, "sara", "food", 900)
        self.assertEqual(err(L.admin_adjust, self.db, "sara", -200).code, "insufficient")
        L.admin_adjust(self.db, "sara", -100); L.admin_adjust(self.db, "sara", 50)
        self.assertEqual(self.bal("sara"), D("950.00"))
        self.assertEqual(err(L.admin_adjust, self.db, "ghost", 5).code, "not_found")
        self.audit()

    def test_history_search_and_order(self):
        self.mk("rahim", 1000); self.mk("karim", 0); self.mk("nusrat", 0)
        self.send("rahim", "karim", 10, now=T0); self.send("rahim", "nusrat", 20, now=T0 + 1)
        h = L.history(self.db, "rahim"); self.assertEqual([x["amount"] for x in h], [D("-20.00"), D("-10.00")])
        self.assertEqual(len(L.history(self.db, "rahim", q="kari")), 1)
        self.assertEqual(len(L.history(self.db, "rahim", q=self.phone("nusrat"))), 1)
        self.assertEqual(len(L.history(self.db, "rahim", direction="in")), 0)
        self.assertEqual(len(L.history(self.db, "rahim", q="'; DROP TABLE txs; --")), 0)
        self.assertEqual(len(L.history(self.db, "rahim")), 2)

    def test_schema_check_constraint_is_last_defence(self):
        self.mk("rahim", 10)
        from app.db import IntegrityError
        with self.assertRaises(IntegrityError):
            with self.db.tx() as c:
                c.run("UPDATE wallets SET balance = -1 WHERE uid='rahim'")


if __name__ == "__main__":
    unittest.main(verbosity=2)
