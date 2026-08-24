# راهنمای امنیت — رزرونو

دفاع چندلایه (Defense in Depth). هر لایه مستقل است؛ اگر یکی رد شد، بعدی می‌گیرد.

```
حمله ──▶ [۱. CDN/WAF لبه] ──▶ [۲. فایروال سرور] ──▶ [۳. nginx/Caddy]
         ──▶ [۴. fail2ban] ──▶ [۵. ریت‌لیمیت اپ + بن خودکار] ──▶ دیتابیس
```

---

## ✅ آنچه در بسته از قبل فعال است

**لایه ۳ (nginx/Caddy):**
- ریت‌لیمیت سه‌سطحی: ورود ۵/دقیقه، API ۳۰–۱۰۰/ثانیه، استاتیک ۶۰/ثانیه
- محدودیت اتصال هم‌زمان (ضد flood)
- تایم‌اوت کوتاه (ضد Slowloris)
- بلاک اسکنرها (sqlmap, nikto, nmap...) و بات‌های بی‌نام
- بلاک فایل‌های حساس (.env, .git, .sql)
- CSP کامل + HSTS + همه‌ی هدرهای امنیتی

**لایه ۵ (اپلیکیشن):**
- ریت‌لیمیت per-phone و per-IP روی OTP و رزرو
- **بن خودکار:** IP که ۱۰ بار در ۵ دقیقه ریت‌لیمیت بخورد، ۱ ساعت کامل بلاک می‌شود
- محافظت XSS (esc) در همه‌ی فرانت‌اندها

---

## 🔴 لایه ۱: CDN/WAF لبه (مهم‌ترین برای DDoS)

این قوی‌ترین دفاع است و **باید فعال شود**. حملات حجمی (لایه شبکه) را قبل از رسیدن به سرورت می‌گیرد.

### آروان‌کلاد (پیشنهادی برای ایران)

1. در پنل آروان، دامنه را اضافه کن
2. nameserverهای دامنه را به آروان تغییر بده
3. در بخش **امنیت**:
   - **محافظت DDoS** را فعال کن
   - **فایروال (WAF)** را روشن کن
   - **چالش (Captcha/JS Challenge)** برای ترافیک مشکوک
   - قانون ریت‌لیمیت در سطح شبکه: مثلاً حداکثر ۱۰۰ درخواست در دقیقه per IP
4. **CDN** را برای فایل‌های استاتیک فعال کن (سرعت + کاهش بار سرور)
5. حالت **"Under Attack"** را برای زمان حمله بشناس (یک کلیک)

### Cloudflare (جایگزین، پلن رایگان کافی)

مشابه بالا:
- DNS را به Cloudflare ببر، پروکسی (ابر نارنجی) را روشن کن
- Security Level: High
- "I'm Under Attack Mode" برای مواقع بحران
- WAF Managed Rules (در پلن رایگان پایه هست)
- Rate Limiting Rules

> **نکته‌ی مهم:** وقتی CDN فعال شد، آی‌پی واقعی سرورت را مخفی کن. مطمئن شو سرور فقط ترافیک از رنج آی‌پی CDN را می‌پذیرد (در فایروال زیر).

---

## 🔥 لایه ۲: فایروال سرور (UFW)

فقط پورت‌های لازم را باز کن:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH (بهتر: پورت غیراستاندارد)
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

**پورت دیتابیس را هرگز باز نکن** — postgres فقط در شبکه‌ی داکر در دسترس است (در compose اینطور تنظیم شده، پورت بیرونی ندارد).

### فقط ترافیک CDN را بپذیر (بعد از فعال‌کردن CDN)
وقتی همه‌ی ترافیک از CDN می‌آید، آی‌پی مستقیم را ببند تا مهاجم نتواند CDN را دور بزند:
```bash
# مثال برای آروان (رنج آی‌پی‌ها را از مستندات آروان بگیر)
# فقط رنج CDN به پورت ۸۰/۴۴۳ دسترسی داشته باشد
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp
sudo ufw allow from <رنج-آی‌پی-آروان> to any port 443
```

---

## 🛡 لایه ۴: fail2ban (بلاک خودکار مهاجم در سطح سیستم)

fail2ban لاگ را می‌خواند و IP مهاجم را در فایروال بلاک می‌کند.

```bash
sudo apt install fail2ban
```

فایل `/etc/fail2ban/jail.d/rezervno.conf`:
```ini
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https"]
logpath = /var/log/nginx/error.log
findtime = 600
maxretry = 10
bantime = 3600

[sshd]
enabled = true
maxretry = 3
bantime = 86400
```

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status      # وضعیت
```

> اگر nginx در داکر است، لاگش را به هاست mount کن تا fail2ban بخواند، یا از بن خودکار اپلیکیشن (که در بسته هست) استفاده کن.

---

## 🔒 سخت‌سازی سرور (پایه)

```bash
# به‌روزرسانی خودکار امنیتی
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades

# غیرفعال‌کردن ورود root با SSH و استفاده از کلید به‌جای رمز
sudo nano /etc/ssh/sshd_config
#   PermitRootLogin no
#   PasswordAuthentication no
sudo systemctl restart sshd

# نصب همیشگی پکیج‌های امنیتی
sudo apt install fail2ban ufw
```

---

## 🔑 امنیت در سطح اپلیکیشن (یادآوری)

قبل از لانچ مطمئن شو:
- [ ] `OTP_DEV_MODE=false` (تا کد OTP در پاسخ لو نرود)
- [ ] `JWT_SECRET` و `JWT_REFRESH_SECRET` طولانی و تصادفی (`openssl rand -base64 48`)
- [ ] `POSTGRES_PASSWORD` قوی
- [ ] HTTPS فعال (نه HTTP)
- [ ] `.env` در git نیست
- [ ] بک‌آپ خودکار + خارج از سرور فعال

---

## 📊 مانیتورینگ حمله

```bash
# لاگ nginx برای الگوی حمله
docker compose logs nginx | grep " 429 "      # ریت‌لیمیت‌خورده‌ها
docker compose logs nginx | grep " 403 "      # بلاک‌شده‌ها

# IPهای بن‌شده (در اپلیکیشن)
docker compose exec redis redis-cli KEYS "ban:*"

# پرمصرف‌ترین IPها
docker compose logs nginx | grep -oP '^\S+' | sort | uniq -c | sort -rn | head
```

---

## چک‌لیست نهایی امنیت

- [ ] CDN/WAF لبه فعال (آروان/Cloudflare) — **مهم‌ترین**
- [ ] فایروال UFW (فقط ۸۰/۴۴۳/SSH)
- [ ] آی‌پی مستقیم سرور بسته (فقط CDN)
- [ ] fail2ban نصب
- [ ] HTTPS فعال
- [ ] SSH سخت‌سازی‌شده (کلید، نه رمز)
- [ ] به‌روزرسانی خودکار امنیتی
- [ ] رمزها و کلیدهای قوی
- [ ] بک‌آپ خارج از سرور

با همه‌ی این لایه‌ها، سیستم در برابر اکثریت قاطع حملات (DDoS، brute-force، اسکن، injection) مقاوم است.
