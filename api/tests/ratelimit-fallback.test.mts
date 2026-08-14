import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
//
// این فایل فقط rateLimitInMemory (منطقِ خالص) و rateLimitWithFallback
// (با تزریقِ یک attemptِ جعلی که throw می‌کند) را تست می‌کند — نه خودِ
// rateLimit()/enforceRateLimit() که نیازِ Redisِ واقعی دارند و در سشنِ
// P0-hardening/acquisition-grade زنده تست شده‌اند.
const { rateLimitInMemory, rateLimitWithFallback } = await import('../src/lib/ratelimit.ts');

// ═══════════════════════════════════════════════════════════════════════
//  A3 (سختگیریِ acquisition-grade، ۲۰۲۶-۰۸-۱۴): قبلاً enforceRateLimit
//  (۵۹+ callerِ route-level) اصلاً fallback نداشت — قطعیِ Redis به یک throwِ
//  خام تبدیل می‌شد که errorResponse آن را به یک خطایِ عمومی (نه fail-open)
//  ترجمه می‌کرد. این تست‌ها دقیقاً همون مسیر رو با یک attemptِ جعلیِ throwکننده
//  شبیه‌سازی می‌کنن — بدونِ نیازِ Redisِ واقعیِ خاموش.
// ═══════════════════════════════════════════════════════════════════════

const RULE = { max: 5, windowMs: 60_000, prefix: 'test' };

describe('rateLimitInMemory — سقفِ per-process بدونِ Redis', () => {
  test('درخواستِ اول همیشه مجاز است', () => {
    const r = rateLimitInMemory('ip-a-' + Math.random(), RULE);
    assert.equal(r.allowed, true);
    assert.equal(r.remaining, RULE.max - 1);
  });
  test('بعد از رسیدن به max، درخواستِ بعدی رد می‌شود', () => {
    const ip = 'ip-b-' + Math.random();
    let last;
    for (let i = 0; i < RULE.max; i++) last = rateLimitInMemory(ip, RULE);
    assert.equal(last!.allowed, true); // آخرین مجازِ داخلِ سقف
    const over = rateLimitInMemory(ip, RULE);
    assert.equal(over.allowed, false);
    assert.equal(over.remaining, 0);
    assert.ok(over.retryAfterSec > 0);
  });
  test('IPهای متفاوت سطلِ جدا دارند (بدونِ نشتِ شمارنده بینِ IPها)', () => {
    const ipX = 'ip-x-' + Math.random();
    const ipY = 'ip-y-' + Math.random();
    for (let i = 0; i < RULE.max; i++) rateLimitInMemory(ipX, RULE);
    const overX = rateLimitInMemory(ipX, RULE);
    const freshY = rateLimitInMemory(ipY, RULE);
    assert.equal(overX.allowed, false);
    assert.equal(freshY.allowed, true);
  });
});

describe('rateLimitWithFallback — fail-open وقتی Redis (شبیه‌سازی‌شده) قطع است', () => {
  test('وقتی attempt throw می‌کند، به rateLimitInMemory سقوط می‌کند و همچنان allowed برمی‌گرداند', async () => {
    const failing = async () => { throw new Error('ECONNREFUSED (شبیه‌سازیِ قطعیِ Redis)'); };
    const ip = 'fallback-ip-' + Math.random();
    const r = await rateLimitWithFallback(ip, RULE, 'route', failing);
    assert.equal(r.allowed, true);
  });
  test('بعدِ رسیدن به سقفِ in-memory (با همون fallback مکرر)، درخواستِ بعدی رد می‌شود', async () => {
    const failing = async () => { throw new Error('ECONNREFUSED'); };
    const ip = 'fallback-ip2-' + Math.random();
    let last;
    for (let i = 0; i < RULE.max; i++) last = await rateLimitWithFallback(ip, RULE, 'route', failing);
    assert.equal(last!.allowed, true);
    const over = await rateLimitWithFallback(ip, RULE, 'route', failing);
    assert.equal(over.allowed, false);
  });
  test('وقتی attempt موفق می‌شود (بدونِ Redisِ واقعی، فقط شبیه‌سازیِ نتیجه)، مستقیم همون نتیجه برمی‌گردد، نه fallback', async () => {
    const succeeding = async () => ({ allowed: true, remaining: 3, resetAt: Date.now() + 1000, retryAfterSec: 0 });
    const r = await rateLimitWithFallback('any-ip', RULE, 'route', succeeding);
    assert.equal(r.remaining, 3); // اگر fallback اشتباهاً صدا زده می‌شد، remaining از in-memory می‌اومد، نه ۳
  });
  test('scope=middleware هم دقیقاً همون رفتارِ fail-open را دارد (پارامترِ برچسب‌گذاری، نه شاخه‌ی منطقیِ جدا)', async () => {
    const failing = async () => { throw new Error('down'); };
    const r = await rateLimitWithFallback('mw-ip-' + Math.random(), RULE, 'middleware', failing);
    assert.equal(r.allowed, true);
  });
});
