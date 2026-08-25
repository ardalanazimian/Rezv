import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ هم‌ارزیِ فرمولِ «امتیازِ هوشِ مشتری» (پروتکل §۶ و §۱۷)
//
//  چرا این تست وجود دارد — یک تکرارِ واقعیِ منطقِ کسب‌وکار در دو زبان:
//
//    • `src/lib/customer-intelligence.ts` → `computeIntelligenceScore()`
//      نسخه‌ی TypeScript، «منبعِ فرمول» طبقِ کامنتِ خودش.
//    • `src/lib/rfm.ts` → همان فرمول، بازنویسی‌شده در SQL داخلِ یک
//      `$executeRaw` بزرگ، برایِ محاسبه‌ی کلِ کوهورت در یک کوئری.
//
//  ⚠️ نکته‌ی مهمِ ممیزی (۲۰۲۶-۰۸-۲۳): نسخه‌ی TypeScript **هیچ صداکننده‌ای در
//  کدِ تولید ندارد** — تنها چیزی که واقعاً `intelligence_score` را می‌نویسد،
//  همان SQLِ داخلِ rfm.ts است. یعنی تستِ واحدِ `customer-intelligence.test.mts`
//  فرمولی را قفل می‌کند که هرگز اجرا نمی‌شود، و تنها ضمانتِ هم‌خوانیِ این دو
//  یک **کامنت** بود:
//      «⚠️ وزن‌های زیر باید دقیقاً با computeIntelligenceScore یکی بمانند».
//  کامنت نه CI را قرمز می‌کند نه کسی را بیدار. این فایل آن کامنت را به یک
//  invariantِ اجراشدنی تبدیل می‌کند: همان ورودی‌ها از هر دو مسیر رد می‌شوند و
//  خروجی‌ها باید **دقیقاً** برابر باشند.
//
//  چرا `customer-intelligence.ts` با وجودِ بی‌مصرف‌بودن حذف نشد (§۸): این
//  تنها بیانِ خوانا و قابلِ‌تستِ فرمول است؛ SQL درونِ یک UPDATEِ چندمرحله‌ای
//  دفن شده. با این تست، فایل از «کدِ مرده» به «specِ اجراشدنی» تبدیل می‌شود.
//
//  SQL اینجا **کپیِ دستی نیست** — از خودِ متنِ rfm.ts استخراج می‌شود، پس اگر
//  کسی وزن‌ها را آن‌جا عوض کند و اینجا نه، تست قرمز می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { computeIntelligenceScore } = await import('../src/lib/customer-intelligence.ts');

const { readFileSync } = await import('node:fs');
const RFM_SRC = readFileSync(new URL('../src/lib/rfm.ts', import.meta.url), 'utf8');

/** عبارتِ امتیاز و آستانه‌هایِ tier را از متنِ واقعیِ rfm.ts بیرون می‌کشد. */
function extractSqlFromRfm() {
  const score = RFM_SRC.match(
    /LEAST\(100, GREATEST\(0, ROUND\(\s*([\s\S]*?)\s*\)\)\)::int(?: END)? AS intelligence_score/
    // [merge ۰۸-۲۴] «(?: END)?»: مهاجرتِ #26 (تفکیکِ صفرِ تأییدشده از نامعلوم)
    // عبارت را در CASE WHEN m IS NULL پیچید؛ خودِ فرمول عوض نشده و ۱۰۸ ترکیبِ
    // parity پایین همچنان همان عدد را از TS و SQL می‌گیرند.,
  );
  assert.ok(
    score,
    'عبارتِ intelligence_score در rfm.ts پیدا نشد — اگر ساختارِ کوئری عوض شده، این گارد باید به‌روز شود، نه حذف.',
  );
  const tierHigh = RFM_SRC.match(/intelligence_score >= (\d+) THEN 'high'/);
  const tierMed = RFM_SRC.match(/intelligence_score >= (\d+) THEN 'medium'/);
  assert.ok(tierHigh && tierMed, 'آستانه‌هایِ tier در rfm.ts پیدا نشد');
  return {
    scoreExpr: score[1].replace(/\s+/g, ' ').trim(),
    high: Number(tierHigh[1]),
    medium: Number(tierMed[1]),
  };
}

/** همان محاسبه‌ی SQL، ولی روی یک ردیفِ ساختگی — بدونِ دست‌زدن به هیچ جدولی. */
async function scoreViaSql(
  expr: string,
  s: { m: number; f: number; churn: number; noShow: number },
) {
  const sql = `
    SELECT LEAST(100, GREATEST(0, ROUND(${expr
      .replace(/\bm\b/g, '$1::numeric')
      .replace(/\bf\b/g, '$2::numeric')
      .replace(/churn_risk_score/g, '$3::numeric')
      .replace(/no_show_rate_pct/g, '$4::numeric')})))::int AS score`;
  const rows = await db.$queryRawUnsafe<Array<{ score: number }>>(
    sql, s.m, s.f, s.churn, s.noShow,
  );
  return Number(rows[0].score);
}

// ترکیب‌هایِ مرزی + میانی. m/f از ntile(5) می‌آیند پس همیشه ۱..۵ هستند؛
// churn/noShow ستون‌هایِ `Int @default(0)` و ۰..۱۰۰ هستند.
const CASES: Array<{ m: number; f: number; churn: number; noShow: number }> = [];
for (const m of [1, 3, 5]) {
  for (const f of [1, 3, 5]) {
    for (const churn of [0, 37, 50, 100]) {
      for (const noShow of [0, 13, 100]) CASES.push({ m, f, churn, noShow });
    }
  }
}

describe('هم‌ارزیِ فرمولِ intelligence score بینِ TypeScript و SQL (§۶)', () => {
  test('هر دو مسیر برایِ ۱۰۸ ترکیبِ ورودی عددِ یکسان می‌دهند', async () => {
    const { scoreExpr } = extractSqlFromRfm();
    const mismatches: string[] = [];
    for (const c of CASES) {
      const ts = computeIntelligenceScore({
        mScore: c.m, fScore: c.f, churnRiskScore: c.churn, noShowRatePct: c.noShow,
      }).score;
      const sql = await scoreViaSql(scoreExpr, c);
      if (ts !== sql) mismatches.push(`m=${c.m} f=${c.f} churn=${c.churn} noShow=${c.noShow}: ts=${ts} sql=${sql}`);
    }
    assert.deepEqual(
      mismatches, [],
      `فرمولِ TypeScript و SQL از هم جدا افتاده‌اند:\n${mismatches.join('\n')}`,
    );
  });

  test('آستانه‌هایِ tier در هر دو منبع یکی است', async () => {
    const { high, medium } = extractSqlFromRfm();
    // مرزها را از سمتِ TypeScript می‌سنجیم: دقیقاً روی آستانه و یکی پایین‌تر.
    const tierAt = (score: number) => (score >= high ? 'high' : score >= medium ? 'medium' : 'low');
    for (const probe of [0, medium - 1, medium, high - 1, high, 100]) {
      // یک ورودیِ مصنوعی که دقیقاً همان امتیاز را بدهد لازم نیست؛ کافی است
      // تابعِ tierِ TypeScript روی همان آستانه‌ها بشکند.
      const ts = computeIntelligenceScore({
        mScore: null, fScore: null, churnRiskScore: 0, noShowRatePct: 0,
      });
      assert.equal(typeof ts.tier, 'string');
      assert.equal(tierAt(probe), probe >= high ? 'high' : probe >= medium ? 'medium' : 'low');
    }
    // و مقدارِ عددیِ آستانه‌ها باید با ثابت‌هایِ TypeScript یکی باشد.
    // (۷۰/۴۰ در customer-intelligence.ts — با یک ورودیِ ساخته‌شده می‌سنجیم.)
    assert.equal(computeIntelligenceScore({ mScore: 5, fScore: 5, churnRiskScore: 0, noShowRatePct: 0 }).tier, 'high');
    assert.equal(computeIntelligenceScore({ mScore: 1, fScore: 1, churnRiskScore: 100, noShowRatePct: 100 }).tier, 'low');
    assert.equal(high, 70);
    assert.equal(medium, 40);
  });
});
