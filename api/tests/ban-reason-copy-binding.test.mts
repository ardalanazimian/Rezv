// ═══════════════════════════════════════════════════════════════════════
//  اتصالِ دلیلِ عمومیِ بن: enumِ DB ↔ جمله‌ی اپِ مشتری ↔ برچسبِ پنلِ شرکت (F003 · STATE M-14)
//
//  چرا: پنج کلیدِ `BanReasonKey` سه جا زندگی می‌کنند — enumِ Prisma (منبع)، `BAN_REASON_FA` در
//  `apps/customer/js/auth.js` (همان جمله‌ای که کاربرِ بن‌شده می‌خواند)، و `BAN_REASON_OPTIONS` در
//  `apps/company/js/intelligence.js` (همان جمله‌ای که ادمین هنگامِ بن انتخاب می‌کند). اپ‌ها build
//  ندارند و نمی‌توانند از یک ماژولِ مشترک import کنند، پس نسخه‌ی دوم ناگزیر است — و نسخه‌ی دومِ
//  بی‌گارد روزی واگرا می‌شود. آن‌وقت ادمین «به درخواستِ خودت» را انتخاب می‌کند و کاربر جمله‌ی دیگری
//  می‌خواند، یا کلیدِ تازه‌ی enum در اپ «دلیلی ثبت نشده» نشان داده می‌شود.
//
//  ادعا: هر سه دقیقاً همان مجموعه‌ی کلید را دارند، و جمله‌ی هر کلید در دو اپ بایت‌به‌بایت یکی است.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { BanReasonKey } = await import('@prisma/client');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** بلوکِ متنیِ یک ثابت را از منبع بیرون می‌کشد؛ نبودنش خطاست، نه عبور. */
function block(src: string, open: RegExp, close: string, where: string): string {
  const m = open.exec(src);
  assert.ok(m, `ثابت در ${where} پیدا نشد — اگر نامش عوض شده، این گارد را هم به‌روز کن`);
  const start = m.index + m[0].length;
  const end = src.indexOf(close, start);
  assert.ok(end > start, `پایانِ بلوک در ${where} پیدا نشد`);
  return src.slice(start, end);
}

function customerMap(): Map<string, string> {
  const body = block(read('apps/customer/js/auth.js'), /const BAN_REASON_FA = \{/, '};', 'auth.js');
  const out = new Map<string, string>();
  for (const m of body.matchAll(/^\s*([a-z_]+):\s*'([^']*)',?\s*$/gm)) out.set(m[1], m[2]);
  return out;
}

function companyMap(): Map<string, string> {
  const body = block(read('apps/company/js/intelligence.js'), /const BAN_REASON_OPTIONS=\[/, '];', 'intelligence.js');
  const out = new Map<string, string>();
  for (const m of body.matchAll(/\['([a-z_]+)','([^']*)'\]/g)) out.set(m[1], m[2]);
  return out;
}

describe('دلیلِ عمومیِ بن — یک واقعیت در سه جا (F003)', () => {
  const enumKeys = Object.values(BanReasonKey).sort();

  test('کنترلِ مثبت: پارسرها واقعاً چیزی می‌خوانند', () => {
    assert.ok(enumKeys.length >= 5, 'enumِ Prisma خالی است — client قدیمی؟ `prisma generate` بزن');
    assert.ok(customerMap().size >= 5, 'پارسِ اپِ مشتری چیزی نیافت — گارد توخالی می‌شد');
    assert.ok(companyMap().size >= 5, 'پارسِ پنلِ شرکت چیزی نیافت — گارد توخالی می‌شد');
  });

  test('اپِ مشتری دقیقاً کلیدهای enum را دارد', () => {
    assert.deepEqual([...customerMap().keys()].sort(), enumKeys);
  });

  test('پنلِ شرکت دقیقاً کلیدهای enum را دارد', () => {
    assert.deepEqual([...companyMap().keys()].sort(), enumKeys);
  });

  test('جمله‌ی هر کلید در دو اپ یکی است — ادمین همان را می‌بیند که کاربر می‌خواند', () => {
    const c = customerMap();
    const p = companyMap();
    for (const k of enumKeys) {
      assert.equal(p.get(k), c.get(k), `جمله‌ی «${k}» در پنلِ شرکت با اپِ مشتری نمی‌خواند`);
    }
  });
});
