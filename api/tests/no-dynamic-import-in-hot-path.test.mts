import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
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
//  ⚠️ دامنه‌ی این قفل در ۲۰۲۶-۰۸-۲۰ از ۵ فایلِ مسیرِ ML به **کلِ src/lib**
//  گسترش یافت. دلیلش یک تصحیحِ واقعی است: در دورِ قبل نوشته بودم «۸ importِ
//  پویایِ دیگر هست که چندتاشان چرخه‌ی واقعی‌اند» — آن یک حدس بود. با ساختنِ
//  گرافِ کاملِ importهای src/lib و بررسیِ ترانزیتیو مشخص شد **هیچ‌کدام**
//  چرخه نمی‌سازند؛ هر هشت‌تا static شدند. پس دیگر دلیلی برای استثنا نیست و
//  قفل می‌تواند همه‌ی lib/ را بپوشاند.
// ═══════════════════════════════════════════════════════════════════════

// [merge ۰۸-۲۴] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
// و fs آن را «C:\C:\…» می‌فهمد (ENOENT) — همان کلاسِ باگِ cross-platform که
// photo-moderation قبلاً برایِ sep داشت. رویِ لینوکسِ CI هر دو یکی‌اند.
const LIB_DIR = fileURLToPath(new URL('../src/lib/', import.meta.url));

/** `import(` که بلافاصله بعدش یک specifierِ نسبی ('./x' یا '../x') بیاید. */
const DYNAMIC_RELATIVE_IMPORT = /\bimport\s*\(\s*['"`]\.{1,2}\//;

describe('importِ پویایِ نسبی در src/lib ممنوع است (باگِ Node ۲۰)', () => {
  const libFiles = readdirSync(LIB_DIR).filter(f => f.endsWith('.ts')).sort();

  test('اسکنر واقعاً فایل پیدا می‌کند (وگرنه تستِ زیر توخالی است)', () => {
    // بدونِ این، اگر مسیر عوض شود اسکنر صفر فایل می‌دهد و تستِ بعدی
    // بی‌سروصدا همیشه سبز می‌ماند — یعنی هیچ‌چیز را محافظت نمی‌کند.
    assert.ok(libFiles.length >= 20,
      `انتظارِ دست‌کم ۲۰ فایل در src/lib، ولی ${libFiles.length} پیدا شد — مسیرِ اسکنر را چک کن`);
  });

  test('هیچ فایلی در src/lib importِ پویایِ نسبی ندارد', () => {
    const offenders: string[] = [];
    for (const f of libFiles) {
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
