import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════
//  قفلِ رگرسیون: importِ پویایِ نسبی در lib/ ممنوع است
//
//  ⚠️ این تست از یک باگِ واقعی زاده شد (۲۰۲۶-۰۸-۲۰، PR #37):
//
//    TypeError [ERR_UNSUPPORTED_RESOLVE_REQUEST]: Failed to resolve module
//    specifier "./prediction-ledger.ts" from "data:text/javascript,..."
//
//  مسیرِ رزرو و چرخه‌ی حیات هرکدام یک `await import('./prediction-ledger')`
//  داشتند. زیرِ tsx، ماژول به یک data: URL تبدیل می‌شود و Node ۲۰ (نسخه‌ی CI)
//  نمی‌تواند specifierِ نسبی را از داخلِ data: URL حل کند. Node ۲۲ می‌تواند —
//  برای همین محلی سبز بود و CI قرمز.
//
//  بدترین بخشش این بود: هر دو import داخلِ یک `void (async () => …)()`ِ
//  بدونِ catch بودند، پس شکست هیچ ردی نمی‌گذاشت. یعنی روی Node ۲۰ کلِ دفترِ
//  پیش‌بینی خالی می‌ماند و داشبورد «هنوز داده‌ای نیست» نشان می‌داد — که از
//  یک خطای پرسروصدا خیلی بدتر است، چون شبیهِ کارکردِ درست است.
//
//  ⚠️ دامنه‌ی دقیقِ خطر (اندازه‌گیری‌شده، نه حدس): این شکست فقط زیرِ tsx رخ
//  می‌دهد، چون data: URL کارِ tsx است. سرورِ تولید با Next.js/Turbopack اجرا
//  می‌شود و importِ پویا آن‌جا سالم resolve می‌شود. طبقِ package.json تنها
//  مصرف‌کننده‌های tsx در این ریپو `npm test` و `db:seed` هستند. پس این باگ
//  تولید را نشکست — ولی کاری بدتر کرد: فازِ ۵ را در CI کاملاً بی‌آزمون گذاشت
//  در حالی که سوئیت سبز گزارش می‌شد.
//
//  چرا فهرستِ فایل‌ها و نه کلِ lib/: در lib/ هشت importِ پویایِ دیگر هست
//  (db→metrics، notify/sms→queue، redis→errors، reservations→hours،
//  tables→lifecycle، waitlist→reservations). چندتاشان چرخه‌ی واقعی‌اند و
//  شکستنشان یک ریفکتورِ جدا و بی‌ربط به این کار است. آن‌ها در
//  docs/KNOWN_LIMITATIONS.md به‌عنوانِ یافته ثبت شدند. این قفل عمداً فقط
//  مسیرِ ML/دفتر را می‌بندد — یعنی چیزی را ادعا نمی‌کند که واقعاً تضمین
//  نمی‌کند.
// ═══════════════════════════════════════════════════════════════════════

const LIB_DIR = new URL('../src/lib/', import.meta.url).pathname;

/** فایل‌هایِ مسیرِ ML/دفتر — همان‌هایی که این باگ در آن‌ها بی‌صدا بود. */
const ML_PATH_FILES = [
  'customer-insights.ts',
  'lifecycle.ts',
  'ml-core.ts',
  'no-show-model.ts',
  'prediction-ledger.ts',
];

/** `import(` که بلافاصله بعدش یک specifierِ نسبی ('./x' یا '../x') بیاید. */
const DYNAMIC_RELATIVE_IMPORT = /\bimport\s*\(\s*['"`]\.{1,2}\//;

describe('importِ پویایِ نسبی در مسیرِ ML ممنوع است (باگِ Node ۲۰)', () => {
  test('همه‌ی فایل‌هایِ فهرست‌شده واقعاً وجود دارند', () => {
    // اگر فایلی تغییرِ نام بدهد، قفل نباید بی‌صدا از کار بیفتد.
    const present = new Set(readdirSync(LIB_DIR));
    const missing = ML_PATH_FILES.filter(f => !present.has(f));
    assert.deepEqual(missing, [], 'فایلِ فهرست‌شده پیدا نشد — فهرست را به‌روز کن');
  });

  test('هیچ‌کدام از فایل‌هایِ مسیرِ ML importِ پویایِ نسبی ندارند', () => {
    const offenders: string[] = [];
    for (const f of ML_PATH_FILES) {
      const src = readFileSync(join(LIB_DIR, f), 'utf8');
      // خطوطِ کامنت را کنار می‌گذاریم: خودِ همین توضیحات مثالِ الگو را دارند.
      const code = src.split('\n')
        .filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
        .join('\n');
      if (DYNAMIC_RELATIVE_IMPORT.test(code)) offenders.push(f);
    }
    assert.deepEqual(offenders, [],
      `این فایل‌ها importِ پویایِ نسبی دارند و زیرِ tsx روی Node ۲۰ می‌شکنند: ${offenders.join(', ')}. ` +
      'اگر برای شکستنِ چرخه‌ی import است، کدِ مشترک را به ml-core.ts (که هیچ importی ندارد) ببر.');
  });

  test('کنترلِ مثبت: خودِ الگو واقعاً چنین چیزی را می‌گیرد', () => {
    // بدونِ این، تستِ بالا با یک regexِ همیشه-نامنطبق هم سبز می‌ماند و
    // هیچ‌چیز را اثبات نمی‌کرد.
    assert.ok(DYNAMIC_RELATIVE_IMPORT.test("const x = await import('./prediction-ledger');"));
    assert.ok(DYNAMIC_RELATIVE_IMPORT.test('await import("../lib/foo")'));
    // و importهایِ مجاز را نمی‌گیرد:
    assert.ok(!DYNAMIC_RELATIVE_IMPORT.test("import { db } from './db';"));
    assert.ok(!DYNAMIC_RELATIVE_IMPORT.test("await import('@prisma/client')"));
  });
});
