import Redis, { Cluster } from 'ioredis';

// ═══════════════════════════════════════════════════════════════════════
//  لایه‌ی Redis — آماده برای single-node و Cluster (مقیاس‌پذیری افقی)
//
//  چرا: در ۲۰۰هزار کاربر همزمان، یک نود Redis گلوگاه می‌شود (هر چک
//  rate-limit، قفل رزرو، و cache از آن عبور می‌کند). ioredis از حالت
//  Cluster پشتیبانی می‌کند که داده را روی چند نود shard می‌کند.
//
//  پیکربندی با env:
//   • تک‌نود:   REDIS_URL=redis://host:6379
//   • Cluster:  REDIS_CLUSTER_NODES=host1:6379,host2:6379,host3:6379
//     (اگر این تنظیم شود، حالت Cluster فعال می‌شود و REDIS_URL نادیده گرفته می‌شود)
//
//  ⚠️ نکته‌ی Cluster: کلیدهایی که باید با هم در یک تراکنش/اسکریپت Lua باشند
//     (مثل قفل رزرو) باید روی یک نود باشند. ioredis این را با hash-tag مدیریت
//     می‌کند: کلید `lock:{slot}` با آکولاد، تضمین می‌کند فقط بخش داخل {} برای
//     تعیین نود hash شود. قفل ما تک‌کلیدی است پس امن است.
// ═══════════════════════════════════════════════════════════════════════

const g = globalThis as unknown as { redis?: Redis | Cluster; redisShutdownHooked?: boolean };

function makeRedis(): Redis | Cluster {
  const clusterNodes = process.env.REDIS_CLUSTER_NODES?.split(',').map(s => s.trim()).filter(Boolean);
  if (clusterNodes && clusterNodes.length > 0) {
    const nodes = clusterNodes.map(n => {
      const [host, port] = n.split(':');
      return { host, port: Number(port) || 6379 };
    });
    return new Cluster(nodes, {
      redisOptions: { maxRetriesPerRequest: 3 },
      // توزیع خواندن روی replicaها در صورت وجود (کاهش بار نود master)
      scaleReads: 'slave',
      // lazyConnect: اتصالِ واقعی فقط با اولین دستور، نه در همان لحظه‌ی import.
      // چرا: بدونِ این، صرفِ importِ این ماژول (حتی برایِ تایپ، بدونِ صدازدنِ هیچ
      // متدی) یک سوکتِ TCP زنده باز می‌کنه که event loop رو نگه می‌داره — دقیقاً
      // همون هندلِ معلقی که تستِ واحد (tests/*.test.mts، با --test-force-exit)
      // رو بین اجراها ناپایدار می‌کرد (شمارشِ subtestها بینِ اجراها فرق می‌کرد،
      // چون force-exit گاهی قبل از flushِ کاملِ خروجیِ TAP اجرا می‌شد).
      lazyConnect: true,
    });
  }
  return new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 3, lazyConnect: true });
}

// ⚠️ باگ H5: مثل Prisma، اتصال Redis باید «همیشه» singleton باشد نه فقط در توسعه.
// قبلاً در production هر بار بارگذاری ماژول یک اتصال جدید می‌ساخت و هیچ‌کدام بسته
// نمی‌شدند → شمار اتصال Redis تا رد شدن اتصال‌های جدید بالا می‌رفت و rate-limit،
// قفل و cache هم‌زمان می‌شکستند. حالا در هر محیطی روی globalThis کش می‌شود.
export const redis = g.redis ?? makeRedis();
g.redis = redis;

// خاموشی تمیز: بستن اتصال روی سیگنال خاتمه (جلوگیری از نشت socket هنگام هر deploy)
if (!g.redisShutdownHooked) {
  g.redisShutdownHooked = true;
  const closeRedis = () => { redis.quit().catch(() => { redis.disconnect(); }); };
  process.once('SIGTERM', closeRedis);
  process.once('SIGINT', closeRedis);
  process.once('beforeExit', closeRedis);
}

/** قفل کوتاه‌مدت رزرو — لایه اول جلوگیری از double-booking.
 *  از hash-tag {} استفاده می‌کنیم تا در حالت Cluster، کلید قفل روی یک نود پایدار بماند.
 *
 *  ⚠️ باگ M6: قبلاً اگر قفل آزاد نبود بلافاصله خطای ۴۲۳ می‌داد؛ یعنی دو کاربر که
 *  هم‌زمان همان اسلات را می‌گرفتند، دومی رد می‌شد حتی اگر میز دیگری آزاد بود. حالا
 *  چند بار با backoff کوتاه تلاش می‌کنیم؛ فقط اگر واقعاً قفل طولانی نگه داشته شده
 *  خطا می‌دهیم. منبع حقیقت نهایی، تراکنش serializable در دیتابیس است. */
export async function withSlotLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const token = crypto.randomUUID();
  const lockKey = `lock:{${key}}`; // hash-tag: فقط {key} برای تعیین نود hash می‌شود
  // تلاش برای گرفتن قفل با backoff نمایی کوتاه (۵ تلاش، مجموعاً ~۳۰۰ms).
  let ok: string | null = null;
  const delays = [0, 40, 80, 120, 160];
  for (const d of delays) {
    if (d) await new Promise(r => setTimeout(r, d));
    ok = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
    if (ok) break;
  }
  if (!ok) throw (await import('./errors')).Err.lockTimeout();
  try { return await fn(); }
  finally {
    // فقط اگر هنوز مال خودمان است آزاد کن
    await redis.eval(
      `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`,
      1, lockKey, token,
    );
  }
}
