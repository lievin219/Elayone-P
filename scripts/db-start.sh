#!/bin/sh
set -eu

if command -v brew >/dev/null 2>&1; then
  postgres_prefix="$(brew --prefix postgresql@16 2>/dev/null || true)"
  homebrew_prefix="$(brew --prefix 2>/dev/null || true)"
fi
postgres_prefix="${postgres_prefix:-/usr/local/opt/postgresql@16}"
postgres_bin="$postgres_prefix/bin"
data_dir="${POSTGRES_DATA_DIR:-${homebrew_prefix:-/usr/local}/var/postgresql@16}"
log_dir="$(dirname "$0")/../server/.runtime"
log_file="$log_dir/postgresql.log"
port="${POSTGRES_PORT:-5433}"

if [ ! -x "$postgres_bin/pg_ctl" ]; then
  echo "PostgreSQL 16 was not found. Install it with: brew install postgresql@16"
  exit 1
fi
mkdir -p "$log_dir"
if "$postgres_bin/pg_ctl" -D "$data_dir" status >/dev/null 2>&1; then
  echo "PostgreSQL is already running on port $port."
  exit 0
fi
"$postgres_bin/pg_ctl" -D "$data_dir" -l "$log_file" -o "-p $port" start
"$postgres_bin/pg_isready" -h localhost -p "$port"
