"""Schemaless documents for the support side (chat, email, complaints, student applications, FAQ, announcements).
Customers can only touch their own documents, and cannot change fields that only staff may change."""
import json
from typing import Any
from .ledger import LedgerError, now_ms

CUSTOMER_COLLECTIONS = {"chats", "emails", "complaints", "acctreqs"}
STAFF_FIELDS = {"status", "replies", "note", "decidedAt", "pri", "team"}


def _row(c, collection, id_):
    return c.one("SELECT id, owner_uid, data, updated_at FROM docs WHERE collection=%s AND id=%s", collection, id_)


APPEND_ONLY = ("msgs", "replies", "audit")      # lists that only ever grow: merged, so two writers never erase each other's messages


def _merge(old: dict | None, new: dict) -> dict:
    out = dict(new)
    for k in APPEND_ONLY:
        if old and isinstance(old.get(k), list):
            seen = {json.dumps(x, sort_keys=True) for x in old[k]}
            extra = [x for x in (new.get(k) or []) if json.dumps(x, sort_keys=True) not in seen]
            merged = list(old[k]) + extra
            if k != "audit" and all(isinstance(x, dict) and "ts" in x for x in merged):
                merged.sort(key=lambda x: x["ts"])
            out[k] = merged
    return out


def _upsert(c, collection, id_, owner_uid, data):
    old = _row(c, collection, id_)
    data = _merge(old["data"] if old else None, data)
    updated = max(now_ms(), (old["updated_at"] + 1) if old else 0)
    c.run("INSERT INTO docs (collection,id,owner_uid,data,updated_at) VALUES (%s,%s,%s,%s::jsonb,%s) "
          "ON CONFLICT (collection,id) DO UPDATE SET data=EXCLUDED.data, owner_uid=COALESCE(EXCLUDED.owner_uid, docs.owner_uid), updated_at=EXCLUDED.updated_at",
          collection, id_, owner_uid, json.dumps(data), updated)
    return data


def put_raw(db, collection: str, id_: str, data: dict, owner_uid: str | None = None) -> None:
    with db.tx() as c:
        c.run("SELECT 1 AS x FROM docs WHERE collection=%s AND id=%s FOR UPDATE", collection, id_)
        _upsert(c, collection, id_, owner_uid, data)


def get(db, collection: str, id_: str) -> dict | None:
    with db.tx() as c:
        r = _row(c, collection, id_)
        return r["data"] if r else None


def list_(db, collection: str, owner_uid: str | None = None, limit: int = 200, since: int = 0) -> list[dict]:
    """Documents changed after `since` (ms). Each row carries `_id` and `_u` (version) so a poller only downloads what changed."""
    with db.tx() as c:
        if owner_uid is None:
            rows = c.all("SELECT id, data, updated_at FROM docs WHERE collection=%s AND updated_at>%s ORDER BY updated_at LIMIT %s", collection, since, limit)
        else:
            rows = c.all("SELECT id, data, updated_at FROM docs WHERE collection=%s AND owner_uid=%s AND updated_at>%s ORDER BY updated_at LIMIT %s", collection, owner_uid, since, limit)
        return [{**r["data"], "_id": r["id"], "_u": r["updated_at"]} for r in rows]


def delete(db, collection: str, id_: str) -> None:
    with db.tx() as c:
        c.run("DELETE FROM docs WHERE collection=%s AND id=%s", collection, id_)


def customer_put(db, uid: str, collection: str, id_: str, data: dict[str, Any]) -> dict:
    if collection not in CUSTOMER_COLLECTIONS:
        raise LedgerError("forbidden", "Not allowed")
    if len(json.dumps(data)) > 1_500_000:
        raise LedgerError("bad_request", "Document too large")
    with db.tx() as c:
        c.run("SELECT 1 AS x FROM docs WHERE collection=%s AND id=%s FOR UPDATE", collection, id_)
        old = _row(c, collection, id_)
        if old and old["owner_uid"] != uid:
            raise LedgerError("forbidden", "Not yours")
        if collection in ("chats", "acctreqs") and id_ != uid:
            raise LedgerError("forbidden", "Not yours")
        if collection in ("emails", "complaints"):
            if old:        # a customer can only mark replies as read
                new = {**old["data"], "unreadCust": int(data.get("unreadCust", old["data"].get("unreadCust", 0)) or 0)}
            else:
                new = {**{k: v for k, v in data.items() if k not in STAFF_FIELDS}, "id": id_, "uid": uid, "status": "new", "replies": []}
        elif collection == "acctreqs":
            oldst = old["data"].get("status") if old else None
            if old and oldst in ("approved", "rejected") and data.get("status") == oldst:
                new = {**old["data"], "unreadCust": int(data.get("unreadCust", 0) or 0)}      # the customer only marks the decision as read
            elif oldst == "approved":
                raise LedgerError("conflict", "Already approved")
            else:                                                                             # a new (or repeated) application: always starts as pending
                new = {**{k: v for k, v in data.items() if k not in STAFF_FIELDS}, "uid": uid, "status": "pending", "note": ""}
        else:  # chats: the customer's own conversation thread
            new = {**data, "uid": uid}
        return _upsert(c, collection, id_, uid, new)


def customer_delete(db, uid: str, collection: str, id_: str) -> None:
    """Only a pending student application can be withdrawn by the customer."""
    if collection != "acctreqs" or id_ != uid:
        raise LedgerError("forbidden", "Not allowed")
    with db.tx() as c:
        old = _row(c, collection, id_)
        if old and old["data"].get("status") == "approved":
            raise LedgerError("conflict", "Already approved")
        c.run("DELETE FROM docs WHERE collection=%s AND id=%s AND owner_uid=%s", collection, id_, uid)
