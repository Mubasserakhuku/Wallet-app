"""
Browser test against the REAL backend: settings must follow the customer to a new phone (a fresh browser with empty storage).
Needs the backend running on :8000 (see backend/README.md; UPAY_DEMO_MODE=1 because it signs in with ?u=).
Run:  python3 tests/test_backend_ui.py
"""
import base64, random, struct, sys, zlib
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8000"
VP = {"width": 412, "height": 860}
ERRORS = []


def png(w=64, h=64):
    raw = b"".join(b"\x00" + bytes([(x * 4) % 256, (y * 4) % 256, 120]) * 1 * 1 for y in range(h) for x in range(w) for _ in [0])
    raw = b"".join(b"\x00" + b"".join(bytes([(x * 4) % 256, (y * 4) % 256, 120]) for x in range(w)) for y in range(h))
    ch = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + ch(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + ch(b"IDAT", zlib.compress(raw)) + ch(b"IEND", b"")


def open_app(b, uid, name):
    ctx = b.new_context(viewport=VP); ctx.add_init_script("localStorage.setItem('upay_lang','en')")
    p = ctx.new_page()
    p.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    p.on("pageerror", lambda e: ERRORS.append(str(e)))
    p.on("console", lambda m: ERRORS.append(m.text) if m.type == "error" and "ERR_" not in m.text and "404" not in m.text else None)
    p.goto(f"{BASE}/index.html?u={uid}&n={name}")
    p.wait_for_function("document.querySelector('#uname').textContent.includes('%s') && !!window.bellRef" % name)
    return ctx, p


def enter_pin(p, pin="1234"):
    p.wait_for_selector("#pn1", timeout=3000); p.fill("#pn1", pin)
    if p.query_selector("#pn2"): p.fill("#pn2", pin)
    p.click("#pok")


def main(b):
    uid = "ui" + str(random.randint(10**5, 10**6)); name = "Tania"
    c1, a = open_app(b, uid, name)
    # favourite
    a.click('.it[data-s="সেন্ড মানি"]'); a.fill("#sq", "01711112222"); a.click("#sl .crow"); a.click("#sfav"); a.wait_for_timeout(600)
    a.click("#pgBack")
    # profile photo
    a.click("[data-tab=more]"); a.click("#penBtn"); a.set_input_files("#phF", {"name": "me.png", "mimeType": "image/png", "buffer": png()})
    a.wait_for_function("document.querySelector('#pav').classList.contains('ph')"); a.wait_for_timeout(600)
    # saved biller + reminder
    a.click("[data-tab=home]"); a.click('.it[data-s="পে বিল"]'); a.click("#bsb"); a.fill("#bvA", "MTR-5555"); a.fill("#bvL", "Home electricity"); a.click("#bvS")
    a.wait_for_selector("#panel .row[data-p]"); a.wait_for_timeout(500); a.click("#no"); a.click("#pgBack")
    d = min(a.evaluate("new Date().getDate()"), 28)
    a.click("[data-tab=more]"); a.click("#remRow"); a.fill("#rmL", "Electricity"); a.fill("#rmD", str(d)); a.fill("#rmA", "860"); a.click("#rmS"); a.wait_for_timeout(600); a.click("#no")
    c1.close()

    # a NEW phone: empty browser storage, same account
    c2, n = open_app(b, uid, name)
    n.wait_for_function("document.querySelector('#pav').classList.contains('ph')", timeout=8000)
    n.wait_for_selector("#remBox .remc", timeout=8000)
    assert "Electricity" in n.inner_text("#remBox")
    n.click('.it[data-s="সেন্ড মানি"]'); n.wait_for_selector("#sfs .fav")
    assert "01711112222" in n.inner_text("#sfs"), n.inner_text("#sfs")
    n.click("#pgBack"); n.click('.it[data-s="পে বিল"]'); n.click("#bsb"); n.wait_for_selector("#panel .row[data-p]")
    assert "MTR-5555" in n.inner_text("#panel") and "Home electricity" in n.inner_text("#panel")
    # removing on the new phone also removes it on the server
    n.click("#panel .row[data-p] [data-x]"); n.wait_for_timeout(600)
    server = n.evaluate("API.get('/api/prefs')")
    assert server["billers"] == [] and len(server["favs"]) == 1 and len(server["reminders"]) == 1, server
    assert n.evaluate("API.get('/api/prefs/photo')")["value"].startswith("data:image/jpeg;base64,")
    n.click("#no"); n.click("#pgBack")

    # lost phone: freeze from the app, server enforces it
    n.click("[data-tab=more]"); n.click("#frzRow"); n.click("#fzOk"); enter_pin(n)
    n.wait_for_timeout(800)
    me = n.evaluate("API.get('/api/me')")
    assert me["frozen"] is True and me["frozen_by"] == "self", me
    n.click("#frzRow"); assert n.query_selector("#fzS") and not n.query_selector("#fzOk")
    c2.close()


if __name__ == "__main__":
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=["--no-sandbox"])
        try:
            main(b)
            if ERRORS: raise AssertionError("page errors: " + "; ".join(ERRORS[:3]))
            print("PASS backend settings follow the customer + freeze")
        except Exception as e:
            import traceback; traceback.print_exc(); print("FAIL:", e); sys.exit(1)
        finally:
            b.close()
