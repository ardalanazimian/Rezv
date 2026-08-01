# رزرونو — بازرسی امنیتی (OWASP Top 10)

بازرسی کامل کد واقعی و رفع آسیب‌پذیری‌ها. تاریخ: بازنگری production.

---

## خلاصه‌ی اجرایی

سیستم از ابتدا با امنیت قوی طراحی شده بود (JWT جدا، OTP هش‌شده، rate limiting چندلایه، queryRaw پارامتری، esc سراسری). این بازرسی **۵ آسیب‌پذیری واقعی** را یافت و رفع کرد، و چند لایه‌ی دفاعی اضافه نمود.

---

## یافته‌ها و رفع‌ها (طبق OWASP Top 10 2021)

### 🔴 A01 — Broken Access Control
**یافته:** Refresh token بدون امکان باطل‌سازی (revocation). اگر دزدیده می‌شد، ۳۰ روز معتبر بود.
**رفع:**
- لیست سیاه refresh token با Redis (`revokeRefreshToken`/`isRefreshRevoked`)
- **rotation:** هر بار refresh، توکن قدیمی باطل و جدید صادر می‌شود → پنجره‌ی سرقت کوتاه
- route خروج (`/auth/logout`) که توکن را باطل می‌کند
- `jti` (شناسه‌ی یکتا) در هر refresh token

**موجود و تأییدشده:** هر route پنل، تنانت را با `tenantId` از JWT چک می‌کند (جداسازی داده‌ی رستوران‌ها). میز/رزرو همیشه با مالکیت رستوران تطبیق داده می‌شود.

### 🔴 A02 — Cryptographic Failures
**یافته:** JWT بدون الزام صریح الگوریتم — آسیب‌پذیر به حمله‌ی algorithm confusion (مثلاً `alg:none` یا تغییر به RS256).
**رفع:**
- `algorithms: ['HS256']` صریح در verify (توکن دستکاری‌شده رد می‌شود)
- افزودن `issuer` و `audience` (جلوگیری از استفاده‌ی توکن در سرویس دیگر)
- بررسی طول secret (حداقل ۳۲ کاراکتر) با fail-fast

**موجود و تأییدشده:** OTP با sha256 + salt هش می‌شود (نه plaintext). secretهای جدا برای access/refresh.

### 🔴 A03 — Injection
**موجود و تأییدشده (امن):**
- **SQL Injection:** تنها `$queryRaw` با tagged template (`${tableId}::uuid`) — کاملاً پارامتری، غیرقابل تزریق. هیچ `queryRawUnsafe` یا الحاق رشته‌ای وجود ندارد.
- **XSS:** تابع `esc()` همه‌ی ورودی کاربر را قبل از درج در DOM فرار می‌دهد (HTML entityها). در هر سه فرانت استفاده می‌شود.
**رفع (دفاع در عمق):**
- ماژول `Validate` برای اعتبارسنجی نوع/طول/فرمت ورودی (str/int/uuid/date/time/array)
- `safeJson` با محدودیت ۱۰۰KB (جلوگیری از DoS با بدنه‌ی بزرگ)

### 🔴 A04 — Insecure Design
**موجود و تأییدشده:**
- جلوگیری از double-booking با دفاع چندلایه (EXCLUDE constraint + transaction سریالایزبل)
- منطق رزرو/لیست انتظار اتمیک (transaction)

### 🔴 A05 — Security Misconfiguration
**یافته:** کانتینر Docker با کاربر **root** اجرا می‌شد. اگر برنامه هک می‌شد، مهاجم دسترسی root در کانتینر داشت.
**رفع:**
- ساخت کاربر non-root اختصاصی (`nextjs`, uid 1001) در Dockerfile
- `USER nextjs` — اجرا با حداقل امتیاز
- `apk upgrade` برای وصله‌های امنیتی پایه
- `dumb-init` برای مدیریت صحیح سیگنال (جلوگیری از zombie process)
- همه‌ی فایل‌ها `chown` به کاربر non-root

**موجود و تأییدشده:** هدرهای امنیتی در nginx/Caddy (CSP, HSTS). `server_tokens off`. بلاک اسکنرها.
**رفع اضافه:** هدرهای امنیتی روی همه‌ی پاسخ‌های API در middleware (nosniff, X-Frame DENY, no-store).

### 🔴 A06 — Vulnerable Components
**وضعیت فعلی (۲۰۲۶-۰۸-۰۱):** `npm audit --audit-level=high` روی API و SEO اجرا شد.
اصلاح non-breaking با `npm audit fix` انجام شد، اما دو زنجیره‌ی high باقی ماند:

- Next.js 14 و وابستگی PostCSS — رفع رسمی پیشنهادی به upgrade major نسخه‌ی Next نیاز دارد.
- در SEO، زنجیره‌ی ESLint/`glob` نیز با نسخه‌ی فعلی Next به upgrade major وابسته است.

`npm audit fix --force` عمداً اجرا نشد، چون Next 16 تغییر breaking است و باید در شاخه‌ی
مهاجرت جداگانه با React، build، E2E و deployment کامل تست شود. تا آن زمان این مورد
**ریسک باز P1 برای production** است؛ استفاده از image optimizer/Server Actions و
remotePatterns باید در deployment محدود بماند. بررسی کد نشان داد این repository
فعلاً از `next/image`، Server Actions، `remotePatterns` و rewrites استفاده نمی‌کند؛
پس چند مسیر exploit در وضعیت فعلی فعال نیستند، اما patch سطح framework همچنان لازم است.

### 🔴 A07 — Authentication Failures
**موجود و تأییدشده (قوی):**
- OTP: کد ۵ رقمی، هش‌شده، انقضای ۲ دقیقه، حداکثر ۵ تلاش، حذف پس از استفاده
- **Brute force:** rate limit روی OTP (۳ درخواست/۱۰ دقیقه per phone) + بن خودکار IP
- **Replay attack:** OTP پس از یک بار استفاده حذف می‌شود (`db.otpCode.delete`)
- access token کوتاه‌مدت (۱۵ دقیقه)
**رفع:** rotation + revocation برای refresh (بالا).

### 🔴 A08 — Data Integrity Failures
**موجود:** JWT امضاشده. **رفع:** الزام الگوریتم (بالا) از جعل توکن جلوگیری می‌کند.

### 🔴 A09 — Logging & Monitoring
**موجود:** خطاها لاگ می‌شوند. **توصیه برای production:** ارسال لاگ بن خودکار و تخلفات rate limit به سیستم مانیتورینگ (در SECURITY-GUIDE.md).

### 🔴 A10 — SSRF
**موجود:** برنامه به URL کاربر درخواست نمی‌زند (سطح حمله صفر). تنها fetch به Kavenegar/FCM با URL ثابت.

---

## CSRF
API با JWT در هدر `Authorization` (نه کوکی) ذاتاً در برابر CSRF مقاوم است.
**رفع اضافه (دفاع در عمق):** چک `Origin` برای درخواست‌های mutating (POST/PATCH/DELETE) در middleware با `ALLOWED_ORIGINS`.

## Rate Limiting & API Abuse
- Sliding Window Log با Redis (دقیق‌تر از fixed-window)
- محدودیت per-route (OTP/رزرو/جستجو) + سراسری per-IP
- **بن خودکار:** IP با ۱۰ تخلف در ۵ دقیقه، ۱ ساعت بلاک
- لایه‌ی nginx/Caddy (سه‌سطحی) + توصیه‌ی CDN/WAF لبه

## File Uploads
هیچ آپلود فایلی در سیستم نیست → سطح حمله صفر. (عکس‌ها در فاز بعد با object storage و اعتبارسنجی نوع/اندازه اضافه می‌شوند.)

## Secret Management & Environment
- همه‌ی secretها از `process.env` (هیچ hardcode)
- `.env` در `.gitignore` و `.dockerignore`
- بررسی طول JWT secret با fail-fast
- **توصیه:** در production از secret manager (مثل Docker secrets یا Vault) استفاده شود.

---

## چک‌لیست استقرار امن

- [ ] `JWT_SECRET` و `JWT_REFRESH_SECRET` رشته‌های تصادفی ۳۲+ کاراکتری منحصربه‌فرد
- [ ] `ALLOWED_ORIGINS` با دامنه‌های واقعی فرانت تنظیم شود
- [ ] `MAINTENANCE_KEY` رشته‌ی تصادفی قوی
- [ ] HTTPS فعال (Caddy خودکار)
- [ ] CDN/WAF لبه فعال (آروان/Cloudflare) — تنها دفاع واقعی DDoS حجمی
- [ ] `npm audit` اجرا و آسیب‌پذیری‌ها رفع شود
- [ ] فایروال UFW + fail2ban (طبق SECURITY-GUIDE.md)
- [ ] بک‌آپ خودکار فعال و تست‌شده

---

## نکته‌ی صادقانه
این بازرسی روی **کد** انجام شد و type-check پاس کرد، اما تست نفوذ واقعی (penetration testing) روی سرور زنده انجام نشد. قبل از لانچ نهایی، یک تست نفوذ مستقل توصیه می‌شود. همچنین `prisma validate` و بررسی پیکربندی واقعی سرور باید انجام شود.
