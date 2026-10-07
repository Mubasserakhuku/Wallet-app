"""Gemini live-chat auto-reply tests. No network and no PostgreSQL: docs.get / docs.patch are replaced by an in-memory store, Gemini by a fake transport.
python3 -m unittest tests.test_gemchat"""
import copy, os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import config as C, docs, gemchat, llm


def gem_says(text, seen=None):
    def t(url, key, body, timeout):
        if seen is not None: seen.append(body)
        return {"candidates": [{"content": {"parts": [{"text": text}]}}]}
    return t


class TestGemChat(unittest.TestCase):
    def setUp(self):
        self.k = C.GEMINI_API_KEY; C.GEMINI_API_KEY = "test-key"
        self.store = {}
        self._get, self._patch = docs.get, docs.patch
        def get(db, col, id_): return copy.deepcopy(self.store.get((col, id_)))
        def patch(db, col, id_, fn):
            if (col, id_) not in self.store: raise docs.LedgerError("not_found", "Not found")
            self.store[(col, id_)] = fn(copy.deepcopy(self.store[(col, id_)])); return copy.deepcopy(self.store[(col, id_)])
        docs.get, docs.patch = get, patch
        self.ran = []
        self.run = lambda fn, *a: self.ran.append((fn, a))
        self.store[("chats", "u1")] = {"uid": "u1", "status": "needs_review", "last": 10, "a": {"dec": "needs_review", "policy": "Failed"},
                                       "msgs": [{"f": "cu", "t": "my money was cut 01712345678 pin 1234", "ts": 10}], "audit": []}

    def tearDown(self):
        C.GEMINI_API_KEY = self.k; docs.get, docs.patch = self._get, self._patch

    def chat(self): return self.store[("chats", "u1")]

    def test_switch_on_answers_the_waiting_message(self):
        d = gemchat.set_gem(None, "u1", True, run=self.run)
        self.assertTrue(d["gem"]); self.assertEqual(d["status"], "gem"); self.assertEqual(len(self.ran), 1)
        seen = []
        self.assertTrue(gemchat.reply_now(None, "u1", transport=gem_says("Please send the transaction ID.", seen)))
        c = self.chat(); m = c["msgs"][-1]
        self.assertEqual((m["f"], m["t"], m.get("g")), ("ai", "Please send the transaction ID.", 1))
        self.assertEqual((c["status"], c["unreadCust"]), ("gem", 1)); self.assertTrue(any("Gemini replied" in a for a in c["audit"]))
        sent = seen[0]["contents"][0]["parts"][0]["text"]                         # secrets never leave the server
        self.assertNotIn("1234", sent); self.assertNotIn("01712345678", sent)

    def test_off_means_no_reply_and_no_call(self):
        gemchat.set_gem(None, "u1", False, run=self.run); self.assertEqual(self.ran, [])
        self.assertFalse(gemchat.reply_now(None, "u1", transport=gem_says("x"))); self.assertEqual(len(self.chat()["msgs"]), 1)
        gemchat.trigger(None, "u1", run=self.run); self.assertEqual(self.ran, [])

    def test_trigger_only_when_on_and_customer_is_waiting(self):
        gemchat.set_gem(None, "u1", True, run=lambda *a: None)
        gemchat.trigger(None, "u1", run=self.run); self.assertEqual(len(self.ran), 1)
        self.chat()["msgs"].append({"f": "ag", "t": "hi", "ts": 20})                 # an agent already answered
        gemchat.trigger(None, "u1", run=self.run); self.assertEqual(len(self.ran), 1)

    def test_fraud_report_is_never_auto_answered(self):
        gemchat.set_gem(None, "u1", True, run=lambda *a: None); self.chat()["a"]["dec"] = "escalated"
        self.assertFalse(gemchat.reply_now(None, "u1", transport=gem_says("x"))); self.assertEqual(self.chat()["msgs"][-1]["f"], "cu")

    def test_answer_dropped_if_something_newer_happened(self):
        gemchat.set_gem(None, "u1", True, run=lambda *a: None)
        def slow(url, key, body, timeout):                                           # while Gemini thinks, the agent answers
            self.chat()["msgs"].append({"f": "ag", "t": "I will handle this", "ts": 30}); return gem_says("late")(url, key, body, timeout)
        self.assertFalse(gemchat.reply_now(None, "u1", transport=slow)); self.assertEqual([m["f"] for m in self.chat()["msgs"]], ["cu", "ag"])
        self.chat()["msgs"] = [self.chat()["msgs"][0]]                               # fresh waiting message
        def off(url, key, body, timeout):                                            # or the agent switches it off
            self.chat()["msgs"].append({"f": "cu", "t": "again", "ts": 40}); self.chat()["gem"] = False; return gem_says("late")(url, key, body, timeout)
        self.assertFalse(gemchat.reply_now(None, "u1", transport=off)); self.assertEqual(self.chat()["msgs"][-1]["f"], "cu")

    def test_gemini_failure_leaves_a_note_for_the_agent(self):
        gemchat.set_gem(None, "u1", True, run=lambda *a: None)
        def boom(*a): raise OSError("net")
        self.assertFalse(gemchat.reply_now(None, "u1", transport=boom))
        self.assertTrue(any("Gemini could not answer" in a for a in self.chat()["audit"])); self.assertEqual(self.chat()["msgs"][-1]["f"], "cu")

    def test_history_is_alternating_and_starts_with_the_customer(self):
        h = gemchat._history([{"f": "ai", "t": "hello"}, {"f": "cu", "t": "a"}, {"f": "cu", "t": "b"}, {"f": "sys", "t": "x"}, {"f": "ag", "t": "c"}, {"f": "cu", "t": "d"}])
        seen = []
        llm.chat_reply(h, transport=gem_says("ok", seen))
        roles = [x["role"] for x in seen[0]["contents"]]
        self.assertEqual(roles, ["user", "model", "user"]); self.assertEqual(seen[0]["contents"][0]["parts"][0]["text"], "a\nb")


if __name__ == "__main__":
    unittest.main(verbosity=2)
