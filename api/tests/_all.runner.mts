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
//  ⚠️ یافته‌ی واقعی (۲۰۲۶-۰۸-۱۴، ممیزیِ acquisition-grade): دقیقاً همین
//     خطر رخ داده بود — ban.test.mts، crm-recommendations.test.mts و
//     customer-intelligence.test.mts ساخته شده بودن ولی اینجا import نشده
//     بودن، یعنی `npm test` هیچ‌وقت واقعاً اجراشون نمی‌کرد با اینکه در PRِ
//     مربوطه ادعایِ «۳۷۵/۳۷۵ پاس» ثبت شده بود (عددِ واقعیِ بدونِ این سه فایل
//     ۳۵۲ بود). درس: بعدِ افزودنِ هر فایلِ تستِ جدید، حتماً با
//     `comm -23 <(ls tests/*.test.mts) <(grep -oP ...)` (یا مشابه) چک کن که
//     همه‌ی فایل‌هایِ tests/*.test.mts واقعاً اینجا import شدن.
//
//  ⚠️ گزارشگر عمداً `spec` است (در package.json)، نه TAPِ پیش‌فرض — یافته‌ی
//     واقعیِ ۲۰۲۶-۰۸-۲۰: وقتی CI قرمز شد، خروجیِ TAP بیش از ۴۰۰۰ خط بود و
//     `not ok`ها وسطِ لاگ پخش بودند، پس از رویِ tailِ لاگ اصلاً نمی‌شد فهمید
//     *کدام* تست افتاده — تشخیص به حدس‌زدن و بازتولیدِ محلی موکول شد.
//     گزارشگرِ spec هم شمارشِ نهایی را دارد، هم بخشِ «✖ failing tests» را با
//     نام/پیام/خطِ فایل دقیقاً در انتها می‌گذارد، و کلِ خروجی ~۸۶۰ خط است.
//     یعنی هر شکستِ CI از این به بعد از رویِ همان چند خطِ آخر خوانا است.
//
//  ⚠️ اسمِ این فایل عمداً `.runner.mts` است، نه `.test.mts` — اگر `.test.mts`
//     بود، خودش هم با glob قدیمیِ `tests/*.test.mts` مچ می‌شد و هر کسی که
//     دستی اون glob رو اجرا کنه (عادتِ مستندشده‌ی قبلی) هر تست رو دوبار
//     می‌شمرد (یک‌بار مستقیم، یک‌بار از طریقِ importِ اینجا).
// ═══════════════════════════════════════════════════════════════════════

// ⚠️ باید اولین import بماند — رجوع به توضیحِ hoisting داخلِ خودِ فایل.
import './helpers/test-env.mts';
import './birthday-calendar.test.mts';
import './allowed-origins.test.mts';
import './availability-bulk.integration.test.mts';
import './availability-offline-parity.integration.test.mts';
import './ban.test.mts';
import './branch-isolation.integration.test.mts';
import './cancellation-policy.test.mts';
import './booking-policy-contract.integration.test.mts';
import './checkin-auth.integration.test.mts';
import './coupons.integration.test.mts';
import './crm-recommendations.test.mts';
import './crm-feedback-loop.integration.test.mts';
import './customer-intelligence.test.mts';
import './intelligence-formula-parity.integration.test.mts';
import './demand-forecast.test.mts';
import './feature-parity.integration.test.mts';
import './economy.test.mts';
import './economy-ledger.integration.test.mts';
import './esc.test.mts';
import './jsq-attribute-xss.test.mts';
import './fraud.integration.test.mts';
import './guest-profile.test.mts';
import './hours.test.mts';
import './hours-approval.test.mts';
import './hours-change-approval.integration.test.mts';
import './customer-insight-spend-semantics.integration.test.mts';
import './guest-profile-rollup.integration.test.mts';
import './events-restaurant-slug.integration.test.mts';
import './member-create.integration.test.mts';
import './menu-crud.integration.test.mts';
import './tables.integration.test.mts';
import './table-qr-checkin.integration.test.mts';
import './table-qr-regenerate.integration.test.mts';
import './qr-checkin.integration.test.mts';
import './auth-guards.integration.test.mts';
import './staff-auth-guard.integration.test.mts';
import './availability.integration.test.mts';
import './automation.integration.test.mts';
import './feature-flags.integration.test.mts';
import './assistant-nlu.test.mts';
import './idempotency.integration.test.mts';
import './incentive-engine.test.mts';
import './jwt.test.mts';
import './lifecycle.test.mts';
import './lifecycle-exclusivity.test.mts';
import './checkin-points-panel-path.integration.test.mts';
import './loyalty-club-points.integration.test.mts';
import './lifecycle-cron.integration.test.mts';
import './loyalty-status.test.mts';
import './loyalty-tier-panel-parity.test.mts';
import './loyalty.test.mts';
import './vip-and-clv-honesty.integration.test.mts';
import './media.test.mts';
import './metrics-endpoint.test.mts';
import './ml-core.test.mts';
import './model-drift.test.mts';
import './model-drift.integration.test.mts';
import './model-registry.integration.test.mts';
import './no-dynamic-import-in-hot-path.test.mts';
import './no-show-model.test.mts';
import './notifications.test.mts';
import './notification-consent.test.mts';
import './notification-consent-enforcement.test.mts';
import './observability-coverage.test.mts';
import './otp.test.mts';
import './otp-ratelimit-and-deadlock.integration.test.mts';
import './sms-transport-failclosed.integration.test.mts';
import './outreach-ledger.integration.test.mts';
import './zarinpal.test.mts';
import './payments.integration.test.mts';
import './permissions.test.mts';
import './photo-moderation.test.mts';
import './pricing.test.mts';
import './queue.test.mts';
import './ratelimit-fallback.test.mts';
import './rbac-permission-coverage.test.mts';
import './rewards.integration.test.mts';
import './redis.test.mts';
import './reminder-sms.integration.test.mts';
import './reservation-helpers.test.mts';
import './reservation-status.test.mts';
import './restaurant-manager.test.mts';
import './schema-drift.integration.test.mts';
import './security-hardening.integration.test.mts';
import './shell-scripts-lf.test.mts';
import './sms-balance.integration.test.mts';
import './site-orders.test.mts';
import './subscription.test.mts';
import './table-merge-occupancy-concurrency.test.mts';
import './table-delete-guard.integration.test.mts';
import './table-release.integration.test.mts';
import './table-merge-occupancy.test.mts';
import './telemetry-retention.integration.test.mts';
import './telemetry-trust.test.mts';
import './telemetry-dedup.integration.test.mts';
import './validate.test.mts';
import './waitlist-accept-clock.test.mts';
import './prediction-ledger.integration.test.mts';
import './public-menu.integration.test.mts';
import './temporal-leakage.integration.test.mts';
import './tenant-gate.integration.test.mts';
import './tenant-isolation.integration.test.mts';
import './waitlist.test.mts';
import './waitlist-flow.integration.test.mts';

// ═══════════════════════════════════════════════════════════════════════
//  ⚠️ یافته‌ی واقعیِ دوم (۲۰۲۶-۰۸-۱۴، همون ممیزی): table-merge-occupancy.test.mts
//  اولین فایلِ این پوشه است که واقعاً یک اتصالِ زنده‌ی Redis باز می‌کند
//  (withSlotLock داخلِ createReservation) — و همین یک باگِ واقعیِ کشف‌نشده
//  در db.ts/redis.ts را لو داد: هردو فایل shutdownِ تمیزشان را روی
//  `process.once('beforeExit', ...)` گذاشته‌اند، ولی یک سوکتِ بازِ Redis
//  خودش دقیقاً همان «handleِ باز» است که جلوی رسیدنِ event loop به حالتِ
//  خالی (و در نتیجه رخ‌دادنِ خودِ beforeExit) را می‌گیرد — یک بن‌بستِ
//  murغ‌وتخم‌مرغی: beforeExit هرگز شلیک نمی‌شود چون Redis باز مانده، و
//  چیزی Redis را نمی‌بندد چون آن کد فقط با beforeExit اجرا می‌شود. نتیجه:
//  `npm test` بعدِ اتمامِ کاملِ همه‌ی تست‌ها (هیچ fail‌ای) تا ابد hang
//  می‌کرد — بدونِ SIGTERM/CI-timeout هیچ‌وقت خارج نمی‌شد. تستی که خودش
//  فایل تنها اجرا می‌شد سریع pass می‌کرد، فقط پروسه هیچ‌وقت exit نمی‌شد.
//
//  رفعِ اینجا (نه توی db.ts/redis.ts، تا رفتارِ زمانِ اجرا/تولید دست‌نخورده
//  بماند): بعدِ اتمامِ همه‌ی importها، صریحاً و بی‌قیدوشرط اتصال‌ها رو می‌بندیم.
//  اگر هیچ فایلی واقعاً Redis/DB زنده باز نکرده باشد (اکثرِ فایل‌ها فقط
//  منطقِ خالص تست می‌کنند)، این دو خط no-op امن‌اند.
// ═══════════════════════════════════════════════════════════════════════
import { after } from 'node:test';
after(async () => {
  const { db } = await import('../src/lib/db.ts');
  const { redis } = await import('../src/lib/redis.ts');
  await db.$disconnect().catch(() => {});
  await redis.quit().catch(() => { try { redis.disconnect(); } catch { /* */ } });
});
