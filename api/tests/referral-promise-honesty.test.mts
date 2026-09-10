// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════
//  A1-005 — وعده‌ی پاداشِ دعوت تا وقتی پرداختش وصل نشده، نمایش داده نشود
//
//  یافته: Backend Engineer (`rezv-89`)، spec در
//  `docs/audit/backend/BE-003-SPEC-referral-promise-2026-09-10.md`.
//  حکمِ CEO (`rezv-cf`) روی گزینه‌ی «ج». اجرا: مهندسِ لانچ.
//
//  ⚠️ زنجیره سرتاسر سیم‌کشی است **جز حلقه‌ی آخر**: کد ساخته می‌شود، آمار
//  نشان داده می‌شود، `createReferral` دعوت را واقعاً ثبت می‌کند — و
//  `completeReferral` که تنها پرداخت‌کننده است، **صداکننده ندارد**.
//  همان کلاسِ `cbVipPct=12` و `MERGE_UNAVAILABLE`: آرتیفکت قابلیتی را ادعا
//  می‌کند که مکانیزم ندارد. پس نرم‌کردنِ جمله رفعِ غلط بود؛ عدد باید می‌رفت.
//
//  ⚠️ **این گارد خود-بازنشسته است.** روزی که پرداخت واقعاً وصل شود، تستِ
//  دومِ همین فایل قرمز می‌شود و می‌گوید «دلیلِ A1-005 از بین رفت — متن را
//  برگردان و این گارد را بردار». گاردی که پس از رفعِ علت هم اصرار کند،
//  خودش تبدیل به مانعِ درست‌کاری می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const API_SRC = fileURLToPath(new URL('api/src/', ROOT));
const CUSTOMER = fileURLToPath(new URL('apps/customer/js/features/', ROOT));

const read = (p: string) => readFileSync(p, 'utf8');
/** فقط کد — نه نثر. کامنت‌ها عمداً وعده‌ی حذف‌شده را نقل می‌کنند. */
function codeOnly(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')       // کامنتِ HTML داخلِ تمپلیت‌ها
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); })
    .join('\n');
}

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walkTs(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** صداکننده‌های `completeReferral` در `api/src` — بدونِ خودِ تعریف. */
function completeReferralCallers(): string[] {
  const hits: string[] = [];
  for (const f of walkTs(API_SRC)) {
    const code = codeOnly(read(f));
    for (const line of code.split('\n')) {
      if (!line.includes('completeReferral')) continue;
      if (/export\s+async\s+function\s+completeReferral/.test(line)) continue;  // تعریف
      hits.push(`${relative(API_SRC, f).split('\\').join('/')}: ${line.trim()}`);
    }
  }
  return hits;
}

describe('A1-005 — وعده‌ی دعوت با مکانیزمش می‌خواند', () => {

  test('⚠️ تا وقتی پرداخت وصل نیست، هیچ عددِ پاداشی در متنِ دعوت نیست', () => {
    if (completeReferralCallers().length > 0) return;   // تستِ دوم این حالت را می‌گیرد

    for (const file of ['rewards.js', 'loyalty.js']) {
      const code = codeOnly(read(join(CUSTOMER, file)));
      // بلوکِ دعوت را می‌گیریم و در آن دنبالِ وعده‌ی عددی می‌گردیم.
      const idx = code.indexOf('دعوت');
      if (idx === -1) continue;
      assert.ok(
        !/۵۰۰\s*امتیاز|500\s*امتیاز/.test(code),
        `${file}: وعده‌ی عددیِ پاداشِ دعوت برگشته، ولی completeReferral هنوز صداکننده ندارد ` +
        '⇒ دعوت ثبت می‌شود و پاداش هرگز پرداخت نمی‌شود',
      );
    }
  });

  test('⚠️ دو آمارِ ساختاراً-همیشه-صفر رندر نمی‌شوند', () => {
    if (completeReferralCallers().length > 0) return;

    const code = codeOnly(read(join(CUSTOMER, 'rewards.js')));
    // ⚠️ spec فقط `points_earned` را نام برده بود. `completed` هم دقیقاً همان
    // است: هر دو از `status === 'rewarded'` می‌آیند و تنها نویسنده‌ی آن وضعیت
    // داخلِ `completeReferral` است. خودم شمردم و دومی را اضافه کردم.
    assert.ok(!code.includes('stats.points_earned'),
      '«امتیاز کسب‌شده» رندر می‌شود ولی ساختاراً همیشه صفر است');
    assert.ok(!code.includes('stats.completed'),
      '«موفق» هم ساختاراً همیشه صفر است — «دعوت‌شده: ۵ · موفق: ۰» تناقضِ دائمی است');
    // و آن‌که **واقعی** است باید بماند — وگرنه رفع به حذفِ فیچر تبدیل می‌شود.
    assert.ok(code.includes('stats.total_invited'),
      '«دعوت‌شده» واقعی است (createReferral ردیف می‌سازد) و نباید حذف شود',
    );
  });

  test('⚠️ جریانِ ثبتِ دعوت دست‌نخورده است — پرداختِ عقب‌افتاده ممکن بماند', () => {
    // `createReferral` ردیفِ `pending` می‌سازد و `completeReferral` روی همان
    // مچ می‌کند. اگر امروز ثبت را هم برمی‌داشتیم، دعوت‌های امروز روزی که
    // پرداخت وصل شود **قابلِ جبران نبودند**.
    const loyalty = codeOnly(read(fileURLToPath(new URL('api/src/lib/loyalty.ts', ROOT))));
    assert.match(loyalty, /export async function createReferral/, 'ثبتِ دعوت باید بماند');
    assert.match(loyalty, /status:\s*'pending'/, 'ردیفِ pending باید ساخته شود');
    const rewards = codeOnly(read(join(CUSTOMER, 'rewards.js')));
    assert.ok(rewards.includes('sendInvite'), 'دکمه‌ی ارسالِ دعوت باید بماند');
  });

  test('⚠️ خود-بازنشستگی: اگر پرداخت وصل شد، این گارد باید برداشته شود', () => {
    // ⚠️ این تست عمداً وقتی **علت از بین رفت** قرمز می‌شود، نه وقتی نقص هست.
    // گاردی که پس از رفعِ علت هم اصرار کند، خودش مانعِ درست‌کاری می‌شود —
    // و کسی که متن را برمی‌گرداند باید بداند این فایل هم باید برود.
    const callers = completeReferralCallers();
    assert.deepEqual(
      callers, [],
      'completeReferral حالا صداکننده دارد ⇒ پاداشِ دعوت واقعاً پرداخت می‌شود.\n' +
      'پس A1-005 بسته است: متنِ وعده را در rewards.js/loyalty.js برگردان، دو آمار را\n' +
      'دوباره نشان بده، و **این فایل را حذف کن**. صداکننده(ها):\n  ' + callers.join('\n  '),
    );
  });
});
