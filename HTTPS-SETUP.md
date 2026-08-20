# راه‌اندازی HTTPS — رزرونو

این راهنما HTTPS را با **Caddy** فعال می‌کند: گواهی SSL خودکار از Let's Encrypt، تمدید خودکار، صفر تنظیم دستی.

> چرا HTTPS ضروری است: بدون آن، کدهای OTP و توکن‌های ورود روی شبکه قابل شنود هستند. **هیچ‌وقت بدون HTTPS نفروش/لانچ نکن.**

---

## پیش‌نیازها

⚠️ **اصلاح‌شده (۲۰۲۶-۰۸-۱۲):** این بخش قبلاً فقط از یک رکوردِ DNS برایِ کلِ
دامنه حرف می‌زد — از دورانی مانده که هنوز چیدمانِ زیردامنه (ADR 0002) وجود
نداشت. چک‌شده روی خودِ `deploy/caddy/Caddyfile`: امروز Caddy اصلاً بلوکی
برایِ ریشه‌ی دامنه (`rezervno.ir` بدونِ زیردامنه) **ندارد** — ریشه عمداً
دستِ Vercel است (وب‌سایتِ عمومی/apps/landing)؛ Caddy فقط چهار زیردامنه را
سرو می‌کند. با DNSِ قدیمیِ زیر، Caddy برای زیردامنه‌ها اصلاً گواهی نمی‌گیرد
و پنل‌ها/بک‌اند بالا نمی‌آیند.

1. **دامنه** — مثلاً `rezervno.ir` (از ایرنیک یا هر ثبت‌کننده‌ای)
2. **رکوردهایِ DNS** — پنج رکوردِ `A` لازم است، نه یکی:
   ```
   rezervno.ir.            A    (آی‌پیِ Vercel — طبقِ داشبوردِ Vercel، نه سرورِ خودت)
   www.rezervno.ir.         A    (همون، طبقِ Vercel)
   api.rezervno.ir.         A    188.x.x.x   (آی‌پیِ سرورِ خودت — بک‌اند)
   app.rezervno.ir.         A    188.x.x.x   (اپِ مشتری)
   business.rezervno.ir.    A    188.x.x.x   (پنلِ کسب‌وکار)
   admin.rezervno.ir.       A    188.x.x.x   (پنلِ شرکت)
   ```
   (ریشه/`www` به Vercel اشاره می‌کنند، نه به این سرور — رجوع کن به
   `docs/adr/0002-public-website-and-cms.md` و `deploy/caddy/Caddyfile`.)
3. **پورت‌های باز** — ۸۰ و ۴۴۳ روی سرور (فایروال/security group):
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   ```

> **مهم:** قبل از ادامه، مطمئن شو **هر چهار زیردامنه** واقعاً به سرور اشاره می‌کنن:
> ```bash
> dig +short api.rezervno.ir business.rezervno.ir app.rezervno.ir admin.rezervno.ir
> ```
> اگر DNS هنوز منتشر نشده (تا چند ساعت طول می‌کشد)، Caddy نمی‌تواند گواهی بگیرد.

---

## راه‌اندازی

```bash
# ۱) دامنه را در .env بگذار
nano .env
#   DOMAIN=rezervno.ir

# ۲) با override تولید اجرا کن
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

تمام! Caddy خودکار:
- گواهی SSL از Let's Encrypt می‌گیرد (چند ثانیه)
- HTTP را به HTTPS ریدایرکت می‌کند
- گواهی را هر ۹۰ روز قبل از انقضا تمدید می‌کند

بررسی (رویِ زیردامنه‌ها، نه ریشه — ریشه دستِ Vercel است و از این سرور جواب نمی‌ده):
```bash
docker compose logs caddy              # باید «certificate obtained» ببینی
curl -I https://api.rezervno.ir/api/health   # باید 200 برگردد
curl -I https://app.rezervno.ir        # اپ مشتری — باید 200 برگردد
```

---

## رفع اشکال

**گواهی گرفته نشد / خطای ACME:**
- مطمئن شو `dig +short دامنه‌ات` آی‌پی سرور را نشان می‌دهد (DNS منتشر شده)
- مطمئن شو پورت ۸۰ از بیرون باز است (Let's Encrypt برای تأیید به آن می‌زند)
- لاگ: `docker compose logs caddy`

**Let's Encrypt محدودیت نرخ دارد** (۵ گواهی ناموفق در ساعت). اگر زیاد تست کردی و گیر کردی، چند ساعت صبر کن یا برای تست از staging استفاده کن (به Caddyfile اضافه کن: `acme_ca https://acme-staging-v02.api.letsencrypt.org/directory`).

**می‌خواهی موقت بدون HTTPS تست کنی:**
```bash
docker compose --profile http up -d        # HTTP روی پورت ۸۰
```

**گواهی‌ها کجا ذخیره می‌شوند:**
در volume به نام `caddy_data`. این را پاک نکن (`docker compose down -v` پاکش می‌کند) وگرنه باید دوباره گواهی بگیری.

---

## بعد از HTTPS

وقتی دامنه با HTTPS کار کرد:
- `OTP_DEV_MODE=false` بگذار (تا کد OTP در پاسخ API لو نرود)
- `KAVENEGAR_API_KEY` را تنظیم کن (تا OTP واقعاً پیامک شود)
- سراغ بک‌آپ خودکار و CDN/WAF برو (در `LAUNCH-GUIDE.md`)
