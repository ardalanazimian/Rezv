import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════════
//  شارژِ پیامکِ صف باید به‌ازای هر job **دقیقاً یک بار** باشد — دستورِ ۰۴۹ §۳
//
//  ── ادعا (بازبین، از روی خواندن؛ «هیچ‌چیز اجرا نشد») ──────────────────
//  هندلرِ `sms` در `worker.ts` **پیش از** فراخوانِ provider رستوران را شارژ
//  می‌کند (`consumeSms` → کاهشِ اتمیکِ `sms_balance` و افزایشِ `sms_total_sent`)،
//  و آن کاهش **هیچ کلیدی روی job ندارد**. پس:
//
//    ۱) provider شکست بخورد → `failJob` retry می‌گذارد → retry دوباره شارژ می‌کند.
//       SMS job سقفِ پیش‌فرضِ ۵ تلاش دارد، یعنی یک پیامِ ارسال‌نشده تا ۵ اعتبار.
//    ۲) worker پس از شارژ کرش کند → `reclaimStaleJobs` job را برمی‌گرداند →
//       دوباره شارژ می‌کند. (`d64d84a` این مسیر را تازه ساخت.)
//
//  `idempotencyKey`ِ `enqueue` جلوی **دوبار enqueue شدن** را می‌گیرد، نه جلوی
//  **دوبار اجرا شدنِ اثرِ جانبیِ** همان job.
//
//  ── این فایل اولین شاهدِ **اجرایی** آن یافته است ────────────────────
//  حکمِ CEO: اگر این تست روی کدِ پیش از رفع سبز شود، یافته رد شده و رفع نباید
//  نوشته شود. پس قرمز‌شدنش روی آن کد بخشی از قرارداد است، نه یک عارضه.
//
//  ── ⚠️ ضدِ سبزِ توخالی — و این‌جا یک تله‌ی مشخص دارد ─────────────────
//  `sendSmsNow` اگر `MELIPAYAMAK_USERNAME/PASSWORD` یا bodyIdِ الگو نباشد
//  **بی‌صدا return می‌کند** (`sms.ts:247-258`، `:281-285`) — throw نمی‌کند و
//  `fetch` را هم صدا نمی‌زند. یعنی تستی که env را نچیند، «provider شکست خورد»
//  را هرگز نمی‌سازد، و «موجودی یک بار کم شد» را به دلیلِ کاملاً غلطی سبز
//  می‌بیند. پس هر ادعای این فایل با **شمارشِ فراخوان‌های واقعیِ `fetch` به
//  شماره‌ی همین مهمان** قفل شده: اگر provider واقعاً صدا زده نشده، تست باید
//  روی کنترل بمیرد، نه روی ادعا.
//
//  و شمارش به شماره‌ی **همین** مهمان کلید خورده، نه کلِ فراخوان‌ها: `runWorker`
//  همه‌ی jobهای pendingِ دیتابیس را برمی‌دارد، از جمله باقی‌مانده‌ی فایل‌های دیگر.
// ═══════════════════════════════════════════════════════════════════════

const MELI_KEYS = ['MELIPAYAMAK_USERNAME', 'MELIPAYAMAK_PASSWORD', 'MELIPAYAMAK_BODYID_CAMPAIGN'] as const;
const savedEnv: Record<string, string | undefined> = {};

const { db } = await import('../src/lib/db.ts');
const { enqueueSms } = await import('../src/lib/sms.ts');
const { runWorker } = await import('../src/lib/worker.ts');

const TAG = `swc-${randomUUID().slice(0, 8)}`;
const ORIG_FETCH = globalThis.fetch;
const START_BALANCE = 10;

let tenantId = '';
let restaurantId = '';

/** شماره‌ی یکتای هر تست — تا شمارشِ fetch به همان مهمان کلید بخورد. */
const newPhone = () => `0912${Math.floor(1000000 + Math.random() * 8999999)}`;

/**
 * fetchِ جعلی. برای شماره‌ی `phone`، `failTimes` بارِ اول throw می‌کند و بعد
 * «پذیرفته شد» برمی‌گرداند؛ برای هر شماره‌ی دیگری (jobهای بازمانده‌ی فایل‌های
 * دیگر) همیشه «پذیرفته شد» — تا هیچ فراخوانی به شبکه‌ی واقعی نرسد.
 */
function stubProvider(phone: string, failTimes: number) {
  const calls = { forPhone: 0 };
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    const body = typeof init?.body === 'string' ? init.body : String(init?.body ?? '');
    if (body.includes(phone)) {
      calls.forPhone++;
      if (calls.forPhone <= failTimes) throw new Error('[DEMO] provider در دسترس نیست');
    }
    return new Response(JSON.stringify({ RetStatus: 1, Value: '9876543210', StrRetStatus: 'Ok' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

async function balance() {
  const r = await db.restaurant.findUnique({
    where: { id: restaurantId }, select: { smsBalance: true, smsTotalSent: true },
  });
  return { balance: r!.smsBalance, sent: r!.smsTotalSent };
}

async function jobFor(phone: string) {
  const job = await db.job.findFirst({
    where: { kind: 'sms', payload: { path: ['to'], equals: phone } },
    select: { id: true, status: true, attempts: true },
  });
  assert.ok(job, `پیش‌شرط: job برای ${phone} باید در صف باشد — enqueueSms به صف نرسید`);
  return job!;
}

/** job را فوراً قابلِ اجرای دوباره می‌کند — backoffِ `failJob` را دور می‌زند. */
async function makeRunnableNow(jobId: string) {
  await db.$executeRaw`UPDATE jobs SET run_after = now() WHERE id = ${jobId}::uuid`;
}

/** شبیه‌سازیِ reclaimِ یک job که اثرِ جانبی‌اش از قبل انجام شده. */
async function resurrect(jobId: string) {
  await db.$executeRaw`
    UPDATE jobs SET status = 'pending'::job_status, run_after = now(), locked_at = NULL
    WHERE id = ${jobId}::uuid`;
}

async function resetRestaurant() {
  await db.restaurant.update({
    where: { id: restaurantId }, data: { smsBalance: START_BALANCE, smsTotalSent: 0 },
  });
}

before(async () => {
  for (const k of MELI_KEYS) savedEnv[k] = process.env[k];
  process.env.MELIPAYAMAK_USERNAME = '[DEMO]user';
  process.env.MELIPAYAMAK_PASSWORD = '[DEMO]pass';
  process.env.MELIPAYAMAK_BODYID_CAMPAIGN = '123456';

  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-r`, name: '[DEMO] شارژِ پیامکِ صف', clubPrefix: 'SWC',
      timezone: 'Asia/Tehran', smsBalance: START_BALANCE, smsTotalSent: 0,
    },
    select: { id: true },
  });
  restaurantId = r.id;
});

after(async () => {
  globalThis.fetch = ORIG_FETCH;
  for (const k of MELI_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
  }
  await db.$executeRaw`DELETE FROM jobs WHERE kind = 'sms' AND payload->>'restaurantId' = ${restaurantId}`.catch(() => {});
  await db.smsTransaction.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('شارژِ پیامکِ صف به‌ازای هر job دقیقاً یک بار — دستورِ ۰۴۹ §۳', () => {
  beforeEach(async () => {
    globalThis.fetch = ORIG_FETCH;
    await resetRestaurant();
  });

  test('(الف) provider یک بار شکست می‌خورد و بعد می‌پذیرد → موجودی دقیقاً ۱ کم می‌شود', async () => {
    const phone = newPhone();
    const calls = stubProvider(phone, 1);
    try {
      await enqueueSms({ to: phone, template: 'campaign', tokens: ['[DEMO]', 'ر'], restaurantId });
      const job = await jobFor(phone);

      await runWorker(50);                       // تلاشِ اول — provider throw می‌کند
      await makeRunnableNow(job.id);
      await runWorker(50);                       // تلاشِ دوم — provider می‌پذیرد

      // ── کنترل‌ها: اگر این‌ها نگیرند، هیچ ادعای پایین معنا ندارد ──
      assert.equal(calls.forPhone, 2,
        'کنترل: provider باید دقیقاً دو بار برای همین مهمان صدا زده می‌شد (یک شکست + یک پذیرش). ' +
        'اگر صفر است، env چیده نشده و sendSmsNow بی‌صدا return کرده — تست چیزی نمی‌سنجد.');
      const done = await jobFor(phone);
      assert.equal(done.status, 'completed', 'کنترل: job پس از تلاشِ دوم باید completed باشد');

      // ── ادعا ──
      const b = await balance();
      assert.equal(b.balance, START_BALANCE - 1,
        `یک پیامِ تحویل‌شده باید دقیقاً ۱ اعتبار بخورد؛ موجودی ${START_BALANCE} → ${b.balance}. ` +
        'اگر ۲ کم شده، retry دوباره شارژ کرده — همان یافته‌ی ۰۴۹ §۳.');
      assert.equal(b.sent, 1,
        `sms_total_sent باید فقط روی ارسالِ **تأییدشده** حرکت کند؛ گرفت ${b.sent}`);
      const ledger = await db.smsTransaction.count({ where: { restaurantId } });
      assert.equal(ledger, 1, `دفترِ sms_transactions باید دقیقاً یک ردیفِ کسر داشته باشد؛ گرفت ${ledger}`);
    } finally {
      globalThis.fetch = ORIG_FETCH;
    }
  });

  test('(ب) provider همیشه شکست می‌خورد تا job مرده شود → هیچ اعتباری کم نمی‌شود', async () => {
    const phone = newPhone();
    const calls = stubProvider(phone, Number.POSITIVE_INFINITY);
    try {
      await enqueueSms({ to: phone, template: 'campaign', tokens: ['[DEMO]', 'ر'], restaurantId });
      const job = await jobFor(phone);

      for (let i = 0; i < 6; i++) {             // سقفِ پیش‌فرض ۵؛ یک اجرای اضافه برای اطمینان
        await makeRunnableNow(job.id);
        await runWorker(50);
      }

      const dead = await jobFor(phone);
      assert.equal(dead.status, 'dead', `کنترل: job پس از اتمامِ تلاش‌ها باید dead باشد؛ گرفت ${dead.status}`);
      assert.ok(calls.forPhone >= 5,
        `کنترل: provider باید دستِ‌کم ۵ بار برای همین مهمان صدا زده می‌شد؛ گرفت ${calls.forPhone}`);

      const b = await balance();
      assert.equal(b.balance, START_BALANCE,
        `هیچ پیامی تحویل نشد، پس هیچ اعتباری نباید کم شود؛ موجودی ${START_BALANCE} → ${b.balance}`);
      assert.equal(b.sent, 0, `sms_total_sent نباید برای ارسالِ ناموفق حرکت کند؛ گرفت ${b.sent}`);
    } finally {
      globalThis.fetch = ORIG_FETCH;
    }
  });

  test('(ج) jobِ ارسال‌شده و شارژشده دوباره اجرا شود (reclaim) → نه شارژِ دوم، نه ارسالِ دوم', async () => {
    const phone = newPhone();
    const calls = stubProvider(phone, 0);
    try {
      await enqueueSms({ to: phone, template: 'campaign', tokens: ['[DEMO]', 'ر'], restaurantId });
      const job = await jobFor(phone);

      await runWorker(50);
      assert.equal(calls.forPhone, 1, 'کنترل: اجرای اول باید provider را یک بار صدا بزند');
      assert.equal((await jobFor(phone)).status, 'completed', 'کنترل: اجرای اول باید completed شود');
      assert.equal((await balance()).balance, START_BALANCE - 1, 'کنترل: اجرای اول باید ۱ اعتبار بخورد');

      // همان job دوباره اجرا می‌شود — شکلِ reclaim پس از کرشی که بعد از
      // ارسال و شارژ و پیش از completeJob رخ داده.
      await resurrect(job.id);
      await runWorker(50);

      const b = await balance();
      assert.equal(b.balance, START_BALANCE - 1,
        `اجرای دوباره‌ی یک job نباید دوباره شارژ کند؛ موجودی ${START_BALANCE} → ${b.balance}`);
      assert.equal(calls.forPhone, 1,
        `اجرای دوباره‌ی jobی که شارژش ثبت شده، نباید دوباره به مهمان پیامک بفرستد؛ فراخوان‌ها: ${calls.forPhone}`);
    } finally {
      globalThis.fetch = ORIG_FETCH;
    }
  });

  test('(د) کنترلِ مثبت — موجودیِ صفر: ارسال نمی‌شود و چیزی کم نمی‌شود', async () => {
    await db.restaurant.update({ where: { id: restaurantId }, data: { smsBalance: 0 } });
    const phone = newPhone();
    const calls = stubProvider(phone, 0);
    try {
      await enqueueSms({ to: phone, template: 'campaign', tokens: ['[DEMO]', 'ر'], restaurantId });
      await runWorker(50);

      assert.equal(calls.forPhone, 0, 'بدونِ اعتبار نباید هیچ پیامکی برای این مهمان فرستاده شود');
      const b = await balance();
      assert.equal(b.balance, 0, 'موجودیِ صفر نباید منفی شود');
      assert.equal(b.sent, 0, 'ارسالی رخ نداده، پس sms_total_sent نباید حرکت کند');
    } finally {
      globalThis.fetch = ORIG_FETCH;
    }
  });
});
