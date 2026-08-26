#!/bin/sh
# check-classic-scripts.sh — گاردِ پارسِ اسکریپت‌های کلاسیک.
#
# چرا هست (یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۵): apps/business و apps/company اسکریپتِ
# **کلاسیک**‌اند (بدونِ type="module")؛ یک `export` سرگردان کلِ فایل را با
# `SyntaxError: Unexpected token 'export'` می‌کشد و همه‌ی توابعش undefined
# می‌شوند. این دقیقاً در PR #77 رخ داد: `export function jsq` وارد
# apps/{business,company}/js/format.js شد و `fa`/`esc`/`jsq` هر سه مردند —
# یعنی هر دو پنل کاملاً از کار افتادند. **هر ۹ جابِ CI سبز ماندند** (پنل‌ها
# پوششِ E2Eِ رفتاری ندارند). این چک همان شکاف را می‌بندد.
#
# چه می‌کند: هر <script src="..."> بدونِ type="module" را با پارسرِ واقعیِ V8
# (new vm.Script) پارس می‌کند. اجرا نمی‌کند — فقط پارس؛ پس نیازی به DOM ندارد.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node - "$ROOT" <<'NODE'
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.argv[2];
const APPS = ['business', 'company'];   // اپ‌های اسکریپتِ کلاسیک (customer = ESM)
let bad = 0, n = 0;
for (const app of APPS) {
  const html = path.join(ROOT, 'apps', app, 'index.html');
  if (!fs.existsSync(html)) { console.error(`✗ ${html} پیدا نشد`); bad++; continue; }
  const src = fs.readFileSync(html, 'utf8');
  const tags = src.match(/<script\b[^>]*>/g) || [];
  const files = tags
    .filter(t => !/type\s*=\s*["']module["']/.test(t))
    .map(t => (t.match(/\bsrc\s*=\s*["']([^"']+)["']/) || [])[1])
    .filter(u => u && !/^(https?:)?\/\//.test(u));
  if (files.length === 0) { console.error(`✗ apps/${app}: هیچ <script src> کلاسیکی پیدا نشد — الگوی HTML عوض شده؟`); bad++; }
  for (const rel of files) {
    const f = path.join(ROOT, 'apps', app, rel.split('?')[0]);
    n++;
    if (!fs.existsSync(f)) { console.error(`✗ apps/${app}/${rel} → فایل وجود ندارد`); bad++; continue; }
    try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); }
    catch (e) { console.error(`✗ apps/${app}/${rel} → ${e.message}`); bad++; }
  }
}
if (n === 0) { console.error('✗ هیچ فایلی چک نشد — خودِ چک تهی است (گاردِ hollow-green)'); process.exit(1); }
if (bad) { console.error(`\n✗ ${bad} مشکل در ${n} اسکریپتِ کلاسیک.`); process.exit(1); }
console.log(`✓ هر ${n} اسکریپتِ کلاسیکِ business/company به‌درستی پارس می‌شوند`);
NODE
