"""SMS sender. Demo: the message is only logged (and the API returns the code to the app when UPAY_DEMO_MODE=1).
Production: set UPAY_SMS_WEBHOOK to your gateway; it receives POST {"to": "01XXXXXXXXX", "text": "..."} as JSON."""
import json, logging, urllib.request
from . import config as C

log = logging.getLogger("upay.sms")


def send(phone: str, text: str) -> bool:
    if not C.SMS_WEBHOOK:
        log.info("SMS (not sent, no gateway configured) to %s: %s", phone, text if C.DEMO_MODE else "<hidden>")
        return False
    req = urllib.request.Request(C.SMS_WEBHOOK, data=json.dumps({"to": phone, "text": text}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=8) as r:
        return 200 <= r.status < 300
