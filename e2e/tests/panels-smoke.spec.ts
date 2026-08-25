import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
//  اسموکِ پنل‌ها (business/company) — شبکه‌ی ایمنیِ پایه
//  business و company تا کنون هیچ e2e نداشتند. این اسموک فقط تأیید می‌کند که هر
//  پنل بدونِ خطا لود می‌شود و اسکلتِ اصلی (برند/سایدبار/landmark) رندر می‌شود —
//  تا رگرسیونِ ساختاری (مثلاً هنگامِ ادغام‌های بعدیِ کد) گرفته شود.
//  بک‌اند لازم نیست: پنل‌ها حالتِ دمو/آفلاین دارند و اسکلت از HTML استاتیک می‌آید.
//  (تستِ کاملِ جریان‌ها نیازِ mockِ APIِ staff/admin دارد — گامِ بعدی.)
// ═══════════════════════════════════════════════════════════

const PANELS = [
  { name: 'business (پنل کسب‌وکار)', url: 'http://localhost:8081/', title: /کسب‌وکار|رزرونو/ },
  { name: 'company (پنل شرکت)',      url: 'http://localhost:8082/', title: /شرکت|رزرونو/ },
];

for (const p of PANELS) {
  test(`${p.name} بدونِ خطا لود می‌شود و اسکلتِ اصلی رندر می‌شود`, async ({ page }) => {
    // P2-6: این spec هیچ مهلتِ اضافه‌ای نداشت و زیرِ بارِ کلِ سوئیت روی
    // `page.goto` تایم‌اوت می‌کرد (نه شکستِ assertion — تأییدشده در error-context).
    test.slow();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(p.url);

    // عنوانِ صفحه درست است
    await expect(page).toHaveTitle(p.title);
    // زبان/جهتِ RTL
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // برندِ سایدبار در DOM هست (اسکلتِ استاتیک)
    await expect(page.locator('.sb-brand').first()).toHaveCount(1);
    // landmarkِ main
    await expect(page.locator('#main')).toHaveCount(1);

    // هیچ خطای اجرا-نشده‌ی JS در بارگذاری رخ نداده باشد
    // (خطاهای شبکه‌ی fetch در حالتِ آفلاین pageerror نیستند و شمرده نمی‌شوند)
    expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
  });
}
