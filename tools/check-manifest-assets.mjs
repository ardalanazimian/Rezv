#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ داراییِ manifest — «هر آیکونی که وعده داده شده، واقعاً روی دیسک هست؟»
//
//  ⚠️ چرا این فایل وجود دارد:
//  `apps/customer/manifest.webmanifest` دو آیکون وعده می‌داد —
//  `/icon-192.png` و `/icon-512.png` — و **هیچ‌کدام وجود نداشتند**. نه
//  gitignore شده بودند، واقعاً نبودند. کروم برای نصب‌پذیریِ PWA هر دو اندازه
//  را لازم دارد، پس **اپِ مشتری اصلاً قابلِ نصب نبود** و تا هفته‌ی انتشار
//  زنده ماند.
//
//  چرا کسی ندید — و این نکته‌ی اصلی است:
//    • `index.html` یک faviconِ SVG دارد، پس تبِ مرورگر درست به‌نظر می‌رسید
//    • service worker این دو را precache نمی‌کرد، پس خطای دومی هم نبود
//    • buildِ standalone تگِ manifest و icon را **حذف** می‌کند، پس آن
//      آرتیفکت هم چیزی نشان نمی‌داد
//  یعنی «اپ سالم به‌نظر می‌رسید و نصب نمی‌شد». **یک قابلیتِ غایب هیچ خطایی
//  منتشر نمی‌کند** — همان دلیلی که jobهای گیرکرده‌ی صف و RLSِ بی‌اثر هم تا
//  همین هفته زنده ماندند. هر سه «چیزی که اتفاق نمی‌افتد»اند، و هیچ‌چیز در
//  سیستم شکلِ دیدنِ اتفاق‌نیفتادن را ندارد.
//
//  «فایل هست» با «PWA نصب می‌شود» یکی نیست — این گارد فقط ادعای اول را
//  می‌سنجد، و همین را هم صریح می‌گوید تا کسی سبزش را بیش از آنچه هست نخواند.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo']);

/** هر فایلِ manifest را در درخت پیدا می‌کند — بدونِ فهرستِ ثابت، تا اپِ تازه هم پوشش بگیرد. */
function findManifests(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) findManifests(full, out);
    else if (/\.webmanifest$/.test(e.name) || e.name === 'manifest.json') out.push(full);
  }
  return out;
}

const manifests = findManifests(REPO);
const fails = [];

// اگر هیچ manifestی پیدا نشد، یعنی یا مسیر عوض شده یا پیمایش شکسته —
// سکوت اینجا «همه‌چیز سالم است» را جعل می‌کند. صریح شکست بخور.
if (manifests.length === 0) {
  console.error('❌ هیچ فایلِ manifest پیدا نشد — یا مخزن جابه‌جا شده یا این گارد شکسته است.');
  console.error('   سکوت در این حالت یعنی سبزِ کاذب، پس عمداً قرمز می‌شود.');
  process.exit(1);
}

for (const m of manifests) {
  const rel = m.slice(REPO.length + 1).replace(/\\/g, '/');
  let doc;
  try {
    doc = JSON.parse(readFileSync(m, 'utf8'));
  } catch (e) {
    fails.push(`${rel} — JSON معتبر نیست: ${(e).message}`);
    continue;
  }
  const icons = Array.isArray(doc.icons) ? doc.icons : [];
  if (!icons.length) continue;

  for (const icon of icons) {
    if (!icon || typeof icon.src !== 'string') continue;
    if (/^(https?:|data:)/.test(icon.src)) continue; // منبعِ بیرونی — این گارد ادعایی درباره‌اش ندارد
    // `src` در manifest نسبت به ریشه‌ی سرو شده است؛ ریشه‌ی سرو، پوشه‌ی خودِ manifest است.
    const onDisk = resolve(dirname(m), icon.src.replace(/^\//, ''));
    if (!existsSync(onDisk)) {
      fails.push(`${rel} — آیکونِ «${icon.src}» (${icon.sizes || 'بدونِ اندازه'}) روی دیسک نیست`);
      continue;
    }
    // فایل هست ولی خالی است هم همان‌قدر بد است، و بی‌صدا‌تر.
    try {
      if (statSync(onDisk).size === 0) fails.push(`${rel} — آیکونِ «${icon.src}» وجود دارد ولی صفر بایت است`);
    } catch { /* خواندنِ اندازه شکست خورد — ادعا نکن */ }
  }
}

if (fails.length) {
  console.error(`❌ داراییِ manifest گم است — ${fails.length} مورد:`);
  for (const f of fails) console.error(`  • ${f}`);
  console.error('');
  console.error('  کروم برای نصب‌پذیریِ PWA هر دو اندازه‌ی ۱۹۲ و ۵۱۲ را لازم دارد.');
  console.error('  آیکونِ غایب هیچ خطایی در کنسول نمی‌دهد — فقط دکمه‌ی نصب ظاهر نمی‌شود.');
  process.exit(1);
}

const n = manifests.reduce((a, m) => {
  try { return a + (JSON.parse(readFileSync(m, 'utf8')).icons || []).length; } catch { return a; }
}, 0);
console.log(`✓ داراییِ manifest کامل است — ${manifests.length} manifest، ${n} آیکون، همه روی دیسک`);
