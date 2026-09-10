// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// ═══════════════════════════════════════════════════════════════════════
//  بسته‌ی standalone باید هر ماژولی را که اپِ کاستومر import می‌کند داشته باشد
//
//  ⚠️ چرا این فایل نوشته شد — یک خرابیِ **واقعی که خودم ساختمش** (۲۰۲۶-۰۹-۰۹):
//  `apps/customer/js/api-errors.js` را اضافه کردم و `data/booking.js` ازش
//  `bookingErrorKind` را import کرد، ولی فایل به `CUSTOMER_ORDER` در
//  `tools/build-standalone.py` اضافه نشد. نتیجه:
//    • باندل با موفقیت ساخته شد
//    • گیتِ تازگی (`build-standalone.py --check`) **سبز** ماند
//    • و `standalone/customer.html` تابعی را صدا می‌زد که در آن هرگز تعریف
//      نشده بود ⇒ `ReferenceError` زنده روی مسیرِ خطای رزرو
//
//  یعنی بسته‌ای که «به‌روز» اعلام می‌شود ولی در زمانِ اجرا می‌ترکد — بدتر از
//  بسته‌ی کهنه، چون گیت تأییدش می‌کند.
//
//  ⚠️ و این **بارِ دومی** است که همین کلاس رخ می‌دهد: سرآیندِ خودِ
//  `build-standalone.py` رخدادِ قبلی را مستند کرده —
//  «`ReferenceError: httpJson is not defined` … چون api.js از api-core.js
//  می‌خواندش و api-core.js اصلاً در باندل نبود» — و آن بار با یک مقایسه‌ی
//  **دستی** رفع شد. مقایسه‌ی دستی تکرارشدنی نیست؛ این تست هست.
//
//  گیتِ تازگی این را نمی‌گیرد چون فقط می‌پرسد «خروجی با ورودی هم‌خوان است؟»
//  و ورودیِ ناقص، خروجیِ ناقصِ هم‌خوان می‌دهد.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const BUILDER = fileURLToPath(new URL('tools/build-standalone.py', ROOT));
const CUSTOMER_JS = fileURLToPath(new URL('apps/customer/js/', ROOT));

/**
 * فهرستِ واقعیِ ماژول‌های باندل — **از خودِ برنامه پرسیده می‌شود**، نه از
 * متنش خوانده.
 *
 * ⚠️ FG-12 (یافته‌ی رد تیم، ۲۰۲۶-۰۹-۱۰) — نسخه‌ی قبلی متنِ
 * `build-standalone.py` را regex می‌زد، و یک **کامنت** می‌توانست ماژولی را
 * در چشمِ این گارد ثبت کند بدونِ آنکه در باندل باشد. خودم بازتولیدش کردم:
 *
 *     حذفِ `'js/api-errors.js'` از فهرست        →  exit 1  (گارد کار می‌کرد)
 *     همان حذف + کامنتی که نامش را ببرد         →  exit 0  ← **خلع‌سلاح**
 *
 * و ماژولی که خلع‌سلاحش می‌کرد همانی است که نبودنش دیروز یک
 * `ReferenceError`ِ زنده در باندلِ آفلاین ساخت (`FIX-STANDALONE-BUNDLE-REGRESSION`).
 *
 * ⚠️ چرا `--print-order` و نه «آن کامنت را پاک کن»: پاک‌کردنِ کامنت فقط
 * **نمونه** را می‌بست. پرسیدن از برنامه **کلاس** را می‌بندد — کامنت،
 * کوتیشنِ تک/دوگانه، فهرستِ چندخطی و هر شکلِ دیگرِ نوشتن از قرارداد بیرون
 * می‌روند. گارد حالا همان مقداری را می‌بیند که باندل واقعاً از آن ساخته
 * می‌شود.
 */
function customerOrder(): string[] {
  const r = spawnSync('python', [BUILDER, '--print-order'], { encoding: 'utf8' });
  // ⚠️ کدِ خروج **خوانده** می‌شود. اگر اسکریپت بترکد، فهرستِ خالی برمی‌گشت و
  // این گارد «هیچ ماژولی گم نیست» می‌گفت — یعنی سبزی که نمی‌تواند بیفتد.
  assert.equal(r.status, 0,
    `build-standalone.py --print-order شکست خورد (${r.status}): ${r.stderr || r.stdout}`);
  const list = r.stdout.split('\n').map((l) => l.trim()).filter((l) => l.endsWith('.js'));
  assert.ok(list.length > 10,
    `فقط ${list.length} ماژول برگشت — روشِ پرسیدن شکسته است، نه اینکه باندل خالی باشد`);
  return list;
}

function walkJs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walkJs(p));
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

describe('بسته‌ی standalone — کاملبودنِ ماژول‌ها', () => {

  test('⚠️ هر ماژولِ محلی که اپِ کاستومر import می‌کند در CUSTOMER_ORDER هست', () => {
    const order = new Set(customerOrder());
    const missing = new Set<string>();

    for (const file of walkJs(CUSTOMER_JS)) {
      const src = readFileSync(file, 'utf8');
      // فقط importهای نسبی (ماژولِ محلی). importِ بسته‌ی خارجی وجود ندارد،
      // ولی اگر روزی بیاید نباید اینجا false-positive بسازد.
      for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
        const spec = m[1];
        const abs = resolve(dirname(file), spec);
        if (!existsSync(abs)) continue; // importِ شکسته کارِ تستِ دیگری است
        const rel = 'js/' + relative(CUSTOMER_JS, abs).split('\\').join('/');
        if (!order.has(rel)) missing.add(`${rel}  ← import شده در ${relative(CUSTOMER_JS, file).split('\\').join('/')}`);
      }
    }

    assert.deepEqual(
      [...missing], [],
      'این ماژول‌ها import می‌شوند ولی در باندلِ standalone نیستند ⇒ باندل ساخته می‌شود، ' +
      'گیتِ تازگی سبز می‌ماند، و در زمانِ اجرا ReferenceError می‌دهد:\n  ' + [...missing].join('\n  '),
    );
  });

  test('⚠️ هیچ ورودیِ CUSTOMER_ORDER به فایلِ ناموجود اشاره نمی‌کند', () => {
    // ورودیِ کهنه یعنی اسکریپتی که فکر می‌کند چیزی را باندل کرده و نکرده.
    const ghosts = customerOrder().filter((rel) => {
      const abs = join(CUSTOMER_JS, rel.replace(/^js\//, ''));
      return !existsSync(abs);
    });
    assert.deepEqual(ghosts, [], `ورودیِ CUSTOMER_ORDER بدونِ فایل: ${ghosts.join(', ')}`);
  });
});
