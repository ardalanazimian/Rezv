import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رضایتِ اعلان‌رسانی (پروتکل §۱۳ و §۱۷)
//
//  چرا این تست وجود دارد — یک شکافِ واقعیِ رضایت:
//  اپِ مشتری پنج کلیدِ ترجیحِ اعلان داشت، ولی `setNotifPref` آن‌ها را **فقط
//  در localStorage** می‌نوشت و سمتِ سرور هیچ مفهومی از رضایت وجود نداشت
//  (تأییدشده با grep رویِ کلِ api/src: صفر ستون، صفر چک). یعنی کاربری که
//  «تخفیف و کش‌بک ویژه» را خاموش می‌کرد همچنان پیامکِ کمپین می‌گرفت.
//
//  حساس‌ترین قاعده‌ای که این‌جا قفل می‌شود: **فقط انصرافِ صریح احترام دارد.**
//  اگر «کلیدِ غایب» را انصراف فرض کنیم، همه‌ی کاربرانِ موجود بی‌صدا از
//  یادآوریِ رزروشان محروم می‌شوند — یک رگرسیونِ بدتر از خودِ باگ.
// ═══════════════════════════════════════════════════════════════════════

const { readNotificationPrefs, allowsCategory, NOTIFICATION_CATEGORIES, MARKETING_CATEGORIES } =
  await import('../src/lib/notification-prefs.ts');

describe('rezervno — رضایتِ اعلان (§۱۳/§۱۷)', () => {
  test('کاربرِ بدونِ ترجیح (کلیدِ غایب) همچنان دریافت می‌کند — بدونِ رگرسیون', () => {
    for (const c of NOTIFICATION_CATEGORIES) {
      assert.equal(allowsCategory({}, c), true, `دسته‌ی ${c} نباید بی‌دلیل مسدود شود`);
      assert.equal(allowsCategory(null, c), true, 'ستونِ خالی یعنی «نظری نداده»، نه «انصراف»');
      assert.equal(allowsCategory(undefined, c), true);
    }
  });

  test('انصرافِ صریح رعایت می‌شود', () => {
    assert.equal(allowsCategory({ offers: false }, 'offers'), false);
    // …و فقط همان دسته را می‌بندد، نه بقیه را
    assert.equal(allowsCategory({ offers: false }, 'reminder'), true);
  });

  test('`true`ِ صریح هم دریافت است', () => {
    assert.equal(allowsCategory({ offers: true }, 'offers'), true);
  });

  test('مقدارِ غیرboolean بی‌اثر است (نه انصراف، نه خطا)', () => {
    // ستونِ jsonb ممکن است با دستِ آدم یا کلاینتِ خراب مقدارِ عجیب بگیرد؛
    // هیچ‌کدام نباید به‌اشتباه «انصراف» تعبیر شود.
    for (const junk of ['false', 0, null, [], {}, 'no']) {
      assert.equal(allowsCategory({ offers: junk }, 'offers'), true,
        `مقدارِ ${JSON.stringify(junk)} نباید انصراف تعبیر شود`);
    }
  });

  test('کلیدِ ناشناخته دور ریخته می‌شود (ستون آلوده نمی‌ماند)', () => {
    const p = readNotificationPrefs({ offers: false, __proto__: 'x', evil: true, dna: true });
    assert.deepEqual(p, { offers: false, dna: true });
  });

  test('آرایه یا رشته به‌جایِ آبجکت → خالی، نه کرش', () => {
    assert.deepEqual(readNotificationPrefs([1, 2]), {});
    assert.deepEqual(readNotificationPrefs('offers'), {});
    assert.deepEqual(readNotificationPrefs(42), {});
  });

  test('دسته‌هایِ تبلیغاتی زیرمجموعه‌ی دسته‌هایِ شناخته‌شده‌اند', () => {
    for (const m of MARKETING_CATEGORIES) {
      assert.ok((NOTIFICATION_CATEGORIES as readonly string[]).includes(m),
        `دسته‌ی تبلیغاتیِ ${m} در فهرستِ دسته‌ها نیست`);
    }
    // `reminder` تراکنشی است و **نباید** تبلیغاتی حساب شود — وگرنه یادآوریِ
    // رزرو با انصراف از تبلیغات خاموش می‌شود.
    assert.ok(!MARKETING_CATEGORIES.includes('reminder' as never));
  });
});
