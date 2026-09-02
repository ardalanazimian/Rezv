import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  قراردادِ روی‌سیمِ توکن: iss / aud / alg  (نمونه‌گیریِ جهش، ۲۰۲۶-۰۸-۲۸)
//
//  ⚠️ چرا این فایل ساخته شد: جهشِ `const AUD = 'rezervno-api'` →
//  `'rezervno-api-v2'` از **هر ۳۱ فایلِ تستی که lib/jwt را لمس می‌کنند**
//  سالم رد شد. دلیلش هم روشن است: `signAccess` و `verifyAccess` هر دو از
//  همان ثابت استفاده می‌کنند، پس تغییرِ آن **خودسازگار** است و هیچ تستِ
//  رفت‌وبرگشتی آن را نمی‌بیند.
//
//  ولی بی‌ضرر نیست: `aud`/`iss` بخشی از قراردادِ روی‌سیم‌اند. عوض‌کردنشان
//  یعنی **هر توکنِ صادرشده‌ی موجود بی‌اعتبار می‌شود** — همه‌ی کاربران و
//  کارکنانِ واردشده در همان لحظه بیرون می‌افتند. چنین تغییری باید عمدی و
//  با مهاجرت باشد، نه یک ویرایشِ بی‌صدا که هیچ گیتی نمی‌بیند.
//
//  این فایل دو چیزِ متفاوت را پین می‌کند:
//    ۱. **مقدارِ تحت‌اللفظیِ** iss/aud/alg — عوض‌کردنشان اینجا قرمز می‌شود.
//    ۲. اینکه `verifyAccess` واقعاً aud/iss/alg را **بررسی** می‌کند — با
//       توکن‌هایی که با مقادیرِ بیگانه امضا شده‌اند.
//  بدونِ بندِ ۲، حذفِ کاملِ بررسی هم از بندِ ۱ رد می‌شد.
// ═══════════════════════════════════════════════════════════════════════

const { signAccess, verifyAccess } = await import('../src/lib/jwt.ts');

const SECRET = process.env.JWT_SECRET as string;
const SUB = '11111111-1111-1111-1111-111111111111';

/** ادعای رمزگشایی‌شده‌ی توکنی که خودِ اپ صادر کرده. */
function decodeOwn() {
  return jwt.decode(signAccess({ sub: SUB, kind: 'customer' })) as jwt.JwtPayload;
}

describe('قراردادِ روی‌سیمِ توکنِ access', () => {
  test('iss / aud / alg دقیقاً همان مقادیرِ منتشرشده‌اند', () => {
    const p = decodeOwn();
    assert.equal(p.iss, 'rezervno',
      'عوض‌کردنِ issuer همه‌ی توکن‌های موجود را بی‌اعتبار می‌کند');
    assert.equal(p.aud, 'rezervno-api',
      'عوض‌کردنِ audience همه‌ی توکن‌های موجود را بی‌اعتبار می‌کند');

    const header = JSON.parse(
      Buffer.from(signAccess({ sub: SUB, kind: 'customer' }).split('.')[0], 'base64url').toString(),
    );
    assert.equal(header.alg, 'HS256', 'الگوریتم باید صریح و ثابت بماند');
  });

  test('توکنِ خودی پذیرفته می‌شود — کنترلِ مثبت', () => {
    const payload = verifyAccess(signAccess({ sub: SUB, kind: 'customer' }));
    assert.equal(payload.sub, SUB);
    assert.equal(payload.kind, 'customer');
  });

  test('audienceِ بیگانه رد می‌شود', () => {
    const foreign = jwt.sign({ sub: SUB, kind: 'customer' }, SECRET,
      { algorithm: 'HS256', issuer: 'rezervno', audience: 'some-other-service', expiresIn: '15m' });
    assert.throws(() => verifyAccess(foreign), /UNAUTHORIZED|وارد/i,
      'verifyAccess باید audience را بررسی کند، نه فقط امضا را');
  });

  test('issuerِ بیگانه رد می‌شود', () => {
    const foreign = jwt.sign({ sub: SUB, kind: 'customer' }, SECRET,
      { algorithm: 'HS256', issuer: 'not-rezervno', audience: 'rezervno-api', expiresIn: '15m' });
    assert.throws(() => verifyAccess(foreign), /UNAUTHORIZED|وارد/i,
      'verifyAccess باید issuer را بررسی کند');
  });

  test('الگوریتمِ دیگر رد می‌شود (جلوگیری از algorithm confusion)', () => {
    const other = jwt.sign({ sub: SUB, kind: 'customer' }, SECRET,
      { algorithm: 'HS512', issuer: 'rezervno', audience: 'rezervno-api', expiresIn: '15m' });
    assert.throws(() => verifyAccess(other), /UNAUTHORIZED|وارد/i,
      'فهرستِ algorithms باید تک‌مقداری بماند');
  });
});
