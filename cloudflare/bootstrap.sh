#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DB_NAME="${D1_DATABASE_NAME:-doroshka-music}"

command -v npx >/dev/null 2>&1 || { echo "Node.js/npm is required." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required to update wrangler.toml." >&2; exit 1; }

echo "Checking Cloudflare authentication..."
npx wrangler whoami >/dev/null

if [[ -n "${D1_DATABASE_ID:-}" ]]; then
  DATABASE_ID="$D1_DATABASE_ID"
else
  echo "Creating D1 database: $DB_NAME"
  CREATE_OUTPUT="$(npx wrangler d1 create "$DB_NAME" 2>&1)" || {
    printf '%s\n' "$CREATE_OUTPUT" >&2
    echo "If the database already exists, set D1_DATABASE_ID to its ID and rerun." >&2
    exit 1
  }
  printf '%s\n' "$CREATE_OUTPUT"
  DATABASE_ID="$(printf '%s\n' "$CREATE_OUTPUT" | sed -nE 's/.*database_id[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' | head -n 1)"
fi

if [[ ! "$DATABASE_ID" =~ ^[A-Za-z0-9-]{16,}$ ]]; then
  echo "Could not determine a valid D1 database ID. Set D1_DATABASE_ID and rerun." >&2
  exit 1
fi

python3 - "$ROOT_DIR/wrangler.toml" "$DATABASE_ID" <<'PY'
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
database_id = sys.argv[2]
text = path.read_text()
updated, count = re.subn(
    r'(?m)^database_id\s*=\s*"[^"]*"$',
    f'database_id = "{database_id}"',
    text,
    count=1,
)
if count != 1:
    raise SystemExit("Expected exactly one database_id entry in wrangler.toml")
path.write_text(updated)
PY

echo "Applying D1 migrations..."
npx wrangler d1 migrations apply "$DB_NAME" --remote

echo "Loading licensed public-domain test tracks..."
npx wrangler d1 execute "$DB_NAME" --remote --file=cloudflare/seed.sql

echo "Deploying Worker..."
npx wrangler deploy

echo "Cloudflare setup complete. D1 ID written to wrangler.toml; demo tracks loaded."
