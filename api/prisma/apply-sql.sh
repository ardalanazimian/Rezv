#!/bin/sh
# اعمالِ ترتیبیِ prisma/sql/*.sql با prisma db execute.
# چرا psql نیست: ایمیجِ runtime پکیجِ postgresql-client ندارد (فقط dumb-init).
# فایل‌هایی که «-- @manual-only» دارند رد می‌شوند (راهنما/scaffold، نه migration).
set -e

BASE="$(cd "$(dirname "$0")" && pwd)"
SCHEMA="$BASE/schema.prisma"
DIR="$BASE/sql"

[ -d "$DIR" ] || { echo "✗ پوشه‌ی $DIR یافت نشد"; exit 1; }

for f in "$DIR"/*.sql; do
  [ -e "$f" ] || continue
  name="$(basename "$f")"
  if grep -q '@manual-only' "$f"; then
    echo "  ⏭  $name (manual-only)"
    continue
  fi
  echo "  →  $name"
  npx prisma db execute --schema "$SCHEMA" --file "$f" \
    || { echo "✗ اعمالِ $name ناموفق — متوقف شد"; exit 1; }
done

echo "✓ همه‌ی فایل‌های SQL اعمال شدند"
