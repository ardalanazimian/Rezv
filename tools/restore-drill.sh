#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════
#  درِیلِ بازیابی — dump → restore روی DBِ خالی → مقایسه‌ی شمارشِ ردیف‌ها
#
#  چرا این اسکریپت وجود دارد (دستورِ خودمختاریِ v2، بندِ A1):
#  «بک‌آپی که هرگز restore نشده بک‌آپ نیست.» عملیاتِ مخرب فقط وقتی مجاز است
#  که این درِیل در ۲۴ ساعتِ گذشته روی همان دامنه‌ی داده اجرا شده باشد.
#  این اسکریپت درِیل را **اجرا** می‌کند و شواهدش را می‌نویسد؛ اجازه‌دادن کارِ
#  tools/gate-destructive.mjs است. دو کار عمداً از هم جدا شده‌اند تا کسی که
#  درِیل را اجرا می‌کند نتواند نتیجه‌اش را هم تفسیر کند.
#
#  اجرا:
#    sh tools/restore-drill.sh <container> <user> <source_db> [scope_label]
#  مثال:
#    sh tools/restore-drill.sh rezv-test-pg test rezervno_verify local/rezervno_verify
#
#  خروجی: audit/drills/restore-drill-<utc>.json  ·  کدِ خروج ۰ فقط اگر
#  restore واقعاً کار کرده باشد و diffِ شمارشِ ردیف‌ها صفر باشد.
#
#  ⚠️ صداقتِ دامنه: `scope` دقیقاً همان چیزی است که درِیل شده. یک درِیلِ محلی
#     هرگز مجوزِ حذف روی تولید نمی‌دهد — گیت دامنه را تطبیق می‌دهد، نه اینکه
#     صرفاً «یک درِیلِ تازه» ببیند.
# ═══════════════════════════════════════════════════════════════════════
set -eu

CONTAINER="${1:?container name required}"
PGUSER="${2:?postgres user required}"
SRC_DB="${3:?source database required}"
SCOPE="${4:-$CONTAINER/$SRC_DB}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="audit/drills"
DUMP_DIR="${DRILL_DUMP_DIR:-$OUT_DIR/dumps}"
REC="$OUT_DIR/restore-drill-$TS.json"
DUMP="$DUMP_DIR/$SRC_DB-$TS.dump"
# ⚠️ lowercase اجباری: Postgres شناسه‌ی بدونِ کوتیشن را case-fold می‌کند، پس
# `CREATE DATABASE drill_restore_...T0407Z` در واقع `...t0407z` می‌سازد و اتصالِ
# بعدی با نامِ اصلی «does not exist» می‌دهد. نتیجه‌اش یک درِیلِ همیشه‌قرمز بود که
# دو بار به‌عنوانِ «restore خراب است» خوانده شد.
TARGET_DB="drill_restore_$(printf '%s' "$TS" | tr 'A-Z' 'a-z')"

mkdir -p "$OUT_DIR" "$DUMP_DIR"

fail() {
  printf '%s\n' "درِیل شکست خورد: $1" >&2
  # رکورد را با کدِ شکست بنویس — یک درِیلِ شکست‌خورده هم شاهد است و نباید ناپدید شود
  cat > "$REC" <<JSON
{
  "scope": "$SCOPE",
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "exit_code": 1,
  "failure": "$1",
  "tables_compared": 0,
  "row_count_diff": null,
  "off_host": { "verified": false }
}
JSON
  exit 1
}

# ── ۱) dump ────────────────────────────────────────────────────────────
# ⚠️ درونِ کانتینر می‌نویسیم و بعد docker cp — نه `docker exec ... > file`.
# در اجرای اول همین کار را کردیم و dumpِ باینری در مسیرِ stdoutِ git-bash خراب
# شد؛ pg_restore شکست خورد و هر ۷۳ جدول اختلاف داد. درِیل درست قرمز شد.
_IN="/tmp/drill-$TS.dump"
docker exec "$CONTAINER" sh -c "pg_dump -U '$PGUSER' -d '$SRC_DB' -Fc -f '$_IN'" 2>/dev/null \
  || fail "pg_dump نشد"
docker cp "$CONTAINER:$_IN" "$DUMP" >/dev/null 2>&1 || fail "docker cp از کانتینر نشد"
[ -s "$DUMP" ] || fail "فایلِ dump خالی است"

# ── ۲) restore روی یک DBِ کاملاً خالی ─────────────────────────────────
docker exec "$CONTAINER" psql -U "$PGUSER" -d postgres -c "CREATE DATABASE $TARGET_DB;" >/dev/null 2>&1 \
  || fail "ساختِ DBِ مقصد نشد"
docker exec "$CONTAINER" sh -c "pg_restore -U '$PGUSER' -d '$TARGET_DB' --no-owner --no-privileges '$_IN'" >/dev/null 2>&1 \
  || printf 'هشدار: pg_restore کدِ غیرِصفر داد؛ مقایسه‌ی ردیف‌ها داور است\n' >&2

# ── ۳) مقایسه‌ی شمارشِ ردیف‌ها، جدول‌به‌جدول ──────────────────────────
# ⚠️ شمارشِ **دقیق**، نه n_live_tup. آن یک تخمینِ وابسته به ANALYZE است و روی
# DBِ تازه‌restoreشده می‌تواند صفر باشد — یعنی درِیلی که با تخمین مقایسه کند هم
# مثبتِ کاذب می‌دهد هم منفیِ کاذب.
COUNT_SQL="SELECT c.relname || ' ' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname"
docker exec "$CONTAINER" psql -U "$PGUSER" -d "$SRC_DB"   -tAc "$COUNT_SQL" 2>/dev/null | tr -d '\r' | sed '/^$/d' > "$OUT_DIR/.src.$TS"
docker exec "$CONTAINER" psql -U "$PGUSER" -d "$TARGET_DB" -tAc "$COUNT_SQL" 2>/dev/null | tr -d '\r' | sed '/^$/d' > "$OUT_DIR/.dst.$TS"

SRC_TABLES=$(wc -l < "$OUT_DIR/.src.$TS" | tr -d ' ')
DIFF_LINES=$(diff "$OUT_DIR/.src.$TS" "$OUT_DIR/.dst.$TS" | grep -c '^[<>]' || true)

# قاعده‌ی ۵ CLAUDE.md: اگر هیچ جدولی مقایسه نشده باشد، درِیل چیزی را ثابت نکرده
[ "$SRC_TABLES" -gt 0 ] || fail "صفر جدول مقایسه شد — درِیل توخالی است"

SHA="$(sha256sum "$DUMP" | cut -d' ' -f1)"
SIZE="$(wc -c < "$DUMP" | tr -d ' ')"

# ── ۴) کپیِ خارج از هاست ──────────────────────────────────────────────
# «خارج از هاست» یعنی بیرونِ همان جایی که دیتابیس زندگی می‌کند. برای درِیلِ
# محلی این یعنی بیرونِ کانتینر (روی فایل‌سیستمِ میزبان). برای تولید باید یک
# مقصدِ واقعاً جدا باشد؛ رکورد صریح می‌گوید کدام‌یک بوده تا کسی درِیلِ محلی را
# به‌جای اثباتِ تولید نخواند.
OFF_HOST_KIND="${DRILL_OFF_HOST_KIND:-host-filesystem-outside-db-container}"
[ -f "$DUMP" ] && OFF_HOST_OK=true || OFF_HOST_OK=false

docker exec "$CONTAINER" psql -U "$PGUSER" -d postgres -c "DROP DATABASE $TARGET_DB;" >/dev/null 2>&1 || true
docker exec "$CONTAINER" rm -f "$_IN" >/dev/null 2>&1 || true
rm -f "$OUT_DIR/.src.$TS" "$OUT_DIR/.dst.$TS"

cat > "$REC" <<JSON
{
  "scope": "$SCOPE",
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "exit_code": 0,
  "source_db": "$SRC_DB",
  "restored_into": "$TARGET_DB (dropped after comparison)",
  "tables_compared": $SRC_TABLES,
  "row_count_diff": $DIFF_LINES,
  "dump": { "path": "$DUMP", "size_bytes": $SIZE, "sha256": "$SHA" },
  "off_host": { "verified": $OFF_HOST_OK, "kind": "$OFF_HOST_KIND", "path": "$DUMP" },
  "note": "یک درِیلِ محلی مجوزِ عملیاتِ مخرب روی تولید نیست — گیت دامنه را تطبیق می‌دهد."
}
JSON

if [ "$DIFF_LINES" -ne 0 ]; then
  printf 'درِیل: %s جدول مقایسه شد، %s اختلاف — رکورد نوشته شد ولی گیت رد می‌کند\n' "$SRC_TABLES" "$DIFF_LINES"
  exit 1
fi

printf 'درِیل موفق: %s جدول، اختلافِ صفر · %s\n' "$SRC_TABLES" "$REC"
