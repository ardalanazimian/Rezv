import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  اجاره‌ی job (lease) و بازپس‌گیریِ کارهای رهاشده در 'processing'
//
//  ⚠️ نقصِ واقعی که این فایل برایش نوشته شد (۲۰۲۶-۰۹-۰۶):
//  `locked_at` در `claimJobs` **نوشته** می‌شد (`lib/queue.ts:92`) و در
//  `completeJob`/`failJob` **پاک** می‌شد، ولی هیچ‌جای مخزن آن را **نمی‌خواند**
//  — نه در `api/src`، نه در `api/prisma/sql`، نه در `cron/`، نه در `tools/`.
//  `claimJobs` فقط `status='pending'` را برمی‌دارد. نتیجه: workerی که وسطِ
//  handler کشته شود (SIGKILL/OOM/ری‌استارتِ کانتینر) job را **برای همیشه** در
//  'processing' جا می‌گذارد — نه retry می‌شود، نه به DLQ می‌رود.
//
//  و نامرئی هم بود: `refreshQueueMetrics` فقط pending و dead را می‌شمرد
//  (`lib/queue.ts:157-161`). یعنی هیچ داشبورد یا آلارمی این حالت را نمی‌دید.
//
//  ادعایِ هدرِ `lib/queue.ts:17-19` («Retry + Backoff» و «DLQ بعد از
//  max_attempts») فقط برای handlerهایی درست بود که `throw` می‌کنند؛ برای
//  **کرش** هرگز درست نبود.
//
//  ⚠️ همه‌چیز عمداً داخلِ یک describeِ بیرونی است — هوکِ سطحِ فایل به سوئیتِ
//  ROOT می‌چسبد و کلِ اجرا را آلوده می‌کند (درسِ ثبت‌شده‌ی password-login).
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const {
  enqueue, claimJobs, shouldDeadLetter, reclaimStaleJobs, refreshQueueMetrics,
  countStaleProcessingJobs, JOB_LEASE_MS, JOB_WORST_CASE_MS, WORKER_BATCH_MAX,
} = await import('../src/lib/queue');
const { runWorker } = await import('../src/lib/worker');
const { metrics } = await import('../src/lib/metrics');
const { OUTBOUND_HTTP_TIMEOUT_MS } = await import('../src/lib/outbound-http');

/**
 * اولویتِ ۱ = بالاترین. **الزامی** است، نه سلیقه.
 *
 * ⚠️ درسِ اجرای کاملِ سوئیت (۲۰۲۶-۰۹-۰۶): این فایل تنها با اولویتِ پیش‌فرضِ
 * `push` (۳) نوشته شده بود و به‌تنهایی سبز بود، ولی داخلِ `npm test` قرمز شد:
 * `claimJobs` با `ORDER BY priority ASC` مرتب می‌کند و صف تا آن لحظه پر از
 * jobهای `sms` (اولویتِ ۲) از فایل‌های قبلی بود، پس batchِ ۵۰تایی پیش از
 * رسیدن به jobِ این تست پر می‌شد و ادعا روی صفِ **دیگران** شکست می‌خورد.
 * با اولویتِ ۱، کارِ این فایل همیشه اولِ صف است و ادعا به محتوایِ صفِ سایر
 * تست‌ها وابسته نیست.
 */
const TEST_PRIORITY = 1;

/** مقدارِ فعلیِ یک gauge را از خروجیِ واقعیِ Prometheus می‌خواند، نه از حالتِ داخلی. */
function gaugeValue(rendered: string, name: string): number {
  const line = rendered.split('\n').find((l) => l.startsWith(`${name} `));
  assert.ok(line, `متریکِ ${name} در خروجیِ Prometheus نیست — چیزی که render نشود، آلارم هم نمی‌گیرد`);
  return Number(line.slice(name.length + 1).trim());
}

const TAG = `lease-${String(Date.now()).slice(-9)}`;
const createdJobIds: string[] = [];

/**
 * یک job می‌سازد، claim می‌کند، و بعد **کرشِ worker را شبیه‌سازی می‌کند**:
 * سطر در 'processing' رها می‌شود و `locked_at` به عقب برده می‌شود تا انگار
 * کرش `agoMinutes` دقیقه پیش رخ داده.
 *
 * چرا عقب‌بردنِ ستون به‌جای صبرِ واقعی: تنها چیزی که تولید می‌سازد همین است —
 * یک سطرِ 'processing' با `locked_at`ِ کهنه. صبرِ واقعی همان سطر را می‌سازد،
 * فقط کندتر.
 */
async function strandJob(opts: {
  kind: string;
  agoMinutes: number;
  attempts?: number;
  maxAttempts?: number;
}): Promise<string> {
  const { id } = await enqueue({
    kind: opts.kind as 'push',
    payload: { userId: `[DEMO] ${TAG}`, title: '[DEMO] اجاره', body: '[DEMO]' },
    idempotencyKey: `${TAG}-${opts.kind}-${opts.agoMinutes}-${createdJobIds.length}`,
    maxAttempts: opts.maxAttempts ?? 5,
    priority: TEST_PRIORITY,
  });
  createdJobIds.push(id);

  const claimed = await claimJobs(50);
  assert.ok(
    claimed.some((j) => j.id === id),
    'موضوعِ تست غایب است: job ساخته‌شده claim نشد — بدونِ سطرِ claimشده کلِ ادعای زیر بی‌معناست',
  );

  // کرش: هیچ complete/fail ای صدا زده نمی‌شود. فقط زمان را عقب می‌بریم.
  await db.$executeRaw`
    UPDATE jobs
    SET locked_at = now() - (interval '1 minute' * ${opts.agoMinutes}),
        attempts  = ${opts.attempts ?? 1}
    WHERE id = ${id}::uuid
  `;

  const row = await db.job.findUnique({ where: { id }, select: { status: true, lockedAt: true } });
  assert.equal(row?.status, 'processing',
    'موضوعِ تست غایب است: سطر باید پس از شبیه‌سازیِ کرش در processing بماند');
  assert.ok(row?.lockedAt, 'موضوعِ تست غایب است: locked_at باید ست باشد');
  return id;
}

describe('اجاره‌ی job — بازپس‌گیریِ کارهای رهاشده در processing', () => {
  before(async () => {
    // هیچ تستِ اجباری‌ای نباید به شبکه‌ی بیرونی بزند. kindِ 'push' اصلاً شبکه
    // ندارد (`lib/notify.ts:30-31` فقط متریک و لاگ است)، ولی اگر روزی handlerها
    // عوض شدند این stub جلوی وابستگیِ خاموش به اینترنت را می‌گیرد.
    globalThis.fetch = (async () => {
      throw new Error('[DEMO] تستِ اجباری حق ندارد به شبکه بزند');
    }) as typeof fetch;
  });

  after(async () => {
    if (createdJobIds.length) {
      await db.job.deleteMany({ where: { id: { in: createdJobIds } } }).catch(() => {});
    }
    await db.$disconnect();
  });

  // ── کنترلِ مثبت، اول ──────────────────────────────────────────────────
  // اگر این سبز نباشد، «سبز»ِ بقیه فقط یعنی تست خراب است، نه اینکه گارد کار می‌کند.
  test('کنترلِ مثبت — مسیرِ عادیِ صف هنوز کار می‌کند (enqueue → runWorker → completed)', async () => {
    const { id } = await enqueue({
      kind: 'push',
      payload: { userId: `[DEMO] ${TAG}-ok`, title: '[DEMO] عادی', body: '[DEMO]' },
      idempotencyKey: `${TAG}-positive-control`,
      priority: TEST_PRIORITY,
    });
    createdJobIds.push(id);

    await runWorker(50);

    const row = await db.job.findUnique({ where: { id }, select: { status: true } });
    assert.equal(row?.status, 'completed',
      'مسیرِ سالمِ صف باید کار کند — وگرنه ادعاهای بازپس‌گیریِ زیر قابلِ تفسیر نیستند');
  });

  // ── خودِ نقص ──────────────────────────────────────────────────────────
  test('⭐ jobی که workerِ کرش‌کرده در processing رها کرده باید بازپس گرفته شود', async () => {
    // ۲۴ ساعت — بلندتر از هر اجاره‌ی قابلِ‌دفاعی. اگر این بازپس گرفته نشود،
    // یعنی اصلاً هیچ مسیرِ بازپس‌گیری‌ای وجود ندارد.
    const id = await strandJob({ kind: 'push', agoMinutes: 60 * 24 });

    await runWorker(50);

    const row = await db.job.findUnique({
      where: { id }, select: { status: true, lockedAt: true },
    });
    assert.notEqual(row?.status, 'processing',
      'job در processing گیر کرده و هرگز retry/DLQ نمی‌شود — پیامکِ تأییدِ رزروِ مهمان بی‌صدا گم می‌شود');
  });

  test('⭐ jobِ رهاشده واقعاً به سرانجام می‌رسد، نه فقط از processing خارج می‌شود', async () => {
    const id = await strandJob({ kind: 'push', agoMinutes: 60 * 24 });

    await runWorker(50);

    const row = await db.job.findUnique({
      where: { id }, select: { status: true, lockedAt: true },
    });
    // 'completed' چون در همان اجرا دوباره claim و پردازش می‌شود؛
    // اگر اجاره فقط وضعیت را عوض کند ولی job دوباره برداشته نشود، این می‌شکند.
    assert.equal(row?.status, 'completed',
      'بازپس‌گیری باید job را واقعاً به چرخه برگرداند، نه فقط برچسبش را عوض کند');
    assert.equal(row?.lockedAt, null, 'پس از اتمام، locked_at باید پاک شده باشد');
  });

  test('jobِ سمی (attempts به max رسیده) پس از بازپس‌گیری باید dead شود، نه حلقه‌ی بی‌پایان', async () => {
    const id = await strandJob({
      kind: 'push', agoMinutes: 60 * 24, attempts: 5, maxAttempts: 5,
    });

    await runWorker(50);

    const row = await db.job.findUnique({ where: { id }, select: { status: true } });
    assert.equal(row?.status, 'dead',
      'jobی که سهمیه‌ی تلاشش تمام شده باید به DLQ برود — وگرنه بازپس‌گیری یک حلقه‌ی بی‌پایان می‌سازد');
  });

  // ── مرزِ اجاره: خیلی تهاجمی نباشد ────────────────────────────────────
  // این ادعا دقیقاً برعکسِ بالایی است و عمداً هست: اجاره‌ای که کوتاه‌تر از یک
  // handlerِ در حالِ اجرا باشد، jobِ زنده را بازپس می‌گیرد و پیامک را **دوبار**
  // می‌فرستد — که از خودِ نقص بدتر است.
  test('⭐ jobی که تازه claim شده (اجاره‌اش نگذشته) نباید بازپس گرفته شود', async () => {
    const { id } = await enqueue({
      kind: 'push',
      payload: { userId: `[DEMO] ${TAG}-fresh`, title: '[DEMO] تازه', body: '[DEMO]' },
      idempotencyKey: `${TAG}-fresh-lock`,
      priority: TEST_PRIORITY,
    });
    createdJobIds.push(id);

    const claimed = await claimJobs(50);
    assert.ok(claimed.some((j) => j.id === id),
      'موضوعِ تست غایب است: jobِ تازه claim نشد');

    const before = await db.job.findUnique({ where: { id }, select: { status: true } });
    assert.equal(before?.status, 'processing', 'موضوعِ تست غایب است: باید در processing باشد');

    // workerِ دیگری اجرا می‌شود در حالی که این job «هنوز در دستِ» workerِ اول است.
    await runWorker(50);

    const after = await db.job.findUnique({ where: { id }, select: { status: true } });
    assert.equal(after?.status, 'processing',
      'اجاره‌ی زودرس jobِ در حالِ اجرا را می‌دزدد و باعثِ ارسالِ دوباره می‌شود');
  });

  // ── دیدنی‌بودن ────────────────────────────────────────────────────────
  // مسیرِ بازپس‌گیری‌ای که کسی نتواند ببیندش، همان نقص است یک طبقه بالاتر.
  test('⭐ کارِ گیرکرده در متریکِ rezervno_jobs_stuck دیده می‌شود و پس از بازپس‌گیری صفر می‌شود', async () => {
    await refreshQueueMetrics();
    const before = gaugeValue(metrics.jobsStuck.render(), 'rezervno_jobs_stuck');

    const id = await strandJob({ kind: 'push', agoMinutes: 60 * 24 });

    await refreshQueueMetrics();
    const during = gaugeValue(metrics.jobsStuck.render(), 'rezervno_jobs_stuck');
    assert.equal(during, before + 1,
      'jobِ گیرکرده باید دقیقاً یک واحد به rezervno_jobs_stuck اضافه کند — وگرنه آلارم JobsStuckInProcessing کور است');

    await runWorker(50);

    await refreshQueueMetrics();
    const afterMetric = gaugeValue(metrics.jobsStuck.render(), 'rezervno_jobs_stuck');
    assert.equal(afterMetric, before,
      'پس از بازپس‌گیری متریک باید به مقدارِ اولیه برگردد — گیج‌ای که پایین نیاید، آلارمِ همیشه-روشن می‌سازد');

    const row = await db.job.findUnique({ where: { id }, select: { status: true } });
    assert.equal(row?.status, 'completed', 'موضوعِ تست غایب است: job باید پردازش شده باشد');
  });

  // ── گاردهای رانش (بعد از رفع نوشته شدند؛ اثباتِ نقص نیستند، ──────────
  //    جلوگیری از بازگشتِ خاموشِ آن‌اند)
  test('گاردِ رانش — اجاره باید کلِ batchِ سریالی را بپوشاند', async () => {
    // اگر کسی WORKER_BATCH_MAX یا سقفِ HTTP را بزرگ کند و اجاره را نه، اجاره
    // بی‌صدا ناکافی می‌شود و کارِ در حالِ اجرا بازپس گرفته می‌شود.
    assert.ok(
      JOB_LEASE_MS >= WORKER_BATCH_MAX * OUTBOUND_HTTP_TIMEOUT_MS,
      `اجاره (${JOB_LEASE_MS}ms) از بدترین‌حالتِ HTTPِ یک batch ` +
      `(${WORKER_BATCH_MAX} × ${OUTBOUND_HTTP_TIMEOUT_MS}ms) کوتاه‌تر است — بازپس‌گیریِ زودرس و ارسالِ دوباره`,
    );
    assert.equal(JOB_LEASE_MS, WORKER_BATCH_MAX * JOB_WORST_CASE_MS,
      'اجاره باید مشتقِ ثابت‌ها بماند، نه عددِ دستی');
  });

  test('گاردِ رانش — مرزِ dead در SQLِ بازپس‌گیری با shouldDeadLetter یکی است', async () => {
    // منطقِ DLQ ناچار در SQL تکرار شده (تا کلِ بازپس‌گیری اتمیک بماند). این
    // تست دو نسخه را روی مقادیرِ **مرزی** به هم گره می‌زند.
    const cases = [
      { attempts: 4, maxAttempts: 5 },
      { attempts: 5, maxAttempts: 5 },
      { attempts: 6, maxAttempts: 5 },
    ];
    for (const c of cases) {
      const id = await strandJob({ kind: 'push', agoMinutes: 60 * 24, ...c });
      const [reclaimed] = await reclaimStaleJobs(WORKER_BATCH_MAX);
      assert.ok(reclaimed, `موضوعِ تست غایب است: سطرِ کهنه بازپس گرفته نشد (attempts=${c.attempts})`);
      assert.equal(reclaimed.id, id, 'سطرِ بازپس‌گرفته‌شده همان سطرِ ساخته‌شده نیست');

      const expected = shouldDeadLetter(c.attempts, c.maxAttempts) ? 'dead' : 'pending';
      assert.equal(reclaimed.status, expected,
        `SQLِ بازپس‌گیری و shouldDeadLetter(${c.attempts}, ${c.maxAttempts}) اختلاف دارند — ` +
        `یکی از دو نسخه رانش کرده است`);
    }
  });

  test('گاردِ رانش — runWorker حتی با max بزرگ هم بیش از WORKER_BATCH_MAX پردازش نمی‌کند', async () => {
    // اجاره از WORKER_BATCH_MAX مشتق شده؛ batchِ بزرگ‌تر یعنی اجاره‌ی ناکافی.
    //
    // ⚠️ عمداً بدونِ monkey-patchِ `db.$queryRaw`: نسخه‌ی اولِ همین تست کلاینتِ
    // مشترکِ Prisma را با یک Proxy عوض می‌کرد و در `finally` یک نسخه‌ی
    // **bind‌شده** را برمی‌گرداند، نه خودِ متدِ اصلی — یعنی برای بقیه‌ی سوئیت
    // (که همه در یک پروسه‌اند) یک singletonِ دست‌کاری‌شده جا می‌گذاشت. سنجشِ
    // رفتار از بیرون هم همان ادعا را ثابت می‌کند و این ریسک را ندارد.
    const before = await db.job.count({ where: { status: 'pending' } });
    const extra = WORKER_BATCH_MAX + 3;
    for (let i = 0; i < extra; i++) {
      const { id } = await enqueue({
        kind: 'push',
        payload: { userId: `[DEMO] ${TAG}-cap-${i}`, title: '[DEMO] سقف', body: '[DEMO]' },
        idempotencyKey: `${TAG}-cap-${i}`,
        priority: TEST_PRIORITY,
      });
      createdJobIds.push(id);
    }

    // بدونِ این، ادعای «سقف» وقتی صف خالی است هم سبز می‌ماند — تستی که
    // موضوعش غایب باشد تست نیست.
    const pending = await db.job.count({ where: { status: 'pending' } });
    assert.ok(pending > WORKER_BATCH_MAX,
      `موضوعِ تست غایب است: برای سنجشِ سقف باید بیش از ${WORKER_BATCH_MAX} کارِ آماده باشد (هست: ${pending}، پیش از افزودن: ${before})`);

    const r = await runWorker(5000);
    const total = r.processed + r.failed + r.dead;
    assert.equal(total, WORKER_BATCH_MAX,
      `runWorker(5000) باید دقیقاً به ${WORKER_BATCH_MAX} مهار شود ولی ${total} کار پردازش کرد — ` +
      `اجاره (${JOB_LEASE_MS}ms) دیگر کلِ batch را نمی‌پوشاند و کارِ در حالِ اجرا بازپس گرفته می‌شود`);
  });

  test('countStaleProcessingJobs عددِ واقعی برمی‌گرداند، نه BigInt', async () => {
    // ⚠️ `count(*)` در $queryRaw مقدارِ BigInt می‌دهد حتی وقتی جنریکِ TS
    // `number` می‌گوید (جنریک فقط assertion است). هر دو لایه لازم‌اند:
    // `::int` در SQL و `Number()` در JS.
    const n = await countStaleProcessingJobs();
    assert.equal(typeof n, 'number', 'BigInt به بیرون نشت کرده — JSON.stringify رویش throw می‌کند');
    assert.ok(Number.isFinite(n), 'مقدار باید عددِ متناهی باشد');
  });
});
