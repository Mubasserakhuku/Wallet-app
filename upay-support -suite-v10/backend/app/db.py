"""Thin database layer. Business code only uses Conn.all / one / run, so it never depends on the driver.
Placeholders are %s. Times are epoch ms (ints), money is Decimal, so no driver-specific types leak out."""
from __future__ import annotations
from contextlib import contextmanager
from typing import Any, Iterator


class IntegrityError(Exception):
    """A CHECK / UNIQUE / FOREIGN KEY constraint was violated."""


class Conn:
    def __init__(self, raw):
        self.raw = raw

    def all(self, sql: str, *params: Any) -> list[dict]:
        cur = self.raw.execute(sql, params)
        return list(cur.fetchall()) if cur.description else []

    def one(self, sql: str, *params: Any) -> dict | None:
        rows = self.all(sql, *params)
        return rows[0] if rows else None

    def run(self, sql: str, *params: Any) -> int:
        return self.raw.execute(sql, params).rowcount

    @contextmanager
    def savepoint(self) -> Iterator[None]:
        """Lets one failing step (e.g. one auto-transfer) roll back without aborting the whole transaction."""
        with self.raw.transaction():
            yield


class PsycopgDatabase:
    """Production implementation: psycopg 3 + connection pool."""

    def __init__(self, url: str, min_size: int = 1, max_size: int = 10):
        import psycopg
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool
        self._psycopg = psycopg
        self.pool = ConnectionPool(url, min_size=min_size, max_size=max_size,
                                   kwargs={"row_factory": dict_row}, open=True)

    @contextmanager
    def tx(self) -> Iterator[Conn]:
        with self.pool.connection() as raw:       # commits on success, rolls back on exception
            try:
                yield Conn(raw)
            except self._psycopg.IntegrityError as e:
                raise IntegrityError(str(e)) from e

    def init_schema(self, path: str) -> None:
        with open(path, encoding="utf-8") as f, self.pool.connection() as raw:
            raw.execute(f.read())

    def close(self) -> None:
        self.pool.close()
