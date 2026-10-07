"""Browser + backend + PostgreSQL end-to-end tests: the real web app talking to the real API (app/main.py).
Start the server first:   python3 tests/e2e_server.py &      then:   python3 tests/e2e_api.py [test_name ...]
Server state is read through the admin API, so the tests check what the DATABASE says, not what the page shows."""
import json, os, sys, time, traceback, uuid
import requests
from playwright.sync_api import sync_playwright

BASE = os.getenv("E2E_BASE", "http://localhost:8800")
ADM = {"X-Admin-Key": os.getenv("UPAY_ADMIN_KEY", "dev-admin-key")}
VP = {"width": 412, "height": 860}
RUN = uuid.uuid4().hex[:5]
ERRORS = []


def new_run():
    global RUN
    RUN = uuid.uuid4().hex[:5]


def U(name):                      # unique user id per test run, so tests never see each other's money
    return f"{name}{RUN}"


def wallets():
    return {w["uid"]: w for w in requests.get(BASE + "/api/admin/wallets", headers=ADM).json()}


def wallet(uid):
    return wallets()[uid]


def bal(uid):
    return round(float(wallet(uid)["balance"]), 2)


def txs(uid):
    return [t for t in requests.get(BASE + "/api/admin/txs?limit=1000", headers=ADM).json() if t["uid"] == uid]


class Api:
    """Direct API client acting as a user (used to move money in without a browser)."""
    def __init__(self, uid, name=None):
        r = requests.post(BASE + "/api/auth/demo", json={"uid": uid, "name": name or uid})
        r.raise_for_status()
        self.uid, self.h = uid, {"Authorization": "Bearer " + r.json()["token"]}

    def get(self, p): return requests.get(BASE + p, headers=self.h)
    def post(self, p, body=None, **h): return requests.post(BASE + p, json=body or {}, headers={**self.h, **h})
    def me(self): return self.get("/api/me").json()
    def phone(self): return self.me()["phone"]
    def set_pin(self, pin="1234"): return self.post("/api/pin", {"new_pin": pin})
    def send(self, to, amt, pin="1234"): return self.post("/api/pay", {"service": "send", "amount": amt, "to_phone": to.phone(), "pin": pin})


def new_page(ctx, uid, name=None, admin=False):
    p = ctx.new_page(); PAGES.append(p)
    p.on("pageerror", lambda e: ERRORS.append(f"{uid}: {e}"))
    p.on("console", lambda m: ERRORS.append(f"{uid} console: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "ERR_" not in m.text and "404" not in m.text and "401" not in m.text and "409" not in m.text and "400" not in m.text and "403" not in m.text and "423" not in m.text else None)
    if admin:
        p.on("dialog", lambda d: d.accept(ADM["X-Admin-Key"]))
        p.goto(BASE + "/admin.html")
    else:
        p.goto(f"{BASE}/index.html?u={uid}&n={name or uid}")
        p.wait_for_function("window.bellRef && document.querySelector('.who span').textContent.startsWith('01')")
    return p


PAGES = []


def ctx_of(b, **kw):
    c = b.new_context(viewport=kw.pop("viewport", VP), **kw)
    c.add_init_script("localStorage.setItem('upay_lang','en')")
    return c


def toast(p):
    try:
        p.wait_for_function("document.querySelector('#toast') && document.querySelector('#toast').innerText.trim()!==''", timeout=4000)
    except Exception:
        pass
    return p.inner_text("#toast")


def enter_pin(p, pin="1234"):
    try:
        p.wait_for_selector("#pn1", timeout=2500)
    except Exception:
        return False
    p.fill("#pn1", pin)
    if p.query_selector("#pn2"):
        p.fill("#pn2", pin)
    p.evaluate("document.querySelector('#toast').innerText=''")   # drop a stale toast so we read the new one
    p.click("#pok")
    return True


def ui_pay(p, svc, phone, amt, pin="1234"):
    p.click("[data-tab=home]")
    p.click(f'.it[data-s="{svc}"]')
    p.fill("#f1", phone); p.fill("#f2", str(amt)); p.click("#ok")
    if svc == "সেন্ড মানি":
        p.wait_for_function("document.querySelector('#ok').textContent.includes('Yes')")
        p.click("#ok")
    enter_pin(p, pin)
    return toast(p)


def close_sheet(p):
    try: p.click("#pno", timeout=1500)
    except Exception: pass


def make_student(p):
    p.click("[data-tab=more]"); p.click("#demoRow"); p.click("#dvs"); p.wait_for_timeout(500)


# ------------------------------------------------------------------ tests
def t_server_decides_fee_and_pin(b):
    c = ctx_of(b); a = new_page(c, U("rahim"), "Rahim"); uid = U("rahim")
    msg = ui_pay(a, "ক্যাশ আউট", "01711111111", 1000)
    assert "successful" in msg, msg
    assert bal(uid) == 12500 - 1018.5, bal(uid)                      # 1.85% fee decided by the server
    assert wallet(uid)["has_pin"]
    make_student(a)
    ui_pay(a, "ক্যাশ আউট", "01711111111", 1000)
    assert bal(uid) == round(12500 - 1018.5 - 1014.8, 2), bal(uid)    # student: 20% off
    # wrong PIN x3: refused by the server, balance unchanged, then locked
    before = bal(uid)
    for i in range(3):
        a.click('.it[data-s="ক্যাশ আউট"]'); a.fill("#f1", "01711111111"); a.fill("#f2", "100"); a.click("#ok")
        enter_pin(a, "0000")
        m = toast(a)
        assert ("Wrong PIN" in m) or ("Too many" in m), m
        try: a.click("#pno", timeout=1500)
        except Exception: pass                     # sheet already closed itself (locked)
    assert bal(uid) == before
    a.click('.it[data-s="ক্যাশ আউট"]'); a.fill("#f1", "01711111111"); a.fill("#f2", "100"); a.click("#ok"); enter_pin(a, "1234")
    assert "Too many" in toast(a), "even the right PIN must be refused while locked"
    assert bal(uid) == before
    c.close()


def t_send_free_name_cancel_and_limits(b):
    c = ctx_of(b); a = new_page(c, U("rahim"), "Rahim"); k = Api(U("karim"), "Karim"); k.set_pin()
    kph = k.phone(); au, ku = U("rahim"), U("karim")
    a.click('.it[data-s="সেন্ড মানি"]'); a.fill("#f1", kph); a.fill("#f2", "500"); a.click("#ok")
    a.wait_for_function("document.querySelector('#ok').textContent.includes('Yes')")
    assert "Karim" in a.inner_text("#fee")
    a.click("#ok"); enter_pin(a); toast(a)
    assert (bal(au), bal(ku)) == (12000, 13000)
    t = [x for x in txs(au) if x["kind"] == "send"][0]
    assert float(t["fee"]) == 0 and t["counterparty_name"] == "Karim" and t["trx_id"]
    # cancel within 2 minutes returns the money
    a.click("#undoB"); a.wait_for_timeout(700)
    assert (bal(au), bal(ku)) == (12500, 12500), (bal(au), bal(ku))
    # unknown number
    a.click('.it[data-s="সেন্ড মানি"]'); a.fill("#f1", "01999999999"); a.fill("#f2", "100"); a.click("#ok")
    a.wait_for_function("document.querySelector('#ok').textContent.includes('Yes')")
    assert "not found" in a.inner_text("#fee").lower()
    a.click("#ok"); enter_pin(a)
    assert "not on upay" in toast(a) and bal(au) == 12500
    close_sheet(a)
    # daily limit enforced by the server (top the wallet up first)
    requests.post(BASE + "/api/admin/adjust", headers=ADM, json={"uid": au, "delta": 100000})
    msg1 = ui_pay(a, "সেন্ড মানি", kph, 30000); assert "successful" in msg1, msg1
    msg2 = ui_pay(a, "সেন্ড মানি", kph, 30000)
    assert "Daily limit" in msg2, msg2
    c.close()


def t_cannot_cheat_from_the_browser(b):
    c = ctx_of(b); a = new_page(c, U("mallory"), "Mallory"); uid = U("mallory")
    token = a.evaluate("API.token")
    def call(method, path, body=None):
        return a.evaluate("""async ([m,p,b])=>{const r=await fetch(p,{method:m,headers:{'Content-Type':'application/json','Authorization':'Bearer '+API.token},body:b?JSON.stringify(b):undefined});let d={};try{d=await r.json()}catch(e){}return [r.status,d]}""", [method, path, body])
    s, d = call("POST", "/api/buckets", {"name": "x", "amount": 5}); assert (s, d["error"]) == (403, "not_student"), (s, d)
    s, d = call("POST", "/api/account-type", {"acct": "student"}); assert s == 403
    s, d = call("POST", "/api/admin/adjust", {"uid": uid, "delta": 99999}); assert s == 403
    s, d = call("POST", "/api/admin/student", {"uid": uid, "ok": True}); assert s == 403
    s, d = call("POST", "/api/pay", {"service": "cashout", "amount": 100, "to_phone": "01711111111", "pin": "1234"}); assert d["error"] == "pin_required"
    Api(uid).set_pin()
    s, d = call("POST", "/api/pay", {"service": "send", "amount": -500, "to_phone": "01711111111", "pin": "1234"}); assert d["error"] == "bad_amount", d
    s, d = call("POST", "/api/pay", {"service": "send", "amount": 999999, "to_phone": "01711111111", "pin": "1234"}); assert d["error"] in ("insufficient", "recipient_not_found"), d
    s, d = call("PUT", "/api/docs/chats/someone-else", {"msgs": []}); assert s == 403
    r = requests.get(BASE + "/api/me", headers={"Authorization": "Bearer " + token[:-3] + "abc"}); assert r.status_code == 401
    assert bal(uid) == 12500
    c.close()


def t_split_guardian_notification(b):
    c = ctx_of(b); a = new_page(c, U("sara"), "Sara"); au = U("sara")
    k, n = Api(U("karim"), "Karim"), Api(U("nusrat"), "Nusrat")
    k.set_pin(); n.set_pin()
    make_student(a)
    # bill split: each friend pays 33.33, never more than the bill in total
    a.click("[data-tab=home]"); a.click('.it[data-s="বিল স্প্লিট"]'); a.fill("#st", "100"); a.fill("#sn", f"{k.phone()}, {n.phone()}, {k.phone()}"); a.click("#ok"); a.wait_for_timeout(800)
    s = k.get("/api/splits").json()["incoming"]; assert len(s) == 1 and float(s[0]["amount"]) == 33.33, s
    r = k.post(f"/api/splits/{s[0]['id']}/pay", {"pin": "1234"}); assert r.status_code == 200, r.text
    assert k.post(f"/api/splits/{s[0]['id']}/pay", {"pin": "1234"}).status_code == 409           # no double payment
    assert bal(U("karim")) == round(12500 - 33.33, 2)
    # guardian: nusrat becomes sara's guardian, views the statement, sara is told
    a.click("[data-tab=more]"); a.click("#gRow"); a.fill("#gp", n.phone()); a.click("#gl"); a.wait_for_timeout(600)
    assert n.post("/api/guardian/approve/" + au).status_code == 200
    assert n.get("/api/guardian/statement/" + au).status_code == 200
    a.click("#no"); a.click("[data-tab=home]"); a.wait_for_function("document.querySelector('#bell').textContent.trim()!=='🔔'", timeout=8000)
    a.click("#bell"); assert "viewed your statement" in a.inner_text("#panel")
    a.click("[data-gk]"); a.wait_for_timeout(800)
    assert a.evaluate("document.querySelector('#bell').textContent").strip() == "🔔"
    # a stranger cannot read her statement
    assert Api(U("stranger")).get("/api/guardian/statement/" + au).status_code == 403
    c.close()


def t_auto_transfer_runs_with_the_app_closed(b):
    c = ctx_of(b); a = new_page(c, U("sara"), "Sara"); au = U("sara")
    make_student(a)
    mom, friend = Api(U("mom"), "Mom"), Api(U("friend"), "Friend"); mom.set_pin(); friend.set_pin()
    a.click("[data-tab=more]"); a.click("#planRow")
    a.fill("#rn", "Friend"); a.fill("#rp", friend.phone()); a.fill("#ra", "300"); a.click("#rad")
    enter_pin(a); a.wait_for_timeout(800)
    assert wallet(au) and len(Api(au).me()["rules"]) == 1
    a.close()                                                        # the app is closed from now on
    fb = bal(U("friend")); assert mom.send(Api(au), 50).status_code == 200      # money arrives
    for _ in range(12):                                              # the SERVER scheduler (1 s interval here) sends it
        time.sleep(1)
        if bal(U("friend")) == fb + 300:
            break
    assert bal(U("friend")) == fb + 300, "auto transfer did not run while the app was closed"
    assert bal(au) == 12500 + 50 - 300
    time.sleep(3); assert bal(U("friend")) == fb + 300, "one-time rule must not run twice"
    c.close()


def t_csv_export_from_server_data(b):
    c = ctx_of(b, accept_downloads=True); a = new_page(c, U("rahim"), "Rahim"); k = Api(U("karim"), "Karim"); k.set_pin()
    ui_pay(a, "সেন্ড মানি", k.phone(), 150)
    a.click("[data-tab=his]")
    with a.expect_download() as d:
        a.click("#hcsv")
    lines = open(d.value.path(), encoding="utf-8-sig", newline="").read().strip().split("\r\n")
    assert lines[0].startswith('"Date","Day","Time","Type","Phone","Name"')
    assert any(k.phone() in l and "Karim" in l and "-150" in l and "12350" in l for l in lines[1:]), lines
    c.close()


def t_student_application_and_admin_console(b):
    c = ctx_of(b, viewport={"width": 1280, "height": 900}); uid = U("nila")
    # relax the rules so the test does not need photos
    requests.put(BASE + "/api/admin/docs/config/student", headers=ADM, json={"domains": "edu, ac", "req": {"email": True, "uni": True, "sid": True, "card": False, "selfie": False}})
    cu = c.new_page(viewport=VP) if False else None
    mc = ctx_of(b); a = new_page(mc, uid, "Nila")
    a.click("[data-tab=more]"); a.click("#acctRow"); a.click('[data-t="student"]')
    a.fill("#sEm", "nila@du.edu.bd"); a.fill("#sUn", "Dhaka University"); a.fill("#sId", "2024-1-60-001"); a.check("#sOk"); a.click("#sGo"); a.wait_for_timeout(800)
    assert not wallet(uid)["student_ok"]
    adm = new_page(c, "admin", admin=True)
    adm.wait_for_function("document.body.innerText.includes('Total balance')", timeout=8000)
    adm.get_by_text("Student accounts", exact=True).first.click()
    adm.wait_for_function("document.body.innerText.includes('Dhaka University') || document.body.innerText.includes('nila@du.edu.bd')", timeout=8000)
    adm.get_by_text("nila@du.edu.bd").first.click()
    adm.click('[data-a="aok"]'); adm.wait_for_timeout(1200)
    assert wallet(uid)["student_ok"] and wallet(uid)["acct"] == "student", wallet(uid)       # only the admin could do this
    a.wait_for_function("document.querySelector('#abadge').textContent.includes('Student')", timeout=8000)
    # admin console actions go through the API: freeze blocks payments
    adm.get_by_text("Customers", exact=True).last.click()
    r = requests.post(BASE + "/api/admin/freeze", headers=ADM, json={"uid": uid, "frozen": True}); assert r.status_code == 200
    k = Api(U("karim"), "Karim"); k.set_pin()
    try: a.click("#no", timeout=1500)         # close the account-type sheet that is still open
    except Exception: pass
    msg = ui_pay(a, "সেন্ড মানি", k.phone(), 10)
    assert "frozen" in msg.lower(), msg
    requests.post(BASE + "/api/admin/freeze", headers=ADM, json={"uid": uid, "frozen": False})
    c.close(); mc.close()


def t_support_chat_and_no_lost_messages(b):
    c = ctx_of(b); uid = U("chat"); a = new_page(c, uid, "Chatty")
    a.click("#chatBtn"); a.click('[data-go="chat"]') if a.query_selector('[data-go="chat"]') else None
    a.wait_for_selector("#chIn", state="visible"); a.fill("#chIn", "I forgot my pin"); a.press("#chIn", "Enter"); a.wait_for_timeout(1200)
    assert "PIN" in a.inner_text("#chMsgs") or "pin" in a.inner_text("#chMsgs").lower()
    chat = requests.get(BASE + f"/api/admin/docs/chats/{uid}", headers=ADM).json()
    assert any(m["f"] == "cu" for m in chat["msgs"]) and any(m["f"] in ("ai", "sys") for m in chat["msgs"]), chat["msgs"]
    # an agent reply written from a STALE copy of the chat must not erase the customer's newer message
    stale = dict(chat)
    me = Api(uid)
    me.post  # (session exists)
    newer = {**chat, "msgs": chat["msgs"] + [{"f": "cu", "t": "second question", "ts": int(time.time() * 1000) + 5}]}
    assert requests.put(BASE + f"/api/docs/chats/{uid}", headers=me.h, json=newer).status_code == 200
    agent = {**stale, "msgs": stale["msgs"] + [{"f": "ag", "t": "agent reply", "ts": int(time.time() * 1000) + 9}]}
    assert requests.put(BASE + f"/api/admin/docs/chats/{uid}", headers=ADM, json=agent).status_code == 200
    msgs = [m["t"] for m in requests.get(BASE + f"/api/admin/docs/chats/{uid}", headers=ADM).json()["msgs"]]
    assert "second question" in msgs and "agent reply" in msgs, msgs
    a.wait_for_function("document.querySelector('#chMsgs').innerText.includes('agent reply')", timeout=8000)
    c.close()


TESTS = [t_server_decides_fee_and_pin, t_send_free_name_cancel_and_limits, t_cannot_cheat_from_the_browser, t_split_guardian_notification,
         t_auto_transfer_runs_with_the_app_closed, t_csv_export_from_server_data, t_student_application_and_admin_console, t_support_chat_and_no_lost_messages]

if __name__ == "__main__":
    only = sys.argv[1:]
    fails = 0
    requests.get(BASE + "/api/health").raise_for_status()
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"], **({"executable_path": os.environ["CHROMIUM"]} if os.environ.get("CHROMIUM") else {}))
        for t in TESTS:
            if only and t.__name__ not in only:
                continue
            ERRORS.clear(); PAGES.clear(); new_run(); t0 = time.time()
            try:
                t(b)
                if ERRORS:
                    raise AssertionError("page errors: " + "; ".join(ERRORS[:3]))
                print(f"PASS {t.__name__} ({time.time()-t0:.1f}s)")
            except Exception as e:
                fails += 1
                print(f"FAIL {t.__name__}: {e}")
                for i, pg in enumerate(PAGES):
                    try: pg.screenshot(path=f"/tmp/fail_{t.__name__}_{i}.png")
                    except Exception: pass
                traceback.print_exc(limit=4)
        b.close()
    print("ALL PASSED" if not fails else f"{fails} FAILED")
    sys.exit(1 if fails else 0)
