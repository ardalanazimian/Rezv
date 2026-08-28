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
# ⚠️ «تاریخچه» یعنی **ردیفِ اعمال‌شده**، نه صرفاً وجودِ جدول: یک
#    `_prisma_migrations`ِ خالی هم یک حالتِ معتبرِ history-less است و باید
#    آزموده شود. پس به کدِ خروجیِ SELECT تکیه نمی‌کنیم (روی جدولِ خالی هم
#    موفق است) و تعدادِ ردیف را می‌شماریم.
APPLIED="$(npx prisma db execute --schema=prisma/schema.prisma --stdin 2>/dev/null <<'SQL' || true
SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;
SQL
)"
APPLIED_N="$(printf '%s' "$APPLIED" | grep -oE '[0-9]+' | tail -1)"
if [ -n "$APPLIED_N" ] && [ "$APPLIED_N" -gt 0 ] 2>/dev/null; then
  echo "✗ پیش‌شرط برقرار نشد: $APPLIED_N migrationِ اعمال‌شده از قبل هست،"
  echo "  پس شاخه‌ی baseline اصلاً آزموده نمی‌شود. DBِ خالی بده."
  exit 1
fi
echo "✓ پیش‌شرط برقرار: جدول هست، تاریخچه‌ی اعمال‌شده نیست"

# ⚠️ `exec npm run start` انتهایِ اسکریپت هرگز برنمی‌گردد، پس در پس‌زمینه
#    اجرا می‌شود. موفقیت **فقط** با یک probeِ واقعیِ سلامت ثابت می‌شود، نه با
#    دیدنِ خطِ «استارت سرور» در لاگ: اگر `npm run start` آن خط را چاپ کند و
#    بلافاصله بمیرد، همه‌ی پنج نشانه در لاگ حاضرند و گارد بی‌جا سبز می‌شود.
export PORT="${PORT:-3000}"
echo "→ اجرای api/docker-entrypoint.sh (probe رویِ پورتِ $PORT)"
sh docker-entrypoint.sh > "$LOG" 2>&1 &
BOOT_PID=$!
cleanup() { kill "$BOOT_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

HEALTH=""
i=0
while [ "$i" -lt 180 ]; do            # سقفِ ۹ دقیقه (۱۸۰ × ۳ ثانیه)
  # اگر فرایند مرده باشد، دیگر منتظر نمان — همان false-greenی که می‌خواهیم بگیریم.
  if ! kill -0 "$BOOT_PID" 2>/dev/null; then
    echo "  ✗ فرایندِ بوت پیش از پاسخ‌دادنِ /api/health مُرد"
    break
  fi
  HEALTH="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/health" 2>/dev/null || true)"
  [ "$HEALTH" = "200" ] && break
  i=$((i + 1))
  sleep 3
done

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

if [ "$HEALTH" = "200" ]; then
  echo "  ✓ /api/health واقعاً ۲۰۰ داد — سرور بالا ماند"
else
  echo "  ✗ /api/health پاسخِ ۲۰۰ نداد (آخرین کد: ${HEALTH:-هیچ})"
  fail=1
fi

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
