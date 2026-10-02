#!/bin/sh
set -eu

if command -v brew >/dev/null 2>&1; then
  postgres_prefix="$(brew --prefix postgresql@16 2>/dev/null || true)"
  homebrew_prefix="$(brew --prefix 2>/dev/null || true)"
fi
postgres_prefix="${postgres_prefix:-/usr/local/opt/postgresql@16}"
data_dir="${POSTGRES_DATA_DIR:-${homebrew_prefix:-/usr/local}/var/postgresql@16}"

"$postgres_prefix/bin/pg_ctl" -D "$data_dir" stop -m fast
