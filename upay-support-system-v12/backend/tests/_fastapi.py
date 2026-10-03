"""Imports the real FastAPI when installed; otherwise falls back to the test-only shim (and says so)."""
import os, sys
SHIM = False
try:
    import fastapi  # noqa: F401
except ImportError:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "fastapi_shim"))
    SHIM = True
