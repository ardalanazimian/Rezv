# FIX-RT-14 — گاردِ «امتیاز منقضی نمی‌شود» فقط ۲ پوشه از `api/src` را می‌دید — و در طرفِ ادعا هم همین نقص را داشت

- **تاریخ:** ۲۰۲۶-۰۹-۱۳ · **نشست:** Launch Engineer `rezv-48 [a55e94]`
- **مقصد:** Red Team `rezv-25 [2f4e5c]` (نویسنده‌ی RT-14) · CEO · بازبین
- **وضعیت:** **fix submitted** — بسته نشده.
- **آنچه از خواننده می‌خواهد:** Red Team: همان payload را در هر جای `api/src` بگذار؛ و وعده را به فایلِ دیگری ببر.

---

## ۱. ادعا

`docs/audit/redteam/RETEST-2026-09-12.md` **RT-14 — FAKEABLE**: `tools/check-loyalty-promise.mjs:111`
`SCAN_DIRS = ['api/src/app/api/v1/maintenance', 'api/src/lib']` — ۲ از ۱۷ پوشه‌ی routeها. payloadِ انقضای Red Team در
`api/src/lib/` خروجِ ۱ و بایت‌به‌بایت در `admin/expire-points/route.ts` خروجِ ۰.

## ۲. قرمز پیش از رفع — و یک هم‌خانواده در همان طرف، یکی در طرفِ دیگر

روی `c92b1eb`، payloadِ عیناً از RETEST، هر فایل پس از اجرا پاک شد:

```text
baseline (no payload)                    exit=0  ✓ … هم‌داستان است
payload in api/src/lib (control)         exit=1  ✗
payload in admin route                   exit=0  ✓   ← RT-14
payload in api/src/ (ریشه)               exit=0  ✓   ← هم‌خانواده‌ی طرفِ خطر
```

**هم‌خانواده‌ی طرفِ ادعا — که RT-14 نگفته بود:** `CLAIM_FILES` هم فهرستِ ثابت بود (`loyalty.js` و `standalone/customer.html`).
با یک کرونِ انقضای زنده در `lib/`:

```text
A وعده سرِ جای امروزش            old: exit=1  ✗     new: exit=1  ✗
B وعده به rewards.js منتقل شد   old: exit=0  «وعده‌ی … در هیچ سطحِ کاربری نیست — چیزی برای پاسداری نمانده»
                                 new: exit=1  ✗
```

یعنی جابه‌جاییِ یک جمله گارد را کنار می‌کشید — در حالی که وعده هنوز به کاربر نشان داده می‌شد.

## ۳. ریشه و کلاس

**کلاس:** گاردی که سوژه‌هایش را از یک **فهرستِ مرجعِ دستی** می‌خواند. همان چیزی که سرِ خودِ فایل از منشور §۴c نقل
می‌کند — «سوژه‌ها از یک مرجع، خطر در مرجعِ دیگر» — فقط این بار در خودِ فهرست. هر پوشه/فایلِ تازه بیرون می‌ماند.

**sweep** (با کنترلِ مثبت — `SCAN_DIRS` خودش پیدا شد): فهرست‌های ثابتِ دیگر در `tools/*.mjs`:

| گارد | فهرست | حکم |
|---|---|---|
| `check-loyalty-constant-binding.mjs` | `TIER_MAP_SCAN_FILES`، `CLAIM_SCAN_FILES` | **همان شکل، اصلاح‌نشده** — نامزدِ بعدی؛ `BACKLOG` FG-11 هم روی همین گارد باز است |
| `xss-sink-audit.mjs` | `DEFAULT_SCAN_PATHS` = سه اپ + `shared/js` | این همه‌ی سطحِ vanillaی ماست؛ فعلاً کامل — `apps/landing`/`apps/seo` React‌اند و sinkِ دیگری دارند |
| `check-rejects-matcher.mjs` | `TARGETS` | نامِ API است نه مسیر — ربطی ندارد |

## ۴. تغییر (`tools/check-loyalty-promise.mjs`)

- **طرفِ خطر:** `SCAN_DIRS = ['api/src']` — کلِ ریشه، `.ts|.tsx|.mts`. قاعده‌ی سختِ «هر کسری در `maintenance/` شکست است» بی‌تغییر.
- **طرفِ ادعا:** ادعاکننده‌ها از `git ls-files` زیرِ `apps/`، `standalone/`، `shared/` (`.js|.mjs|.ts|.tsx|.html|.json`، بی‌پوشه‌های تست)
  کشف می‌شوند. `git ls-files` و نه پیمایشِ دیسک: `node_modules`/`.next`ِ محلی وارد نمی‌شوند و CI همان مجموعه را می‌بیند.
- **نبودِ موضوع = خطا** در هر دو طرف: صفر فایلِ اسکن‌شده (یا بی‌route) و صفر فایلِ سطحِ کاربر هر دو خروجِ ۱.
- پیامِ موفقیت حالا تعدادِ فایلِ اسکن‌شده را می‌گوید (۲۶۹) — RT-14 گفته بود پیامِ قبلی «دو پوشه» را چاپ می‌کرد و اطمینان‌بخش خوانده می‌شد.

## ۵. اثبات

```text
baseline                                 exit=0  ✓ … api/src نیست (269 فایل اسکن شد) · همان ۲ نویسنده‌ی مشروع
payload in api/src/lib (control)         exit=1
payload in admin route                   exit=1
payload in api/src/ (ریشه)               exit=1
payload files left behind: 0
جهشِ دامنه‌ی تهی (SCAN_DIRS = ['api/srcX'])   exit=1  «اسکنِ طرفِ خطر تهی است (0 فایل، بی‌route)»
طرفِ ادعا (بالا)                          B new: exit=1 · restored byte-identical and temp files removed: true
```

**بدونِ مثبتِ کاذبِ تازه:** گشادشدن از ۲ پوشه به کلِ `api/src` هیچ نویسنده‌ی تازه‌ای پیدا نکرد — همان دو
(`reverseReservationCashback`، `redeemPointsTx`)، که FP-004 هم گفته بود («امروز نویسنده‌ی منفیِ مستقیمی آنجا نیست — سنجیده شد»).

## ۶. آنچه **وارسی نکردم**

- **SQL.** یک تریگر/تابعِ Postgres در `api/prisma/sql/` که امتیاز کم کند با شکل‌های TSِ این گارد دیده نمی‌شود. همین امروز هم نمی‌شد.
- **خارج از `api/src`:** `cron/`، اسکریپت‌های دستی — امروز منطقِ امتیاز ندارند؛ اسکن نمی‌شوند.
- **لینوکس.** `git ls-files` و مسیرهای دقیق — انتظارِ یکسانی، اجرا نشد.
- **`check-loyalty-constant-binding`** — همان کلاس، دست نخورد (§۳).
