"""
upay Support Suite - browser tests (Python Playwright).
Run:  python3 -m http.server 8765 --directory ../upay-support-suite &   then   python3 test_upay.py
Every test uses a fresh browser context (= fresh localStorage), so tests do not affect each other.
"""
import json, sys, time, traceback
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765"
VP = {"width": 412, "height": 860}  # phone-sized, the app is a mobile layout
ERRORS = []


def new_page(ctx, uid, name, admin=False):
    p = ctx.new_page()
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


def pay(page, svc, phone, amt, pin="1234"):
    page.click("[data-tab=home]")
    page.click(f'.it[data-s="{svc}"]')
    page.fill("#f1", phone)
    page.fill("#f2", str(amt))
    page.click("#ok")
    if svc == "সেন্ড মানি":
        page.click("#ok")  # second step: confirm recipient
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
    a.click("[data-tab=home]"); a.click('.it[data-s="সেন্ড মানি"]'); a.fill("#f1", kph); a.fill("#f2", "500"); a.click("#ok")
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
    a.click('.it[data-s="সেন্ড মানি"]'); a.fill("#f1", "01999999999"); a.fill("#f2", "100"); a.click("#ok")
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
    a.click('.it[data-s="সেন্ড মানি"]'); a.fill("#f1", kph); a.fill("#f2", "100"); a.click("#ok"); a.click("#ok")
    a.wait_for_selector("#pn2"); a.fill("#pn1", "1234"); a.fill("#pn2", "9999"); a.click("#pok")
    assert "do not match" in toast(a)
    assert bal(a, "rahim") == 12500
    a.fill("#pn2", "1234"); a.click("#pok"); a.wait_for_timeout(500)
    assert bal(a, "rahim") == 12400
    assert wallet(a, "rahim")["pinH"] and "1234" not in json.dumps(wallet(a, "rahim")), "PIN must be stored hashed"
    # wrong pin x3 -> locked; money never moves
    for i in range(3):
        a.click('.it[data-s="সেন্ড মানি"]'); a.fill("#f1", kph); a.fill("#f2", "100"); a.click("#ok"); a.click("#ok")
        enter_pin(a, "0000")
        if i < 2:
            assert "Wrong PIN" in toast(a)
            a.click("#pno")
    a.wait_for_timeout(300)
    assert bal(a, "rahim") == 12400
    a.click('.it[data-s="সেন্ড মানি"]'); a.fill("#f1", kph); a.fill("#f2", "100"); a.click("#ok"); a.click("#ok")
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


TESTS = [t_atomic_race, t_fees_and_free_send, t_limits, t_pin, t_cancel, t_split_and_guardian, t_csv_export, t_admin_loads_and_adjusts]

if __name__ == "__main__":
    only = sys.argv[1:]
    fails = 0
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])
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
