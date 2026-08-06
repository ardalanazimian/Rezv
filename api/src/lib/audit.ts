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
  | 'giftcard.redeem' | 'coupon.redeem' | 'coupon.created'
  | 'reservation.cancel' | 'admin.action'
  | 'restaurant.activated' | 'restaurant.deactivated'
  | 'plan.changed' | 'subscription.cancelled'
  // بازبینیِ گالری: تصمیمِ انتشار روی برندِ پلتفرم است و باید ردِ انسانی
  // داشته باشد — چه کسی، کِی، و اگر رد شد به چه دلیل.
  | 'photo.uploaded' | 'photo.approved' | 'photo.rejected' | 'photo.deleted'
  | 'security.rate_limit' | 'security.idor_attempt';

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

export async function audit(entry: AuditEntry): Promise<void> {
  const traceId = currentTraceId();
  // همیشه لاگ ساختاریافته (برای alerting بلادرنگ حتی اگر DB کند باشد)
  log.info(`audit: ${entry.action}`, {
    actor: entry.actorId, target: entry.targetId, ip: entry.ip,
    success: entry.success ?? true, traceId,
  });

  // متریک‌های امنیتی
  if (entry.action === 'auth.failure') metrics.authFailures.inc();

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
  } catch (e) {
    // اگر جدول هنوز migrate نشده یا DB قطع است، فقط لاگ کن — مسیر اصلی را نشکن
    log.warn('ثبت audit در DB ناموفق (لاگ ساختاریافته ثبت شد)', (e as Error).message);
  }
}
