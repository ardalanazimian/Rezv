// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';
import { readFileSync } from 'node:fs';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ «مسمومیتِ واژگانِ دستیار» — معادلِ قطعیِ prompt injection
//  (پروتکل §۳ صداقتِ نتیجه · §۱۸ مرزِ AI · CLAUDE.md §۶ ریت‌لیمیت)
//
//  زنجیره‌ی تأییدشده (۲۰۲۶-۰۸-۲۵):
//   ۱. `POST /restaurant/assistant` سؤال را ذخیره و `log_id` برمی‌گرداند.
//   ۲. `POST /restaurant/assistant/feedback` با همان `log_id` **هر** توکنِ آن
//      سؤال را به سمتِ نیتی که خودِ فراخوان انتخاب کرده `increment: 1`
//      می‌کرد — بدونِ سقف، بدونِ محدودیتِ تکرار.
//   ۳. `classify` امتیاز را `seed[tok]*3 + learned[tok]` می‌سازد؛ سمتِ
//      یادگرفته بی‌نهایت بود.
//
//  اندازه‌گیریِ واقعیِ همین اجرا با خودِ طبقه‌بند («امروز چند رزرو داریم»):
//    ۰ چرخه → reservations_today conf=0.899 · ۱۰ چرخه → vip_customers 0.492
//    ۵۰ چرخه → vip_customers 0.950 · ۲۰۰ چرخه → 0.987
//  یعنی با ~۲۰ درخواست، دستیار با «اطمینانِ بالا» به سؤالِ دیگری جواب می‌داد
//  و هیچ نشانه‌ای هم دیده نمی‌شد.
//
//  چهار قفلِ این فایل: سقفِ شمارش · یک‌بار آموزش به‌ازای هر سؤال · سقفِ
//  توکنِ هر اصلاح · هرسِ نگه‌داری. به‌علاوه‌ی گاردِ ساختاریِ سطحِ ریت‌لیمیت.
// ═══════════════════════════════════════════════════════════════════════

import { fixturePhone } from './_phone.helper.mts';

// ⚠️ پیشوندِ ۰۹۲۶ مالِ همین فایل است — در فایلِ دیگری تکرارش نکن
// (دلیل: tests/_phone.helper.mts).
const PHONE_PREFIX = '0926';

const { db } = await import('../src/lib/db.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const {
  askAssistant, teachAssistant, MAX_VOCAB_COUNT, MAX_TAUGHT_TOKENS, MAX_LEARNED_VOCAB_ROWS,
} = await import('../src/lib/assistant.ts');
const { tokenize } = await import('../src/lib/assistant-nlu.ts');
const askRoute = await import('../src/app/api/v1/restaurant/assistant/route.ts');
const feedbackRoute = await import('../src/app/api/v1/restaurant/assistant/feedback/route.ts');
const retentionRoute = await import('../src/app/api/v1/maintenance/retention/route.ts');

const SRC = fileURLToPath(new URL('../src/app/api/v1/restaurant/assistant/', import.meta.url));
const SFX = Date.now().toString(36).slice(-6);
const QUESTION = 'امروز چند رزرو داریم';
const HONEST_INTENT = 'reservations_today';
const ATTACK_INTENT = 'vip_customers';
const ORIG_MAINT = process.env.MAINTENANCE_KEY;

let tenantId = '';
let restaurantId = '';
let ownerToken = '';
let retentionRestaurantId = '';

const askReq = (message: string) =>
  new Request('http://x/api/v1/restaurant/assistant', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ownerToken}`,
      'content-type': 'application/json',
      'x-real-ip': testIp(),
    },
    body: JSON.stringify({ message }),
  });

const feedbackReq = (logId: string, intent: string) =>
  new Request('http://x/api/v1/restaurant/assistant/feedback', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ownerToken}`,
      'content-type': 'application/json',
      'x-real-ip': testIp(),
    },
    body: JSON.stringify({ log_id: logId, correct_intent: intent }),
  });

/*
 * ⚠️ اینجا قبلاً `clearOwnRateLimits()` بود که `rl:auth:*` و `rl:srch:*` را
 * **سراسری** پاک می‌کرد — لازم بود چون IPِ هر `new Request()`ِ بی‌هدر `unknown`
 * است و سطل بینِ همه‌ی فایل‌های رانر مشترک می‌شد. ولی همان پاک‌سازی سطلِ
 * فایل‌های دیگر را هم خالی می‌کرد و ریت‌لیمیتشان را از سنجش خارج. حالا هر
 * Request با `testIp()` سطلِ خودش را دارد.
 */

async function vocabRows() {
  return db.restaurantAssistantVocab.findMany({
    where: { restaurantId }, select: { intent: true, word: true, count: true },
  });
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] tenant assistant ${SFX}` } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-asst-${SFX}`, name: '[DEMO] رستورانِ دستیار', clubPrefix: 'AST',
    },
  });
  restaurantId = r.id;
  const r2 = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-asst2-${SFX}`, name: '[DEMO] رستورانِ هرس', clubPrefix: 'AS2',
    },
  });
  retentionRestaurantId = r2.id;
  const owner = await db.staff.create({
    data: { tenantId, phone: fixturePhone(PHONE_PREFIX), role: 'owner', isActive: true },
    select: { id: true },
  });
  ownerToken = signAccess({ sub: owner.id, kind: 'staff', tenantId, role: 'owner' });
});

after(async () => {
  const ids = [restaurantId, retentionRestaurantId];
  await db.restaurantAssistantVocab.deleteMany({ where: { restaurantId: { in: ids } } }).catch(() => {});
  await db.restaurantAssistantLog.deleteMany({ where: { restaurantId: { in: ids } } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('دستیار · مسمومیتِ واژگان مهار می‌شود', () => {

  test('کنترلِ مثبت: پیش از هر آموزشی، جواب درست و مطمئن است', async () => {
    // بدونِ این، تستِ «جواب عوض نشد» با یک دستیارِ همیشه-خراب هم سبز می‌شد.
    const r = await askAssistant({ restaurantId, question: QUESTION });
    assert.equal(r.intent, HONEST_INTENT);
    assert.ok(r.understood, 'باید بالای آستانه باشد');
    assert.ok(r.confidence > 0.8, `اطمینانِ پایه باید بالا باشد، بود ${r.confidence}`);
  });

  test('کنترلِ مثبت: یک اصلاحِ واقعی واقعاً یاد گرفته می‌شود', async () => {
    // یادگیری نباید کشته شده باشد — سقف یعنی «محدود»، نه «خاموش».
    const q = 'میزای خالی چندتان';
    const asked = await askAssistant({ restaurantId, question: q });
    await teachAssistant({ restaurantId, logId: asked.log_id, correctIntent: 'tables_now' });
    const learned = (await vocabRows()).filter((v) => v.intent === 'tables_now');
    assert.ok(learned.length > 0, 'کلماتِ سؤال باید برایِ نیتِ درست ثبت شوند');
    assert.ok(learned.every((v) => v.count >= 1));
  });

  test('🔴 ۱۲ چرخه‌ی پرسش+آموزش دیگر جوابِ سؤال را عوض نمی‌کند', async () => {
    // همان حمله‌ی بازتولیدشده: بدونِ سقف، در چرخه‌ی ۱۰ به vip_customers
    // می‌افتاد و در ۵۰ با conf=0.95 آن‌جا می‌ماند.
    for (let i = 0; i < 12; i++) {
      const asked = await askAssistant({ restaurantId, question: QUESTION });
      await teachAssistant({ restaurantId, logId: asked.log_id, correctIntent: ATTACK_INTENT });
    }
    const after = await askAssistant({ restaurantId, question: QUESTION });
    assert.equal(after.intent, HONEST_INTENT,
      `دستیار نباید به نیتِ تحمیلی بیفتد — افتاد به ${after.intent} با اطمینانِ ${after.confidence}`);
  });

  test('🔴 شمارشِ هیچ (نیت، کلمه)ای از سقف بالاتر نمی‌رود', async () => {
    const rows = await vocabRows();
    const max = Math.max(...rows.map((v) => v.count));
    assert.ok(rows.length > 0, 'کنترلِ مثبت: باید واژگانی ثبت شده باشد');
    assert.ok(max <= MAX_VOCAB_COUNT,
      `بیشترین شمارش ${max} است ولی سقف ${MAX_VOCAB_COUNT} — سقف اعمال نشده`);
    assert.equal(max, MAX_VOCAB_COUNT,
      '۱۲ چرخه باید واقعاً به سقف رسیده باشد (وگرنه سناریو ضعیف است، نه کد امن)');
  });

  test('🔴 یک سؤال فقط یک‌بار قابلِ آموزش است (کلِ روت)', async () => {
    const asked = await askRoute.POST(askReq('چند نفر امشب رزرو دارن'));
    const askedBody = await asked.json();
    assert.equal(asked.status, 200, JSON.stringify(askedBody));

    const first = await feedbackRoute.POST(feedbackReq(askedBody.log_id, ATTACK_INTENT));
    assert.equal(first.status, 200, 'اولین اصلاح باید بپذیرد');

    const before = await vocabRows();
    const second = await feedbackRoute.POST(feedbackReq(askedBody.log_id, ATTACK_INTENT));
    const secondBody = await second.json();
    assert.equal(second.status, 422, JSON.stringify(secondBody));
    assert.equal(secondBody.error?.code, 'VALIDATION');

    const after = await vocabRows();
    assert.deepEqual(
      after.map((v) => `${v.intent}:${v.word}:${v.count}`).sort(),
      before.map((v) => `${v.intent}:${v.word}:${v.count}`).sort(),
      'اصلاحِ تکراری نباید هیچ شمارشی را تکان بدهد',
    );
  });

  test('🔴 سؤالِ ۵۰۰ نویسه‌ای بیش از سقفِ توکن ردیف نمی‌سازد', async () => {
    // ⚠️ سناریو باید واقعاً از سقف رد شود، وگرنه تست توخالی است: با کلماتِ
    // بلند، ۵۰۰ نویسه فقط ~۳۸ توکن می‌دهد و زیرِ سقف می‌ماند (این دقیقاً در
    // نسخه‌ی اولِ همین تست رخ داد و جهش‌آزمایی لوش داد). پس عمداً توکنِ
    // دوحرفیِ یکتا می‌سازیم تا چگالیِ توکن بیشینه شود.
    const letters = [...'ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی'];
    const words: string[] = [];
    for (const a of letters) for (const b of letters) words.push(a + b);
    const long = words.join(' ').slice(0, 500);

    const asked = await askAssistant({ restaurantId, question: long });
    const distinct = new Set(tokenize(long)).size;
    assert.ok(distinct > MAX_TAUGHT_TOKENS,
      `پیش‌شرطِ سناریو: سؤال باید بیش از ${MAX_TAUGHT_TOKENS} توکنِ یکتا داشته باشد، داشت ${distinct}`);

    const before = (await vocabRows()).length;
    await teachAssistant({ restaurantId, logId: asked.log_id, correctIntent: 'busiest_day' });
    const created = (await vocabRows()).length - before;
    assert.ok(created > 0, 'کنترلِ مثبت: باید چیزی یاد گرفته باشد');
    assert.ok(created <= MAX_TAUGHT_TOKENS,
      `یک اصلاح ${created} ردیف ساخت، سقف ${MAX_TAUGHT_TOKENS} است`);
  });

  test('🔴 اصلاحِ سؤالِ رستورانِ دیگر ممکن نیست (ایزولاسیونِ tenant §۷)', async () => {
    const foreign = await db.restaurantAssistantLog.create({
      data: { restaurantId: retentionRestaurantId, question: QUESTION, confidence: 0.1 },
      select: { id: true },
    });
    await assert.rejects(
      () => teachAssistant({ restaurantId, logId: foreign.id, correctIntent: ATTACK_INTENT }),
      /پیدا نشد/,
    );
    const stillOpen = await db.restaurantAssistantLog.findUnique({ where: { id: foreign.id } });
    assert.equal(stillOpen?.wasCorrected, false, 'ردیفِ رستورانِ دیگر نباید حتی claim شود');
  });

  test('گاردِ ساختاری: هر دو مسیرِ نویسنده سطحِ `auth` می‌گیرند نه `search`', () => {
    // CLAUDE.md §۶: «GETِ سبک = search؛ نوشتن‌ها باید auth بدهند».
    for (const f of ['route.ts', 'feedback/route.ts']) {
      const src = readFileSync(SRC + f, 'utf8');
      const post = src.slice(src.indexOf('export const POST'));
      assert.match(post, /rateLimit:\s*'auth'/, `${f}: POST باید سطحِ auth بگیرد`);
      assert.doesNotMatch(post, /rateLimit:\s*'search'/, `${f}: سطحِ search برای نوشتن اشتباه است`);
    }
  });

  test('گاردِ ساختاری: خواندنِ واژگان کران‌دار است', () => {
    // رفتارش با ۵۰۰۰ ردیف قابلِ‌اندازه‌گیریِ ارزان نیست، ولی نبودِ `take`
    // دقیقاً همان باگ بود: کلِ واژگانِ یک tenant در هر سؤال لود می‌شد،
    // در پروسه‌ای که بینِ همه‌ی tenantها مشترک است.
    const src = readFileSync(fileURLToPath(new URL('../src/lib/assistant.ts', import.meta.url)), 'utf8');
    const fn = src.slice(src.indexOf('async function loadLearnedVocab'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    assert.match(body, /take:\s*MAX_LEARNED_VOCAB_ROWS/, 'خواندن باید سقف داشته باشد');
    assert.match(body, /orderBy:/, 'و بُرش باید معنادار باشد، نه تصادفی');
  });
});

describe('دستیار · هرسِ نگه‌داری', () => {
  // ⚠️ بازیابی از هوکِ **ریشه‌ای** به اینجا آمد: هوکِ ریشه فقط در پایانِ کلِ
  // رانِ تک-process اجرا می‌شود، پس تا آن لحظه حالتِ سراسری برایِ همه‌ی
  // فایل‌های بعدی آلوده می‌ماند. گاردش: tests/root-hook-globals.test.mts
  afterEach(() => {
    if (ORIG_MAINT === undefined) delete process.env.MAINTENANCE_KEY;
    else process.env.MAINTENANCE_KEY = ORIG_MAINT;
  });

  test('🔴 لاگِ قدیمی‌تر از ۹۰ روز هرس می‌شود، تازه‌ها می‌مانند', async () => {
    process.env.MAINTENANCE_KEY = `maint-${SFX}`;
    const old = await db.restaurantAssistantLog.create({
      data: {
        restaurantId: retentionRestaurantId, question: '[DEMO] سؤالِ کهنه', confidence: 0.5,
        createdAt: new Date(Date.now() - 100 * 86_400_000),
      },
      select: { id: true },
    });
    const fresh = await db.restaurantAssistantLog.create({
      data: { restaurantId: retentionRestaurantId, question: '[DEMO] سؤالِ تازه', confidence: 0.5 },
      select: { id: true },
    });

    const res = await retentionRoute.POST(new Request('http://x/api/v1/maintenance/retention', {
      method: 'POST',
      headers: { 'x-maintenance-key': `maint-${SFX}`, 'x-real-ip': testIp() },
    }));
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.ok(typeof body.deleted.assistant_logs === 'number',
      'گزارشِ هرس باید عددِ واقعی بدهد، نه سکوت');

    assert.equal(await db.restaurantAssistantLog.count({ where: { id: old.id } }), 0);
    assert.equal(await db.restaurantAssistantLog.count({ where: { id: fresh.id } }), 1,
      'کنترلِ منفی: لاگِ تازه نباید حذف شود');
  });

  test('🔴 واژگانِ خارج از سقفِ خوانده‌شده هرس می‌شوند', async () => {
    process.env.MAINTENANCE_KEY = `maint-${SFX}`;
    // ردیفی که هرگز در هیچ طبقه‌بندی‌ای شرکت نمی‌کند: پایین‌ترین شمارش،
    // در رستورانی که دقیقاً یک ردیف بیش از سقف دارد.
    await db.restaurantAssistantVocab.createMany({
      data: Array.from({ length: MAX_LEARNED_VOCAB_ROWS }, (_, i) => ({
        restaurantId: retentionRestaurantId, intent: 'busiest_day', word: `پرکن${SFX}${i}`, count: 3,
      })),
      skipDuplicates: true,
    });
    const victim = await db.restaurantAssistantVocab.create({
      data: { restaurantId: retentionRestaurantId, intent: 'busiest_day', word: `قربانی${SFX}`, count: 1 },
      select: { id: true },
    });
    assert.equal(
      await db.restaurantAssistantVocab.count({ where: { restaurantId: retentionRestaurantId } }),
      MAX_LEARNED_VOCAB_ROWS + 1, 'پیش‌شرطِ سناریو: باید دقیقاً یکی بیش از سقف باشد',
    );

    const res = await retentionRoute.POST(new Request('http://x/api/v1/maintenance/retention', {
      method: 'POST',
      headers: { 'x-maintenance-key': `maint-${SFX}`, 'x-real-ip': testIp() },
    }));
    assert.equal(res.status, 200);

    assert.equal(await db.restaurantAssistantVocab.count({ where: { id: victim.id } }), 0,
      'کم‌اثرترین ردیفِ خارج از سقف باید هرس شود');
    assert.equal(
      await db.restaurantAssistantVocab.count({ where: { restaurantId: retentionRestaurantId } }),
      MAX_LEARNED_VOCAB_ROWS, 'و بقیه باید دست‌نخورده بمانند',
    );
  });
});
