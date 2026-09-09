import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  اقتصادِ امتیاز — نرخِ کانونی، فرمولِ کسب، مسیرِ خرج، و بازگردانیِ کش‌بک
//
//  زمینه (سندِ طراحی `docs/audit/research/LOYALTY-ECONOMY-DESIGN.md` §۰ و
//  §۶.۱-B، هر دو امروز دوباره راستی‌آزمایی شدند):
//
//   • `PointsReason.redemption` در کلِ `api/src` **صفر بار** نوشته می‌شد و
//     هیچ نرخِ امتیاز→تومانی وجود نداشت. دفتر یک شمارنده‌ی یک‌طرفه بود.
//   • کش‌بک در **لحظه‌ی ثبتِ رزرو** نوشته می‌شد و روی no_show/cancelled
//     **هرگز** برنمی‌گشت. بی‌ضرر بود چون امتیاز خرج‌شدنی نبود؛ با آمدنِ
//     خرج، دقیقاً می‌شد «رزروِ بزرگ بزن، کش‌بک بگیر، خرج کن، لغو کن».
//
//  تصمیمِ صریحِ مؤسس (۲۰۲۶-۰۹-۰۹، هر دو عدد): «۱۰۰۰ تومان = ۲۵ امتیاز» و
//  «۱ امتیاز = ۲ تومان». این فایل هر دو را روی کدِ واقعی می‌سنجد، نه روی
//  یک ثابتِ کپی‌شده.
//
//  چهار تضمینی که این‌جا falsifiable شده‌اند (هر کدام با تزریقِ نقض قرمز
//  شد و با بازگردانی سبز — خروجی‌های خام در گزارشِ همین تغییر):
//   G1) شرطِ موجودی داخلِ خودِ INSERT  → خرجِ بیش از موجودی ممکن نیست.
//   G2) قفلِ سریال‌سازی (FOR UPDATE)   → خرجِ هم‌زمان موجودی را منفی نمی‌کند.
//   G3) کلیدِ idempotency روی بازخرید  → تکرارِ یک بازخرید دوبار کسر نمی‌کند.
//   G4) بازگردانیِ کش‌بک روی لغو/عدم‌حضور → ارزش نزدِ مشتری نمی‌ماند.
//
//  ⚠️ G2 عمداً جدا از G1 آزموده می‌شود. الگویِ `rewards.ts:158-163`
//  (`UPDATE … WHERE wallet_balance >= cost`) **عیناً به این‌جا منتقل
//  نمی‌شود**: آن‌جا موجودی یک ستون رویِ یک ردیف است و قفلِ ردیف کار را تمام
//  می‌کند؛ این‌جا موجودی یک aggregate رویِ جدولِ append-only است و هیچ ردیفی
//  برای قفل‌شدن ندارد. شرطِ داخلِ INSERT لازم است ولی کافی نیست.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { fixturePhone } = await import('./_phone.helper.mts');
const {
  TOMAN_PER_POINT, pointsToToman, tomanToPoints, cashbackPointsFor,
  redeemPoints, reverseReservationCashback, getPointsBalanceInScope, addClubPoints,
} = await import('../src/lib/loyalty.ts');
const { createReservation } = await import('../src/lib/reservations.ts');
const { transitionReservation } = await import('../src/lib/lifecycle.ts');
const {
  CASHBACK_REVERSING_STATUSES, isCashbackReversingStatus,
} = await import('../src/lib/reservation-status.ts');
const { setPlatformSetting } = await import('../src/lib/platform-settings.ts');
const { invalidatePattern } = await import('../src/lib/cache.ts');
const { dateKeyInTz } = await import('../src/lib/hours.ts');

const FLAG_KEY = 'feature_flag:points_redemption_enabled';

/** فلگِ خرج را روشن کن (پیش‌فرضش عمداً خاموش است — رجوع کن به DEFAULT_OFF). */
async function enableRedemption() {
  await setPlatformSetting(FLAG_KEY, 'true');
  await invalidatePattern(`platform-settings:${FLAG_KEY}`);
}
/** به حالتِ پیش‌فرض (خاموش) برگرد — هیچ تستِ دیگری نباید فلگِ روشن ببیند. */
async function resetRedemptionFlag() {
  await db.platformSettings.deleteMany({ where: { key: FLAG_KEY } });
  await invalidatePattern(`platform-settings:${FLAG_KEY}`);
}

const TAG = `pr-${randomUUID().slice(0, 8)}`;
/** ۳۱ روز بعد — همان الگویِ points-ledger-idempotency-key. */
const SLOT_DATE_OFFSET_DAYS = 31;
const SLOT_TIME = '19:00';

/** قیمتِ آیتم عمداً دقیقاً عددِ مؤسس است: ۱۰۰۰ تومان. */
const ITEM_PRICE = 1000;
/** درصدِ پیش‌فرضِ رستوران (`schema.prisma` → `cbBasePct @default(5)`). */
const CB_PCT = 5;

let tenantId = '';
let restaurantId = '';
let menuItemId = '';

/** کاربرهای این فایل — هر تست کاربرِ خودش را دارد تا موجودی‌ها قاطی نشوند. */
const users: Record<string, string> = {};
let phoneSeq = 700;

async function makeUser(label: string): Promise<string> {
  const u = await db.user.create({
    data: { phone: fixturePhone(String(phoneSeq++).padStart(4, '0')), firstName: '[DEMO]', lastName: label },
  });
  users[label] = u.id;
  await db.clubMember.create({
    data: { restaurantId, userId: u.id, code: `PRD-${randomUUID().slice(0, 6)}` },
  });
  return u.id;
}

/** رزروِ ۱۰۰۰ تومانی با پیش‌سفارش — یعنی مسیرِ واقعیِ کسبِ کش‌بک. */
async function bookWithPreorder(userId: string) {
  const date = dateKeyInTz(new Date(Date.now() + SLOT_DATE_OFFSET_DAYS * 86_400_000), 'Asia/Tehran');
  const resv = await createReservation({
    restaurantId, date, time: SLOT_TIME, partySize: 2,
    userId, source: 'app', notifySms: false,
    preorder: [{ menuItemId, qty: 1 }],
  });
  const row = await db.reservation.findUnique({ where: { code: resv.code }, select: { id: true, status: true } });
  assert.ok(row, 'پیش‌شرط: رزرو باید در DB باشد');
  return { resv, id: row.id, status: row.status };
}

describe('اقتصادِ امتیاز — نرخِ کانونی، کسب، خرج، بازگردانی', () => {
  before(async () => {
    const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` } });
    tenantId = t.id;
    const r = await db.restaurant.create({
      data: {
        tenantId, slug: `${TAG}-r`, name: `[DEMO] ${TAG}`, timezone: 'Asia/Tehran',
        clubPrefix: 'PRD', isOpen: true, onlineGating: false,
      },
    });
    restaurantId = r.id;
    assert.equal(r.cbBasePct, CB_PCT, 'پیش‌شرط: درصدِ پیش‌فرضِ کش‌بک باید ۵ باشد');
    // ظرفیتِ کافی برای چند رزروِ هم‌ساعت در تست‌های مختلف.
    for (let i = 1; i <= 8; i++) {
      await db.table.create({ data: { restaurantId, number: i, capacity: 4, isActive: true } });
    }
    const item = await db.menuItem.create({
      data: { restaurantId, name: `[DEMO] آیتم ${TAG}`, priceToman: ITEM_PRICE },
    });
    menuItemId = item.id;
  });

  beforeEach(resetRedemptionFlag);

  after(async () => {
    await resetRedemptionFlag();
    const ids = Object.values(users);
    await db.pointsLedger.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await db.reservationItem.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
    await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
    await db.modelPrediction.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
    await db.economyLedgerEntry.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await db.customerEconomyProfile.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
    await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
    await db.menuItem.deleteMany({ where: { restaurantId } }).catch(() => {});
    await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
    await db.customerInsight.deleteMany({ where: { restaurantId } }).catch(() => {});
    await db.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
    await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  });

  // ═════════════════════════════════════════════════════════════════════
  describe('۱. نرخِ کانونی — عددِ مؤسس، و اینکه رند پول خلق نمی‌کند', () => {
    test('عددِ صریحِ مؤسس: ۱۰۰۰ تومان × ۵٪ → ۲۵ امتیاز، و ۱ امتیاز = ۲ تومان', () => {
      assert.equal(TOMAN_PER_POINT, 2, 'نرخ باید همان عددی باشد که مؤسس گفت');
      assert.equal(cashbackPointsFor(1000, 5), 25, '۱۰۰۰ تومان با ۵٪ باید دقیقاً ۲۵ امتیاز بدهد');
      assert.equal(pointsToToman(25), 50, '۲۵ امتیاز باید دقیقاً ۵۰ تومان باشد — یعنی همان ۵٪');
    });

    test('نرخ در کلِ src فقط یک تعریف دارد — عددِ پولیِ تکراری همان نقصِ CUSTOMER_APP_URL است', async () => {
      const { readFileSync, readdirSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const libDir = fileURLToPath(new URL('../src/lib/', import.meta.url));
      const files = readdirSync(libDir).filter((f) => f.endsWith('.ts'));
      assert.ok(files.length > 20, 'پیش‌شرط: فهرستِ فایل‌ها نباید خالی/کوچک باشد — وگرنه این تست هیچ نمی‌سنجد');
      const definers = files.filter((f) => /export\s+const\s+TOMAN_PER_POINT\b/.test(readFileSync(libDir + f, 'utf8')));
      assert.deepEqual(definers, ['loyalty.ts'],
        `نرخِ تومان-بر-امتیاز باید دقیقاً یک تعریف داشته باشد — پیدا شد: ${JSON.stringify(definers)}`);
    });

    test('رفت‌وبرگشت هرگز پول خلق نمی‌کند و بیش از یک واحد هم گم نمی‌کند', () => {
      let checked = 0;
      for (let v = 0; v <= 500; v++) {
        const back = pointsToToman(tomanToPoints(v));
        assert.ok(back <= v, `ارزشِ ${v} تومان پس از رفت‌وبرگشت شد ${back} — پول خلق شد`);
        assert.ok(v - back < TOMAN_PER_POINT, `ارزشِ ${v} تومان بیش از یک واحدِ نرخ گم شد (${back})`);
        checked++;
      }
      assert.equal(checked, 501, 'حلقه باید واقعاً اجرا شده باشد — غیبتِ موضوع یعنی خطا، نه پاس');
    });

    test('کسبِ کش‌بک روی هر چهار درصدِ پنل هرگز بیش از ارزشِ واقعی نمی‌دهد', () => {
      let checked = 0;
      for (const pct of [5, 8, 12, 20, 40]) {
        for (const final of [1, 7, 999, 1000, 1001, 123_457, 5_000_000]) {
          const pts = cashbackPointsFor(final, pct);
          assert.ok(Number.isInteger(pts) && pts >= 0, `امتیاز باید صحیحِ نامنفی باشد — شد ${pts}`);
          assert.ok(pointsToToman(pts) <= (final * pct) / 100,
            `final=${final} pct=${pct}: خروجی ${pointsToToman(pts)} تومان > ارزشِ ${(final * pct) / 100}`);
          checked++;
        }
      }
      assert.equal(checked, 35, 'همه‌ی ترکیب‌ها باید سنجیده شده باشند');
    });

    test('ورودیِ نامعتبر خطا می‌دهد — سکوت یعنی گاردِ خالی', () => {
      assert.throws(() => pointsToToman(-1), /نامنفی/);
      assert.throws(() => pointsToToman(1.5), /صحیح/);
      assert.throws(() => tomanToPoints(-1), /نامنفی/);
      assert.equal(cashbackPointsFor(0, 5), 0);
      assert.equal(cashbackPointsFor(1000, 0), 0);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  describe('۲. کسب — همان فرمول، از مسیرِ واقعیِ رزرو', () => {
    test('رزروِ ۱۰۰۰ تومانی دقیقاً ۲۵ امتیاز در دفتر می‌نویسد، نه ۵۰', async () => {
      const uid = await makeUser('earn');
      const { resv, id } = await bookWithPreorder(uid);
      assert.equal(resv.checkout?.final, ITEM_PRICE, 'پیش‌شرط: صورت‌حسابِ نهایی باید ۱۰۰۰ باشد');
      assert.equal(resv.checkout?.cashback, 25,
        'فرمولِ قدیمی ۵۰ می‌داد (۱ امتیاز = ۱ تومانِ ضمنی) — حالا باید ۲۵ باشد');

      const rows = await db.pointsLedger.findMany({ where: { userId: uid, reason: 'cashback' } });
      assert.equal(rows.length, 1, 'دقیقاً یک ردیفِ کش‌بک');
      assert.equal(rows[0].delta, 25);
      assert.equal(rows[0].idempotencyKey, `cashback:${id}`);
      assert.equal(rows[0].restaurantId, restaurantId, 'اسکوپِ ردیف باید همان رستوران باشد');
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  describe('۳. خرج — مسیری که تا امروز اصلاً وجود نداشت', () => {
    test('پیش‌فرض خاموش است: بدونِ روشن‌کردنِ فلگ هیچ امتیازی خرج نمی‌شود', async () => {
      const uid = await makeUser('flagoff');
      await db.pointsLedger.create({
        data: { userId: uid, restaurantId, delta: 100, reason: 'adjustment', note: '[DEMO]' },
      });
      await assert.rejects(
        () => redeemPoints({ userId: uid, restaurantId, points: 10, idempotencyKey: `t:${randomUUID()}` }),
        /غیرفعال/,
        'با فلگِ خاموش باید FEATURE_DISABLED بدهد',
      );
      assert.equal(await db.pointsLedger.count({ where: { userId: uid, reason: 'redemption' } }), 0,
        'هیچ ردیفِ خرجی نباید نوشته شده باشد');
    });

    test('خرجِ موفق: ردیفِ منفی با reason=redemption و کلیدِ idempotency', async () => {
      const uid = await makeUser('spend');
      // عمداً از `addClubPoints` — یعنی مسیری که کشِ `club_members.points` را
      // هم می‌نویسد؛ فقط این‌طور می‌شود هم‌قدم‌ماندنِ کش را واقعاً سنجید.
      await addClubPoints({ userId: uid, restaurantId, delta: 100, reason: 'adjustment', note: '[DEMO]' });
      await enableRedemption();

      const key = `spend:${randomUUID()}`;
      const out = await redeemPoints({ userId: uid, restaurantId, points: 40, idempotencyKey: key, note: '[DEMO] خرج' });

      assert.equal(out.pointsSpent, 40);
      assert.equal(out.tomanValue, 80, '۴۰ امتیاز = ۸۰ تومان با نرخِ کانونی');
      assert.equal(out.balanceAfter, 60);
      assert.equal(out.alreadyApplied, false);

      const rows = await db.pointsLedger.findMany({ where: { userId: uid, reason: 'redemption' } });
      assert.equal(rows.length, 1, 'دقیقاً یک ردیفِ خرج');
      assert.equal(rows[0].delta, -40, 'delta باید منفی باشد — این اولین نویسنده‌ی منفیِ این جدول است');
      assert.equal(rows[0].idempotencyKey, key);
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 60);

      const member = await db.clubMember.findUnique({
        where: { restaurantId_userId: { restaurantId, userId: uid } }, select: { points: true },
      });
      assert.equal(member?.points, 60, 'کشِ club_members باید با دفتر هم‌قدم بماند');
    });

    test('G1 — خرجِ بیش از موجودی رد می‌شود و هیچ ردیفی نمی‌نویسد', async () => {
      const uid = await makeUser('overdraft');
      await db.pointsLedger.create({
        data: { userId: uid, restaurantId, delta: 100, reason: 'adjustment', note: '[DEMO]' },
      });
      await enableRedemption();

      await assert.rejects(
        () => redeemPoints({ userId: uid, restaurantId, points: 101, idempotencyKey: `od:${randomUUID()}` }),
        /کافی نیست/,
      );
      assert.equal(await db.pointsLedger.count({ where: { userId: uid, reason: 'redemption' } }), 0);
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 100, 'موجودی نباید دست بخورد');
    });

    test('G1 — اسکوپ‌ها با هم قاطی نمی‌شوند: امتیازِ پلتفرم در رستوران خرج نمی‌شود', async () => {
      const uid = await makeUser('scope');
      // اعطای پلتفرمی: restaurantId = null (همان کاری که تولد/دعوت می‌کنند).
      await db.pointsLedger.create({
        data: { userId: uid, restaurantId: null, delta: 1000, reason: 'birthday', note: '[DEMO]' },
      });
      await enableRedemption();

      await assert.rejects(
        () => redeemPoints({ userId: uid, restaurantId, points: 10, idempotencyKey: `sc:${randomUUID()}` }),
        /کافی نیست/,
        'موجودیِ کیفِ پلتفرم نباید بدهیِ رستوران شود (قاعده‌ی ۵)',
      );
      // در اسکوپِ خودش خرج می‌شود.
      const out = await redeemPoints({ userId: uid, restaurantId: null, points: 10, idempotencyKey: `sc2:${randomUUID()}` });
      assert.equal(out.balanceAfter, 990);
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 0, 'اسکوپِ رستوران باید دست‌نخورده و صفر بماند');
    });

    test('G3 — همان کلید دو بار: یک ردیف، یک کسر', async () => {
      const uid = await makeUser('idem');
      await db.pointsLedger.create({
        data: { userId: uid, restaurantId, delta: 100, reason: 'adjustment', note: '[DEMO]' },
      });
      await enableRedemption();

      const key = `idem:${randomUUID()}`;
      const first = await redeemPoints({ userId: uid, restaurantId, points: 30, idempotencyKey: key });
      const second = await redeemPoints({ userId: uid, restaurantId, points: 30, idempotencyKey: key });

      assert.equal(first.alreadyApplied, false);
      assert.equal(second.alreadyApplied, true, 'فراخوانیِ دوم باید تکرار را تشخیص دهد، نه دوباره کسر کند');
      assert.equal(await db.pointsLedger.count({ where: { userId: uid, reason: 'redemption' } }), 1,
        'دقیقاً یک ردیفِ خرج — تکرار نباید ردیفِ دوم بسازد');
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 70, 'فقط یک‌بار کسر شده باشد');
    });

    test('G3 — کلیدِ تکراری روی کاربر/اسکوپِ دیگر بلند می‌شکند، نه بی‌صدا «قبلاً انجام شد»', async () => {
      const a = await makeUser('keyA');
      const b = await makeUser('keyB');
      await addClubPoints({ userId: a, restaurantId, delta: 100, reason: 'adjustment', note: '[DEMO]' });
      await addClubPoints({ userId: b, restaurantId, delta: 100, reason: 'adjustment', note: '[DEMO]' });
      await enableRedemption();

      const key = `dup:${randomUUID()}`;
      await redeemPoints({ userId: a, restaurantId, points: 10, idempotencyKey: key });
      await assert.rejects(
        () => redeemPoints({ userId: b, restaurantId, points: 10, idempotencyKey: key }),
        /کلیدِ idempotency/,
        'کلیدِ یک کاربر نباید خرجِ کاربرِ دیگر را بی‌صدا «انجام‌شده» اعلام کند',
      );
      assert.equal(await getPointsBalanceInScope(b, restaurantId), 100, 'موجودیِ کاربرِ دوم باید دست‌نخورده بماند');
    });

    test('G2 — شش خرجِ هم‌زمانِ کلِ موجودی: فقط یکی موفق، موجودی هرگز منفی', async () => {
      const uid = await makeUser('race');
      await db.pointsLedger.create({
        data: { userId: uid, restaurantId, delta: 100, reason: 'adjustment', note: '[DEMO]' },
      });
      await enableRedemption();

      const N = 6;
      const settled = await Promise.allSettled(
        Array.from({ length: N }, () =>
          redeemPoints({ userId: uid, restaurantId, points: 100, idempotencyKey: `race:${randomUUID()}` }),
        ),
      );
      const ok = settled.filter((s) => s.status === 'fulfilled');
      assert.equal(settled.length, N, 'همه‌ی تلاش‌ها باید واقعاً اجرا شده باشند');
      assert.equal(ok.length, 1, `دقیقاً یک خرج باید موفق شود — شد ${ok.length}`);

      assert.equal(await db.pointsLedger.count({ where: { userId: uid, reason: 'redemption' } }), 1,
        'دقیقاً یک ردیفِ خرج در دفتر');
      const bal = await getPointsBalanceInScope(uid, restaurantId);
      assert.equal(bal, 0, `موجودی باید صفر بماند، نه منفی — شد ${bal}`);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  describe('۴. رفت‌وبرگشتِ کامل — تومانِ ورودی = تومانِ خروجی', () => {
    test('کسب روی صورت‌حسابِ معلوم، خرجِ کلِ موجودی، تساویِ دقیقِ ارزشِ تومانی', async () => {
      const uid = await makeUser('roundtrip');
      const { resv } = await bookWithPreorder(uid);

      // ارزشی که رستوران وعده داد: درصدِ خودش روی صورت‌حسابِ نهایی.
      const tomanIn = (resv.checkout!.final * CB_PCT) / 100;
      assert.equal(tomanIn, 50, 'پیش‌شرط: ۵٪ از ۱۰۰۰ باید ۵۰ تومان باشد');

      const earned = await getPointsBalanceInScope(uid, restaurantId);
      assert.equal(earned, 25, 'پیش‌شرط: موجودیِ اسکوپ باید همان کش‌بک باشد');

      await enableRedemption();
      const out = await redeemPoints({
        userId: uid, restaurantId, points: earned, idempotencyKey: `rt:${randomUUID()}`,
      });

      assert.equal(out.tomanValue, tomanIn,
        `تومانِ خروجی (${out.tomanValue}) باید دقیقاً برابرِ تومانِ ورودی (${tomanIn}) باشد — نه بیشتر، نه کمتر`);
      assert.equal(out.balanceAfter, 0, 'کلِ موجودی خرج شد');
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 0);

      // و هیچ امتیازِ باقی‌مانده‌ای نیست که بشود دوباره خرج کرد.
      await assert.rejects(
        () => redeemPoints({ userId: uid, restaurantId, points: 1, idempotencyKey: `rt2:${randomUUID()}` }),
        /کافی نیست/,
      );
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  describe('۵. G4 — بازگردانیِ کش‌بک: گاردی که بدونش خرج نباید روشن شود', () => {
    test('مجموعه‌ی وضعیت‌ها شاملِ هر پایانِ «وعده اتفاق نیفتاد» است و completed را ندارد', () => {
      assert.ok(CASHBACK_REVERSING_STATUSES.length >= 5, 'مجموعه نباید خالی/ناقص باشد');
      for (const s of ['no_show', 'cancelled', 'auto_cancelled', 'rejected', 'expired',
        'cancelled_by_user', 'cancelled_by_restaurant']) {
        assert.ok(isCashbackReversingStatus(s), `${s} باید کش‌بک را برگرداند`);
      }
      for (const s of ['completed', 'seated', 'dining', 'confirmed', 'checked_in']) {
        assert.equal(isCashbackReversingStatus(s), false, `${s} نباید کش‌بک را برگرداند`);
      }
    });

    test('لغوِ رزرو از مسیرِ واقعیِ lifecycle، کش‌بک را دقیقاً صفر می‌کند', async () => {
      const uid = await makeUser('cancel');
      const { id } = await bookWithPreorder(uid);
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 25, 'پیش‌شرط: کش‌بک نوشته شده باشد');

      await transitionReservation({ reservationId: id, to: 'cancelled', actor: 'system', notify: false });

      const rev = await db.pointsLedger.findUnique({ where: { idempotencyKey: `cashback-reversal:${id}` } });
      assert.ok(rev, 'ردیفِ جبرانی باید ساخته شده باشد');
      assert.equal(rev.delta, -25, 'جبران باید دقیقاً قرینه‌ی ردیفِ اصلی باشد');
      assert.equal(rev.reason, 'cashback', 'ردیفِ جبرانی باید در همان سطلِ حسابداری بنشیند');
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 0,
        'مجموعِ اسکوپ باید صفر شود — وگرنه ارزشی که وعده‌اش اتفاق نیفتاد نزدِ مشتری می‌ماند');

      // ⚠️ یافته‌ی ثبت‌شده (پیش از این تغییر و مستقل از آن): نویسنده‌ی کش‌بک
      // در `reservations.ts` مستقیم در دفتر می‌نویسد و **هرگز**
      // `club_members.points` را به‌روز نمی‌کند — یعنی کش از روزِ اول کش‌بک
      // را نمی‌دیده. پس این عدد قبل و بعد از بازگردانی صفر است. اگر روزی آن
      // نویسنده هم کش را بنویسد، این assertion همان‌جا قرمز می‌شود و کسی
      // مجبور می‌شود آگاهانه تصمیم بگیرد — که همان چیزی است که می‌خواهیم.
      const member = await db.clubMember.findUnique({
        where: { restaurantId_userId: { restaurantId, userId: uid } }, select: { points: true },
      });
      assert.equal(member?.points, 0, 'کشِ club_members کش‌بک را از ابتدا نمی‌دیده — رجوع کن به توضیحِ بالا');
    });

    test('عدمِ حضور (no_show) هم همان‌طور برمی‌گرداند', async () => {
      const uid = await makeUser('noshow');
      const { id, status } = await bookWithPreorder(uid);
      assert.equal(status, 'confirmed', 'پیش‌شرط: رزروِ بدونِ تأییدِ دستی باید confirmed باشد');
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 25);

      await transitionReservation({ reservationId: id, to: 'no_show', actor: 'system', notify: false });

      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 0);
      assert.equal(
        await db.pointsLedger.count({ where: { idempotencyKey: `cashback-reversal:${id}` } }), 1,
      );
    });

    test('بازگردانیِ دوباره دوبار کسر نمی‌کند (کلیدِ جداگانه‌ی idempotency)', async () => {
      const uid = await makeUser('dblcancel');
      const { id } = await bookWithPreorder(uid);
      await transitionReservation({ reservationId: id, to: 'cancelled', actor: 'system', notify: false });

      const again = await reverseReservationCashback(id);
      assert.equal(again.reversed, false);
      assert.equal(again.reason, 'already_reversed');
      assert.equal(await db.pointsLedger.count({ where: { userId: uid, reason: 'cashback' } }), 2,
        'دقیقاً دو ردیف: اصلی و یک جبران — نه سه');
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 0);
    });

    test('رزروِ بدونِ کش‌بک: لغو هیچ ردیفی نمی‌سازد (نه خطا، نه ردیفِ صفر)', async () => {
      const uid = await makeUser('nocb');
      const date = dateKeyInTz(new Date(Date.now() + (SLOT_DATE_OFFSET_DAYS + 1) * 86_400_000), 'Asia/Tehran');
      const resv = await createReservation({
        restaurantId, date, time: SLOT_TIME, partySize: 2,
        userId: uid, source: 'app', notifySms: false,
      });
      const row = await db.reservation.findUnique({ where: { code: resv.code }, select: { id: true } });
      assert.equal(resv.checkout, null, 'پیش‌شرط: رزروِ بدونِ پیش‌سفارش اصلاً checkout ندارد');

      const out = await reverseReservationCashback(row!.id);
      assert.equal(out.reason, 'no_cashback');
      assert.equal(await db.pointsLedger.count({ where: { userId: uid } }), 0);
    });

    test('حمله‌ی «بزن، بگیر، خرج کن، لغو کن»: بعد از لغو، اسکوپ بدهکار می‌ماند نه سودده', async () => {
      const uid = await makeUser('attack');
      const { id } = await bookWithPreorder(uid);
      await enableRedemption();

      const spent = await redeemPoints({
        userId: uid, restaurantId, points: 25, idempotencyKey: `atk:${randomUUID()}`,
      });
      assert.equal(spent.tomanValue, 50, 'مهاجم ۵۰ تومان ارزش برداشت');
      assert.equal(await getPointsBalanceInScope(uid, restaurantId), 0);

      await transitionReservation({ reservationId: id, to: 'cancelled', actor: 'system', notify: false });

      const bal = await getPointsBalanceInScope(uid, restaurantId);
      assert.equal(bal, -25,
        'موجودی باید بدهکار شود — این حسابداریِ درست است، نه نشتِ ارزش. بدونِ بازگردانی این عدد صفر می‌ماند و ۵۰ تومان مجانی بود');
      await assert.rejects(
        () => redeemPoints({ userId: uid, restaurantId, points: 1, idempotencyKey: `atk2:${randomUUID()}` }),
        /کافی نیست/,
        'با موجودیِ منفی هیچ خرجِ بعدی ممکن نیست',
      );
    });
  });
});
