#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ دامنه‌ی ثابت — «یک حقیقت، چند کپی» برای آدرسِ عمومیِ خودمان
//
//  چرا (و چرا گارد لازم بود، نه یک قاعده‌ی نوشتاری): در ۲۰۲۶-۰۹-۰۸ یک جارو
//  **هفت** کپیِ hardcode از دامنه را در `apps/seo` جمع کرد و به یک منبعِ
//  env-محور رساند (`apps/seo/lib/urls.ts`). خودِ آن فایل هشدارش را نوشته:
//  «با hardcode، هر preview deployment هم canonical و sitemap را برای دامنه‌ی
//  تولید اعلام می‌کرد.»
//
//  ولی آن جارو **دو کپی را جا انداخت** و ده روز کسی نفهمید:
//    · apps/seo/components/Listing.tsx:4  → لینکِ هر کارت و breadcrumb
//    · apps/seo/app/layout.tsx:9,25       → metadataBase، یعنی canonicalِ هر صفحه
//  و یک سومی جای دیگر: apps/landing/next.config.js → میزبانِ next/image، که روی
//  دامنه‌ی دیگر **هر عکسِ گالری را بی‌صدا رد می‌کند**: صفحه بالا می‌آید، لاگ خالی
//  است، سایت فقط «شکسته» به‌نظر می‌رسد.
//
//  جاروی دستی ۷ از ۹ را گرفت. این دقیقاً فرقِ رفعِ نمونه با رفعِ کلاس است.
//
//  ── سیگنال، و چرا صفر استثناء دارد (بندِ ۴b منشور) ──
//  ۱. دامنه‌ی خودمان **حدس زده و ثابت نوشته نمی‌شود**: از همان خطوطی یاد گرفته
//     می‌شود که منبعِ واحدند — هر خطی که `process.env.` دارد و یک آدرس.
//  ۲. بعد فقط رشته‌هایی رد می‌شوند که **تمامِ محتوایشان** یک آدرس یا یک میزبانِ
//     برهنه است (`'https://x.ir'`، `'api.x.ir'`) و روی خطی بدونِ `process.env`
//     نشسته‌اند.
//
//  بندِ (۲) عمداً تنگ است. نسخه‌ی اولِ همین گارد آن را نداشت و ۵ مثبتِ کاذب داد:
//  دامنه داخلِ **کامنت** (`// در Vercel تنظیم کن: …`) و داخلِ **متنِ راهنمای
//  خطا** (`'مثلاً: ALLOWED_ORIGINS=https://…'`). هر دو سند‌اند، نه پیکربندی.
//  راهِ درست باریک‌کردنِ سیگنال بود، نه allowlist — که طبقِ بندِ ۴b خودش یک
//  شکستِ طراحی است. نتیجه: `schema.org`، `zarinpal.com`، `payamak-panel.com`،
//  `sendgrid.com` هرگز flag نمی‌شوند، چون میزبانِ ما نیستند. و اگر روزی دامنه
//  عوض شود گارد خودش دنبالش می‌آید، چون همان خطِ env را می‌خواند.
//
//  ── محورها (بندِ ۴c: falsifiability محورمحور است) ──
//  می‌سنجد:   ts · tsx · js · mjs در apps/seo، apps/landing، api/src
//  نمی‌سنجد:  فایلِ تست — تست حق دارد پیش‌فرضِ تولید را assert کند.
//  نمی‌سنجد:  HTMLِ ایستای apps/customer و standalone/. build ندارند و env
//             نمی‌خوانند. ردیفِ **بازِ نام‌برده**، نه پوشش:
//             apps/customer/index.html:18,50 · apps/customer/sitemap.xml:6
//             (+ آینه در standalone/customer.html). رفعشان یک قدمِ build
//             می‌خواهد که وجود ندارد — تصمیمِ CEO، نه کارِ این گارد.
//
//  اجرا:  node tools/check-hardcoded-domain.mjs
//  خروج:  ۰ تمیز · ۱ با file:line هر کپی
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SCOPE = ['apps/seo/', 'apps/landing/', 'api/src/'];
const RUNNABLE = /\.(ts|tsx|js|mjs)$/;
const IS_TEST = /(^|\/)(test|tests|__tests__)\//;
const ENV_READ = /process\.env\./;

// یک رشته‌ی «آدرسِ برهنه»: کلِ محتوا یا یک URL است یا یک میزبانِ نقطه‌دار.
// فاصله یا حرفِ فارسی داخلش یعنی جمله است، نه پیکربندی.
const BARE_URL = /^(?:https?:\/\/)?[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})(?:[:/][^\s'"`]*)?$/;
const HOST_IN = /^(?:https?:\/\/)?([a-zA-Z0-9._-]+)/;

/**
 * رشته‌های یک خط را بیرون می‌کشد و کامنت را کنار می‌گذارد.
 * چرا دست‌نویس و نه regex: یک `//` داخلِ `https://` کامنت نیست. یک regexِ ساده
 * دقیقاً همان‌جا می‌شکند که این گارد برایش نوشته شده.
 */
function stringsOutsideComments(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let j = i + 1;
      let buf = '';
      while (j < line.length) {
        if (line[j] === '\\') { buf += line[j + 1] ?? ''; j += 2; continue; }
        if (line[j] === quote) break;
        buf += line[j];
        j += 1;
      }
      if (j >= line.length) return out; // رشته‌ی بازِ چندخطی — بی‌خیالش
      out.push(buf);
      i = j + 1;
      continue;
    }
    if (c === '/' && line[i + 1] === '/') return out;  // کامنتِ خطی
    if (c === '/' && line[i + 1] === '*') return out;  // شروعِ کامنتِ بلوکی
    i += 1;
  }
  return out;
}

let files;
try {
  files = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean)
    .filter((p) => SCOPE.some((s) => p.startsWith(s)))
    .filter((p) => RUNNABLE.test(p))
    .filter((p) => !IS_TEST.test(p));
} catch (err) {
  console.error(`❌ فهرستِ فایل‌ها از git گرفته نشد: ${err}`);
  process.exit(1);
}

// نبودِ موضوع خطاست، نه پاس (بندِ ۴ منشور).
if (files.length === 0) {
  console.error('❌ هیچ فایلِ اجراشدنی‌ای در دامنه‌ی این گارد نیست — چیزی سنجیده نشد.');
  process.exit(1);
}

const lines = new Map();
for (const rel of files) lines.set(rel, readFileSync(join(REPO, rel), 'utf8').split(/\r?\n/));

// ── گامِ ۱: میزبانِ خودمان را از خطوطِ env یاد بگیر ──
const apexes = new Set();
for (const [, ls] of lines) {
  for (const line of ls) {
    if (!ENV_READ.test(line)) continue;
    for (const s of stringsOutsideComments(line)) {
      if (!BARE_URL.test(s.trim())) continue;
      const host = (HOST_IN.exec(s.trim()) || [])[1];
      if (!host || !host.includes('.')) continue;
      const parts = host.toLowerCase().split('.');
      if (parts.length >= 2) apexes.add(parts.slice(-2).join('.'));
    }
  }
}

if (apexes.size === 0) {
  console.error(
    '❌ هیچ خطِ «process.env… || آدرس» پیدا نشد، پس این گارد نمی‌داند دامنه‌ی ما چیست.\n' +
      '   یعنی گارد کور است، نه تمیز. منبعِ واحد را بررسی کن.',
  );
  process.exit(1);
}

// ── گامِ ۲: هر کپیِ دیگر از همان میزبان ──
const offences = [];
for (const [rel, ls] of lines) {
  ls.forEach((line, i) => {
    if (ENV_READ.test(line)) return;
    for (const s of stringsOutsideComments(line)) {
      const t = s.trim();
      if (!BARE_URL.test(t)) continue;
      const host = (HOST_IN.exec(t) || [])[1];
      if (!host || !host.includes('.')) continue;
      const apex = host.toLowerCase().split('.').slice(-2).join('.');
      if (apexes.has(apex)) offences.push({ rel, line: i + 1, value: t, text: line.trim().slice(0, 90) });
    }
  });
}

if (offences.length) {
  console.error(`❌ دامنه‌ی ثابت — ${offences.length} کپی بیرون از منبعِ واحد:`);
  for (const o of offences) {
    console.error(`   · ${o.rel}:${o.line} — «${o.value}»`);
    console.error(`     ${o.text}`);
  }
  console.error('   از منبعِ واحد بخوان (apps/seo/lib/urls.ts · apps/landing/lib/i18n.ts ·');
  console.error('   api/src/lib/public-urls.ts) یا پیش‌فرض را روی همان خطِ process.env بگذار.');
  process.exit(1);
}

console.log(
  `✓ دامنه‌ی ثابت نیست — ${files.length} فایلِ اجراشدنی بررسی شد؛ ` +
    `میزبانِ شناخته‌شده از روی env: ${[...apexes].join('، ')}`,
);
