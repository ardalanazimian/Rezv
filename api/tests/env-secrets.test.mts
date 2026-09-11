import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { isPlaceholderSecret, productionSecretProblems } = await import('../src/lib/env.ts');

// ═══════════════════════════════════════════════════════════════════════
//  رازهای خطرناکِ production — همان الگویِ allowed-origins.test.mts
//
//  چرا این فایل ساخته شد (ممیزی): دو مقدارِ پیش‌فرضِ `.env.example` خطرناک
//  بودند و هیچ‌کدام در زمانِ بالا آمدن چک نمی‌شدند:
//   • `OTP_DEV_MODE=true` → کدِ OTP در پاسخِ API برمی‌گردد (بای‌پسِ احراز هویت).
//     گاردِ موجود per-request بود، پس سرور سالم بالا می‌آمد و فقط **ورود**
//     با یک ۵۰۰ی بی‌توضیح می‌شکست.
//   • `MAINTENANCE_KEY=change-me-random-string` → `maintenance-auth.ts` همین
//     رشته‌ی نوشته‌شده در مخزن را مثلِ یک رازِ واقعی می‌پذیرفت، و پشتِ آن در
//     مسیرهایی مثلِ `maintenance/retention` است که داده پاک می‌کنند.
// ═══════════════════════════════════════════════════════════════════════

describe('isPlaceholderSecret', () => {
  test('مقادیرِ جانشینِ شناخته‌شده گرفته می‌شوند', () => {
    for (const v of [
      'change-me-random-string', 'change-me-random-hex', 'change-me',
      'CHANGE-ME-Random-String', 'changeme123', 'change-me-strong-password',
      'secret', 'TODO',
    ]) {
      assert.equal(isPlaceholderSecret(v), true, `«${v}» باید جانشین شمرده شود`);
    }
  });

  test('خالی/فاصله/undefined هم جانشین‌اند (یعنی «راز نداریم»)', () => {
    for (const v of ['', '   ', undefined, null]) {
      assert.equal(isPlaceholderSecret(v as string | undefined | null), true);
    }
  });

  test('⚠️ کنترلِ مثبت: رازِ واقعی هرگز رد نمی‌شود', () => {
    // بدونِ این تست، یک تابعِ «همیشه true» هم همه‌ی تست‌های بالا را پاس می‌کرد
    // — و آن‌وقت گارد کلِ سرویس را در production می‌خواباند.
    for (const v of [
      '9f2c1d8b4e7a3056c1f9b2d4e8a70536c1f9b2d4e8a70536c1f9b2d4e8a70536', // openssl rand -hex 32
      'exchange-rate-key',   // «change» دارد ولی با آن شروع نمی‌شود
      'S3cr3t-Real-Value',
    ]) {
      assert.equal(isPlaceholderSecret(v), false, `«${v}» نباید جانشین شمرده شود`);
    }
  });
});

describe('productionSecretProblems', () => {
  const SAFE = {
    OTP_DEV_MODE: 'false',
    MAINTENANCE_KEY: '9f2c1d8b4e7a3056c1f9b2d4e8a70536c1f9b2d4e8a70536c1f9b2d4e8a70536',
    JWT_SECRET: '4b1e9c7d2a8f5036b1e9c7d2a8f5036b1e9c7d2a8f5036b1e9c7d2a8f5036b1e',
    JWT_REFRESH_SECRET: 'c3a7f1d5b9e2064ac3a7f1d5b9e2064ac3a7f1d5b9e2064ac3a7f1d5b9e2064a',
  };

  test('پیکربندیِ سالم هیچ ایرادی ندارد', () => {
    assert.deepEqual(productionSecretProblems(SAFE), []);
  });

  test('🔴 OTP_DEV_MODE=true ایراد است', () => {
    const p = productionSecretProblems({ ...SAFE, OTP_DEV_MODE: 'true' });
    assert.equal(p.length, 1);
    assert.match(p[0], /OTP_DEV_MODE/);
  });

  test('OTP_DEV_MODE با هر مقدارِ دیگری (یا غایب) ایراد نیست', () => {
    for (const v of ['false', 'False', '1', undefined]) {
      assert.deepEqual(productionSecretProblems({ ...SAFE, OTP_DEV_MODE: v }), []);
    }
  });

  test('🔴 MAINTENANCE_KEYِ نمونه‌ی `.env.example` ایراد است', () => {
    const p = productionSecretProblems({ ...SAFE, MAINTENANCE_KEY: 'change-me-random-string' });
    assert.equal(p.length, 1);
    assert.match(p[0], /MAINTENANCE_KEY/);
    assert.match(p[0], /openssl rand -hex 32/, 'پیام باید راهِ درستش را هم بگوید');
  });

  test('🔴 MAINTENANCE_KEYِ غایب هم ایراد است', () => {
    const p = productionSecretProblems({ ...SAFE, MAINTENANCE_KEY: undefined });
    assert.equal(p.length, 1);
    assert.match(p[0], /MAINTENANCE_KEY/);
  });

  test('هر دو ایراد با هم گزارش می‌شوند (نه فقط اولی)', () => {
    const p = productionSecretProblems({ ...SAFE, OTP_DEV_MODE: 'true', MAINTENANCE_KEY: 'change-me' });
    assert.equal(p.length, 2);
  });

  // ── کلیدهای JWT (افزوده‌ی ۲۰۲۶-۰۹-۱۲) ──
  //
  // ⚠️ چرا طول کافی نبود: تنها گاردِ قبلی `lib/jwt.ts` بود که فقط
  // «طول ≥ ۳۲» را می‌سنجید، و جانشینِ `api/.env.example` دقیقاً ۳۳ کاراکتر
  // بود. یعنی یک رشته‌ی عمومیِ داخلِ مخزن، کلیدِ امضای همه‌ی توکن‌ها می‌شد.
  test('🔴 JWT_SECRETِ جانشین ایراد است — حتی وقتی از ۳۲ کاراکتر بلندتر است', () => {
    const thirtyThree = 'change-me-very-long-random-string';
    assert.equal(thirtyThree.length, 33, 'همان طولی که از چکِ jwt.ts عبور می‌کرد');
    const p = productionSecretProblems({ ...SAFE, JWT_SECRET: thirtyThree });
    assert.equal(p.length, 1);
    assert.match(p[0], /JWT_SECRET/);
    assert.match(p[0], /openssl rand -hex 32/);
  });

  test('🔴 JWT_SECRET یا JWT_REFRESH_SECRETِ غایب هم ایراد است', () => {
    assert.equal(productionSecretProblems({ ...SAFE, JWT_SECRET: undefined }).length, 1);
    assert.equal(productionSecretProblems({ ...SAFE, JWT_REFRESH_SECRET: undefined }).length, 1);
    assert.equal(
      productionSecretProblems({ ...SAFE, JWT_SECRET: undefined, JWT_REFRESH_SECRET: undefined }).length, 2,
      'هر دو کلید جدا گزارش می‌شوند',
    );
  });

  test('کلیدِ واقعیِ openssl هرگز ایراد شمرده نمی‌شود (کنترلِ منفی)', () => {
    assert.deepEqual(productionSecretProblems({
      ...SAFE,
      JWT_SECRET: 'a9f3'.repeat(16),
      JWT_REFRESH_SECRET: '7c2e'.repeat(16),
    }), []);
  });
});

describe('`.env.example` خودش مقدارِ خطرناک ندارد', () => {
  test('🔴 OTP_DEV_MODE و MAINTENANCE_KEYِ نمونه از گاردِ production رد نمی‌شوند', async () => {
    // ⚠️ §۴c: گاردی که فقط تابع را می‌سنجد، فایلی را که واقعاً کپی می‌شود
    // نمی‌بیند. اینجا خودِ `.env.example` خوانده می‌شود تا اگر کسی فردا
    // `OTP_DEV_MODE=true` را برگرداند، همین تست قرمز شود.
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
    const val = (k: string) => raw.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '';
    assert.equal(val('OTP_DEV_MODE'), 'false');
    assert.equal(isPlaceholderSecret(val('MAINTENANCE_KEY')), true,
      'MAINTENANCE_KEY در نمونه باید «غیرقابلِ استفاده» بماند، نه یک کلیدِ آماده');
  });

  // ⚠️ افزوده‌ی ۲۰۲۶-۰۹-۱۲ — همان §۴c، یک لایه بیرون‌تر: تستِ بالا فقط
  // `.env.example`ِ **ریشه** را می‌خواند. مخزن دو تا دارد، و دومی
  // (`api/.env.example`) همان است که `docs/ENVIRONMENT.md` «فهرستِ مرجعِ
  // runtimeِ بک‌اند» می‌نامدش و `docs/DEPLOY_API_VERCEL.md` می‌گوید مقادیرِ
  // Vercel را از آن بردار. تا امروز هیچ تستی بازش نمی‌کرد، و همان فایل
  // `OTP_DEV_MODE=true` و یک `JWT_SECRET`ِ ۳۳ کاراکتری داشت که از چکِ
  // «طول ≥ ۳۲»ِ jwt.ts عبور می‌کرد. حالا **هر دو** فایل سنجیده می‌شوند.
  test('🔴 `api/.env.example` — همان فایلی که runbookِ دیپلوی به آن ارجاع می‌دهد — هیچ کلیدِ آماده‌ای ندارد', async () => {
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const val = (k: string) => raw.match(new RegExp(`^${k}=([^#
]*)`, 'm'))?.[1]?.trim() ?? '';
    assert.equal(val('OTP_DEV_MODE'), 'false',
      'این فایل در production کپی می‌شود؛ true یعنی بای‌پسِ احراز هویت');
    for (const k of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
      assert.equal(isPlaceholderSecret(val(k)), true,
        `${k} در نمونه نباید مقدارِ قابلِ‌استفاده داشته باشد — با کلیدِ عمومی، جعلِ توکن ممکن است`);
    }
    assert.deepEqual(productionSecretProblems({
      OTP_DEV_MODE: val('OTP_DEV_MODE'),
      MAINTENANCE_KEY: val('MAINTENANCE_KEY'),
      JWT_SECRET: val('JWT_SECRET'),
      JWT_REFRESH_SECRET: val('JWT_REFRESH_SECRET'),
    }).length, 3, 'کپیِ خامِ این فایل باید در بوتِ production روی هر سه راز قرمز شود، نه سبز');
  });
});
