#!/bin/sh
set -eu

backup_dir="${DB_BACKUP_DIR:-$(dirname "$0")/../backups}"
database_url="${DATABASE_URL:-}"
if [ -z "$database_url" ] && [ -f "$(dirname "$0")/../server/.env" ]; then
	database_url="$(sed -n 's/^DATABASE_URL=//p' "$(dirname "$0")/../server/.env" | head -n 1)"
fi
if [ -z "$database_url" ]; then
	echo "DATABASE_URL is missing. Set it or create server/.env first."
	exit 1
fi
database_url="${database_url%%\?*}"
mkdir -p "$backup_dir"
backup_file="$backup_dir/elayone-$(date +%Y%m%d-%H%M%S).dump"
if command -v brew >/dev/null 2>&1; then
	pg_dump_bin="$(brew --prefix postgresql@16 2>/dev/null)/bin/pg_dump"
else
	pg_dump_bin="pg_dump"
fi

"$pg_dump_bin" "$database_url" --format=custom --file "$backup_file"
echo "Database backup written to $backup_file"
