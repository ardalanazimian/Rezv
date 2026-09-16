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

# ═══════════════════════════════════════════════════════════════════════
#  پیش‌نیازها — قبل از هر کاری بررسی کن، وگرنه شکست بی‌نام می‌شود
#
#  ⚠️ چرا این بخش لازم است: بدونِ preflight، اولین خطی که پایین‌تر psql صدا
#  می‌زند روی ماشینی بدونِ psql با کدِ خامِ شلِ ۱۲۷ («psql: command not
#  found») می‌میرد. آن ۱۲۷ از دیدِ خواننده از «انحرافِ واقعی پیدا شد»
#  قابلِ‌تشخیص نیست — کسی می‌تواند یک بعدازظهر دنبالِ انحرافی بگردد که اصلاً
#  وجود ندارد، یا بدتر، لاگ را skim کند و فرض کند سبز بوده.
#
#  طرحِ کدِ خروج (عمداً سه‌تا، تا ابزارِ خودکار بدونِ پارسِ متن تشخیص بدهد):
#    ۰ = بدونِ انحراف                (بدونِ تغییر نسبت به قبل)
#    ۱ = انحرافِ واقعی پیدا شد         (بدونِ تغییر نسبت به قبل — همه‌ی exit 1های زیر)
#    ۲ = «did NOT run»: این گیت اصلاً اجرا نشد — پیش‌نیازِ غایب/خراب (تازه)
#  هر سه غیرِ صفر جز ۰ درست عمل می‌کنند: .github/workflows/ci.yml:۱۷۴ فقط
#  «صفر/غیرِصفر» را می‌بیند و رویِ عددِ دقیقِ کدِ خروج شاخه نمی‌زند، پس این
#  تفکیک چیزی را که امروز به آن تکیه شده نمی‌شکند.
#
#  فقط `command -v` کافی نیست: رویِ این مخزن یک بیلدِ psql پیدا شد که
#  آرگومان‌های بعد از URL را بی‌صدا نادیده می‌گیرد (getoptِ بدونِ permutation) —
#  یعنی همین الگویِ `psql "$URL" -c "..."` که این فایل همه‌جا استفاده می‌کند
#  با کدِ خروجِ ۰ هیچ کاری نمی‌کند و بی‌سروصدا رشته‌ی خالی برمی‌گرداند. برایِ
#  همین preflight فقط بودنِ باینری را نمی‌بیند؛ یک کوئریِ واقعی می‌زند و
#  **مقدارِ برگشتی** را هم بررسی می‌کند، نه فقط کدِ خروج.
# ═══════════════════════════════════════════════════════════════════════
GATE_DID_NOT_RUN=2

fail_preflight() {
  echo "" >&2
  echo "⛔ required dependency missing — the gate did NOT run (این «انحراف» نیست)" >&2
  echo "   دلیل: $1" >&2
  echo "   کدِ خروج: $GATE_DID_NOT_RUN  — متمایز از ۰ (بدونِ انحراف) و ۱ (انحرافِ واقعی)" >&2
  exit "$GATE_DID_NOT_RUN"
}

for _bin in psql npx sort comm grep sed wc; do
  command -v "$_bin" >/dev/null 2>&1 || fail_preflight "دستورِ «$_bin» روی PATH نیست"
done

_PROBE="$(psql "$ADMIN_URL" -X -q -t -A -c 'SELECT 424242;' 2>&1)" \
  || fail_preflight "اتصال با psql به ADMIN_URL ($ADMIN_URL) شکست خورد:
$_PROBE"
if [ "$(printf '%s' "$_PROBE" | tr -d '[:space:]')" != "424242" ]; then
  fail_preflight "psql پاسخِ موردِ انتظار را نداد (گرفت: «$_PROBE») — یا اتصال درست نیست یا این بیلدِ psql آرگومان‌های بعدِ URL را بی‌صدا نادیده می‌گیرد"
fi
unset _PROBE _bin

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
  rm -f /tmp/_drift_idx_prisma.txt /tmp/_drift_idx_prod.txt /tmp/_drift_idx_diff.txt /tmp/_drift_idx_base.txt
  rm -f /tmp/_drift_chk_ci.txt /tmp/_drift_chk_prod.txt
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

# ⚠️ لایه‌ی سوم: **ایندکس‌ها** — با baseline.
#
# چرا اضافه شد (اندازه‌گیریِ واقعیِ ۲۰۲۶-۰۸-۲۵ روی دو Postgresِ ساخته‌شده از
# همین HEAD): دو لایه‌ی بالا (ستون‌ها و کنشِ FK) هر دو سبز بودند، در حالی که
#     مسیرِ CI (db push + apply-sql) = ۱۹۸ ایندکس
#     مسیرِ تولید (migrate deploy + apply-sql) = ۱۷۸ ایندکس
# یعنی **۲۰ ایندکسِ اعلام‌شده در schema.prisma هرگز در تولید ساخته نمی‌شدند**،
# چون `@@index` نوشته شده بود ولی مهاجرتِ SQLش نه. `db push` آن‌ها را در CI
# می‌ساخت پس همه‌ی تست‌ها سبز بودند و کوئریِ تولید Seq Scan می‌زد. (مهاجرتِ
# 066 این ۲۰ مورد را ساخت؛ اختلاف حالا ۱۹۸=۱۹۸ است.)
#
# مقایسه عمداً **بدونِ نامِ ایندکس** است — دو مسیر همان ایندکس را با نام‌های
# متفاوت می‌سازند. امضا = جدول + فهرستِ ستون/عبارت + یکتایی + شرطِ partial.
# امضا: بندِ UNIQUE نگه داشته می‌شود، نامِ ایندکس حذف.
IDXQ="SELECT CASE WHEN indexdef LIKE 'CREATE UNIQUE%' THEN 'UNIQUE ' ELSE '' END
             || regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX [^ ]+ ON ', '')
      FROM pg_indexes
      WHERE schemaname='public' AND tablename <> '_prisma_migrations'"

psql "$BASE/$PRISMA_DB" -Atc "$IDXQ" | LC_ALL=C sort -u > /tmp/_drift_idx_prisma.txt
psql "$BASE/$PROD_DB"   -Atc "$IDXQ" | LC_ALL=C sort -u > /tmp/_drift_idx_prod.txt

# همان گاردِ ضدِ «سبزِ توخالی»: مخزنِ سالم ده‌ها ایندکس دارد؛ صفر یعنی خرابیِ ابزار.
if [ ! -s /tmp/_drift_idx_prisma.txt ] || [ ! -s /tmp/_drift_idx_prod.txt ]; then
  echo ""
  echo "✗ کوئریِ ایندکس‌ها هیچ ردیفی برنگرداند — یعنی خودِ چک خراب است، نه اینکه انحرافی نیست."
  echo "  prisma-db: $(wc -l < /tmp/_drift_idx_prisma.txt) ردیف · prod-db: $(wc -l < /tmp/_drift_idx_prod.txt) ردیف"
  exit 1
fi

IDX_BASELINE="$TOOLS_DIR/schema-drift-index-baseline.txt"
LC_ALL=C comm -23 /tmp/_drift_idx_prisma.txt /tmp/_drift_idx_prod.txt > /tmp/_drift_idx_diff.txt
if [ -f "$IDX_BASELINE" ]; then
  grep -v '^#' "$IDX_BASELINE" | grep -v '^[[:space:]]*$' | LC_ALL=C sort -u > /tmp/_drift_idx_base.txt
else
  : > /tmp/_drift_idx_base.txt
fi
IDX_NEW=$(LC_ALL=C comm -23 /tmp/_drift_idx_diff.txt /tmp/_drift_idx_base.txt)
IDX_GONE=$(LC_ALL=C comm -13 /tmp/_drift_idx_diff.txt /tmp/_drift_idx_base.txt)

# ⚠️ لایه‌ی چهارم: **قیدهای CHECK** — و مقایسه‌اش عمداً بینِ دو دیتابیسِ
# دیگر است تا سه لایه‌ی بالا. این را بخوان وگرنه عدد را اشتباه می‌خوانی.
#
# سه لایه‌ی بالا می‌پرسند «آیا تولید هرچه Prisma لازم دارد را دارد؟» و
# برای همین `$PRISMA_DB` را فقط با `db push` می‌سازند. روی محورِ CHECK
# آن مقایسه بی‌معناست: Prisma قیدِ CHECK را **اصلاً بیان نمی‌کند**، پس
# `db push` به‌تنهایی صفر قید می‌سازد و هر ۱۳ قید «گم‌شده» به نظر می‌رسند.
#
# ⚠️ این فرضیه‌ی اشتباه واقعاً نوشته شد (۲۰۲۶-۰۹-۱۰) و همین گاردِ
# «صفر یعنی ابزار خراب است» دو خط پایین‌تر جلویش را گرفت. بدونِ آن،
# این لایه ۱۳ قید را «گم‌شده در CI» گزارش می‌کرد، در حالی که عددِ واقعی ۴
# است — سه برابر بزرگ‌تر، و در جهتی که خودرا جدی نشان می‌دهد.
#
# پس جفتِ درست این است:
#     دیتابیسِ تستِ CI   = db push + apply-sql        (عیناً ci.yml:120-124)
#     دیتابیسِ تولید    = migrate deploy + apply-sql
# و برای ساختنِ اولی، `$PRISMA_DB` را همین‌جا با apply-sql جلو می‌بریم.
# این امن است چون هر سه لایه‌ی بالا خروجی‌شان را از قبل در فایل ریخته‌اند.
#
# چرا این لایه لازم شد (اندازه‌گیریِ واقعی روی دو دیتابیس از همین HEAD):
#     مسیرِ CI     =  ۹ قیدِ CHECK
#     مسیرِ تولید =  ۱۳ قیدِ CHECK
# چهار قیدِ نمره‌ی `reviews` در تولید بودند و در CI نه. سازوکار:
# ۶۱ جدول در مهاجرت‌ها با `CREATE TABLE IF NOT EXISTS` ساخته می‌شوند و
# هر ۶۱ در `schema.prisma` هم اعلام شده‌اند — پس در مسیرِ CI، `db push`
# جدول را جلوتر می‌سازد و آن CREATE TABLE به no-op تبدیل می‌شود؛ هر قیدِ
# inlineی که درونِ آن نوشته شده باشد بی‌صدا از دست می‌رود.
# ستون‌ها یکی‌اند، FKها یکی‌اند، ایندکس‌ها یکی‌اند. فقط قید گم می‌شود.
#
# ⚠️ جهتِ خطر اینجا **وارونه‌ی** سه لایه‌ی بالاست و همین بدترش می‌کند:
# آنجا تولید چیزی را کم دارد و در زمانِ اجرا می‌شکند. اینجا تولید
# **سخت‌گیرتر** است — یعنی کدی که قید را بشکند تمامِ تست‌ها را سبز رد
# می‌کند و فقط در تولید با ۲۳۵۱۴ می‌میرد.
#
# مقایسه عمداً **بدونِ نامِ constraint** است (مثلِ لایه‌های FK و ایندکس) و
# `sort` بدونِ `-u` است، چون دو قیدِ یکسان روی یک جدول خودش سیگنال است.
#
# بدونِ baseline نوشته شد و این عمدی است: پس از مهاجرتِ ۰۸۴ اختلاف در
# هر دو جهت صفر است، و قاعده‌ی منشور می‌گوید allowlistی که لازم نیست
# نباید ساخته شود.
echo "→ رساندنِ دیتابیسِ Prisma به شکلِ دیتابیسِ تستِ CI (apply-sql)..."
DATABASE_URL="$BASE/$PRISMA_DB" DATABASE_DIRECT_URL="$BASE/$PRISMA_DB" \
  sh prisma/apply-sql.sh >/dev/null 2>&1

CHKQ="SELECT c.conrelid::regclass::text || ' | ' || pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      WHERE c.contype = 'c' AND c.connamespace = 'public'::regnamespace"

psql "$BASE/$PRISMA_DB" -Atc "$CHKQ" | LC_ALL=C sort > /tmp/_drift_chk_ci.txt
psql "$BASE/$PROD_DB"   -Atc "$CHKQ" | LC_ALL=C sort > /tmp/_drift_chk_prod.txt

# همان گاردِ ضدِ «سبزِ توخالی» — و این‌بار واقعاً یک خطای طراحی را گرفت
# (بالا را بخوان). این مخزن امروز ۱۳ قیدِ CHECK دارد؛ صفر یعنی کوئری
# یا apply-sql خراب شده، نه اینکه قیدی نیست.
if [ ! -s /tmp/_drift_chk_ci.txt ] || [ ! -s /tmp/_drift_chk_prod.txt ]; then
  echo ""
  echo "✗ کوئریِ قیدهای CHECK هیچ ردیفی برنگرداند — یعنی خودِ چک خراب است، نه اینکه انحرافی نیست."
  echo "  ci-db: $(wc -l < /tmp/_drift_chk_ci.txt) ردیف · prod-db: $(wc -l < /tmp/_drift_chk_prod.txt) ردیف"
  exit 1
fi

CHK_ONLY_PROD=$(LC_ALL=C comm -13 /tmp/_drift_chk_ci.txt /tmp/_drift_chk_prod.txt)
CHK_ONLY_CI=$(LC_ALL=C comm -23 /tmp/_drift_chk_ci.txt /tmp/_drift_chk_prod.txt)

# ⚠️ لایه‌ی پنجم: **دفترِ امتیاز — FK روی RESTRICT و هر سه تریگرِ ۰۸۹**
#
# چرا اینجا و نه یک اسکریپتِ تازه (بندِ ۵ی FP-009، ۲۰۲۶-۰۹-۱۶): این اسکریپت
# از قبل psql و **هر دو شکلِ دیتابیس** را دارد؛ هر گاردِ جدا باید همان را از نو
# بسازد.
#
# چه چیزی را نگه می‌دارد: Red Team نشان داد تضمینِ «امتیاز هرگز منقضی نمی‌شود»
# با **یک خط** بی‌صدا برمی‌گردد — `FK: RESTRICT → CASCADE`. کسی که روزی
# «حذفِ کاربر خراب است» را رفع می‌کند دقیقاً همین خط را می‌نویسد و فکر می‌کند
# دارد یک باگ را می‌بندد، نه اینکه دفترِ مالی را باز می‌کند. با CASCADE،
# `DELETE FROM users …` ردیف‌های دفتر را می‌برد و **هیچ تریگری شلیک نمی‌کند**
# (پروبِ Red Team: `DELETE 1` و `ledger_rows_left = 0`).
#
# ⚠️ مقایسه‌ی نامی نیست و عمداً: نامِ constraint بینِ دو مسیر فرق می‌کند (همان
# دلیلی که لایه‌ی FK بالا نام را حذف کرد). محور روی **رابطه + ستون** می‌ایستد.
#
# ⚠️ تریگرها با **نام** سنجیده نمی‌شوند بلکه با **کلاسِ رفتاری**: BEFORE UPDATE
# (ردیفی)، BEFORE DELETE (ردیفی) و BEFORE TRUNCATE (سطحِ statement). دلیل:
# نامِ تریگر سلیقه است و تغییرش گارد را بی‌صدا می‌کند، ولی کلاسِ رفتاری همان
# چیزی است که تصمیم وعده‌اش را داده. `tgenabled` هم سنجیده می‌شود، چون تریگرِ
# `DISABLE`شده در pg_trigger هست و از یک چکِ «وجود دارد؟» سالم رد می‌شود.
#
# ⚠️ آنچه این محور **نمی‌سنجد**: درِ SUPERUSER
# (`SET session_replication_role = replica` همه‌ی تریگرها را خاموش می‌کند) —
# آن `P0-022` است و اینجا بسته نمی‌شود؛ گاردِ ایستای
# tools/check-session-replication-role.mjs فقط مسیرِ کدِ اپ را می‌بندد.
LEDGER_FKQ="SELECT c.confdeltype::text
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.contype = 'f'
         AND c.conrelid = 'points_ledger'::regclass
         AND a.attname = 'user_id'"

# ۱=BEFORE ردیفی · ۲=BEFORE · ۸=DELETE · ۱۶=UPDATE · ۳۲=TRUNCATE (pg_trigger.tgtype)
LEDGER_TRGQ="SELECT
         count(*) FILTER (WHERE (t.tgtype & 2) > 0 AND (t.tgtype & 16) > 0 AND (t.tgtype & 1) > 0)::text
      || ' ' || count(*) FILTER (WHERE (t.tgtype & 2) > 0 AND (t.tgtype &  8) > 0 AND (t.tgtype & 1) > 0)::text
      || ' ' || count(*) FILTER (WHERE (t.tgtype & 2) > 0 AND (t.tgtype & 32) > 0)::text
       FROM pg_trigger t
       WHERE t.tgrelid = 'points_ledger'::regclass
         AND NOT t.tgisinternal
         AND t.tgenabled = 'O'"

LEDGER_FAIL=''
for _db in "$PROD_DB" "$PRISMA_DB"; do
  _shape='تولید (migrate deploy + apply-sql)'
  [ "$_db" = "$PRISMA_DB" ] && _shape='دیتابیسِ تستِ CI (db push + apply-sql)'

  _del="$(psql "$BASE/$_db" -Atc "$LEDGER_FKQ" | tr -d '[:space:]')"
  if [ -z "$_del" ]; then
    # صفرِ توخالی: یا جدول/ستون نیست یا کوئری شکسته — هیچ‌کدام «سالم» نیست.
    LEDGER_FAIL="${LEDGER_FAIL}
    [$_shape] کلیدِ خارجیِ points_ledger.user_id اصلاً پیدا نشد — خودِ چک خراب است یا جدول رفته."
  elif [ "$_del" != "r" ]; then
    LEDGER_FAIL="${LEDGER_FAIL}
    [$_shape] ON DELETE روی points_ledger.user_id باید RESTRICT ('r') باشد، هست: '$_del'  (a=NO ACTION · c=CASCADE · n=SET NULL · d=SET DEFAULT)"
  fi

  _trg="$(psql "$BASE/$_db" -Atc "$LEDGER_TRGQ")"
  _u="$(printf '%s' "$_trg" | cut -d' ' -f1)"
  _d="$(printf '%s' "$_trg" | cut -d' ' -f2)"
  _t="$(printf '%s' "$_trg" | cut -d' ' -f3)"
  [ "${_u:-0}" -ge 1 ] 2>/dev/null || LEDGER_FAIL="${LEDGER_FAIL}
    [$_shape] تریگرِ فعالِ BEFORE UPDATE (ردیفی) روی points_ledger نیست"
  [ "${_d:-0}" -ge 1 ] 2>/dev/null || LEDGER_FAIL="${LEDGER_FAIL}
    [$_shape] تریگرِ فعالِ BEFORE DELETE (ردیفی) روی points_ledger نیست"
  [ "${_t:-0}" -ge 1 ] 2>/dev/null || LEDGER_FAIL="${LEDGER_FAIL}
    [$_shape] تریگرِ فعالِ BEFORE TRUNCATE (سطحِ statement) روی points_ledger نیست"
done

if [ -n "$LEDGER_FAIL" ]; then
  echo ""
  echo "✗ نقضِ FP-009 — تضمینِ «دفترِ امتیاز تغییرناپذیر و حذف‌ناپذیر است»:"
  echo "$LEDGER_FAIL"
  echo ""
  echo "  این گارد از بندِ ۵ی FP-009 (docs/DECISIONS.md) می‌آید. اگر داری FK را"
  echo "  به CASCADE می‌بری تا «حذفِ کاربر» کار کند: آن تصمیم گرفته شده و جوابش"
  echo "  نه است — حذفِ کاربرِ دارای امتیاز عمداً ممکن نیست؛ راهِ آینده"
  echo "  ناشناس‌سازیِ ردیفِ users است، نه حذفِ ردیفِ مالی."
  echo "  اگر تریگرها نیستند: مهاجرتِ ۰۸۹ هنوز اعمال نشده — این گارد با همان"
  echo "  مهاجرت ادغام می‌شود، نه جلوتر از آن."
  exit 1
fi

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

if [ -n "$IDX_NEW" ]; then
  echo ""
  echo "✗ انحرافِ **تازه**ی ایندکس — این‌ها در schema.prisma اعلام شده‌اند (پس در CI با"
  echo "  db push ساخته می‌شوند و تست‌ها سبزند) ولی هیچ مهاجرتِ SQLی نمی‌سازدشان،"
  echo "  یعنی در تولید وجود ندارند و همان کوئری Seq Scan می‌زند:"
  echo ""
  echo "$IDX_NEW" | sed 's/^/    /'
  echo ""
  echo "  رفع: یک مهاجرتِ SQL جدید در api/prisma/sql/NNN-*.sql با **همان نامی که"
  echo "  Prisma تولید می‌کند** بنویس (وگرنه db push نسخه‌ی دومی می‌سازد)."
  echo "  اگر اختلاف عمدی است، خطش را با توضیح به tools/schema-drift-index-baseline.txt اضافه کن."
  exit 1
fi

if [ -n "$CHK_ONLY_PROD" ]; then
  echo ""
  echo "✗ انحرافِ قیدِ CHECK — تولید این‌ها را دارد و دیتابیسِ تستِ CI ندارد."
  echo "  یعنی تولید **سخت‌گیرتر** از CI است: کدی که این قید را بشکند تمامِ"
  echo "  تست‌ها را سبز رد می‌کند و فقط در تولید با ۲۳۵۱۴ می‌میرد."
  echo ""
  echo "$CHK_ONLY_PROD" | sed 's/^/    /'
  echo ""
  echo "  علتِ رایج: قید درونِ یک CREATE TABLE IF NOT EXISTS نوشته شده و آن"
  echo "  جدول در schema.prisma هم هست — پس db push جلوتر می‌سازدش و آن"
  echo "  CREATE TABLE به no-op تبدیل می‌شود."
  echo "  رفع: یک مهاجرتِ SQL جدید در api/prisma/sql/NNN-*.sql با ALTER TABLE ... ADD"
  echo "  CONSTRAINT بنویس (نه درونِ CREATE TABLE)، idempotent، و **با همان نامی"
  echo "  که Postgres در تولید خودش ساخته** — وگرنه در تولید قیدِ دوم ساخته می‌شود."
  echo "  نمونه: api/prisma/sql/084-reviews-rating-checks-ci-parity.sql"
  exit 1
fi

if [ -n "$CHK_ONLY_CI" ]; then
  echo ""
  echo "✗ انحرافِ قیدِ CHECK — دیتابیسِ تستِ CI این‌ها را دارد و تولید ندارد."
  echo "  یعنی تست‌ها روی دیتابیسی سبزند که از تولید محافظه‌کارتر است —"
  echo "  داده‌ی بد در تولید وارد می‌شود بدونِ اینکه هیچ تستی قرمز شود."
  echo ""
  echo "$CHK_ONLY_CI" | sed 's/^/    /'
  exit 1
fi

if [ -n "$IDX_GONE" ]; then
  echo ""
  echo "ℹ baselineِ ایندکس کهنه شده — این خطوط دیگر انحراف نیستند و باید از"
  echo "  tools/schema-drift-index-baseline.txt حذف شوند:"
  echo "$IDX_GONE" | sed 's/^/    /'
fi

if [ -n "$FK_GONE" ]; then
  echo ""
  echo "ℹ baseline کهنه شده — این خطوط دیگر انحراف نیستند و باید از"
  echo "  tools/schema-drift-fk-baseline.txt حذف شوند (بدهی کم شده، تبریک):"
  echo "$FK_GONE" | sed 's/^/    /'
fi

echo "✓ بدونِ انحراف + FP-009 برقرار (FK=RESTRICT، هر سه تریگرِ دفتر فعال) — تولید هرچه Prisma لازم دارد را دارد ($(wc -l < /tmp/_drift_prisma.txt) ستون، $(wc -l < /tmp/_drift_fk_prisma.txt) کلیدِ خارجی، $(wc -l < /tmp/_drift_idx_prisma.txt) ایندکس، $(wc -l < /tmp/_drift_chk_prod.txt) قیدِ CHECK · baseline: $(wc -l < /tmp/_drift_fk_base.txt) FK + $(wc -l < /tmp/_drift_idx_base.txt) ایندکس)"
