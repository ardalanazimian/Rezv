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

function ask(question, { silent = false } = {}) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (silent && process.stdin.isTTY) {
      // اکوی ترمینال را خاموش کن تا رمز روی صفحه نیفتد.
      const onData = () => rl.output.write('\x1B[2K\r' + question);
      rl.input.on('data', onData);
      rl.question(question, ans => { rl.input.off('data', onData); rl.close(); process.stdout.write('\n'); resolve(ans); });
      return;
    }
    rl.question(question, ans => { rl.close(); resolve(ans); });
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
