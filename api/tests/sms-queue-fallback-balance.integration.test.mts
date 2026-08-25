import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ «سقفِ موجودیِ پیامک در مسیرِ اضطراری» (مسیرِ پول)
//
//  یافته (تأییدشده با اجرای واقعی، ۲۰۲۶-۰۸-۲۵):
//  `enqueueSms` وقتی `enqueue` استثنا می‌داد به `sendSmsNow(job).catch(()=>{})`
//  می‌افتاد. ولی تنها نقطه‌ی کسرِ اعتبار `worker.ts:27` است (`consumeSms`
//  پیش از `sendSmsNow`) و این مسیر هرگز از worker رد نمی‌شود. نتیجه:
//   • قطعیِ جدولِ `jobs` = ارسالِ **بی‌سقف و بی‌صورت‌حساب** (نه کسرِ موجودی،
//     نه ردیفی در `sms_transactions`)،
//   • و `.catch(() => {})` خطای ارسال را هم می‌بلعید (نه لاگ، نه متریک).
//
//  ⚠️ چگونه شکستِ صف را **واقعاً** شبیه‌سازی می‌کنیم (نه با mock):
//  یک بایتِ NUL داخلِ توکن‌ها می‌گذاریم. `jsonb` در PostgreSQL نویسه‌ی
//  U+0000 را نمی‌پذیرد، پس `db.job.create` یک خطای واقعیِ دیتابیس می‌دهد و
//  دقیقاً همان شاخه‌ی catch را می‌گیریم — بدونِ دست‌زدن به اسکیما یا هر
//  جدولِ مشترکِ دیگری (تستِ موازیِ دیگری خراب نمی‌شود).
//
//  رصد کاملاً از روی حالتِ واقعیِ سیستم است: ستونِ `sms_balance`، جدولِ
//  `sms_transactions` و رجیستریِ متریک — نه spyِ درون‌فرایندی.
// ═══════════════════════════════════════════════════════════════════════

import { fixturePhone } from './_phone.helper.mts';

// ⚠️ پیشوندِ ۰۹۲۴ مالِ همین فایل است — در فایلِ دیگری تکرارش نکن
// (دلیل: tests/_phone.helper.mts).
const PHONE_PREFIX = '0924';

const { db } = await import('../src/lib/db.ts');
const { enqueueSms } = await import('../src/lib/sms.ts');
const { renderMetrics } = await import('../src/lib/metrics.ts');

const SFX = Date.now().toString(36).slice(-6);
const NUL = String.fromCharCode(0);
const ORIG_KEY = process.env.KAVENEGAR_API_KEY;
const ORIG_FETCH = globalThis.fetch;

let tenantId = '';
let restaurantId = '';
const guestPhone = fixturePhone(PHONE_PREFIX);

/** مقدارِ فعلیِ یک سریِ `rezervno_sms_failed_total` با برچسبِ reason. */
function smsFailed(reason: string): number {
  let total = 0;
  for (const line of renderMetrics().split('\n')) {
    if (!line.startsWith('rezervno_sms_failed_total')) continue;
    const m = line.match(/^rezervno_sms_failed_total(?:\{([^}]*)\})?\s+(-?[\d.]+)$/);
    if (!m) continue;
    if (!(m[1] ?? '').includes(`reason="${reason}"`)) continue;
    total += Number(m[2]);
  }
  return total;
}

async function balanceOf(): Promise<number> {
  const r = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { smsBalance: true } });
  return r!.smsBalance;
}

async function setBalance(n: number) {
  await db.restaurant.update({ where: { id: restaurantId }, data: { smsBalance: n } });
}

/** پیامکی که صف **نمی‌تواند** بپذیرد (بایتِ NUL) — همان شاخه‌ی fallback. */
function unqueueableJob(overrides: Record<string, unknown> = {}) {
  return {
    to: guestPhone,
    template: 'campaign' as const,
    tokens: [`[DEMO]${NUL}`, 'رستوران'],
    restaurantId,
    ...overrides,
  };
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] tenant sms-fallback ${SFX}` } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-smsfb-${SFX}`, name: '[DEMO] رستورانِ سقفِ پیامک',
      clubPrefix: 'SFB', smsBalance: 0,
    },
  });
  restaurantId = r.id;
  // بدونِ کلیدِ کاوه‌نگار، `sendSmsNow` هیچ درخواستِ شبکه‌ای نمی‌زند ولی
  // `smsFailed{reason:"no_api_key"}` را می‌شمارد — یعنی «تلاش برای ارسال»
  // قابلِ اندازه‌گیری است بدونِ اینکه پیامکِ واقعی برود.
  delete process.env.KAVENEGAR_API_KEY;
});

after(async () => {
  globalThis.fetch = ORIG_FETCH;
  if (ORIG_KEY === undefined) delete process.env.KAVENEGAR_API_KEY;
  else process.env.KAVENEGAR_API_KEY = ORIG_KEY;
  // فقط ردیف‌های خودِ این فایل — نه `kind='sms'`ِ کلی: رانر تک‌پروسه‌ای است و
  // پاک‌کردنِ صفِ دیگران می‌تواند تستِ بعدی را بی‌صدا خراب کند.
  await db.$executeRaw`DELETE FROM jobs WHERE kind = 'sms' AND payload->>'to' = ${guestPhone}`
    .catch(() => 0);
  await db.smsTransaction.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('موجودیِ پیامک در مسیرِ اضطراریِ صف (§۳ — پول)', () => {
  beforeEach(async () => { globalThis.fetch = ORIG_FETCH; });

  test('کنترلِ مثبت: مسیرِ عادی واقعاً در صف می‌نشیند و اعتبار کم نمی‌کند', async () => {
    // بدونِ این، تستِ بعدی نمی‌توانست ادعا کند «کسر مالِ مسیرِ اضطراری است»:
    // شاید هر ارسالی کسر می‌کرد. کسرِ مسیرِ عادی کارِ worker است، نه اینجا.
    await setBalance(5);
    const before = await db.job.count({ where: { kind: 'sms' } });
    await enqueueSms({ to: guestPhone, template: 'campaign', tokens: ['[DEMO]', 'ر'], restaurantId });
    assert.equal(await db.job.count({ where: { kind: 'sms' } }), before + 1, 'باید در صف بنشیند');
    assert.equal(await balanceOf(), 5, 'مسیرِ عادی نباید همین‌جا کسر کند (کارِ worker است)');
  });

  test('کنترلِ مثبتِ روش: بایتِ NUL واقعاً صف را می‌شکند', async () => {
    // اگر روزی jsonb این نویسه را بپذیرد، تست‌های زیر بی‌صدا بی‌معنا می‌شوند
    // (چون دیگر هرگز وارد شاخه‌ی fallback نمی‌شوند و همه‌چیز سبز می‌ماند).
    const before = await db.job.count({ where: { kind: 'sms' } });
    await enqueueSms(unqueueableJob());
    assert.equal(await db.job.count({ where: { kind: 'sms' } }), before,
      'این پیامک نباید در صف نشسته باشد — وگرنه شاخه‌ی اضطراری اصلاً اجرا نشده');
  });

  test('🔴 صف که بیفتد، مسیرِ اضطراری دقیقاً یک اعتبار کسر می‌کند', async () => {
    await setBalance(3);
    const txBefore = await db.smsTransaction.count({ where: { restaurantId } });
    const sentBefore = smsFailed('no_api_key');

    await enqueueSms(unqueueableJob());

    assert.equal(await balanceOf(), 2, 'موجودی باید دقیقاً ۱ کم شود (قبلاً اصلاً کم نمی‌شد)');
    const tx = await db.smsTransaction.findMany({
      where: { restaurantId }, orderBy: { createdAt: 'desc' }, take: 1,
    });
    assert.equal(await db.smsTransaction.count({ where: { restaurantId } }), txBefore + 1,
      'مصرف باید در دفترِ sms_transactions ردِ حسابرسی بگذارد');
    assert.equal(tx[0].delta, -1);
    assert.equal(tx[0].reason, 'queue_fallback', 'مصرفِ مسیرِ اضطراری باید از مسیرِ عادی قابلِ تفکیک باشد');
    assert.equal(tx[0].balanceAfter, 2);
    assert.equal(smsFailed('no_api_key'), sentBefore + 1, 'و پیام واقعاً تلاش به ارسال شده');
  });

  test('🔴 با موجودیِ صفر، مسیرِ اضطراری اصلاً ارسال نمی‌کند', async () => {
    await setBalance(0);
    const txBefore = await db.smsTransaction.count({ where: { restaurantId } });
    const sentBefore = smsFailed('no_api_key');
    const blockedBefore = smsFailed('insufficient_balance');

    await enqueueSms(unqueueableJob());

    assert.equal(smsFailed('no_api_key'), sentBefore,
      'هیچ تلاشی برای ارسال نباید انجام شود — این همان ارسالِ بدونِ اعتبار بود');
    assert.equal(smsFailed('insufficient_balance'), blockedBefore + 1,
      'و نبودنِ اعتبار باید متریکِ قابلِ‌آلارم بدهد، نه سکوت');
    assert.equal(await balanceOf(), 0, 'موجودی نباید منفی شود');
    assert.equal(await db.smsTransaction.count({ where: { restaurantId } }), txBefore,
      'ارسالِ انجام‌نشده نباید تراکنشِ مصرف بسازد');
  });

  test('🔴 شکستِ ارسال در مسیرِ اضطراری دیگر بی‌صدا بلعیده نمی‌شود', async () => {
    await setBalance(4);
    process.env.KAVENEGAR_API_KEY = 'test-key-not-real';
    // شکستِ شبکه‌ی قطعی و کاملاً محلی — هیچ درخواستِ بیرونی‌ای نمی‌رود.
    globalThis.fetch = (async () => { throw new Error('[DEMO] شبکه قطع است'); }) as typeof fetch;
    const swallowedBefore = smsFailed('fallback_failed');
    try {
      await enqueueSms(unqueueableJob());
    } finally {
      globalThis.fetch = ORIG_FETCH;
      delete process.env.KAVENEGAR_API_KEY;
    }
    assert.equal(smsFailed('fallback_failed'), swallowedBefore + 1,
      'شکستِ ارسالِ بدونِ retry باید صریحاً شمرده شود (قبلاً `.catch(()=>{})` بود)');
  });

  test('پیامکِ بدونِ رستوران (سطحِ پلتفرم) هنوز از مسیرِ اضطراری می‌رود', async () => {
    // کنترلِ منفی برای خودِ رفع: گاردِ موجودی نباید مسیرهایی را که اصلاً
    // موجودیِ رستورانی ندارند (دعوتِ دوست، تبریکِ تولدِ سطحِ پلتفرم) ببندد.
    const sentBefore = smsFailed('no_api_key');
    const blockedBefore = smsFailed('insufficient_balance');
    await enqueueSms({ to: guestPhone, template: 'campaign', tokens: [`[DEMO]${NUL}`] });
    assert.equal(smsFailed('no_api_key'), sentBefore + 1, 'باید تلاشِ ارسال انجام شود');
    assert.equal(smsFailed('insufficient_balance'), blockedBefore, 'و گاردِ موجودی نباید شلیک کند');
  });
});
