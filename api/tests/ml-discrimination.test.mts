import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  سنجه‌های تفکیک و کالیبراسیون
//
//  ⚠️ چرا اضافه شدند: تا امروز تنها سنجه‌ی مدلِ no-show، **Brier** بود.
//  Brier دو چیزِ متفاوت را قاطی می‌کند: کالیبراسیون و تفکیک. نتیجه‌اش این
//  است که یک مدلِ **کاملاً بی‌فایده** — که به همه میانگینِ نرخِ no-show را
//  می‌دهد — Brierِ قابلِ‌قبولی می‌گیرد و از گاردِ فعال‌سازی رد می‌شود، در
//  حالی که AUCش دقیقاً ۰٫۵ است و هیچ اطلاعاتی به رستوران‌دار نمی‌دهد.
//
//  سؤالِ عملیاتیِ واقعی: «امشب وقتِ تماس با ۱۰ مهمان را دارم — این ۱۰ تا
//  درست‌اند؟» این را فقط تفکیک جواب می‌دهد، نه Brier.
// ═══════════════════════════════════════════════════════════════════════

const { rocAuc, calibrationCurve, brierScore } = await import('../src/lib/ml-core');

describe('AUC — قدرتِ تفکیک', () => {

  test('تفکیکِ کامل ⇒ AUC = ۱', () => {
    assert.equal(rocAuc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1]), 1);
  });

  test('تفکیکِ کاملاً وارونه ⇒ AUC = ۰', () => {
    assert.equal(rocAuc([0.9, 0.8, 0.2, 0.1], [0, 0, 1, 1]), 0);
  });

  test('⚠️ مدلی که به همه یک عدد می‌دهد ⇒ AUC = ۰٫۵ (دقیقاً همان بی‌فایدگی)', () => {
    // این تستِ مرکزیِ فایل است: چنین مدلی Brierِ نه‌چندان بدی می‌گیرد ولی
    // صفر اطلاعات دارد. بدونِ AUC، گاردِ فعال‌سازی نمی‌تواند تشخیصش دهد.
    const preds = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
    const labels = [1, 0, 1, 0, 1, 0];
    assert.equal(rocAuc(preds, labels), 0.5, 'هم‌رتبه‌ها باید رتبه‌ی میانگین بگیرند');
    // و شاهد اینکه Brier به‌تنهایی گمراه‌کننده است:
    assert.ok(brierScore(preds, labels) < 0.3, 'Brier «قابلِ‌قبول» به‌نظر می‌رسد');
  });

  test('تفکیکِ نسبی ⇒ AUC بینِ ۰٫۵ و ۱', () => {
    const auc = rocAuc([0.2, 0.6, 0.4, 0.9], [0, 1, 0, 1])!;
    assert.ok(auc > 0.5 && auc <= 1, `انتظارِ (۰٫۵، ۱]، شد ${auc}`);
  });

  test('🔴 تک‌کلاسه ⇒ null، نه صفر (قاعده‌ی ML_CONTRACT)', () => {
    // «کمبودِ شواهد یعنی insufficient_data، نه صفر.» AUC روی داده‌ی
    // تک‌کلاسه **تعریف‌نشده** است؛ صفر یعنی «تفکیکِ وارونه» که ادعایی است
    // که نداریم.
    assert.equal(rocAuc([0.1, 0.5, 0.9], [0, 0, 0]), null, 'همه منفی');
    assert.equal(rocAuc([0.1, 0.5, 0.9], [1, 1, 1]), null, 'همه مثبت');
    assert.equal(rocAuc([], []), null, 'خالی');
  });

  test('طولِ ناهماهنگ خطا می‌دهد، نه نتیجه‌ی بی‌معنا', () => {
    assert.throws(() => rocAuc([0.1, 0.2], [1]), /طول/);
  });

  test('روی ۲۰۰۰ نمونه هم درست و سریع کار می‌کند', () => {
    // کنترلِ کارایی: پیاده‌سازیِ زوجیِ O(n²) اینجا کند می‌شد.
    const n = 2000;
    const preds: number[] = []; const labels: number[] = [];
    for (let i = 0; i < n; i++) {
      const isPos = i % 3 === 0;
      labels.push(isPos ? 1 : 0);
      preds.push(isPos ? 0.5 + (i % 100) / 400 : (i % 100) / 400);
    }
    const t0 = Date.now();
    const auc = rocAuc(preds, labels)!;
    assert.ok(Date.now() - t0 < 500, 'باید زیرِ نیم‌ثانیه باشد');
    assert.ok(auc > 0.9, `تفکیکِ قوی انتظار می‌رفت، شد ${auc}`);
  });
});

describe('منحنیِ کالیبراسیون', () => {

  test('مدلِ کاملاً کالیبره ⇒ predicted ≈ observed در هر سطل', () => {
    const preds: number[] = []; const labels: number[] = [];
    // در سطلِ ۰٫۸: از هر ۱۰ تا، ۸ تا مثبت
    for (let i = 0; i < 100; i++) { preds.push(0.85); labels.push(i % 10 < 8 ? 1 : 0); }
    const [b] = calibrationCurve(preds, labels);
    assert.ok(Math.abs(b.predicted - b.observed) < 0.06,
      `کالیبره: پیش‌بینی ${b.predicted} در برابرِ واقعی ${b.observed}`);
  });

  test('🔴 مدلِ بیش‌ازحد مطمئن آشکار می‌شود', () => {
    // مدل می‌گوید ۹۵٪ ولی واقعیت ۳۰٪ است — Brier این را به‌عنوانِ یک عددِ
    // خلاصه می‌بلعد، ولی منحنی دقیقاً نشان می‌دهد کجا اریب است.
    const preds = Array(100).fill(0.95);
    const labels = Array.from({ length: 100 }, (_, i) => (i % 10 < 3 ? 1 : 0));
    const [b] = calibrationCurve(preds, labels);
    assert.ok(b.predicted - b.observed > 0.5, 'اریبیِ بزرگ باید دیده شود');
  });

  test('سطلِ خالی گزارش نمی‌شود (نه observed: 0)', () => {
    // گزارشِ صفر برای سطلی که نمونه ندارد، ادعای اندازه‌گیری‌نشده است.
    const curve = calibrationCurve([0.95, 0.96], [1, 1], 10);
    assert.equal(curve.length, 1, 'فقط سطلی که داده دارد');
    assert.equal(curve[0].n, 2);
  });

  test('کنترلِ منفی: مجموعِ n سطل‌ها با کلِ نمونه‌ها می‌خواند', () => {
    // بدونِ این، یک باگِ سطل‌بندی می‌توانست نمونه‌ها را بی‌صدا گم کند.
    const preds = Array.from({ length: 57 }, (_, i) => i / 57);
    const labels = preds.map((p) => (p > 0.5 ? 1 : 0));
    const total = calibrationCurve(preds, labels).reduce((s, b) => s + b.n, 0);
    assert.equal(total, 57);
  });
});
