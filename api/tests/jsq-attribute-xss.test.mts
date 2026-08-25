import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ آسیب‌پذیریِ واقعیِ ۲۰۲۶-۰۸-۲۵ — Stored XSS از راهِ رشته‌ی JS
//  داخلِ attributeِ HTML.
//
//  باگ: الگویِ `onclick="f('${esc(x)}')"` امن **نیست**. پارسرِ HTML مقدارِ
//  attribute را پیش از پارسرِ JS رمزگشایی می‌کند، پس `&#39;`ی که esc ساخته
//  دوباره به `'` برمی‌گردد و رشته‌ی JS را می‌بندد:
//      نامِ مهمان = x');alert(1)//   →   f('x');alert(1)//')
//  هر مهمانی می‌توانست با نامِ ساختگی رزرو کند و در مرورگرِ **کارکنانِ
//  رستوران** کد اجرا کند → سرقتِ توکن → تصرفِ تنانت.
//
//  رفع: jsq() که اول JSON.stringify (رشته‌ی JS) و بعد esc (HTML) می‌زند.
//
//  این فایل دو چیز را قفل می‌کند:
//    ۱) خودِ jsq واقعاً تزریق را می‌بندد و داده را بی‌اتلاف برمی‌گرداند.
//    ۲) هیچ فایلی در سه اپ دوباره الگویِ قدیمی را برنگرداند (گاردِ ایستا).
// ═══════════════════════════════════════════════════════════════════════
const { esc, jsq } = await import('../../shared/js/format.js');

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** رمزگشاییِ موجودیت‌ها — همان کاری که پارسرِ HTML روی مقدارِ attribute می‌کند. */
const htmlDecode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
   .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const PAYLOADS = [
  `x');alert(1)//`,
  `x");alert(1)//`,
  `x\\');alert(1)//`,
  `'; window.__PWNED=1; //`,
  `"><img src=x onerror=alert(1)>`,
  `</script><script>alert(1)</script>`,
  `نامِ فارسی' + alert(1) + '`,
  `a\nb`,
  `\\`,
];

describe('jsq — رشته‌ی JS داخلِ attribute (رگرسیونِ XSS)', () => {
  test('⚠️ کنترلِ مثبت: الگویِ قدیمیِ esc واقعاً تزریق‌پذیر است', () => {
    // اگر این روزی بشکند یعنی esc عوض شده و کلِ فرضِ این فایل باید بازبینی شود.
    const broken = htmlDecode(`f('${esc(`x');alert(1)//`)}')`);
    assert.equal(broken, `f('x');alert(1)//')`,
      'الگویِ قدیمی باید رشته‌ی JS را ببندد — این کنترلِ مثبتِ تست است');
  });

  for (const p of PAYLOADS) {
    test(`payload بی‌اثر و بی‌اتلاف می‌شود: ${JSON.stringify(p).slice(0, 34)}`, () => {
      const code = htmlDecode(`f(${jsq(p)})`);
      // باید دقیقاً یک فراخوانی با یک literal باشد و همان مقدار را برگرداند.
      const got = new Function('f', `return ${code}`)((v: string) => v);
      assert.equal(got, p, 'jsq باید مقدار را بی‌اتلاف برگرداند');
    });
  }

  test('null/undefined به رشته‌ی خالیِ امن تبدیل می‌شوند', () => {
    for (const v of [null, undefined]) {
      const code = htmlDecode(`f(${jsq(v as never)})`);
      const got = new Function('f', `return ${code}`)((x: string) => x);
      assert.equal(got, '');
    }
  });
});

// ── گاردِ ایستا: الگویِ قدیمی نباید برگردد ──────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

describe('گاردِ ایستا — الگویِ رشته‌ی JS داخلِ attribute برنگردد', () => {
  test('هیچ فایلی در سه اپ الگویِ on*="f(\'${...}\')" ندارد', () => {
    const files = ['customer', 'business', 'company']
      .flatMap(a => walk(join(ROOT, 'apps', a, 'js')));
    assert.ok(files.length > 40, `انتظارِ ده‌ها فایل، ${files.length} پیدا شد — مسیر عوض شده؟`);

    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // کامنت‌های بلوکی (که عمداً مثالِ الگویِ بد دارند) حذف می‌شوند.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of code.matchAll(/on[a-z]+="[^"]*\('\$\{/g)) {
        const line = code.slice(0, m.index).split('\n').length;
        offenders.push(`${relative(ROOT, f)}:${line}`);
      }
    }
    assert.deepEqual(offenders, [],
      'از jsq() استفاده کن نه \'${esc(...)}\' — رجوع کن به کامنتِ jsq در shared/js/format.js');
  });
});
