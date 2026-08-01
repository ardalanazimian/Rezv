#!/bin/sh
# sync-design-system.sh — تنها منبعِ حقیقتِ دیزاین‌سیستم = shared/؛ این اسکریپت
# آن را به هر سه اپ کپی می‌کند تا drift حذف شود (بدونِ bundler/build).
#
# چرا کپی و نه import: هر اپ یک پروژه‌ی استاتیکِ جداگانه‌ی Vercel با root جدا و
# بدونِ build است؛ فایل‌ها باید فیزیکی داخلِ هر اپ باشند تا سرو شوند.
#
# چه چیزی sync می‌شود (از shared/):
#   css/tokens.css      → پایه‌ی مشترکِ توکن‌ها
#   css/foundation.css  → یکسان در هر سه اپ
#   css/ds-bridge.css   → یکسان در هر سه اپ
#   js/icons.js         → customer نسخه‌ی ESM (عیناً)؛ business/company نسخه‌ی
#                         global (چون با <script> کلاسیک لود می‌شوند و export مجاز نیست)
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
CSS_FILES="tokens.css foundation.css ds-bridge.css"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# نسخه‌ی global از icons.js (export را برمی‌دارد؛ برای <script> کلاسیک).
make_global_icons() {
  sed \
    -e 's/^export function icon(/function icon(/' \
    -e 's/^export const ICON_NAMES = Object\.keys(PATHS);/if (typeof window !== "undefined") window.ICON_NAMES = Object.keys(PATHS);/' \
    "$SRC/js/icons.js"
}

# analytics پنل‌ها: از shared/js/analytics.panel.js با جای‌گذاریِ ثابت‌های per-app.
# منطقِ تله‌متری تک‌منبع می‌شود؛ فقط ۵ مقدارِ خاصِ هر اپ (label/load-hint/SOURCE/
# SID_KEY/Q_KEY) جای‌گذاری می‌شود. customer نسخه‌ی ESMِ جدا دارد (اینجا نمی‌آید).
# نکته: business/company e2e ندارند؛ برای همین خروجی باید byte-identical با فایلِ
# فعلی باشد (drift-check + cmp) تا هیچ تغییرِ رفتاری رخ ندهد.
# نسخه‌ی global از api-core.js (export را برمی‌دارد + روی window می‌گذارد؛ برای <script> کلاسیک).
make_global_apicore() {
  sed \
    -e 's/^export async function httpJson(/async function httpJson(/' \
    -e 's/^export function resolveApiBase(/function resolveApiBase(/' \
    "$SRC/js/api-core.js"
  printf '\nif (typeof window !== "undefined") { window.httpJson = httpJson; window.resolveApiBase = resolveApiBase; }\n'
}

# نسخه‌ی global از format.js (export را برمی‌دارد؛ برای <script> کلاسیک — توابعِ
# سطحِ بالا خودبه‌خود global می‌شوند). فقط پنل‌ها؛ customer از این استفاده نمی‌کند.
make_global_format() {
  sed \
    -e 's/^export function fa(/function fa(/' \
    -e 's/^export function esc(/function esc(/' \
    "$SRC/js/format.js"
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

# icons.js — ESM برای customer، global برای پنل‌ها
for app in $ESM_APPS; do
  place "$SRC/js/icons.js" "$ROOT/apps/$app/js/icons.js"
done

# api-core.js (هسته‌ی transport) — customer نسخه‌ی ESM؛ پنل‌ها نسخه‌ی global.
place "$SRC/js/api-core.js" "$ROOT/apps/customer/js/api-core.js"
make_global_apicore > "$TMP/api-core.global.js"
for app in $GLOBAL_APPS; do
  place "$TMP/api-core.global.js" "$ROOT/apps/$app/js/api-core.js"
done
make_global_icons > "$TMP/icons.global.js"
for app in $GLOBAL_APPS; do
  place "$TMP/icons.global.js" "$ROOT/apps/$app/js/icons.js"
done

# format.js (fa/esc) — فقط پنل‌ها نسخه‌ی global (customer عمداً مستثنا).
make_global_format > "$TMP/format.global.js"
for app in $GLOBAL_APPS; do
  place "$TMP/format.global.js" "$ROOT/apps/$app/js/format.js"
done

# analytics.js پنل‌ها (business/company) — از منبعِ واحدِ shared/js/analytics.panel.js
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
