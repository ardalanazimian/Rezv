import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ نسب‌نامه‌ی ریسکِ no-show (یافته‌ی ۳ی ممیزیِ لایه‌ی هوش، مهاجرتِ ۰۸۰)
//
//  باگی که این تست پین می‌کند: `reservations` امتیاز و ردهٔ ریسک را نگه
//  می‌داشت ولی **منبع** را نه — در حالی که پیش‌بینی‌کننده منبع را می‌دانست و
//  حتی در دفترِ پیش‌بینی می‌نوشت (lib/reservations.ts:448). نتیجه: دو
//  مصرف‌کننده (`/api/v1/restaurant/ai` و پاسخِ دستیار) یک عددِ بی‌برچسب را
//  زیرِ سطحی که «هوشمند» خوانده می‌شود به‌عنوانِ دانش نمایش می‌دادند.
//
//  ادعای اصلی اینجا یک ادعای **صداقت** است، نه یک ادعای شِما:
//  «وقتی هیچ ردیفی از مدل نیامده، متنِ نمایشی حق ندارد بویِ مدل بدهد.»
//  به همین دلیل بندِ ۱ روی *معنا* ادعا می‌کند نه روی برابریِ رشته — یک
//  رگرسیونِ واقعی، متن را کمی عوض می‌کند، نه اینکه کلِ تابع را حذف کند.
// ═══════════════════════════════════════════════════════════════════════

const { provenanceLabel, countUpcomingHighRiskByProvenance } = await import('../src/lib/no-show-provenance.ts');
const { db } = await import('../src/lib/db.ts');

/** هر واژه‌ای که به مخاطب القا کند عدد را یک مدل تولید کرده. */
const MODEL_CLAIM = /مدل|هوش|یادگرفت|آموزش‌دیده|یادگیری/;

describe('نسب‌نامه‌ی ریسکِ no-show (P0-ML-3)', () => {
  test('وقتی هیچ ردیفی از مدل نیامده، برچسب هرگز ادعای مدل نمی‌کند', () => {
    const noModelCases = [
      { total: 3, learned: 0, heuristic: 3, unknown: 0 },
      { total: 4, learned: 0, heuristic: 0, unknown: 4 },
      { total: 5, learned: 0, heuristic: 2, unknown: 3 },
    ];
    // نبودِ موضوع باید خطا باشد، نه عبور (قاعده‌ی ۵ CLAUDE.md).
    assert.ok(noModelCases.length > 0, 'هیچ حالتی برای سنجش ساخته نشد — گاردِ توخالی');

    for (const c of noModelCases) {
      const label = provenanceLabel(c);
      assert.notEqual(label, '', `برچسبِ خالی برای ${JSON.stringify(c)} — کاربر هیچ نسب‌نامه‌ای نمی‌بیند`);
      assert.doesNotMatch(
        label,
        MODEL_CLAIM,
        `برچسب برای ${JSON.stringify(c)} واژه‌ی مدل را کنارِ عدد نشاند در حالی که learned=0 → «${label}»`,
      );
    }
  });

  test('وقتی همه از مدل آمده‌اند، برچسب صریحاً همان را می‌گوید', () => {
    const label = provenanceLabel({ total: 7, learned: 7, heuristic: 0, unknown: 0 });
    assert.match(label, MODEL_CLAIM, 'ردیف‌های learned باید صریحاً به مدل نسبت داده شوند');
  });

  test('حالتِ ترکیبی هر سه سطل را با عددِ خودشان گزارش می‌کند', () => {
    const label = provenanceLabel({ total: 6, learned: 3, heuristic: 2, unknown: 1 });
    for (const n of ['3', '2', '1']) {
      assert.ok(label.includes(n), `عددِ ${n} در برچسبِ ترکیبی گم شد → «${label}»`);
    }
  });

  test('total صفر یعنی هیچ برچسبی نباید ساخته شود', () => {
    assert.equal(provenanceLabel({ total: 0, learned: 0, heuristic: 0, unknown: 0 }), '');
  });

  test('ستونِ no_show_risk_source وجود دارد و CHECK مقدارِ نامعتبر را رد می‌کند', async () => {
    const cols = await db.$queryRaw<{ column_name: string; is_nullable: string }[]>`
      SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'reservations'
         AND column_name = 'no_show_risk_source'
    `;
    assert.equal(cols.length, 1, 'ستونِ no_show_risk_source روی reservations وجود ندارد — مهاجرتِ ۰۸۰ اعمال نشده');
    assert.equal(cols[0].is_nullable, 'YES', 'باید NULL بپذیرد: ردیف‌های تاریخی منبعشان واقعاً نامعلوم است');

    const checks = await db.$queryRaw<{ constraint_name: string }[]>`
      SELECT constraint_name FROM information_schema.check_constraints
       WHERE constraint_name = 'reservations_no_show_risk_source_check'
    `;
    assert.equal(checks.length, 1, 'CHECKِ مقادیرِ مجاز وجود ندارد — هر رشته‌ای قابلِ درج می‌شود');
  });

  test('شمارشگر روی DBِ واقعی اجرا می‌شود و شکلِ درست برمی‌گرداند', async () => {
    const r = await countUpcomingHighRiskByProvenance('00000000-0000-0000-0000-000000000000', 48);
    assert.deepEqual(r, { total: 0, learned: 0, heuristic: 0, unknown: 0 });
    assert.equal(r.learned + r.heuristic + r.unknown, r.total, 'سه سطل باید همیشه جمعشان total شود');
  });
});
