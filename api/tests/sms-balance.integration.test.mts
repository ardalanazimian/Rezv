import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { topupSms, consumeSms, getSmsBalance, STARTER_SMS_BALANCE } from '../src/lib/sms-balance.ts';

// ═══════════════════════════════════════════════════════════════════════
//  موجودیِ پیامک — تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ چرا این فایل نوشته شد: `lib/sms-balance.ts` هیچ تستی نداشت، در حالی که
//  سرآیندِ خودش — دقیقاً مثلِ coupons.ts — ادعا می‌کند اتمیک بودنش «تأییدشده
//  روی PostgreSQL واقعی» است. باز هم یک ادعای عملکردی بدونِ قفل.
//
//  این یک مسیرِ پولِ واقعی است: هر پیامک از موجودیِ خریداری‌شده‌ی رستوران کم
//  می‌شود. یک نشتیِ همزمانی اینجا یعنی رستوران بیش از آنچه خریده پیامک بفرستد
//  (ضرر برای پلتفرم) یا اعتبارش بی‌دلیل بسوزد (ضرر برای رستوران).
// ═══════════════════════════════════════════════════════════════════════

const TAG = `sb-${randomUUID().slice(0, 8)}`;
let tenantId: string;
let restSeq = 0;

async function makeRestaurant(balance: number): Promise<string> {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${++restSeq}`, name: `[DEMO] رستورانِ تستِ پیامک ${restSeq}`,
      clubPrefix: 'SB', timezone: 'Asia/Tehran', smsBalance: balance,
    },
    select: { id: true },
  });
  return r.id;
}

const rawBalance = async (id: string) =>
  (await db.restaurant.findUniqueOrThrow({
    where: { id }, select: { smsBalance: true, smsTotalSent: true },
  }));

const txCount = (id: string) => db.smsTransaction.count({ where: { restaurantId: id } });

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] تنانتِ پیامک ${TAG}` }, select: { id: true } });
  tenantId = t.id;
});

after(async () => {
  const rs = await db.restaurant.findMany({ where: { tenantId }, select: { id: true } });
  await db.smsTransaction.deleteMany({ where: { restaurantId: { in: rs.map(r => r.id) } } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
});

describe('موجودیِ پیامک — مصرف', () => {
  test('مصرفِ موفق موجودی را کم و تراکنش ثبت می‌کند', async () => {
    const id = await makeRestaurant(10);
    assert.equal(await consumeSms(id, 1, 'reservation_notify'), true);

    const b = await rawBalance(id);
    assert.equal(b.smsBalance, 9, 'موجودی باید یکی کم شود');
    assert.equal(b.smsTotalSent, 1, 'شمارنده‌ی کلِ ارسال باید یکی زیاد شود');

    const tx = await db.smsTransaction.findFirstOrThrow({ where: { restaurantId: id } });
    assert.equal(tx.delta, -1);
    assert.equal(tx.balanceAfter, 9, 'balanceAfter باید موجودیِ *پس از* کسر باشد');
  });

  test('موجودیِ ناکافی: false برمی‌گرداند و هیچ‌چیز را تغییر نمی‌دهد', async () => {
    // ⚠️ ادعای «هیچ‌چیز» مهم است: اگر تراکنشِ حسابرسی حتی در مسیرِ شکست ثبت
    // شود، تاریخچه‌ی مالیِ رستوران دروغ می‌گوید.
    const id = await makeRestaurant(0);
    assert.equal(await consumeSms(id, 1), false);

    const b = await rawBalance(id);
    assert.equal(b.smsBalance, 0, 'موجودی نباید منفی شود');
    assert.equal(b.smsTotalSent, 0, 'ارسالِ نافرجام نباید در شمارنده بیاید');
    assert.equal(await txCount(id), 0, 'تلاشِ ناموفق نباید تراکنشِ حسابرسی بسازد');
  });

  test('مصرفِ دقیقاً برابرِ موجودی مجاز است، یکی بیشتر نه', async () => {
    const id = await makeRestaurant(3);
    assert.equal(await consumeSms(id, 3), true, 'مصرفِ کلِ موجودی باید مجاز باشد');
    assert.equal((await rawBalance(id)).smsBalance, 0);
    assert.equal(await consumeSms(id, 1), false, 'بعدش دیگر چیزی نمانده');
  });

  test('⚠️ countِ نامعتبر رد می‌شود — دفاعِ در عمقِ مسیرِ پول', async () => {
    // ⚠️ این گارد در ۲۰۲۶-۰۸-۲۰ اضافه شد و رفعِ یک باگِ زنده **نیست**:
    // تنها صداکننده (worker.ts) عددِ ثابتِ ۱ می‌فرستد.
    //
    // ولی عدمِ تقارن واقعی بود: `topupSms` ورودی‌اش را چک می‌کرد و این نه.
    // با countِ منفی، `sms_balance - (-5)` موجودی را *افزایش* می‌داد و شرطِ
    // `sms_balance >= -5` هم همیشه درست بود — یعنی هم گارد بی‌اثر می‌شد هم
    // اعتبارِ رایگان ساخته می‌شد. برای صداکننده‌ی بعدی بسته شد.
    const id = await makeRestaurant(5);
    for (const bad of [-5, 0, 1.5, NaN]) {
      await assert.rejects(() => consumeSms(id, bad), `count = ${bad} باید رد شود`);
    }
    assert.equal((await rawBalance(id)).smsBalance, 5, 'هیچ‌کدام نباید موجودی را دست بزند');
    assert.equal(await txCount(id), 0);
  });
});

describe('موجودیِ پیامک — همزمانی (قفلِ ادعایِ اتمیک بودن)', () => {
  test('۲۰ مصرفِ موازی روی موجودیِ ۵ → دقیقاً ۵ موفق', async () => {
    // ⚠️ عمداً بدونِ تعیینِ ایزولاسیون (پیش‌فرضِ ReadCommitted): این گارد باید
    // **خودش** محافظت کند، چون `UPDATE … WHERE sms_balance >= n` اتمیک است —
    // نه با تکیه به ایزولاسیونِ صداکننده. (تفاوتش با گاردِ per-userِ کوپن که
    // self-protecting نیست — رجوع کن به tests/coupons.integration.test.mts.)
    const BALANCE = 5, PARALLEL = 20;
    const id = await makeRestaurant(BALANCE);

    const results = await Promise.all(Array.from({ length: PARALLEL }, () => consumeSms(id, 1)));
    const ok = results.filter(Boolean).length;

    assert.equal(ok, BALANCE, `دقیقاً ${BALANCE} تا باید موفق شود، نه ${ok}`);
    const b = await rawBalance(id);
    assert.equal(b.smsBalance, 0, 'موجودی هرگز نباید منفی شود');
    assert.equal(b.smsTotalSent, BALANCE, 'شمارنده‌ی ارسال باید با تعدادِ موفق یکی باشد');
    assert.equal(await txCount(id), BALANCE, 'به‌ازای هر مصرفِ موفق دقیقاً یک تراکنش');
  });

  test('شارژهای موازی گم نمی‌شوند (lost update)', async () => {
    // ۱۰ شارژِ همزمانِ ۵تایی → موجودی باید دقیقاً ۵۰ بیشتر شود. اگر الگوی
    // «بخوان، جمع کن، بنویس» بود، بعضی شارژها روی هم می‌نوشتند و پولِ ادمین
    // بی‌سروصدا گم می‌شد.
    const id = await makeRestaurant(0);
    const admin = randomUUID();
    await Promise.all(Array.from({ length: 10 }, () => topupSms(id, 5, admin, '[DEMO] شارژِ موازی')));

    assert.equal((await rawBalance(id)).smsBalance, 50, 'هیچ شارژی نباید گم شود');
    assert.equal(await txCount(id), 10, 'هر شارژ باید تراکنشِ خودش را داشته باشد');

    // ⚠️ balanceAfterها باید *مجموعه‌ی* ۵..۵۰ باشند — اگر همه یک عدد بودند،
    // یعنی تراکنش‌ها موجودیِ کهنه‌ی یکسانی دیده‌اند (نشانه‌ی lost update).
    const afters = (await db.smsTransaction.findMany({
      where: { restaurantId: id }, select: { balanceAfter: true },
    })).map(t => t.balanceAfter).sort((a, b) => a - b);
    assert.deepEqual(afters, [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
      'هر تراکنش باید موجودیِ یکتای پس از خودش را ثبت کند');
  });
});

describe('موجودیِ پیامک — شارژ و گزارش', () => {
  test('شارژ موجودی را زیاد و تراکنشِ حسابرسی ثبت می‌کند', async () => {
    const id = await makeRestaurant(2);
    const admin = randomUUID();
    const res = await topupSms(id, 20, admin, '[DEMO] یادداشتِ تست');

    assert.equal(res.balance, 22);
    const tx = await db.smsTransaction.findFirstOrThrow({ where: { restaurantId: id } });
    assert.equal(tx.delta, 20);
    assert.equal(tx.balanceAfter, 22);
    assert.equal(tx.reason, 'admin_topup');
    assert.equal(tx.actorId, admin, 'ردِ حسابرسی باید بگوید کدام ادمین شارژ کرده');
  });

  test('شارژِ نامعتبر رد می‌شود و موجودی را دست نمی‌زند', async () => {
    const id = await makeRestaurant(7);
    for (const bad of [0, -3, 2.5, NaN]) {
      await assert.rejects(() => topupSms(id, bad, randomUUID()), `amount = ${bad} باید رد شود`);
    }
    assert.equal((await rawBalance(id)).smsBalance, 7);
    assert.equal(await txCount(id), 0);
  });

  test('گزارشِ موجودی، تاریخچه را جدیدترین-اول می‌دهد', async () => {
    const id = await makeRestaurant(0);
    await topupSms(id, 10, randomUUID(), '[DEMO] اول');
    await consumeSms(id, 2, 'campaign');

    const r = await getSmsBalance(id);
    assert.equal(r.balance, 8);
    assert.equal(r.total_sent, 2);
    assert.equal(r.recent_transactions.length, 2);
    assert.equal(r.recent_transactions[0].delta, -2, 'جدیدترین تراکنش باید اول باشد');
    assert.equal(r.recent_transactions[1].delta, 10);
  });

  test('گزارشِ رستورانِ ناموجود خطا می‌دهد، نه موجودیِ صفرِ ساختگی', async () => {
    // ⚠️ صفر برگرداندن برای رستورانی که وجود ندارد یعنی «موجودی ندارد» —
    // ادعایی که نداریم. باید صریح خطا بدهد.
    await assert.rejects(() => getSmsBalance(randomUUID()));
  });

  test('موجودیِ اولیه‌ی رستورانِ تازه ثابتِ مستند است', async () => {
    // اگر این عدد جابه‌جا شود، رستورانِ تازه یا هیچ پیامکی نمی‌تواند بفرستد
    // (jobها به DLQ می‌روند) یا بیش از سیاستِ پلتفرم اعتبار می‌گیرد.
    assert.equal(STARTER_SMS_BALANCE, 50);
    const r = await db.restaurant.create({
      data: {
        tenantId, slug: `${TAG}-starter`, name: '[DEMO] رستورانِ تازه',
        clubPrefix: 'SB', timezone: 'Asia/Tehran',
      },
      select: { smsBalance: true },
    });
    assert.equal(r.smsBalance, STARTER_SMS_BALANCE,
      'پیش‌فرضِ دیتابیس باید با ثابتِ کد یکی باشد');
  });
});
