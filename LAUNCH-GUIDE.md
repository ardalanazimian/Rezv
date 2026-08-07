# رزرونو — راهنمای عملیاتی لانچ

این سند آخرین گام قبل از لانچ واقعی است: راه‌اندازی HTTPS، دفاع DDoS، بک‌آپ، و چک‌لیست نهایی. کد آماده است؛ این‌ها کار سرور و زیرساخت‌اند.

> **پیش‌نیاز:** بسته‌ی `rezervno-full-deploy.zip` روی سرور مستقر شده و با `docker compose up -d` بالا آمده. اگر هنوز نشده، اول README آن بسته را دنبال کن.

---

## ۱. HTTPS / SSL — ضروری 🔒

بدون HTTPS، توکن‌های ورود و کدهای OTP روی شبکه قابل شنود هستند. **هیچ‌وقت بدون این لانچ نکن.**

### ساده‌ترین راه: Caddy (خودکار، رایگان)

Caddy گواهی Let's Encrypt را خودکار می‌گیرد و تمدید می‌کند. به‌جای nginx یا جلوی آن بگذار:

```bash
# نصب Caddy روی سرور (Ubuntu/Debian)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

فایل `/etc/caddy/Caddyfile`:

```
your-domain.com {
    # فرانت‌اندها و API را به nginx داخلی داکر پاس بده
    reverse_proxy localhost:80
}
```

```bash
sudo systemctl reload caddy
```

تمام — HTTPS خودکار فعال شد. Caddy گواهی را هر ۹۰ روز خودش تمدید می‌کند.

### جایگزین: certbot + nginx

اگر می‌خواهی روی همان nginx داکر بمانی:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
# گواهی‌ها در /etc/letsencrypt/live/your-domain.com/
```

سپس در `deploy/nginx/nginx.conf` یک server block برای `443` با `ssl_certificate` اضافه کن و در `docker-compose.yml` پورت `443` و mount گواهی‌ها را باز کن (کامنت‌هایش از قبل آنجاست).

---

## ۲. دفاع DDoS — CDN/WAF جلوی دامنه 🛡️

ریت‌لیمیت اپلیکیشن (که داری) لایه‌ی آخر است، نه اول. برای دفاع واقعی، یک CDN/WAF جلوی دامنه بگذار.

### ArvanCloud (ایرانی، پیشنهادی برای کاربر ایرانی)

1. در پنل ArvanCloud دامنه را اضافه کن
2. nameserverهای دامنه را به ArvanCloud تغییر بده
3. در بخش امنیت: **محافظت DDoS** و **فایروال** را فعال کن
4. قوانین rate-limit در سطح شبکه بگذار (مثلاً حداکثر N درخواست در ثانیه per IP)
5. **CDN** را برای فایل‌های استاتیک (فرانت‌اندها) فعال کن — سرعت بارگذاری چند برابر می‌شود

### جایگزین: Cloudflare (پلن رایگان کافی است)

مشابه بالا. "Under Attack Mode" برای مواقع حمله، و WAF rules برای مسدودکردن الگوهای بد.

> **چرا هر دو لازم است:** CDN/WAF حملات حجمی (لایه شبکه) را می‌گیرد؛ ریت‌لیمیت اپ سوءاستفاده‌ی منطقی (مثلاً اسپم OTP) را. یکی جایگزین دیگری نیست.

---

## ۳. بک‌آپ خودکار دیتابیس 💾

داده‌ی مشتری ارزشمندترین دارایی است. یک cron برای `pg_dump` بگذار.

اسکریپت `/opt/rezervno/backup.sh`:

```bash
#!/bin/bash
set -e
BACKUP_DIR=/opt/rezervno/backups
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# از داخل کانتینر postgres بک‌آپ بگیر
docker compose -f /opt/rezervno/docker-compose.yml exec -T postgres \
  pg_dump -U rezervno rezervno | gzip > "$BACKUP_DIR/rezervno_$TIMESTAMP.sql.gz"

# فقط ۱۴ بک‌آپ آخر را نگه دار
ls -t "$BACKUP_DIR"/rezervno_*.sql.gz | tail -n +15 | xargs -r rm

echo "✓ بک‌آپ: rezervno_$TIMESTAMP.sql.gz"
```

```bash
chmod +x /opt/rezervno/backup.sh
# هر روز ساعت ۳ صبح
echo "0 3 * * * /opt/rezervno/backup.sh >> /var/log/rezervno-backup.log 2>&1" | crontab -
```

**بازیابی** (در صورت نیاز):

```bash
gunzip -c backups/rezervno_TIMESTAMP.sql.gz | \
  docker compose exec -T postgres psql -U rezervno rezervno
```

> **مهم:** بک‌آپ‌ها را جای دیگری هم کپی کن (آبجکت‌استوریج آروان، یا یک سرور دیگر). بک‌آپی که روی همان سرور است، با از‌دست‌رفتن سرور از بین می‌رود.

---

## ۴. متغیرهای محیطی نهایی

قبل از لانچ، `.env` را کامل کن:

```bash
# دیتابیس — رمز قوی
POSTGRES_PASSWORD=$(openssl rand -base64 24)

# کلیدهای JWT — تصادفی و بلند
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)

# tenant مدیر پلتفرم (از خروجی seed کپی کن)
PLATFORM_ADMIN_TENANT_ID=<uuid-از-seed>

# پیامک کاوه‌نگار
KAVENEGAR_API_KEY=<کلید>
KAVENEGAR_TPL_OTP=rezervno-otp
KAVENEGAR_TPL_BOOKING=rezervno-booking
```

---

## ۵. ذخیره‌سازی عکس

**به‌روزرسانی (۲۰۲۶-۰۸-۰۷): این بخش منسوخ بود.** آپلودِ عکس/لوگو دیگر سمتِ
مرورگر/base64 نیست — از مدت‌ها پیش با یک مسیرِ واقعی جایگزین شده:
`POST /api/v1/restaurant/photos` (چندبخشی/multipart، `api/src/lib/media.ts`
برایِ sniffing/اعتبارسنجی، صفِ بازبینیِ انسانی قبل از انتشارِ عمومی، ذخیره روی
volumeِ `uploads` در `docker-compose.yml`). لوگو هم از همین مسیر با
`category='logo'` رد می‌شود. رجوع کن به `SECURITY-AUDIT.md` بخشِ File Uploads
برایِ جزئیاتِ امنیتی.

اگر هدف مهاجرت از volumeِ محلی به آبجکت‌استوریج (آروان/S3) است (برای
مقیاسِ چند-سرور)، آن هنوز کار نشده — ولی endpoint/اعتبارسنجی/صفِ بازبینی
همه از قبل آماده‌اند؛ فقط لایه‌یِ ذخیره‌سازیِ فیزیکی باید عوض شود.

---

## ✅ چک‌لیست نهایی قبل از لانچ

کد:
- [x] سه فرانت‌اند به API وصل (انجام‌شده)
- [x] احراز هویت مشتری (OTP) — انجام‌شده
- [x] احراز هویت کارمند و مدیر — انجام‌شده
- [x] ریت‌لیمیت روی همه‌ی endpointها — انجام‌شده
- [ ] seed کامل اجرا شده (`docker compose exec api npx prisma db seed`)
- [ ] `sms.ts` با نسخه‌ی کاوه‌نگار جایگزین شده
- [x] ذخیره‌سازی عکس — انجام‌شده (بخشِ ۵ بالا؛ فقط مهاجرت به آبجکت‌استوریج برایِ مقیاسِ چند-سرور باقی مانده، بلاکرِ لانچ نیست)

زیرساخت:
- [ ] HTTPS فعال (Caddy یا certbot)
- [ ] CDN/WAF جلوی دامنه (ArvanCloud/Cloudflare)
- [ ] بک‌آپ خودکار دیتابیس (cron + کپی خارج از سرور)
- [ ] پورت دیتابیس از بیرون بسته (فقط شبکه‌ی داکر — در compose از قبل این‌طور است)
- [ ] `.env` با رمزها و کلیدهای قوی و تصادفی
- [ ] `.env` در git نیست (در .gitignore هست)

امنیت:
- [x] فرانت‌اندها XSS-safe (تابع esc)
- [ ] escape سمت سرور هم اضافه شده (چون مهاجم می‌تواند مستقیم به API بزند)
- [ ] تست نفوذ ساده (حداقل: تلاش ورود با شماره غیرمجاز، اسپم OTP، رزرو هم‌زمان)

عملیات:
- [ ] مانیتورینگ لاگ خطاها و نرخ ۴۲۹
- [ ] یک شماره/ایمیل پشتیبانی برای مشکلات کاربران
- [ ] صفحه‌ی وضعیت (status page) برای زمان‌های قطعی

---

## جمع‌بندی: از اینجا تا لانچ

**آماده است:** کل کد (سه اپ + بک‌اند + ورود + ریت‌لیمیت)، همه تست‌شده.

**کار تو (روی سرور):** HTTPS، CDN، بک‌آپ، اجرای seed، گذاشتن کلید کاوه‌نگار. این‌ها چند ساعت کارند، نه چند هفته.

**فاز ۴ (بعد از لانچ، به‌روزرسانیِ ۲۰۲۶-۰۸-۰۷):** ذخیره‌سازیِ عکس ساخته شده (این‌ها منسوخ شدند)؛ آنچه واقعاً باقی مانده: مهاجرتِ اختیاریِ ذخیره‌سازی به آبجکت‌استوریج برایِ مقیاسِ چند-سرور، صفِ پیامکِ عمومی‌تر (BullMQ در صورتِ نیاز)، و بهبودهای تدریجی بر اساسِ بازخوردِ کاربرانِ واقعی. رجوع کن به `LAUNCH-GAPS.md` برایِ فهرستِ زنده‌یِ شکاف‌ها.

موفق باشی! 🌿
