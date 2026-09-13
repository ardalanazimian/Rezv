#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════
# محیطِ تستِ محلی — هم‌ارزِ دقیقِ jobِ `test` در .github/workflows/ci.yml
#
# چرا این فایل هست: تا ۲۰۲۶-۰۹-۱۲ هیچ‌جا نوشته نبود چطور سوئیت را روی این
# ماشین اجرا کنی، و نتیجه‌اش این بود که نشست‌ها تغییرِ backend را «بی‌تست»
# تحویل می‌دادند یا یک بار محیط را دستی می‌ساختند و دفعه‌ی بعد از نو.
# یک شکستِ initِ Prisma کلِ ۱۷۰۰+ تست را cancelled می‌کند، پس «تست اجرا نشد»
# و «تست سبز بود» از بیرون شبیهِ هم به نظر می‌رسند — و این اسکریپت همان
# تفاوت را قطعی می‌کند.
#
# هیچ راز تازه‌ای اینجا نیست: هر مقدارِ زیر عیناً همان است که در
# .github/workflows/ci.yml (فایلِ عمومیِ همین ریپو) نوشته شده. برای production
# استفاده نمی‌شود و نباید بشود.
#
# استفاده:
#   sh tools/test-env-up.sh          # کانتینرها + اسکیما
#   . tools/test-env-up.sh --env     # فقط exportِ متغیرها در شلِ فعلی
#   cd api && npm test
# ═══════════════════════════════════════════════════════════════════════
set -e

PG_NAME=rezv-ci-pg
REDIS_NAME=rezv-ci-redis

# همان مقادیرِ ci.yml — jobِ `test`
export DATABASE_URL='postgresql://test:test@localhost:5432/rezervno_test'
export DATABASE_DIRECT_URL='postgresql://test:test@localhost:5432/rezervno_test'
export REDIS_URL='redis://localhost:6379'
export ALLOWED_ORIGINS='https://ci.example.invalid'
export JWT_SECRET='ci-test-secret-at-least-32-chars-long'
export JWT_REFRESH_SECRET='ci-test-refresh-secret-at-least-32-chars'

if [ "$1" = "--env" ]; then
  echo "✓ متغیرهای محیطِ تست export شدند (همان مقادیرِ ci.yml)"
  return 0 2>/dev/null || exit 0
fi

command -v docker >/dev/null 2>&1 || { echo "✗ docker نیست — بدونش این اسکریپت کاری نمی‌تواند بکند"; exit 1; }

start_one() {
  name="$1"; shift
  if [ -n "$(docker ps -q -f name="^${name}$")" ]; then
    echo "  ✓ $name از قبل بالاست"
  elif [ -n "$(docker ps -aq -f name="^${name}$")" ]; then
    echo "  →  $name وجود داشت و متوقف بود — start"
    docker start "$name" >/dev/null
  else
    echo "  →  ساختِ $name"
    docker run -d --name "$name" "$@" >/dev/null
  fi
}

echo "── کانتینرها (همان ایمیج‌های ci.yml: postgres:17 · redis:7) ──"
start_one "$PG_NAME" \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=rezervno_test \
  -p 5432:5432 postgres:17
start_one "$REDIS_NAME" -p 6379:6379 redis:7

echo "── انتظار برای آماده‌شدنِ Postgres ──"
i=0
until docker exec "$PG_NAME" pg_isready -U test -d rezervno_test >/dev/null 2>&1; do
  i=$((i+1))
  [ "$i" -gt 60 ] && { echo "✗ Postgres ظرفِ ۶۰ ثانیه آماده نشد"; exit 1; }
  sleep 1
done
echo "  ✓ pg_isready"

BASE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BASE/api"

echo "── اسکیما (همان سه دستورِ ci.yml) ──"
npx prisma db push --skip-generate
sh prisma/apply-sql.sh
# ci.yml اینجا psql دارد؛ روی این ماشین psql نصب نیست، پس همان فایل را از
# داخلِ کانتینر اجرا می‌کنیم — همان SQL، همان ترتیب.
docker exec -i "$PG_NAME" psql -U test -d rezervno_test -v ON_ERROR_STOP=1 -f - < prisma/test-schema-fixups.sql >/dev/null
docker exec -i "$PG_NAME" psql -U test -d rezervno_test \
  -c "ALTER SYSTEM SET log_min_error_statement='panic';" -c "SELECT pg_reload_conf();" >/dev/null

echo ""
echo "✓ محیط آماده است. حالا:"
echo "    . tools/test-env-up.sh --env && cd api && npm test"
