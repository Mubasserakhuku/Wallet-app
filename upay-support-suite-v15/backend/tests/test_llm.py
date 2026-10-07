"""Gemini draft reply tests. No network: the HTTP call is replaced by a fake transport.  PGHOST=/tmp python3 -m unittest tests.test_llm"""
import os, sys, unittest, urllib.error
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import config as C, llm
from app.ledger import LedgerError


def ok(text):
    return lambda url, key, body, t: {"candidates": [{"content": {"parts": [{"text": text}]}}]}


class TestLlm(unittest.TestCase):
    def setUp(self):
        self.k = (C.GEMINI_API_KEY, C.GEMINI_MODEL); C.GEMINI_API_KEY = "test-key"

    def tearDown(self):
        C.GEMINI_API_KEY, C.GEMINI_MODEL = self.k

    def code(self, fn, *a, **k):
        try:
            fn(*a, **k)
        except LedgerError as e:
            return e.code
        self.fail("expected LedgerError")

    def test_off_without_key(self):
        C.GEMINI_API_KEY = ""
        self.assertFalse(llm.enabled()); self.assertEqual(self.code(llm.draft_reply, "hi"), "ai_off")

    def test_secrets_are_masked_before_sending(self):
        seen = {}
        def t(url, key, body, timeout):
            seen.update(url=url, key=key, body=body); return ok("Sorry about that.")(url, key, body, timeout)
        r = llm.draft_reply("my pin 1234, otp: 998877, call 01712345678, nid 1234567890123, txn AB12CD34EF failed", "Failed or pending transaction", transport=t)
        sent = seen["body"]["contents"][0]["parts"][0]["text"]
        for secret in ("1234,", "998877", "01712345678", "1234567890123"):
            self.assertNotIn(secret, sent)
        self.assertIn("AB12CD34EF", sent); self.assertIn("Failed or pending transaction", sent)
        self.assertEqual((r["draft"], r["model"]), ("Sorry about that.", C.GEMINI_MODEL))
        self.assertIn("gemini-2.5-flash:generateContent", seen["url"]); self.assertEqual(seen["key"], "test-key")
        self.assertIn("never ask for a pin", seen["body"]["systemInstruction"]["parts"][0]["text"].lower())

    def test_errors_do_not_leak_details(self):
        def boom(*a): raise urllib.error.HTTPError("u", 403, "key=test-key bad", {}, None)
        try:
            llm.draft_reply("hello", transport=boom)
        except LedgerError as e:
            self.assertEqual(e.code, "ai_failed"); self.assertNotIn("test-key", e.message); self.assertIn("403", e.message)
        self.assertEqual(self.code(llm.draft_reply, "hello", transport=lambda *a: (_ for _ in ()).throw(OSError("net"))), "ai_failed")
        self.assertEqual(self.code(llm.draft_reply, "hello", transport=lambda *a: {"candidates": []}), "ai_failed")           # blocked / empty
        self.assertEqual(self.code(llm.draft_reply, "   ", transport=ok("x")), "bad_request")

    def test_api_endpoint_is_admin_only(self):
        from tests import _fastapi
        from fastapi.testclient import TestClient
        from app.main import create_app
        from tests.psql_shim import PsqlDatabase
        db = PsqlDatabase(host=os.getenv("PGHOST", "/tmp")); db.reset(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "schema.sql"))
        c = TestClient(create_app(db, start_scheduler=False), raise_server_exceptions=False)
        self.assertEqual(c.post("/api/admin/ai/draft", json={"text": "hi"}).status_code, 403)
        key = {"X-Admin-Key": os.getenv("UPAY_ADMIN_KEY", "dev-admin-key")}
        self.assertEqual(c.get("/api/admin/ai/status", headers=key).json(), {"enabled": True, "model": C.GEMINI_MODEL})
        C.GEMINI_API_KEY = ""
        r = c.post("/api/admin/ai/draft", headers=key, json={"text": "hi"}); self.assertEqual((r.status_code, r.json()["error"]), (503, "ai_off"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
