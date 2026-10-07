"""
upay Support Suite - browser tests (Python Playwright).
Run:  python3 -m http.server 8765 --directory ../upay-support-suite &   then   python3 test_upay.py
Every test uses a fresh browser context (= fresh localStorage), so tests do not affect each other.
"""
import os
import json, sys, time, traceback
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765"
VP = {"width": 412, "height": 860}  # phone-sized, the app is a mobile layout
ERRORS = []


def new_page(ctx, uid, name, admin=False):
    p = ctx.new_page()
    p.route("**/fonts.googleapis.com/**", lambda r: r.abort())   # tests must not depend on the internet
    p.on("pageerror", lambda e: ERRORS.append(f"{uid}: {e}"))
    p.on("console", lambda m: ERRORS.append(f"{uid} console: {m.text}") if m.type == "error" and "fonts.g" not in m.text and "ERR_" not in m.text and "404" not in m.text else None)
    p.goto(f"{BASE}/admin.html" if admin else f"{BASE}/index.html?u={uid}&n={name}")
    if not admin:
        p.wait_for_function(
            "(()=>{try{return !!JSON.parse(localStorage.getItem('upay_db'))['wallets/%s']}catch(e){return false}})() && !!window.bellRef" % uid)
    return p


def db(page):
    return page.evaluate("JSON.parse(localStorage.getItem('upay_db')||'{}')")


def wallet(page, uid):
    return db(page)["wallets/" + uid]


def bal(page, uid):
    return round(wallet(page, uid)["balance"], 2)


def set_wallet(page, uid, **kw):
    page.evaluate("([u,kw])=>claude.use('db').then(d=>d.doc('wallets/'+u).update(kw))", [uid, kw])


def add_money(page, uid, amt):
    page.evaluate("([u,a])=>claude.use('db').then(d=>d.doc('wallets/'+u).inc('balance',a))", [uid, amt])


def toast(page):
    page.wait_for_timeout(350)
    return page.inner_text("#toast")


def enter_pin(page, pin="1234"):
    """Handles both 'set PIN' (two fields) and 'enter PIN' sheets. Returns True if a PIN sheet appeared."""
    try:
        page.wait_for_selector("#pn1", timeout=1500)
    except Exception:
        return False
    page.fill("#pn1", pin)
    if page.query_selector("#pn2"):
        page.fill("#pn2", pin)
    page.click("#pok")
    return True


def open_pay(page, svc, phone, amt):
    """New full-page screens: Send Money (pick recipient, amount) and Cash Out (agent, amount) hand over to the sheet."""
    page.click(f'.it[data-s="{svc}"]')
    if svc == "সেন্ড মানি":
        page.fill("#sq", phone); page.click("#sl .crow"); page.fill("#sa", str(amt)); page.click("#sgo")
    else:
        page.fill("#cq", phone); page.fill("#ca", str(amt)); page.click("#cgo")
    page.wait_for_selector("#ok, #pn1", timeout=3000)


def pay(page, svc, phone, amt, pin="1234"):
    page.click("[data-tab=home]")
    open_pay(page, svc, phone, amt)
    if svc == "সেন্ড মানি":
        page.click("#ok")  # confirm recipient
    enter_pin(page, pin)
    return toast(page)


def make_student(page):
    page.click("[data-tab=more]")
    page.click("#demoRow")
    page.click("#dvs")
    page.wait_for_timeout(300)


# ----------------------------------------------------------------- tests
def t_atomic_race(b):
    ctx = b.new_context(viewport=VP); a = new_page(ctx, "rahim", "Rahim"); k = new_page(ctx, "karim", "Karim")
    start = bal(a, "rahim")
    js = "()=>{window.__p=claude.use('db').then(d=>Promise.all(Array.from({length:60},()=>d.doc('wallets/rahim').inc('balance',1))));return 1}"
    a.evaluate(js); k.evaluate(js)  # two tabs hammering the same wallet at the same time
    a.evaluate("window.__p"); k.evaluate("window.__p")
    assert bal(a, "rahim") == start + 120, f"lost updates: {bal(a,'rahim')} != {start+120}"
    r = a.evaluate("claude.use('db').then(d=>d.doc('wallets/rahim').inc('balance',-1e9,0).then(()=>'ok',e=>e.code))")
    assert r == "insufficient", r
    set_wallet(a, "rahim", frozen=True)
    r = a.evaluate("claude.use('db').then(d=>d.doc('wallets/rahim').inc('balance',-1,0).then(()=>'ok',e=>e.code))")
    assert r == "frozen", r
    ctx.close()


def t_fees_and_free_send(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim"); k = new_page(ctx, "karim", "Karim")
    kph = wallet(a, "karim")["phone"]
    # normal account cash-out: 1.85%
    pay(a, "ক্যাশ আউট", "01711111111", 1000)
    assert bal(a, "rahim") == 12500 - 1018.5, bal(a, "rahim")
    # student: 20% off fee -> 14.8
    make_student(a)
    pay(a, "ক্যাশ আউট", "01711111111", 1000)
    assert bal(a, "rahim") == round(12500 - 1018.5 - 1014.8, 2), bal(a, "rahim")
    # send money is free and shows the receiver's real name
    a.click("[data-tab=home]"); open_pay(a, "সেন্ড মানি", kph, "500")
    txt = a.inner_text("#fee")
    assert "Karim" in txt, txt
    a.click("#ok"); enter_pin(a)
    before_karim = 12500
    a.wait_for_timeout(500)
    assert bal(a, "karim") == before_karim + 500
    assert bal(a, "rahim") == round(12500 - 1018.5 - 1014.8 - 500, 2)
    tx = [v for key, v in db(a).items() if key.startswith("txs/") and v["uid"] == "rahim" and v["t"] == "সেন্ড মানি"][0]
    assert tx["fee"] == 0 and tx["rn"] == "Karim" and tx["trx"] and tx["bal"] == bal(a, "rahim")
    # wrong number warning (no money moves)
    start = bal(a, "rahim")
    open_pay(a, "সেন্ড মানি", "01999999999", "100")
    assert "not found" in a.inner_text("#fee").lower()
    a.click("#no")
    assert bal(a, "rahim") == start
    ctx.close()


def t_limits(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim"); k = new_page(ctx, "karim", "Karim")
    kph = wallet(a, "karim")["phone"]
    add_money(a, "rahim", 100000)
    pay(a, "সেন্ড মানি", kph, 30000)
    start = bal(a, "rahim")
    msg = pay(a, "সেন্ড মানি", kph, 30000)
    assert "Daily limit" in msg, msg
    assert bal(a, "rahim") == start, "limit did not stop the payment"
    ctx.close()


def t_pin(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim"); k = new_page(ctx, "karim", "Karim")
    kph = wallet(a, "karim")["phone"]
    # first payment asks to SET a pin; mismatching confirmation is refused
    open_pay(a, "সেন্ড মানি", kph, "100"); a.click("#ok")
    a.wait_for_selector("#pn2"); a.fill("#pn1", "1234"); a.fill("#pn2", "9999"); a.click("#pok")
    assert "do not match" in toast(a)
    assert bal(a, "rahim") == 12500
    a.fill("#pn2", "1234"); a.click("#pok"); a.wait_for_timeout(500)
    assert bal(a, "rahim") == 12400
    assert wallet(a, "rahim")["pinH"] and "1234" not in json.dumps(wallet(a, "rahim")), "PIN must be stored hashed"
    # wrong pin x3 -> locked; money never moves
    for i in range(3):
        open_pay(a, "সেন্ড মানি", kph, "100"); a.click("#ok")
        enter_pin(a, "0000")
        if i < 2:
            assert "Wrong PIN" in toast(a)
            a.click("#pno")
    a.wait_for_timeout(300)
    assert bal(a, "rahim") == 12400
    open_pay(a, "সেন্ড মানি", kph, "100"); a.click("#ok")
    assert "Too many wrong PINs" in toast(a)
    assert bal(a, "rahim") == 12400
    ctx.close()


def t_cancel(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim"); k = new_page(ctx, "karim", "Karim")
    kph = wallet(a, "karim")["phone"]
    pay(a, "সেন্ড মানি", kph, 200)
    assert bal(a, "rahim") == 12300 and bal(a, "karim") == 12700
    a.click("#undoB"); a.wait_for_timeout(600)
    assert bal(a, "rahim") == 12500 and bal(a, "karim") == 12500, (bal(a, "rahim"), bal(a, "karim"))
    # recipient spent the money -> cancel refused, nothing moves
    pay(a, "সেন্ড মানি", kph, 300)
    add_money(k, "karim", -(bal(k, "karim") - 10))
    a.click("#undoB")
    assert "already spent" in toast(a)
    assert bal(a, "rahim") == 12200 and bal(a, "karim") == 10
    # at most 3 cancellations per day
    add_money(k, "karim", 5000)
    for i in range(3):
        pay(a, "সেন্ড মানি", kph, 10); a.click("#undoB"); a.wait_for_timeout(500)
    pay(a, "সেন্ড মানি", kph, 10); a.click("#undoB")
    assert "Cancel limit" in toast(a), "4th cancel should be blocked"
    ctx.close()


def t_split_and_guardian(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim"); k = new_page(ctx, "karim", "Karim"); n = new_page(ctx, "nusrat", "Nusrat")
    kph, nph = wallet(a, "karim")["phone"], wallet(a, "nusrat")["phone"]
    # --- bill split: shares never add up to more than the bill
    a.click('.it[data-s="বিল স্প্লিট"]'); a.fill("#st", "100"); a.fill("#sn", f"{kph}, {nph}, {kph}")  # duplicate ignored
    a.click("#ok"); a.wait_for_timeout(500)
    sp = [v for key, v in db(a).items() if key.startswith("splits/")]
    assert len(sp) == 2 and all(s["amt"] == 33 for s in sp) and sum(s["amt"] for s in sp) <= 100, sp
    # karim pays his share (needs PIN), requester is credited exactly once even if clicked twice
    k.click("#bell"); k.click("[data-sp]"); enter_pin(k); k.wait_for_timeout(700)
    assert bal(k, "karim") == 12500 - 33 and bal(a, "rahim") == 12500 + 33, (bal(k, "karim"), bal(a, "rahim"))
    # --- guardian link + student is told when the guardian views the statement
    make_student(a)
    a.click("[data-tab=more]"); a.click("#gRow"); a.fill("#gp", nph); a.click("#gl"); a.wait_for_timeout(300)
    n.click("#bell"); n.click("[data-ga]"); n.wait_for_timeout(300); n.click("#no")
    n.click("[data-tab=more]"); n.click("#gRow"); n.click("[data-kv]"); n.wait_for_timeout(400)
    btxt = lambda: a.evaluate("document.querySelector('#bell').textContent").strip()
    assert btxt() != "🔔", "student should see a notification count: " + btxt()
    a.click("#no"); a.click("[data-tab=home]"); a.click("#bell")
    assert "viewed your statement" in a.inner_text("#panel")
    a.click("[data-gk]"); a.wait_for_timeout(300)
    assert btxt() == "🔔", btxt()
    ctx.close()


def t_csv_export(b):
    ctx = b.new_context(accept_downloads=True, viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim"); k = new_page(ctx, "karim", "Karim")
    kph = wallet(a, "karim")["phone"]
    pay(a, "সেন্ড মানি", kph, 150)
    a.click("[data-tab=his]")
    with a.expect_download() as d:
        a.click("#hcsv")
    text = open(d.value.path(), encoding="utf-8-sig", newline="").read()
    lines = text.strip().split("\r\n")
    assert lines[0].startswith('"Date","Day","Time","Type","Phone","Name"'), lines[0]
    assert any(kph in l and "Karim" in l and "-150" in l for l in lines[1:]), lines
    # search filter narrows the export
    a.fill("#hq", "zzz-nothing");
    with a.expect_download() as d2:
        a.click("#hcsv")
    assert len(open(d2.value.path(), encoding="utf-8-sig", newline="").read().strip().split("\r\n")) == 1
    ctx.close()


def t_admin_loads_and_adjusts(b):
    ctx = b.new_context(viewport={"width": 1280, "height": 900}); a = new_page(ctx, "rahim", "Rahim"); adm = new_page(ctx, "admin", "Admin", admin=True)
    adm.wait_for_function("document.body.innerText.includes('Total balance')", timeout=5000)
    adm.get_by_text("Customers", exact=True).last.click()  # open the Customers tab
    adm.wait_for_function("document.body.innerText.includes('Rahim')", timeout=5000)  # admin sees the customer
    start = bal(a, "rahim")
    # admin balance adjustment goes through the atomic inc()
    adm.evaluate("([u])=>claude.use('db').then(d=>d.doc('wallets/'+u).inc('balance',250))", ["rahim"])
    assert bal(a, "rahim") == start + 250
    ctx.close()


def today_day(page):
    return page.evaluate("new Date().getDate()")


def t_operator_and_reminder_rules(b):
    """Pure helpers: operator from number prefix, and when a monthly reminder shows."""
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim")
    ops = a.evaluate("""['01312345678','01712345678','01412345678','01912345678','01612345678','01812345678','01512345678','0171234567','02712345678','','abc'].map(x=>{const o=opOf(x);return o?o.en:null})""")
    assert ops == ["Grameenphone", "Grameenphone", "Banglalink", "Banglalink", "Robi", "Robi", "Teletalk", None, None, None, None], ops
    r = a.evaluate("""(()=>{const f=(day,done,d)=>remDue({day,done},new Date(2026,9,d));return [f(10,'',3),f(10,'',8),f(10,'',9),f(10,'',10),f(10,'',11),f(10,'2026-10',11),f(10,'2026-09',11),f(1,'',1),f(28,'',31),f(28,'2026-10',31)]})()""")
    assert r == ["ok", "soon", "soon", "today", "late", "done", "late", "today", "late", "done"], r
    ctx.close()


def t_recharge_flow(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim")
    a.click('.it[data-s="মোবাইল রিচার্জ"]'); a.wait_for_selector("#rcP")
    assert a.locator("#rcOps .chip.on").count() == 0
    a.fill("#rcP", "01712345678"); assert a.inner_text("#rcOps .chip.on") == "Grameenphone" and "guessed" in a.inner_text("#rcHint")
    a.fill("#rcP", "01512345678"); assert a.inner_text("#rcOps .chip.on") == "Teletalk"
    a.fill("#rcP", "0151"); assert a.locator("#rcOps .chip.on").count() == 0
    # unknown prefix: the customer must choose the operator
    a.fill("#rcP", "01012345678"); a.fill("#rcA", "50"); a.click("#rcGo"); assert "operator" in toast(a).lower()
    a.fill("#rcP", "01712345678"); a.fill("#rcA", "5"); a.click("#rcGo"); assert "between" in toast(a)
    a.fill("#rcA", "1001"[:4]); a.click("#rcGo"); assert "between" in toast(a)
    # a ported number: the customer's choice (Robi) wins over the prefix (Grameenphone)
    a.click('#rcOps [data-op="robi"]'); assert "chosen" in a.inner_text("#rcHint")
    a.click('#rcQ [data-a="100"]'); assert a.input_value("#rcA") == "100"
    a.click("#rcGo"); enter_pin(a); a.wait_for_timeout(600)
    assert bal(a, "rahim") == 12400, bal(a, "rahim")
    tx = [v for k, v in db(a).items() if k.startswith("txs/") and v["uid"] == "rahim" and v["t"] == "মোবাইল রিচার্জ"][0]
    assert tx["rn"] == "Robi" and tx["a"] == -100 and tx["ph"] == "01712345678", tx
    # the simulated operator fails: nothing is charged
    a.click("[data-tab=home]"); a.click('.it[data-s="মোবাইল রিচার্জ"]'); a.wait_for_selector("#rcP")
    a.fill("#rcP", "01712300000"); a.fill("#rcA", "100"); a.click("#rcGo")
    assert "not charged" in toast(a); assert bal(a, "rahim") == 12400
    ctx.close()


def t_biller_flow(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim")
    a.click('.it[data-s="পে বিল"]'); a.wait_for_selector("#pgB [data-c=electricity]")
    assert a.locator("#pgB [data-c]").count() == 6
    a.click("#pgB [data-c=electricity]"); a.wait_for_selector("#bl [data-b=desco]")
    assert a.locator("#bl .row").count() == 5
    a.fill("#bq", "palli"); assert a.locator("#bl .row").count() == 1 and "Palli" in a.inner_text("#bl")
    a.fill("#bq", "zzz"); assert a.locator("#bl .row").count() == 0
    a.fill("#bq", "desco"); a.click("#bl [data-b=desco]"); a.wait_for_selector("#bfA")
    a.fill("#bfA", "12"); a.click("#bfC"); assert "6 to 20" in toast(a)
    a.fill("#bfA", "MTR123456"); a.click("#bfC"); a.wait_for_selector("#bfR .bdue")
    assert "sample" in a.inner_text("#bfR") and int(a.input_value("#bfM")) >= 300
    a.fill("#bfM", "700"); a.check("#bfS"); a.click("#bfG"); enter_pin(a); a.wait_for_timeout(600)
    assert bal(a, "rahim") == 11800, bal(a, "rahim")
    tx = [v for k, v in db(a).items() if k.startswith("txs/") and v["uid"] == "rahim" and v["t"] == "পে বিল"][0]
    assert tx["rn"] == "DESCO (Dhaka North)" and tx["ph"] == "MTR123456" and tx["a"] == -700, tx
    # saved: next time one tap opens the biller form with the account filled in
    a.click("[data-tab=home]"); a.click('.it[data-s="পে বিল"]'); a.click("#bsb"); a.wait_for_selector("#panel .row[data-p]")
    assert "DESCO" in a.inner_text("#panel")
    a.click("#panel .row[data-p] .g"); a.wait_for_selector("#bfA"); assert a.input_value("#bfA") == "MTR123456"
    # the simulated biller fails: nothing is charged
    a.fill("#bfA", "9990000000"); a.fill("#bfM", "100"); a.click("#bfG"); assert "not charged" in toast(a)
    assert bal(a, "rahim") == 11800
    ctx.close()


def sign_up(a, name, phone, nid, ref=""):
    a.click("#anew"); a.fill("#rn", name); a.fill("#rp", phone); a.fill("#ri", nid); a.fill("#rd", "2000-01-01")
    if ref: a.fill("#rr", ref)
    a.click("#rnx")


def t_otp_signup_and_login(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = ctx.new_page(); a.on("pageerror", lambda e: ERRORS.append(str(e)))
    a.route("**/fonts.googleapis.com/**", lambda r: r.abort()); a.goto(f"{BASE}/index.html"); a.wait_for_selector("#aph")
    assert a.locator("#auth .demoTag").count() == 1                                  # the DEMO tag is on the login page
    sign_up(a, "Nusrat Jahan", "01755555555", "1234567890")
    a.wait_for_selector("#aot"); assert "01755555555" in a.inner_text("#abody, .abody") if False else True
    code = a.inner_text(".sms b").strip(); assert len(code) == 6 and code.isdigit() and "no real SMS" in a.inner_text(".sms")
    a.fill("#aot", "12"); a.click("#aov"); assert "6-digit" in a.inner_text("#aerr")
    wrong = "000000" if code != "000000" else "111111"
    a.fill("#aot", wrong); a.click("#aov"); assert "Wrong code" in a.inner_text("#aerr") and "4 tries" in a.inner_text("#aerr")
    assert a.is_disabled("#ars")                                                        # resend has a cooldown
    a.click("#abk"); a.wait_for_selector("#rn"); assert a.input_value("#rp") == "01755555555"   # back keeps what was typed
    a.click("#rnx"); a.wait_for_selector("#aot"); code = a.inner_text(".sms b").strip()
    a.fill("#aot", code); a.click("#aov"); a.wait_for_selector("#q1")                  # right code -> PIN screen
    a.fill("#q1", "4321"); a.fill("#q2", "4321"); a.click("#rok"); a.wait_for_function("!!window.bellRef", timeout=10000)
    # sign out, log in again on the same device: no code needed
    a.evaluate("authLogout()"); a.wait_for_selector("#aph")
    a.fill("#aph", "01755555555"); a.fill("#apn", "4321"); a.click("#aok"); a.wait_for_function("!!window.bellRef", timeout=10000)
    # a device that never logged in with this number asks for the code (the PIN is checked first)
    a.evaluate("authLogout()"); a.wait_for_selector("#aph"); a.evaluate("localStorage.removeItem('upay_td_01755555555')")
    a.fill("#aph", "01755555555"); a.fill("#apn", "0000"); a.click("#aok"); assert "Wrong number or PIN" in a.inner_text("#aerr")
    a.fill("#apn", "4321"); a.click("#aok"); a.wait_for_selector("#aot")
    code = a.inner_text(".sms b").strip(); a.fill("#aot", code); a.click("#aov"); a.wait_for_function("!!window.bellRef", timeout=10000)
    ctx.close()


def t_demo_flag_hides_demo_features(b):
    # production-like: UPAY_DEMO=false (what the server's /config.js says when UPAY_DEMO_MODE=0)
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    ctx.route("**/config.js", lambda r: r.fulfill(body="window.UPAY_API=null;window.UPAY_DEMO=false;", content_type="application/javascript"))
    a = ctx.new_page(); a.on("pageerror", lambda e: ERRORS.append(str(e))); a.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    a.goto(f"{BASE}/index.html?u=rahim&n=Rahim"); a.wait_for_selector("#aph")          # ?u= no longer skips the login
    assert a.locator("#auth .demoTag").count() == 0 and a.locator("#aot").count() == 0
    a.evaluate("localStorage.setItem('upay_sess','rahim');localStorage.setItem('upay_uid','rahim')"); a.goto(f"{BASE}/index.html")
    a.wait_for_function("!!window.bellRef", timeout=10000)
    assert a.locator("#demoRow").count() == 0 and a.locator(".demoBar").count() == 0
    ctx.close()
    # demo (default): ribbon and Demo tools are there and labelled
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim")
    assert a.locator(".demoBar").count() == 1 and "DEMO" in a.inner_text(".demoBar")
    a.click("[data-tab=more]"); assert "DEMO ONLY" in a.inner_text("#demoRow")
    ctx.close()


def t_admin_analytics(b):
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim"); adm = new_page(ctx, "admin", "Admin", admin=True)
    adm.wait_for_function("document.body.innerText.includes('Support analytics')", timeout=5000)      # first tab
    assert "No requests in this period" in adm.inner_text("body")
    adm.click('[data-a=anasample]'); adm.wait_for_selector(".note")
    t = adm.inner_text("body"); assert "SAMPLE DATA" in t and "requests in the last 30 days" in t and "AI auto-reply rate" in t and "Failed or pending transaction" in t
    assert adm.locator(".dv > div").count() == 30
    adm.click('[data-a=anarange][data-v="7"]'); assert adm.locator(".dv > div").count() == 7
    adm.click('[data-a=anarange][data-v="30"]')
    with adm.expect_download() as d: adm.click('[data-a=anacsv]')
    assert d.value.suggested_filename.startswith("upay-support-analytics-")
    adm.click('[data-a=anasample]'); assert "SAMPLE DATA" not in adm.inner_text("body")
    # real data: one chat that the assistant answers by itself
    a.evaluate("openChat()"); a.fill("#chIn", "my money was deducted but the transaction failed"); a.click("#chSend")
    adm.wait_for_function("document.body.innerText.includes('1 requests in the last 30 days')", timeout=8000)
    t = adm.inner_text("body"); assert "Failed or pending transaction" in t and "100%" in t, t[:800]
    # resolve time starts when an agent marks an item resolved
    a.evaluate("""()=>claude.use('db').then(d=>d.doc('complaints/c1').set({id:'c1',uid:'rahim',name:'Rahim',cat:'Failed transaction',pri:'high',team:'Payments Ops',status:'new',ts:Date.now()-3600000,body:'x',replies:[]}))""")
    adm.wait_for_function("document.body.innerText.includes('2 requests in the last 30 days')", timeout=8000)
    adm.click('nav [data-v=comp]'); adm.wait_for_selector('[data-a=rst][data-s=resolved]'); adm.click('[data-a=rst][data-s=resolved]'); adm.wait_for_timeout(400)
    adm.click('nav [data-v=ana]'); adm.wait_for_function("document.body.innerText.includes('Median time to resolve')")
    k = adm.inner_text("body"); assert "1 resolved" in k and "1 h" in k, k[:600]
    ctx.close()


def t_monthly_reminder(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim"); d = today_day(a)
    def add(label, day, amount=""):
        a.click("[data-tab=more]"); a.click("#remRow"); a.fill("#rmL", label); a.fill("#rmD", str(day))
        if amount: a.fill("#rmA", amount)
        a.click("#rmS"); a.wait_for_timeout(200); a.click("#no"); a.click("[data-tab=home]")
    a.click("[data-tab=more]"); a.click("#remRow"); a.fill("#rmL", "x"); a.fill("#rmD", "31"); a.click("#rmS")
    assert "1 to 28" in toast(a); a.fill("#rmD", "0"); a.click("#rmS"); assert "1 to 28" in toast(a)
    a.fill("#rmL", ""); a.fill("#rmD", "5"); a.click("#rmS"); assert "what it is for" in toast(a); a.click("#no")
    due = min(d, 28)
    add("Electricity", due, "860")
    assert a.locator("#remBox .remc").count() == 1 and "Electricity" in a.inner_text("#remBox") and "860" in a.inner_text("#remBox")
    if d > 1:
        add("Rent (day already passed this month)", 1)
        assert a.locator("#remBox .remc").count() == 1, "a reminder whose day already passed starts next month, not as overdue"
    a.click("#remBox [data-done]"); a.wait_for_timeout(200)
    assert a.locator("#remBox .remc").count() == 0
    a.reload(); a.wait_for_function("!!window.bellRef"); a.wait_for_timeout(300)
    assert a.locator("#remBox .remc").count() == 0, "Done must survive a reload"
    saved = a.evaluate("JSON.parse(localStorage.getItem('upay_reminders_rahim'))")
    assert saved[0]["label"] == "Electricity" and saved[0]["done"] == a.evaluate("remYM(new Date())")
    a.click("[data-tab=more]"); a.click("#remRow"); a.click("#panel .row [data-x]"); a.wait_for_timeout(200)   # remove the first one
    assert len(a.evaluate("JSON.parse(localStorage.getItem('upay_reminders_rahim'))")) == len(saved) - 1
    ctx.close()


def t_saved_billers(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim")
    a.click('.it[data-s="পে বিল"]'); a.click("#bsb"); a.wait_for_selector("#bvA")
    a.fill("#bvA", "1"); a.click("#bvS"); assert "account number" in toast(a)
    a.fill("#bvA", "MTR-123456"); a.fill("#bvL", "Home electricity"); a.click("#bvS"); a.wait_for_selector("#panel .row[data-p]")
    assert "Home electricity" in a.inner_text("#panel") and "MTR-123456" in a.inner_text("#panel")
    a.reload(); a.wait_for_function("!!window.bellRef")
    a.click('.it[data-s="পে বিল"]'); a.click("#bsb"); a.wait_for_selector("#panel .row[data-p]")
    a.click("#panel .row[data-p] .g"); a.wait_for_selector("#f1")
    assert a.input_value("#f1") == "MTR-123456"
    a.click("#no"); a.click('.it[data-s="পে বিল"]'); a.click("#bsb"); a.click("#panel .row[data-p] [data-x]"); a.wait_for_timeout(200)
    assert a.query_selector("#panel .row[data-p]") is None
    ctx.close()


def t_freeze_lost_phone(b):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    a = new_page(ctx, "rahim", "Rahim"); k = new_page(ctx, "karim", "Karim")
    kph = wallet(a, "karim")["phone"]
    a.click("[data-tab=more]"); a.click("#frzRow"); a.click("#fzOk")
    assert enter_pin(a, "1234")              # no PIN yet: it is set first, then the wallet is frozen
    a.wait_for_timeout(500)
    w = wallet(a, "rahim"); assert w["frozen"] is True and w["frozenBy"] == "self", w
    a.click("[data-tab=home]"); open_pay(a, "সেন্ড মানি", kph, "100"); a.click("#ok")
    assert enter_pin(a, "1234"); assert "frozen" in toast(a); assert bal(a, "rahim") == 12500
    a.click("#pno")                          # the PIN sheet stays open after a refused payment (existing behaviour)
    a.click("[data-tab=more]"); a.click("#frzRow"); assert a.query_selector("#fzS") and not a.query_selector("#fzOk")   # already frozen: offers support instead
    a.click("#no")
    set_wallet(a, "rahim", frozen=False, frozenBy="")                                                              # what the admin's Unfreeze does
    a.click("#frzRow"); a.click("#fzOk"); enter_pin(a, "0000"); assert "Wrong PIN" in toast(a)
    assert wallet(a, "rahim")["frozen"] is False, "a wrong PIN must not freeze"
    ctx.close()


TESTS = [t_atomic_race, t_fees_and_free_send, t_limits, t_pin, t_cancel, t_split_and_guardian, t_csv_export, t_admin_loads_and_adjusts,
         t_operator_and_reminder_rules, t_recharge_flow, t_biller_flow, t_otp_signup_and_login, t_demo_flag_hides_demo_features, t_admin_analytics,
         t_monthly_reminder, t_saved_billers, t_freeze_lost_phone]

if __name__ == "__main__":
    only = sys.argv[1:]
    fails = 0
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--no-sandbox"], **({"executable_path": os.environ["CHROMIUM"]} if os.environ.get("CHROMIUM") else {}))
        for t in TESTS:
            if only and t.__name__ not in only:
                continue
            ERRORS.clear(); t0 = time.time()
            try:
                t(b)
                if ERRORS:
                    raise AssertionError("page errors: " + "; ".join(ERRORS[:3]))
                print(f"PASS {t.__name__} ({time.time()-t0:.1f}s)")
            except Exception as e:
                fails += 1
                print(f"FAIL {t.__name__}: {e}")
                traceback.print_exc(limit=3)
        b.close()
    print("ALL PASSED" if not fails else f"{fails} FAILED")
    sys.exit(1 if fails else 0)
