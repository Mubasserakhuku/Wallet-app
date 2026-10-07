# upay backend (FastAPI + PostgreSQL)

Serves the REST API under `/api` and also the front-end folder `../upay-support-suite` at `/`.

## Run (Docker)
    cp backend/.env.example backend/.env   # change the secrets
    docker compose up --build   # run from the folder that contains docker-compose.yml; http://localhost:8000, admin: /admin.html

## Run (without Docker)
    createdb upay
    pip install -r requirements.txt
    export DATABASE_URL=postgresql://user:pass@localhost:5432/upay
    uvicorn app.main:app_factory --factory --port 8000
The schema (`schema.sql`) is applied automatically at start (idempotent).

## Settings (environment)
| name | meaning |
|---|---|
| DATABASE_URL | Postgres connection string |
| UPAY_SECRET_KEY | signs login tokens - long random string |
| UPAY_ADMIN_KEY | the admin console sends it as `X-Admin-Key` |
| UPAY_DEMO_MODE | `1` = demo login, add-money, demo tools. **Must be `0` in production** |
| UPAY_SCHEDULER_INTERVAL_S | how often auto-transfer rules are checked (default 15) |
| UPAY_CORS_ORIGINS | comma separated origins if the front-end is hosted elsewhere |
| UPAY_STATIC_DIR | front-end folder to serve |

## How money is kept safe
- Every payment is one DB transaction. Wallet rows are locked with `SELECT ... FOR UPDATE` in sorted id order (no deadlock); `CHECK (balance >= 0)` is the last safety net.
- `Idempotency-Key` header: a retried request (double tap, bad network) is applied once.
- PIN: PBKDF2-SHA256 (200k rounds, salted). 3 wrong tries lock 60 s; the counter is committed even when the request fails.
- Daily 50,000 / monthly 200,000 limits (Asia/Dhaka day boundaries). Cash-out fee 1.85% (verified students pay 20% less), send money is free.
- Cancel: within 2 minutes, max 3 per 24 h, only if the receiver still has the money free (not in a bucket).
- Money columns are `NUMERIC(14,2)`; the ledger is append-only (a reversal is a new row).

## Tests
    pytest                                   # needs real fastapi + psycopg + a Postgres (PGHOST/PGUSER...)
    python3 tests/e2e_server.py &            # browser tests (Playwright) on port 8800
    python3 tests/e2e_api.py
`tests/test_ledger.py` plus `tests/test_api.py` (45 tests together) run against a real Postgres. If FastAPI is not installed the API tests fall back to `tests/fastapi_shim` (a tiny test-only stand-in); with `pip install -r requirements.txt` they use the real FastAPI.
Test Postgres helper: `tests/pg_start.sh`.

## Before real customers (not done in this demo)
- Replace `/api/auth/demo` with OTP (SMS) login; set `UPAY_DEMO_MODE=0`; remove "Demo tools" from the app.
- Real payment rails (bKash/bank/agent network), KYC, audit/AML rules - this is a wallet ledger, not a licensed payment system.
- Rate limiting is in memory (one process); use a shared store (Redis) or a gateway when running several workers.
- JSON money values are numbers; if you need exact strings, change the response encoding.
- HTTPS, backups, monitoring, secrets management.

## Sign-up and login (customers)
- `POST /api/auth/register` `{name, phone, nid, dob (YYYY-MM-DD), pin}` creates the wallet (balance 0) and returns `{token, wallet}`. One account per mobile number and per NID. The NID is stored only as an HMAC hash (keyed with UPAY_SECRET_KEY) plus its last 4 digits.
- `POST /api/auth/login` `{phone, pin}` returns `{token, wallet}`. Wrong PINs use the same counter and 60 s lock as payments; unknown number and wrong PIN give the same error. Both calls are rate limited per number.
- Still to do before real customers: SMS OTP to prove the number, real NID/KYC verification (this only checks the format), and set `UPAY_DEMO_MODE=0` so `/api/auth/demo` is closed.

## Customer settings and lost-phone freeze
- `GET /api/prefs` returns `{favs, billers, reminders}` (the photo is separate because it is big). `GET /api/prefs/{key}` returns `{value}` for one of `favs`, `billers`, `reminders`, `photo`. `PUT /api/prefs/{key}` `{value}` replaces it. Each key is validated (favourites need a real 01XXXXXXXXX number and duplicates are dropped, reminder day 1-28, photo only a JPEG data URL up to 300,000 characters). A customer only sees their own rows; any other key gives 403. Stored in table `prefs` (created automatically at start).
- `POST /api/freeze` `{pin}` freezes the caller's own wallet. It needs the PIN (wrong tries count and lock like payments), so a customer who has no PIN yet cannot use it. It records `frozen_by = "self"` and `frozen_at`. Freezing twice is harmless.
- Only an admin can unfreeze: `POST /api/admin/freeze {uid, frozen:false}` (header `X-Admin-Key`). That clears `frozen_by`. A customer-side unfreeze does not exist on purpose, because without SMS OTP or eKYC the server cannot tell the owner from a thief who holds the phone.
- Referral bonus is still not paid in backend mode: it needs a rule (who pays the 50, how many times, when).

## Round 8 additions
- Referral: `POST /api/auth/register` accepts `ref` (UP + 9 digits). Bonus `REFERRAL_BONUS` (50) to both wallets in the same DB transaction, max `REFERRAL_MAX_PER_REFERRER` (10) paid friends per customer. `GET /api/referral` returns code, friends paid, earned. The bonus is created from nothing (like demo add-money): in production fund it from a marketing account.
- SMS code: `POST /api/auth/otp/send {phone,purpose: register|login}` and `/api/auth/otp/verify {phone,purpose,code}` -> `otp_token`. Only a keyed hash of the code is stored; 5 wrong tries lock it; one use; resend after 30 s. Set `UPAY_REQUIRE_OTP=1` and register/login then need the `otp_token` (login checks number + PIN first, then answers `otp_required`). `UPAY_SMS_WEBHOOK` receives `POST {"to","text"}`; without it the SMS is only logged. `demo_code` is returned only when `UPAY_DEMO_MODE=1`. Default `UPAY_REQUIRE_OTP=0`; `.env.example` turns it on.
- `/config.js` now also sets `window.UPAY_DEMO` from `UPAY_DEMO_MODE`.
- Simulated providers (`app/providers.py`): `/api/pay` with `service=recharge` (optional `operator`) or `service=bill` (optional `biller`); `GET /api/billers`, `GET /api/billers/{id}/lookup/{account}`. They raise `provider_failed` (HTTP 502) BEFORE any money moves. Replace the function bodies with real operator / biller API calls.
- Tests: `tests/test_features.py` (19 tests). Total with the old ones: 64.

## Gemini draft replies (agents)
- Set `GEMINI_API_KEY` (from Google AI Studio; NOT the Cloud project ID) and optionally `GEMINI_MODEL` (default `gemini-2.5-flash`) in `backend/.env`. Empty key = feature off.
- Admin console > Live chat > "Ask Gemini for a draft" calls `POST /api/admin/ai/draft` (admin key). PINs, OTPs, phone numbers and long digit strings are masked before the text leaves the server. The result only fills the reply box: an agent reads, edits and sends it. Nothing is stored, and the key never reaches the browser.
- Needs the backend (not the browser-only demo). Tests: `tests/test_llm.py` (no network, fake transport).
