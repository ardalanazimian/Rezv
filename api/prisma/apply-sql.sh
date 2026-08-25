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
    || {
      echo "✗ اعمالِ $name ناموفق — متوقف شد"
      # راهنمایِ خطایِ رایج (فازِ ۲ · P2-4): این اسکریپت فقط migrationهایِ
      # *افزایشی* را اعمال می‌کند و اسکیمایِ پایه را نمی‌سازد. رویِ یک DBِ
      # کاملاً خالی، همان فایلِ اول (ایندکس رویِ جدولِ موجود) با P1014 شکست
      # می‌خورد — خطایی که علتش اصلاً روشن نیست.
      echo ""
      echo "  ℹ اگر خطا «P1014 ... does not exist» بود یعنی اسکیمایِ پایه هنوز ساخته نشده."
      echo "    این اسکریپت اسکیما نمی‌سازد، فقط ایندکس/کانسترینت/پارتیشن اضافه می‌کند."
      echo "    رویِ یک دیتابیسِ خالی اول این را اجرا کن، بعد دوباره همین اسکریپت را:"
      echo "      npx prisma db push --schema \"$SCHEMA\""
      exit 1
    }
done

echo "✓ همه‌ی فایل‌های SQL اعمال شدند"
