import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  appBase() — آدرسِ اپِ مشتری برایِ لندینگ
//
//  چرا این تست لازم بود: تا امروز (۲۰۲۶-۰۹-۰۸) درِ اپِ مشتری در /login از
//  `NEXT_PUBLIC_CUSTOMER_APP_URL` می‌خواند — متغیری که هیچ‌جا (نه CI، نه
//  Vercel) ست نمی‌شد، پس همیشه به fallbackِ /contact می‌افتاد بدونِ اینکه
//  دکمه «شکسته» به‌نظر برسد. این تست ثابت می‌کند appBase() بدونِ هیچ envی
//  خودش آدرس می‌سازد، پس دیگر حالتِ «پیکربندی‌نشده» وجود ندارد.
// ═══════════════════════════════════════════════════════════════════════

describe('appBase() — استخراجِ دامنه‌ی اپِ مشتری', () => {
  test('بدونِ NEXT_PUBLIC_APP_URL از رویِ SITE می‌سازد (app.<دامنه>)', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL; // یعنی SITE پیش‌فرضِ https://rezervno.ir را بگیرد
    const { appBase, SITE } = await import(`../lib/i18n.ts?case=default`);
    assert.equal(SITE, 'https://rezervno.ir');
    assert.equal(appBase(), 'https://app.rezervno.ir');
  });

  test('override صریح برنده می‌شود، حتی با اسلشِ انتهایی', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.staging.example.com/';
    const { appBase } = await import(`../lib/i18n.ts?case=override`);
    assert.equal(appBase(), 'https://app.staging.example.com');
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
});
