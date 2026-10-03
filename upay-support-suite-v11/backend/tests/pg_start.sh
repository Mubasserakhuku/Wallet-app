#!/bin/sh
# Starts the throw-away local PostgreSQL used by the tests (data in /tmp/pgdata, socket in /tmp). Needs a non-root user to run postgres.
PGBIN=/usr/lib/postgresql/16/bin
if [ ! -d /tmp/pgdata/base ]; then
  mkdir -p /tmp/pgdata && chown nobody /tmp/pgdata
  runuser -u nobody -- $PGBIN/initdb -D /tmp/pgdata -A trust -U upay -E UTF8 --locale=C.UTF-8 >/dev/null
fi
rm -f /tmp/pgdata/postmaster.pid
runuser -u nobody -- $PGBIN/pg_ctl -D /tmp/pgdata -o "-c listen_addresses='' -c unix_socket_directories=/tmp -c max_connections=200" -l /tmp/pg.log start >/dev/null
sleep 2
psql -h /tmp -U upay -d postgres -Atc "select 1 from pg_database where datname='upay_test'" | grep -q 1 || psql -h /tmp -U upay -d postgres -qc "create database upay_test encoding UTF8 template template0 locale C.UTF-8"
echo "postgres ready"
