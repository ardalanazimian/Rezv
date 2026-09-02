#!/usr/bin/env node
/**
 * تولیدِ `ADMIN_TOTP_SECRET` و نمایشِ QR برایِ اسکن با Google Authenticator
 * یا Aegis یا هر اپلیکیشنِ TOTPِ دیگر.
 *
 * ⚠️ کاملاً آفلاین است: هیچ درخواستِ شبکه‌ای نمی‌زند. TOTP فقط یک رازِ مشترک
 * و ساعتِ سیستم است (RFC 6238) — ربطی به «ورود با گوگل» ندارد.
 *
 *   node tools/admin-totp-secret.mjs <username>
 */
import { TOTP, Secret } from '../api/node_modules/otpauth/dist/otpauth.node.mjs';
import QRCode from '../api/node_modules/qrcode/lib/index.js';

const username = (process.argv[2] || '').trim();
if (!username) {
  console.error('استفاده: node tools/admin-totp-secret.mjs <username>');
  console.error('  <username> همان نامِ کاربریِ ادمین در دیتابیس است.');
  process.exit(1);
}

// ── همان پارامترهای api/src/lib/admin-totp.ts ──
// ⚠️ اگر آن‌جا عوض شد این‌جا هم باید عوض شود، وگرنه کدی که اپ تولید می‌کند با
// آنچه سرور انتظار دارد یکی نخواهد بود.
const ISSUER = 'Rezervno';
const ALGORITHM = 'SHA1';
const DIGITS = 6;
const PERIOD = 30;

// ۲۰ بایت = ۱۶۰ بیت، اندازه‌ی پیشنهادیِ RFC 4226 برایِ HMAC-SHA1.
const secret = new Secret({ size: 20 });
const totp = new TOTP({
  issuer: ISSUER, label: username,
  algorithm: ALGORITHM, digits: DIGITS, period: PERIOD,
  secret,
});

const uri = totp.toString();

console.log('\n══════════════════════════════════════════════════════════');
console.log('  رازِ TOTPِ مدیرِ پلتفرم');
console.log('══════════════════════════════════════════════════════════\n');

// QR در خودِ ترمینال — بدونِ هیچ سرویسِ بیرونی.
console.log(await QRCode.toString(uri, { type: 'terminal', small: true }));

console.log('── اگر اسکن نشد، دستی وارد کن ──');
console.log('  حساب:      ' + ISSUER + ':' + username);
console.log('  کلید:      ' + secret.base32);
console.log('  نوع:       Time-based (TOTP)');
console.log('  الگوریتم:  ' + ALGORITHM + '  ·  ارقام: ' + DIGITS + '  ·  دوره: ' + PERIOD + 's');

console.log('\n── این سه خط را در .env بگذار ──');
console.log('ADMIN_LOGIN_ENABLED=true');
console.log('ADMIN_TOTP_USERNAME=' + username.toLowerCase());
console.log('ADMIN_TOTP_SECRET=' + secret.base32);

console.log('\n── تأییدِ فوری ──');
console.log('  کدِ همین لحظه: ' + totp.generate());
console.log('  اگر اپلیکیشن هم همین عدد را نشان می‌دهد، اسکن درست بوده.');
console.log('\n⚠️ .env را هرگز commit نکن. راز را جای امن نگه دار —');
console.log('   با از دست دادنش از پنل قفل بیرون می‌مانی.\n');
