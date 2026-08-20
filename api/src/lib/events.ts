import { db } from './db';
import { enqueue } from './queue';
import { assertPublicHttpUrl } from './security';
import { createLogger } from './logger';

const log = createLogger('events');

// ═══════════════════════════════════════════════════════════════════════
//  Event Bus سبک + Webhook خروجی
//
//  چرا: تا الان همه‌چیز نقطه‌به‌نقطه صدا زده می‌شد. این لایه یک نقطه‌ی
//  واحد برای انتشار رویدادهای دامنه می‌دهد، و مصرف‌کننده‌ها (وب‌هوک‌های
//  شخص ثالث: POS، حسابداری، Zapier) بدون تغییر کد منبع subscribe می‌کنند.
//
//  معماری: emit() رویداد را در DB ثبت و برای هر webhook فعالِ آن رویداد،
//  یک job در صف می‌گذارد. تحویل از طریق صف Job انجام می‌شود → retry/DLQ/
//  backoff رایگان. (به‌جای ساختن سیستم تحویل جدا.)
// ═══════════════════════════════════════════════════════════════════════

export type DomainEvent =
  | 'reservation.created' | 'reservation.cancelled' | 'reservation.completed' | 'reservation.no_show'
  | 'waitlist.joined' | 'waitlist.seated'
  | 'customer.vip_reached' | 'coupon.redeemed';

type EmitOptions = {
  event: DomainEvent;
  restaurantId: string;
  payload: Record<string, unknown>;
};

/**
 * انتشار یک رویداد دامنه. webhookهای مشترکِ آن رویداد در صف قرار می‌گیرند
 * (تحویل async با retry). اگر هیچ webhookی نباشد، فقط لاگ می‌شود.
 */
export async function emit(opts: EmitOptions): Promise<void> {
  log.debug(`event: ${opts.event}`, { restaurantId: opts.restaurantId });
  try {
    // webhookهای فعالِ این رستوران که این رویداد را می‌خواهند
    const hooks = await db.webhook.findMany({
      where: {
        restaurantId: opts.restaurantId,
        isActive: true,
        events: { has: opts.event },
      },
      select: { id: true, url: true, secret: true },
    });

    for (const hook of hooks) {
      // هر تحویل یک job جدا — با idempotencyKey تا تکراری نشود
      await enqueue({
        kind: 'webhook',
        payload: {
          webhookId: hook.id,
          url: hook.url,
          secret: hook.secret,
          event: opts.event,
          data: opts.payload,
          restaurantId: opts.restaurantId,
        },
        priority: 4,
      });
    }
  } catch (e) {
    // انتشار رویداد نباید مسیر اصلی را بشکند
    log.warn('انتشار رویداد ناموفق', { event: opts.event, error: (e as Error).message });
  }
}

/**
 * اعتبارسنجی امنیتی URL وب‌هوک برابر SSRF (باگ H9).
 *
 * وب‌هوک URL را رستوران تعیین می‌کند و سرور آن را fetch می‌کند؛ بدون این گارد،
 * یک رستوران مخرب/هک‌شده می‌تواند URL را به آدرس‌های داخلی اشاره دهد
 * (metadata ابری 169.254.169.254، سرویس‌های داخلی، localhost) → SSRF.
 *
 * قوانین: فقط https؛ میزبان نباید IP خصوصی/loopback/link-local/یکتای محلی باشد؛
 * هاست‌نیم‌های داخلی رایج بلاک می‌شوند. (رزولوشن DNS در زمان اجرا هم توسط لایه‌ی
 * شبکه محدود می‌شود؛ این چک لایه‌ی اول است.)
 */
export function assertSafeWebhookUrl(rawUrl: string): URL {
  let u: URL;
  try { u = new URL(rawUrl); } catch { throw new Error('آدرس وب‌هوک نامعتبر است'); }

  if (u.protocol !== 'https:') throw new Error('آدرس وب‌هوک باید https باشد');

  const host = u.hostname.toLowerCase();

  // بلاک هاست‌نیم‌های داخلی رایج
  const blockedHosts = ['localhost', 'metadata.google.internal', 'metadata', 'kubernetes.default'];
  if (blockedHosts.includes(host) || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('آدرس وب‌هوک مجاز نیست (میزبان داخلی)');
  }

  // اگر میزبان یک IP است، بازه‌های خصوصی/loopback/link-local را رد کن
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    const isPrivate =
      a === 10 ||                             // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||    // 172.16.0.0/12
      (a === 192 && b === 168) ||             // 192.168.0.0/16
      (a === 100 && b >= 64 && b <= 127) ||   // 100.64.0.0/10 CGNAT
      (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmark
      a === 127 ||                            // 127.0.0.0/8 loopback
      (a === 169 && b === 254) ||             // 169.254.0.0/16 link-local (metadata!)
      a === 0 ||                              // 0.0.0.0/8
      a >= 224;                               // multicast/reserved
    if (isPrivate) throw new Error('آدرس وب‌هوک مجاز نیست (IP داخلی)');
  }
  // IPv6 loopback/link-local/unique-local
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd') || host === '[::1]') {
    throw new Error('آدرس وب‌هوک مجاز نیست (IPv6 داخلی)');
  }

  return u;
}

/**
 * تحویل واقعی یک webhook (توسط worker صدا زده می‌شود).
 * امضای HMAC در هدر تا گیرنده صحت را تأیید کند.
 */
export async function deliverWebhook(payload: {
  webhookId: string; url: string; secret: string | null;
  event: string; data: Record<string, unknown>; restaurantId: string;
}): Promise<void> {
  // گارد SSRF: قبل از هر fetch، امنیت URL بررسی می‌شود (H9).
  assertSafeWebhookUrl(payload.url);

  const body = JSON.stringify({
    event: payload.event,
    restaurant_id: payload.restaurantId,
    data: payload.data,
    timestamp: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Rezervno-Event': payload.event,
  };
  // امضای HMAC-SHA256 برای تأیید صحت (مثل Stripe/GitHub)
  if (payload.secret) {
    const { createHmac } = await import('crypto');
    const sig = createHmac('sha256', payload.secret).update(body).digest('hex');
    headers['X-Rezervno-Signature'] = `sha256=${sig}`;
  }

  // گارد SSRF: قبل از fetch مطمئن شو URL به شبکه‌ی داخلی/metadata اشاره نمی‌کند.
  await assertPublicHttpUrl(payload.url);
  // redirect: 'manual' تا نتوان با ریدایرکت به آدرس داخلی، گارد SSRF را دور زد.
  const res = await fetch(payload.url, {
    method: 'POST', headers, body,
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok && res.type !== 'opaqueredirect') {
    throw new Error(`webhook ${payload.url} پاسخ ${res.status} داد`); // worker retry می‌کند
  }
  log.info('webhook تحویل شد', { event: payload.event, url: payload.url });
}
