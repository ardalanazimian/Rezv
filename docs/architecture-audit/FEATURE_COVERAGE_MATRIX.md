# FEATURE_COVERAGE_MATRIX — رزرونو

> پوششِ هر ویژگی در زنجیره‌ی UI→API→Service→DB→UI. تاریخ: ۲۰۲۶-۰۷-۳۰.
> وضعیت: ✅ Complete · 🟡 Partial · 🔴 Broken · ⚪ Missing.

> ⚠️ **کهنه (۲۰۲۶-۰۸-۲۲، رجوع کن به `docs/audit/BASELINE.md`):** جمله‌ی «Broken: موردی یافت نشد» در
> بخشِ خلاصه‌ی این سند **در همان تاریخ هم غلط بود**، فقط هنوز کشف نشده بود. ۱۲۲ کامیتِ بعدی شش موردِ
> واقعاً Broken را در همین کدِ همان تاریخ پیدا و رفع کردند (حذفِ میزِ رزروِ زنده، دورزدنِ ماشینِ وضعیتِ
> میز، check-inِ QRِ کاملاً غیرفعال، QRِ جعلیِ غیرقابلِ‌اسکن، دورزدنِ کاملِ گاردِ ادمین، مقایسه‌ی
> غیرِثابت‌زمان). سطرهای زیر به‌عنوانِ عکسِ‌لحظه‌ی تاریخی معتبرند، نه ادعایِ فعلی. قبل از تکیه به هر
> ردیف، با `grep`/تست خودت تأییدش کن.

## اپ مشتری
| ویژگی | UI | API | Service/DB | وضعیت |
|-------|----|-----|-----------|-------|
| کشف/فیلتر رستوران | discover + chips | /restaurants | restaurant + review groupBy | ✅ |
| جست‌وجو (palette/typo) | cmdk + searchbar | کلاینتی روی R | — | ✅ |
| نوارِ زنده | liveStrip | /restaurants/live-stats | count واقعی | ✅ |
| رزرو (کامل) | booking sheet | /restaurants/[slug]/availability + POST /reservations | engine (exclude+serializable+retry) | ✅ |
| لغو/جزئیاتِ رزرو | trip-card/swipe | /reservations/[code](+cancel) | lifecycle | ✅ |
| لیستِ انتظار | waitlist flow | /waitlist(+[id]) | waitlist | ✅ |
| پروفایل + ویرایشِ inline | profile | GET/PATCH /me | user.update | ✅ |
| باشگاه/امتیاز | loyalty | /me/points | PointsLedger | ✅ |
| DNA غذایی | dnaOverlay | /me/profile | guest-profile | ✅ (fallbackِ دمو) |
| چت با رستوران | chat | /me/chats(+[id]), /restaurants/[slug]/chat | ChatThread | ✅ |
| گیفت‌کارت | — | /gift-cards | loyalty | ✅ |
| کش‌بک-wallet | set-item | ⚪ (بدونِ endpoint) | — | 🟡 Orphan-UI |
| پشتیبانی | set-item | ⚪ | — | ⚪ Missing flow |
| توصیه‌ی AI شخصی | ai-strip (متنِ ثابت) | ⚪ (بدونِ endpoint) | — | 🟡 Partial |
| «نزدیک تو» (Location) | nearby scroll | ⚪ (heuristic محلی) | — | 🟡 Partial |

## پنل کسب‌وکار
| ویژگی | وضعیت |
|-------|-------|
| داشبورد/آنالیتیکس (/restaurant/analytics) | ✅ |
| رزروها (+events/status)، لیستِ انتظار، پلانِ سالن (tables) | ✅ |
| مشتریان/CRM (customers, rfm) | ✅ |
| بازاریابی (campaigns, automations, coupons) | ✅ |
| قیمت‌گذاری (pricing)، کش‌بک، ساعات (hours) | ✅ |
| کارکنان (staff, members) | ✅ |
| نظرات/عکس/یادداشت (reviews, photos 🔶 upload، notes) | ✅ / 🔶 |
| ضدِتقلب (fraud-signals) | ⚪ backend بدونِ UIِ تأییدشده |
| گزارش‌گیری (reports) | ⚪ backend بدونِ UIِ تأییدشده |

## پنل شرکت
| ویژگی | وضعیت |
|-------|-------|
| داشبورد/overview، business-intelligence | ✅ |
| مدیریتِ رستوران‌ها (+control 🔶، sms) | ✅ / 🔶 |
| امنیت، سلامتِ سیستم | ✅ |
| تنظیماتِ پلتفرم (admin/settings) | ⚪ backend بدونِ UIِ تأییدشده |

## خلاصه
- **Complete:** جریان‌های اصلیِ کسب‌وکار (رزرو، انتظار، CRM، پرداخت، باشگاه، چت، پنل‌ها).
- **Partial/Orphan (فلگ، نه باگ):** کش‌بک-wallet و پشتیبانی و AI-stripِ شخصی و Location در اپ مشتری؛ آپلودِ عکس (تأییدِ e2e).
- **Orphan-backend:** fraud-signals، reports، admin/settings (UI نیامده).
- **Broken:** موردی یافت نشد.
