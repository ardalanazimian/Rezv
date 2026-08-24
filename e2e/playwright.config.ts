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

// راهِ گریزِ اختیاری برای محیط‌هایی که مرورگرِ از پیش‌نصب دارند ولی نسخه‌اش با
// بیلدِ موردِ انتظارِ @playwright/test یکی نیست (مثلِ سندباکسِ توسعه، جایی که
// `playwright install` مجاز/ممکن نیست). در CI تنظیم نمی‌شود و رفتار عوض نمی‌شود.
const CHROMIUM = process.env.PW_CHROMIUM_PATH;
const chromiumLaunch = CHROMIUM ? { launchOptions: { executablePath: CHROMIUM } } : {};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,

  // ⚠️ فازِ ۲ (P2-6): مهلتِ کلیِ هر تست از ۳۰ به ۶۰ ثانیه.
  //
  // تشخیصِ مبتنی بر داده: هر شکستِ ناپایدارِ بررسی‌شده در این فاز (۵ + ۲ + ۲ + ۱
  // مورد در چهار اجرایِ کامل) **بدونِ استثنا** تایم‌اوتِ `page.goto`/`page.reload`
  // بود — هیچ‌کدام شکستِ assertion نبود، و همه با `--workers=1` پاس می‌شدند.
  // گلوگاه سرورِ استاتیکِ `npx serve` است که زیرِ بارِ هم‌زمانِ سه موتورِ مرورگر
  // اشباع می‌شود.
  //
  // چرا فقط navigationTimeout کافی نبود: مهلتِ ناوبری نمی‌تواند از مهلتِ کلیِ
  // تست فراتر رود، پس تا وقتی مهلتِ کلی ۳۰ ثانیه بود، مقدارِ ۶۰ ثانیه‌ی
  // ناوبری هرگز اثر نمی‌کرد (شواهد: accessibility-landmarks با پیامِ
  // «Test timeout of 30000ms» شکست خورد، نه پیامِ ناوبری).
  //
  // ۶۰ ثانیه هنوز به‌قدرِ کافی سخت‌گیر است که تستِ واقعاً معلق شکست بخورد.
  // **هیچ assertionی ضعیف نشده** — فقط محیطِ کندِ اجرا لحاظ شده.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,          // در CI، test.only ممنوع (اشتباهِ رایج)
  retries: process.env.CI ? 2 : 0,       // در CI دو بار retry برای flakeهای شبکه
  // ⚠️ فازِ ۲، Batch 15 — چرا محلی هم ۲ است و نه پیش‌فرضِ Playwright:
  //
  // پیش از این، محلی `undefined` بود، یعنی Playwright نصفِ هسته‌ها را می‌گرفت
  // (۴ روی این ماشین) در حالی که CI روی ۲ می‌ماند. نتیجه‌ی اندازه‌گیری‌شده در
  // اجرایِ ۱۹۳ تستی: سه شکست که **هر سه به‌تنهایی سبز بودند** و هیچ‌کدام شکستِ
  // assertion نبود — دقیقاً همان امضایِ اشباعِ `npx serve` که در کامنتِ
  // navigationTimeout مستند شده. یعنی محلی سخت‌گیرتر از CI بار می‌انداخت و
  // نتیجه‌اش دیگر پیش‌بینی‌کننده‌ی CI نبود.
  //
  // این «کم‌کردنِ سخت‌گیری» نیست: هیچ assertionی ضعیف نشد و هیچ retryای محلی
  // اضافه نشد (محلی همچنان `retries: 0` است، سخت‌گیرتر از CI). فقط بارِ
  // هم‌زمان روی سرورِ استاتیک با چیزی که CI واقعاً اجرا می‌کند یکی شد.
  workers: 2,
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

    // ⚠️ فازِ ۲ (P2-6): مهلتِ اختصاصیِ **ناوبری**.
    //
    // تشخیص از رویِ داده، نه حدس: هر شکستِ ناپایدارِ این سوئیت که بررسی شد
    // (۵ مورد در یک اجرا، ۲ مورد در دو اجرایِ بعدی) بدونِ استثنا یک تایم‌اوتِ
    // `page.goto` یا `page.reload` بود — **هیچ‌کدام شکستِ assertion نبود**، و
    // همه با `--workers=1` پاس می‌شدند. یعنی گلوگاه سرورِ استاتیکِ `npx serve`
    // است که زیرِ بارِ هم‌زمانِ سه موتورِ مرورگر اشباع می‌شود، نه منطقِ اپ.
    //
    // مهلتِ کلیِ تست (۳۰ثانیه) دست‌نخورده می‌ماند تا تستِ واقعاً کند همچنان
    // شکست بخورد؛ فقط خودِ ناوبری فرصتِ بیشتری می‌گیرد. هیچ assertionی ضعیف نمی‌شود.
    navigationTimeout: 60_000,
  },

  // موبایل اول (اولویتِ نسل‌Z)، بعد دسکتاپ
  projects: [
    {
      name: 'mobile-safari',             // iPhone — مهم‌ترین برای نسل‌Z
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'mobile-chrome',             // اندروید
      use: { ...devices['Pixel 5'], ...chromiumLaunch },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], ...chromiumLaunch },
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
