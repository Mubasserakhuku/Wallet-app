"""TEST-ONLY database driver that talks to a real PostgreSQL through `psql`, used where psycopg cannot be installed.
It implements the same interface as app.db (tx() -> Conn with all/one/run/savepoint), so the ledger code under test
is exactly the production code. Each tx() opens its own psql session = its own real Postgres transaction/locks."""
import json, os, subprocess
from contextlib import contextmanager
from decimal import Decimal
from app.db import Conn, IntegrityError

SENTINEL = "__END_OF_QUERY__"


class DbError(Exception):
    pass


def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, Decimal)):
        return str(v)
    if isinstance(v, float):
        return repr(v)
    if isinstance(v, (list, tuple)):
        return "ARRAY[" + ",".join(lit(x) for x in v) + "]::text[]"
    return "'" + str(v).replace("'", "''") + "'"


def bind(sql, params):
    parts = sql.split("%s")
    assert len(parts) == len(params) + 1, f"placeholder mismatch in: {sql}"
    out = parts[0]
    for p, rest in zip(params, parts[1:]):
        out += lit(p) + rest
    return out


class _Raw:
    """Looks like a psycopg connection for Conn: execute() returns a cursor-like with fetchall/description/rowcount."""
    def __init__(self, host, user, dbname):
        self.p = subprocess.Popen(["psql", "-X", "-q", "-A", "-t", "-h", host, "-U", user, "-d", dbname,
                                   "-v", "ON_ERROR_STOP=0", "-v", "VERBOSITY=verbose"],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        self._send("BEGIN;")
        self._n = 0

    def _send(self, sql):
        self.p.stdin.write(sql + "\n\\echo " + SENTINEL + "\n")
        self.p.stdin.flush()
        out = []
        while True:
            line = self.p.stdout.readline()
            if line == "":
                raise DbError("psql died")
            if line.strip() == SENTINEL:
                break
            out.append(line.rstrip("\n"))
        err = [l for l in out if l.startswith("ERROR:")]
        if err:
            code = err[0].split(":")[1].strip() if err[0].count(":") >= 2 else ""
            if code.startswith("23"):
                raise IntegrityError(err[0])
            raise DbError("\n".join(out))
        return out

    def execute(self, sql, params=()):
        sql = bind(sql.strip().rstrip(";"), params)
        head = sql.lstrip().split(None, 1)[0].upper()
        if head in ("SELECT", "WITH"):
            wrapped = f"SELECT COALESCE(json_agg(row_to_json(t)),'[]'::json) FROM ({sql}) t;"
        elif head in ("INSERT", "UPDATE", "DELETE"):
            if " RETURNING " not in sql.upper():
                sql += " RETURNING 1 AS _x"
            wrapped = f"WITH q AS ({sql}) SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json) FROM q;"
        else:
            self._send(sql + ";")
            return _Cur([], False)
        out = self._send(wrapped)
        rows = json.loads(out[-1], parse_float=Decimal, parse_int=int)
        is_dml = head in ("INSERT", "UPDATE", "DELETE")
        if is_dml and rows and set(rows[0]) == {"_x"}:
            return _Cur([], True, len(rows))
        return _Cur(rows, True, len(rows))

    @contextmanager
    def transaction(self):
        self._n += 1
        name = f"sp{self._n}"
        self._send(f"SAVEPOINT {name};")
        try:
            yield
        except BaseException:
            self._send(f"ROLLBACK TO SAVEPOINT {name};")
            raise
        else:
            self._send(f"RELEASE SAVEPOINT {name};")

    def finish(self, commit):
        try:
            self._send("COMMIT;" if commit else "ROLLBACK;")
        finally:
            try:
                self.p.stdin.write("\\q\n"); self.p.stdin.flush()
            except Exception:
                pass
            self.p.wait(timeout=10)
            self.p.stdout.close(); self.p.stdin.close()


class _Cur:
    def __init__(self, rows, has_rows, rowcount=0):
        self._rows, self.description, self.rowcount = rows, ([1] if has_rows else None), rowcount

    def fetchall(self):
        return self._rows


class PsqlDatabase:
    def __init__(self, host="/tmp", user="upay", dbname="upay_test"):
        self.host, self.user, self.dbname = host, user, dbname

    @contextmanager
    def tx(self):
        raw = _Raw(self.host, self.user, self.dbname)
        try:
            yield Conn(raw)
        except BaseException:
            raw.finish(False)
            raise
        else:
            raw.finish(True)

    def reset(self, schema_path):
        sql = "DROP SCHEMA public CASCADE; CREATE SCHEMA public;\n" + open(schema_path, encoding="utf-8").read()
        r = subprocess.run(["psql", "-X", "-q", "-h", self.host, "-U", self.user, "-d", self.dbname, "-v", "ON_ERROR_STOP=1"],
                           input=sql, text=True, capture_output=True)
        if r.returncode:
            raise DbError(r.stderr)
