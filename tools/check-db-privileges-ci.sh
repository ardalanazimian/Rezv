#!/bin/sh
# Falsifiability for tools/check-db-privileges.mjs on the CI harness.
# Three axes, each must produce the documented exit code — never inferred.
#
#   unset DATABASE_URL          → 2 (UNKNOWN)
#   owner / superuser URL       → 1 (RED)
#   rezervno_app after 097      → 0 (GREEN)
#
# Requires: migrations already applied, Prisma client generated, psql, api/node_modules.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OWNER_URL="${DATABASE_URL:-}"
if [ -z "$OWNER_URL" ]; then
  echo "✗ check-db-privileges-ci: DATABASE_URL (owner) is required" >&2
  exit 2
fi

APP_PASSWORD="${P0022_APP_PASSWORD:-ci-app-not-a-prod-secret}"
APP_URL="$(printf '%s\n' "$OWNER_URL" | sed -E 's#://[^@]+@#://rezervno_app:'"$APP_PASSWORD"'@#')"

echo "→ axis UNKNOWN (unset DATABASE_URL) must exit 2"
set +e
unset DATABASE_URL
( cd "$ROOT" && env -u DATABASE_URL node tools/check-db-privileges.mjs )
UNSET_EXIT=$?
set -e
if [ "$UNSET_EXIT" -ne 2 ]; then
  echo "✗ expected exit 2 with unset DATABASE_URL, got $UNSET_EXIT" >&2
  exit 1
fi
echo "   got 2"

echo "→ axis RED (owner/superuser) must exit 1"
set +e
DATABASE_URL="$OWNER_URL" node tools/check-db-privileges.mjs
OWNER_EXIT=$?
set -e
if [ "$OWNER_EXIT" -ne 1 ]; then
  echo "✗ expected exit 1 on owner URL, got $OWNER_EXIT" >&2
  exit 1
fi
echo "   got 1"

echo "→ set rezervno_app password and CONNECT (idempotent)"
psql "$OWNER_URL" -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE rezervno_app LOGIN PASSWORD '${APP_PASSWORD}'" \
  -c "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'rezervno_app'"

echo "→ axis GREEN (rezervno_app) must exit 0"
set +e
DATABASE_URL="$APP_URL" node tools/check-db-privileges.mjs
APP_EXIT=$?
set -e
if [ "$APP_EXIT" -ne 0 ]; then
  echo "✗ expected exit 0 on rezervno_app URL, got $APP_EXIT" >&2
  exit 1
fi
echo "   got 0"

echo "✓ P0-022 checker falsifiable on this harness: unset=2 · owner=1 · app=0"
