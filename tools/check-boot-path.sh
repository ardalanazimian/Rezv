#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════
#  گاردِ مسیرِ بوتِ تولید — اجرای واقعیِ api/docker-entrypoint.sh
#
#  چرا این گارد وجود دارد (ممیزیِ پیش از لانچ، ۲۰۲۶-۰۸-۲۸):
#  مسیرِ بوتِ تولید دومرحله‌ای است (`migrate deploy` سپس `apply-sql.sh`) و
#  یک شاخه‌ی حساس دارد: دیتابیسی که **جدول دارد ولی تاریخچه‌ی migration
#  ندارد**. بدونِ `migrate resolve --applied 0_init` آن حالت با `P3005`
#  می‌شکند و کانتینر **اصلاً بوت نمی‌شود** — یعنی یک خرابیِ کاملِ تولید که
#  هیچ‌کدام از تست‌های موجود نمی‌بینندش: سوئیتِ بک‌اند با `db push` اسکیما
#  می‌سازد و اصلاً از این مسیر عبور نمی‌کند.
#
#  ⚠️ عمداً بدونِ داکر: خودِ `docker-entrypoint.sh` هیچ وابستگیِ کانتینری
#  ندارد (فقط شل و `npx prisma`)، پس کلِ منطقِ بوت روی میزبان قابلِ اجراست.
#  این گارد لایه‌ی **ایمیج** را نمی‌سنجد (کاربرِ non-root، dumb-init به‌عنوان
#  PID 1، بیلدِ چندمرحله‌ای) — آن نیازِ ساختِ واقعیِ داکر است.
#
#  نیازمندی‌ها: `DATABASE_URL` به یک Postgresِ **خالی و دورانداختنی**.
#  استفاده:  DATABASE_URL=postgresql://… sh tools/check-boot-path.sh
# ═══════════════════════════════════════════════════════════════════════
set -e

[ -n "$DATABASE_URL" ] || { echo "✗ DATABASE_URL تنظیم نشده"; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/api"

export DATABASE_DIRECT_URL="${DATABASE_DIRECT_URL:-$DATABASE_URL}"
export RUN_SEED=false
LOG="$(mktemp)"

echo "→ ساختِ حالتِ «جدول دارد، تاریخچه ندارد» (db push بدونِ migration history)"
npx prisma db push --skip-generate --accept-data-loss >/dev/null 2>&1 \
  || { echo "✗ آماده‌سازیِ اسکیمای پایه ناموفق"; exit 1; }

# اگر db push به‌هر دلیل تاریخچه ساخت، گارد بی‌معنا می‌شود — صریح رد کن.
if npx prisma db execute --schema=prisma/schema.prisma --stdin >/dev/null 2>&1 <<'SQL'
SELECT 1 FROM _prisma_migrations LIMIT 1;
SQL
then
  echo "✗ پیش‌شرط برقرار نشد: _prisma_migrations از قبل وجود دارد،"
  echo "  پس شاخه‌ی baseline اصلاً آزموده نمی‌شود. DBِ خالی بده."
  exit 1
fi
echo "✓ پیش‌شرط برقرار: جدول هست، تاریخچه نیست"

# ⚠️ `exec npm run start` انتهایِ اسکریپت هرگز برنمی‌گردد، پس با مهلت اجرا
#    می‌شود و موفقیت از رویِ **مراحلِ طی‌شده** سنجیده می‌شود، نه کدِ خروج.
echo "→ اجرای api/docker-entrypoint.sh"
timeout 900 sh docker-entrypoint.sh > "$LOG" 2>&1 || true

fail=0
need() {
  if grep -q "$1" "$LOG"; then
    echo "  ✓ $2"
  else
    echo "  ✗ $2"
    fail=1
  fi
}
need 'دیتابیس آماده است'            'انتظارِ آماده‌شدنِ دیتابیس'
need 'baseline کردنِ 0_init'        'شاخه‌ی baseline شلیک کرد (گاردِ P3005)'
need 'اعمال migrationها'            'migrate deploy اجرا شد'
need 'همه‌ی فایل‌های SQL اعمال شدند' 'apply-sql.sh کامل شد'
need 'استارت سرور'                  'به مرحله‌ی استارتِ سرور رسید'

if grep -qE '✗ (migrate deploy ناموفق|اعمال SQL ناموفق|دیتابیس آماده نشد)' "$LOG"; then
  echo "  ✗ اسکریپت با خطای صریحِ خودش متوقف شد"
  fail=1
fi

if [ "$fail" = "1" ]; then
  echo ""
  echo "✗ مسیرِ بوتِ تولید شکست — ۴۰ خطِ آخرِ لاگ:"
  tail -40 "$LOG"
  exit 1
fi

echo ""
echo "✓ مسیرِ بوتِ تولید سالم است (شاملِ شاخه‌ی baseline)"
