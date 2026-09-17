import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { LookupFunction } from 'node:net';
import { db } from './db';
import { enqueue } from './queue';
import { assertPublicHttpUrl, isBlockedWebhookHost, safeLookup } from './security';
import { createLogger } from './logger';
import { outboundHttpSignal } from './outbound-http';

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

  // میزبان‌های داخلی + IPِ لفظیِ خصوصی — تکِ مرجع `isBlockedWebhookHost` (security.ts).
  // RT-31: نسخه‌ی درون‌خطیِ قبلی دو باگ داشت که هر دو این‌جا بسته می‌شود:
  //  • `host.startsWith('fc'|'fd')` روی **نام** اجرا می‌شد → `fcbarcelona.com` را غلط بلاک می‌کرد.
  //  • IPv4-mapped IPv6ِ هگز (`[::ffff:a9fe:a9fe]` = 169.254.169.254) هیچ شاخه‌ای را نمی‌گرفت.
  if (isBlockedWebhookHost(u.hostname)) throw new Error('آدرس وب‌هوک مجاز نیست (میزبان داخلی)');

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

  // گارد SSRF (پیش‌بررسی): نام/IPِ لفظی و یک resolveِ اولیه (پیامِ خطای روشن).
  await assertPublicHttpUrl(payload.url);
  // گاردِ قطعی: تحویل با `lookup: safeLookup` می‌رود، پس resolveی که وصل می‌شود همان است
  // که اعتبارسنجی شده — DNS-rebinding دومین resolve ندارد که ببرد. `fetch` این را نمی‌دهد.
  const status = await postWebhookPinned(payload.url, headers, body);
  // 2xx و 3xx (بدونِ دنبال‌کردنِ redirect) قابلِ قبول‌اند؛ 4xx/5xx → worker retry.
  if (status < 200 || status >= 400) {
    throw new Error(`webhook ${payload.url} پاسخ ${status} داد`);
  }
  log.info('webhook تحویل شد', { event: payload.event, url: payload.url });
}

/**
 * POSTِ webhook با DNSِ pin‌شده. `http(s).request({ lookup: safeLookup })` باعث می‌شود
 * تنها resolveِ موجود همانی باشد که `safeLookup` اعتبارسنجی می‌کند و سوکت به آن وصل می‌شود.
 * redirect دنبال نمی‌شود (رفتارِ `redirect:'manual'`ِ قبلی). خروجی: کدِ وضعیتِ HTTP.
 */
async function postWebhookPinned(rawUrl: string, headers: Record<string, string>, body: string): Promise<number> {
  const u = new URL(rawUrl);
  const requestFn = u.protocol === 'http:' ? httpRequest : httpsRequest;
  return await new Promise<number>((resolve, reject) => {
    const req = requestFn(rawUrl, {
      method: 'POST',
      headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
      lookup: safeLookup as LookupFunction, // ← رزولوشنِ pin‌شده و اعتبارسنجی‌شده در زمانِ اتصال
      signal: outboundHttpSignal(),  // همان سقفِ ۱۰ ثانیه از مرجعِ مشترک
    }, (res) => {
      res.resume(); // بدنه را drain کن (نشتِ سوکت را ببند)؛ فقط کدِ وضعیت را می‌خواهیم
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end(body);
  });
}
