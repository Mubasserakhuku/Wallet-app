"""Starts the real app/main.py (on real PostgreSQL via the psql shim) and serves the web app, for browser tests.
   python3 tests/e2e_server.py   ->  http://localhost:8800"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("UPAY_SCHEDULER_INTERVAL_S", "1")
from tests import _fastapi  # noqa: F401  (adds the shim only if FastAPI is missing)
import uvicorn
from app.main import create_app
from tests.psql_shim import PsqlDatabase

SCHEMA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "schema.sql")
db = PsqlDatabase(host=os.getenv("PGHOST", "/tmp"))
if os.getenv("E2E_KEEP") != "1":
    db.reset(SCHEMA)
app = create_app(db, start_scheduler=True)
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", "8800")), log_level="warning")
