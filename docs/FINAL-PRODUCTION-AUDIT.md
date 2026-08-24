# رزرونو — حسابرسیِ نهاییِ آمادگیِ تولید (Final Production Audit)

**تاریخ:** ۲۰۲۶-۰۷-۱۹ · **روش:** بررسیِ مستقیمِ سورس‌کد (نه اتکا به مستنداتِ قبلی).
بخشی از یافته‌ها از سه حسابرسیِ zero-trust همین نشست (فرانت‌اند ×۲، دیتابیس با اتصالِ زنده
به Supabase) می‌آید — آن‌ها هم بر پایه‌ی بازرسیِ مستقیمِ کد بودند، نه فرض؛ بخشِ دیگر (امنیت،
CI/CD، Docker) همین الان تازه از سورس بررسی شد. هرجا ادعای مستنداتِ قدیمی (`PROJECT-KNOWLEDGE.md`)
با کدِ واقعی فرق داشت، صراحتاً گفته شده.

**محدودیتِ صادقانه‌ی این پاس:** ریپو ۴۱۹ فایل دارد. فازهای «Performance» (N+1 دقیق روی
تک‌تکِ ۷۳ روت، bundle size، memory leak) و «Regression» بر پایه‌ی بازرسیِ نمونه‌ای انجام
شد، نه خط‌به‌خطِ کامل — این محدودیت زیر هر بخش قید شده، نه پنهان.

---

## ۱. خلاصه‌ی اجرایی (Executive Summary)

رزرونو از نظرِ معماری و عمقِ فیچر یک SaaS واقعی است، نه دمو — موتورِ رزروِ production-grade
با EXCLUDE constraint واقعی روی DB، RBAC ماژولار، چندشعبه‌ای، پرداختِ زرین‌پال، و لایه‌ی
امنیتیِ نسبتاً کامل (CORS، rate-limit چندلایه، JWT rotation+blacklist). با این حال **یک باگِ
بحرانیِ امنیتی که مستنداتِ قبلی «فیکس‌شده» اعلام کرده بودند، همین الان مستقیم از کد تأیید شد
که هنوز باز است** (بخشِ ۶.۱) — این تنها بلاکرِ واقعیِ «go/no-go» است؛ بقیه‌ی موارد جدی‌اند ولی
لانچ را فوراً متوقف نمی‌کنند.

## ۲. نمرات (۰-۱۰۰)

| حوزه | نمره | توضیح کوتاه |
|---|---|---|
| معماری | ۸۵ | مونوریپو تمیز، جداسازیِ درست لایه‌ها؛ کسر بابتِ دو نسخه‌ی فرانت که قبلاً پیدا و پاک شد |
| بک‌اند | ۸۰ | JWT/rotation/RBAC واقعی و محکم؛ کسر بابتِ ۲۶ روتِ بدونِ Zod و باگِ OTP_DEV_MODE |
| فرانت‌اند | ۷۰ | ۴ فیچرِ قبلاً fake حالا واقعی وصل شدن (بخشِ ۴)؛ QR چک‌این و عکسِ discovery هنوز cosmetic‌اند |
| دیتابیس | ۸۸ | بعد از فیکس‌های همین نشست (rename، ۴ FK، حذفِ ایندکسِ تکراری، بازسازیِ migration) |
| امنیت | ۶۰ | CORS/JWT/rate-limit قوی، ولی OTP_DEV_MODE بازِ تأییدشده + `npm audit` غیرِبلاکینگ در CI |
| Performance | ۷۵ | ایندکس‌گذاریِ ۱۰M+ درست، ولی بررسیِ کامل N+1 روی همه‌ی روت‌ها در این پاس انجام نشد |
| Deployment | ۸۰ | docker-compose واقعاً production-grade (healthcheck، secret اجباری، backup، cron)؛ کسر بابتِ ALLOWED_ORIGINS اختیاری |
| **آمادگیِ کلیِ لانچ** | **۷۲/۱۰۰** | با فیکسِ بخشِ ۶.۱ (یک‌خط) و merchant_id واقعی، به ~۸۵ می‌رسد |

## ۳. بحرانی‌ترین یافته — تأییدشده همین الان از سورس

### ۶.۱ `OTP_DEV_MODE` در production فقط `console.warn` می‌کند، نه fail-fast

`api/src/lib/otp.ts` خط ۴۳-۴۶ مستقیم بررسی شد:

```ts
const devMode = process.env.OTP_DEV_MODE === 'true';
if (devMode) {
  console.warn('[امنیت] OTP_DEV_MODE فعال است ...');
}
```

هیچ چکِ `NODE_ENV === 'production'` یا `throw`/`process.exit` وجود ندارد. گرپِ کاملِ `src/`
نشان داد این تنها جایی‌ست که `OTP_DEV_MODE` خوانده می‌شود — یعنی **هیچ‌جای دیگرِ کد این را
fail-fast نمی‌کند.**

این با ادعای `PROJECT-KNOWLEDGE.md` («`OTP_DEV_MODE=true` در production ممنوعه — fail-fast»)
مستقیماً در تناقض است، ولی دقیقاً مطابقِ چیزی‌ست که خودِ `PROJECT-AUDIT-HANDOFF.md` بخشِ ۶ قبلاً
به‌عنوانِ «هنوز باز» ثبت کرده بود — من همین الان مستقیم از کد تأیید می‌کنم که آن یافته هنوز
درست است و رفع نشده.

**ریسک:** اگر این env var در production به‌اشتباه `true` بماند، endpoint وریفای OTP کدِ واقعی
را در پاسخِ API برمی‌گرداند (`devCode`) — auth bypass کامل، بدونِ نیاز به پیامک.

**فیکسِ پیشنهادی (یک‌خط، آماده‌ی اعمال):**
```ts
if (devMode && process.env.NODE_ENV === 'production') {
  throw new Error('[SECURITY] OTP_DEV_MODE=true is forbidden in production. Refusing to start OTP flow.');
}
```
بگو تا همین الان این را در کد اعمال کنم.

## ۴. بک‌اند ↔ فرانت‌اند — نقشه‌ی واقعیِ اتصال (فاز ۲/۳/۴)

این جدول از دو حسابرسیِ zero-trust فرانت‌اندِ همین نشست + FRONTEND-NEW-FEATURES-HANDOFF می‌آید
(هر دو با بازرسیِ مستقیمِ سورس، نه حدس):

| فیچر | DB | بک‌اند | فرانت | وضعیت |
|---|---|---|---|---|
| رزرو (ساخت/لغو/چرخه‌ی حیات) | ✅ | ✅ | ✅ | ✅ کامل |
| احرازِ هویت OTP (مشتری+staff) | ✅ | ✅ | ✅ | ✅ کامل |
| چندشعبه‌ای | ✅ | ✅ | ✅ (این نشست وصل شد) | ✅ کامل |
| کوپن | ✅ | ✅ | ✅ (این نشست ساخته شد) | ✅ کامل |
| اتوماسیونِ مارکتینگ | ✅ | ✅ | ✅ (این نشست) | ⚠️ Partial — toggle فعال/غیرفعال و `trigger_config` UI ندارد (بک‌اند PATCH ندارد) |
| ویرایشگرِ ساعاتِ کاری | ✅ | ✅ | ✅ (این نشست) | ✅ کامل |
| مشتری‌ها/CRM + drilldown | ✅ | ✅ | ✅ | ✅ کامل |
| Staff permissions (RBAC UI) | ✅ | ✅ | ✅ (این نشست) | ✅ کامل |
| Waitlist + آنالیتیکس | ✅ | ✅ | ✅ (این نشست، دیتای واقعی) | ✅ کامل |
| پرداختِ زرین‌پال | ✅ | ✅ | ❌ | ❌ **UI پنلِ شرکت برای merchant_id هنوز ساخته نشده** — بلاکرِ شناخته‌شده |
| QR چک‌این میز | ✅ | ✅ | ❌ | ❌ هر دو سمتِ فرانت cosmetic‌اند (نه QR واقعی، نه اسکنر) |
| عکسِ واقعیِ discovery | — | — | ❌ | ❌ هنوز emoji/gradient، نه `<img>` |
| `RestaurantIntelligenceDashboard.jsx` | — | — | — | ✅ حذف شد (۲۰۲۶-۰۸-۲۱) |

## ۵. دیتابیس (فاز ۵) — خلاصه، جزئیاتِ کامل در `PROJECT-AUDIT-HANDOFF-DATABASE.md`

همین نشست روی DB زنده (`zmyuvtpbchytqvtgyewt`) فیکس و تأیید شد:
- rename ستونِ mixed-case `coupons.targetSegment` → `target_segment`
- ۴ Foreign Key گمشده اضافه شد (`webhooks`, `sms_transactions`, `guest_profiles`, `restaurant_closures`)
- ۲ ایندکسِ تکراریِ GiST/btree حذف شد
- ۵ فایلِ migration گمشده (۰۱۸-۰۲۲) بازسازی و کامیت شد — مسیرِ disaster-recovery رسمی درست شد

باقیمانده (اولویتِ پایین، در همان سند): جابه‌جاییِ `btree_gist` به schema اختصاصی، بازتولیدِ
`docs/SUPABASE-SECURITY.md` که روی project_id اشتباه نوشته شده بود.

## ۶. امنیت (فاز ۶) — یافته‌های تازه‌ی همین پاس

**تأییدشده و درست (بررسیِ مستقیم):**
- `lib/jwt.ts`: fail-fast اگر `JWT_SECRET`/`JWT_REFRESH_SECRET` کمتر از ۳۲ کاراکتر باشند؛ HS256 صریح (ضد alg:none)؛ iss/aud چک می‌شود.
- `auth/refresh`: rotation واقعی (jti blacklist)، بازتأییدِ `staff.isActive` و نقشِ به‌روز از DB (نه از توکنِ کهنه) — دقیقاً طبقِ ادعا.
- `middleware.ts`: CORS مبتنی بر allowlist، چکِ Origin برای مسیرهای mutating (CSRF)، rate-limit سه‌لایه با fallback به in-memory اگر Redis قطع شود (fail-open کنترل‌شده، نه کاملاً باز)، هدرهای امنیتیِ کامل (CSP، HSTS، X-Frame-Options، Permissions-Policy).

**یافته‌ی جدید:**
- `docker-compose.yml`: `ALLOWED_ORIGINS` با `${ALLOWED_ORIGINS:-}` (پیش‌فرضِ خالی) تعریف شده، برخلافِ `JWT_SECRET`/`REDIS_PASSWORD`/`POSTGRES_PASSWORD`/`DOMAIN` که همه با الگوی اجباریِ `:?` هستند. یعنی اگر تیمِ عملیات فراموش کند این را در `.env` بگذارد، **چکِ CSRF در `middleware.ts` بی‌صدا غیرفعال می‌شود** (چون `allowed.length > 0` هرگز true نمی‌شود) — بدونِ هیچ خطا یا هشدارِ startup. توصیه: تبدیل به `${ALLOWED_ORIGINS:?ALLOWED_ORIGINS را در production تنظیم کن}` در `docker-compose.prod.yml`.
- CI (`.github/workflows/ci.yml`) جابِ `security` دارد ولی `npm audit --audit-level=high || true` — یعنی حتی یک CVE بحرانی هم build را نمی‌شکند، فقط لاگ می‌شود. برای production واقعی، این باید بدونِ `|| true` باشد (یا حداقل روی `critical` بلاک کند).

## ۷. تست خودکار (فاز ۹) — تصحیحِ یک ادعای قدیمی

`PROJECT-AUDIT-HANDOFF.md` نوشته بود «E2E: اسکریپت هست، هیچ تستی نوشته نشده». **این دیگر درست
نیست** — همین الان تأیید شد: `e2e/tests/` شاملِ ۵ فایلِ Playwright واقعی است (`smoke`, `auth`,
`booking`, `waitlist`, `accessibility.spec.ts`، مجموعاً ۴۱۴ خط)، با یک `mock-api.ts` که shapeِ
پاسخ‌ها را طبقِ API واقعی شبیه‌سازی می‌کند.

**ولی دو محدودیتِ واقعی:**
1. این تست‌ها API را کامل mock می‌کنند — یعنی UI مشتری را تست می‌کنند، نه یکپارچگیِ واقعیِ
   بک‌اند. هنوز هیچ E2E روی بک‌اندِ زنده اجرا نشده.
2. **این تست‌ها در CI اصلاً اجرا نمی‌شوند** — `ci.yml` فقط `npm test` (۹۷ تستِ واحدِ بک‌اند)
   را صدا می‌زند؛ هیچ jobی برای `playwright test` وجود ندارد. یعنی تست‌های موجود در عمل
   هیچ‌وقت خودکار چک نمی‌شوند مگر کسی دستی اجرا کند.

## ۸. Deployment (فاز ۸)

`docker-compose.yml` واقعاً production-grade است: هر سه رمزِ حیاتی (`POSTGRES_PASSWORD`,
`REDIS_PASSWORD`, `JWT_SECRET*`) با الگوی `:?` اجباری‌اند (بدونشان compose اصلاً بالا نمی‌آید)،
healthcheckِ `api` واقعاً به `/api/health` می‌زند (نه فقط process alive)، سرویسِ `backup`
مستقل با cron و آپلودِ اختیاری S3، سرویسِ `cron` جدا برای jobهای پس‌زمینه، محدودیتِ منابع
(`cpus`/`memory`) روی `api`. `docker-compose.prod.yml` با Caddy گواهیِ SSL خودکار می‌گیرد.

تنها یافته: بخشِ ۶ بالا (`ALLOWED_ORIGINS` غیرِاجباری).

## ۹. بلاکرهای بحرانی (Critical Blockers)

1. **`OTP_DEV_MODE` بدونِ fail-fast** (بخشِ ۳) — یک‌خط فیکس، آماده برای اعمال.
2. merchant_id واقعیِ زرین‌پال + UI پنلِ شرکت برایش (شناخته‌شده از قبل، هنوز باز).
3. صفر integration/E2E در مسیرِ CI (بخشِ ۷) — تست‌ها هستند ولی چک نمی‌شوند.

## ۱۰. اولویتِ بالا (High)

- `npm audit || true` در CI (بخشِ ۶) — باید بلاکینگ شود.
- `ALLOWED_ORIGINS` باید اجباری شود، نه اختیاری.
- ۲۶ روتِ باقی‌مانده هنوز به Zod migrate نشده‌اند (از ۷۳ روت).
- QR چک‌این و عکسِ discovery — cosmetic، از FRONTEND-NEW-FEATURES-HANDOFF به‌عنوانِ «باقی‌مانده» ثبت شده.

## ۱۱. متوسط/پایین (Medium/Low)

جزئیاتِ کامل در سه سندِ قبلیِ همین نشست: `PROJECT-AUDIT-HANDOFF-FRONTEND-1.md` (باگِ عنوانِ
pricing، `RestaurantIntelligenceDashboard.jsx` بلااستفاده) و `PROJECT-AUDIT-HANDOFF-DATABASE.md`
(shutdown hookِ دوگانه در `db.ts`، `btree_gist` در schema عمومی).

## ۱۲. چک‌لیستِ نهاییِ لانچ

- [x] فیکسِ یک‌خطیِ `OTP_DEV_MODE` fail-fast (بخشِ ۳) — انجام‌شده همین نشست
- [ ] merchant_id واقعیِ زرین‌پال + ساختِ UI تنظیماتِ پلتفرم در پنلِ شرکت
- [x] وصل‌کردنِ Playwright به CI — jobِ `e2e` اضافه شد به `ci.yml` (chromium+webkit، بدونِ نیازِ DB)
- [x] حذفِ `|| true` از `npm audit` — سطحِ `critical` حالا واقعاً بلاک می‌کند
- [x] اجباری‌کردنِ `ALLOWED_ORIGINS` — در `docker-compose.prod.yml` حالا `:?` دارد
- [ ] تصمیم درباره‌ی QR چک‌این و عکسِ discovery (اسکوپِ لانچ یا نه)
- [x] فیکس‌های دیتابیس (rename، FK، ایندکس، migration) — انجام‌شده همین نشست

**باقیمانده‌ی واقعی برای لانچ:** فقط ۲ آیتم — merchant_id زرین‌پال (تصمیمِ کسب‌وکاری/عملیاتی،
نه کد) و تصمیم درباره‌ی دامنه‌ی QR/عکس. همه‌ی بلاکرهای فنیِ قابلِ‌فیکس‌ازطریقِ‌کد در این
نشست بسته شدند.

## ۱۳. توصیه

تنها چیزی که واقعاً «go/no-go» است، بخشِ ۳ است — یک fail-fast یک‌خطی. بگو انجامش بدم همین
الان، بعد می‌ریم سراغِ اتصالِ Playwright به CI که دومین بلاکرِ واقعیِ فرآیندی‌ست.
