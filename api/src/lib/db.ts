import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger';

const log = createLogger('db');

// ═══════════════════════════════════════════════════════════════════════
//  لایه‌ی اتصال دیتابیس — Connection Pooling + Read Replica Routing
//
//  چرا این فایل وجود دارد (مسئله‌ی واقعی):
//  PostgreSQL مدیریت‌شده معمولاً سقف اتصال پایینی دارد (در تست ما روی Supabase: ۶۰).
//  هر instance از API که مستقیم به Postgres وصل شود، چند connection می‌گیرد؛
//  با چند instance (scale افقی) خیلی زود به سقف می‌خوریم → ارور
//  "too many connections" و قطع سرویس. راه‌حل استاندارد دو لایه است:
//
//   ۱) Connection Pooling (PgBouncer / Supabase Pooler / RDS Proxy):
//      API به pooler وصل می‌شود، نه مستقیم به DB. Pooler صدها اتصال کلاینت را
//      روی چند اتصال واقعی DB multiplex می‌کند.
//      ⚠️ در حالت transaction pooling، prepared statementها کار نمی‌کنند؛
//         برای همین DATABASE_URL باید ?pgbouncer=true داشته باشد تا Prisma
//         prepared statement cache را غیرفعال کند.
//
//   ۲) Read Replica Routing:
//      کوئری‌های خواندنی سنگین (داشبورد، آنالیتیکس، گزارش، لیست) به replica
//      می‌روند؛ فقط نوشتن‌ها و تراکنش‌های حساس به primary. این بار را از
//      primary برمی‌دارد و ظرفیت همزمانی را چند برابر می‌کند.
//
//  متغیرهای محیطی:
//   DATABASE_URL          → primary، از طریق pooler (نوشتن + تراکنش)
//   DATABASE_REPLICA_URL  → read replica (اختیاری؛ اگر نبود، از primary می‌خواند)
//   DATABASE_DIRECT_URL   → اتصال مستقیم بدون pooler (فقط برای migrate/introspect)
// ═══════════════════════════════════════════════════════════════════════

const g = globalThis as unknown as {
  prismaPrimary?: PrismaClient;
  prismaReplica?: PrismaClient;
  dbShutdownHooked?: boolean;
  shutdownHooked?: boolean;
  dbMetricsHooked?: boolean;
};

// اتصال به دیتابیس با pool محدود (حیاتی در ۱۰k همزمان).
// در مقیاس بالا، pgbouncer حالت transaction بین app و Postgres است و هر instance
// باید pool محدود داشته باشد تا مجموع اتصال‌ها از سقف Postgres رد نشود.
// connection_limit و pool_timeout از env قابل تنظیم‌اند؛ اگر در URL نباشند، افزوده می‌شوند.
function withPoolParams(url: string): string {
  try {
    const u = new URL(url);
    // connection_limit: تعداد اتصال هر instance. پیش‌فرض محافظه‌کارانه؛ در deploy
    // با N instance، مقدار = (سقف اتصال Postgres ÷ N) را در env تنظیم کن.
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '10');
    }
    // pool_timeout: چند ثانیه صبر برای اتصال آزاد قبل از خطا (به‌جای انتظار بی‌نهایت).
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '10');
    }
    return u.toString();
  } catch {
    return url; // اگر URL قابل‌parse نبود، دست‌نخورده برگردان
  }
}

function makeClient(url: string | undefined): PrismaClient {
  const finalUrl = url ? withPoolParams(url) : undefined;
  return new PrismaClient({
    ...(finalUrl ? { datasources: { db: { url: finalUrl } } } : {}),
    log: [{ level: 'error', emit: 'event' }, { level: 'warn', emit: 'event' }],
  });
}

// ── Primary: نوشتن، تراکنش، قفل ردیف ──
export const db = g.prismaPrimary ?? makeClient(process.env.DATABASE_URL);

// ── Replica: فقط خواندن. اگر DATABASE_REPLICA_URL تنظیم نشده باشد،
//    به همان primary اشاره می‌کند (degrade تمیز، نه crash). ──
export const dbRead = g.prismaReplica
  ?? (process.env.DATABASE_REPLICA_URL ? makeClient(process.env.DATABASE_REPLICA_URL) : db);

// ⚠️ باگ H4: کلاینت‌ها باید «همیشه» روی globalThis کش شوند، نه فقط در non-production.
// قبلاً این کش فقط در حالت توسعه انجام می‌شد؛ در production هر بار که ماژول دوباره
// ارزیابی می‌شد (بارگذاری route، مسیرهای serverless، چند entrypoint) یک PrismaClient
// جدید با pool مستقل ساخته می‌شد و اتصال‌ها تا سقف Postgres (~۶۰ در Supabase) پر
// می‌شدند و کل API با «too many connections» می‌افتاد. حالا در هر محیطی singleton است.
g.prismaPrimary = db;
if (dbRead !== db) g.prismaReplica = dbRead;

// ── متریکِ latency دیتابیس: هر کوئری زمان‌سنجی می‌شود (یک‌بار نصب می‌شود) ──
// چرا مهم است: بدون این نمی‌فهمی کندیِ سیستم از DB است یا از کد. سیگنالِ حیاتیِ مانیتورینگ.
if (!g.dbMetricsHooked) {
  g.dbMetricsHooked = true;
  // import تنبل تا چرخه‌ی وابستگی ایجاد نشود (metrics ممکن است db را نخواهد، ولی محتاطیم)
  import('./metrics').then(({ metrics }) => {
    const timer = async (params: unknown, next: (p: unknown) => Promise<unknown>) => {
      const t0 = Date.now();
      try { return await next(params); }
      finally { metrics.dbDuration.observe((Date.now() - t0) / 1000); }
    };
    // $use روی هر دو کلاینت (primary و replica اگر جداست)
    (db as unknown as { $use: (m: unknown) => void }).$use(timer);
    if (dbRead !== db) (dbRead as unknown as { $use: (m: unknown) => void }).$use(timer);
  }).catch(() => { /* اگر metrics در دسترس نبود، بی‌خطر رد شو */ });
}

// ── خاموشی تمیز: بستن اتصال‌ها روی سیگنال‌های خاتمه (جلوگیری از نشت اتصال هنگام deploy) ──
if (!g.dbShutdownHooked) {
  g.dbShutdownHooked = true;
  const closeAll = async () => {
    try { await db.$disconnect(); } catch { /* بستن best-effort */ }
    if (dbRead !== db) { try { await dbRead.$disconnect(); } catch { /* */ } }
  };
  process.once('SIGTERM', closeAll);
  process.once('SIGINT', closeAll);
  process.once('beforeExit', closeAll);
}

// ═══════════════════════════════════════════════════════════
//  راهنمای استفاده (الگوی read/write separation):
//
//    import { db, dbRead } from './db';
//
//    // خواندن سنگین (داشبورد/لیست/آنالیتیکس) → replica:
//    const items = await dbRead.restaurant.findMany({ ... });
//
//    // نوشتن یا هر چیزی که باید فوراً پیامد نوشتن خودش را ببیند → primary:
//    await db.reservation.create({ ... });
//
//  ⚠️ Replication lag: replica چند ده میلی‌ثانیه عقب است. بنابراین «بعد از
//     نوشتن، فوراً همان را بخوان» باید از primary (db) باشد، نه dbRead —
//     وگرنه ممکن است داده‌ی قدیمی برگردد (read-after-write inconsistency).
// ═══════════════════════════════════════════════════════════

// ── Graceful shutdown: هر دو client را می‌بندد ──
if (!g.shutdownHooked && typeof process !== 'undefined' && process.on) {
  g.shutdownHooked = true;
  const shutdown = async (signal: string) => {
    log.info(`دریافت ${signal} — بستن تمیز اتصال‌های دیتابیس`);
    try {
      await db.$disconnect();
      if (dbRead !== db) await dbRead.$disconnect();
    } catch (e) {
      log.error('خطا در بستن DB', (e as Error).message);
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
