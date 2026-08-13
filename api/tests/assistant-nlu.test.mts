import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const {
  tokenize, normalizePersian, classify, CONFIDENCE_THRESHOLD, ASSISTANT_INTENTS, isAssistantIntent,
} = await import('../src/lib/assistant-nlu.ts');

// ═══════════════════════════════════════════════════════════════════════
//  دستیارِ هوشمند — طبقه‌بندِ Naive Bayesِ آفلاین. این تست‌ها فقط ریاضیاتِ
//  خالص را می‌سنجند (بدونِ DB) — همان کاری که هر جمله‌ی seed در تولید هم
//  انجام می‌دهد، بدونِ نیاز به Postgres.
// ═══════════════════════════════════════════════════════════════════════

describe('normalizePersian', () => {
  test('ي عربی → ی فارسی، ك عربی → ک فارسی', () => {
    assert.equal(normalizePersian('كيفيت'), 'کیفیت');
  });
  test('اعرابِ عربی حذف می‌شود', () => {
    assert.equal(normalizePersian('مُحَمَّد'), 'محمد');
  });
});

describe('tokenize', () => {
  test('کلماتِ کاملاً بدونِ‌بار حذف می‌شوند، کلماتِ پرسشی می‌مانند', () => {
    const toks = tokenize('امروز چند رزرو داریم');
    assert.ok(toks.includes('چند'), 'کلمه‌ی پرسشیِ «چند» باید بماند');
    assert.ok(!toks.includes('را'), 'حرفِ اضافه‌ی بدونِ‌بار باید حذف شود');
  });
  test('رشته‌ی خالی یا فقط stopword → آرایه‌ی خالی', () => {
    assert.deepEqual(tokenize(''), []);
    assert.deepEqual(tokenize('را با از'), []);
  });
});

describe('classify — فقط با دانشِ seed (بدونِ هیچ یادگیریِ قبلی)', () => {
  test('«امروز چند رزرو داریم» → reservations_today با اطمینانِ بالایِ آستانه', () => {
    const r = classify(tokenize('امروز چند رزرو داریم'));
    assert.equal(r.intent, 'reservations_today');
    assert.ok(r.confidence >= CONFIDENCE_THRESHOLD, `اطمینان ${r.confidence} باید >= ${CONFIDENCE_THRESHOLD} باشد`);
  });
  test('«فردا چقدر شلوغه» → demand_tomorrow', () => {
    const r = classify(tokenize('فردا چقدر شلوغه'));
    assert.equal(r.intent, 'demand_tomorrow');
  });
  test('«کدوم مشتریا دارن از دست میرن» → at_risk_customers', () => {
    const r = classify(tokenize('کدوم مشتریا دارن از دست میرن'));
    assert.equal(r.intent, 'at_risk_customers');
  });
  test('«سلام» → greeting', () => {
    const r = classify(tokenize('سلام'));
    assert.equal(r.intent, 'greeting');
  });
  test('توکنِ خالی (پیام بی‌معنا) → اطمینانِ پایین یا نامعتبر، نه کرش', () => {
    const r = classify([]);
    assert.ok(typeof r.confidence === 'number' && !Number.isNaN(r.confidence));
  });
  test('جمله‌ی کاملاً نامرتبط (کلماتِ خارج از هر seed) → اطمینانِ یکنواختِ صادقانه، نه اطمینانِ کاذب', () => {
    const r = classify(tokenize('فیلم سینما کنسرت هنرپیشه کارگردان'));
    assert.ok(r.confidence < CONFIDENCE_THRESHOLD, `اطمینانِ جمله‌ی نامرتبط (${r.confidence}) باید زیرِ آستانه بماند`);
    assert.ok(Math.abs(r.confidence - 1 / ASSISTANT_INTENTS.length) < 1e-9, 'باید دقیقاً به عدمِ‌اطمینانِ یکنواخت برگردد');
  });
  test('ranked شاملِ همه‌ی نیت‌ها و نزولی مرتب است', () => {
    const r = classify(tokenize('امروز چند رزرو داریم'));
    assert.equal(r.ranked.length, ASSISTANT_INTENTS.length);
    for (let i = 1; i < r.ranked.length; i++) {
      assert.ok(r.ranked[i - 1].probability >= r.ranked[i].probability);
    }
  });
});

describe('classify — اثرِ خودآموزی (شبیه‌سازیِ واژگانِ یادگرفته‌شده از DB)', () => {
  test('کلمه‌ی کاملاً تازه (در هیچ seedی نیست) بدونِ یادگیری مبهم است، بعدِ «تعلیم» به همان نیت متمایل می‌شود', () => {
    // «پارکینگ» در هیچ جمله‌ی seedی نیست — بدونِ یادگیری، سیستم صادقانه
    // چیزی نمی‌داند (شاخه‌ی allUnknown). این دقیقاً شبیه‌سازیِ خروجیِ
    // teachAssistant روی DB است: بعدِ اینکه کارمند یک‌بار اصلاح کرد،
    // شمارشِ این کلمه برایِ نیتِ درست بالا می‌رود.
    const withoutLearning = classify(['پارکینگ']);
    assert.ok(withoutLearning.confidence < CONFIDENCE_THRESHOLD, 'بدونِ یادگیری باید مبهم باشد');

    const learnedVocab = { tables_now: { پارکینگ: 50 } };
    const withLearning = classify(['پارکینگ'], learnedVocab);
    assert.equal(withLearning.intent, 'tables_now');
    assert.ok(withLearning.confidence >= CONFIDENCE_THRESHOLD, 'بعدِ یادگیری باید مطمئن شود');
    assert.ok(withLearning.confidence > withoutLearning.confidence, 'اطمینان باید نسبت به قبل از یادگیری بیشتر شده باشد');
  });
});

describe('isAssistantIntent', () => {
  test('مقدارِ معتبر → true، مقدارِ دلخواه → false', () => {
    assert.equal(isAssistantIntent('busiest_day'), true);
    assert.equal(isAssistantIntent('چیزِ نامعتبر'), false);
  });
});
