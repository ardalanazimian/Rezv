import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  مدیریتِ میز — تستِ integration زنده رویِ Postgresِ واقعی
//
//  `src/lib/tables.ts` و روت‌هایِ میز تا امروز **صفر تست** داشتند، با اینکه
//  رویِ مسیرِ بحرانیِ رزرو نشسته‌اند. این فایل از دلِ یک ممیزیِ همان ماژول
//  زاده شد و دو باگِ واقعی را قفل می‌کند:
//
//  ⚠️ باگِ ۱ — گاردِ حذفِ میز لیستِ وضعیت‌ها را هاردکد کرده بود:
//     ['pending','confirmed','auto_confirmed','checked_in','seated','dining']
//     ولی منبعِ یگانه (`ACTIVE_RESERVATION_STATUSES`) نُه وضعیت دارد.
//     سه‌تا جا افتاده بود: **preparing، running_late، arrived**.
//     چون FKِ `reservations.table_id` روی `ON DELETE SET NULL` است، حذف
//     خطا نمی‌داد — رزروِ زنده **بی‌صدا یتیم** می‌شد. یعنی مهمانی که همین
//     حالا دمِ در ایستاده (`arrived`) یا غذایش در حالِ آماده‌سازی است
//     (`preparing`) میزش را از دست می‌داد و هیچ‌کس خبردار نمی‌شد.
//     ضمناً EXCLUDE constraintِ ضدِ double-booking رویِ `table_id` است، پس
//     رزروِ یتیم‌شده از حفاظتِ تداخل هم بیرون می‌افتاد.
//
//     نکته‌ی تلخ: خودِ `reservation-status.ts` در توضیحش «گاردِ حذفِ میز» را
//     صریحاً یکی از جاهایی می‌نامد که لیستِ تکراری داشت — یعنی رفع اعلام
//     شده بود ولی همین یک مصرف‌کننده هرگز وصل نشد.
//
//  ⚠️ باگِ ۲ — `qrCheckIn` ماشینِ وضعیتِ میزِ همین ماژول را دور می‌زد:
//     مستقیم `state: 'occupied'` می‌نوشت. `ALLOWED_TRANSITIONS` انتقالِ
//     maintenance→occupied را ممنوع کرده و کامنتش دقیقاً همین مثال را
//     می‌زند. نتیجه: میزِ خراب/خارج‌از‌سرویس با یک اسکنِ QR بی‌صدا
//     «اشغال» می‌شد و نشانه‌ی maintenance بدونِ ردِ حسابرسی پاک می‌شد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { redis } = await import('../src/lib/redis');
const { signAccess } = await import('../src/lib/jwt');
const { ACTIVE_RESERVATION_STATUSES } = await import('../src/lib/reservation-status');
const { setTableState, qrCheckIn } = await import('../src/lib/tables');
const tableIdRoute = await import('../src/app/api/v1/restaurant/tables/[id]/route');

const TAG = 'tbl';
let A: Ctx, B: Ctx;
let codeSeq = 0;
let tableSeq = 100;

type Ctx = { tenantId: string; restaurantId: string; token: string };

/** دومین آرگومانِ روت در این نسخه‌ی Next.js `{ params: Promise<...> }` است. */
const routeArg = (id: string) => ({ params: Promise.resolve({ id }) });

const req = (token: string, method = 'DELETE') =>
  new Request('http://x/api', { method, headers: { authorization: `Bearer ${token}` } });

async function makeTenant(label: string): Promise<Ctx> {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `zz-${label}`, name: `[DEMO] ${label}`, clubPrefix: 'TBL' },
    select: { id: true },
  });
  const staff = await db.staff.create({
    data: {
      tenantId: t.id, role: 'owner', isActive: true,
      phone: `+9891${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13),
    },
    select: { id: true },
  });
  return {
    tenantId: t.id,
    restaurantId: r.id,
    token: signAccess({ sub: staff.id, kind: 'staff', tenantId: t.id, role: 'owner' }),
  };
}

async function makeTable(ctx: Ctx, state = 'free') {
  return db.table.create({
    data: { restaurantId: ctx.restaurantId, number: ++tableSeq, capacity: 4, state: state as never },
    select: { id: true, number: true, state: true },
  });
}

async function makeReservation(ctx: Ctx, tableId: string, status: string) {
  const start = new Date(Date.now() + 60 * 60_000);
  return db.reservation.create({
    data: {
      code: `TBLT${++codeSeq}${Date.now().toString(36).slice(-4)}`.toUpperCase(),
      restaurantId: ctx.restaurantId, tableId, partySize: 2,
      slotStart: start, slotEnd: new Date(+start + 90 * 60_000),
      status: status as never, blockBufferMinutes: 15,
    },
    select: { id: true },
  });
}

/** میزِ دارایِ QR که رزروِ همین‌الانش فعال است — برایِ مسیرِ qrCheckIn. */
async function makeQrTableWithLiveReservation(state: string, prefix: string) {
  const tbl = await db.table.create({
    data: {
      restaurantId: A.restaurantId, number: ++tableSeq, capacity: 4, state: state as never,
      qrCode: `T-${prefix}${Date.now().toString(36).toUpperCase().slice(-6)}${++codeSeq}`,
    },
    select: { id: true, qrCode: true },
  });
  const now = new Date();
  await db.reservation.create({
    data: {
      code: `TBLQ${++codeSeq}${Date.now().toString(36).slice(-4)}`.toUpperCase(),
      restaurantId: A.restaurantId, tableId: tbl.id, partySize: 2,
      slotStart: new Date(+now - 10 * 60_000), slotEnd: new Date(+now + 80 * 60_000),
      status: 'confirmed' as never, blockBufferMinutes: 15,
    },
  });
  return tbl;
}

/** میز را حذف کن و بگو روت چه گفت + میز واقعاً رفت یا نه. */
async function tryDelete(ctx: Ctx, tableId: string) {
  const res = await tableIdRoute.DELETE(req(ctx.token), routeArg(tableId));
  const stillThere = await db.table.findUnique({ where: { id: tableId }, select: { id: true } });
  return { status: res.status, deleted: stillThere === null };
}

before(async () => {
  // شمارنده‌ی rate-limit بینِ اجراها انباشته می‌شود و از اجرایِ دوم ۴۲۹ می‌گیریم.
  // سقفِ خودِ روت عمداً دست‌نخورده است — فقط نشتیِ بینِ اجراها صفر می‌شود.
  const stale = await redis.keys('*auth*');
  if (stale.length) await redis.del(...stale);

  const s = Date.now().toString(36);
  A = await makeTenant(`${TAG}-a-${s}`);
  B = await makeTenant(`${TAG}-b-${s}`);
});

after(async () => {
  const rests = [A.restaurantId, B.restaurantId];
  await db.reservation.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.table.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.restaurant.deleteMany({ where: { id: { in: rests } } });
  await db.staff.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } });
  await db.tenant.deleteMany({ where: { id: { in: [A.tenantId, B.tenantId] } } });
});

// ─────────────────────────────────────────────────────────────────────
describe('گاردِ حذفِ میز — هیچ رزروِ زنده‌ای یتیم نمی‌شود', () => {
  // ⚠️ سه وضعیتی که از لیستِ هاردکدشده جا افتاده بودند. پیش از رفع، هر سه
  //    میز را حذف می‌کردند و رزرو بی‌صدا `table_id = NULL` می‌شد.
  for (const status of ['preparing', 'running_late', 'arrived'] as const) {
    test(`⚠️ میزِ دارای رزروِ «${status}» حذف نمی‌شود`, async () => {
      const tbl = await makeTable(A);
      const resv = await makeReservation(A, tbl.id, status);

      const { status: code, deleted } = await tryDelete(A, tbl.id);

      assert.equal(deleted, false, `میز نباید حذف می‌شد — رزروِ ${status} زنده است`);
      assert.equal(code, 422, 'باید خطای اعتبارسنجیِ تمیز بدهد، نه موفقیت');

      // قفلِ اصلی: رزرو هنوز به میزش وصل است، نه یتیم.
      const after = await db.reservation.findUnique({
        where: { id: resv.id }, select: { tableId: true },
      });
      assert.equal(after?.tableId, tbl.id, 'رزرو نباید از میزش جدا شده باشد');
    });
  }

  test('میزِ دارای رزروِ confirmed حذف نمی‌شود (کنترلِ مثبتِ رفتارِ قبلی)', async () => {
    // این حالت از قبل هم کار می‌کرد؛ اینجاست تا رفع، رفتارِ درستِ موجود را نشکند.
    const tbl = await makeTable(A);
    await makeReservation(A, tbl.id, 'confirmed');
    const { deleted } = await tryDelete(A, tbl.id);
    assert.equal(deleted, false);
  });

  test('میزِ بدونِ رزرو واقعاً حذف می‌شود (کنترلِ مثبت)', async () => {
    // بدونِ این، گاردی که *همیشه* رد کند هم همه‌ی تست‌های بالا را پاس می‌کرد.
    const tbl = await makeTable(A);
    const { status, deleted } = await tryDelete(A, tbl.id);
    assert.equal(status, 200);
    assert.equal(deleted, true, 'گارد نباید حذفِ مشروع را هم ببندد');
  });

  test('رزروِ لغوشده جلوی حذف را نمی‌گیرد (وضعیتِ پایانی زنده نیست)', async () => {
    const tbl = await makeTable(A);
    await makeReservation(A, tbl.id, 'cancelled');
    const { deleted } = await tryDelete(A, tbl.id);
    assert.equal(deleted, true, 'رزروِ لغوشده میز را قفل نمی‌کند');
  });

  test('گارد دقیقاً همان منبعِ یگانه را می‌خواند (نه یک کپیِ جداشدنی)', async () => {
    // این تست کد را می‌خواند، نه رفتار را: ریشه‌ی باگ «کپیِ دستیِ لیست» بود،
    // پس اگر کسی دوباره لیست را داخلِ روت هاردکد کند همین‌جا می‌شکند.
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      new URL('../src/app/api/v1/restaurant/tables/[id]/route.ts', import.meta.url), 'utf8');
    assert.match(src, /activeStatusList\s*\(\s*\)/, 'باید از activeStatusList() استفاده کند');
    assert.doesNotMatch(src, /status:\s*\{\s*in:\s*\[/, 'نباید لیستِ وضعیت را دوباره هاردکد کند');
  });

  test('جداسازیِ تنانت: رستورانِ B نمی‌تواند میزِ A را حذف کند', async () => {
    const tbl = await makeTable(A);
    const res = await tableIdRoute.DELETE(req(B.token), routeArg(tbl.id));
    assert.equal(res.status, 404, 'باید «پیدا نشد» بدهد، نه حذف کند');
    const still = await db.table.findUnique({ where: { id: tbl.id }, select: { id: true } });
    assert.ok(still, 'میزِ رستورانِ A باید سرِ جایش باشد');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('ماشینِ وضعیتِ میز — هیچ مسیری دورش نمی‌زند', () => {
  test('⚠️ اسکنِ QR میزِ maintenance را occupied نمی‌کند', async () => {
    // ⚠️ قفلِ باگِ ۲. میزِ خارج‌از‌سرویس که رزروی از قبل رویش مانده: پیش از
    //    رفع، یک اسکن آن را به occupied می‌برد و نشانه‌ی خرابی گم می‌شد.
    const tbl = await makeQrTableWithLiveReservation('maintenance', 'MNT');

    await qrCheckIn(tbl.qrCode!);

    const after = await db.table.findUnique({ where: { id: tbl.id }, select: { state: true } });
    assert.equal(after?.state, 'maintenance', 'میزِ در تعمیر نباید بی‌صدا اشغال شود');
  });

  test('اسکنِ QR میزِ رزروشده را occupied می‌کند (کنترلِ مثبت)', async () => {
    // بدونِ این، رفعی که *هرگز* میز را occupied نکند هم تستِ بالا را پاس می‌کرد.
    const tbl = await makeQrTableWithLiveReservation('reserved', 'OK');

    const out = await qrCheckIn(tbl.qrCode!);

    assert.equal(out.status, 'seated');
    const after = await db.table.findUnique({ where: { id: tbl.id }, select: { state: true } });
    assert.equal(after?.state, 'occupied', 'مسیرِ مشروع باید همچنان کار کند');
  });

  test('setTableState انتقالِ نامعتبر را رد می‌کند', async () => {
    const tbl = await makeTable(A, 'maintenance');
    await assert.rejects(
      () => setTableState(tbl.id, A.restaurantId, 'occupied'),
      'maintenance→occupied باید رد شود',
    );
  });

  test('setTableState انتقالِ معتبر را انجام می‌دهد (کنترلِ مثبت)', async () => {
    const tbl = await makeTable(A, 'free');
    const out = await setTableState(tbl.id, A.restaurantId, 'reserved');
    assert.equal(out.state, 'reserved');
  });

  test('setTableState میزِ رستورانِ دیگر را دست نمی‌زند', async () => {
    const tbl = await makeTable(A, 'free');
    await assert.rejects(() => setTableState(tbl.id, B.restaurantId, 'occupied'));
    const after = await db.table.findUnique({ where: { id: tbl.id }, select: { state: true } });
    assert.equal(after?.state, 'free', 'وضعیتِ میزِ A نباید عوض شده باشد');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('منبعِ یگانه‌ی وضعیت‌های فعال', () => {
  test('هر نُه وضعیتِ فعال واقعاً جلوی حذفِ میز را می‌گیرد', async () => {
    // ⚠️ این تست هرگز لیست را کپی نمی‌کند — روی خودِ منبعِ یگانه حلقه می‌زند.
    //    اگر فردا وضعیتِ فعالِ دهمی اضافه شود، این تست خودبه‌خود پوششش می‌دهد.
    for (const status of ACTIVE_RESERVATION_STATUSES) {
      const tbl = await makeTable(A);
      await makeReservation(A, tbl.id, status);
      const { deleted } = await tryDelete(A, tbl.id);
      assert.equal(deleted, false, `وضعیتِ فعالِ «${status}» باید جلوی حذف را بگیرد`);
    }
  });
});
