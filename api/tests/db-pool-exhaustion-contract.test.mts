import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ «ته‌کشیدنِ استخرِ اتصال ۵۰۰ نمی‌دهد» — P2024
//
//  چرا این فایل وجود دارد:
//  یافته‌ی رد تیم (`rezv-c7`, RT-05, ۲۰۲۶-۰۹-۰۹) و استدلالش حسابی بود، نه
//  مشاهده‌ای. حساب درست بود و اینجا **اندازه‌گیری** شد:
//
//      connection_limit = 10   (db.ts:52، از DB_CONNECTION_LIMIT)
//      pool_timeout     = 10   (db.ts:56، از DB_POOL_TIMEOUT)
//      هر تراکنشِ رزرو تا timeout: 10_000 اتصالش را نگه می‌دارد
//
//  یعنی یازدهمین رزروِ هم‌زمان روی یک instance، ۱۰ ثانیه منتظرِ اتصالی
//  می‌ماند که نمی‌گیرد. اجرای واقعی روی همین ماشین:
//
//      ۱۰ تراکنشِ نگه‌دارنده، سپس یک کوئریِ ساده
//      → پس از ۱۰.۰ ثانیه: P2024 «Timed out fetching a new connection…»
//      → errorResponse → HTTP 500 / INTERNAL
//
//  **جمله‌ی رد تیم که چرا این از P2028 بدتر است:** «P2028 یک تراکنشِ کُند
//  لازم دارد؛ P2024 ده تراکنشِ **عادی**.» نمونه‌ی وصله‌نشده محتمل‌تر بود.
//
//  ⚠️ و برخلافِ P2028 این مخصوصِ رزرو نیست — هر endpointی که به DB بزند
//  همین را می‌دهد. پس رفعش هم عمداً در `errorResponse` نشست، نه در بلوکِ
//  catchِ رزرو: گذاشتنش در مسیرِ رزرو یعنی همان کلاس در ۱۰۰ مسیرِ دیگر
//  باز می‌ماند و کسی خبردار نمی‌شود.
//
//  ⚠️ چرا کلاینتِ **جدا** با استخرِ کوچک و نه `db` مشترک: ته‌کشاندنِ استخرِ
//  `db` وسطِ یک مجموعه‌ی ۱۶۹۰تایی، تست‌های کاملاً بی‌ربط را با همین P2024
//  می‌شکند و شکستشان به این فایل نسبت داده نمی‌شود. استخرِ ۲تایی همان رفتار
//  را می‌سنجد بدونِ آن آسیب — و سریع‌تر هم هست.
// ═══════════════════════════════════════════════════════════════════════

const { PrismaClient, Prisma } = await import('@prisma/client');
const { errorResponse } = await import('../src/lib/errors.ts');
const { metrics } = await import('../src/lib/metrics.ts');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ⚠️ یک شمارنده تا اولین `inc()` **هیچ خطِ نمونه‌ای** چاپ نمی‌کند
// (`metrics.ts` → `Counter.render`: حلقه روی `values` که هنوز خالی است). پس
// نبودِ خط یعنی «هنوز صفر»، نه «شمارنده وجود ندارد» — و این دو را نباید یکی
// گرفت: نسخه‌ی اولِ همین helper برای شمارنده‌ی تازه‌ساخته‌شده `NaN` می‌داد و
// تست را با پیامِ «شمارنده وجود ندارد» قرمز می‌کرد، در حالی که وجود داشت.
// اعلامِ شمارنده از خطِ `# HELP` سنجیده می‌شود که همیشه رندر می‌شود.
function poolCount(): number {
  const txt = metrics.dbPoolTimeouts.render();
  const line = txt.split('\n').find((l) => l.startsWith('rezervno_db_pool_timeouts_total '));
  return line ? Number(line.split(' ')[1]) : 0;
}
function poolCounterDeclared(): boolean {
  return metrics.dbPoolTimeouts.render().includes('# TYPE rezervno_db_pool_timeouts_total counter');
}

// استخرِ ۲تایی روی همان DBِ تست، مستقل از `db` مشترک.
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set('connection_limit', '2');
url.searchParams.set('pool_timeout', '3');
const tiny = new PrismaClient({ datasources: { db: { url: url.toString() } } });

after(async () => { await tiny.$disconnect().catch(() => {}); });

describe('P2024 — ته‌کشیدنِ استخرِ اتصال', () => {
  test('errorResponse به ۵۰۳ ترجمه می‌کند، نه ۵۰۰، و شمارنده تکان می‌خورد', async () => {
    assert.ok(poolCounterDeclared(),
      'شمارنده‌ی rezervno_db_pool_timeouts_total اصلاً اعلام نشده است');
    const before = poolCount();

    // هر دو اتصال را بگیر و نگه دار.
    const holders = Array.from({ length: 2 }, () =>
      tiny.$transaction(async (tx) => { await tx.$queryRaw`SELECT 1`; await sleep(9_000); },
        { timeout: 20_000 }).catch(() => {}));
    await sleep(800);

    let caught: unknown = null;
    const t0 = Date.now();
    try {
      await tiny.$queryRaw`SELECT 1`;
    } catch (e) { caught = e; }
    const waited = Date.now() - t0;
    await Promise.all(holders);

    // نبودِ موضوع = خطا. اگر استخر ته نکشید، این تست هیچ‌چیز نسنجیده.
    assert.ok(caught, `کوئریِ سوم باید شکست می‌خورد؛ استخر ته نکشید (${waited}ms)`);
    assert.equal((caught as { code?: string }).code, 'P2024',
      `انتظارِ P2024 می‌رفت، گرفت: ${(caught as { code?: string }).code}`);

    const res = errorResponse(caught) as Response;
    const body = await res.json() as { error?: { code?: string } };

    assert.equal(res.status, 503,
      'ته‌کشیدنِ استخر ناتوانیِ **موقتِ** سرویس است، نه خطای داخلی — ۵۰۰ به کلاینت '
      + 'می‌گوید «ما خرابیم» در حالی که درست‌ترین کار دوباره تلاش‌کردن است');
    assert.equal(body.error?.code, 'SERVICE_UNAVAILABLE');

    assert.equal(poolCount(), before + 1,
      'بدونِ شمارنده، طوفانِ استخر فقط یک ۵۰۳ در لاگ است و هیچ عددی نمی‌گوید '
      + 'ظرفیت کم است — همان «شمارنده‌ای که نمی‌تواند تکان بخورد»');
  });

  test('خطاهای دیگر همچنان ۵۰۰ می‌گیرند — ترجمه نباید گشاد شود', () => {
    // ⚠️ درسِ همین‌روزِ P2028: طبقه‌بندی که فقط روی «کد» تکیه کند یا بیش از
    // حد گشاد باشد، یک باگ را به پیامی آرام‌کننده ترجمه می‌کند. این ردیف
    // مرزِ آن گشادی است.
    const before = poolCount();
    const other = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed', { code: 'P2002', clientVersion: 'test' },
    );
    const res = errorResponse(other) as Response;
    assert.equal(res.status, 500, 'فقط P2024 باید ۵۰۳ شود');
    assert.equal(poolCount(), before, 'شمارنده نباید برای خطای نامربوط بالا برود');

    const plain = errorResponse(new Error('boom')) as Response;
    assert.equal(plain.status, 500);
  });
});
