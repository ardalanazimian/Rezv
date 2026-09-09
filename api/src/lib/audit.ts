import { db } from './db';
import { createLogger, currentTraceId } from './logger';
import { metrics } from './metrics';

const log = createLogger('audit');

// ═══════════════════════════════════════════════════════════════════════
//  Audit Log عمومی — رویدادهای امنیتی و حساس
//
//  متفاوت از ReservationEvent (که audit دامنه‌ی رزرو است). این لایه برای
//  رویدادهای امنیتی/حاکمیتی است که برای انطباق (compliance) و تحقیقات
//  امنیتی لازم‌اند: ورود، شکست احراز هویت، تغییر دسترسی کارکنان، استفاده
//  از کارت هدیه، و غیره.
//
//  دو مقصد:
//   ۱) جدول audit_logs در دیتابیس (ماندگار، قابل‌جستجو، برای تحقیق)
//   ۲) لاگ ساختاریافته (برای جمع‌آوری متمرکز و alerting بلادرنگ)
//
//  ⚠️ هرگز نباید مسیر اصلی را بشکند — اگر نوشتن audit خطا داد، فقط لاگ
//     می‌شود، نه throw (از دست‌رفتن یک رکورد audit نباید کاربر را بلاک کند).
// ═══════════════════════════════════════════════════════════════════════

export type AuditAction =
  | 'auth.login' | 'auth.failure' | 'auth.logout'
  | 'staff.permission_change' | 'staff.login'
  // ── ورود با رمز (مهاجرتِ ۰۷۴) ──
  // ساخت/تغییرِ اعتبارنامه‌ی یک بیزنس توسطِ مدیرِ پلتفرم، و تغییرِ رمز توسطِ
  // خودِ کارمند. هر دو مستقیماً روی «چه کسی می‌تواند وارد شود» اثر دارند و
  // بدونِ ردِ مکتوب هیچ تحقیقِ امنیتیِ بعدی ممکن نیست.
  // ⚠️ خودِ رمز هرگز در detail نمی‌رود — فقط نام کاربری و اینکه عوض شد.
  | 'admin.staff_credentials_set' | 'staff.password_change'
  // SPEC-B (C12): نامِ canonical از spec — 'admin.business_created' قبلی rename شد (تنها مصرف‌کننده: route ادمین)
  | 'restaurant.provision' | 'restaurant.invite_resent' | 'restaurant.branch_created' | 'staff.invite_accepted'
  | 'giftcard.redeem' | 'coupon.redeem' | 'coupon.created'
  | 'reservation.cancel' | 'admin.action'
  | 'restaurant.activated' | 'restaurant.deactivated'
  | 'plan.changed' | 'subscription.cancelled'
  // بازبینیِ گالری: تصمیمِ انتشار روی برندِ پلتفرم است و باید ردِ انسانی
  // داشته باشد — چه کسی، کِی، و اگر رد شد به چه دلیل.
  | 'photo.uploaded' | 'photo.approved' | 'photo.rejected' | 'photo.deleted'
  | 'security.rate_limit' | 'security.idor_attempt' | 'security.abuse_flag'
  // ── Company Control Plane (فازِ ۲) — بن سختِ کاربر توسطِ ادمینِ پلتفرم ──
  | 'user.ban' | 'user.unban'
  // ── Company Control Plane (فازِ ۳) — نشان‌هایِ کنترل‌شده‌یِ پلتفرم ──
  | 'badge.created' | 'badge.updated' | 'badge.granted' | 'badge.revoked'
  // ── Company Control Plane (فازِ ۳) — CRUDِ ماموریت توسطِ ادمینِ پلتفرم ──
  | 'mission.created' | 'mission.updated'
  // ── Company Control Plane (فازِ ۳) — سوییچ‌هایِ قابلیت (kill-switch) ──
  | 'feature_flag.update'
  // ── Company Control Plane (فازِ ۴) — ویرایشگرِ قواعدِ اقتصاد ──
  | 'economy_rule.update'
  // ── تأییدِ ساعتِ کاری (Part 3) — رستوران پیشنهاد می‌دهد، شرکت تأیید/رد می‌کند.
  //    تغییرِ ساعتِ زنده روی برندازِ پلتفرم اثر مستقیم دارد؛ باید ردِ انسانی داشته باشد.
  | 'hours.proposed' | 'hours.approved' | 'hours.rejected'
  // ── بازتولیدِ کدِ QRِ میز: استیکرِ چاپ‌شده‌ی رویِ میز را **باطل** می‌کند.
  //    اثرش فیزیکی و برگشت‌ناپذیر است (کدِ قبلی برنمی‌گردد)، پس باید معلوم
  //    باشد چه کسی و کِی آن را زد — مثلاً وقتی مهمانی می‌گوید QR کار نمی‌کند.
  | 'table.qr_regenerated';

type AuditEntry = {
  action: AuditAction;
  actorId?: string | null;       // کاربر/کارمندی که عمل را انجام داد
  actorType?: 'customer' | 'staff' | 'admin' | 'anonymous';
  targetId?: string | null;      // موجودی که تحت تأثیر قرار گرفت
  restaurantId?: string | null;
  ip?: string | null;
  detail?: Record<string, unknown>;
  success?: boolean;
};

/**
 * ماسکِ شماره‌ی موبایل برای رکوردهای audit — `+989123456789` → `+98******6789`.
 *
 * چرا: رکوردِ audit در جدولِ `audit_logs` می‌ماند و برای تحقیقِ امنیتی خوانده
 * می‌شود؛ برایِ «کدام حساب هدفِ حمله است» چهار رقمِ آخر کافی است و شماره‌ی
 * کاملْ یک شناسه‌ی مستقیمِ فرد است. همان قاعده‌ای که `SENSITIVE_KEYS` در
 * `lib/logger.ts` روی کلیدِ `phone` اعمال می‌کند (آنجا کاملاً `[REDACTED]`
 * می‌شود) — اینجا چون کلید `phone_masked` است و مقدار از قبل ماسک شده،
 * چیزی برای نشت نمی‌ماند.
 */
export function maskPhone(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length <= 4) return '*'.repeat(s.length);
  return s.slice(0, 3) + '*'.repeat(Math.max(1, s.length - 7)) + s.slice(-4);
}

/**
 * ثبتِ رویدادِ حسابرسی. **مقدارِ برگشتی = آیا ردیف واقعاً در `audit_logs`
 * نشست؟** (نه «آیا لاگ چاپ شد»).
 *
 * ⚠️ چرا از `Promise<void>` به `Promise<boolean>` تغییر کرد (۲۰۲۶-۰۹-۰۶):
 * این تابع طبقِ طراحی هرگز throw نمی‌کند — شکستِ نوشتن در DB داخلِ همین
 * فایل گرفته و به یک `log.warn` تنزل داده می‌شد. نتیجه‌ی عملی: صداکننده
 * هیچ راهی نداشت بفهمد ردِ حسابرسی گم شده، و `.catch(() => {})`های
 * پراکنده‌ی صداکننده‌ها (مثلِ `lib/fraud.ts`) عملاً **بی‌اثر** بودند —
 * چیزی برایِ گرفتن پرتاب نمی‌شد. یعنی برداشتنِ آن catchها به‌تنهایی هیچ
 * چیزی را رفع نمی‌کرد؛ سوراخ یک لایه پایین‌تر بود.
 *
 * حالا: شکست شمرده می‌شود (`rezervno_audit_write_failed_total`، با آلارمِ
 * `AuditWriteFailing` در observability/alerts.yml) و در سطحِ `error` لاگ
 * می‌شود، و صداکننده می‌تواند ماندگاری را ببیند. الگو عمداً همان
 * `tryPromoteNext` در `lib/waitlist.ts` است — «کنشِ اصلی موفق بود، فقط
 * اثرِ جانبی نه» به یک سیگنالِ دیدنی تبدیل می‌شود، بدونِ throw.
 *
 * ⚠️ **دامنه‌ی این مقدارِ برگشتی را دستِ‌کم نگیر — و فرض نکن کسی چکش می‌کند.**
 * امروز `await audit(` در `api/src` **۵۴ بار** فراخوانی می‌شود و **فقط یکی**
 * از آن‌ها نتیجه را می‌خواند: `lib/fraud.ts` در `clearAbuseFlag` (که آن را
 * به‌صورتِ `audited` تا پاسخِ HTTP بالا می‌برد). یعنی برایِ ۵۳ نقطه‌ی دیگر،
 * «ردیف نشست یا نه» همچنان **بی‌پاسخ** است؛ فقط متریک/آلارم آن‌ها را
 * می‌بیند، نه خودِ کد.
 *
 * این عمدی و محدود است، نه ناتمام‌ماندنِ کار: سیم‌کشیِ هر ۵۴ نقطه یک تغییرِ
 * جداست. ولی جمله در همین‌جا نوشته شده چون خطا هم دقیقاً همین‌جا مرتکب
 * می‌شود — کسی که فراخوانِ ۵۵اُم را اضافه می‌کند، یک boolean می‌بیند و
 * طبیعتاً نتیجه می‌گیرد جایی دارد بررسی‌اش می‌کند. **ندارد.** اگر ماندگاریِ
 * ردِ حسابرسیِ کنشِ تو اهمیت دارد (نوشتنِ برگشت‌ناپذیر، کنشِ متقاطعِ تنانت،
 * هر چیزی که فردا در یک تحقیق لازم می‌شود)، مقدار را **خودت** بخوان و به
 * صداکننده گزارش بده — الگویش `clearAbuseFlag` است.
 */
export async function audit(entry: AuditEntry): Promise<boolean> {
  const traceId = currentTraceId();
  // همیشه لاگ ساختاریافته (برای alerting بلادرنگ حتی اگر DB کند باشد)
  log.info(`audit: ${entry.action}`, {
    actor: entry.actorId, target: entry.targetId, ip: entry.ip,
    success: entry.success ?? true, traceId,
  });

  // متریک‌های امنیتی
  //
  // ⚠️ تا ۲۰۲۶-۰۸-۲۵ این خط عملاً مرده بود: هیچ routeِ احراز هویتی
  // `auth.failure` صادر نمی‌کرد (grep روی کلِ src = صفر)، پس
  // `rezervno_auth_failures_total` همیشه صفر می‌ماند و آلارمِ criticalِ
  // `AuthFailureSpike` (brute-force) هرگز شلیک نمی‌شد. حالا هر پنج مسیرِ
  // احراز هویت (otp/staff/admin verify، refresh، logout) صادرش می‌کنند.
  //
  // برچسبِ `actor_type` عمداً اضافه شد: «کدام سطح زیرِ حمله است» — پنلِ
  // کارکنان، ادمینِ پلتفرم یا اپِ مشتری — پاسخِ عملیاتیِ کاملاً متفاوتی
  // دارد. مقدارها بسته‌اند (۴ حالت)، پس کاردینالیتی امن است و
  // `sum(rate(...))`ِ آلارمِ فعلی بدونِ تغییر کار می‌کند.
  if (entry.action === 'auth.failure') metrics.authFailures.inc({ actor_type: entry.actorType ?? 'anonymous' });

  // ماندگاری در DB (best-effort)
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        actorType: entry.actorType ?? 'anonymous',
        targetId: entry.targetId ?? null,
        restaurantId: entry.restaurantId ?? null,
        ip: entry.ip ?? null,
        traceId: traceId ?? null,
        success: entry.success ?? true,
        detail: (entry.detail ?? {}) as object,
      },
    });
    return true;
  } catch (e) {
    // اگر جدول هنوز migrate نشده یا DB قطع است، مسیر اصلی را نشکن — ولی
    // بی‌صدا هم نگذر. سطح `error` است نه `warn`: کنشِ حساس انجام شده و ردش
    // گم شده؛ این دقیقاً همان حالتی است که در تحقیقِ بعدی لازم می‌شود و
    // وجود ندارد.
    metrics.auditWriteFailed.inc({ action: entry.action });
    log.error('ثبت audit در DB ناموفق — کنش انجام شد ولی ردِ حسابرسی ننشست', {
      event: 'audit.write_failed',
      action: entry.action,
      actor: entry.actorId,
      target: entry.targetId,
      restaurantId: entry.restaurantId,
      traceId,
      error: (e as Error).message,
    });
    return false;
  }
}
