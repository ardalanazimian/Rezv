// ═══════════════════════════════════════════════════════════════════════
//  رانرِ یک‌فایلیِ همه‌ی تست‌های واحد — چرا این فایل وجود دارد:
//
//  `tsx --test tests/*.test.mts` هر کدوم از فایل‌های مطابقِ glob رو در یک
//  child processِ مجزا اجرا می‌کنه (ایزوله‌سازیِ استاندارد و درونی‌ِ Node‌ی
//  test runner برای چند فایل، مستقل از هر flagی). ترکیبش با `--test-force-exit`
//  (که قبلاً لازم بود چون importِ lib/db.ts و lib/redis.ts یک هندلِ Prisma/Redis
//  بازِ نگه می‌داشت) یک ریسِ واقعی می‌ساخت: force-exit هر processِ فرزند رو
//  دقیقاً همون لحظه‌ای که تست‌هاش تموم می‌شد می‌کشت — قبل از اینکه pipeِ
//  stdoutِ اون فرزند کاملاً به parentِ aggregator flush بشه. زیرِ فشار، این
//  گاهی کلِ subtestهای یک فایل رو (بدونِ شمردنِ fail) از خروجیِ نهایی می‌نداخت
//  — `# tests`/`# suites` بینِ اجراهای پی‌درپیِ یکسان فرق می‌کرد (مثلاً ۳۱۴ در
//  برابرِ ۳۳۲)، در حالی که fail همیشه ۰ بود.
//
//  `--experimental-test-isolation=none` (Node ۲۲+) این مشکل رو حل می‌کنه چون
//  دیگه subprocessی برای ریس‌کردن وجود نداره — ولی این flag روی Node ۲۰
//  (نسخه‌ی CI فعلی) اصلاً وجود نداره و باعثِ کرشِ فوری می‌شه («bad option»).
//  راه‌حلِ قابلِ‌حمل بینِ نسخه‌ها: به‌جایِ تکیه به یک flagِ نسخه-محورِ CLI،
//  با importِ سایدافکتیِ همه‌ی فایل‌های تست در همینجا، فقط «یک» فایل به
//  `tsx --test` می‌دیم — پس اصلاً چیزی برایِ ایزوله‌کردن/چندprocessی‌کردن
//  وجود نداره، صرف‌نظر از نسخه‌ی Node. تست شده: پایدار (۳۳۲/۳۳۲/۳۳۲) روی
//  Node ۲۲ محلی؛ چون هیچ flagِ تجربی‌ای درکار نیست، رفتارش نباید به نسخه‌ی
//  Node وابسته باشه (۲۰۲۶-۰۸-۱۳).
//
//  ⚠️ فایلِ جدیدِ تست اضافه کردی؟ اینجا هم importش کن، وگرنه `npm test`
//     اجراش نمی‌کنه (ولی اجرایِ مستقیمِ خودِ فایل — مثلاً برایِ دیباگِ محلی —
//     `tsx --test tests/x.test.mts` — همیشه جدا از این فایل کار می‌کنه).
//
//  ⚠️ اسمِ این فایل عمداً `.runner.mts` است، نه `.test.mts` — اگر `.test.mts`
//     بود، خودش هم با glob قدیمیِ `tests/*.test.mts` مچ می‌شد و هر کسی که
//     دستی اون glob رو اجرا کنه (عادتِ مستندشده‌ی قبلی) هر تست رو دوبار
//     می‌شمرد (یک‌بار مستقیم، یک‌بار از طریقِ importِ اینجا).
// ═══════════════════════════════════════════════════════════════════════

import './cancellation-policy.test.mts';
import './demand-forecast.test.mts';
import './economy.test.mts';
import './guest-profile.test.mts';
import './hours.test.mts';
import './incentive-engine.test.mts';
import './jwt.test.mts';
import './lifecycle.test.mts';
import './loyalty-status.test.mts';
import './loyalty.test.mts';
import './media.test.mts';
import './ml-core.test.mts';
import './no-show-model.test.mts';
import './notifications.test.mts';
import './otp.test.mts';
import './permissions.test.mts';
import './photo-moderation.test.mts';
import './queue.test.mts';
import './reservation-helpers.test.mts';
import './restaurant-manager.test.mts';
import './site-orders.test.mts';
import './validate.test.mts';
import './waitlist.test.mts';
