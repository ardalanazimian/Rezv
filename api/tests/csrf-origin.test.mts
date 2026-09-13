import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { checkMutatingOrigin } = await import('../src/lib/security.ts');

// ═══════════════════════════════════════════════════════════════════════
//  CSRF · چکِ Origin برای درخواست‌های تغییردهنده
//
//  چرا این فایل ساخته شد: شرطِ قبلیِ middleware
//      `allowed.length > 0 && origin && !allowed.includes(origin)`
//  بود — یعنی درخواستی که اصلاً هدرِ `Origin` نداشت هرگز رد نمی‌شد. گاردی که
//  راهِ دور زدنش «هدر را نفرست» است، گارد نیست. (auth با Bearer است پس این
//  لایه دفاع در عمق است، ولی یک لایه‌ی دفاعیِ همیشه-سبز هم همان fake-green است.)
//
//  ⚠️ قفلِ همزمانِ جهتِ مخالف: کرونِ واقعی (`cron/run.sh`) با curl و هدرِ
//  x-maintenance-key پستِ بدونِ Origin می‌زند. اگر «بدونِ Origin ⇒ ۴۰۳» بدونِ
//  استثنا اعمال می‌شد، کلِ کرونِ نگه‌داری بی‌صدا می‌مرد (`curl -sf` چیزی چاپ
//  نمی‌کند). پس هر دو سمت اینجا قفل شده‌اند.
// ═══════════════════════════════════════════════════════════════════════

const ALLOWED = ['https://app.rezervno.ir', 'https://business.rezervno.ir'];

/** سیگنال‌های یک درخواستِ کاملاً بی‌نشانه؛ هر تست فقط آنچه را لازم دارد عوض می‌کند. */
function signals(over: Partial<Parameters<typeof checkMutatingOrigin>[0]> = {}) {
  return { origin: null, secFetchSite: null, referer: null, hasNonSimpleHeader: false, ...over };
}

describe('checkMutatingOrigin — وقتی Origin هست', () => {
  test('originِ مجاز عبور می‌کند', () => {
    const v = checkMutatingOrigin(signals({ origin: 'https://app.rezervno.ir' }), ALLOWED);
    assert.equal(v.allowed, true);
    assert.equal(v.reason, 'origin_allowed');
  });

  test('originِ غیرمجاز رد می‌شود', () => {
    const v = checkMutatingOrigin(signals({ origin: 'https://evil.example' }), ALLOWED);
    assert.equal(v.allowed, false);
    assert.equal(v.reason, 'origin_rejected');
  });

  test('originِ غیرمجاز حتی با Sec-Fetch-Site جعلی هم رد می‌شود', () => {
    // مهم: بندهای جایگزین فقط وقتی Origin **نیست** بررسی می‌شوند؛ وگرنه
    // مهاجم می‌توانست با یک هدرِ اضافه چکِ اصلی را دور بزند.
    const v = checkMutatingOrigin(
      signals({ origin: 'https://evil.example', secFetchSite: 'same-origin', hasNonSimpleHeader: true }),
      ALLOWED,
    );
    assert.equal(v.allowed, false);
    assert.equal(v.reason, 'origin_rejected');
  });
});

describe('checkMutatingOrigin — وقتی Origin نیست (باگِ اصلی)', () => {
  test('🔴 بدونِ Origin و بدونِ هیچ نشانه‌ی جایگزین ⇒ رد (۴۰۳)', () => {
    const v = checkMutatingOrigin(signals(), ALLOWED);
    assert.equal(v.allowed, false, 'قبلاً این حالت بی‌صدا عبور می‌کرد');
    assert.equal(v.reason, 'no_trusted_signal');
  });

  test('بدونِ Origin ولی `Sec-Fetch-Site: same-origin` ⇒ مجاز', () => {
    // این هدر را خودِ مرورگر می‌گذارد و JSِ صفحه نمی‌تواند جعلش کند.
    const v = checkMutatingOrigin(signals({ secFetchSite: 'same-origin' }), ALLOWED);
    assert.equal(v.allowed, true);
    assert.equal(v.reason, 'sec_fetch_same_site');
  });

  test('`same-site` هم مجاز است (زیردامنه‌های app./business. یک site‌اند)', () => {
    const v = checkMutatingOrigin(signals({ secFetchSite: 'Same-Site' }), ALLOWED);
    assert.equal(v.allowed, true);
    assert.equal(v.reason, 'sec_fetch_same_site');
  });

  test('`cross-site` و `none` نشانه‌ی اعتماد نیستند ⇒ رد', () => {
    for (const site of ['cross-site', 'none']) {
      const v = checkMutatingOrigin(signals({ secFetchSite: site }), ALLOWED);
      assert.equal(v.allowed, false, `${site} نباید عبور کند`);
      assert.equal(v.reason, 'no_trusted_signal');
    }
  });

  test('Refererِ درون‌فهرست عبور می‌کند، Refererِ بیرونی نه', () => {
    const ok = checkMutatingOrigin(signals({ referer: 'https://app.rezervno.ir/booking?x=1' }), ALLOWED);
    assert.equal(ok.allowed, true);
    assert.equal(ok.reason, 'referer_allowed');

    const bad = checkMutatingOrigin(signals({ referer: 'https://evil.example/attack' }), ALLOWED);
    assert.equal(bad.allowed, false);
    assert.equal(bad.reason, 'no_trusted_signal');
  });

  test('Refererِ بدفرم کرش نمی‌کند و اعتماد هم نمی‌سازد', () => {
    const v = checkMutatingOrigin(signals({ referer: 'نه-یک-url' }), ALLOWED);
    assert.equal(v.allowed, false);
    assert.equal(v.reason, 'no_trusted_signal');
  });
});

describe('checkMutatingOrigin — کلاینتِ غیرمرورگری (کرونِ واقعی)', () => {
  test('🔴 پستِ کرون (x-maintenance-key، بدونِ Origin) نباید ۴۰۳ شود', () => {
    // بازتابِ دقیقِ cron/run.sh: `curl -sf -X POST -H "x-maintenance-key: …"`.
    // اعتبارِ خودِ کلید را guardMaintenance در route می‌سنجد، نه این لایه؛
    // اینجا فقط «این یک فرمِ ساده‌ی cross-site نیست» اثبات می‌شود.
    const v = checkMutatingOrigin(signals({ hasNonSimpleHeader: true }), ALLOWED);
    assert.equal(v.allowed, true);
    assert.equal(v.reason, 'non_simple_header');
  });
});

describe('checkMutatingOrigin — فهرستِ خالی', () => {
  test('بدونِ ALLOWED_ORIGINS این لایه خاموش است (و صادقانه همین را می‌گوید)', () => {
    // گاردِ production در middleware (assertAllowedOriginsConfigured) جلوی این
    // حالت را می‌گیرد؛ این تابع نباید وانمود کند که محافظت می‌کند.
    const v = checkMutatingOrigin(signals(), []);
    assert.equal(v.allowed, true);
    assert.equal(v.reason, 'no_allowlist');
  });
});
