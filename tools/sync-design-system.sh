#!/bin/sh
# sync-design-system.sh — تنها منبعِ حقیقتِ دیزاین‌سیستم = shared/؛ این اسکریپت
# آن را به هر سه اپ کپی می‌کند تا drift حذف شود (بدونِ bundler/build).
#
# چرا کپی و نه import: هر اپ یک پروژه‌ی استاتیکِ جداگانه‌ی Vercel با root جدا و
# بدونِ build است؛ فایل‌ها باید فیزیکی داخلِ هر اپ باشند تا سرو شوند.
#
# چه چیزی sync می‌شود (از shared/):
#   css/tokens.css      → پایه‌ی مشترکِ توکن‌ها (شاملِ @font-face ِ Vazirmatn)
#   css/foundation.css  → یکسان در هر سه اپ
#   css/ds-bridge.css   → یکسان در هر سه اپ
#   fonts/*.woff2       → فونتِ self-hosted؛ tokens.css با ../fonts/ صدایش می‌زند
#   js/icons.js         → customer نسخه‌ی ESM (عیناً)؛ business/company نسخه‌ی
#                         global (چون با <script> کلاسیک لود می‌شوند و export مجاز نیست)
#
#   content/site-content.json → محتوای پیش‌فرضِ وب‌سایتِ عمومی؛ به دو مصرف‌کننده
#                         کپی می‌شود: apps/landing (حالتِ امن وقتی API در دسترس
#                         نیست) و api/prisma/seed (نصبِ تازه). هر دو باید فایل
#                         را داخلِ ریشه‌ی خودشان داشته باشند چون جدا دیپلوی
#                         می‌شوند (Vercel با root=apps/landing، و ایمیجِ داکرِ api).
#
# چه چیزی sync نمی‌شود (app-owned):
#   css/theme.css       → تمِ مخصوصِ هر اپ (بعد از tokens.css لود می‌شود)
#   css/app.css, css/panel.css → استایلِ خاصِ هر اپ
#
# حالت --check (برای CI): چیزی نمی‌نویسد؛ اگر کپی‌ها با منبع فرق داشتند exit 1.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/shared"
CHECK=0
[ "$1" = "--check" ] && CHECK=1

ESM_APPS="customer"
GLOBAL_APPS="business company"
CSS_FILES="tokens.css foundation.css ds-bridge.css fonts.css"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# نسخه‌ی global از icons.js (export را برمی‌دارد؛ برای <script> کلاسیک).
# strip_exports <file> — کلمه‌ی کلیدیِ `export` را از اعلان‌های سطحِ بالا برمی‌دارد
# تا فایل به‌عنوانِ <script> کلاسیک پارس شود. عمداً **عام** است، نه فهرستِ نام‌ها:
# ⚠️ نسخه‌ی قبلی هر نام را جدا sed می‌کرد (`s/^export function esc(/.../`). وقتی
# PR #77 تابعِ سومِ `jsq` را به shared/js/format.js اضافه کرد، هیچ الگویی با آن
# نخواند و `export function jsq(` عیناً در apps/business|company/js/format.js کپی
# شد → کلِ فایل با `SyntaxError: Unexpected token 'export'` می‌مرد و `fa`/`esc`/
# `jsq` هر سه undefined می‌شدند. گارد پایین‌تر (assert_no_export) دومین لایه است.
strip_exports() {
  sed -E 's/^export[[:space:]]+(default[[:space:]]+)?(async[[:space:]]+)?(function|class|const|let|var)[[:space:]]/\2\3 /' "$1"
}

# assert_no_export <file> — گاردِ اجباری: هیچ خروجیِ globalی نباید `export` داشته باشد.
assert_no_export() {
  if grep -nE '^[[:space:]]*export[[:space:]]' "$1" >/dev/null 2>&1; then
    echo "✗ خطای مرگبار: در خروجیِ globalِ $1 هنوز \`export\` هست — این فایل با <script> کلاسیک پارس نمی‌شود:" >&2
    grep -nE '^[[:space:]]*export[[:space:]]' "$1" >&2
    exit 1
  fi
}

make_global_icons() {
  # ICON_NAMES موردِ خاص است (به‌جای const باید روی window بنشیند)؛ باقی از
  # strip_exports عبور می‌کند تا exportِ تازه بی‌صدا رد نشود (بخشِ strip_exports).
  sed \
    -e 's/^export const ICON_NAMES = Object\.keys(PATHS);/if (typeof window !== "undefined") window.ICON_NAMES = Object.keys(PATHS);/' \
    "$SRC/js/icons.js" | strip_exports /dev/stdin
}

# analytics پنل‌ها: از shared/js/analytics.panel.js با جای‌گذاریِ ثابت‌های per-app.
# منطقِ تله‌متری تک‌منبع می‌شود؛ فقط ۵ مقدارِ خاصِ هر اپ (label/load-hint/SOURCE/
# SID_KEY/Q_KEY) جای‌گذاری می‌شود. customer نسخه‌ی ESMِ جدا دارد (اینجا نمی‌آید).
# نکته: business/company e2e ندارند؛ برای همین خروجی باید byte-identical با فایلِ
# فعلی باشد (drift-check + cmp) تا هیچ تغییرِ رفتاری رخ ندهد.
# نسخه‌ی global از api-core.js (export را برمی‌دارد + روی window می‌گذارد؛ برای <script> کلاسیک).
make_global_apicore() {
  strip_exports "$SRC/js/api-core.js"
  printf '\nif (typeof window !== "undefined") { window.httpJson = httpJson; window.resolveApiBase = resolveApiBase; window.genIdempotencyKey = genIdempotencyKey; window.isOfflineDemo = isOfflineDemo; window.refreshAccessToken = refreshAccessToken; }\n'
}

# نسخه‌ی global از format.js (export را برمی‌دارد؛ برای <script> کلاسیک — توابعِ
# سطحِ بالا خودبه‌خود global می‌شوند). فقط پنل‌ها؛ customer از این استفاده نمی‌کند.
make_global_format() {
  strip_exports "$SRC/js/format.js"
}

make_panel_analytics() { # $1=label $2=load-hint $3=source $4=sid-key $5=q-key
  sed \
    -e "s|__LABEL__|$1|" \
    -e "s|__LOAD_HINT__|$2|" \
    -e "s|__SOURCE__|$3|" \
    -e "s|__SID_KEY__|$4|" \
    -e "s|__Q_KEY__|$5|" \
    "$SRC/js/analytics.panel.js"
}

# staging: خروجیِ موردِانتظار را در TMP می‌سازیم، سپس یا کپی یا مقایسه می‌کنیم.
diffcount=0
place() { # place <generated-file> <dest>
  gen="$1"; dest="$2"
  if [ "$CHECK" = "1" ]; then
    if ! cmp -s "$gen" "$dest"; then
      echo "✗ drift: $dest (با منبعِ shared/ نمی‌خواند)"
      diffcount=$((diffcount+1))
    fi
  else
    cp "$gen" "$dest"
    echo "  → $dest"
  fi
}

for app in $ESM_APPS $GLOBAL_APPS; do
  for f in $CSS_FILES; do
    place "$SRC/css/$f" "$ROOT/apps/$app/css/$f"
  done
done

# ── فایلِ فونت (self-host) ──
# ⚠️ چرا: پیش از این هر سه پنل فونت را از fonts.googleapis.com می‌گرفتند، پس
# بسته‌ی آفلاین (file://) **هیچ فونتِ فارسی نداشت**. حالا فایلِ variable در
# مخزن است و به هر اپ کپی می‌شود. مجوز: SIL OFL 1.1.
for app in $ESM_APPS $GLOBAL_APPS; do
  mkdir -p "$ROOT/apps/$app/fonts"
  for f in "$SRC"/fonts/*.woff2 "$SRC"/fonts/*.txt; do
    [ -e "$f" ] || continue
    place "$f" "$ROOT/apps/$app/fonts/$(basename "$f")"
  done
done

# icons.js — ESM برای customer، global برای پنل‌ها
for app in $ESM_APPS; do
  place "$SRC/js/icons.js" "$ROOT/apps/$app/js/icons.js"
done

# api-core.js (هسته‌ی transport) — customer نسخه‌ی ESM؛ پنل‌ها نسخه‌ی global.
place "$SRC/js/api-core.js" "$ROOT/apps/customer/js/api-core.js"
make_global_apicore > "$TMP/api-core.global.js"
assert_no_export "$TMP/api-core.global.js"
for app in $GLOBAL_APPS; do
  place "$TMP/api-core.global.js" "$ROOT/apps/$app/js/api-core.js"
done
make_global_icons > "$TMP/icons.global.js"
assert_no_export "$TMP/icons.global.js"
for app in $GLOBAL_APPS; do
  place "$TMP/icons.global.js" "$ROOT/apps/$app/js/icons.js"
done

# format.js (fa/esc) — فقط پنل‌ها نسخه‌ی global (customer عمداً مستثنا).
make_global_format > "$TMP/format.global.js"
assert_no_export "$TMP/format.global.js"
for app in $GLOBAL_APPS; do
  place "$TMP/format.global.js" "$ROOT/apps/$app/js/format.js"
done

# analytics.js پنل‌ها (business/company) — از منبعِ واحدِ shared/js/analytics.panel.js
# محتوای پیش‌فرضِ وب‌سایتِ عمومی — عیناً (بدونِ تبدیل) به هر دو مصرف‌کننده.
place "$SRC/content/site-content.json" "$ROOT/apps/landing/content/site-content.json"
place "$SRC/content/site-content.json" "$ROOT/api/prisma/seed/site-content.json"

make_panel_analytics "پنل کسب‌وکار" "data.js (کلاینتِ API)" "business" "rz_sid_biz" "rz_evq_biz" > "$TMP/analytics.business.js"
place "$TMP/analytics.business.js" "$ROOT/apps/business/js/analytics.js"
make_panel_analytics "پنل کمپانی" "api.js" "company" "rz_sid_co" "rz_evq_co" > "$TMP/analytics.company.js"
place "$TMP/analytics.company.js" "$ROOT/apps/company/js/analytics.js"

if [ "$CHECK" = "1" ]; then
  if [ "$diffcount" -gt 0 ]; then
    echo "✗ دیزاین‌سیستم هماهنگ نیست ($diffcount فایل). اجرا کن: sh tools/sync-design-system.sh"
    exit 1
  fi
  echo "✓ دیزاین‌سیستم با shared/ هماهنگ است"
else
  echo "✓ sync انجام شد (منبع: shared/)"
fi
