"""SIMULATED outside providers (mobile operators and billers). No real money or data leaves this server.
Each function has the shape a real integration would have: it either returns a result with a provider reference,
or raises LedgerError('provider_failed') BEFORE the customer is charged. Replace the bodies with real API calls."""
from __future__ import annotations
import hashlib
from decimal import Decimal

from .ledger import LedgerError, new_trx

OPERATORS = {                                   # same prefix table as OPS in the web app (core.js)
    "gp": ("Grameenphone", ("013", "017")),
    "bl": ("Banglalink", ("014", "019")),
    "robi": ("Robi", ("016", "018")),
    "tt": ("Teletalk", ("015",)),
}
RECHARGE_MIN, RECHARGE_MAX = Decimal("10"), Decimal("1000")
FAIL_SUFFIX = "00000"                           # demo: a number ending in 00000 makes the provider fail, so the failure path can be shown


def operator_of(phone: str) -> str | None:
    for k, (_, prefixes) in OPERATORS.items():
        if phone[:3] in prefixes:
            return k
    return None


def topup(phone: str, amount: Decimal, operator: str = "") -> dict:
    """Simulated mobile top-up. The operator comes from the number prefix; a ported number may really belong to another operator,
    so the customer's choice (`operator`) wins when given."""
    if not (len(phone) == 11 and phone.isdigit() and phone.startswith("01")):
        raise LedgerError("bad_phone", "Enter a valid mobile number")
    if operator and operator not in OPERATORS:
        raise LedgerError("bad_request", "Unknown operator")
    op = operator or operator_of(phone)
    if not op:
        raise LedgerError("bad_phone", "Unknown operator prefix, choose the operator")
    if not (RECHARGE_MIN <= amount <= RECHARGE_MAX):
        raise LedgerError("bad_amount", "Recharge must be between 10 and 1000", min=str(RECHARGE_MIN), max=str(RECHARGE_MAX))
    if phone.endswith(FAIL_SUFFIX):
        raise LedgerError("provider_failed", "The operator could not accept this recharge right now, you were not charged")
    return {"ref": "RC" + new_trx()[2:], "operator": OPERATORS[op][0], "simulated": True}


# ---- billers: a SAMPLE directory (ids are what the server stores; the web app shows the same list in billers.js)
BILLERS = [
    ("desco", "electricity", "DESCO (Dhaka North)"), ("dpdc", "electricity", "DPDC (Dhaka South)"), ("nesco", "electricity", "NESCO"),
    ("wzpdcl", "electricity", "WZPDCL"), ("reb", "electricity", "Palli Bidyut (REB)"),
    ("titas", "gas", "Titas Gas"), ("bakhrabad", "gas", "Bakhrabad Gas"), ("karnaphuli", "gas", "Karnaphuli Gas"), ("jalalabad", "gas", "Jalalabad Gas"),
    ("dwasa", "water", "Dhaka WASA"), ("cwasa", "water", "Chattogram WASA"),
    ("link3", "internet", "Link3"), ("carnival", "internet", "Carnival Internet"), ("amberit", "internet", "Amber IT"), ("btcl", "internet", "BTCL Broadband"),
    ("akash", "tv", "Akash DTH"), ("cabletv", "tv", "Local cable TV"),
    ("brac", "education", "Sample University tuition"), ("school", "education", "Sample school fees"),
]
BILLER_IDS = {b[0]: b for b in BILLERS}


def biller(biller_id: str) -> tuple:
    b = BILLER_IDS.get(biller_id)
    if not b:
        raise LedgerError("bad_request", "Unknown biller")
    return b


def check_account(account: str) -> str:
    a = (account or "").strip()
    if not (6 <= len(a) <= 20 and a.isalnum()):
        raise LedgerError("bad_account", "Account / meter number must be 6 to 20 letters or digits")
    return a


def bill_lookup(biller_id: str, account: str) -> dict:
    """SIMULATED bill lookup: a stable fake 'amount due' derived from the account number, so the demo behaves the same every time."""
    b = biller(biller_id)
    a = check_account(account)
    h = int(hashlib.sha256(f"{b[0]}|{a}".encode()).hexdigest(), 16)
    return {"biller": b[0], "name": b[2], "account": a, "due": str(Decimal(300 + h % 4700)), "customer": "Sample customer " + a[-4:], "simulated": True}


def pay_bill(biller_id: str, account: str, amount: Decimal) -> dict:
    b = biller(biller_id)
    check_account(account)
    if account.endswith("0000000"):
        raise LedgerError("provider_failed", "The biller could not accept this payment right now, you were not charged")
    return {"ref": "BL" + new_trx()[2:], "biller": b[2], "simulated": True}
