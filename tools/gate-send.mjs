#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گیتِ A4 — ارسالِ واقعی به دنیای بیرون
//
//  دستورِ خودمختاریِ v2 §A4: transport با یک پیامکِ واقعی به یک گوشیِ تست
//  اثبات شده باشد، پاسخِ خامِ ارائه‌دهنده ثبت شده باشد، «پاسخِ null به‌عنوانِ
//  موفقیت» ناممکن اثبات شده باشد، و سقف/ساعتِ سکوت در کد با تست اجرا شده باشند.
//  سقفِ سختِ ۵۰۰ گیرنده تا وقتی داده‌ی تحویلِ واقعی دیده شود.
//
//  اجرا:  node tools/gate-send.mjs --recipients <N>
//  خروج:  ۰ = مجاز · غیرِصفر = ممنوع
//
//  ⚠️ امروز قرمز است و باید باشد: کلیدِ ملی‌پیامک هنوز چرخانده نشده (F4) و
//     هیچ پیامکِ واقعی ارسال نشده. ارسالِ بد قابلِ فراخوانی نیست — به همین
//     دلیل سقف وجود دارد، نه چون کسی باید ببیندش.
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVID = join(REPO, 'audit/sms/transport-proof.json');
const LEDGER = join(REPO, 'docs/DECISIONS.md');
const DEFAULT_CAP = 500;

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const recipients = Number(arg('--recipients', 'NaN'));

const deny = (r) => { console.error(`❌ گیتِ A4 رد کرد — ارسالِ واقعی مجاز نیست.\n   دلیل: ${r}`); process.exit(1); };

if (!Number.isInteger(recipients) || recipients < 1) deny('--recipients یک عددِ صحیحِ مثبت لازم دارد');

if (!existsSync(EVID)) {
  deny(
    `${EVID} وجود ندارد.\n` +
      '   transport هرگز با یک پیامکِ واقعی اثبات نشده. کلیدِ ملی‌پیامک هنوز\n' +
      '   چرخانده نشده (F4، دستِ مالک) و پنلش ورودِ دومرحله‌ای به گوشیِ فیزیکی می‌خواهد.',
  );
}

let e;
try { e = JSON.parse(readFileSync(EVID, 'utf8')); } catch (err) { deny(`شواهد قابلِ خواندن نیست: ${err}`); }

// ── اثباتِ transport ────────────────────────────────────────────────────
if (e.test_send?.delivered !== true) deny('پیامکِ تست تحویل نشده');
if (!e.test_send?.to) deny('شماره‌ی گوشیِ تست ثبت نشده');
// پاسخِ خامِ ارائه‌دهنده باید **وجود** داشته باشد و null نباشد. کلِ باگِ S2 همین بود:
// پاسخِ null به‌عنوانِ موفقیت پذیرفته می‌شد.
if (e.test_send.provider_raw_response === undefined) deny('پاسخِ خامِ ارائه‌دهنده ثبت نشده');
if (e.test_send.provider_raw_response === null) deny('پاسخِ خامِ ارائه‌دهنده null است — همان باگِ S2؛ null هرگز موفقیت نیست');
if (String(e.test_send.provider_raw_response).trim() === '') deny('پاسخِ خامِ ارائه‌دهنده خالی است');
if (e.null_response_as_success_impossible !== true) {
  deny('اثبات نشده که «پاسخِ null = موفقیت» ناممکن است — این باید یک تستِ قرمزشونده داشته باشد');
}
if (!e.null_response_test?.path || !existsSync(join(REPO, e.null_response_test.path))) {
  deny('فایلِ تستِ null-response وجود ندارد — ادعا بدونِ تست');
}

// ── سقف و ساعتِ سکوت در کد ─────────────────────────────────────────────
for (const k of ['frequency_cap', 'quiet_hours']) {
  const t = e.enforced_in_code?.[k];
  if (t?.enforced !== true) deny(`${k} در کد اجرا نمی‌شود`);
  if (!t.test_path || !existsSync(join(REPO, t.test_path))) deny(`${k} تستِ موجود ندارد: ${t.test_path ?? '(بدونِ مسیر)'}`);
}

// ── سقفِ گیرنده ────────────────────────────────────────────────────────
// بالابردنِ سقف فقط با یک ردیفِ ثبت‌شده در دفترِ تصمیم مجاز است — و آن ردیف
// باید داده‌ی تحویلِ واقعی را نام ببرد، نه صرفاً «به‌نظر خوب کار می‌کند».
let cap = DEFAULT_CAP;
if (existsSync(LEDGER)) {
  const led = readFileSync(LEDGER, 'utf8').replace(/\r\n/g, '\n');
  const m = /RAISED_SEND_CAP\s*=\s*(\d+)/.exec(led);
  if (m) {
    const hasDeliveryData = /delivery_data_observed\s*=\s*true/.test(led);
    if (!hasDeliveryData) deny('سقف در دفتر بالا برده شده ولی `delivery_data_observed = true` ثبت نشده');
    cap = Number(m[1]);
  }
}
if (recipients > cap) deny(`${recipients} گیرنده از سقفِ ${cap} بیشتر است. ارسالِ بد قابلِ فراخوانی نیست`);

console.log(`✅ گیتِ A4 مجاز کرد — ${recipients} گیرنده (سقف ${cap}) · transport اثبات‌شده به ${e.test_send.to}`);
