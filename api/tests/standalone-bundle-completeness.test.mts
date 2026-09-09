// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

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

/** ورودی‌های CUSTOMER_ORDER از خودِ اسکریپتِ ساخت — نه یک رونوشتِ دستی. */
function customerOrder(): string[] {
  const src = readFileSync(BUILDER, 'utf8');
  const start = src.indexOf('CUSTOMER_ORDER = [');
  assert.notEqual(start, -1, 'CUSTOMER_ORDER در build-standalone.py پیدا نشد — نامش عوض شده؟');
  const end = src.indexOf(']', start);
  const block = src.slice(start, end);
  return [...block.matchAll(/'([^']+\.js)'/g)].map((m) => m[1]);
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
