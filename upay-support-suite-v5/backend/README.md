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
`tests/test_ledger.py` (39 tests) runs against a real Postgres. If FastAPI is not installed the API tests fall back to `tests/fastapi_shim` (a tiny test-only stand-in); with `pip install -r requirements.txt` they use the real FastAPI.
Test Postgres helper: `tests/pg_start.sh`.

## Before real customers (not done in this demo)
- Replace `/api/auth/demo` with OTP (SMS) login; set `UPAY_DEMO_MODE=0`; remove "Demo tools" from the app.
- Real payment rails (bKash/bank/agent network), KYC, audit/AML rules - this is a wallet ledger, not a licensed payment system.
- Rate limiting is in memory (one process); use a shared store (Redis) or a gateway when running several workers.
- JSON money values are numbers; if you need exact strings, change the response encoding.
- HTTPS, backups, monitoring, secrets management.
