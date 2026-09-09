#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ اتصالِ ثابت‌هایِ وفاداری ↔ متنِ UI
//
//  مسئله‌ای که این گارد برایش ساخته شد، و چرا «امروز درست است» کافی نیست:
//  آستانه‌هایِ سطح و مقادیرِ امتیاز در `api/src/lib/loyalty.ts` اعلام
//  می‌شوند و در چند فایلِ فرانت **دوباره تایپ** شده‌اند. امروز همه با هم
//  می‌خوانند — و همین خطر است، چون هیچ‌چیز نبسته‌شان. زخمش در خودِ سورس
//  ثبت است (`apps/customer/js/features/food-dna.js:189`): کاربری با ۹۰۰
//  امتیاز در یک صفحه «نقره‌ای» و در صفحه‌ی دیگر «طلایی» دید. آن دفعه با
//  هم‌شکل‌کردنِ متن «رفع» شد — که ریست است، نه رفع. این گارد همان تکنیکِ
//  `tools/check-alert-metric-binding.mjs` است روی جفتِ جدید: سمتِ کد را
//  واقعاً می‌خواند.
//
//  ⚠️ چرا یک گاردِ ساده‌یِ grep اینجا **سبزِ کاذب** می‌دهد — سه تله‌ی واقعی:
//
//   ۱) ارقامِ متنِ UI **فارسی‌اند**. `grep -c "500"` روی
//      `features/loyalty.js` صفر می‌دهد در حالی که همان فایل «۵۰۰ امتیاز»
//      را به کاربر نشان می‌دهد. بدتر: روی `features/rewards.js` همان grep
//      چهار hit می‌دهد (اعدادِ کارتِ هدیه، لاتین). یعنی خروجی **شبیهِ
//      پوشش** به‌نظر می‌رسد و کسی دنبالِ آن صفر نمی‌گردد. پس هر مقایسه‌ای
//      باید **بعد از normalize** انجام شود، نه روی بایتِ خام.
//
//   ۲) تطبیقِ زیررشته‌ای دروغ می‌گوید: «۱۰۰» زیررشته‌ی «۱۰۰۰» است. این
//      دقیقاً همان خانواده‌ی باگی است که امروز در قراردادِ خطا گرفته شد
//      (`/پر|ظرفیت/` که «**پر**داخت» را «ظرفیت پر شد» می‌خواند). پس
//      اینجا **رشته‌یِ کاملِ رقم** استخراج و مقایسه می‌شود، نه زیررشته.
//
//   ۳) گاردی که وقتی لنگرش گم می‌شود **سبز بماند** بی‌ارزش است: کافی است
//      کسی متنِ وعده را پاک یا بازنویسی کند تا گارد بی‌صدا از کار بیفتد و
//      همچنان «✓» چاپ کند. پس نیافتنِ لنگر اینجا **خطاست، نه رد شدن** —
//      همان قاعده‌ی «شکستِ جست‌وجو شاهدِ نبود نیست».
//
//  ╔═══════════════════════════════════════════════════════════════════╗
//  ║  ثابتِ طراحی — اگر این فایل را ویرایش می‌کنی، این قاعده را نشکن:  ║
//  ║                                                                   ║
//  ║      **فهرستِ اسکنِ خالی، یا فایلی که در فهرست هست و روی دیسک      ║
//  ║        نیست ⇦ خطا. هرگز `continue`.**                             ║
//  ║                                                                   ║
//  ║  نسخه‌ی اولِ همین ابزار این را نقض کرد: فهرست یک نامِ **حدسی**     ║
//  ║  داشت (`apps/company/js/app.js`) که اصلاً وجود ندارد، و کد بی‌صدا  ║
//  ║  از رویش رد می‌شد. یعنی گارد صفر فایل اسکن می‌کرد و «✓» چاپ        ║
//  ║  می‌کرد. این دقیقاً همان نقصی است که ابزار برای گرفتنش نوشته شد،   ║
//  ║  در خودش.                                                         ║
//  ║                                                                   ║
//  ║  چرا اینجا نوشته شده و نه در یک سند: نفرِ بعدی که مسیری به این     ║
//  ║  فهرست‌ها اضافه می‌کند، تایپش را غلط می‌زند — و باید همان لحظه     ║
//  ║  قرمز ببیند، نه اینکه سندی را بخواند که نمی‌خواند. قاعده باید در   ║
//  ║  فایلی زندگی کند که اجرایش می‌کند. (همان درسی که ROUTING.md        ║
//  ║  برایش ساخته شد: یک فاکت، یک مرجع، کنارِ محلِ مصرف.)               ║
//  ╚═══════════════════════════════════════════════════════════════════╝
//
//  چهار بررسی، با سیاست‌هایِ عمداً متفاوت:
//   A) لنگر — هر ادعایِ ثبت‌شده باید **دقیقاً یک بار** پیدا شود.
//      صفر بار → drift یا حذف. بیش از یک بار → مبهم. هر دو exit 1.
//   B) مقدار — عددِ داخلِ همان خط باید با مقدارِ اعلام‌شده در کد یکی باشد.
//   C) کاملیِ نگاشتِ سطح — هر object literal ای در UI که کلیدهای سطح را به
//      نامِ فارسی نگاشت می‌کند باید **هر چهار** سطحِ LOYALTY_TIERS را
//      داشته باشد. یک نگاشتِ ناقص خطا نمی‌دهد، فقط کلیدِ خامِ انگلیسی را
//      به کاربر نشان می‌دهد — و چون fallback دارد، هرگز در لاگ دیده
//      نمی‌شود.
//   D) ادعایِ ثبت‌نشده — عددی که با یکی از مقادیرِ امتیاز برابر است و کنارِ
//      واژه‌ی «امتیاز» به کاربر نشان داده می‌شود ولی در manifestِ زیر
//      نیست. این جهت است که **کپیِ جدید** را می‌گیرد؛ سه بررسیِ بالا فقط
//      کپی‌هایِ شناخته‌شده را نگه می‌دارند.
//
//  جهتِ درستِ رفعِ ریشه‌ای (امروز پیاده نشده، عمداً): این اعداد اصلاً
//  نباید در فرانت باشند — API باید آستانه‌ها و مقادیر را بدهد و UI فقط
//  رندر کند. این گارد با آن معماری **هم‌جهت** است و دورش نمی‌اندازد: وقتی
//  یک عدد از فرانت به API منتقل شد، ردیفش از manifest حذف می‌شود و بررسیِ
//  A همان لحظه قرمز می‌شود تا حذف **عمدی** باشد نه سهوی. هرچه manifest
//  کوچک‌تر شود، محصول سالم‌تر است؛ manifestِ خالی یعنی کار تمام است.
//
//  اجرا: node tools/check-loyalty-constant-binding.mjs
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DECL_PATH = path.join(REPO_ROOT, 'api', 'src', 'lib', 'loyalty.ts');

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** هر رقمِ فارسی/عربی را به لاتین برمی‌گرداند. بدونِ این، هیچ مقایسه‌ای معنا ندارد. */
function normalizeDigits(s) {
  return s
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/**
 * همه‌یِ **رشته‌هایِ کاملِ رقم** در یک خط را برمی‌گرداند (فارسی یا لاتین)،
 * به‌صورتِ عددِ لاتین. «رشته‌یِ کامل» یعنی «۱۰۰۰» عددِ ۱۰۰۰ می‌دهد و
 * هرگز ۱۰۰ — تله‌ی ۲ در سرصفحه.
 */
function digitRunsIn(line) {
  const runs = normalizeDigits(line).match(/\d+/g) || [];
  return runs.map(Number);
}

// ═══ سمتِ کد: تعریف‌ها را از loyalty.ts می‌خوانیم، نه از حافظه ═══════════

function readDeclarations() {
  if (!existsSync(DECL_PATH)) {
    console.error(`✗ فایلِ تعریف پیدا نشد: ${path.relative(REPO_ROOT, DECL_PATH)}`);
    console.error('  اگر واقعاً جابه‌جا شده، DECL_PATH در همین ابزار را به‌روز کن — نه اینکه گارد را حذف کنی.');
    process.exit(1);
  }
  const src = readFileSync(DECL_PATH, 'utf8');
  const points = {};

  const pointsBlock = src.match(/const POINTS = \{([\s\S]*?)\n\};/);
  if (!pointsBlock) {
    console.error('✗ بلوکِ `const POINTS = {` در loyalty.ts پیدا نشد — ساختارِ فایل عوض شده.');
    process.exit(1);
  }
  for (const m of pointsBlock[1].matchAll(/^\s*([a-zA-Z]+):\s*(\d+)\s*,/gm)) {
    points[m[1]] = Number(m[2]);
  }

  const scalar = (name) => {
    const m = src.match(new RegExp(`export const ${name} = (\\d+);`));
    if (!m) {
      console.error(`✗ ثابتِ ${name} در loyalty.ts پیدا نشد — ساختارِ فایل عوض شده.`);
      process.exit(1);
    }
    return Number(m[1]);
  };

  const tiersBlock = src.match(/export const LOYALTY_TIERS[^=]*=\s*\[([\s\S]*?)\n\];/);
  if (!tiersBlock) {
    console.error('✗ آرایه‌یِ LOYALTY_TIERS در loyalty.ts پیدا نشد — ساختارِ فایل عوض شده.');
    process.exit(1);
  }
  const tiers = [];
  for (const m of tiersBlock[1].matchAll(
    /\{\s*key:\s*'([a-z]+)',\s*name:\s*'([^']+)',\s*emoji:\s*'([^']+)',\s*min:\s*(\d+)\s*\}/g
  )) {
    tiers.push({ key: m[1], name: m[2], emoji: m[3], min: Number(m[4]) });
  }
  if (tiers.length === 0) {
    console.error('✗ هیچ سطحی از LOYALTY_TIERS پارس نشد — شکلِ عناصر عوض شده.');
    process.exit(1);
  }

  return {
    points,
    arrivalPoints: scalar('ARRIVAL_POINTS'),
    tomanPerPoint: scalar('TOMAN_PER_POINT'),
    tiers,
  };
}

// ═══ manifestِ ادعاهایِ UI ═══════════════════════════════════════════════
//
//  لنگرها **عمداً بدونِ عدد** نوشته شده‌اند. اگر عدد داخلِ لنگر بود،
//  واگراییِ مقدار به‌شکلِ «لنگر پیدا نشد» گزارش می‌شد و پیامِ خطا دروغ
//  می‌گفت: «متن حذف شده» به‌جای «عدد فرق دارد». لنگر متنِ پایدار را
//  می‌گیرد، بررسیِ B عدد را.

//  چرا `standalone/customer.html` هم اینجاست، با اینکه **تولیدشده** است:
//  `tools/build-standalone.py` آن را از `apps/customer` می‌سازد و تازگی‌اش در
//  `ci.yml:443,543` گیت دارد — یعنی از قبل به منبع بسته است. با این حال
//  اسکنش می‌کنیم، چون گاردِ خواهرِ همین دامنه (`tools/check-loyalty-promise.mjs`،
//  در CI خط ۵۱۰) دقیقاً همین کار را می‌کند و رویه‌ی این مخزن است. اگر روزی
//  گیتِ تازگی بشکند، این دو گارد مستقل از آن هنوز حرف می‌زنند.
//  (`standalone/website.html` عمداً **نیست**: هیچ سازنده‌ای ندارد، اکسپورتِ
//  دستیِ ۲۰۲۶-۰۸-۲۰ است و خودِ README نمایشی اعلامش کرده.)
const CLAIM_FILE_PAIRS = {
  loyalty: ['apps/customer/js/features/loyalty.js', 'standalone/customer.html'],
  rewards: ['apps/customer/js/features/rewards.js', 'standalone/customer.html'],
  foodDna: ['apps/customer/js/features/food-dna.js', 'standalone/customer.html'],
};

/** یک ادعا را برایِ **هر** فایلی که کپی‌اش را دارد تکثیر می‌کند. */
function forEachCopy(pairKey, site) {
  return CLAIM_FILE_PAIRS[pairKey].map((file) => ({
    ...site,
    file,
    id: `${site.id}@${file.startsWith('standalone/') ? 'standalone' : 'apps'}`,
  }));
}

function buildManifest(decl) {
  return [
    ...forEachCopy('loyalty', {
      id: 'referral-loyalty-card',
      anchor: /امتیاز برای هر دعوت موفق/,
      expect: decl.points.referralReward,
      numerals: 'fa',
      declaredAt: 'POINTS.referralReward',
      note: 'کارتِ «دوستات رو دعوت کن» در صفحه‌ی وفاداری',
    }),
    ...forEachCopy('rewards', {
      id: 'referral-sheet',
      anchor: /اولین رزروش رو انجام بده،\s*[۰-۹0-9]+\s*امتیاز بگیر/,
      expect: decl.points.referralReward,
      numerals: 'fa',
      declaredAt: 'POINTS.referralReward',
      note: 'شیتِ دعوت دوستان',
    }),
    ...forEachCopy('loyalty', {
      id: 'birthday-loyalty-card',
      anchor: /امتیاز هدیه در روز خاصت/,
      expect: decl.points.birthday,
      numerals: 'fa',
      declaredAt: 'POINTS.birthday',
      // متنِ کارت «تولد و سالگرد» است، پس عدد باید با **هر دو** بخواند.
      alsoEquals: [{ value: decl.points.anniversary, declaredAt: 'POINTS.anniversary' }],
      note: 'کارتِ «پاداش تولد و سالگرد» در صفحه‌ی وفاداری',
    }),
    ...forEachCopy('rewards', {
      id: 'birthday-sheet',
      anchor: /در اون روز\s*[۰-۹0-9]+\s*امتیاز هدیه بگیری/,
      expect: decl.points.birthday,
      numerals: 'fa',
      declaredAt: 'POINTS.birthday',
      note: 'شیتِ ثبتِ تاریخِ تولد',
    }),
    ...forEachCopy('foodDna', {
      id: 'tier-thresholds-profile',
      anchor: /const tier\s*=\s*pts>=/,
      expectAll: decl.tiers.filter((t) => t.min > 0).map((t) => t.min),
      numerals: 'latin',
      declaredAt: 'LOYALTY_TIERS[].min',
      note: 'آستانه‌هایِ سطح در کارتِ پروفایل — همان خطی که زخمِ ۹۰۰ امتیاز را داد',
    }),
  ];
}

// ═══ بررسیِ C: نگاشت‌هایِ ناقصِ سطح ══════════════════════════════════════
//
//  فایل‌هایی که پنل‌ها سطح را در آن‌ها به فارسی ترجمه می‌کنند. اگر فایلِ
//  تازه‌ای اضافه شد و اینجا نیامد، بررسیِ C پوششش نمی‌دهد — همین محدودیت
//  صریح در گزارش چاپ می‌شود تا کسی آن را با «پوششِ کامل» اشتباه نگیرد.
//
//  این فهرست حدسی نیست: با یک sweepِ سراسری روی `apps/` ساخته شد
//  (`grep -rln "gold:\s*'\|silver:\s*'\|platinum:\s*'"`) که **دقیقاً سه**
//  فایل داد — هر سه اینجا هستند. دو فایلِ company هیچ نگاشتی ندارند و
//  پیش‌گیرانه اضافه شده‌اند، چون «tier» را می‌شناسند و کاندیدِ بعدی‌اند.
//  فایلِ چهارمِ قبلی (`apps/company/js/app.js`) **اصلاً وجود ندارد**؛ نامش
//  از روی الگو حدس زده شده بود و همان حدس بی‌صدا صفر فایل اسکن می‌کرد.
const TIER_MAP_SCAN_FILES = [
  'apps/business/js/reservations.js',
  'apps/business/js/loyalty.js',
  'apps/business/js/crm.js',
  'apps/company/js/badges.js',
  'apps/company/js/intelligence.js',
  'apps/customer/js/features/loyalty.js',
  'apps/customer/js/features/food-dna.js',
  'standalone/business.html',
  'standalone/customer.html',
];

function checkTierMaps(decl, failures) {
  const keys = decl.tiers.map((t) => t.key);
  const scanned = [];
  for (const rel of TIER_MAP_SCAN_FILES) {
    const abs = path.join(REPO_ROOT, rel);
    if (!existsSync(abs)) {
      // ⚠️ عمداً خطا و نه `continue`. اولین نسخه‌ی همین ابزار اینجا رد
      // می‌شد و یک نامِ حدسیِ ناموجود (`apps/company/js/app.js`) در فهرست
      // داشت — یعنی گارد بی‌صدا صفر فایل اسکن می‌کرد و همچنان سبز بود.
      // دقیقاً همان نقصی که این ابزار برای گرفتنش نوشته شده، در خودش.
      failures.push({
        kind: 'scan-list',
        where: rel,
        msg: 'در فهرستِ اسکنِ نگاشتِ سطح هست ولی فایل وجود ندارد. اگر واقعاً حذف/جابه‌جا شده، فهرست را به‌روز کن — رد شدن از رویش یعنی گاردی که فکر می‌کند اسکن کرده و نکرده.',
      });
      continue;
    }
    scanned.push(rel);
    const lines = readFileSync(abs, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      // هر object literal ای که حداقل دو کلیدِ سطح را به رشته نگاشت می‌کند.
      for (const lit of line.matchAll(/\{[^{}]*\}/g)) {
        const body = lit[0];
        const present = keys.filter((k) => new RegExp(`(^|[{,\\s])${k}\\s*:`).test(body));
        if (present.length < 2) continue;
        const missing = keys.filter((k) => !present.includes(k));
        if (missing.length === 0) continue;
        failures.push({
          kind: 'tier-map',
          where: `${rel}:${i + 1}`,
          msg: `نگاشتِ سطح ناقص است — ${missing.join('، ')} ندارد. کاربر کلیدِ خامِ انگلیسی را می‌بیند (fallback خطا نمی‌دهد، فقط بد نشان می‌دهد).`,
        });
      }
    });
  }
  return scanned;
}

// ═══ بررسیِ D: ادعایِ ثبت‌نشده ═══════════════════════════════════════════

const CLAIM_SCAN_FILES = [
  'apps/customer/js/features/loyalty.js',
  'apps/customer/js/features/rewards.js',
  'apps/customer/js/features/food-dna.js',
  'apps/customer/js/features/onboarding.js',
  'standalone/customer.html',
];

function checkUnregisteredClaims(decl, manifest, failures) {
  const pointValues = new Set([
    ...Object.values(decl.points),
    decl.arrivalPoints,
    ...decl.tiers.map((t) => t.min).filter((m) => m > 0),
  ]);
  const scanned = [];
  for (const rel of CLAIM_SCAN_FILES) {
    const abs = path.join(REPO_ROOT, rel);
    if (!existsSync(abs)) {
      failures.push({
        kind: 'scan-list',
        where: rel,
        msg: 'در فهرستِ اسکنِ ادعا هست ولی فایل وجود ندارد. فهرست را به‌روز کن — همان دلیلِ بالا.',
      });
      continue;
    }
    scanned.push(rel);
    const registered = manifest.filter((m) => m.file === rel).map((m) => m.anchor);
    const lines = readFileSync(abs, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return; // کامنت، نه متنِ کاربر
      if (!line.includes('امتیاز')) return;
      if (registered.some((re) => re.test(line))) return; // ادعایِ ثبت‌شده
      const hits = digitRunsIn(line).filter((n) => pointValues.has(n));
      if (hits.length === 0) return;
      failures.push({
        kind: 'unregistered',
        where: `${rel}:${i + 1}`,
        msg: `عددِ ${hits.join('، ')} کنارِ واژه‌ی «امتیاز» به کاربر نشان داده می‌شود ولی در manifestِ این گارد نیست — یعنی هیچ‌چیز آن را به loyalty.ts نمی‌بندد.`,
      });
    });
  }
  return scanned;
}

// ═══ اجرا ═══════════════════════════════════════════════════════════════

function main() {
  const decl = readDeclarations();
  const manifest = buildManifest(decl);
  const failures = [];

  // ثابتِ طراحیِ سرصفحه، نیمه‌ی دوم: فهرستِ خالی هم خطاست. یک گاردِ بدونِ
  // ورودی همیشه سبز است و همیشه بی‌معنا — و از بیرون شبیهِ سلامت است.
  for (const [name, list] of [
    ['manifestِ ادعاها', manifest],
    ['TIER_MAP_SCAN_FILES', TIER_MAP_SCAN_FILES],
    ['CLAIM_SCAN_FILES', CLAIM_SCAN_FILES],
  ]) {
    if (list.length === 0) {
      // استثنا: manifestِ خالی **هدفِ** این پروژه است (وقتی همه‌ی اعداد به
      // API رفتند). ولی باید عمدی اعلام شود، نه اینکه بی‌صدا سبز بدهد.
      console.error(`✗ ${name} خالی است — گاردی که چیزی برای بررسی ندارد همیشه سبز است و همیشه بی‌معنا.`);
      console.error('  اگر واقعاً همه‌ی اعداد به API منتقل شده‌اند، این ابزار را با یک کامیتِ صریح حذف کن، نه اینکه خالی رهایش کنی.');
      process.exit(1);
    }
  }

  for (const site of manifest) {
    const abs = path.join(REPO_ROOT, site.file);
    if (!existsSync(abs)) {
      failures.push({ kind: 'anchor', where: site.file, msg: `فایل وجود ندارد (ادعایِ «${site.id}»).` });
      continue;
    }
    const lines = readFileSync(abs, 'utf8').split('\n');
    const matched = [];
    lines.forEach((line, i) => {
      if (site.anchor.test(line)) matched.push({ line, n: i + 1 });
    });

    if (matched.length === 0) {
      failures.push({
        kind: 'anchor',
        where: site.file,
        msg: `لنگرِ ادعایِ «${site.id}» پیدا نشد (${site.note}). یا متن عوض شده و لنگر باید به‌روز شود، یا ادعا حذف شده و ردیفش باید از manifest برداشته شود. نیافتن هرگز «رد شد» نیست.`,
      });
      continue;
    }
    if (matched.length > 1) {
      failures.push({
        kind: 'anchor',
        where: `${site.file}:${matched.map((m) => m.n).join(',')}`,
        msg: `لنگرِ «${site.id}» ${matched.length} بار پیدا شد — مبهم است و باید دقیق‌تر شود.`,
      });
      continue;
    }

    const { line, n } = matched[0];
    const runs = digitRunsIn(line);

    // خودِ ارقام هم باید در همان دستگاهی باشند که ادعا شده.
    if (site.numerals === 'fa' && !/[۰-۹]/.test(line)) {
      failures.push({
        kind: 'numerals',
        where: `${site.file}:${n}`,
        msg: `متنِ «${site.id}» باید ارقامِ فارسی داشته باشد و ندارد — ارقامِ لاتین در متنِ فارسی یک نقصِ نمایشی است، حتی اگر مقدارش درست باشد.`,
      });
    }

    const wanted = site.expectAll ?? [site.expect];
    const missing = wanted.filter((v) => !runs.includes(v));
    if (missing.length > 0) {
      failures.push({
        kind: 'value',
        where: `${site.file}:${n}`,
        msg: `مقدارِ ${missing.join('، ')} از ${site.declaredAt} در این متن نیست (اعدادِ موجود: ${runs.join('، ') || 'هیچ'}). UI و کد واگرا شده‌اند.`,
      });
    }
    for (const also of site.alsoEquals ?? []) {
      if (!runs.includes(also.value)) {
        failures.push({
          kind: 'value',
          where: `${site.file}:${n}`,
          msg: `این متن هر دو مقدار را وعده می‌دهد ولی ${also.declaredAt}=${also.value} با آن نمی‌خواند — متن باید دو عدد را از هم جدا کند یا کد باید یکی‌شان کند.`,
        });
      }
    }
  }

  const tierScanned = checkTierMaps(decl, failures);
  const claimScanned = checkUnregisteredClaims(decl, manifest, failures);

  console.log('تعریف‌هایِ خوانده‌شده از api/src/lib/loyalty.ts:');
  console.log(`  POINTS = ${JSON.stringify(decl.points)}`);
  console.log(`  ARRIVAL_POINTS = ${decl.arrivalPoints} · TOMAN_PER_POINT = ${decl.tomanPerPoint}`);
  console.log(`  LOYALTY_TIERS = ${decl.tiers.map((t) => `${t.key}:${t.min}`).join(' · ')}`);
  console.log('');
  console.log(
    `ادعاهایِ ثبت‌شده در manifest: ${manifest.length} · فایل‌هایِ اسکنِ نگاشتِ سطح: ${tierScanned.length} · فایل‌هایِ اسکنِ ادعا: ${claimScanned.length}`
  );
  console.log('محدوده‌یِ صریح: فقط همین فایل‌ها دیده می‌شوند. فایلِ تازه‌ای که به این فهرست‌ها اضافه نشود پوشش داده **نمی‌شود** — این پوششِ کامل نیست.');
  console.log('');

  if (failures.length > 0) {
    console.error(`✗ ${failures.length} مورد: ثابتِ وفاداری در UI به تعریفش در کد بسته نیست.`);
    for (const f of failures) console.error(`  · [${f.kind}] ${f.where}\n      ${f.msg}`);
    console.error('');
    console.error('رفع: مقدار را با api/src/lib/loyalty.ts هم‌تراز کن — و اگر می‌توانی، عدد را از فرانت بردار و از API بگیر، بعد ردیفش را از manifestِ این ابزار حذف کن.');
    process.exit(1);
  }

  console.log('✓ هر ادعایِ ثبت‌شده‌یِ UI با مقدارِ اعلام‌شده‌اش در loyalty.ts می‌خواند، و هیچ نگاشتِ ناقصِ سطح یا ادعایِ ثبت‌نشده‌ای در محدوده‌یِ اسکن نیست.');
  process.exit(0);
}

main();
