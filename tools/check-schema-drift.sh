#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════
#  بررسیِ انحرافِ اسکیما — «آیا تولید هرچه Prisma لازم دارد را واقعاً دارد؟»
#
#  ⚠️ مسئله‌ی واقعی که این اسکریپت جلویش را می‌گیرد:
#
#  دو مسیرِ متفاوت اسکیما می‌سازند و CI فقط یکی را می‌بیند —
#    • CI:     prisma db push  (از رویِ schema.prisma)
#    • تولید:  prisma migrate deploy (0_init) + prisma/apply-sql.sh
#
#  یعنی اگر کسی فیلدی به schema.prisma اضافه کند و مهاجرتِ SQL ننویسد،
#  `db push` آن را در CI می‌سازد و همه‌ی تست‌ها سبز می‌شوند — ولی تولید که
#  فقط 0_init + SQLها را دارد آن ستون را ندارد و در زمانِ اجرا می‌شکند.
#  دقیقاً همان «CI سبز، تولید خراب» که هیچ تستی نمی‌گیردش.
#
#  ⚠️ چرا `prisma migrate diff` استفاده نشد (اندازه‌گیری‌شده، نه حدس):
#  رویِ همین ریپو ۶۱۷ خط خروجی می‌دهد که تقریباً همه‌اش آرایشی است
#  (drop/recreate کردنِ FKها با نامِ متفاوت) و همیشه exit=2 برمی‌گرداند.
#  یعنی به‌عنوانِ دروازه بی‌فایده است: همیشه قرمز، پس همیشه نادیده گرفته
#  می‌شود. مقایسه‌ی ستون‌به‌ستون دقیق است و صفر مثبتِ کاذب دارد.
#
#  ستون‌هایی که فقط در تولید هستند مشکل نیستند و عمداً نادیده گرفته می‌شوند:
#    • _prisma_migrations.*        → دفترِ خودِ Prisma، کدِ اپ سراغش نمی‌رود
#    • reservations.block_end      → GENERATED ALWAYS؛ Prisma هرگز درجش نمی‌کند
#      (قیدِ no_table_overlap رویش سوار است — حذفش نکن)
#
#  نیازمندی: یک PostgreSQLِ در دسترس با اجازه‌ی CREATE DATABASE.
#  متغیرِ ADMIN_URL باید به یک دیتابیسِ مدیریتی اشاره کند (پیش‌فرض: postgres).
# ═══════════════════════════════════════════════════════════════════════
set -e

ADMIN_URL="${ADMIN_URL:-postgresql://test:test@localhost:5432/postgres}"
BASE="${ADMIN_URL%/*}"
PRISMA_DB="_drift_prisma_$$"
PROD_DB="_drift_prod_$$"

cd "$(dirname "$0")/../api"

cleanup() {
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $PRISMA_DB;" >/dev/null 2>&1 || true
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $PROD_DB;"   >/dev/null 2>&1 || true
  rm -f /tmp/_drift_prisma.txt /tmp/_drift_prod.txt
}
trap cleanup EXIT

psql "$ADMIN_URL" -q -c "CREATE DATABASE $PRISMA_DB;" >/dev/null
psql "$ADMIN_URL" -q -c "CREATE DATABASE $PROD_DB;"   >/dev/null

echo "→ ساختِ اسکیما از دیدگاهِ Prisma (db push)..."
DATABASE_URL="$BASE/$PRISMA_DB" DATABASE_DIRECT_URL="$BASE/$PRISMA_DB" \
  npx prisma db push --skip-generate >/dev/null 2>&1

echo "→ ساختِ اسکیما به شکلِ تولید (migrate deploy + apply-sql)..."
DATABASE_URL="$BASE/$PROD_DB" DATABASE_DIRECT_URL="$BASE/$PROD_DB" \
  npx prisma migrate deploy >/dev/null 2>&1
DATABASE_URL="$BASE/$PROD_DB" DATABASE_DIRECT_URL="$BASE/$PROD_DB" \
  sh prisma/apply-sql.sh >/dev/null 2>&1

# ⚠️ فقط *نامِ* ستون مقایسه می‌شود، نه امضایِ کامل (نوع/nullable). این تصمیم
# با اندازه‌گیری گرفته شد، نه با سلیقه:
#
#   نسخه‌ی اولِ این اسکریپت امضایِ کامل را مقایسه می‌کرد و ۵۰ «انحراف» داد.
#   بررسیِ تک‌تکشان نشان داد هیچ‌کدام واقعی نیستند:
#     • ~۳۵ ستونِ زمانی: تولید timestamptz است و db push آن‌ها را timestamp
#       می‌سازد. با آزمونِ round-tripِ واقعی (نوشتن و خواندنِ یک لحظه‌ی معلوم
#       با Prisma روی هر دو شکل) ثابت شد نتیجه بایت‌به‌بایت یکی است.
#     • ~۱۵ ستونِ آرایه‌ای: تولید NOT NULL است و Prisma nullable می‌سازد.
#       تولید *سخت‌گیرتر* است، و Prisma هرگز برای scalar list مقدارِ NULL
#       نمی‌فرستد.
#
#   دروازه‌ای که ۵۰ هشدارِ کاذب می‌دهد همان سرنوشتِ `prisma migrate diff` را
#   پیدا می‌کند: همیشه قرمز، پس همیشه نادیده گرفته می‌شود. ستونِ *گم‌شده*
#   تنها سیگنالی است که واقعاً تولید را می‌شکند و صفر مثبتِ کاذب دارد.
COLQ="SELECT table_name||'.'||column_name
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name <> '_prisma_migrations'"

# ⚠️ `LC_ALL=C sort` اجباری است و نه تزئینی: `comm` ورودیِ مرتب‌شده به ترتیبِ
# *بایتی* می‌خواهد، ولی `ORDER BY` در Postgres با collationِ محلی (en_US.utf8)
# مرتب می‌کند که نقطه و زیرخط را نادیده می‌گیرد. نسخه‌ی اولِ همین اسکریپت
# بدونِ این، ۵۰ «انحراف»ِ کاملاً کاذب گزارش کرد که هیچ‌کدام واقعی نبودند.
psql "$BASE/$PRISMA_DB" -Atc "$COLQ" | LC_ALL=C sort > /tmp/_drift_prisma.txt
psql "$BASE/$PROD_DB"   -Atc "$COLQ" | LC_ALL=C sort > /tmp/_drift_prod.txt

MISSING=$(LC_ALL=C comm -23 /tmp/_drift_prisma.txt /tmp/_drift_prod.txt)

if [ -n "$MISSING" ]; then
  echo ""
  echo "✗ انحرافِ اسکیما: این ستون‌ها را Prisma لازم دارد ولی تولید نمی‌سازدشان."
  echo "  یعنی CI سبز می‌شود ولی تولید در زمانِ اجرا می‌شکند."
  echo ""
  echo "$MISSING" | sed 's/^/    /'
  echo ""
  echo "  رفع: یک مهاجرتِ SQL جدید در api/prisma/sql/NNN-*.sql بنویس که همین"
  echo "  تغییر را اعمال کند (فایلِ قبلی را ویرایش نکن)."
  exit 1
fi

echo "✓ بدونِ انحراف — تولید هرچه Prisma لازم دارد را دارد ($(wc -l < /tmp/_drift_prisma.txt) ستون)"
