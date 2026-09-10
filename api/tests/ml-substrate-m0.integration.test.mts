import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { db } from '../src/lib/db.ts';
import { transitionReservation } from '../src/lib/lifecycle.ts';
import {
  RULE_VERSION, HOLDOUT_PCT, holdoutBucket, isHoldout, guestKeyOf,
  assertDeclaredWindows, transitionDecisionInputs, substrateCoverageByStatus,
} from '../src/lib/ml-substrate.ts';
import { fixturePhone } from './_phone.helper.mts';

// ═══════════════════════════════════════════════════════════════════════
//  M0 — گیت‌های زیرساختِ رویداد
//  طرح: docs/audit/fixes/M0-EVENT-SUBSTRATE-DESIGN.md · تأییدِ CEO ۲۰۲۶-۰۹-۰۹
//
//  ⚠️ آنچه این فایل **ادعا نمی‌کند**: هیچ مدلی، هیچ AUC، هیچ پیش‌بینی‌ای.
//  M0 فقط زمین است. اگر روزی کسی از این تست‌ها نتیجه گرفت که «ML کار می‌کند»،
//  اشتباه خوانده است.
//
//  ⚠️ تصحیحی که خودِ طرح روی مندیت گذاشت: `reservation_events` **از قبل**
//  وجود داشت و تراکنشی نوشته می‌شد. ادعای درست «صفر رویدادِ چرخه‌ی رزرو به
//  platform_events می‌رسد» بود، نه «هیچ رویدادی ثبت نمی‌شود». این تست‌ها
//  غنی‌سازیِ همان نقطه‌ی نوشتن را می‌سنجند، نه یک مکانیزمِ دوم.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `m0-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string;
// رستورانِ اختصاصیِ تستِ پوشش (ساخته‌شده داخلِ خودِ تست تا از آلودگیِ متقابل مصون بماند)
let covTenantId: string | null = null, covRestaurantId: string | null = null;
const madeReservations: string[] = [];
const madeUsers: string[] = [];

async function mkUser(): Promise<string> {
  // ⚠️ پیشوندِ ۰۹۳۵ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
  const u = await db.user.create({
    data: { phone: fixturePhone('0935'), firstName: '[DEMO]', lastName: 'زیرساخت' },
    select: { id: true },
  });
  madeUsers.push(u.id);
  return u.id;
}

async function mkReservation(opts: { userId?: string | null; guestPhone?: string | null; restaurantId?: string } = {}) {
  const slotStart = new Date(Date.now() + 3 * 3600_000);
  const r = await db.reservation.create({
    data: {
      restaurantId: opts.restaurantId ?? restaurantId,
      code: `${TAG}-${randomUUID().slice(0, 6)}`.toUpperCase(),
      partySize: 2,
      slotStart,
      slotEnd: new Date(slotStart.getTime() + 90 * 60_000),
      status: 'confirmed',
      source: 'app',
      userId: opts.userId ?? null,
      guestPhone: opts.guestPhone ?? null,
      guestName: '[DEMO] مهمان',
    },
    select: { id: true },
  });
  madeReservations.push(r.id);
  return r.id;
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: TAG, name: '[DEMO] رستورانِ زیرساخت', clubPrefix: 'M0',
      timezone: 'Asia/Tehran', isOpen: true,
    },
    select: { id: true },
  });
  restaurantId = r.id;
});

after(async () => {
  // ⚠️ هیچ دریچه‌ای لازم نیست: حذفِ رزرو با cascade رویدادهایش را می‌برد، و
  // گارد دقیقاً همان مسیر را مجاز می‌داند. این خودش بخشی از اثبات است.
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  for (const rid of [covRestaurantId].filter(Boolean) as string[]) {
    await db.reservation.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
    await db.restaurant.deleteMany({ where: { id: rid } }).catch(() => {});
  }
  if (covTenantId) await db.tenant.deleteMany({ where: { id: covTenantId } }).catch(() => {});
  if (madeUsers.length) await db.user.deleteMany({ where: { id: { in: madeUsers } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('M0 — یک انتقالِ واقعی، یک ردیفِ غنی‌شده', () => {
  test('⚠️ رزروِ واقعیِ completed ردیفی با ورودی‌ها، نسخه‌ی قانون و مُهرِ زمانی می‌گذارد', async () => {
    const userId = await mkUser();
    const resvId = await mkReservation({ userId });

    // مسیرِ واقعیِ محصول — نه insertِ دستی.
    await transitionReservation({ reservationId: resvId, to: 'checked_in', actor: 'system', notify: false });
    await transitionReservation({ reservationId: resvId, to: 'seated', actor: 'system', notify: false });
    await transitionReservation({ reservationId: resvId, to: 'completed', actor: 'system', notify: false });

    const ev = await db.reservationEvent.findFirst({
      where: { reservationId: resvId, toStatus: 'completed' },
    });
    assert.ok(ev, 'انتقالِ completed باید یک ردیف بگذارد');

    assert.equal(ev!.restaurantId, restaurantId, 'restaurant_id باید روی خودِ ردیف کپی شود، نه با join');
    assert.equal(ev!.tenantId, tenantId, 'tenant_id هم همین‌طور');
    assert.equal(ev!.ruleVersion, RULE_VERSION, 'نسخه‌ی قانون باید ثبت شود');
    assert.ok(ev!.createdAt instanceof Date, 'مُهرِ زمانی');
    assert.equal(typeof ev!.holdoutBucket, 'number', 'مهمانِ شناخته‌شده باید سطل بگیرد');

    const inputs = ev!.decisionInputs as Record<string, { value: unknown; window: string }>;
    assert.ok(inputs, 'decision_inputs نباید خالی باشد');
    // ⚠️ قیدِ الزامیِ CEO: هر ورودی پنجره‌ی اعلام‌شده دارد.
    for (const [k, v] of Object.entries(inputs)) {
      assert.equal(typeof v.window, 'string', `ورودیِ ${k} پنجره ندارد`);
      assert.notEqual(v.window.trim(), '', `پنجره‌ی ${k} خالی است`);
    }
    assert.equal(inputs.party_size.value, 2);
    assert.equal(inputs.party_size.window, 'as_of:booking');
    assert.equal(typeof inputs.lead_time_minutes.value, 'number');
  });

  test('⚠️ هر سه انتقال ردیف می‌گذارند — نه فقط آخری', async () => {
    // «زیرساختی که فقط مسیرِ خوش را ثبت کند، مدلی می‌سازد که فقط مسیرِ خوش
    // را می‌شناسد.»
    const resvId = await mkReservation({ userId: await mkUser() });
    await transitionReservation({ reservationId: resvId, to: 'checked_in', actor: 'system', notify: false });
    await transitionReservation({ reservationId: resvId, to: 'seated', actor: 'system', notify: false });

    const evs = await db.reservationEvent.findMany({ where: { reservationId: resvId } });
    assert.equal(evs.length, 2);
    assert.deepEqual(evs.map((e) => e.toStatus).sort(), ['checked_in', 'seated']);
    assert.ok(evs.every((e) => e.ruleVersion === RULE_VERSION), 'هر دو باید نسخه‌ی قانون داشته باشند');
  });

  test('⚠️ برچسبِ no_show هم مثلِ completed ثبت می‌شود', async () => {
    // خلطِ cancelled و no_show رایج‌ترین باگِ برچسب‌گذاری است؛ اینجا پین می‌شود.
    const resvId = await mkReservation({ userId: await mkUser() });
    await transitionReservation({ reservationId: resvId, to: 'no_show', actor: 'system', notify: false });
    const ev = await db.reservationEvent.findFirst({ where: { reservationId: resvId, toStatus: 'no_show' } });
    assert.ok(ev, 'no_show باید ردیف بگذارد');
    assert.equal(ev!.ruleVersion, RULE_VERSION);
  });
});

describe('M0 — فقط-افزودنی، با تریگر و نه RLS', () => {
  test('⚠️ UPDATE روی یک ردیفِ **واقعی** رد می‌شود', async () => {
    const resvId = await mkReservation({ userId: await mkUser() });
    await transitionReservation({ reservationId: resvId, to: 'no_show', actor: 'system', notify: false });

    // ⚠️ روی جدولِ خالی هیچ تریگرِ FOR EACH ROW شلیک نمی‌کند و `UPDATE 0`
    // شبیهِ موفقیت به نظر می‌رسد — پس اینجا عمداً یک ردیفِ واقعی لازم است.
    const before = await db.reservationEvent.count({ where: { reservationId: resvId } });
    assert.ok(before > 0, 'برای آزمونِ تریگر باید ردیفِ واقعی وجود داشته باشد');

    await assert.rejects(
      () => db.$executeRawUnsafe(
        `UPDATE reservation_events SET reason = 'tampered' WHERE reservation_id = '${resvId}'::uuid`,
      ),
      /فقط-افزودنی/,
      'بازنویسیِ دادهٔ آموزش باید در سطحِ DB رد شود',
    );
  });

  test('⚠️ DELETE بدونِ دریچه‌ی صریح رد می‌شود، و با آن اجازه دارد', async () => {
    const resvId = await mkReservation({ userId: await mkUser() });
    await transitionReservation({ reservationId: resvId, to: 'no_show', actor: 'system', notify: false });

    await assert.rejects(
      () => db.$executeRawUnsafe(
        `DELETE FROM reservation_events WHERE reservation_id = '${resvId}'::uuid`,
      ),
      /مجاز نیست/,
      'حذفِ مستقیم در حالی که رزرو زنده است باید رد شود',
    );

    // ولی حذفِ خودِ رزرو باید با cascade رویدادهایش را ببرد — تنها مسیرِ مجاز.
    // ⚠️ این نیمه‌ی دوم ضروری است: نسخه‌ی اولِ گارد **cascade را هم می‌بست** و
    // ۴۷ فایلِ تست را شکست (۱۵۴۵ قرمز). بدونِ این assert، آن رگرسیون بی‌صدا
    // برمی‌گردد.
    await db.reservation.delete({ where: { id: resvId } });
    assert.equal(await db.reservationEvent.count({ where: { reservationId: resvId } }), 0);
  });

  test('⚠️ هیچ فایلی در src/ رویدادها را حذف نمی‌کند و دریچه‌ای نمی‌شناسد', () => {
    // گاردِ DELETE حالا دریچه‌ای ندارد که کدِ اپ بتواند بازش کند. این تست
    // همان ادعا را پین می‌کند: نه نامِ دریچه‌ی قدیمی جایی مانده، نه کدِ
    // تولیدی مستقیم رویداد حذف می‌کند.
    const SRC = join(import.meta.dirname, '..', 'src');
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
      }
      return out;
    };
    const offenders = walk(SRC)
      .filter((f) => {
        const t = readFileSync(f, 'utf8');
        return t.includes('allow_event_purge') || /reservationEvent\.delete/.test(t);
      })
      .map((f) => relative(SRC, f));
    assert.deepEqual(
      offenders, [],
      'کدِ تولیدی نباید رویدادِ چرخه‌ی حیات را حذف کند یا دریچه‌ای برای آن بشناسد',
    );
  });
});

describe('M0 — holdout از روزِ صفر', () => {
  test('⚠️ سطل به ازای **مهمان** پایدار است، نه به ازای رزرو', async () => {
    // اگر به ازای رزرو تصادفی شود، یک مهمان هم در holdout و هم در treatment
    // می‌افتد و تخمینِ uplift آلوده می‌شود.
    const userId = await mkUser();
    const ids = [await mkReservation({ userId }), await mkReservation({ userId }), await mkReservation({ userId })];
    for (const id of ids) {
      await transitionReservation({ reservationId: id, to: 'no_show', actor: 'system', notify: false });
    }
    const buckets = await db.reservationEvent.findMany({
      where: { reservationId: { in: ids } }, select: { holdoutBucket: true },
    });
    const distinct = new Set(buckets.map((b) => b.holdoutBucket));
    assert.equal(distinct.size, 1, `یک مهمان باید یک سطل داشته باشد، نه ${distinct.size}`);
    assert.equal(holdoutBucket(userId), [...distinct][0], 'سطلِ ثبت‌شده باید با محاسبه‌ی خالص یکی باشد');
  });

  test('⚠️ مهمانِ ناشناس سطل نمی‌گیرد — و null یعنی «تخصیص‌نیافته»، نه «خارج»', async () => {
    const resvId = await mkReservation({});
    await transitionReservation({ reservationId: resvId, to: 'no_show', actor: 'system', notify: false });
    const ev = await db.reservationEvent.findFirst({ where: { reservationId: resvId } });
    assert.equal(ev!.holdoutBucket, null);
    assert.equal(isHoldout(null), null, 'null نباید به false تبدیل شود — «نمی‌دانیم» ≠ «نه»');
    assert.equal(guestKeyOf({ userId: null, guestPhone: null }), null);
  });

  test('سطل‌ها در بازه‌ی ۰..۹۹ و پخش‌شده‌اند', () => {
    const keys = Array.from({ length: 2000 }, (_, i) => `guest-${i}`);
    const buckets = keys.map((k) => holdoutBucket(k)!);
    assert.ok(buckets.every((b) => Number.isInteger(b) && b >= 0 && b < 100));
    const inHoldout = buckets.filter((b) => b < HOLDOUT_PCT).length / buckets.length;
    // ۱۰٪ ± ۳ واحد — تستِ توزیع، نه تستِ دقتِ اعشاری.
    assert.ok(Math.abs(inHoldout - HOLDOUT_PCT / 100) < 0.03, `نسبتِ holdout = ${inHoldout}`);
  });
});

describe('M0 — پنجره‌ی زمانی اجباری است (قیدِ CEO)', () => {
  test('⚠️ ورودیِ بدونِ پنجره رد می‌شود', () => {
    assert.throws(
      () => assertDeclaredWindows({ leaky: { value: 1 } as any }),
      /پنجره/,
      'featureی بدونِ پنجره‌ی اعلام‌شده نشتِ زمانی است و باید رد شود',
    );
    assert.throws(() => assertDeclaredWindows({ blank: { value: 1, window: '  ' } }), /پنجره/);
  });

  test('همه‌ی ورودی‌های v1 پنجره‌ی اعلام‌شده دارند', () => {
    const inputs = transitionDecisionInputs({
      partySize: 4,
      slotStart: new Date('2026-10-01T18:30:00Z'),
      createdAt: new Date('2026-09-30T10:00:00Z'),
      source: 'app',
      noShowRiskTier: null, noShowRiskSource: null, depositRequested: false,
    }, 'Asia/Tehran');
    assert.doesNotThrow(() => assertDeclaredWindows(inputs));
    // ۲۰۲۶-۰۹-۳۰T۱۰:۰۰Z → ۲۰۲۶-۱۰-۰۱T۱۸:۳۰Z = ۳۲٫۵ ساعت = ۱۹۵۰ دقیقه.
    assert.equal(inputs.lead_time_minutes.value, 1950);
  });
});

describe('M0 — عددی که می‌تواند بیفتد (حمله‌ی ۲۰ Red Team)', () => {
  test('⚠️ نسبتِ پوشش با کورشدنِ یک کلاس **می‌افتد** — یعنی تزئین نیست', async () => {
    // ⚠️ رستورانِ اختصاصی: نسخه‌ی اولِ این تست از رستورانِ مشترکِ فایل استفاده
    // می‌کرد و **پیش از هر کورکردنی** نسبتش زیرِ ۱ بود — چون تستِ DELETE بالاتر
    // یک رزروِ no_show را بدونِ رویداد جا گذاشته بود. یعنی سنجه درست کار می‌کرد
    // و تست غلط بود: پوششِ واقعی همان کوریِ به‌جامانده را دیده بود.
    const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-cov` }, select: { id: true } });
    const r = await db.restaurant.create({
      data: {
        tenantId: t.id, slug: `${TAG}-cov`, name: '[DEMO] پوشش', clubPrefix: 'CV',
        timezone: 'Asia/Tehran', isOpen: true,
      },
      select: { id: true },
    });
    covTenantId = t.id; covRestaurantId = r.id;

    const a = await mkReservation({ userId: await mkUser(), restaurantId: r.id });
    const b = await mkReservation({ userId: await mkUser(), restaurantId: r.id });
    for (const id of [a, b]) {
      await transitionReservation({ reservationId: id, to: 'no_show', actor: 'system', notify: false });
    }

    const before = await substrateCoverageByStatus(r.id);
    const noShowBefore = before.find((r) => r.status === 'no_show');
    assert.ok(noShowBefore, 'کلاسِ no_show باید در گزارش باشد');
    assert.equal(noShowBefore!.ratio, 1, 'پیش از کورشدن باید کاملِ پوشش باشد');

    // شبیه‌سازیِ کوری **بدونِ هیچ حذفی**: یک رزروِ سوم می‌سازیم و وضعیتش را
    // با SQLِ خام مستقیم می‌نویسیم — یعنی دقیقاً کاری که یک مسیرِ کد که
    // چرخه‌ی حیات را دور بزند می‌کند. رویدادی ثبت نمی‌شود، پس آن کلاس کور
    // می‌شود. این وفادارتر از حذف است: کوریِ واقعی «ردیف نیامد» است، نه
    // «ردیف آمد و بعد پاک شد».
    const blind = await mkReservation({ userId: await mkUser(), restaurantId: r.id });
    await db.$executeRawUnsafe(
      `UPDATE reservations SET status = 'no_show' WHERE id = '${blind}'::uuid`,
    );

    const after = await substrateCoverageByStatus(r.id);
    const noShowAfter = after.find((r) => r.status === 'no_show')!;
    assert.ok(
      noShowAfter.ratio! < noShowBefore!.ratio!,
      `نسبت باید بیفتد: ${noShowBefore!.ratio} → ${noShowAfter.ratio}`,
    );
  });
});
