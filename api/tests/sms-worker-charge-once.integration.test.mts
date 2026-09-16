import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';

// ═══════════════════════════════════════════════════════════════════════
//  پیامکِ رستوران در worker: هر پیامِ پذیرفته‌شده دقیقاً یک اعتبار — نه بیشتر، نه برای پیامِ نرفته
//
//  یافته (دستورِ ۰۴۹ §۳، ۲۰۲۶-۰۹-۱۱؛ از روی خواندنِ کد، اجرا نشده بود):
//  handlerِ `sms` در `worker.ts` **پیش از** تماس با ارائه‌دهنده `consumeSms`
//  می‌زد، بدونِ هیچ کلیدِ یکتاییِ به‌ازای job. پس:
//   • شکستِ شبکه → retry → کسرِ دوم (تا ۵ بار، پیش‌فرضِ maxAttempts)
//   • workerِ کشته‌شده پس از کسر → reclaim (d64d84a) → اجرای دوباره → کسرِ دوم
//  و `sms_total_sent` هم با هر تلاش یکی بالا می‌رفت.
//
//  و یک هم‌خانواده که ۰۴۹ نگفته بود، چون `sendSmsNow` را تا ته نخوانده بود:
//  ردِ ارائه‌دهنده (`RetStatus !== 1`) **throw نمی‌کند**، فقط لاگ می‌کند و
//  برمی‌گردد. پس job «completed» می‌شود و رستوران برای پیامی که هرگز پذیرفته
//  نشد یک اعتبار می‌دهد — بدونِ retry، روی **هر** رد.
//
//  رصد از حالتِ واقعی است: ستونِ `sms_balance`/`sms_total_sent`، دفترِ
//  `sms_transactions`، وضعیتِ سطرِ `jobs`، و شمارشِ تماس‌های ارائه‌دهنده به
//  تفکیکِ شماره‌ی گیرنده — نه spyِ درون‌فرایندی روی تابع.
//
//  ⚠️ هیچ درخواستی به شبکه نمی‌رود: `fetch` stub است و به شماره‌ای که مالِ
//  این فایل نیست خطای شبکه برمی‌گرداند (jobهای جامانده‌ی فایل‌های دیگر که
//  همین worker برمی‌دارد، retry می‌شوند و پول جابه‌جا نمی‌کنند).
// ═══════════════════════════════════════════════════════════════════════

// ⚠️ پیشوندِ ۰۹۲۸ مالِ همین فایل است — در فایلِ دیگری تکرارش نکن (tests/_phone.helper.mts).
const PHONE_PREFIX = '0928';

const MELI: Record<string, string> = {
  MELIPAYAMAK_USERNAME: '[DEMO]user',
  MELIPAYAMAK_PASSWORD: '[DEMO]pass',
  MELIPAYAMAK_BODYID_CAMPAIGN: '99999',
};
const ORIG_ENV = Object.keys(MELI).map((k) => [k, process.env[k]] as const);
const ORIG_FETCH = globalThis.fetch;

const { db } = await import('../src/lib/db.ts');
const { enqueue, JOB_LEASE_MS } = await import('../src/lib/queue.ts');
const { runWorker } = await import('../src/lib/worker.ts');
const { renderMetrics } = await import('../src/lib/metrics.ts');

const SFX = Date.now().toString(36).slice(-6);
let tenantId = '';
const jobIds: string[] = [];
const restaurantIds: string[] = [];

type Reply = 'accept' | 'reject' | 'network';
/** رفتارِ ارائه‌دهنده به تفکیکِ شماره: صفِ پاسخ‌ها، و شمارشِ تماس‌ها. */
const plan = new Map<string, Reply[]>();
const calls = new Map<string, number>();
/** اثرِ جانبیِ اختیاری هنگامِ تماس — برای شبیه‌سازیِ workerِ هم‌زمان. */
const onCall = new Map<string, () => Promise<void>>();

function stubProvider() {
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    let to = '';
    try { to = String(JSON.parse(init?.body ?? '{}').to ?? ''); } catch { /* بدنه‌ی نامعتبر → ناشناس */ }
    const queue = plan.get(to);
    if (!queue) throw new Error('[DEMO] تستِ اجباری حق ندارد به شبکه بزند');
    calls.set(to, (calls.get(to) ?? 0) + 1);
    const hook = onCall.get(to);
    if (hook) await hook();
    const reply = queue.length > 1 ? queue.shift()! : queue[0];
    if (reply === 'network') throw new Error('[DEMO] قطعیِ شبکه');
    const body = reply === 'accept'
      ? { RetStatus: 1, StrRetStatus: 'Ok', Value: '9876543210' }
      : { RetStatus: 0, StrRetStatus: '[DEMO] rejected', Value: '11' };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

async function makeRestaurant(balance: number): Promise<string> {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-smswk-${SFX}-${restaurantIds.length}`, name: '[DEMO] رستورانِ کسرِ یک‌باره',
      clubPrefix: 'SWK', timezone: 'Asia/Tehran', smsBalance: balance,
    },
    select: { id: true },
  });
  restaurantIds.push(r.id);
  return r.id;
}

async function enqueueSmsJob(to: string, restaurantId: string | null): Promise<string> {
  const { id } = await enqueue({
    kind: 'sms',
    payload: {
      to, template: 'campaign', tokens: ['[DEMO]'],
      ...(restaurantId ? { restaurantId } : {}),
    },
    idempotencyKey: `smswk-${SFX}-${jobIds.length}`,
    // اولویتِ ۱ تا کارِ این فایل اولِ batch باشد (همان درسِ queue-lease-reclaim).
    priority: 1,
  });
  jobIds.push(id);
  return id;
}

const money = async (id: string) => {
  const r = await db.restaurant.findUniqueOrThrow({ where: { id }, select: { smsBalance: true, smsTotalSent: true } });
  const debits = await db.smsTransaction.count({ where: { restaurantId: id, delta: { lt: 0 } } });
  return { balance: r.smsBalance, sent: r.smsTotalSent, debits };
};

const jobRow = (id: string) =>
  db.job.findUniqueOrThrow({ where: { id }, select: { status: true, attempts: true } });

/** retryِ زمان‌بندی‌شده را همین حالا قابلِ‌برداشت می‌کند — همان سطر، بدونِ صبرِ backoff. */
const dueNow = (id: string) => db.$executeRaw`UPDATE jobs SET run_after = now() WHERE id = ${id}::uuid`;

function counter(name: string): number {
  let total = 0;
  for (const line of renderMetrics().split('\n')) {
    const m = line.match(/^(\w+)(?:\{[^}]*\})?\s+(-?[\d.]+)$/);
    if (m && m[1] === name) total += Number(m[2]);
  }
  return total;
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] tenant sms-worker ${SFX}` }, select: { id: true } });
  tenantId = t.id;
});

/**
 * ⚠️ env و stub **به‌ازای هر تست** نصب و برداشته می‌شوند، نه در `before`ِ سطحِ فایل.
 * درسِ اولین اجرای کاملِ سوئیت (۲۰۲۶-۰۹-۱۳): رانر همه‌ی فایل‌ها را در یک
 * process اجرا می‌کند و `before`ِ ریشه‌ی **همه‌ی** فایل‌ها پیش از هر تستی اجرا
 * می‌شود. `sms-queue-fallback-balance` که پیش از این فایل import شده، در
 * `finally`ِ تست‌هایش کلیدهای ملی‌پیامک را پاک و `fetch` را برمی‌گرداند؛ پس
 * تست‌های این‌جا بی‌اعتبارنامه اجرا شدند و ارائه‌دهنده اصلاً صدا زده نشد. در
 * انزوا ۶/۶ سبز بود و در `npm test` ۵ قرمز — و کنترل‌های «موضوعِ تست غایب است»
 * همان را گرفتند، نه ادعاهای پول.
 */
function installProvider() {
  for (const [k, v] of Object.entries(MELI)) process.env[k] = v;
  stubProvider();
}
function removeProvider() {
  globalThis.fetch = ORIG_FETCH;
  for (const [k, v] of ORIG_ENV) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}

after(async () => {
  removeProvider();
  if (jobIds.length) await db.job.deleteMany({ where: { id: { in: jobIds } } }).catch(() => {});
  await db.smsTransaction.deleteMany({ where: { restaurantId: { in: restaurantIds } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('worker — پیامکِ رستوران دقیقاً یک اعتبار به‌ازای پیامِ پذیرفته‌شده (دستورِ ۰۴۹)', () => {
  beforeEach(() => { plan.clear(); calls.clear(); onCall.clear(); installProvider(); });
  afterEach(() => { removeProvider(); });

  test('🔴 شکستِ شبکه و بعد پذیرش → دقیقاً یک اعتبار، یک «ارسال‌شده»، یک ردیفِ دفتر', async () => {
    const to = fixturePhone(PHONE_PREFIX);
    const rid = await makeRestaurant(10);
    plan.set(to, ['network', 'accept']);
    const jid = await enqueueSmsJob(to, rid);

    await runWorker();
    assert.equal(calls.get(to), 1, 'موضوعِ تست غایب است: تلاشِ اول به ارائه‌دهنده نرسید');
    assert.equal((await jobRow(jid)).status, 'pending', 'شکستِ شبکه باید retry بخورد، نه completed/dead');

    await dueNow(jid);
    await runWorker();
    assert.equal(calls.get(to), 2, 'موضوعِ تست غایب است: retry اجرا نشد');
    assert.equal((await jobRow(jid)).status, 'completed');

    const m = await money(rid);
    assert.equal(m.balance, 9, `یک پیامِ پذیرفته‌شده = یک اعتبار؛ موجودی ${m.balance} است (کسر به‌ازای هر تلاش؟)`);
    assert.equal(m.sent, 1, 'sms_total_sent فقط با ارسالِ تأییدشده بالا می‌رود، نه با هر تلاش');
    assert.equal(m.debits, 1, 'دفترِ sms_transactions باید دقیقاً یک کسر داشته باشد');
  });

  test('🔴 ردِ ارائه‌دهنده → هیچ اعتباری کسر نمی‌شود و «ارسال‌شده» شمرده نمی‌شود', async () => {
    const to = fixturePhone(PHONE_PREFIX);
    const rid = await makeRestaurant(10);
    plan.set(to, ['reject']);
    const jid = await enqueueSmsJob(to, rid);

    await runWorker();
    assert.equal(calls.get(to), 1, 'موضوعِ تست غایب است: پیام به ارائه‌دهنده نرسید');
    assert.ok(['completed', 'pending', 'dead'].includes((await jobRow(jid)).status), 'job باید پردازش شده باشد');

    const m = await money(rid);
    assert.equal(m.balance, 10, 'پیامی که ارائه‌دهنده رد کرد نباید پولِ رستوران را بسوزاند');
    assert.equal(m.sent, 0, 'پیامِ ردشده «ارسال‌شده» نیست');
    assert.equal(m.debits, 0, 'پیامِ ردشده نباید کسری در دفتر بگذارد');
  });

  test('🔴 اجرای دوباره‌ی همان job پس از reclaim (کرش پیش از ثبتِ completed) → کسرِ دوم نه', async () => {
    const to = fixturePhone(PHONE_PREFIX);
    const rid = await makeRestaurant(10);
    plan.set(to, ['accept']);
    const dupBefore = counter('rezervno_sms_duplicate_send_total');
    const jid = await enqueueSmsJob(to, rid);

    await runWorker();
    assert.equal((await jobRow(jid)).status, 'completed', 'موضوعِ تست غایب است: اجرای اول کامل نشد');
    assert.equal((await money(rid)).balance, 9, 'اجرای اول باید دقیقاً یک اعتبار کسر کند');

    // کرش: اثرِ جانبی (ارسال + کسر) انجام شده ولی completed هرگز نوشته نشده —
    // سطر در processing با locked_atِ کهنه‌تر از اجاره، دقیقاً آنچه workerِ کشته‌شده می‌گذارد.
    await db.$executeRaw`
      UPDATE jobs SET status = 'processing'::job_status,
        locked_at = now() - (interval '1 millisecond' * ${JOB_LEASE_MS + 60_000})
      WHERE id = ${jid}::uuid`;

    await runWorker();
    assert.equal(calls.get(to), 2, 'موضوعِ تست غایب است: reclaim اجرا نشد و job دوباره نرفت');
    assert.equal((await jobRow(jid)).status, 'completed');

    const m = await money(rid);
    assert.equal(m.balance, 9, `همان job دو بار اجرا شد و موجودی ${m.balance} است — کسر باید به‌ازای job یکتا باشد`);
    assert.equal(m.debits, 1, 'کلیدِ یکتایی به‌ازای job: یک کسر در دفتر، هر چند بار که اجرا شود');

    // ⚠️ RT-20 (رد تیم، ۲۰۲۶-۰۹-۱۳) — ادعای تازه روی همان سناریو.
    //
    // `calls.get(to) === 2` بالا تا امروز فقط **پیش‌شرط** بود («reclaim اجرا
    // شد»). ولی همان عدد یک هزینه هم هست: پیامِ دوم واقعاً به مهمان رفت و
    // پلتفرم دو بار به ارائه‌دهنده پول داد. صورت‌حساب درست است (یک کسر) و
    // دقیقاً به همین دلیل هیچ‌چیز در دفتر این را نشان نمی‌دهد.
    //
    // پیش از این پچ، `already_charged` تنها خروجیِ `sendSmsCharged` بود که نه
    // لاگ داشت نه متریک — در کلِ `api/src` فقط در `sms-balance.ts` ظاهر می‌شد
    // و هیچ مصرف‌کننده‌ای نداشت. حالا شمرده می‌شود.
    assert.equal(counter('rezervno_sms_duplicate_send_total'), dupBefore + 1,
      'پیامِ دومِ واقعی به مهمان باید دیده شود — «یک کسر» یعنی «یک ارسال» نیست');
  });

  test('کنترل: موجودیِ صفر → اصلاً ارسال نمی‌شود و چیزی کسر نمی‌شود', async () => {
    // رفع نباید «ضدِ ارسال بدونِ اعتبار» را باز کند.
    const to = fixturePhone(PHONE_PREFIX);
    const rid = await makeRestaurant(0);
    plan.set(to, ['accept']);
    const jid = await enqueueSmsJob(to, rid);

    await runWorker();
    assert.equal(calls.get(to) ?? 0, 0, 'بدونِ اعتبار هیچ تماسی با ارائه‌دهنده نباید برود');
    assert.notEqual((await jobRow(jid)).status, 'completed', 'job بدونِ اعتبار نباید completed شود');
    const m = await money(rid);
    assert.deepEqual(m, { balance: 0, sent: 0, debits: 0 });
  });

  test('کنترل: پیامکِ سطحِ پلتفرم (بدونِ رستوران) بدونِ گاردِ موجودی می‌رود', async () => {
    const to = fixturePhone(PHONE_PREFIX);
    plan.set(to, ['accept']);
    const jid = await enqueueSmsJob(to, null);
    await runWorker();
    assert.equal(calls.get(to), 1, 'پیامکِ بدونِ رستوران باید ارسال شود');
    assert.equal((await jobRow(jid)).status, 'completed');
  });

  test('🔴 موجودی وسطِ ارسال تمام شود → موجودی منفی نمی‌شود و «ارسالِ بی‌کسر» صدا دارد', async () => {
    // چکِ پیش از ارسال اتمیک نیست (عمداً: کسرِ پیش از ارسال همان نقصِ ۰۴۹ بود).
    // اگر workerِ هم‌زمان آخرین اعتبار را میانِ چک و کسر خرج کند، پیام رفته
    // و کسر ممکن نیست. آن هزینه‌ی پلتفرم است نه رستوران — ولی نباید بی‌صدا باشد.
    const to = fixturePhone(PHONE_PREFIX);
    const rid = await makeRestaurant(1);
    plan.set(to, ['accept']);
    onCall.set(to, async () => {
      await db.restaurant.update({ where: { id: rid }, data: { smsBalance: 0 } });
    });
    const unchargedBefore = counter('rezervno_sms_uncharged_total');
    const jid = await enqueueSmsJob(to, rid);

    await runWorker();
    assert.equal(calls.get(to), 1, 'موضوعِ تست غایب است: پیام ارسال نشد');
    assert.equal((await jobRow(jid)).status, 'completed', 'پیامِ رفته نباید retry شود — retry یعنی پیامِ تکراری به مهمان');
    const m = await money(rid);
    assert.equal(m.balance, 0, 'موجودی هرگز منفی نمی‌شود');
    assert.equal(m.debits, 0, 'کسری که انجام نشد نباید در دفتر بیاید');
    assert.equal(counter('rezervno_sms_uncharged_total'), unchargedBefore + 1,
      'ارسالِ بی‌کسر باید در متریک دیده شود، نه سکوت');
  });
});
