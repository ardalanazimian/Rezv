// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  سطوحِ باشگاه: بک‌اند و پنل نباید از هم واگرا شوند
//
//  ⚠️ باگی که این فایل از آن زاده شد (۲۰۲۶-۰۸-۲۵، رگرسیونِ همین batch):
//  `LOYALTY_TIERS` چهار سطح دارد، ولی `apps/business/js/loyalty.js` فقط سه
//  تا می‌شناخت. تا وقتی هیچ کدی `club_members.tier` را **نمی‌نوشت** بی‌خطر
//  بود — همه برای همیشه `bronze` می‌ماندند. همین batch نوشتنِ tier را زنده
//  کرد و بلافاصله دو خرابیِ کاربری ساخت:
//    • عضوِ platinum از توزیعِ سطوحِ پنل کاملاً می‌افتاد
//    • `tierName[m.tier]` برایش `undefined` می‌داد → دایره‌ی خالی در فهرست
//  یعنی وفادارترین اعضا نامرئی می‌شدند.
//
//  چرا تستِ ساختاری و نه چشمی: این واگرایی از نوعی است که هیچ تستِ بک‌اندی
//  نمی‌بیند (پنل جاوااسکریپتِ کلاسیک است، نه ماژولِ قابلِ import) و هیچ
//  تستِ E2Eای هم نمی‌گیردش مگر داده‌ی platinum داشته باشد.
// ═══════════════════════════════════════════════════════════════════════

const { LOYALTY_TIERS } = await import('../src/lib/loyalty');

const PANEL = fileURLToPath(new URL('../../apps/business/js/loyalty.js', import.meta.url));

describe('سطوحِ باشگاه — تطابقِ بک‌اند و پنلِ رستوران', () => {

  test('⚠️ هر کلیدِ LOYALTY_TIERS در نگاشتِ نامِ پنل هست', () => {
    const src = readFileSync(PANEL, 'utf8');
    const m = src.match(/const\s+tierName\s*=\s*\{([^}]*)\}/);
    assert.ok(m, 'نگاشتِ tierName در apps/business/js/loyalty.js پیدا نشد — نامش عوض شده؟');
    const missing = LOYALTY_TIERS.filter(t => !new RegExp(`\\b${t.key}\\s*:`).test(m[1]));
    assert.deepEqual(missing.map(t => t.key), [],
      'این سطوح در بک‌اند هستند ولی پنل نامشان را نمی‌شناسد ⇒ `undefined` رندر می‌شود');
  });

  test('⚠️ هر کلیدِ LOYALTY_TIERS در توزیعِ سطوحِ پنل شمرده می‌شود', () => {
    // بدونِ این، عضوِ آن سطح از نمودارِ توزیع بی‌صدا حذف می‌شود — یعنی
    // جمعِ ستون‌ها با تعدادِ کلِ اعضا نمی‌خواند و کسی متوجه نمی‌شود.
    const src = readFileSync(PANEL, 'utf8');
    const missing = LOYALTY_TIERS.filter(t => !src.includes(`m.tier==='${t.key}'`));
    assert.deepEqual(missing.map(t => t.key), [],
      'این سطوح شمرده نمی‌شوند ⇒ اعضایشان از توزیعِ پنل می‌افتند');
  });

  test('کنترلِ منفی: نامِ فارسیِ هر سطح در پنل با بک‌اند یکی است', () => {
    // بدونِ این، دو تستِ بالا با یک نگاشتِ کاملاً غلط هم سبز می‌شدند.
    const src = readFileSync(PANEL, 'utf8');
    const m = src.match(/const\s+tierName\s*=\s*\{([^}]*)\}/)!;
    for (const t of LOYALTY_TIERS) {
      const hit = m[1].match(new RegExp(`\\b${t.key}\\s*:\\s*'([^']+)'`));
      assert.ok(hit, `نامِ ${t.key} در پنل پیدا نشد`);
      assert.equal(hit[1], t.name,
        `نامِ سطحِ ${t.key} در پنل «${hit[1]}» است ولی بک‌اند «${t.name}» می‌گوید`);
    }
  });
});
