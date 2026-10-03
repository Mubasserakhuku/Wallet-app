# upay Support Suite

A complete digital-wallet demo in the style of Bangladeshi mobile financial services (bKash / Nagad / upay), built with plain HTML, CSS and JavaScript on the front end and FastAPI + PostgreSQL on the back end.

It has two sides:

- **Customer app**: a mobile-first wallet (Bangla and English) with student accounts, pockets, safety features and built-in customer support.
- **Admin console**: a support and operations dashboard with live chat, AI-assisted replies, complaints, student approvals, customers and transactions.

> **All data is synthetic. This is a demo wallet ledger, not a licensed payment system.** See [Limitations](#limitations-and-what-is-not-built).

---

## 1. Live demo

| Side | Link |
|---|---|
| Customer app (open this on a phone) | https://upayupdate.up.railway.app |
| Admin console | https://upayupdate.up.railway.app/admin.html |

- The **customer app** is open to everyone. Tap **Create a new account** and sign up with any 11-digit number starting with `01`, any 10/13/17-digit number as NID, a birth date and a 4-digit PIN. New accounts start with ৳0; use **Add Money** (demo) to get balance.
- The **admin console** asks for an admin key. The key is private. Ask the project owner for it.
- The live demo runs on a free hosting trial. If the link is down, the trial has ended. In that case run it on your own PC (see [section 6](#6-run-it-on-your-own-pc)).

### Quick way to see everything work together
1. Open the customer link in one browser (or phone) and create account A.
2. Open it again in another browser (or private window) and create account B.
3. From A, **Send Money** to B's number. B's name appears before you confirm.
4. In A: **More > Customer Service** and send a chat message.
5. Open `/admin.html`, enter the admin key, and open **Live chat**. The message is there. Reply from the admin side and it shows up in the customer chat.

---

## 2. Features

### Customer app

**Wallet basics**
- Home grid: Send Money, Cash Out, Add Money, Mobile Recharge, Pay Bill, Bill Split and more.
- Language switch: **Bangla (default) or English**. The whole app changes (More > Language).
- Dark mode, three text sizes, installable as an app (PWA).
- Account types (More > Account Type): **Personal, Islamic, Student**.
- More tab follows the layout of the Nagad "আমার নগদ" page. Links to the upay Facebook page and website.

**Login and sign-up**
- Log in with **mobile number + 4-digit PIN**. Built-in on-screen keypad (digits, backspace, confirm) works on both the number and the PIN box.
- Sign-up asks name, mobile number, NID (10, 13 or 17 digits), birth date and PIN (typed twice). Only a hash of the NID is stored, plus its last 4 digits.
- Sign out from More. The session is remembered until you sign out.
- 3 wrong PINs lock login for 60 seconds.

**Student account**
- Student accounts need **admin approval**. The customer fills a form (edu email, university name, student ID number, ID card photo, selfie with ID). The request goes to the admin, who approves or rejects (a note is required to reject). The customer sees the result in the app.
- Perks: **20% off the cash-out fee** and **Send Money is free**.
- **Student Plan** (verified students only):
  - **Money buckets (pockets)**: split money by category, for example University, Food, Recharge, Home, Tuition. Pay from a bucket.
  - **Auto transfer**: save an account number, set a date and time (and optionally repeat monthly), and the money is sent automatically. On the live version a server scheduler sends it even when the app is closed.
- **Guardian Link**: a student adds a guardian's number; the guardian approves from the notification bell, then can send money into the student's bucket and view the last 15 transactions. The student is notified whenever the guardian opens the statement and can remove the link at any time.

**Sending money safely**
- **Receiver name shown before sending**. A warning appears if the number is not found (wrong-number protection).
- **2-minute Cancel** after sending, which returns the money if the receiver has not spent it. At most 3 cancellations per 24 hours.
- **PIN for every outgoing payment**. First payment asks you to set a PIN. 3 wrong tries lock PIN entry for 60 seconds. Change PIN in More.
- **Limits**: daily ৳50,000 and monthly ৳200,000 on all outgoing payments. See usage in Account > Transaction Limit.
- **Lost your phone? Freeze**: from More (or from another phone after login) the customer enters the PIN and the wallet is frozen. Only an admin can unfreeze.
- Rotating safety tips on the home screen.

**Statement and history**
- Every row shows **day, date, time, phone number, receiver name (auto-filled from saved accounts), transaction ID and balance after the transaction**.
- Search by phone, name or transaction ID. Filter All / Income / Expense.
- **This-month summary by category.**
- **Export CSV** (opens correctly in Excel with Bangla text) and **PDF / Print**.
- **Picture receipt** for each transaction with a Share button.

**Convenience**
- **Bill Split**: enter the total and your friends' numbers; each friend gets a request in the bell and can Pay or decline. Each pays `floor(total / (friends + 1))`, so requests never exceed the bill.
- **Favourites**: star a recipient, they appear as chips on the Send Money page.
- **Saved billers**: save your own bill account (electricity, gas, etc.) and reuse it.
- **Monthly reminders**: name, day of month, optional amount, optional biller. Shown on Home from 2 days before.
- **Recharge operator hint** from the number prefix (013/017 Grameenphone, 014/019 Banglalink, 016/018 Robi, 015 Teletalk).
- **Refer a friend**: code `UP` + your number.
- First-time tour, profile photo.

**Customer service (inside the app)**
- **Live chat** with a support assistant that suggests answers and hands over to a human agent.
- **Email** and **Complaint** forms with **photo and voice recording** attachments.
- FAQ and privacy policy pages.

### Admin console (`/admin.html`)
- **Live chat inbox** with AI analysis (intent detection, personal data redaction, FAQ match, suggested replies).
- **Emails** and **Complaints**, with photo viewing and voice playback.
- **Student accounts**: review applications, approve or reject with a note, and edit the **application rules** (guidelines in English and Bangla, accepted email domains, and which items are required).
- **Customers**: view wallets, freeze or unfreeze (shows "Frozen (by customer)" when the customer froze it), delete wallets.
- **Transactions**: view all, adjust balances, reverse transactions.
- **FAQ, policies and announcements** editors.
- Always in English.

---

## 3. How it works

```
 Customer phone / browser                        Admin browser
  index.html + customer.js                        admin.html + admin.js
          \                                           /
           \------------  REST API (JSON)  -----------/
                          FastAPI (backend/app)
                                |
                          PostgreSQL
              wallets, ledger, buckets, rules, splits,
              guardian links, prefs, docs (chat/email/complaint)
```

- **Front end**: plain HTML, CSS and JavaScript. No build step, no framework. `api.js` talks to the server; `db.js` is the browser-storage fallback.
- **Back end**: FastAPI serves the REST API under `/api` **and** the front-end folder at `/`, so one URL serves everything.
- **Two modes**, controlled by `upay-support-suite/config.js`:
  - `window.UPAY_API = null` is **demo mode**. Everything is stored in the browser (localStorage). No server needed. Data is private to each browser.
  - `window.UPAY_API = ""` is **backend mode**. The same-origin server decides everything. When the backend serves the page it supplies its own `/config.js`, so this is automatic.
- **In backend mode the server is the authority** for balances, fees, limits, PIN checks, student status and the 2-minute cancel. A user cannot change a balance or approve a student from the browser. Only the admin API can.

### How money is kept safe (backend)
- Every payment is one database transaction. Wallet rows are locked with `SELECT ... FOR UPDATE` in sorted id order (no deadlocks), and `CHECK (balance >= 0)` is the last safety net.
- `Idempotency-Key` header: a retried request (double tap, bad network) is applied only once.
- PIN stored with **PBKDF2-SHA256** (200k rounds, salted).
- The **ledger is append-only**. A reversal is a new row, never an edit.
- Money columns are `NUMERIC(14,2)`.
- Daily and monthly limits use **Asia/Dhaka** day boundaries.
- Fees: cash out **1.85%** (verified students pay 20% less), Send Money **free**.
- Auto-transfer rules run from a **server scheduler** (default every 15 seconds).

---

## 4. Project structure

```
.
├── upay-support-suite/      Front end (served as static files)
│   ├── index.html           Customer app
│   ├── admin.html           Admin console
│   ├── style.css            All styles (includes print layout for statements)
│   ├── core.js              Helpers, Bangla/English dictionary, student defaults
│   ├── ai.js                Support assistant (intent, redaction, FAQ match)
│   ├── config.js            Demo mode or backend mode switch
│   ├── db.js                Browser storage (demo mode), atomic inc()
│   ├── api.js               REST client (backend mode)
│   ├── auth.js              Login, sign-up and the on-screen keypad
│   ├── customer.js          Wallet app logic
│   ├── admin.js             Admin console logic
│   ├── extras.js            Tour, text size, PWA, favourites, receipts, referral
│   ├── app.js               Boot (picks admin or customer)
│   ├── manifest.json, sw.js, icon-192.png, icon-512.png   PWA files
│   └── README.md            Front-end notes
├── backend/
│   ├── app/                 main.py (API), ledger.py (money logic), auth.py,
│   │                        prefs.py, docs.py, db.py, config.py
│   ├── schema.sql           Database schema (applied automatically at start)
│   ├── tests/               Backend and API tests (pytest)
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example         Copy to .env and edit
│   └── README.md            Backend notes
├── tests/                   Browser tests (Playwright)
└── docker-compose.yml       App + PostgreSQL in one command
```

---

## 5. Settings (environment variables)

| Name | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `UPAY_SECRET_KEY` | Signs login tokens and keys the NID hash. Use a long random string |
| `UPAY_ADMIN_KEY` | The admin console asks for this. Sent as the `X-Admin-Key` header |
| `UPAY_DEMO_MODE` | `1` enables demo login, Add Money and Demo tools. **Must be `0` in production** |
| `UPAY_SCHEDULER_INTERVAL_S` | How often auto-transfer rules are checked (default 15) |
| `UPAY_CORS_ORIGINS` | Comma-separated origins if the front end is hosted on a different domain |
| `UPAY_STATIC_DIR` | Front-end folder to serve |
| `POSTGRES_PASSWORD` | Only used by `docker-compose.yml` |

Never commit real secrets. Use your own `UPAY_SECRET_KEY` and `UPAY_ADMIN_KEY`.

---

## 6. Run it on your own PC

Pick the option that fits you. **Option A needs nothing installed except Python or a browser.**

### Option A: Demo mode, no server, no database (easiest)
Everything is stored in your browser. Good for a quick look.

1. Download or clone the project.
2. Open a terminal inside the project folder and run:
   ```bash
   cd upay-support-suite
   python3 -m http.server 8000
   ```
   (On Windows you may need `python -m http.server 8000`.)
3. Open in your browser:
   - Customer app: http://localhost:8000/index.html
   - Admin console: http://localhost:8000/admin.html

Notes:
- Chrome can also open `index.html` by double-clicking. Firefox needs the small server above.
- Voice recording needs microphone permission and works on `localhost` or `https`.
- Keep `config.js` as `window.UPAY_API=null`.
- In demo mode the data syncs only between tabs of the **same browser**. Admin and customer can see each other on the same PC in the same browser.
- To try several customers: `index.html?u=rahim&n=Rahim`, `?u=karim`, `?u=abbu`, `?u=nusrat`. Each `?u=` is a separate wallet and skips the login. **More > Demo tools** opens these for you, can make you a verified student and clear your PIN.

### Option B: Full version with Docker (recommended)
This runs the real FastAPI backend with PostgreSQL, same as the live demo.

Requirement: Docker Desktop.

```bash
cp backend/.env.example backend/.env      # then edit the secrets inside
docker compose up --build
```

Open:
- Customer app: http://localhost:8000
- Admin console: http://localhost:8000/admin.html (key = `UPAY_ADMIN_KEY` from `backend/.env`)

Windows PowerShell: use `copy backend\.env.example backend\.env`.

### Option C: Full version without Docker
Requirements: Python 3.12 and PostgreSQL.

```bash
createdb upay
cd backend
pip install -r requirements.txt

export DATABASE_URL=postgresql://user:pass@localhost:5432/upay
export UPAY_SECRET_KEY=change-me-long-random-string
export UPAY_ADMIN_KEY=my-admin-key
export UPAY_DEMO_MODE=1
export UPAY_STATIC_DIR=../upay-support-suite

uvicorn app.main:app_factory --factory --port 8000
```

On Windows PowerShell replace `export NAME=value` with `$env:NAME="value"`. The database schema (`schema.sql`) is applied automatically at start.

Then open http://localhost:8000 and http://localhost:8000/admin.html.

### Run the tests
```bash
# Front-end tests (needs Python Playwright + Chromium)
python3 -m http.server 8765 --directory upay-support-suite &
python3 tests/test_upay.py                 # all, or name one: python3 tests/test_upay.py t_pin

# Backend tests (needs a Postgres)
cd backend && pytest

# Browser tests against the running backend
python3 tests/test_backend_ui.py           # backend running on :8000
```
The tests cover concurrent balance updates, fees (normal and student), free send, receiver name and wrong-number warning, limits, PIN set/wrong/lock, cancel rules, bill split, guardian notification, CSV export, favourites/photo/reminders/billers restore on a fresh browser, and lost-phone freeze.

---

## 7. Put it online (deploy)

The project is a single Docker image (`backend/Dockerfile`) that serves both the API and the web pages, plus a PostgreSQL database. Any host that runs Docker works.

The live demo was deployed on **Railway** like this:

1. Push the project to a GitHub repository.
2. On railway.com: **New Project > Deploy from GitHub repo**.
3. Add a database: **+ Create > Database > PostgreSQL**.
4. On the app service, **Variables > Raw Editor**:
   ```
   RAILWAY_DOCKERFILE_PATH=backend/Dockerfile
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   UPAY_SECRET_KEY=<a long random string>
   UPAY_ADMIN_KEY=<your own admin password>
   UPAY_DEMO_MODE=1
   PORT=8000
   ```
5. If the repo has the project inside a sub-folder, set **Settings > Source > Root Directory** to that folder.
6. **Settings > Networking > Generate Domain** (port `8000`). You can rename the domain with the pencil icon.

Other options: Render (a `render.yaml` blueprint is included), Koyeb, Fly.io, or any VPS with `docker compose up --build`.

Static-only option: uploading the `upay-support-suite` folder to Netlify, Cloudflare Pages or GitHub Pages gives a link in minutes, but it runs in demo mode (each visitor's data stays in their own browser, admin and customer are not connected).

---

## 8. Main API endpoints

Customer endpoints need a login token. Admin endpoints need the `X-Admin-Key` header.

| Area | Endpoints |
|---|---|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/demo` (demo only), `GET /api/me` |
| PIN and safety | `POST /api/pin`, `POST /api/freeze` |
| Settings | `GET/PUT /api/prefs/{key}` (`favs`, `billers`, `reminders`, `photo`), `POST /api/account-type` |
| Payments | `GET /api/lookup/{phone}`, `POST /api/pay`, `POST /api/undo/{tx_id}`, `GET /api/history` |
| Student plan | `POST/DELETE /api/buckets`, `POST/DELETE /api/rules` |
| Bill split | `POST/GET /api/splits`, `POST /api/splits/{id}/pay`, `POST /api/splits/{id}/decline` |
| Guardian | `/api/guardian/request`, `/students`, `/approve/{uid}`, `/send`, `/statement/{uid}`, `/seen-ack`, `DELETE /{uid}` |
| Support data | `/api/docs/{collection}` (chat, email, complaints, student applications) |
| Demo tools | `/api/demo/add-money`, `/make-student`, `/reset-pin` (only when `UPAY_DEMO_MODE=1`) |
| Admin | `/api/admin/wallets`, `/txs`, `/adjust`, `/freeze`, `/student`, `/docs/...`, `/run-rules` |

---

## 9. Limitations and what is not built

This is a demo. Before real customers it would need:

- **SMS OTP** to prove phone ownership (login is number + PIN only).
- **Real NID / eKYC verification** (only the format is checked).
- **Real payment rails** (bKash, bank, agent network), licensing, audit and AML rules.
- **Real mobile recharge and a biller directory** (the operator is only a hint from the number prefix; users save their own billers).
- **Referral bonus in backend mode** (it works in browser demo mode only; the bonus rule needs a decision).
- **Face or fingerprint login.**
- **Push notifications** (reminders show only while the app is open).
- Shared rate limiting (it is in memory, one process). Use Redis or a gateway when running several workers.
- HTTPS, backups, monitoring and secrets management (the hosting platform provides HTTPS; the rest is up to you).
- Set `UPAY_DEMO_MODE=0` and remove the **Demo tools** row from the app before any real use.
- In demo (browser) mode, approvals, PIN, limits and balances live in the browser and can be changed by a technical user. In backend mode the server enforces them.

---

## 10. Quick summary in Bangla

**এটা কী:** upay-এর মতো একটি ডিজিটাল ওয়ালেট ডেমো। একটি কাস্টমার অ্যাপ (বাংলা/ইংরেজি) এবং একটি অ্যাডমিন কনসোল আছে।

**কাস্টমার সাইডে যা আছে:** পিন দিয়ে লগইন ও সাইন-আপ, সেন্ড মানি (রিসিভারের নাম দেখে পাঠানো, ২ মিনিটের মধ্যে ক্যানসেল), দৈনিক ও মাসিক সীমা, স্টুডেন্ট অ্যাকাউন্ট (অ্যাডমিন অনুমোদন, ক্যাশ আউটে ২০% ছাড়, সেন্ড মানি ফ্রি), বাজেট পকেট ও অটো ট্রান্সফার, অভিভাবক লিংক, বিল স্প্লিট, বিস্তারিত স্টেটমেন্ট (CSV ও PDF), ফোন হারালে ফ্রিজ, এবং লাইভ চ্যাট/ইমেইল/অভিযোগ।

**অ্যাডমিন সাইডে যা আছে:** লাইভ চ্যাট (AI সাহায্যসহ), অভিযোগ (ছবি ও ভয়েসসহ), স্টুডেন্ট আবেদন অনুমোদন, কাস্টমার ফ্রিজ/আনফ্রিজ, লেনদেন দেখা, FAQ ও ঘোষণা।

**নিজের পিসিতে চালানোর সবচেয়ে সহজ উপায়:**
1. `upay-support-suite` ফোল্ডারে টার্মিনাল খুলুন।
2. `python3 -m http.server 8000` চালান।
3. ব্রাউজারে `http://localhost:8000/index.html` (কাস্টমার) এবং `http://localhost:8000/admin.html` (অ্যাডমিন) খুলুন।

**পুরো ভার্সন (ব্যাকএন্ডসহ):** Docker ইনস্টল করে `cp backend/.env.example backend/.env` দিন, তারপর `docker compose up --build` চালান। এরপর `http://localhost:8000` খুলুন।

**লাইভ ডেমো:** https://upayupdate.up.railway.app (অ্যাডমিন: `/admin.html`, অ্যাডমিন কী প্রজেক্ট মালিকের কাছে)।

---

All data in this project is synthetic. Reply texts are samples; replace them with upay-approved wording before real use.
