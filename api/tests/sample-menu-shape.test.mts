// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  DS-006 §۴ — آیتمِ منویِ نمونه همان شکلی را دارد که رندرکننده می‌خواهد
//
//  یافته: طراح (`rezv-e6`)، بازتولیدشده در **DOM** با Playwright روی باندلِ
//  آفلاین — هر چهار آیتمِ منویِ اولین رستورانِ نمونه:
//      .menu-emoji ""   ·   .menu-name ""   ·   .menu-price "undefined تومان"
//  یعنی هر سه فیلد. قیمت تنها چیزی بود که **دیده** می‌شد، چون `esc(m.n)`
//  مقدارِ undefined را رشته‌ی خالی می‌کند ولی قیمت خام درج می‌شود.
//
//  ⚠️ دو تشخیصِ غلط پیش از تشخیصِ درست — هر دو ثبت می‌شوند چون درسِ اصلی
//  همان‌جاست:
//    ۱) اسپکِ اولیه می‌گفت «۶ آیتمِ بی‌قیمت در seed.js». من مستقل سنجیدم و
//       regexِ خودم هم **دقیقاً همان ۶** را داد — ولی آن‌ها جفت‌های vibe/tag
//       بودند، نه آیتمِ منو. هر ۲۴ آیتمِ منو قیمت دارند. **عددِ یکسان از دو
//       جای متفاوت، خطرناک‌ترین شکلِ تأیید است.**
//    ۲) رفعِ وسوسه‌انگیز، یک گاردِ قیمت در `detail.js:128` بود. آن فقط نشانه
//       را خفه می‌کرد: آیتم همچنان بی‌نام و بی‌ایموجی می‌ماند.
//
//  ⚠️ و ناوردا عمداً روی **خروجیِ ماژول** است، نه روی متنِ `seed.js`. طراح
//  همین را تصحیح کرد و درست بود: ناوردا روی آرایه‌های خامِ منبع **امروز هم
//  سبز است** (۲۴/۲۴ قیمت دارند) و هیچ‌وقت این نقص را نمی‌گرفت. چیزی که خراب
//  بود **شکل** بود نه مقدار، و شکل فقط پس از عبور از مرزِ seed→R دیده می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8');

type MenuItem = { e?: unknown; n?: unknown; p?: unknown };
type Rest = { id?: unknown; n?: unknown; menu?: unknown };

/** `seed.js` را **واقعاً** import می‌کند — بدونِ وابستگی، پس در Node بار می‌شود. */
async function sample(): Promise<Rest[]> {
  const mod = await import(new URL('apps/customer/js/data/seed.js', ROOT).href);
  return mod.R_SAMPLE as Rest[];
}

describe('DS-006 §۴ — شکلِ آیتمِ منویِ نمونه', () => {

  test('⚠️ هر آیتمِ منو شیءِ نرمال است، نه آرایه‌ی خام', async () => {
    const rows = await sample();
    assert.ok(rows.length > 0, 'R_SAMPLE خالی است — این تست بی‌معنا می‌شود');
    let checked = 0;
    for (const r of rows) {
      if (!Array.isArray(r.menu)) continue;
      for (const m of r.menu as MenuItem[]) {
        checked++;
        assert.ok(!Array.isArray(m),
          `آیتمِ منویِ «${String(r.n)}» هنوز آرایه‌ی خام است ⇒ menuItemHTML سه‌تا undefined می‌گیرد`);
        assert.equal(typeof m, 'object', 'آیتم باید شیء باشد');
      }
    }
    assert.ok(checked > 0, 'هیچ آیتمِ منویی بررسی نشد — ناوردا توخالی است');
  });

  test('⚠️ سه فیلدی که رندرکننده می‌خواند واقعاً پرند', async () => {
    // `menuItemHTML` این سه را می‌خواند: m.e (ایموجی)، m.n (نام)، m.p (قیمت).
    // هر کدام که خالی باشد، همان صفحه‌ی خالیِ گزارش‌شده را می‌سازد.
    const rows = await sample();
    for (const r of rows) {
      if (!Array.isArray(r.menu)) continue;
      for (const m of r.menu as MenuItem[]) {
        const where = `منویِ «${String(r.n)}»`;
        assert.equal(typeof m.n, 'string', `${where}: نام باید رشته باشد`);
        assert.ok(String(m.n).trim().length > 0, `${where}: نامِ خالی`);
        assert.ok(m.p !== undefined && m.p !== null && String(m.p).trim().length > 0,
          `${where}: قیمتِ خالی ⇒ «undefined تومان» به کاربر نشان داده می‌شود`);
        assert.ok(String(m.e ?? '').trim().length > 0, `${where}: ایموجیِ خالی`);
      }
    }
  });

  test('⚠️ یک پیاده‌سازی، نه دو (§۲۲)', () => {
    // اگر `api.js` دوباره نسخه‌ی خودش را تعریف کند، دو شکل از یک قرارداد
    // پیدا می‌شود و همین نقص از مسیرِ دیگری برمی‌گردد.
    const api = read('apps/customer/js/api.js');
    assert.ok(!/function\s+normalizeMenuEntry\s*\(/.test(api),
      'api.js دوباره normalizeMenuEntry را تعریف کرده — باید از data/seed.js بگیرد');
    assert.match(api, /import\s*\{[^}]*normalizeMenuEntry[^}]*\}\s*from\s*'\.\/data\/seed\.js'/,
      'api.js باید همان تابع را import کند');
    const seed = read('apps/customer/js/data/seed.js');
    assert.match(seed, /export function normalizeMenuEntry/, 'تعریف باید در seed.js باشد');
  });

  test('⚠️ نرمال‌ساز خودتوان است — map دوباره چیزی را خراب نمی‌کند', async () => {
    // `mapApiRestaurant` روی همین آیتم‌ها دوباره map می‌کند؛ اگر خودتوان
    // نبود، بارِ دوم شکل را می‌شکست.
    const mod = await import(new URL('apps/customer/js/data/seed.js', ROOT).href);
    const norm = mod.normalizeMenuEntry as (m: unknown) => unknown;
    const once = norm(['🍝', 'پاستا', '۱۸۵٬۰۰۰']) as MenuItem;
    const twice = norm(once) as MenuItem;
    assert.deepEqual(twice, once, 'اعمالِ دوباره باید بی‌اثر باشد');
    assert.equal(once.n, 'پاستا');
    assert.equal(once.p, '۱۸۵٬۰۰۰');
  });
});
