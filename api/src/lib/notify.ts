import { createLogger } from './logger';
import { enqueue } from './queue';
import { metrics } from './metrics';
import { outboundHttpSignal } from './outbound-http';
import { db } from './db';
import { parseWebPushKeys, pushTransportReady } from './push-transport';
const log = createLogger('notify');

export type PushExtra = { url?: string; tag?: string };
export { pushTransportReady, vapidPublicKey } from './push-transport';

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

export function emailTransportReady(): boolean {
  return Boolean(process.env.EMAIL_API_KEY);
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM || 'noreply@rezervno.ir';

  if (!apiKey) {
    metrics.emailFailed.inc({ reason: 'no_api_key' });
    if (process.env.NODE_ENV === 'production') {
      log.error('EMAIL_API_KEY تنظیم نشده — هیچ ایمیلی ارسال نمی‌شود', { to, subject });
    } else {
      log.debug(`(dev) EMAIL → ${to} | ${subject}`);
    }
    return;
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      signal: outboundHttpSignal(),
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      log.error(`ارسالِ ایمیل ناموفق → ${to}`, { subject, status: res.status, detail: detail.slice(0, 300) });
      metrics.emailFailed.inc({ reason: 'rejected' });
      return;
    }
    log.info(`ایمیل ارسال شد → ${to}`, { subject });
    metrics.emailSent.inc();
  } catch (e) {
    log.error(`خطای شبگه در ارسالِ ایمیل → ${to}`, { subject, error: (e as Error).message });
    metrics.emailFailed.inc({ reason: 'network' });
    throw e;
  }
}

export async function queueEmail(to: string, subject: string, body: string, idempotencyKey?: string): Promise<void> {
  try {
    await enqueue({ kind: 'email', payload: { to, subject, body }, idempotencyKey });
  } catch {
    await sendEmail(to, subject, body).catch(() => {});
  }
}

export async function queuePush(
  userId: string,
  title: string,
  body: string,
  idempotencyKey?: string,
  extra?: PushExtra,
): Promise<void> {
  try {
    await enqueue({ kind: 'push', payload: { userId, title, body, url: extra?.url, tag: extra?.tag }, idempotencyKey });
  } catch {
    await sendPush(userId, title, body, extra).catch(() => {});
  }
}
