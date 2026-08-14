import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
// نکته: صرفِ importِ redis.ts یک کلاینتِ ioredisِ singleton با lazyConnect
// می‌سازد (بدونِ اتصالِ واقعی در همین لحظه)، پس اینجا نیازی به Redisِ واقعیِ
// روشن نیست — همه‌ی تست‌های این فایل با یک LockClientِ جعلیِ تزریق‌شده کار می‌کنن.
const { withSlotLock } = await import('../src/lib/redis.ts');

// ═══════════════════════════════════════════════════════════════════════
//  Part C2 (حسابرسیِ Time-Range/EXCLUDE/Redis-evidence، ۲۰۲۶-۰۸-۱۴):
//
//  قبلاً withSlotLock فقط حالتِ «قفل واقعاً در دستِ کسیِ دیگر است» را
//  مدیریت می‌کرد. اگر خودِ Redis در دسترس نبود، redis.set/eval throw
//  می‌کرد و این throw تا بیرونِ createReservation leak می‌کرد — یعنی
//  قطعیِ صرفِ Redis (نه رقابتِ واقعی) به ۵۰۰ی createReservation منجر
//  می‌شد، برخلافِ معماریِ مستندشده («قفلِ Redis فقط بهینه‌سازی است»).
//
//  این تست‌ها مستقیماً خودِ withSlotLock را با یک LockClientِ جعلیِ
//  throwکننده صدا می‌زنند — بدونِ نیاز به یک Redisِ واقعیِ خاموش (که در
//  CI/سندباکس قابلِ‌اعتماد نیست) — تا رفتارِ fail-open را در ایزوله ثابت کنند.
//  اثباتِ end-to-end (اینکه با این fail-open، رزروِ موازی هنوز دقیقاً یک
//  برنده دارد) در table-merge-occupancy-concurrency.test.mts است.
// ═══════════════════════════════════════════════════════════════════════

function makeFailingClient(): { set: () => Promise<never>; eval: () => Promise<never> } {
  return {
    set: async () => { throw new Error('ECONNREFUSED (شبیه‌سازیِ قطعیِ Redis)'); },
    eval: async () => { throw new Error('ECONNREFUSED (شبیه‌سازیِ قطعیِ Redis)'); },
  };
}

describe('withSlotLock — fail-open وقتی Redis (شبیه‌سازی‌شده) در دسترس نیست', () => {
  test('اگر client.set throw کند، fn() بدونِ قفل اجرا می‌شود و نتیجه‌اش برمی‌گردد (نه throw)', async () => {
    const fake = makeFailingClient();
    let ran = false;
    const result = await withSlotLock('test-key-' + Math.random(), 8000, async () => {
      ran = true;
      return 'ok';
    }, fake as any);
    assert.equal(ran, true);
    assert.equal(result, 'ok');
  });

  test('اگر خودِ fn() هم throw کند (مثلاً تداخلِ واقعیِ DB)، آن خطا دست‌نخورده بیرون می‌آید (fail-open خطای fn را نمی‌بلعد)', async () => {
    const fake = makeFailingClient();
    await assert.rejects(
      () => withSlotLock('test-key-' + Math.random(), 8000, async () => {
        throw new Error('SLOT_FULL simulated');
      }, fake as any),
      /SLOT_FULL/,
    );
  });

  test('وقتی client.set به‌درستی قفل می‌گیرد (رفتارِ عادی)، fn() زیرِ قفل اجرا می‌شود و eval برایِ آزادسازی صدا زده می‌شود', async () => {
    let setCalls = 0, evalCalls = 0;
    const okClient = {
      set: async () => { setCalls++; return 'OK'; },
      eval: async () => { evalCalls++; return 1; },
    };
    const result = await withSlotLock('test-key-' + Math.random(), 8000, async () => 'done', okClient as any);
    assert.equal(result, 'done');
    assert.equal(setCalls, 1);
    assert.equal(evalCalls, 1);
  });

  test('اگر قفل واقعاً در دستِ کسیِ دیگر باشد (set همیشه null، بدونِ throw)، بعدِ تمامِ تلاش‌ها Err.lockTimeout می‌دهد — این fail-open نیست', async () => {
    const heldClient = {
      set: async () => null, // قفل هرگز آزاد نمی‌شود (رقابتِ واقعی، نه قطعیِ Redis)
      eval: async () => 0,
    };
    await assert.rejects(
      () => withSlotLock('test-key-' + Math.random(), 50, async () => 'unreached', heldClient as any),
    );
  });

  test('اگر آزادسازیِ قفل (eval) بعدِ اجرایِ موفقِ fn() شکست بخورد، نتیجه‌ی fn() همچنان برمی‌گردد (نه ۵۰۰ی گمراه‌کننده)', async () => {
    const flakyUnlock = {
      set: async () => 'OK',
      eval: async () => { throw new Error('Redis وسطِ آزادسازی قطع شد'); },
    };
    const result = await withSlotLock('test-key-' + Math.random(), 8000, async () => 'reservation-created', flakyUnlock as any);
    assert.equal(result, 'reservation-created');
  });
});
