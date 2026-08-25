import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { createLogger } from '@/lib/logger';

const log = createLogger('health');
export const runtime = 'nodejs';

/**
 * GET /api/health — بررسی سلامت واقعی برای load balancer / k8s.
 *
 * چرا مهم: health check سطحی (فقط status:ok) به ارکستریتور دروغ می‌گوید.
 * اگر DB قطع باشد ولی health همچنان ۲۰۰ بدهد، LB ترافیک را به pod مرده می‌فرستد.
 * این نسخه واقعاً DB و Redis را پینگ می‌کند و اگر هرکدام قطع باشد ۵۰۳ می‌دهد.
 *
 * - 200: همه‌ی وابستگی‌ها سالم
 * - 503: حداقل یک وابستگی قطع (ارکستریتور pod را از rotation خارج می‌کند)
 */
export async function GET() {
  const checks: Record<string, 'ok' | 'down'> = { db: 'down', redis: 'down' };

  // بررسی موازی DB و Redis با timeout کوتاه (برای جلوگیری از معلق‌ماندن)
  const withTimeout = <T>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  const [dbRes, redisRes] = await Promise.allSettled([
    withTimeout(db.$queryRaw`SELECT 1`, 2000),
    withTimeout(redis.get('__health__'), 2000),
  ]);

  if (dbRes.status === 'fulfilled') checks.db = 'ok';
  else log.error('health: DB قطع است', (dbRes as PromiseRejectedResult).reason?.message);

  // redis.get روی کلید ناموجود null می‌دهد که موفق است (اتصال برقرار است)
  if (redisRes.status === 'fulfilled') checks.redis = 'ok';
  else log.error('health: Redis قطع است', (redisRes as PromiseRejectedResult).reason?.message);

  const healthy = checks.db === 'ok' && checks.redis === 'ok';
  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', service: 'rezervno-api', checks, time: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}

// liveness ساده (برای k8s liveness probe — فقط چک می‌کند پروسه زنده است)
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
