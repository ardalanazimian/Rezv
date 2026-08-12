# دستورهای دقیقِ استقرار (کارهای بیرون از محیطِ توسعه)

> ⚠️ **بخشِ ۱ (Push به GitHub) منسوخ است — به‌روزرسانیِ ۲۰۲۶-۰۸-۰۷.**
> این سند از دوره‌ای مانده که کد به‌صورتِ **zip + patch file** تحویل داده می‌شد
> (نه یک ریپویِ گیت که مستقیماً کار می‌شود). واقعیتِ فعلی: مخزن
> `github.com/ardalanazimian/Rezv` است (اصلاح‌شده ۲۰۲۶-۰۸-۱۲ — این خودِ
> یادداشتِ اصلاحی هم قبلاً اسمِ اشتباهِ `ardalanazim/RezervnoOSv2` را داشت)،
> Claude Code مستقیماً روی برنچ کار
> می‌کند و با PR واقعی (نه patch/zip) به `main` مرج می‌شود — رجوع کن به
> `CLAUDE.md` بخشِ «کار با Git و برنچ‌ها». بخش‌هایِ ۲ (Vercel) و ۳ (Supabase)
> پایین همچنان می‌توانند مرتبط باشند اگر آن سرویس‌ها واقعاً استفاده می‌شوند —
> ولی مقادیرِ نمونه (مثلِ `--scope ardalanaz2-4503s-projects`) را با مقادیرِ
> واقعیِ حسابِ فعلی جایگزین کن، کورکورانه کپی نکن.

مخزن (قدیمی، تاریخی): `https://github.com/ardalanaz/RezervnoOS` · ۱۶ کامیتِ آماده

هرچه در سطحِ سورس‌کد ممکن بود انجام شده. سه کار باقی است که به شبکه یا حسابِ
شما نیاز دارد. دستورها دقیقاً به همین ترتیب اجرا شوند.

---

## ۱) Push به GitHub

```bash
git clone https://github.com/ardalanaz/RezervnoOS.git
cd RezervnoOS
git checkout -b release/design-system-and-hardening

# فایل‌های rezervno-patches.zip را در ../patches باز کنید
git am ../patches/*.patch

# اگر تداخل داشت:
#   git am --abort
#   سپس محتویات rezervno-with-git.zip را (بدونِ پوشه‌ی .git) کپی کنید و:
#   git add -A && git commit -m "feat: design system + hardening"

git push -u origin release/design-system-and-hardening
```

⛔ هرگز `git push --force` نزنید — تاریخچه‌ی گیت‌هاب پاک می‌شود.

## ۲) Vercel

```bash
npm i -g vercel
vercel login
vercel link --scope ardalanaz2-4503s-projects
```

در داشبورد Vercel:
- **Root Directory** = `api`
- Framework = Next.js (خودکار تشخیص داده می‌شود؛ در `vercel.json` هم صریح آمده)
- Build/Install Command = پیش‌فرض (`postinstall` خودش `prisma generate` را اجرا می‌کند)

### متغیرهای محیطی (Production + Preview)
حداقلِ الزامی — بدونِ این‌ها اپ بالا نمی‌آید:
```
DATABASE_URL          postgresql://…  (رشته‌ی اتصالِ Supabase، حالتِ pooled)
DIRECT_URL            postgresql://…  (اتصالِ مستقیم برای migration)
REDIS_URL             rediss://…
JWT_SECRET            ≥۳۲ کاراکترِ تصادفی
JWT_REFRESH_SECRET    ≥۳۲ کاراکترِ تصادفی، متفاوت از بالا
ALLOWED_ORIGINS       https://rezervno.ir,https://www.rezervno.ir
CRON_SECRET           رشته‌ی تصادفیِ بلند (احرازِ هویتِ endpointهای cron)
```
اختیاری ولی برای فیچرهای واقعی لازم — فهرستِ کامل با توضیح در `api/.env.example`:
`KAVENEGAR_API_KEY` (پیامک) · `ZARINPAL_MERCHANT_ID` (پرداخت) ·
`PLATFORM_ADMIN_TENANT_ID` (پنلِ شرکت) · `EMAIL_API_KEY` · `FCM_SERVER_KEY`

تولیدِ secret:
```bash
openssl rand -base64 48
```

```bash
vercel --prod
```

## ۳) Supabase

اسکیمای پایگاه‌داده از قبل اعمال شده. ⚠️ عددِ «۳۷ جدول / ۱۳ migration» قدیمیه
— schema.prisma الان ۴۹ مدل داره. RLS: طبقِ یافته‌ی live-testِ ۲۰۲۶-۰۸-۱۲
(رجوع کن به `PROJECT-KNOWLEDGE.md` §۲) یک DBِ تازه‌ساز تا قبل از migration
۰۳۷ فقط ۱۵ از ۴۹ جدول RLS می‌گرفت؛ با migration `037-rls-core-tables.sql`
(همون روز، با تأییدِ صریحِ کاربر) رفع شد — یک DBِ تازه‌ساز الان واقعاً
RLS رویِ هر ۴۹ جدول داره (تست شد: ریستِ کامل + rebuild، ۴۹/۴۹، ۲۶۶ تستِ
بک‌اند سبز). پس از استقرار فقط بررسی کنید که SQL جدیدی در `api/prisma/sql/`
اضافه نشده باشد:

```bash
cd api
npx prisma migrate status
```

---

## پس از استقرار — چک‌لیستِ تأیید
```bash
# ۱. سلامت
curl -s https://<domain>/api/health

# ۲. CORS و هدرهای امنیتی
curl -sI https://<domain>/api/v1/restaurants | grep -i "strict-transport\|x-frame"

# ۳. cron (باید ۴۰۱ بدهد بدونِ secret — یعنی محافظت فعال است)
curl -s -o /dev/null -w "%{http_code}\n" https://<domain>/api/v1/maintenance/expire

# ۴. لاگ‌های اجرا
vercel logs <deployment-url>
```

## تأییدهایی که در محیطِ توسعه ممکن نبود
| ابزار | وضعیت | کجا اجرا می‌شود |
|---|---|---|
| `tsc --noEmit` | ✅ اجرا شد (نسخه‌ی سراسری) — صفر خطای واقعی | جابِ `build` در CI |
| `eslint` | ⛔ نصب نشد (رجیستری ۴۰۳) | جابِ `security` در CI |
| `tsx --test` | ⛔ نصب نشد | جابِ `test` در CI |
| `next build` | ⛔ نصب نشد | CI و Vercel |
| Playwright e2e | ⛔ نصب نشد | جابِ `e2e` در CI |

هر چهار مورد در `.github/workflows/ci.yml` تعریف شده‌اند و با نخستین push اجرا می‌شوند.
