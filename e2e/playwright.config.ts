import { defineConfig, devices } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
//  پیکربندی E2E رزرونو — موبایل‌محور (مخاطب: نسل‌Z)
//
//  مخاطبِ اصلیِ اپ کاستومر روی موبایل است، پس تست‌ها اول روی ویوپورت‌های
//  موبایل (iPhone/Pixel) اجرا می‌شوند، سپس دسکتاپ. جریان‌های حیاتیِ رزرو
//  باید روی هر دو کار کنند.
//
//  BASE_URL از env خوانده می‌شود:
//    • لوکال:   BASE_URL=http://localhost:8080  (اپ استاتیک را serve کن)
//    • Vercel:  BASE_URL=https://<your-app>.vercel.app
//  اگر تنظیم نشود، webServer پایین یک سرورِ استاتیکِ محلی بالا می‌آورد.
// ═══════════════════════════════════════════════════════════

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,          // در CI، test.only ممنوع (اشتباهِ رایج)
  retries: process.env.CI ? 2 : 0,       // در CI دو بار retry برای flakeهای شبکه
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',             // trace فقط موقعِ retry (برای دیباگ)
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    reducedMotion: 'reduce',
    // service worker را در تست بلاک می‌کنیم: کشِ SW در reload از سرو شدنِ نسخه‌ی
    // تازه جلوگیری می‌کرد (boot دوباره اجرا نمی‌شد) و منبعِ flake بود؛ تست‌ها به SW
    // نیازی ندارند.
    serviceWorkers: 'block',
  },

  // موبایل اول (اولویتِ نسل‌Z)، بعد دسکتاپ
  projects: [
    {
      name: 'mobile-safari',             // iPhone — مهم‌ترین برای نسل‌Z
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'mobile-chrome',             // اندروید
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // اگر BASE_URL محلی است، هر سه اپ استاتیک را خودکار serve کن.
  //   customer → 8080 (baseURL پیش‌فرض)، business → 8081، company → 8082
  // پنل‌ها e2e نداشتند؛ این سرورها به اسموکِ پنل‌ها (panels-smoke.spec) اجازه‌ی لود می‌دهند.
  webServer: process.env.BASE_URL ? undefined : [
    {
      command: 'npx serve ../apps/customer -l 8080',
      url: 'http://localhost:8080',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npx serve ../apps/business -l 8081',
      url: 'http://localhost:8081',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npx serve ../apps/company -l 8082',
      url: 'http://localhost:8082',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
