"""Signed login tokens (HMAC-SHA256, stdlib only). Demo-grade login: real production login must verify the phone by OTP
and then call issue_token(uid). Everything else in the API only trusts the uid inside a valid token."""
import base64, hashlib, hmac, json, time
from . import config as C


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sig(body: str) -> str:
    return _b64(hmac.new(C.SECRET_KEY.encode(), body.encode(), hashlib.sha256).digest())


def issue_token(uid: str, now: float | None = None) -> str:
    body = _b64(json.dumps({"uid": uid, "exp": int((now or time.time()) + C.TOKEN_TTL_S)}, separators=(",", ":")).encode())
    return body + "." + _sig(body)


def read_token(token: str, now: float | None = None) -> str | None:
    """Returns the uid, or None when the token is forged, damaged or expired."""
    try:
        body, sig = token.split(".", 1)
        if not hmac.compare_digest(sig, _sig(body)):
            return None
        data = json.loads(_unb64(body))
        if data["exp"] < (now or time.time()):
            return None
        return str(data["uid"])
    except Exception:
        return None


def admin_ok(key: str | None) -> bool:
    return bool(key) and hmac.compare_digest(key, C.ADMIN_KEY)
