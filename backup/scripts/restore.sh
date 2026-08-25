#!/bin/sh
# ═══════════════════════════════════════════════════════════
#  رزرونو — بازیابی دیتابیس از بک‌آپ
#  استفاده:  ./restore.sh <نام-فایل-بک‌آپ.sql.gz>
#  یا بدون آرگومان → آخرین بک‌آپ را برمی‌گرداند
#  ⚠️ این داده‌ی فعلی را بازنویسی می‌کند!
# ═══════════════════════════════════════════════════════════
set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
PGHOST="${PGHOST:-postgres}"
PGUSER="${POSTGRES_USER:-rezervno}"
PGDATABASE="${POSTGRES_DB:-rezervno}"

# انتخاب فایل: آرگومان یا آخرین بک‌آپ
if [ -n "$1" ]; then
  FILE="$1"
  [ -f "$FILE" ] || FILE="$BACKUP_DIR/$1"
else
  FILE=$(ls -1t "$BACKUP_DIR"/rezervno_*.sql.gz 2>/dev/null | head -1)
  echo "فایلی مشخص نشد → آخرین بک‌آپ: $FILE"
fi

if [ ! -f "$FILE" ]; then
  echo "✗ فایل بک‌آپ پیدا نشد: $FILE"
  echo "بک‌آپ‌های موجود:"
  ls -1 "$BACKUP_DIR"/rezervno_*.sql.gz 2>/dev/null || echo "  (هیچ بک‌آپی نیست)"
  exit 1
fi

echo "⚠️  هشدار: این کار داده‌ی فعلی دیتابیس را بازنویسی می‌کند!"
echo "    فایل بازیابی: $FILE"
echo "    دیتابیس مقصد: $PGDATABASE روی $PGHOST"
echo ""
echo "برای ادامه، طی ۵ ثانیه Ctrl+C نزن..."
sleep 5

echo "→ در حال بازیابی..."
gunzip -c "$FILE" | PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE"

echo "✓ بازیابی کامل شد از: $FILE"
