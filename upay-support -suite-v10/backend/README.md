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
