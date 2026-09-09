# UNUSED_BACKEND_REPORT — رزرونو

> تشخیصِ بک‌اندِ بدونِ مصرف‌کننده. مبتنی بر grepِ کاملِ apps/ برای هر مسیر. تاریخ: ۲۰۲۶-۰۷-۳۰.
> **هیچ‌چیز حذف نشد.** طبقه‌بندی طبقِ خواسته: Dead / Legacy / Future / Mistake / Duplicate / Safe-To-Remove / Needs-Investigation.

## کاندیدهای Orphan (endpointِ بدونِ مصرف‌کننده‌ی فرانتِ تأییدشده)
| Endpoint | شواهد | طبقه‌بندی | چرا نه Safe-To-Remove |
|----------|-------|-----------|------------------------|
| `GET /api/v1/restaurant/fraud-signals` | صفر ارجاع در `apps/` | **Future Feature / Needs Investigation** | منطقِ ضدِتقلب پیاده است؛ احتمالاً UIِ پنل هنوز نیامده — حذف = ازدست‌رفتنِ قابلیت |
| `GET /api/v1/restaurant/reports` | صفر ارجاع در `apps/` | **Future Feature / Needs Investigation** | گزارش‌گیری backend آماده، UI بعداً؛ ممکن است در roadmap باشد |
| `GET/PATCH /api/v1/admin/settings` | صفر ارجاع در `apps/` | **Needs Investigation** | تنظیماتِ پلتفرم (مثلِ toggleِ پرداخت) شاید از مسیرِ دیگری خوانده شود |

## غیرِ-orphan (مصرف‌کننده‌ی غیرِفرانت — بلااستفاده نیستند)
- `maintenance/*` (۹): مصرف‌کننده = **سرویسِ cronِ Compose** (`cron/crontab` → `cron/run.sh`
  → `POST /api/v1/maintenance/<job>` با هدرِ `x-maintenance-key`). فعال.
  <!-- ⚠️ تصحیحِ ۲۰۲۶-۰۹-۰۹: می‌گفت «مصرف‌کننده = **Vercel Cron** (`api/vercel.json`)».
       آن فایل در ۲۰۲۶-۰۸-۲۸ حذف شد و `cron/crontab` تنها منبعِ حقیقتِ زمان‌بندی است.
       نتیجه‌ی «فعال» درست بود؛ **دلیلش** غلط بود — و یک دلیلِ غلط دقیقاً همان‌قدر
       خطرناک است، چون خواننده‌ای که بخواهد تأییدش کند به فایلِ ناموجود می‌رسد و
       ممکن است نتیجه بگیرد هیچ زمان‌بندی‌ای وجود ندارد. همین امروز رخ داد. -->
- `payments/callback`: مصرف‌کننده = **Zarinpal webhook**. فعال.
- `checkin`: مصرف‌کننده = **اسکنِ QRِ میز** (اپ مشتری، `POST /checkin`). فعال.
- `health`/`metrics`: مصرف‌کننده = **load-balancer/Prometheus**. فعال.

## سرویس/ماژول/مدلِ بلااستفاده
- **Services (lib):** همه از حداقل یک route وابسته‌اند (بررسیِ importها). موردِ سرویسِ بلااستفاده‌ی آشکار یافت نشد.
  - نکته: `zarinpal` فقط از `payments/*` و `subscription` مصرف می‌شود — فعال.
- **Models (Prisma):** ۳۸ مدل؛ بررسیِ عمیقِ هر مدل خارج از این ممیزیِ سریع است، ولی هسته‌ها (User, Reservation,
  Restaurant, WaitlistEntry, Payment, ChatThread/Message, PlatformEvent...) همه در routeها استفاده می‌شوند.
  **Needs deeper check:** مدل‌های کم‌استفاده مثلِ `Webhook`, `ClubCodeCounter` باید در فازِ جدا تأیید شوند.
- **Middleware:** تک‌فایل، کاملاً فعال.

## اقدامِ پیشنهادی (بدونِ حذفِ خودکار)
1. برای هر ۳ orphan: تصمیمِ محصول — «نگه‌داری برای UIِ آینده» یا «حذف». اگر حذف، به‌صورتِ PRِ کوچکِ جدا با
   تأیید و پس از grepِ نهایی.
2. مدل‌های `Webhook`/`ClubCodeCounter` را در یک بررسیِ جدا از نظرِ استفاده تأیید کن.

**هیچ موردی در این ممیزی Safe-To-Removeِ قطعی علامت نخورد — همه Needs-Investigation/Future.**
