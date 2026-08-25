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

# مسیرِ مطلقِ پوشه‌ی tools را *قبل از* cd نگه می‌داریم؛ بعد از cd دیگر
# "$(dirname "$0")" نسبی است و resolve نمی‌شود.
TOOLS_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$(dirname "$0")/../api"

cleanup() {
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $PRISMA_DB;" >/dev/null 2>&1 || true
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $PROD_DB;"   >/dev/null 2>&1 || true
  rm -f /tmp/_drift_prisma.txt /tmp/_drift_prod.txt /tmp/_drift_fk_prisma.txt /tmp/_drift_fk_prod.txt /tmp/_drift_fk_diff.txt /tmp/_drift_fk_base.txt
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

# ⚠️ لایه‌ی دوم: **کنشِ کلیدهای خارجی** (ON UPDATE / ON DELETE) — با baseline.
#
# چرا اضافه شد: مقایسه‌ی نامِ ستون‌ها یک انحرافِ زنده را ندید —
# `restaurant_closures_restaurant_id_fkey` در schema.prisma `onDelete: Cascade`
# دارد (و پیش‌فرضِ onUpdate در Prisma هم Cascade است) ولی مهاجرتِ دستی فقط
# `ON DELETE CASCADE` نوشته بود. ستون‌ها یکی بودند پس این اسکریپت سبز می‌داد.
#
# ⚠️ چرا baseline و نه شکستِ مستقیم (اندازه‌گیری‌شده روی همین مخزن، نه حدس):
# دو مسیر امروز در **۵۹ کلیدِ خارجی از ۶۹** با هم فرق دارند و این فرق‌ها
# سیستماتیک و عمدی‌اند، نه باگ:
#   • `db push` روی *همه‌ی* FKها `ON UPDATE CASCADE` می‌گذارد (پیش‌فرضِ Prisma)
#     ولی SQLِ دستی معمولاً بندِ ON UPDATE نمی‌نویسد → ۴۴ اختلاف. چون کلیدهای
#     اصلی UUIDاند و هرگز UPDATE نمی‌شوند، این اختلاف رفتاری تولید نمی‌کند.
#   • RESTRICT در برابر NO ACTION: هر دو حذف را *رد* می‌کنند و فقط در زمانِ
#     بررسی فرق دارند (آن هم فقط برای constraintِ deferrable) → عملاً یکی‌اند.
#   • ۱۵ موردِ باقی‌مانده اختلافِ واقعیِ ON DELETE است (تولید CASCADE می‌کند
#     جایی که Prisma RESTRICT می‌خواهد) — تصمیم‌های قدیمیِ همین مخزن که
#     تک‌تکشان نیاز به داوریِ محصولی دارند، نه پاکسازیِ مکانیکی.
# دروازه‌ای که روزِ اول ۵۹ یافته بدهد همان سرنوشتِ `prisma migrate diff` را
# پیدا می‌کند: همیشه قرمز، پس همیشه نادیده. به‌جایش وضعیتِ امروز در
# tools/schema-drift-fk-baseline.txt پین شده و این چک فقط روی **انحرافِ تازه**
# می‌شکند — یعنی دقیقاً همان کلاسِ رگرسیونی که ۰۵۹ ساخت.
#
# ⚠️ baseline یک بدهیِ ثبت‌شده است، نه وضعِ مطلوب. کوچک‌شدنش پیشرفت است؛
# هر خطی که حذف می‌کنی یعنی یک تصمیمِ آگاهانه گرفته‌ای.
#
# مقایسه عمداً **بدونِ نامِ constraint** است: دو مسیر همان FK را با نام‌های
# متفاوت می‌سازند و مقایسه‌ی نامی همان ۶۱۷ خط نویزِ بالا را برمی‌گرداند.
FKQ="SELECT c.conrelid::regclass::text
            || '(' || (SELECT string_agg(a.attname, ',' ORDER BY k.ord)
                       FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
                       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
            || ') -> ' || c.confrelid::regclass::text
            || '  upd=' || c.confupdtype::text || ' del=' || c.confdeltype::text
       FROM pg_constraint c
       WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace"

psql "$BASE/$PRISMA_DB" -Atc "$FKQ" | LC_ALL=C sort > /tmp/_drift_fk_prisma.txt
psql "$BASE/$PROD_DB"   -Atc "$FKQ" | LC_ALL=C sort > /tmp/_drift_fk_prod.txt

# گاردِ ضدِ «سبزِ توخالی»: اگر کوئری به هر دلیلی (خطای SQL، تغییرِ نسخه‌ی
# Postgres) خالی برگردد، این چک بی‌صدا به «انحرافی نیست» تبدیل می‌شود — همان
# کلاسِ خطایی که قرار است بگیردش. مخزنِ سالم ده‌ها FK دارد، پس صفر یعنی
# خرابیِ ابزار. (واقعاً رخ داد: نسخه‌ی اولِ این اضافه بدونِ ::text روی
# confupdtype خطا داد و «۰ کلیدِ خارجی» سبز شد.)
if [ ! -s /tmp/_drift_fk_prisma.txt ] || [ ! -s /tmp/_drift_fk_prod.txt ]; then
  echo ""
  echo "✗ کوئریِ کلیدهای خارجی هیچ ردیفی برنگرداند — یعنی خودِ چک خراب است، نه اینکه انحرافی نیست."
  echo "  prisma-db: $(wc -l < /tmp/_drift_fk_prisma.txt) ردیف · prod-db: $(wc -l < /tmp/_drift_fk_prod.txt) ردیف"
  exit 1
fi

BASELINE="$TOOLS_DIR/schema-drift-fk-baseline.txt"
LC_ALL=C comm -23 /tmp/_drift_fk_prisma.txt /tmp/_drift_fk_prod.txt > /tmp/_drift_fk_diff.txt
if [ -f "$BASELINE" ]; then
  grep -v '^#' "$BASELINE" | grep -v '^[[:space:]]*$' | LC_ALL=C sort > /tmp/_drift_fk_base.txt
else
  : > /tmp/_drift_fk_base.txt
fi
FK_NEW=$(LC_ALL=C comm -23 /tmp/_drift_fk_diff.txt /tmp/_drift_fk_base.txt)
FK_GONE=$(LC_ALL=C comm -13 /tmp/_drift_fk_diff.txt /tmp/_drift_fk_base.txt)

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

if [ -n "$FK_NEW" ]; then
  echo ""
  echo "✗ انحرافِ **تازه**ی کنشِ کلیدِ خارجی — این‌ها در baseline نیستند."
  echo "  ستون‌ها یکی‌اند پس تست‌ها سبز می‌مانند، ولی رفتارِ حذف/به‌روزرسانی در تولید فرق می‌کند."
  echo "  (upd/del:  a=NO ACTION · r=RESTRICT · c=CASCADE · n=SET NULL · d=SET DEFAULT)"
  echo ""
  echo "  Prisma این را می‌خواهد:"
  echo "$FK_NEW" | sed 's/^/    /'
  echo ""
  echo "  تولید این را می‌سازد:"
  echo "$FK_NEW" | while IFS= read -r line; do
    key=$(printf '%s' "$line" | sed 's/  upd=.*//')
    match=$(LC_ALL=C grep -F "$key  upd=" /tmp/_drift_fk_prod.txt || true)
    if [ -n "$match" ]; then printf '    %s\n' "$match"; else printf '    (اصلاً وجود ندارد)  %s\n' "$key"; fi
  done
  echo ""
  echo "  رفع: یک مهاجرتِ SQL جدید در api/prisma/sql/NNN-*.sql بنویس که همان بندهای"
  echo "  ON UPDATE/ON DELETE را اعمال کند (فایلِ قبلی را ویرایش نکن)."
  echo "  اگر این اختلاف عمدی است، خطش را با توضیح به tools/schema-drift-fk-baseline.txt اضافه کن."
  exit 1
fi

if [ -n "$FK_GONE" ]; then
  echo ""
  echo "ℹ baseline کهنه شده — این خطوط دیگر انحراف نیستند و باید از"
  echo "  tools/schema-drift-fk-baseline.txt حذف شوند (بدهی کم شده، تبریک):"
  echo "$FK_GONE" | sed 's/^/    /'
fi

echo "✓ بدونِ انحراف — تولید هرچه Prisma لازم دارد را دارد ($(wc -l < /tmp/_drift_prisma.txt) ستون، $(wc -l < /tmp/_drift_fk_prisma.txt) کلیدِ خارجی، $(wc -l < /tmp/_drift_fk_base.txt) موردِ baseline)"
