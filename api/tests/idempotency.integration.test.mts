import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { withIdempotency, cleanupIdempotencyKeys } from '../src/lib/idempotency.ts';

// ═══════════════════════════════════════════════════════════════════════
//  Idempotency — تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ باگی که این فایل از آن زاده شد (ممیزیِ ۲۰۲۶-۰۸-۲۰، با اجرای زنده اثبات
//  شد نه از رویِ کد):
//
//  `scope` گرفته و *ذخیره* می‌شد ولی هرگز در تضاد یا جست‌وجو استفاده نمی‌شد
//  (`ON CONFLICT (key)` و `findUnique({ where: { key } })`)، و هویتِ
//  درخواست‌کننده هم اصلاً دخیل نبود. یعنی کلِ کشِ پاسخ فقط به یک رشته‌ی
//  **کاملاً کلاینت‌کنترل** بسته بود.
//
//  بازتولیدِ واقعی پیش از رفع: کاربرِ A روی scope='reservation' پاسخی ذخیره
//  کرد، همان کلید روی scope='walkin' فرستاده شد → عیناً پاسخِ A برگشت،
//  شاملِ کدِ رزرو (که خودش شناسه‌ی دسترسیِ مهمان است).
//
//  ماژول تا امروز هیچ تستی نداشت.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `idem-${randomUUID().slice(0, 8)}`;
const usedKeys: string[] = [];

/** کلیدِ کلاینتِ یکتا برای هر سناریو. */
function clientKey(label: string): string {
  const k = `${TAG}-${label}`;
  usedKeys.push(k);
  return k;
}

after(async () => {
  // کلیدها هش می‌شوند، پس با مقدارِ خام قابلِ حذف نیستند — همه‌ی ردیف‌های
  // scopeهای تستی پاک می‌شوند.
  await db.idempotencyKey.deleteMany({ where: { scope: { startsWith: `${TAG}:` } } });
});

describe('Idempotency — تفکیکِ scope و هویت (قفلِ باگِ بازپخشِ پاسخ)', () => {
  test('همان کلید در دو scope دو ورودیِ جدا است', async () => {
    // ⚠️ خودِ باگ: پیش از رفع، این تست پاسخِ scopeِ اول را در scopeِ دوم
    // برمی‌گرداند. ستونِ scope وجود داشت و فقط نادیده گرفته می‌شد.
    const key = clientKey('cross-scope');
    const actor = 'customer:alice';

    const a = await withIdempotency<{ secret: string }>(key, `${TAG}:reservation`, actor);
    assert.equal(a.replayed, false, 'اولین بار باید تازه باشد');
    if (a.replayed) return;
    await a.commit({ secret: 'RZ-SECRET-A' });

    const b = await withIdempotency<{ secret: string }>(key, `${TAG}:walkin`, actor);
    assert.equal(b.replayed, false,
      'scopeِ متفاوت نباید پاسخِ scopeِ دیگر را replay کند');

    // کنترلِ مثبت: همان کلید در همان scope *باید* replay شود، وگرنه این تست
    // می‌توانست به‌دلیلِ خرابیِ کلیِ replay هم سبز شود.
    if (!b.replayed) await b.commit({ secret: 'RZ-SECRET-B' });
    const again = await withIdempotency<{ secret: string }>(key, `${TAG}:reservation`, actor);
    assert.equal(again.replayed, true, 'کنترلِ مثبت: همان scope باید replay کند');
    if (again.replayed) assert.equal(again.response.secret, 'RZ-SECRET-A');
  });

  test('همان کلید و همان scope ولی کاربرِ متفاوت → بدونِ نشت', async () => {
    // ⚠️ نیمه‌ی امنیتیِ باگ: هر کسی که همان Idempotency-Key را می‌فرستاد،
    // پاسخِ نفرِ قبلی را می‌گرفت. بهره‌برداریش به آنتروپیِ کلیدِ کلاینت وابسته
    // بود — چیزی که سرور هیچ الزامی برایش نمی‌گذارد.
    const key = clientKey('cross-user');
    const scope = `${TAG}:reservation`;

    const alice = await withIdempotency<{ owner: string }>(key, scope, 'customer:alice');
    assert.equal(alice.replayed, false);
    if (alice.replayed) return;
    await alice.commit({ owner: 'alice' });

    const bob = await withIdempotency<{ owner: string }>(key, scope, 'customer:bob');
    assert.equal(bob.replayed, false,
      'کاربرِ B نباید پاسخِ کاربرِ A را ببیند — همان کلید، همان scope، هویتِ متفاوت');

    // کنترلِ مثبت: خودِ alice با همان کلید باید replay بگیرد.
    const aliceAgain = await withIdempotency<{ owner: string }>(key, scope, 'customer:alice');
    assert.equal(aliceAgain.replayed, true);
    if (aliceAgain.replayed) assert.equal(aliceAgain.response.owner, 'alice');
  });
});

describe('Idempotency — رفتارِ پایه', () => {
  test('بدونِ کلید هیچ محافظتی نیست و چیزی ذخیره نمی‌شود', async () => {
    const before = await db.idempotencyKey.count();
    const r = await withIdempotency<unknown>(undefined, `${TAG}:noop`, 'customer:x');
    assert.equal(r.replayed, false);
    if (!r.replayed) await r.commit({ any: 'thing' });
    assert.equal(await db.idempotencyKey.count(), before,
      'درخواستِ بدونِ Idempotency-Key نباید ردیفی بسازد');
  });

  test('replay دقیقاً همان پاسخ را برمی‌گرداند', async () => {
    const key = clientKey('replay');
    const scope = `${TAG}:reservation`;
    const payload = { code: 'RZ12345', party: 4, nested: { ok: true } };

    const first = await withIdempotency<typeof payload>(key, scope, 'customer:c1');
    if (first.replayed) throw new Error('پیش‌شرط شکست');
    await first.commit(payload);

    const second = await withIdempotency<typeof payload>(key, scope, 'customer:c1');
    assert.equal(second.replayed, true);
    if (second.replayed) assert.deepEqual(second.response, payload);
  });

  test('درخواستِ همزمانِ واقعی با همان کلید → ۴۰۹، نه ۵۰۰', async () => {
    // ⚠️ قفلِ یک باگِ تاریخیِ رفع‌شده (شرحش در خودِ idempotency.ts): قبلاً
    // Errorِ خام پرتاب می‌شد و errorResponse آن را به ۵۰۰ تبدیل می‌کرد، پس
    // کلاینت هرگز ۴۰۹ِ واقعی نمی‌دید.
    const key = clientKey('conflict');
    const scope = `${TAG}:reservation`;

    const first = await withIdempotency<unknown>(key, scope, 'customer:c2');
    assert.equal(first.replayed, false, 'اولی باید claim کند');

    await assert.rejects(
      () => withIdempotency<unknown>(key, scope, 'customer:c2'),
      (e: unknown) => {
        // ⚠️ فیلد `status` است نه `statusCode` — نسخه‌ی اولِ این تست اشتباه
        // فرض کرد و قرمز شد. اشتباه در تست بود، نه در کد؛ با خواندنِ
        // `class ApiError` در lib/errors.ts اصلاح شد، نه با حدس.
        const err = e as { status?: number; code?: string };
        assert.equal(err.status, 409, 'باید ۴۰۹ باشد نه ۵۰۰');
        assert.equal(err.code, 'IDEMPOTENCY_CONFLICT');
        return true;
      },
      'کلیدِ in_progressِ تازه باید ۴۰۹ بدهد',
    );
  });

  test('پاک‌سازی فقط ردیف‌های منقضی را حذف می‌کند', async () => {
    const live = clientKey('cleanup-live');
    const scope = `${TAG}:cleanup`;
    const r = await withIdempotency<unknown>(live, scope, 'customer:c3');
    if (!r.replayed) await r.commit({ ok: true });

    // یک ردیفِ منقضی مستقیم درج می‌کنیم (زمانِ انقضا در گذشته).
    const staleKey = `${TAG}-stale-${randomUUID()}`;
    await db.idempotencyKey.create({
      data: {
        key: staleKey, scope, status: 'done', response: { old: true },
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    await cleanupIdempotencyKeys();

    assert.equal(await db.idempotencyKey.count({ where: { key: staleKey } }), 0,
      'ردیفِ منقضی باید حذف شود');
    assert.equal(await db.idempotencyKey.count({ where: { scope } }), 1,
      'ردیفِ زنده باید بماند');
  });
});

describe('Idempotency — مالکیتِ claim (قفلِ باگِ «پاک‌کردنِ claimِ دیگری»)', () => {
  // ⚠️ باگی که بازبینیِ ۲۰۲۶-۰۸-۲۷ گرفت: `release()`/`commit()` فقط با `key`
  // کار می‌کردند، پس درخواستِ کهنه‌ای که claimش بازپس‌گرفته شده بود می‌توانست
  // ردیفِ **بازپس‌گیرنده** را پاک یا بازنویسی کند.
  //
  // «گذرِ زمان» با عقب‌بردنِ `created_at` شبیه‌سازی می‌شود؛ راهِ دیگری نیست چون
  // آستانه (۶۰ ثانیه) ثابتِ ماژول است و انتظارِ واقعی تست را ۶۰ ثانیه‌ای می‌کند.
  // چیزی که سنجیده می‌شود همان ثابتِ واقعی است: «نوشتنِ یک claimِ منسوخ نباید
  // به claimِ فعلی برسد».

  /** ردیف را آن‌قدر عقب می‌برد که «کهنه» شمرده شود. */
  async function ageOut(scope: string) {
    await db.$executeRaw`
      UPDATE idempotency_keys SET created_at = now() - interval '61 seconds' WHERE scope = ${scope}
    `;
  }

  test('releaseِ درخواستِ کهنه، claimِ بازپس‌گیرنده را حذف نمی‌کند', async () => {
    const key = clientKey('own-release');
    const scope = `${TAG}:own-release`;
    const actor = 'customer:own1';

    const a = await withIdempotency<{ who: string }>(key, scope, actor);
    assert.equal(a.replayed, false, 'پیش‌شرط: A باید claim کند');
    if (a.replayed) return;

    await ageOut(scope);

    const b = await withIdempotency<{ who: string }>(key, scope, actor);
    assert.equal(b.replayed, false, 'پیش‌شرط: کلیدِ کهنه باید بازپس‌گرفته شود');
    if (b.replayed) return;

    // A حالا شکست می‌خورد و claimِ (منسوخ‌شده‌یِ) خودش را آزاد می‌کند.
    await a.release();

    const rows = await db.idempotencyKey.findMany({ where: { scope } });
    assert.equal(rows.length, 1,
      'releaseِ A نباید ردیفِ B را پاک کند — وگرنه یک درخواستِ سومِ همزمان ' +
      'به‌جای ۴۰۹ اجازه‌ی اجرا می‌گیرد');
    assert.equal(rows[0].status, 'in_progress');

    // کنترلِ مثبت: claimِ B هنوز سالم است و مسیرِ عادی کار می‌کند.
    await b.commit({ who: 'B' });
    const third = await withIdempotency<{ who: string }>(key, scope, actor);
    assert.equal(third.replayed, true, 'کنترلِ مثبت: پاسخِ B باید replay شود');
    if (third.replayed) assert.equal(third.response.who, 'B');
  });

  test('commitِ درخواستِ کهنه، پاسخِ بازپس‌گیرنده را بازنویسی نمی‌کند', async () => {
    const key = clientKey('own-commit');
    const scope = `${TAG}:own-commit`;
    const actor = 'customer:own2';

    const a = await withIdempotency<{ who: string }>(key, scope, actor);
    assert.equal(a.replayed, false, 'پیش‌شرط: A باید claim کند');
    if (a.replayed) return;

    await ageOut(scope);

    const b = await withIdempotency<{ who: string }>(key, scope, actor);
    assert.equal(b.replayed, false, 'پیش‌شرط: کلیدِ کهنه باید بازپس‌گرفته شود');
    if (b.replayed) return;

    // A دیر جواب گرفت و حالا commit می‌زند، **در حالی که B هنوز in_progress
    // است**. این ترتیب عمدی است: اگر اول B را commit کنیم، شرطِ قدیمیِ
    // `status='in_progress'` به‌تنهایی جلوی A را می‌گیرد و تست دیگر چیزی
    // درباره‌ی مالکیت اثبات نمی‌کند (نسخه‌ی اولِ همین تست دقیقاً همین اشکال را
    // داشت و زیرِ mutation سبز ماند).
    await a.commit({ who: 'A' });

    const mid = await db.idempotencyKey.findMany({ where: { scope } });
    assert.equal(mid.length, 1);
    assert.equal(mid[0].status, 'in_progress',
      'commitِ A نباید claimِ B را done کند — وگرنه پاسخِ عملیاتِ A به‌عنوانِ ' +
      'پاسخِ عملیاتِ B کش می‌شود و replayِ بعدی نتیجه‌ی اشتباه می‌دهد');

    // کنترلِ مثبت: B هنوز می‌تواند پاسخِ خودش را ثبت کند.
    await b.commit({ who: 'B' });
    const replay = await withIdempotency<{ who: string }>(key, scope, actor);
    assert.equal(replay.replayed, true);
    if (replay.replayed) assert.equal(replay.response.who, 'B',
      'پاسخِ ذخیره‌شده باید مالِ B باشد، نه A');
  });

  test('releaseِ صاحبِ واقعیِ claim کار می‌کند (تا گارد به no-opِ بی‌صدا تبدیل نشود)', async () => {
    // بدونِ این کنترلِ مثبت، یک شرطِ مالکیتِ همیشه-غلط هم سبز می‌شد و
    // release عملاً می‌مرد — همان باگِ H11 که از اول برایش ساخته شده بود.
    const key = clientKey('own-happy');
    const scope = `${TAG}:own-happy`;
    const actor = 'customer:own3';

    const a = await withIdempotency<unknown>(key, scope, actor);
    assert.equal(a.replayed, false);
    if (a.replayed) return;
    await a.release();

    assert.equal(await db.idempotencyKey.count({ where: { scope } }), 0,
      'صاحبِ claim باید بتواند آن را آزاد کند');

    const retry = await withIdempotency<unknown>(key, scope, actor);
    assert.equal(retry.replayed, false,
      'بعد از release، تلاشِ دوباره باید دوباره claim کند نه ۴۰۹ بگیرد');
  });
});
