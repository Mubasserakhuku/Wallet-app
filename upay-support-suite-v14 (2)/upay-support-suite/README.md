# upay Support Suite (plain HTML + CSS + JS)

Files
- index.html  customer app (wallet + Customer Service: live chat, email, complaint with photo/voice)
- admin.html  admin console (live chat inbox with AI analysis, emails, complaints with photo/voice playback, customers, transactions, FAQ, policies, announcements)
- style.css   all styles (includes print layout for the statement)
- core.js     shared helpers, Bangla/English dictionary, student-account defaults
- ai.js       support assistant (intent, redaction, FAQ match)
- db.js       storage (localStorage + cross-tab sync + atomic inc). Replace makeDb() with a real API
- customer.js wallet app (payments, PIN, limits, student plan, guardian, split, support)
- admin.js    admin console
- app.js      boot only (picks admin or customer)
- ../tests/   browser tests (see Tests below)

Run
Best: serve the folder, then open both pages in two tabs.
    python3 -m http.server 8000
    http://localhost:8000/index.html   (customer)
    http://localhost:8000/admin.html   (admin)
Chrome can also open the files directly (double click). Firefox needs the local server.

Voice recording needs microphone permission (works on localhost or https).

More customers: index.html?u=rahim&n=Rahim  (each ?u= is a separate customer)

Data lives in the browser (localStorage) and syncs between tabs on the same browser.
To go multi-device, replace makeDb() in db.js with calls to a backend (FastAPI + PostgreSQL).
All data is synthetic. Reply texts are samples, replace them with upay-approved wording (KB in app.js).

Language
- More > Language switches the whole customer app between Bangla and English (saved in the browser, page reloads).
- The admin console is always English. Bangla texts stored by the app (complaint categories, system messages) are shown in English there.

Account types (More > Account Type)
- Personal: default.
- Islamic: customer can switch directly.
- Student: needs admin approval. The customer fills the form, a request appears in admin > Student accounts, admin approves or rejects (a note is required to reject), and the customer sees the result in the app.
- Admin > Student accounts > Application rules: edit the guidelines (English and Bangla), accepted email domains (default: edu, ac) and which items are required (edu email, university name, student ID number, ID card photo, selfie with ID).
- NOTE: this is a browser-only demo, so the approval is not enforced by a server. For production, check acct/studentOK on the backend.

Student benefits (demo rules, edit constants in app.js)
- Cash Out fee: base 1.85%, verified student accounts get 20% off the fee (feeOf). Send Money fee: 0.
- History: search by phone/name/transaction ID; each row shows day, date, time, phone, receiver name (from saved accounts) and transaction ID.
- More > Student Plan (verified students only): money buckets (set money aside per category, pay from a bucket) and auto transfer (saved account + date/time; sends automatically when money arrives).

Round 2 features
- Every wallet gets a demo phone number (More > profile). Send Money to another wallet's number credits that user and shows their real name.
- Wrong-number protection: Send Money shows recipient name (or a warning if not found) before sending, then a 2-minute Cancel banner that returns the money if the recipient has not spent it.
- Guardian Link (More): a student adds a guardian's number, guardian approves from the bell, then can send money into a student's bucket and view their last 15 transactions.
- Bill Split (home grid): enter total + friends' numbers; each gets a request (bell) to Pay or decline.
- Auto transfer can repeat monthly; History page has a This-month summary by category.
- Needs 2+ wallets (open the app with different ?u= users) to try guardian / split / send between users.

Round 3 (safety, limits, statement)
- Atomic money: every balance change uses db inc() (reads the latest stored value, checks, writes in one locked step), so two tabs/devices can no longer overwrite each other. It also refuses overdraft and debits on frozen wallets. Admin adjustments and reversals use it too. On a real backend this must be a database transaction.
- PIN: first payment asks you to set a 4-digit PIN; every outgoing payment, bill-split payment, guardian send and auto-transfer creation asks for it. 3 wrong tries lock PIN entry for 60 s. More > Change PIN works. Stored as a salted hash in the wallet (demo grade, verify on the server in production).
- Limits: daily 50,000 and monthly 200,000 are enforced on every outgoing payment (also auto-transfers). Account > Transaction Limit shows usage. Change LIM in customer.js.
- Cancel (wrong number): at most 3 cancellations per 24 h per wallet, and only if the recipient still has the money (checked atomically).
- Bill split: each friend pays floor(total / (friends+1)), the remainder stays with you, so requests never add up to more than the bill. Duplicate numbers are ignored. Paying twice is blocked.
- Guardian: when a guardian opens the student's statement the student gets a notification and can remove the link (Guardian Link > x).
- Statement: each row shows balance after the transaction. History has CSV export (what the filter/search shows, opens correctly in Excel with Bangla) and PDF / Print (browser print dialog > Save as PDF).
- Demo tools (More > Demo tools): open test users in new tabs (rahim, karim, abbu, nusrat), make yourself a verified student, clear your PIN. Remove this row before production.

Known limits (need a backend)
- Auto transfer only fires while the app is open (on open, when money arrives, and every 30 s). A server scheduler is needed for "sends even when the app is closed".
- Student approval, PIN, limits and balances all live in the browser, so a technical user can change them. Enforce all of them on the server.
- Bangla/English still works by matching Bangla text against the dictionary in core.js; a new Bangla string needs an entry there or it stays Bangla in English mode (strings built with L(bn,en) do not need one).

Tests
    python3 -m http.server 8765 --directory upay-support-suite &
    python3 tests/test_upay.py            # all, or name a test: python3 tests/test_upay.py t_pin
Needs Python Playwright + Chromium. Covers: concurrent balance updates, fees (normal and student 20% off), free send + receiver name + wrong-number warning, limits, PIN set/wrong/lock, cancel rules, bill split + guardian notification, CSV export, admin load.

Round 4 (real backend: FastAPI + PostgreSQL)
- config.js: `window.UPAY_API=null` = browser-storage demo (as before). `window.UPAY_API=""` = talk to the backend on the same origin (the backend serves this folder and its own /config.js, so just open http://localhost:8000/).
- In backend mode the SERVER decides fees, balance, limits, PIN, student status and the 2-minute cancel. The browser cannot change a balance or approve a student (only the admin API can).
- Auto transfer now runs from a server scheduler, so it sends even when the app is closed.
- Chat / email / complaints / student applications are stored in Postgres (docs table). Appended messages are merged, so a stale agent reply cannot erase a newer customer message.
- Admin console (admin.html) asks for the admin key (UPAY_ADMIN_KEY).
- Setup, API list, tests and production checklist: see ../backend/README.md.

Round 5 (login / sign-up)
- auth.js shows a login page first: mobile number + 4-digit PIN. "Create a new account" asks name, mobile number, NID (10/13/17 digits), birth date, then a 4-digit PIN (typed twice). The PIN is the same PIN used to approve payments.
- More > Sign out returns to the login page. The session is kept in this browser until you sign out.
- Demo mode (UPAY_API=null): accounts live in localStorage (3 wrong PINs lock login for 1 minute). New accounts start with ৳0 (use Add Money to try). NID is not kept, only its last 4 digits.
- Backend mode: POST /api/auth/register and /api/auth/login (see backend/README.md). index.html?u=rahim still skips the login (demo tools and tests).

Round 6 (friendlier app)
- extras.js: first-time tour (3 slides, skipped for ?u= users), rotating safety tips on Home, More > Text size (normal / large / extra large), More > Install as an app (PWA: manifest.json, sw.js, icons).
- Favourites: Send Money > star a recipient; starred people show as chips on top of the page (Round 7: stored on the server in backend mode, see below).
- Receipt: History > tap a transaction > picture receipt > Share (phone share sheet, or download on desktop).
- Refer a friend: code = UP + your number (More > Refer, or the home tile). Demo mode: sign up with the code and both wallets get 50. Backend mode: code is shown but no bonus yet (needs a backend rule).

Round 7 (settings that follow you, operator hint, reminders, saved billers, lost phone)
- Favourites, profile photo, reminders and saved billers: in backend mode they are stored on the server (table `prefs`), so a new phone or a cleared browser gets them back after login. The phone keeps a local copy so the app also opens offline. The first time a phone connects, whatever it already had is uploaded once; after that the server copy wins. Demo mode (UPAY_API=null) keeps them in the browser as before.
- Recharge: the number's prefix (013/017 Grameenphone, 014/019 Banglalink, 016/018 Robi, 015 Teletalk) shows the operator under the number box. It is only a hint: a ported number can belong to another operator, and nothing is sent to an operator because there is no recharge provider connected yet. Prefix table: `OPS` in core.js.
- Pay Bill > Saved billers: the customer saves their own bill account (type from the existing list + account/meter number + a name) and picks it next time. There is no built-in directory of billers.
- More > Monthly reminders: name + day of the month (1-28) + optional amount + optional saved biller. It appears on Home from 2 days before the day until the customer taps Done for that month. A reminder created after its day has passed starts next month. It is only visible when the app is open, there is no push notification.
- More > Lost your phone? Freeze: the customer enters the PIN and the wallet is frozen (no send, bill, cash out, split, auto transfer). It also works from another phone after logging in with number + PIN; the login page says so. Only an admin can unfreeze (Admin > Customers > Unfreeze), after checking who is asking. The admin list shows "Frozen (by customer)".
- Not built (needs a decision or an outside service): referral bonus in backend mode, SMS OTP, NID photo auto-fill, face or fingerprint login, a biller directory, real operator recharge.
- Tests: `python3 tests/test_upay.py` (demo mode) and, with the backend running on :8000, `python3 tests/test_backend_ui.py` (checks that a fresh browser gets the favourites, photo, reminders and billers back, and that freeze reaches the server).

Round 8 (referral, demo labels, SMS code screen, analytics, billers + recharge)
- Referral: code = UP + last 9 digits of your number. In backend mode the SERVER now pays it: the friend and the new customer each get 50 (rows `referral` / `referral_new` in the ledger), a friend is paid for at most 10 sign-ups, a wrong or own code is refused. More > Refer a friend shows friends joined and amount earned. Sign-up asks for the code in both modes.
- Demo labels: `config.js` has `window.UPAY_DEMO`. The backend serves `UPAY_DEMO=false` when `UPAY_DEMO_MODE=0`; then Demo tools, the `?u=` test-user shortcut and the red DEMO ribbon are gone. While demo is on, they are labelled DEMO.
- SMS code (OTP): sign-up always asks for a 6-digit code after the details; login asks on a device that never logged in with that number (backend: whenever the server needs it). There is no SMS gateway in the demo, so the code is shown on screen in a simulated SMS bubble. 5 tries, 5 minutes, resend after 30 s. With a real gateway (backend `UPAY_SMS_WEBHOOK`) no bubble is shown.
- Admin > Analytics (first tab): requests per day, AI topics and auto-reply rate, complaint categories, median first response and time to resolve, team workload, language, CSV download. "Show sample data" fills it with clearly-labelled fake numbers for demos. Resolve time is recorded from the moment an agent presses "Mark resolved" (older items have none). Logic is in analytics.js.
- Billers: Pay Bill > category > biller (SAMPLE directory in billers.js, same ids as backend/app/providers.py) > account number > "Check bill" (sample amount due) > pay. The history row shows the biller name. Saved billers reopen the form with the account filled in.
- Recharge: number > operator (guessed from the prefix, change it for ported numbers) > amount (10-1000). The operator is SIMULATED: a number ending 00000 shows a failed top-up, and a failed top-up or bill never charges the customer.
- Tests: `python3 tests/test_upay.py` (17 browser tests; set CHROMIUM=/path if Playwright cannot find its browser), `node tests/test_analytics.js`.
