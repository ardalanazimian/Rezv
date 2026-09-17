// ═══════════════════════════════════════════════════════════════════════
//  هشدارِ دیرکرد: فقط **پذیرشِ** ارائه‌دهنده هشدار است (STATE M-13 · F001 · حکمِ CEO D-20a)
//
//  حکم: «یک jobِ ساخته‌شده هشدار نیست. `late_warned_at` فقط وقتی ست می‌شود که ارائه‌دهنده ارسالِ
//  booking_late را بپذیرد (در worker، پس از موفقیت) یا مهمان خودش /eta بزند. اگر نشود فرستاد
//  (bodyId خالی، اعتبارِ صفر، ردِ ارائه‌دهنده) هیچ no_showِ خودکاری نیست؛ ردیف running_late می‌ماند و
//  متریک + آلارم فایر می‌کند.»
//
//  ⚠️ چرا `sendSmsCharged` مستقیم و نه `runWorker()`: handlerِ sms در `lib/worker.ts` دقیقاً
//  `sendSmsCharged(payload, { jobId: job.id, … })` است. `runWorker()` هر jobِ در صفِ **همه‌ی** فایل‌های
//  این رانرِ تک‌پروسه‌ای را برمی‌دارد و با stubِ fetchِ این فایل خرابشان می‌کند؛ این‌جا فقط jobِ خودمان
//  با همان تابع اجرا می‌شود.
//
//  ⚠️ env و stubِ fetch به‌ازای هر تست نصب و برداشته می‌شوند (نه در `before`ِ فایل) — درسِ
//  `rezervno-test-the-merged-tree`: hookهای سطحِ فایل در رانرِ یک‌پروسه‌ای اول از همه اجرا می‌شوند.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import './helpers/test-env.mts';
const { db } = await import('../src/lib/db');
const { transitionReservation, autoMarkNoShow } = await import('../src/lib/lifecycle');
const { sendSmsCharged } = await import('../src/lib/sms');
const { renderMetrics } = await import('../src/lib/metrics');
const { genReservationCode } = await import('../src/lib/reservation-helpers');
const { fixturePhone } = await import('./_phone.helper.mts');

// ⚠️ پیشوندِ ۰۹۴۸ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
const PHONE = '0948';
const SFX = randomUUID().slice(0, 6);
const TZ = 'Asia/Tehran';

const MELI: Record<string, string> = {
  MELIPAYAMAK_USERNAME: '[DEMO]user',
  MELIPAYAMAK_PASSWORD: '[DEMO]pass',
  MELIPAYAMAK_BODYID_LATE: '77777',
};
const ENV_KEYS = Object.keys(MELI);
const ORIG_FETCH = globalThis.fetch;
let savedEnv: Array<readonly [string, string | undefined]> = [];
/** پاسخِ ارائه‌دهنده به تفکیکِ شماره؛ شماره‌ی ناشناس = خطا (تستِ اجباری به شبکه نمی‌زند). */
const reply = new Map<string, 'accept' | 'reject'>();

beforeEach(() => {
  savedEnv = ENV_KEYS.map((k) => [k, process.env[k]] as const);
  for (const [k, v] of Object.entries(MELI)) process.env[k] = v;
  reply.clear();
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    let to = '';
    try { to = String(JSON.parse(init?.body ?? '{}').to ?? ''); } catch { /* بدنه‌ی نامعتبر */ }
    const r = reply.get(to);
    if (!r) throw new Error('[DEMO] تستِ اجباری حق ندارد به شبکه بزند');
    const body = r === 'accept'
      ? { RetStatus: 1, StrRetStatus: 'Ok', Value: '9876543210' }
      : { RetStatus: 0, StrRetStatus: '[DEMO] rejected', Value: '11' };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = ORIG_FETCH;
  for (const [k, v] of savedEnv) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

let tenantId = '';
const restaurantIds: string[] = [];
const reservationIds: string[] = [];
let seq = 0;

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] late-warn ${SFX}` } });
  tenantId = t.id;
});

async function scenario(opts: { minutesAgo: number; smsBalance?: number }) {
  const n = ++seq;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `late-warn-${SFX}-${n}`, name: '[DEMO] هشدار', clubPrefix: 'LWN', timezone: TZ,
      lateGraceMinutes: 15, smsBalance: opts.smsBalance ?? 10,
    },
  });
  restaurantIds.push(r.id);
  const table = await db.table.create({ data: { restaurantId: r.id, number: 1, capacity: 4, isActive: true } });
  const phone = fixturePhone(PHONE);
  const slotStart = new Date(Date.now() - opts.minutesAgo * 60_000);
  const resv = await db.reservation.create({
    data: {
      restaurantId: r.id, tableId: table.id, code: genReservationCode(), status: 'confirmed', partySize: 2,
      slotStart, slotEnd: new Date(slotStart.getTime() + 90 * 60_000), guestName: '[DEMO] مهمان', guestPhone: phone,
    },
  });
  reservationIds.push(resv.id);
  return { restaurantId: r.id, resv, phone };
}

/** jobِ هشدارِ همین رزرو — باید دقیقاً یکی باشد. */
async function warningJob(reservationId: string) {
  const jobs = await db.job.findMany({ where: { kind: 'sms', payload: { path: ['lateWarningFor'], equals: reservationId } } });
  assert.equal(jobs.length, 1, 'رفتن به running_late باید دقیقاً یک پیامکِ هشدار صف کند');
  return jobs[0];
}

const warnedAt = async (id: string) =>
  (await db.reservation.findUniqueOrThrow({ where: { id }, select: { lateWarnedAt: true } })).lateWarnedAt;

function blockedCounter(): number {
  const m = /^rezervno_no_show_blocked_unwarned_total(?:\{\})?\s+(\d+(?:\.\d+)?)\s*$/m.exec(renderMetrics());
  return m ? Number(m[1]) : 0;
}

async function send(job: { id: string; payload: unknown }) {
  return sendSmsCharged(job.payload as never, { jobId: job.id, reason: 'campaign' });
}

describe('M-13 — هشدارِ دیرکرد: صف ≠ هشدار؛ پذیرشِ ارائه‌دهنده = هشدار', () => {
  test('running_late یک پیامکِ booking_late صف می‌کند با ساعتِ مهلت — و صف‌شدن هنوز هشدار نیست', async () => {
    const s = await scenario({ minutesAgo: 3 });
    await transitionReservation({ reservationId: s.resv.id, to: 'running_late', actor: 'cron', isAutomatic: true });
    const job = await warningJob(s.resv.id);
    const p = job.payload as { template: string; to: string; tokens: string[]; restaurantId: string };
    assert.equal(p.template, 'booking_late');
    assert.equal(p.to, s.phone);
    assert.equal(p.restaurantId, s.restaurantId, 'D-20b: از موجودیِ رستوران، مثلِ booking_noshow');
    assert.equal(p.tokens.length, 3, 'سقفِ سه توکنِ الگو');
    assert.equal(p.tokens[1], s.resv.code);
    const expected = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })
      .format(new Date(s.resv.slotStart.getTime() + 15 * 60_000));
    assert.equal(p.tokens[2], expected, 'ساعتِ پیامک = guestDeadline (ساعت + مهلتِ رستوران)');
    assert.equal(await warnedAt(s.resv.id), null, 'job در صف است، نه به دستِ مهمان — late_warned_at باید خالی بماند');
  });

  test('ارائه‌دهنده پذیرفت → late_warned_at ست می‌شود، و no_show فقط پس از کفِ ۱۰ دقیقه', async () => {
    const s = await scenario({ minutesAgo: 30 });
    await transitionReservation({ reservationId: s.resv.id, to: 'running_late', actor: 'cron', isAutomatic: true });
    reply.set(s.phone, 'accept');
    const out = await send(await warningJob(s.resv.id));
    assert.equal(out.status, 'sent');
    const at = await warnedAt(s.resv.id);
    assert.ok(at && Date.now() - at.getTime() < 60_000, 'late_warned_at باید همین لحظه ست شده باشد');
    // مهلتِ رستوران (ساعت+۱۵) مدت‌ها گذشته، ولی هشدار همین الان رسید → کف: هنوز نه
    assert.equal(await autoMarkNoShow(s.restaurantId), 0, 'هشدار و جریمه در یک تیک — همان فروپاشی');
    await db.reservation.update({ where: { id: s.resv.id }, data: { lateWarnedAt: new Date(Date.now() - 11 * 60_000) } });
    assert.equal(await autoMarkNoShow(s.restaurantId), 1);
  });

  test('ارسالِ دوم لحظه‌ی اولین پذیرش را جابه‌جا نمی‌کند', async () => {
    const s = await scenario({ minutesAgo: 30 });
    await transitionReservation({ reservationId: s.resv.id, to: 'running_late', actor: 'cron', isAutomatic: true });
    reply.set(s.phone, 'accept');
    const job = await warningJob(s.resv.id);
    await send(job);
    const first = new Date(Date.now() - 5 * 60_000);
    await db.reservation.update({ where: { id: s.resv.id }, data: { lateWarnedAt: first } });
    await send(job);
    assert.equal((await warnedAt(s.resv.id))?.toISOString(), first.toISOString());
  });

  const unsendable: Array<[string, (s: Awaited<ReturnType<typeof scenario>>) => Promise<void>, string]> = [
    ['bodyIdِ LATE تنظیم نشده', async () => { delete process.env.MELIPAYAMAK_BODYID_LATE; }, 'not_accepted'],
    ['ارائه‌دهنده رد کرد', async (s) => { reply.set(s.phone, 'reject'); }, 'not_accepted'],
    ['اعتبارِ پیامکِ رستوران صفر', async (s) => {
      reply.set(s.phone, 'accept');
      await db.restaurant.update({ where: { id: s.restaurantId }, data: { smsBalance: 0 } });
    }, 'insufficient_balance'],
  ];
  for (const [label, arrange, expectedStatus] of unsendable) {
    test(`ارسال‌نشدنی (${label}): late_warned_at خالی، هیچ no_showِ خودکار، متریک +۱`, async () => {
      const s = await scenario({ minutesAgo: 60 });
      await transitionReservation({ reservationId: s.resv.id, to: 'running_late', actor: 'cron', isAutomatic: true });
      await arrange(s);
      const out = await send(await warningJob(s.resv.id));
      assert.equal(out.status, expectedStatus);
      assert.equal(await warnedAt(s.resv.id), null, 'هشداری نرسید — ستون نباید ادعای هشدار کند');
      const before = blockedCounter();
      assert.equal(await autoMarkNoShow(s.restaurantId), 0, 'بدونِ هشدارِ پذیرفته‌شده cron جریمه نمی‌کند');
      assert.equal(blockedCounter() - before, 1, 'ردیفِ مسدود باید شمرده شود — آلارم NoShowBlockedUnwarned به همین گوش می‌دهد');
      const row = await db.reservation.findUniqueOrThrow({ where: { id: s.resv.id }, select: { status: true } });
      assert.equal(row.status, 'running_late');
    });
  }
});

after(async () => {
  globalThis.fetch = ORIG_FETCH;
  for (const id of reservationIds) {
    await db.job.deleteMany({ where: { kind: 'sms', payload: { path: ['lateWarningFor'], equals: id } } }).catch(() => {});
  }
  for (const id of restaurantIds) {
    await db.reservation.deleteMany({ where: { restaurantId: id } }).catch(() => {});
    await db.table.deleteMany({ where: { restaurantId: id } }).catch(() => {});
    await db.restaurant.delete({ where: { id } }).catch(() => {});
  }
  await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
});
