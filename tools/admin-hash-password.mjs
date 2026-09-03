#!/usr/bin/env node
/**
 * تولیدِ هشِ رمزِ مدیر — تا رمزِ واقعی هیچ‌جا ثبت نشود.
 *
 * رمز از **stdin** خوانده می‌شود، نه از آرگومان: آرگومان در `history` شل و در
 * فهرستِ پردازه‌ها (`ps`) دیده می‌شود. خروجی فقط هش است.
 *
 * از همان `scrypt`ِ `api/src/lib/password.ts` استفاده می‌کند (N=32768, r=8,
 * p=1) — نه یک پیاده‌سازیِ دوم، تا فرمتِ ذخیره دقیقاً همان چیزی باشد که
 * `verifyPassword` انتظار دارد.
 *
 *   node tools/admin-hash-password.mjs
 *   (رمز را تایپ کن و Enter بزن)
 */
import { createInterface } from 'node:readline';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

// ── همان پارامترهای api/src/lib/password.ts ──
// ⚠️ اگر آن‌جا عوض شد، این‌جا هم باید عوض شود. عمداً کپی شده‌اند چون این
// اسکریپت بیرونِ اپِ Next اجرا می‌شود و نمی‌تواند TypeScriptِ آن را import کند.
const N = 32768, R = 8, P = 1, KEYLEN = 64, SALT_BYTES = 16;
const MAXMEM = 64 * 1024 * 1024;

// همان سیاستِ رمزِ passwordPolicyError — تکرارِ حداقلی، چون این اسکریپت
// نباید رمزی بسازد که خودِ API بعداً ردش کند.
function policyError(p) {
  if (typeof p !== 'string' || p.length < 10) return 'رمز باید حداقل ۱۰ کاراکتر باشد';
  if (!/[a-z]/.test(p)) return 'رمز باید حداقل یک حرفِ کوچکِ لاتین داشته باشد';
  if (!/[A-Z]/.test(p)) return 'رمز باید حداقل یک حرفِ بزرگِ لاتین داشته باشد';
  if (!/\d/.test(p)) return 'رمز باید حداقل یک رقم داشته باشد';
  return null;
}

// ⚠️ **یک** interface برایِ کلِ اسکریپت، نه یکی به‌ازای هر پرسش. نسخه‌ی اول
// به‌ازای هر پرسش یک readline می‌ساخت؛ با stdinِ لوله‌شده (مثلِ CI یا
// `printf … | node …`) اولی کلِ بافر را می‌بلعید و دومی هرگز resolve نمی‌شد
// → «unsettled top-level await»، exit 13. با TTY هم `terminal:true` باید فقط
// وقتی واقعاً ترمینال است ست شود، وگرنه ورودیِ لوله‌شده خط‌به‌خط نمی‌رسد.
const isTTY = !!process.stdin.isTTY;

// ⚠️ دو مسیرِ کاملاً جدا برایِ TTY و غیرِ TTY:
//  • TTY: readline با `terminal:true` تا اکو خاموش شود و رمز روی صفحه نیفتد.
//  • غیرِ TTY (CI، `printf … | node …`): کلِ stdin یک‌جا بافر می‌شود و
//    پرسش‌ها از همان آرایه می‌خوانند. دلیلش یک شکستِ واقعی: با
//    `rl.question` روی ورودیِ لوله‌شده، هر دو خط در **یک** chunk می‌رسند و
//    خطِ دوم پیش از ثبتِ پرسشِ دوم گم می‌شود → «unsettled top-level await»،
//    exit 13. بافرکردن این race را کلاً حذف می‌کند.
let piped = null;
if (!isTTY) {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  piped = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
}
const rl = isTTY ? createInterface({ input: process.stdin, output: process.stdout, terminal: true }) : null;

function ask(question, { silent = false } = {}) {
  if (!isTTY) {
    process.stdout.write(question);
    const line = piped.length ? piped.shift() : '';
    process.stdout.write('\n');
    return Promise.resolve(line);
  }
  return new Promise(resolve => {
    if (silent) {
      // اکوی ترمینال را خاموش کن تا رمز روی صفحه نیفتد.
      const onData = () => rl.output.write('\x1B[2K\r' + question);
      rl.input.on('data', onData);
      rl.question(question, ans => { rl.input.off('data', onData); process.stdout.write('\n'); resolve(ans); });
      return;
    }
    rl.question(question, resolve);
  });
}

const pw = (await ask('رمزِ مدیر: ', { silent: true })).trim();
const err = policyError(pw);
if (err) {
  console.error('✗ ' + err);
  process.exit(1);
}
const again = (await ask('یک بار دیگر:  ', { silent: true })).trim();
if (pw !== again) {
  console.error('✗ دو رمز یکی نیستند');
  process.exit(1);
}

const salt = randomBytes(SALT_BYTES);
const hash = await scrypt(pw, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
const stored = `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;

console.log('\n── هشِ رمز (این را به اسکریپتِ ساختِ ادمین بده) ──');
console.log(stored);
console.log('\n⚠️ خودِ رمز را جایی ذخیره نکن — فقط در ذهن یا در password managerِ خودت.');
if (rl) rl.close();
