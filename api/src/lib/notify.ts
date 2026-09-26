import { createLogger } from './logger';
import { enqueue } from './queue';
import { metrics } from './metrics';
import { outboundHttpSignal } from './outbound-http';
import { db } from './db';
import { parseWebPushKeys, pushTransportReady } from './push-transport';
const log = createLogger('notify');
// ═════════════════════════════════════════════════════════
//  اعلان Push و Email — رزرونو
//
//  این ماژول رابط یکپارچه‌ای برای اعلان‌های غیر-SMS فراهم می‌کند.
//  در حالت پیش‌فرض (بدون کلید ارائه‌دهنده) فقط لاگ می‌کند.
//  برای production، کلیدها را در env بگذار و منطق ارسال واقعی فعال می‌شود.
// ═════════════════════════════════════════════════════════

export type PushExtra = { url?: string; tag?: string };
export { pushTransportReady, vapidPublicKey } from './push-transport';

/**
 * ارسال اعلان Push به کاربر.
 * مسیرِ زنده: Web Push با VAPID روی endpoint ذخیره‌شده.
 * بدون کلید / بدون اشتراک / بدون کلیدهای p256dh+auth → متریک + بازگشت. هیچ موفقیتی جعل نمی‌شود.
 */
export async function sendPush(userId: string, title: string, body: string, extra?: PushExtra): Promise<void> {
  if (!pushTransportReady()) {
    metrics.pushNotSent.inc({ reason: 'transport_not_configured' });
    log.debug(`[PUSH:بدون‌VAPID] user:${userId} | ${title}`);
    return;
  }

  const sub = await db.pushSubscription.findUnique({
    where: { userId },
    select: { enabled: true, endpoint: true, token: true },
  });
  if (!sub?.enabled || !sub.endpoint) {
    metrics.pushNotSent.inc({ reason: 'no_subscription' });
    return;
  }
  const keys = parseWebPushKeys(sub.token);
  if (!keys) {
    metrics.pushNotSent.inc({ reason: 'incomplete_subscription' });
    return;
  }

  try {
    const webpush = await import('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT as string,
      process.env.VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );
    const payload = JSON.stringify({
      title,
      body,
      url: extra?.url || '/',
      tag: extra?.tag || 'rezervno',
    });
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys },
      payload,
      { TTL: 300 },
    );
    metrics.pushSent.inc();
    log.info('push ارسال شد', { userId, tag: extra?.tag ?? null });
  } catch (e) {
    const msg = (e as Error).message || '';
    const gone = /410|404/.test(msg);
    metrics.pushNotSent.inc({ reason: gone ? 'endpoint_gone' : 'provider_error' });
    log.warn('ارسالِ push ناموفق', { userId, error: msg.slice(0, 200) });
    if (gone) {
      await db.pushSubscription.update({
        where: { userId },
        data: { enabled: false, endpoint: null, token: null },
      }).catch(() => {});
    }
  }
}
