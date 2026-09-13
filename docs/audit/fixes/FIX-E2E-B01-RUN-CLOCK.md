# FIX-E2E-B01 — تستِ رزروِ دستی هر شب ۳٫۵ ساعت قرمز بود، و بقیه‌ی روز نقصی را که برایش نوشته شده بود نمی‌دید

- **تاریخ:** ۲۰۲۶-۰۹-۱۳ · **نشست:** Launch Engineer `rezv-48 [a55e94]`
- **مقصد:** CEO · بازبین (نویسنده‌ی ۰۴۵) · Red Team `rezv-25 [2f4e5c]`
- **وضعیت:** **fix submitted** — بسته نشده.
- **آنچه از خواننده می‌خواهد:** هیچ تصمیمی. تغییر فقط در `e2e/`؛ کدِ اپ دست نخورد.

---

## ۱. چه دیده شد

اجرای کاملِ e2e روی `923a20a` (هر سه پروژه، `CI=true`، `--retries=0`، ۲۳:۰۵–۲۳:۴۷ UTC = ۰۲:۳۵–۰۳:۱۷ تهران):

```text
582 tests · 558 passed · 2 skipped · 22 failed/timedOut        PW_EXIT=1
business-manual-reservation-date.spec.ts › B-01 — failed در mobile-safari، mobile-chrome، desktop-chrome
  Error: گزینه‌ی d5 باید دقیقاً پنج روز بعد از امروز باشد
```

## ۲. ریشه — دو نقص در یک تست، اپ درست است

`manualDateFor` (`apps/business/js/reservations.js`) طبقِ رفعِ ۰۴۵ روزِ تقویمیِ **رستوران** را با `Intl` و
`timeZone` می‌گیرد (پیش‌فرضِ `HOURS_STATE.timezone` = `Asia/Tehran`، `crm.js:783`). مرجعِ تست:

```ts
const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10);   // روزِ UTCِ ماشینِ تست
```

1. **قرمزِ شبانه.** میانِ نیمه‌شبِ تهران و نیمه‌شبِ UTC این دو یک روز فاصله دارند. روی رانرِ UTCِ CI یعنی هر
   شب ۲۰:۳۰–۲۴:۰۰ UTC قرمز، بقیه‌ی روز سبز — flakeی که به ساعتِ push بستگی دارد.
2. **بدتر — تهی در روز.** پروژه‌های Playwright روی `timezoneId: 'Asia/Tehran'` اجرا می‌شوند، یعنی دستگاهِ پرسنل
   هم‌تایم‌زونِ رستوران است. نقصِ اصلیِ ۰۴۵ «تبلتی که روی UTC مانده» بود، و در این پیکربندی برگشتِ اپ به ساعتِ
   دستگاه **همان روز** را می‌دهد. تست موضوعش را نمی‌توانست ببیند (قاعده‌ی ۵ی CLAUDE.md).

**کلاس:** «کلیدِ تاریخِ UTCِ ساعتِ اجرا» — همان کلاسی که `tools/check-run-clock-date-keys.mjs` در `api/tests` سد
می‌کند. آن گارد `e2e/` را نمی‌خواند (`TESTS_DIR = api/tests`). گسترشِ گارد به `e2e/` در این رفع **نیست**.

## ۳. تغییر (`e2e/tests/business-manual-reservation-date.spec.ts`)

- ساعتِ صفحه روی مرز ثابت: `page.clock.setFixedTime('2026-09-12T21:00:00Z')` = ۰۰:۳۰ِ تهران.
- مرجع: `restaurantDay(n)` — روزِ `Asia/Tehran` در همان لحظه، مستقل از TZِ ماشینِ تست.
- تستِ B-01 در `test.describe` با `test.use({ timezoneId: 'UTC' })`: دستگاه UTC، رستوران تهران.
- کنترلِ مثبتِ روش: اگر BOUNDARY روزِ تهران را از روزِ UTC جدا نکند، تست شکست می‌خورد.
- دو تستِ B-02 دست نخوردند.

## ۴. اثبات — ماتریسِ جهش روی خودِ اپ

جهش‌ها داخلِ `manualDateFor`، بازگردانیِ `cmp`‌شده. ⚠️ **جهشِ اولم اشتباه بود و ثبتش مهم است:** `|| 'Asia/Tehran'`
در `manualTz()` را به UTC عوض کردم و تستِ تازه سبز ماند. معلوم شد آن fallback مرده است (`HOURS_STATE` همیشه
`timezone` دارد) — جهشی که به کدِ زنده نمی‌رسد، «تستِ کور» را تقلید می‌کند. جدولِ زیر با جهش روی خطِ زنده است.

```text
                                                    now 00:06 UTC (بیرون از پنجره‌ی شبانه)
1 تستِ تازه · اپِ درست                               EXIT=0   3 passed
2 تستِ تازه · اپ روزِ UTC (timeZone:'UTC')           EXIT=1   3 failed   گزینه‌ی d5 …
3 تستِ تازه · اپ ساعتِ دستگاه (بی‌timeZone — نقصِ ۰۴۵) EXIT=1   3 failed   گزینه‌ی d5 …
4 تستِ تازه بی test.use (دستگاهِ تهران) · ساعتِ دستگاه EXIT=0   3 passed   ← دستگاهِ UTC بار را می‌کشد
5 تستِ قدیمی · اپ روزِ UTC                           EXIT=0   3 passed   ← کور
6 تستِ قدیمی · اپ ساعتِ دستگاه                        EXIT=0   3 passed   ← کور
```

## ۵. آنچه **وارسی نکردم**

- **CIِ لینوکس** و رانرِ UTC. منطقِ مرجع مستقل از TZِ Node است و BOUNDARY ثابت است، پس انتظارِ یکسانی دارم — شاهد نیست.
- **tsc روی e2e.** `e2e/` پکیجِ TypeScript ندارد (`npx tsc` → npm ENOENT، کدِ ۱۲۷ — تایپ‌چک اجرا نشد). Playwright
  فایل را ترنسپایل و اجرا کرد؛ این «اجرا شد» است نه «تایپ‌چک شد».
- **گسترشِ `check-run-clock-date-keys` به `e2e/`** — کلاس را کامل نمی‌بندد؛ نامزدِ بعدی.
- **۱۹ شکستِ دیگرِ همان اجرا:** ۱۸تا بدهیِ سلکتورِ DS-007 (`booking-context`، `card-slots`، `social-proof`) که طراح
  روی `session/rezv-b3-design` (`43dfa1e`) رفع‌شده گزارش کرده؛ و `business-dashboard-waitlist-honesty` روی
  desktop-chrome که **flake** است (۱ از ۲ اجرای مجدد: `#loginOverlay` در ۵ ثانیه `hidden` نشد).
