#!/bin/sh
set -e

echo "→ صبر برای آماده‌شدن دیتابیس..."
# تلاش تا ۳۰ بار (۶۰ ثانیه) برای اتصال به دیتابیس
i=0
until npx prisma db execute --schema=prisma/schema.prisma --stdin <<'PING' >/dev/null 2>&1
SELECT 1;
PING
do
  i=$((i+1))
  if [ "$i" -ge 30 ]; then echo "✗ دیتابیس آماده نشد"; exit 1; fi
  echo "  ...تلاش $i"
  sleep 2
done
echo "✓ دیتابیس آماده است"

# ═══════════════════════════════════════════════════════════
#  اعمال schema با migration history واقعی (نه db push).
#  C5: قبلاً `db push --accept-data-loss` بود که روی هر استارت می‌توانست
#  ستون/داده‌ی production را حذف کند. حالا migrate deploy فقط migrationهای
#  ثبت‌شده را به‌ترتیب اعمال می‌کند و چیزی drop نمی‌کند.
# ═══════════════════════════════════════════════════════════
# ── baseline: دیتابیسِ موجود بدونِ تاریخچه‌ی migration ──
# بدونِ این، migrate deploy روی یک DB پرِ ازقبل‌موجود با P3005 می‌شکند.
has_tables=0; has_history=0
npx prisma db execute --schema=prisma/schema.prisma --stdin >/dev/null 2>&1 <<'SQL' && has_tables=1
SELECT 1 FROM reservations LIMIT 1;
SQL
npx prisma db execute --schema=prisma/schema.prisma --stdin >/dev/null 2>&1 <<'SQL' && has_history=1
SELECT 1 FROM _prisma_migrations LIMIT 1;
SQL
if [ "$has_tables" = "1" ] && [ "$has_history" = "0" ]; then
  echo "→ دیتابیسِ موجود بدونِ تاریخچه — baseline کردنِ 0_init..."
  npx prisma migrate resolve --applied 0_init || true
fi

echo "→ اعمال migrationها (prisma migrate deploy)..."
if ! npx prisma migrate deploy; then
  echo "✗ migrate deploy ناموفق بود — استارت متوقف شد"
  exit 1
fi

# ═══════════════════════════════════════════════════════════
#  اعمالِ SQLهایی که Prisma نمی‌تواند بیان کند (پارتیشنینگ، EXCLUDE،
#  uniqueهای جزئی، RLS، ایندکس‌های عبارتی).
#  P1 (۲۴ ژوئیه ۲۰۲۶): این پوشه قبلاً prisma/migrations/manual/ بود، یعنی
#  داخلِ پوشه‌ی migrations بدونِ migration.sql — که migrate deploy را با
#  P3015 می‌شکست و چون خطِ بالا exit 1 می‌کند، کانتینر اصلاً بوت نمی‌شد.
#  ضمناً هیچ‌جا این فایل‌ها اعمال نمی‌شدند، پس یک نصبِ تازه بدونِ ایندکس‌های
#  عملکرد و بدونِ RLS بالا می‌آمد.
# ═══════════════════════════════════════════════════════════
echo "→ اعمال SQLهای دستی (prisma/sql)..."
sh prisma/apply-sql.sh || { echo "✗ اعمال SQL ناموفق — استارت متوقف شد"; exit 1; }

# seed خودکار فقط اگر RUN_SEED=true باشد (برای اولین راه‌اندازی)
if [ "$RUN_SEED" = "true" ]; then
  echo "→ اجرای seed (داده‌ی اولیه)..."
  npx prisma db seed || echo "  (seed قبلاً اجرا شده یا خطا داشت)"
fi

echo "→ استارت سرور..."
exec npm run start
