import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// import پویا عمداً — مطابقِ بقیه‌ی تست‌های این پروژه (باگ محیطیِ tsx+node:test).
const { addMonths, publicOrderView, SITE_RULES, TRIAL_DAYS, contextFromRequest, slugSeed } =
  await import('../src/lib/site-orders.ts');

describe('addMonths — تمدیدِ اشتراک بدونِ سرریزِ روز', () => {
  test('ماهِ ساده: ۱۵ فروردین + ۳ ماه', () => {
    const base = new Date(Date.UTC(2026, 0, 15));
    assert.equal(addMonths(base, 3).toISOString().slice(0, 10), '2026-04-15');
  });

  test('۳۱ ژانویه + ۱ ماه → ۲۸ فوریه (نه ۳ مارس)', () => {
    // این دقیقاً باگی است که setMonth بومی می‌سازد: مشتری چند روز اضافه می‌گرفت.
    const base = new Date(Date.UTC(2026, 0, 31));
    assert.equal(addMonths(base, 1).toISOString().slice(0, 10), '2026-02-28');
  });

  test('۳۱ ژانویه‌ی سالِ کبیسه + ۱ ماه → ۲۹ فوریه', () => {
    const base = new Date(Date.UTC(2028, 0, 31));
    assert.equal(addMonths(base, 1).toISOString().slice(0, 10), '2028-02-29');
  });

  test('۳۱ مه + ۱ ماه → ۳۰ ژوئن', () => {
    const base = new Date(Date.UTC(2026, 4, 31));
    assert.equal(addMonths(base, 1).toISOString().slice(0, 10), '2026-06-30');
  });

  test('۱۲ ماه دقیقاً یک سالِ بعد است', () => {
    const base = new Date(Date.UTC(2026, 7, 4));
    assert.equal(addMonths(base, 12).toISOString().slice(0, 10), '2027-08-04');
  });

  test('ساعتِ تاریخِ پایه حفظ می‌شود (تمدید نصفِ روز را نمی‌بلعد)', () => {
    const base = new Date(Date.UTC(2026, 2, 10, 13, 45, 30));
    const out = addMonths(base, 6);
    assert.equal(out.getUTCHours(), 13);
    assert.equal(out.getUTCMinutes(), 45);
  });

  test('ورودی تغییر نمی‌کند (تابعِ خالص)', () => {
    const base = new Date(Date.UTC(2026, 0, 31));
    const before = base.toISOString();
    addMonths(base, 5);
    assert.equal(base.toISOString(), before);
  });
});

describe('publicOrderView — نمای عمومیِ سفارش', () => {
  const row = {
    code: 'RZO-ABC123', kind: 'purchase', status: 'pending',
    planName: 'یک‌ساله', months: 12, amountToman: 65_000_000,
    businessName: 'رستوران نمونه', trialEndsAt: null,
    activatedAt: null, planExpiresAt: null, rejectedReason: null,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
  };

  test('فقط فیلدهای غیرحساس بیرون می‌روند', () => {
    const view = publicOrderView(row) as Record<string, unknown>;
    const keys = Object.keys(view);
    // هیچ‌کدام از این‌ها نباید در پاسخِ عمومیِ /site/orders/{code} باشند.
    for (const secret of ['phone', 'email', 'ip', 'userAgent', 'adminNote', 'tenantId', 'utmSource']) {
      assert.ok(!keys.includes(secret), `فیلدِ حساس نشت کرد: ${secret}`);
    }
  });

  test('مبلغ و مدت همان اسنپ‌شاتِ سفارش‌اند', () => {
    const view = publicOrderView(row) as Record<string, unknown>;
    assert.equal(view.amount_toman, 65_000_000);
    assert.equal(view.months, 12);
    assert.equal(view.plan_name, 'یک‌ساله');
  });

  test('تاریخ‌ها ISO می‌شوند و nullها null می‌مانند', () => {
    const view = publicOrderView(row) as Record<string, unknown>;
    assert.equal(view.created_at, '2026-08-01T10:00:00.000Z');
    assert.equal(view.activated_at, null);
    assert.equal(view.plan_expires_at, null);
  });

  test('سفارشِ فعال‌شده تاریخِ انقضا را نشان می‌دهد', () => {
    const activated = {
      ...row, status: 'activated',
      activatedAt: new Date('2026-08-04T12:00:00.000Z'),
      planExpiresAt: new Date('2027-08-04T12:00:00.000Z'),
    };
    const view = publicOrderView(activated) as Record<string, unknown>;
    assert.equal(view.status, 'activated');
    assert.equal(view.plan_expires_at, '2027-08-04T12:00:00.000Z');
  });
});

describe('SITE_RULES — سقفِ قیفِ سایت', () => {
  test('ساختِ دمو سخت‌گیرانه‌تر از خواندن است (هر فراخوان تنانتِ واقعی می‌سازد)', () => {
    assert.ok(SITE_RULES.trial.max < SITE_RULES.read.max);
    assert.ok(SITE_RULES.trial.windowMs >= 60 * 60_000);
  });

  test('هر قاعده پیشوندِ یکتا دارد (کلیدهای ریت‌لیمیت قاطی نشوند)', () => {
    const prefixes = Object.values(SITE_RULES).map((r) => r.prefix);
    assert.equal(new Set(prefixes).size, prefixes.length);
  });
});

describe('TRIAL_DAYS', () => {
  test('دوره‌ی آزمایشی ۳۰ روز است (همان عددی که سایت وعده می‌دهد)', () => {
    assert.equal(TRIAL_DAYS, 30);
  });
});

describe('contextFromRequest — انتسابِ کمپین', () => {
  const req = (headers: Record<string, string> = {}) =>
    new Request('https://api.rezervno.ir/api/v1/site/trial', {
      method: 'POST',
      headers: { 'x-real-ip': testIp(), ...headers },
    });

  test('UTM از بدنه خوانده و کوتاه می‌شود', () => {
    const ctx = contextFromRequest(req(), {
      utm_source: 'google', utm_campaign: 'x'.repeat(500), landing_path: '/demo',
    });
    assert.equal(ctx.utmSource, 'google');
    assert.equal(ctx.landingPath, '/demo');
    assert.equal((ctx.utmCampaign ?? '').length, 120);
  });

  test('مقدارِ غیررشته‌ای نادیده گرفته می‌شود (نه اینکه به رشته تبدیل شود)', () => {
    const ctx = contextFromRequest(req(), { utm_source: 42, utm_medium: null });
    assert.equal(ctx.utmSource, null);
    assert.equal(ctx.utmMedium, null);
  });

  test('User-Agent از هدر می‌آید و سقفِ طول دارد', () => {
    const ctx = contextFromRequest(req({ 'user-agent': 'M'.repeat(900) }), {});
    assert.equal((ctx.userAgent ?? '').length, 500);
  });

  test('نبودِ referrer در بدنه → از هدرِ referer', () => {
    const ctx = contextFromRequest(req({ referer: 'https://google.com/search' }), {});
    assert.equal(ctx.referrer, 'https://google.com/search');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  slugSeed — اعرابِ نامرئی داخلِ slug نمی‌ماند (D-31 · m-24)
//
//  چرا (ممیزیِ فول‌استک، ۲۰۲۶-۰۹-۱۷): کلاسِ `[^a-z0-9؀-ۿ]` کلِ بلاکِ
//  U+0600–U+06FF را نگه می‌دارد، و اعراب (U+064B..U+0652 و U+0670) هم داخلِ
//  همان بلاک‌اند. نتیجه‌اش slugی بود مثلِ «رستورانِ-سفرِ-آزمایشی» با دو کسره‌ی
//  نامرئی: کاربری که نامِ رستوران را می‌خواند و تایپ می‌کند به ۴۰۴ می‌رسید،
//  چون املایِ بدونِ اعراب رشته‌ی دیگری است (NFC هم یکی‌شان نمی‌کند — علامتِ
//  ترکیبیِ مستقل، فرمِ ترکیب‌شده ندارد).
//
//  حروفِ فارسی عمداً می‌مانند؛ فقط اعراب می‌رود.
// ═══════════════════════════════════════════════════════════════════════
describe('slugSeed — slug باید تایپ‌شدنی باشد (D-31)', () => {
  const DIACRITICS = ['\u064B', '\u064C', '\u064D', '\u064E', '\u064F', '\u0650', '\u0651', '\u0652', '\u0670'];

  test('اعرابِ نامرئی از slug حذف می‌شود', () => {
    const withMarks = 'رستورانِ سفرِ آزمایشی';
    const got = slugSeed(withMarks, '123456');
    for (const d of DIACRITICS) {
      assert.ok(!got.includes(d), `slug نباید U+${d.codePointAt(0)!.toString(16)} داشته باشد — got ${JSON.stringify(got)}`);
    }
    assert.equal(got, 'رستوران-سفر-آزمایشی', 'همان چیزی که یک انسان از رویِ نام تایپ می‌کند');
  });

  test('هر عَلامتِ اعراب جداگانه حذف می‌شود', () => {
    for (const d of DIACRITICS) {
      const got = slugSeed(`کافه${d}بار`, 'fallback');
      assert.equal(got, 'کافه‌بار'.replace('\u200c', ''), `U+${d.codePointAt(0)!.toString(16)} نماند`);
    }
  });

  // کنترلِ مثبت: مبادا «رفع» به قیمتِ حذفِ کلِ فارسی تمام شود
  test('کنترلِ مثبت: حروفِ فارسی و لاتین و رقم سرِ جای خود می‌مانند', () => {
    assert.equal(slugSeed('کافه رستوران ۱', 'fb'), 'کافه-رستوران-۱');
    assert.equal(slugSeed('Cafe Vista 2', 'fb'), 'cafe-vista-2');
    assert.equal(slugSeed('نون و نمک', 'fb'), 'نون-و-نمک');
  });

  test('نامِ فقط-اعراب به fallback می‌افتد، نه به رشته‌ی خالی', () => {
    assert.equal(slugSeed('\u0650\u064E', 'ab12cd'), 'ab12cd');
  });
});
