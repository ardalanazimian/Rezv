# CHANGELOG — فاز v2 (هوش مشتری، کوپن، کمپین خودکار، RBAC)

## ادغام‌شده در این بسته (نسبت به نسخه‌ی قبلی deploy)

| بخش | فایل‌ها | وضعیت |
|---|---|---|
| Schema | `api/prisma/schema.prisma` | ✅ ادغام‌شده (مدل‌های جدید + فیلدهای جدید Reservation/User/Staff/Restaurant) |
| No-show + CLV | `api/src/lib/customer-insights.ts` | ✅ ادغام‌شده + قلاب در `lib/reservations.ts` (امتیاز در لحظه‌ی ثبت رزرو محاسبه می‌شود) |
| Coupon Engine | `api/src/lib/coupons.ts` | ✅ ادغام‌شده (لایه‌ی منطق؛ اعمال در checkout ✅ انجام شد (به CHANGELOG-v3-enterprise.md بخش ۶ مراجعه کن)) |
| Marketing Automation | `api/src/lib/automation.ts` | ✅ ادغام‌شده |
| RBAC | `api/src/lib/permissions.ts` | ✅ ادغام‌شده |
| API routes (۸ اندپوینت جدید) | `api/src/app/api/v1/restaurant/{customers,coupons,automations,staff,reports,ai}` + `maintenance/customer-insights` | ✅ ادغام‌شده |
| Cron | `cron/crontab` | ✅ خط جدید اضافه شد (۳ بامداد، روزانه) |
| React UI | `apps/business/src-v2/RestaurantIntelligenceDashboard.jsx` | ⚠️ کنار پنل فعلی قرار گرفت، هنوز mount نشده (پنل فعلی Vanilla JS است — توضیح کامل پایین) |

## هماهنگ‌سازی با Project Knowledge

سند `PROJECT-2.md` در دانش پروژه از قابلیت‌هایی مثل «smart-data» و تحلیل پیشرفته
به‌عنوان امری انجام‌شده یاد کرده بود، اما در کد واقعی deploy شده وجود نداشت.
این فاز دقیقاً همان شکاف را با پایه‌ی متفاوت (rule-based AI به‌جای ادعای ML)
پر می‌کند. اگر بخوای، می‌تونم یه نسخه‌ی به‌روزشده از PROJECT-2.md هم بسازم که
وضعیت واقعی فعلی (پس از این ادغام) رو منعکس کنه — چون فایل پروژه read-only است
و من نمی‌توانم مستقیماً Project Knowledge را ویرایش کنم، فقط می‌توانم نسخه‌ی
جدید را به‌عنوان فایل خروجی بسازم تا خودت جای‌گزین کنی.

## کاری که هنوز دستی نیاز دارد

1. **اعمال کوپن در محاسبه‌ی صورت‌حساب**: `validateCoupon`/`calcDiscount`/`redeemCoupon`
   از `lib/coupons.ts` باید در همان نقطه‌ای از `reservations.ts` یا در API
   پیش‌سفارش صدا زده شوند که مبلغ نهایی محاسبه می‌شود (محل دقیق به ساختار
   فعلی محاسبه‌ی صورت‌حساب preorder بستگی دارد که در این پاس دست نخورد چون
   ریسک شکستن منطق پرداخت موجود را داشت).
2. **Mount کردن کامپوننت React**: پنل رستوران (`apps/business/index.html`)
   Vanilla JS تک‌فایلی است. کامپوننت جدید React است. گزینه‌ها:
   - Build مجزا با Vite + mount در یک تب جدید (سریع‌ترین راه بدون ریسک به پنل فعلی)
   - مهاجرت تدریجی کل پنل به Next.js (پیشنهاد بلندمدت اگر قرار است تب‌های
     پیچیده‌ی بیشتری اضافه شود)
3. **`prisma generate` و `db push`** روی محیط واقعی (اینجا بدون دیتابیس/شبکه
   قابل اجرا نیست) — قبل از دیپلوی باید روی staging تست شود.
