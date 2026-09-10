#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ اتصالِ وضعیتِ رزرو ↔ برچسبِ فارسیِ پنل   (DS-003 §۴‑۴)
//
//  ┌─ این گارد **جایگزینِ** تستِ `rezv-a0` نیست؛ مکملِ آن است ─────────┐
//  │  تستِ او می‌پرسد: «آیا فقط **یک** نگاشت وجود دارد؟»               │
//  │  این گارد می‌پرسد: «آیا آن یک نگاشت **همه‌ی** وضعیت‌ها را دارد؟»  │
//  │                                                                   │
//  │  هیچ‌کدام دیگری را پوشش نمی‌دهد: یک نگاشتِ دومِ **کامل** هنوز      │
//  │  بالاخره واگرا می‌شود (و امروز شده بود — `seated` در یک نگاشت      │
//  │  «نشسته» بود و در دیگری «سر میز»)، و یک نگاشتِ **یکتا** هم         │
//  │  می‌تواند از بک‌اند عقب بیفتد. دو سؤالِ متفاوت، دو گارد.           │
//  └───────────────────────────────────────────────────────────────────┘
//
//  چرا لازم است: `RStatus` در `api/src/lib/lifecycle.ts` تعریف می‌شود و
//  پنلِ رستوران برچسبِ فارسی‌اش را در `STATUS_META` جدا نگه می‌دارد. هیچ‌چیز
//  این دو را به هم نمی‌بندد. اگر بک‌اند وضعیتِ تازه‌ای اضافه کند، پنل خطا
//  نمی‌دهد — `STATUS_META[s]?.label || s` بی‌صدا **کلیدِ خامِ انگلیسی** را به
//  پرسنل نشان می‌دهد. همان شکلِ خرابی که مهمانِ پلاتینیوم را پشتِ میزِ پذیرش
//  با رشته‌ی `platinum` نشان می‌داد (DS-001 §۲).
//
//  ثابتِ طراحی — همان قاعده‌ی `check-loyalty-constant-binding.mjs`:
//    **لنگرِ گم‌شده، فهرستِ خالی، یا فایلِ ناموجود ⇦ خطا. هرگز `continue`.**
//  گاردی که سوژه‌اش را پیدا نکند و سبز بماند، بدتر از نبودنش است.
//
//  سه بررسی:
//   A) هر مقدارِ `RStatus` باید در `STATUS_META` برچسب داشته باشد.
//      کلیدِ **اضافه** خطا نیست: `noshow` عمداً یک aliasِ نمایشی است. جهتِ
//      خطرناک فقط «کم» است، نه «زیاد».
//   B) کپیِ `standalone` هم همین را باید داشته باشد (تولیدشده، ولی رویه‌ی
//      این مخزن اسکنِ مستقلِ آن است — رجوع به DS-001 §۳).
//   C) `RSTATUS` در روتِ تغییرِ وضعیتِ پرسنل یک **کپیِ چهارمِ** همان فهرست
//      است (`.../restaurant/reservations/[code]/status/route.ts`). اگر با
//      `RStatus` نخواند، zod وضعیتِ تازه را رد می‌کند و پرسنل یک خطای
//      اعتبارسنجی می‌بینند برای کاری که بک‌اند مجازش می‌داند. فقط **خوانده**
//      می‌شود؛ این ابزار چیزی در `api/` نمی‌نویسد.
//
//  اجرا: node tools/check-status-label-binding.mjs
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const LIFECYCLE = 'api/src/lib/lifecycle.ts';
const STAFF_STATUS_ROUTE = 'api/src/app/api/v1/restaurant/reservations/[code]/status/route.ts';

// نگاشت‌هایی که باید هر وضعیت را بشناسند. اگر پنلِ تازه‌ای اضافه شد و اینجا
// نیامد، پوشش داده نمی‌شود — همین محدودیت پایین چاپ می‌شود.
const LABEL_SITES = [
  { file: 'apps/business/js/data.js', anchor: /const STATUS_META\s*=\s*\{/ },
  { file: 'standalone/business.html', anchor: /const STATUS_META\s*=\s*\{/ },
];

function read(rel) {
  const abs = path.join(REPO_ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`✗ فایل وجود ندارد: ${rel}`);
    console.error('  اگر واقعاً جابه‌جا شده، فهرستِ این ابزار را به‌روز کن — رد شدن از رویش یعنی گاردی که فکر می‌کند بررسی کرده و نکرده.');
    process.exit(1);
  }
  return readFileSync(abs, 'utf8');
}

/** مقادیرِ `RStatus` را از تعریفِ نوع می‌خواند، نه از حافظه. */
function readRStatus() {
  const src = read(LIFECYCLE);
  const m = src.match(/export type RStatus =([\s\S]*?);/);
  if (!m) {
    console.error(`✗ \`export type RStatus =\` در ${LIFECYCLE} پیدا نشد — ساختارِ فایل عوض شده.`);
    process.exit(1);
  }
  const values = [...new Set([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]))];
  if (values.length === 0) {
    console.error('✗ هیچ مقداری از RStatus پارس نشد — شکلِ تعریف عوض شده.');
    process.exit(1);
  }
  return values;
}

/** کلیدهایِ یک object literalِ چندخطی را بعد از لنگر برمی‌گرداند. */
function keysAfterAnchor(src, anchor) {
  const m = src.match(anchor);
  if (!m) return null;
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  const body = src.slice(start, i - 1);
  // فقط کلیدهایِ سطحِ اول: آن‌هایی که در ابتدایِ خط (با فاصله) می‌آیند.
  return [...new Set([...body.matchAll(/^\s{0,8}([a-z_]+)\s*:/gm)].map((x) => x[1]))];
}

function main() {
  const rstatus = readRStatus();
  const failures = [];
  const scanned = [];

  for (const site of LABEL_SITES) {
    const src = read(site.file);
    const keys = keysAfterAnchor(src, site.anchor);
    if (keys === null) {
      failures.push({
        where: site.file,
        msg: 'لنگرِ `const STATUS_META = {` پیدا نشد. یا نامش عوض شده و لنگر باید به‌روز شود، یا نگاشت حذف شده و این ردیف باید برداشته شود. نیافتن هرگز «رد شد» نیست.',
      });
      continue;
    }
    scanned.push(`${site.file} (${keys.length} کلید)`);
    const missing = rstatus.filter((s) => !keys.includes(s));
    if (missing.length > 0) {
      failures.push({
        where: site.file,
        msg: `برچسبِ فارسی ندارد برایِ: ${missing.join('، ')}. پنل به‌جایش کلیدِ خامِ انگلیسی را به پرسنل نشان می‌دهد (\`STATUS_META[s]?.label || s\`) — بی‌صدا، بدونِ خطا، بدونِ لاگ.`,
      });
    }
  }

  // C) کپیِ چهارم: فهرستِ zodِ روتِ پرسنل
  const routeSrc = read(STAFF_STATUS_ROUTE);
  const rm = routeSrc.match(/const RSTATUS = \[([\s\S]*?)\] as const;/);
  if (!rm) {
    failures.push({
      where: STAFF_STATUS_ROUTE,
      msg: '`const RSTATUS = [` پیدا نشد — لنگر باید به‌روز شود.',
    });
  } else {
    const routeValues = [...new Set([...rm[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]))];
    const missingInRoute = rstatus.filter((s) => !routeValues.includes(s));
    const extraInRoute = routeValues.filter((s) => !rstatus.includes(s));
    if (missingInRoute.length > 0 || extraInRoute.length > 0) {
      failures.push({
        where: STAFF_STATUS_ROUTE,
        msg: `فهرستِ zod با RStatus نمی‌خواند — کم: [${missingInRoute.join('، ') || '—'}] · زیاد: [${extraInRoute.join('، ') || '—'}]. یعنی پرسنل برای کاری که بک‌اند مجازش می‌داند خطای اعتبارسنجی می‌گیرند، یا برعکس.`,
      });
    }
  }

  console.log(`RStatus (از ${LIFECYCLE}) — ${rstatus.length} مقدار:`);
  console.log(`  ${rstatus.join(' · ')}`);
  console.log('');
  console.log(`نگاشت‌هایِ بررسی‌شده: ${scanned.join(' · ') || 'هیچ'}`);
  console.log('محدوده‌یِ صریح: فقط همین نگاشت‌ها دیده می‌شوند. پنلِ تازه‌ای که به فهرست اضافه نشود پوشش داده **نمی‌شود**.');
  console.log('');

  if (failures.length > 0) {
    console.error(`✗ ${failures.length} مورد: وضعیتِ رزرو به برچسبش بسته نیست.`);
    for (const f of failures) console.error(`  · ${f.where}\n      ${f.msg}`);
    console.error('');
    console.error('رفع: برچسبِ گم‌شده را به STATUS_META اضافه کن. برایِ وضعیت‌هایِ «قدیمی» همان برچسبِ معادلِ امروزی درست است (مثلاً cancelled_by_user → همان «لغوشده»).');
    process.exit(1);
  }

  console.log('✓ هر مقدارِ RStatus در هر نگاشتِ بررسی‌شده برچسبِ فارسی دارد، و فهرستِ zodِ روتِ پرسنل با RStatus می‌خواند.');
  process.exit(0);
}

main();
