# ممیزیِ پیش از لانچ — دورِ هفتم

> ۲۰۲۶-۰۸-۲۸ · شاخه: `audit/pre-launch` · PR #79
> دورهای پیشین: `PRE-LAUNCH-AUDIT.md` · `-SUMMARY.md` · `-ROUND3.md` تا `-ROUND6.md`
> · `GATE-FALSIFIABILITY.md`

---

## ⛔ بازدارنده‌ی فعلی: دیسکِ ماشینِ توسعه پر شد

درایو `C:` به **صفر بایتِ آزاد** رسید. اثرش فوری بود: موتورِ داکر پاسخ نداد
(`read-only file system`)، `git status` با `index.lock write error` شکست، و
بازآزماییِ جهش‌ها وسطِ کار قطع شد.

کشِ npm (۲ گیگ، کاملاً بازتولیدشدنی) پاک شد → **۰.۸۴ گیگ آزاد**. کافی نیست.

| مسیر | حجم | وضعیت |
|---|---|---|
| `AppData\Local\Docker\wsl` | ۷.۰ GB | **دست‌نخورده** — شاملِ volumeهای Postgres |
| `AppData\Local\npm-cache` | ۲.۰ GB | پاک شد |
| `AppData\Local\Temp` | ۱.۶ GB | دست‌نخورده |
| `AppData\Local\ms-playwright` | ۰.۸ GB | دست‌نخورده (با `npx playwright install` برمی‌گردد) |

آرتیفکت‌های خودِ این نشست فقط ۹.۳ مگابایت بودند — عاملِ پرشدن نبودند.

**تصمیمِ لازم:** کدام مسیر آزاد شود. بدونِ فضا، ساختِ ایمیج و بازآزماییِ
جهش‌ها ادامه نمی‌یابد.

---

## 🔴 P0ِ تازه: ایمیجِ تولید حدودِ دو ماه است ساخته نمی‌شود

با در دسترس شدنِ داکر هاب، برای **اولین بار** ساختِ ایمیجِ api آزموده شد.
شکست خورد:

```
Error: Could not find Prisma Schema that is required for this command.
prisma/schema.prisma: file not found
process "/bin/sh -c npm ci || npm install" did not complete successfully: exit code: 1
```

**ریشه:** `api/package.json` هوکِ `postinstall: prisma generate` دارد. ولی
`api/Dockerfile:4-5` فقط `package.json` و lockfile را کپی می‌کند و بعد
`npm ci` می‌زند — `prisma/schema.prisma` تازه در خطِ ۶ (`COPY . .`) می‌آید. پس
هوک روی لایه‌ای شلیک می‌شود که اسکیما ندارد. مرحله‌ی `runner` (خطِ ۲۳-۲۴) هم
دقیقاً همین مشکل را دارد.

**قدمت:** آن هوک در `9b0928f` تاریخِ **۲۰۲۶-۰۷-۰۸** اضافه شده. یعنی از آن روز
ساختِ ایمیج از یک checkoutِ تمیز شکسته است. نامرئی ماند چون **هیچ jobی در CI
ایمیج نمی‌سازد** — همان الگویِ «شکافی که هیچ گیتی نمی‌بیند» که این ممیزی سه بار
دیگر هم گرفت. سیستمِ مستقرِ فعلی با ایمیجی کار می‌کند که پیش از آن تاریخ ساخته
شده.

**رفع (اعمال‌شده، تأییدنشده):** `--ignore-scripts` روی هر دو `npm ci`، و
`npx prisma generate` صریح بعد از `COPY . .` — یعنی همان کارِ postinstall، ولی
در لایه‌ای که واقعاً اسکیما دارد.

⚠️ **وضعیتِ راستی‌آزمایی:** ساختِ دوم از خطای prisma عبور کرد و ۶ مرحله جلو
رفت (`Could not find Prisma Schema` صفر بار)، سپس به همان مشکلِ دیسک خورد. پس
فقط می‌دانیم **علتِ اول برطرف شد**؛ ساختِ کاملِ ایمیج هنوز تأیید نشده.

---

## ۱. lint واقعاً گیت شد ✅ (commit `a42c275`)

**اندازه‌گیریِ اول:** با پیکربندیِ قبلی `src/` **صفر نقض** داشت — ولی این
بی‌معنا بود، چون تنها قاعده‌ی سطحِ `error` همان `no-var` بود و کلِ `tests/**`
(۱۲۲ فایل) از lint خارج.

سه تغییر:

| تغییر | چرا |
|---|---|
| `no-console` از `warn` به `error` | «`console.log` در کدِ تحویلی ممنوع» قاعده‌ی صریحِ پروژه است ولی CI اجرایش نمی‌کرد — تا امروز فقط چون کسی ننوشته بود نقض نشده بود |
| `tests/**` وارد lint شد | بدونِ بلوکِ پارسرِ TS، eslint این فایل‌ها را با پارسرِ JS می‌خواند و رویِ هر ۱۲۲ تا «Unexpected token :» می‌داد |
| `--max-warnings 0` + پسوندِ `.mts` | یک warning هم دیگر رد نمی‌شود |

**نقض‌ها پس از ورودِ tests: ۵ تا**، همه `no-unused-vars`. هر پنج **رفع شدند، نه
ساکت** — سه importِ بی‌مصرف (`before`، `sep`)، یک destructureِ بی‌مصرف
(`zonedTimeToUtc`)، و یک تابعِ کمکیِ کاملاً بی‌مصرف (`withStub`) که کدِ مرده
بود. هیچ `eslint-disable`ای اضافه نشد.

**اثباتِ شکست‌پذیری:**

```
console.log موقت در lib/economy.ts →  error no-console       exit=1
یک warningِ تنها (const بی‌استفاده) →  warning no-unused-vars  exit=1
کدِ سالم                            →                        exit=0
```

---

## ۲. اثبات روی لینوکس ✅

یک کامیتِ موقت (`8849722`) با یک sinkِ ناامن push شد. آرتیفکت‌های XSS و باندلِ
standalone عمداً بازتولید شدند تا **تنها** شکستِ ممکن خودِ ratchet باشد، نه
کهنگیِ آرتیفکت.

**نتیجه‌ی CI روی `ubuntu-latest`:**

```
job: design-system
   · Check design-system in sync with shared/        → success
   · Check standalone bundle is regenerated          → success
   · Check classic panel scripts parse               → success
   · XSS escaping regression                         → success
   ✗ Check XSS sink audit artifact is fresh          → failure
```

سپس revert شد و گیت دوباره سبز.

### تصحیحِ یک ادعای دورِ ششم

در `PRE-LAUNCH-ROUND6.md` نوشتم گاردِ XSS در jobِ `security` است. **غلط بود.**
`security` در خطِ ۲۴۳ و `design-system` در خطِ ۳۱۶ شروع می‌شود؛ فراخوانیِ
`xss-sink-audit.mjs --check` در خطِ ۳۲۷ است، یعنی متعلق به **design-system**.
همین اثباتِ لینوکسی نشانش داد: `security` سبز ماند و `design-system` قرمز شد.

---

## ۳. نمونه‌گیریِ پوشش — ناتمام

### یک اجرای باطل که نزدیک بود گزارش شود

اجرای اول هر ۲۵ جهش را «گرفته‌شده» اعلام کرد، هرکدام در ۱ ثانیه و با `✖0`.
دروغ بود: مجموعه‌ی فایل‌های تست به‌عنوان **یک آرگومان** پاس می‌شد، `tsx` مسیرِ
ناموجود می‌گرفت و `exit 1` می‌داد — که راننده «تست شکست، پس جهش گرفته شد»
تفسیر می‌کرد. هیچ تستی اجرا نشده بود.

**رفع + گاردِ دائمی:** پیش از هر جهش، همان فرمان رویِ کدِ **سالم** اجرا می‌شود؛
اگر آن‌جا هم قرمز باشد اندازه‌گیری متوقف می‌شود. دقیقاً همان قاعده‌ی
«سبز/قرمزِ بی‌معنا» که در `CLAUDE.md` ثبت شد، این‌بار علیهِ ابزارِ خودم.

### نتیجه‌ی دورِ اول (زیرمجموعه‌ی دست‌چین‌شده)

`گرفته‌شده: 10 / 25`

### بازآزماییِ زنده‌ماندگان رویِ **همه‌ی** تست‌های لمس‌کننده‌ی ماژول

مجموعه‌ی تست با grepِ واقعی ساخته شد، نه حدس: permissions ۳ فایل · jwt ۳۱ ·
otp ۷ · reservations ۱۶ · economy ۳.

| جهش | ماژول | نتیجه |
|---|---|---|
| P1 حذفِ بررسیِ `isActive` | permissions | **CAUGHT** (۴ تست) |
| P3 نبودِ رکوردِ مجوز = دسترسیِ کامل (fail-open) | permissions | 🔴 **SURVIVED** |
| P5 گاردِ نوعِ principal برداشته شود | permissions | 🔴 **SURVIVED** |
| J1 حذفِ حداقلِ طولِ کلید | jwt | **CAUGHT** (۵۱) |
| J2 عمرِ access از ۱۵ دقیقه به ۱۵ ساعت | jwt | **CAUGHT** (۱۶۱) |
| J3 تغییرِ الگوریتمِ امضا | jwt | **CAUGHT** (۱۴۱) |
| J4 تغییرِ `audience` | jwt | 🔴 **SURVIVED** |
| O2 حذفِ بررسیِ انقضای کد | otp | **CAUGHT** (۳) |
| O4 مقایسه‌ی هشِ نابرابر = «برابر» | otp | **CAUGHT** (۳) |
| O5 حذفِ قفلِ `OTP_DEV_MODE` در production | otp | **CAUGHT** (۳) |
| R1–R5 (رزرو) | reservations | ⏸ **بازآزمایی نشد** — قطعِ دیسک |

**سه سوراخِ پوششیِ تأییدشده:** `P3`, `P5`, `J4`. هر سه در مسیرِ مجوز/هویت‌اند.

پنج جهشِ رزرو (`off-by-one` در `partySize`، ظرفیتِ میز، تداخلِ میز، سقفِ آنلاین،
نبودِ میز) رویِ زیرمجموعه زنده ماندند ولی رویِ ۱۶ فایلِ کاملِ ماژول آزموده
نشدند — **نتیجه‌شان هنوز نامعلوم است، نه «سوراخ»**.

یک جهش در `jwt.ts` هنگامِ قطع بازگردانده نشده بود؛ بازگردانده و تأیید شد
(`AUD`، `HS256`، `15m` سرِ جایشان) و درخت تمیز است.

---

## ۴. رصدپذیری ✅ (commit `1deadd5`)

| # | اصلاح |
|---|---|
| الف | Prometheus و Grafana به `127.0.0.1` (پیش‌تر `0.0.0.0`؛ Prometheus هیچ احرازِ هویتی ندارد) |
| ب | `GRAFANA_PASSWORD` با `:?` اجباری شد و به `.env.example` اضافه — پیش‌تر پیش‌فرضِ `admin` داشت و اصلاً مستند نبود |
| ج | احرازِ scrape با `credentials_file` — نه `credentials: "${METRICS_TOKEN}"`، چون Prometheus متغیرِ محیطی را در فایلِ پیکربندی بسط نمی‌دهد |

**اثباتِ (د) — متریکِ واقعی، با Prometheusِ واقعی روی apiِ buildشده در
`NODE_ENV=production`:**

```
/api/metrics بدونِ توکن → 401 · با توکن → 200
target: job=rezervno-api  health=up      up{job="rezervno-api"} = 1

rezervno_http_requests_total{route=/api/v1/restaurants, status=200} = 11
rezervno_http_requests_total{route=/api/metrics,        status=401} = 1
rezervno_http_requests_total{route=/api/metrics,        status=200} = 3
rezervno_http_requests_total{route=/api/health,         status=200} = 1
```

`docker compose config`: بدونِ `GRAFANA_PASSWORD` → exit 1 · با آن → exit 0 ·
هر دو پورت `host_ip: 127.0.0.1`.

> **تله‌ی روشی:** اولین تلاش شکست خورد چون مسیرهای git-bash (`/c/...`) را
> Docker Desktop نمی‌فهمد — پیکربندی اصلاً mount نشد و Prometheus پیش‌فرضِ خودش
> را بار کرد و «سبز» به‌نظر رسید. با مسیرِ ویندوزی (`C:/...`) درست شد.

---

## وضعیت git

| commit | موضوع |
|---|---|
| `1deadd5` | رصدپذیری: بستنِ دو درِ باز + رفعِ scrape |
| `a42c275` | lint واقعاً گیت شد |
| (uncommitted) | رفعِ `api/Dockerfile` — تأییدنشده |

آخرین CIِ سبز: `a0429ad` با **۱۱ / ۱۱ job**.

---

## چه چیزی راستی‌آزمایی نشده

۱. **ساختِ کاملِ ایمیجِ داکر** پس از رفع — بسته بر فضای دیسک.
۲. **لایه‌ی ایمیج** (کاربرِ non-root، `dumb-init` به‌عنوان PID 1) — هدفِ اصلیِ
   آن ساخت بود و هنوز فقط از رویِ سورس خوانده شده.
۳. **بازآزماییِ R1–R5** — پنج جهشِ ماژولِ رزرو.
۴. **شش مرحله‌ی دودِ دستی** — همچنان بسته بر اعتبارنامه‌ی ملی‌پیامک.
۵. **۶۶ sinkِ `unsafe` و ۲۲ `review`** — قفل‌اند، تریاژ نشده‌اند.
۶. **هشت فیچر از شانزده‌تای فازِ ۵** و **شکلِ فیلدِ ~۲۵ endpointِ پنل**.
