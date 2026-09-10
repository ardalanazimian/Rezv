import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TOTP, Secret } from 'otpauth';

// ═══════════════════════════════════════════════════════════════════════
//  پنجره‌ی ضدِ replay باید **کاملِ** پنجره‌ی پذیرش را بپوشاند
//
//  ⚠️ نقصِ واقعی (۲۰۲۶-۰۹-۰۶، `lib/admin-totp.ts:127`):
//  پنجره‌ی پذیرش سه گام است — `validate({ window: WINDOW_STEPS })` کدِ گامِ S
//  را در گام‌های S−۱ و S و S+۱ می‌پذیرد، یعنی ۹۰ ثانیه (این با پروبِ واقعیِ
//  otpauth تأیید شد: delta = codeStep − currentStep و |delta|=۲ رد می‌شود).
//  ولی TTLِ کلیدِ ضدِ replay `PERIOD_SECONDS * (WINDOW_STEPS + 1)` = **۶۰**
//  ثانیه بود و از **اولین مصرف** شروع می‌شد.
//
//  نتیجه: کدی که نزدیکِ ابتدایِ پنجره‌اش مصرف شود (سناریوی واقعیِ اختلافِ
//  ساعت، delta=+۱)، تا ۳۰ ثانیه **پس از انقضای کلیدِ ضدِ replay** هنوز
//  پذیرفته می‌شود. یعنی شنودِ یک کد در آن بازه دوباره قابلِ استفاده است.
//
//  کامنتِ `:126` ادعا می‌کرد TTL «تا پایانِ پنجره‌ی پذیرشِ همین کد» است.
//  نبود.
//
//  ── چرا این تست بدونِ خوابیدن قطعی است ──
//  کلید در لحظه‌ی T۰ (داخلِ گامِ C) ساخته می‌شود و کد مالِ گامِ S=C+۱ است.
//  پایانِ پذیرش = (S+۱+۱)×۳۰ = (C+۳)×۳۰ ثانیه‌ی مطلق.
//  چون T۰ < (C+۱)×۳۰ است، با TTLِ ۶۰: انقضای کلید < (C+۳)×۳۰ — **همیشه**،
//  در هر نقطه‌ای از گام. و با TTLِ صحیح (۹۰): چون T۰ ≥ C×۳۰ است، انقضای
//  کلید ≥ (C+۳)×۳۰ — باز هم همیشه. پس نه flakiness دارد نه به sleep نیاز.
//
//  ⚠️ همه‌چیز داخلِ یک describeِ بیرونی است: این فایل env و Redis را دست‌کاری
//  می‌کند و هوکِ سطحِ فایل به سوئیتِ ROOT می‌چسبد (درسِ password-login).
// ═══════════════════════════════════════════════════════════════════════

const { redis } = await import('../src/lib/redis');
const { verifyAdminTotp, PERIOD_SECONDS, WINDOW_STEPS } =
  await import('../src/lib/admin-totp');

const TAG = `rw-${String(Date.now()).slice(-9)}`;
const ADMIN_USER = `admin_${TAG}`;
const SECRET = new Secret({ size: 20 }).base32;
const KEY_GLOB = `admin:totp:used:${ADMIN_USER.toLowerCase()}:*`;

const saved: Record<string, string | undefined> = {};

function totpAt(offsetSteps: number): string {
  return new TOTP({
    issuer: 'Rezervno', label: ADMIN_USER, algorithm: 'SHA1',
    digits: DIGITS, period: PERIOD_SECONDS, secret: Secret.fromBase32(SECRET),
  }).generate({ timestamp: Date.now() + offsetSteps * PERIOD_SECONDS * 1000 });
}
const DIGITS = 6;

async function clearReplayKeys() {
  // فقط کلیدهای همین تست — هرگز FLUSHALL (Redis ممکن است مشترک باشد).
  const keys = await redis.keys(KEY_GLOB);
  if (keys.length) await redis.del(...keys);
}

describe('پنجره‌ی ضدِ replayِ TOTPِ مدیر باید کلِ پنجره‌ی پذیرش را بپوشاند', () => {
  before(() => {
    for (const k of ['ADMIN_LOGIN_ENABLED', 'ADMIN_TOTP_USERNAME', 'ADMIN_TOTP_SECRET']) {
      saved[k] = process.env[k];
    }
  });

  beforeEach(async () => {
    process.env.ADMIN_LOGIN_ENABLED = 'true';
    process.env.ADMIN_TOTP_USERNAME = ADMIN_USER;
    process.env.ADMIN_TOTP_SECRET = SECRET;
    await clearReplayKeys();
  });

  after(async () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    await clearReplayKeys();
  });

  // ── کنترلِ مثبتِ ۱: خودِ سازوکار کار می‌کند ─────────────────────────────
  test('کنترلِ مثبت — کدِ درست پذیرفته می‌شود و بلافاصله replayش رد می‌شود', async () => {
    const code = totpAt(0);
    assert.equal(await verifyAdminTotp(ADMIN_USER, code), 'ok',
      'بارِ اول باید ok باشد — وگرنه ادعاهای زیر بی‌معنا هستند');
    assert.equal(await verifyAdminTotp(ADMIN_USER, code), 'replayed',
      'بارِ دوم باید replayed باشد — اگر این نشکند، سازوکارِ ضدِ replay اصلاً کار نمی‌کند');
  });

  // ── کنترلِ مثبتِ ۲: پنجره‌ی پذیرش تنگ‌تر نشده ──────────────────────────
  // بدونِ این، «رفعِ» تنبل (کوچک‌کردنِ window به ۰) هم تستِ اصلی را سبز می‌کرد
  // در حالی که اختلافِ ساعتِ واقعی را می‌شکست.
  test('کنترلِ مثبت — پذیرشِ ±۱ گام دست‌نخورده است', async () => {
    assert.equal(await verifyAdminTotp(ADMIN_USER, totpAt(-1)), 'ok',
      'یک گام عقب باید پذیرفته شود (اختلافِ ساعتِ واقعی)');
    await clearReplayKeys();
    assert.equal(await verifyAdminTotp(ADMIN_USER, totpAt(+1)), 'ok',
      'یک گام جلو باید پذیرفته شود');
  });

  test('کنترلِ منفی — گامِ ±۲ همچنان رد می‌شود', async () => {
    assert.equal(await verifyAdminTotp(ADMIN_USER, totpAt(+2)), 'invalid',
      'پنجره نباید از ±۱ گام بازتر شود');
  });

  // ── خودِ نقص ──────────────────────────────────────────────────────────
  test('⭐ کلیدِ ضدِ replay باید دستِ‌کم تا آخرین لحظه‌ی پذیرشِ همان کد زنده بماند', async () => {
    // delta=+۱ : سناریوی واقعیِ ساعتِ جلوترِ دستگاهِ مدیر، و بدترین حالت —
    // کد در ابتدای پنجره‌ی پذیرشش مصرف می‌شود، پس بیشترین فاصله تا پایانِ آن.
    const outcome = await verifyAdminTotp(ADMIN_USER, totpAt(+1));
    assert.equal(outcome, 'ok', 'موضوعِ تست غایب است: کدِ drift خورده باید پذیرفته شود');

    // گامِ کد را از **واقعیت** می‌خوانیم، نه از پیش‌بینی: اگر فراخوان دقیقاً
    // روی مرزِ گام بیفتد، پیش‌بینی غلط می‌شد.
    const keys = await redis.keys(KEY_GLOB);
    assert.equal(keys.length, 1,
      `موضوعِ تست غایب است: باید دقیقاً یک کلیدِ ضدِ replay ساخته شده باشد (یافت: ${keys.length})`);

    const step = Number(keys[0].split(':').pop());
    assert.ok(Number.isFinite(step), `شماره‌ی گام از کلید خوانده نشد: ${keys[0]}`);

    const pttl = await redis.pttl(keys[0]);
    assert.ok(pttl > 0, `موضوعِ تست غایب است: کلید باید TTL داشته باشد (pttl=${pttl})`);

    // لحظه‌ی مطلقِ انقضای کلید، و لحظه‌ی مطلقی که کد دیگر پذیرفته نمی‌شود.
    // هر دو مطلق‌اند، پس تأخیرِ بینِ دو اندازه‌گیری حذف می‌شود.
    const keyExpiresAt = Date.now() + pttl;
    const acceptanceEndsAt = (step + WINDOW_STEPS + 1) * PERIOD_SECONDS * 1000;
    const exposureMs = acceptanceEndsAt - keyExpiresAt;

    assert.ok(
      keyExpiresAt >= acceptanceEndsAt,
      `کلیدِ ضدِ replay ${Math.round(exposureMs / 1000)} ثانیه زودتر از پایانِ پنجره‌ی پذیرش منقضی می‌شود — ` +
      `در آن بازه همان کدِ شنودشده دوباره پذیرفته می‌شود. ` +
      `(انقضای کلید=${keyExpiresAt}، پایانِ پذیرش=${acceptanceEndsAt})`,
    );
  });

  // ── گاردِ رانش: TTL باید با WINDOW_STEPS حرکت کند ─────────────────────
  // اگر روزی WINDOW_STEPS عوض شود، TTLِ hardcode شده بی‌صدا دوباره کوتاه
  // می‌شود. این ادعا فرمول را به ثابت‌ها گره می‌زند، نه به عددِ ۹۰.
  test('⭐ TTLِ کلید = (۲×WINDOW_STEPS + ۱) × PERIOD — مشتق، نه hardcode', async () => {
    const outcome = await verifyAdminTotp(ADMIN_USER, totpAt(0));
    assert.equal(outcome, 'ok', 'موضوعِ تست غایب است');

    const keys = await redis.keys(KEY_GLOB);
    assert.equal(keys.length, 1, `موضوعِ تست غایب است: یک کلید انتظار می‌رفت (یافت: ${keys.length})`);

    const ttl = await redis.ttl(keys[0]);
    const expected = PERIOD_SECONDS * (2 * WINDOW_STEPS + 1);
    assert.ok(
      ttl >= expected - 1 && ttl <= expected,
      `TTL باید ${expected} ثانیه باشد (کلِ پنجره‌ی پذیرش: از ابتدای گامِ S−W تا انتهای گامِ S+W)، ولی ${ttl} بود`,
    );
  });
});
