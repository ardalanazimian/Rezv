# تست‌های E2E رزرونو

مجموعه‌ی تستِ end-to-end برای جریان‌های حیاتیِ اپ کاستومر، با Playwright.
موبایل‌محور (مخاطب: نسل‌Z) + دسکتاپ.

## چه چیزی تست می‌شود

⚠️ **این جدول اصلاح شد (۲۰۲۶-۰۸-۱۲) — ۶ فایلِ واقعی جا افتاده بودن.**

| فایل | جریان | چرا حیاتی است |
|------|-------|----------------|
| `smoke.spec.ts` | لود شدن اپ، ناوبری، زبان/جهت | خطِ اولِ دفاع |
| `booking.spec.ts` | کشف → رستوران → رزرو → تأییدیه | **مسیرِ پول** — مهم‌ترین |
| `booking-context.spec.ts` | تاریخِ واقعی + ماندگاریِ زمینه‌ی رزرو بینِ رستوران‌ها | قفلِ دو باگی که با اندازه‌گیریِ واقعی در مرورگر پیدا شدن |
| `waitlist.spec.ts` | اسلاتِ پر → پیوستن به لیست انتظار | نجاتِ درآمد |
| `auth.spec.ts` | ورود با شماره + OTP | لازم برای رزروِ کاربر |
| `auth-refresh.spec.ts` | بازیابیِ نشست: ۴۰۱ → `/auth/refresh` → retryِ خودکار | مسیرِ حیاتیِ auth که تا قبل از این تست پوششی نداشت |
| `accessibility.spec.ts` | aria، Escape، dialog، فوکوس | جلوگیری از رگرسیونِ a11y |
| `accessibility-landmarks.spec.ts` | ساختارِ سراسری (lang/dir، skip-link، landmarkها) + کیبوردِ Command Palette | مکملِ accessibility.spec.ts، سطحِ صفحه نه فقط کامپوننت |
| `panels-smoke.spec.ts` | لودِ بدونِ‌خطایِ پنلِ business/company + اسکلتِ اصلی | تنها e2eای که business/company اصلاً دارن (سطحِ ساختاری، نه جریان) |
| `panels-flow.spec.ts` | ورودِ واقعیِ staff (شماره→کد→enterPanel) در پنلِ business | فراتر از اسموک — جریانِ رفتاریِ واقعی، staff-auth mock می‌شه |
| `social-proof.spec.ts` | ادعاهایِ «اثباتِ اجتماعی» باید اندازه‌گیری‌شده باشن نه تخمینی | قفلِ رگرسیونِ سه ادعایِ فرانتی که قبلاً دیتایِ واقعی نبودن |

## راه‌اندازی

```bash
cd e2e
npm install
npx playwright install     # دانلودِ مرورگرها (یک‌بار)
```

## اجرا

**حالتِ mock (پیش‌فرض — قطعی، بدونِ بک‌اند):**
تست‌ها با `mockApi` پاسخ‌های API را شبیه‌سازی می‌کنند، پس بدونِ دیتابیس/سرور اجرا می‌شوند.

```bash
# اپ استاتیک خودکار serve می‌شود (نیاز به: npx serve)
npx playwright test

# فقط موبایل (iPhone)
npx playwright test --project=mobile-safari

# فقط مسیرِ رزرو
npx playwright test booking

# با UI تعاملی (برای دیباگ)
npx playwright test --ui
```

**اجرا روی Vercel یا دامنه‌ی واقعی:**
```bash
BASE_URL=https://your-app.vercel.app npx playwright test
```

**تستِ یکپارچه با بک‌اندِ واقعی:**
`mockApi` را در `beforeEach` غیرفعال کن (یا از یک فایلِ config جدا استفاده کن) و
`BASE_URL` را به محیطی بده که بک‌اندِ واقعی هم بالا باشد. آنگاه تست‌ها قراردادِ
واقعیِ front↔back را می‌سنجند (نه mock).

## نکته‌ی مهم

- shapeهای mock دقیقاً همان قراردادِ تأییدشده در ممیزیِ API هستند
  (رزرو: `{ code, ... }` در سطحِ بالا). اگر بک‌اند تغییر کند، هم mock هم
  `js/api.js` باید هم‌زمان به‌روز شوند.
- تستِ کاملِ screen reader و کنتراست باید روی **دستگاهِ واقعی** انجام شود؛
  `accessibility.spec.ts` فقط ساختار را چک می‌کند تا رگرسیون نگیریم.
