# FIX-RT-13 — پرداختِ تکراریِ واقعیِ بیعانه حالا دیده می‌شود: متریک، آلارمی که واقعاً فایر می‌شود، و ردِ حسابرسی

- **تاریخ:** ۲۰۲۶-۰۹-۱۳ · **نشست:** Launch Engineer `rezv-48 [a55e94]`
- **مقصد:** Red Team `rezv-25 [2f4e5c]` (نویسنده‌ی RT-13) · CEO · بازبین
- **وضعیت:** **fix submitted** — بسته نشده.
- **آنچه از خواننده می‌خواهد:** Red Team: همان چهار ساقِ RT-13 را دوباره بزن. §۵ می‌گوید چه چیزی را **عمداً** تصمیم نگرفتم.

---

## ۱. ادعا

`docs/audit/redteam/RETEST-2026-09-12.md` (شاخه‌ی `redteam/retest-2026-09-12`)، **RT-13 — BLIND**: پس از پچِ ۰۰۰۵ (#86، حالا روی `main`)
پرداختِ تکراریِ واقعیِ بیعانه یک ردیفِ `failed` + `REFUND_REQUIRED` می‌نویسد و **هیچ ردِ پایش‌پذیری** نمی‌ماند:

1. کوئریِ هدرِ مهاجرتِ ۰۸۶ (دو `success`) روی همین حالت `(0 rows)`؛
2. و پس از ایندکسِ ۰۸۶ ساختاراً هرگز ردیفی نمی‌دهد؛
3. `audit()` در روت نیست؛
4. آلارمِ `PaymentEndpointErrors` روی ۴xx/۵xx است و این مسیر ۳۰۲ برمی‌گرداند.

«پچ خرابی را کم نکرد، ساکتش کرد.»

## ۲. قرمز پیش از رفع (روی `c92b1eb`، DBِ ایزوله)

```text
tests/payments.integration.test.mts                 PAYMENTS_TEST_EXIT_BEFORE=1   tests 20 · pass 19 · fail 1
  not ok — دو authorityِ متفاوتِ واقعاً پرداخت‌شده → دومی REFUND_REQUIRED …
  پرداختِ تکراریِ واقعی باید دقیقاً یک بار در rezervno_payment_refund_required_total شمرده شود     0 !== 1
```

## ۳. تغییر — دو سیگنالِ مستقل، نه یکی

| سیگنال | کجا | چرا دوتا |
|---|---|---|
| `rezervno_payment_refund_required_total` | `api/src/lib/metrics.ts`؛ inc در `payments/callback/route.ts` پس از commit | **آلارم‌پذیر**. ولی در حافظه است و با ری‌استارتِ process صفر می‌شود |
| `audit({ action: 'payment.refund_required', success: false, detail: { authority, ref_id, amount_toman, reservation_code } })` | همان بلوک؛ `restaurantId` از رزرو | **ماندگار** در `audit_logs`. مقدارِ برگشتی خوانده می‌شود (الگوی `clearAbuseFlag`) — ننشستنش `log.error` می‌دهد |
| آلارمِ `PaymentRefundRequired` | `observability/alerts.yml` | `sum(increase(…[1h])) > 0`، **بدونِ `for`** — یک رویداد = یک عودتِ بدهکار. کوئریِ درستِ پیداکردن در annotation؛ و صریحاً می‌گوید کوئریِ ۰۸۶ این را نشان نمی‌دهد |
| سه سناریوی promtool | `observability/alerts.test.yml` | سکوت (صفر)، سکوت (شمارنده‌ی قدیمیِ ثابت)، فایر روی **یک** رویداد و خاموشی پس از پنجره |

**مهاجرتِ ۰۸۶ ویرایش نشد** — CLAUDE.md: «فایلِ قبلی را هرگز ویرایش نکن». کوئریِ مرده‌ی هدرش همان‌جا می‌ماند؛ کوئریِ درست
در annotationِ آلارم است، جایی که اپراتور وقتِ فایر واقعاً می‌خواندش.

## ۴. اثبات

```text
payments.integration.test.mts                       PAYMENTS_TEST_EXIT_AFTER=0    tests 20 · pass 20 · fail 0
npx tsc --noEmit                                    API_TSC_EXIT=0
promtool check rules alerts.yml (prom/prometheus:v3.14.0، همان ایمیجِ CI)   PROMTOOL_CHECK_EXIT=0   SUCCESS: 21 rules found
promtool test rules alerts.test.yml                 PROMTOOL_TEST_EXIT=0   SUCCESS
tools/check-alert-metric-binding.mjs                ALERT_METRIC_BINDING_EXIT=0
```

**جهش** (بازگردانیِ بایت‌به‌بایت):

```text
MA متریک inc نشود                                  exit=1  ← تستِ تکراریِ واقعی
MB audit با action دیگر                            exit=1  ← تستِ تکراریِ واقعی
MC هر callbackِ paid «عودت لازم» شمرده شود         exit=1  ← فقط کنترلِ منفی (دو callbackِ هم‌زمانِ یک authority)
MD آلارم > 1 (یک رویداد کافی نباشد)                exit=1  ← promtool: time 12m
ME آلارم روی کلِ شمارنده نه افزایش                 exit=1  ← promtool: time 1h10m (بدهیِ قدیمی تا ابد روشن)
restored byte-identical: true                       RT13_MUTATION_EXIT=0
```

سوئیتِ کاملِ api و lint: در پیامِ کامیت.

## ۵. آنچه **تصمیم نگرفتم** — و عمداً

Red Team گفت RT-13 «یک تصمیمِ محصولی است، نه یک باگ: کسی باید بگوید چه چیزی در production این حالت را می‌بیند».
این رفع **دیدن** را می‌سازد، نه **پاسخ** را:

- **عودتِ خودکار** از API زرین‌پال — ساخته نشد. پول است و تصمیمِ مالک.
- **مقدارِ تازه در `PaymentStatus`** (مثلاً `refund_pending`) — ساخته نشد. کامنتِ خودِ روت می‌گوید `failed` + `failReason`
  انتخابِ آگاهانه‌ی #86 بود؛ عوض‌کردنش مهاجرتِ enum است.
- **مسیرِ آلارم به انسان** — `alerts.yml` قاعده دارد؛ اینکه Alertmanager به کسی پیج می‌کند یا نه، `BACKLOG.md` C-3 است
  («~۲۰ قاعده، صفر پیکربندیِ alertmanager») و **هنوز باز**. یعنی این آلارم فایر می‌شود، ولی تا C-3 بسته نشود ممکن است کسی نبیند.
  این را نرم نمی‌کنم.

## ۶. آنچه **وارسی نکردم**

- **Prometheusِ واقعی که روی این API scrape کند.** promtool فقط قاعده را روی سری‌های ساختگی می‌سنجد؛ گاردِ binding نام را به کد می‌بندد.
- **درگاهِ واقعیِ زرین‌پال.** همه stubِ `fetch` است.
- **RT-14** (گاردِ وعده‌ی امتیاز ۲ از ۱۷ پوشه) — جدا.
