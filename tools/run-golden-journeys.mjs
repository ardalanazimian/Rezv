#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  runnerِ سفرهای طلایی — تولیدکننده‌ی شواهدِ گیتِ A2
//
//  چرا وجود دارد (اندازه‌گیریِ ۲۰۲۶-۰۹-۱۸، `origin/main = ba87829`):
//  `tools/gate-deploy.mjs` فایلِ `audit/staging/golden-journeys.json` را
//  می‌خواند، و **هیچ‌چیز در کلِ مخزن آن را نمی‌ساخت** — سه ارجاع، هر سه
//  مصرف‌کننده. دو تا از چهار نامی که گیت می‌خواهد (`customer-pwa`،
//  `web-landing`) در کلِ مخزن فقط داخلِ خودِ گیت بودند. یعنی حتی با میزبانی و
//  DNSِ کامل، گیت قرمز می‌ماند چون شواهدش را کسی تولید نمی‌کند. این فایل آن
//  شکاف را پر می‌کند.
//
//  ── قاعده‌هایی که شکلش را تعیین کردند ──
//  ۱. «یک اسکریپت نمی‌تواند هم کاری را انجام دهد و هم گواهی‌اش کند»: این
//     runner اجرا می‌کند و **مشاهده** می‌نویسد. داوری با گیت است. نوشتنِ
//     `passed:false` مسیرِ عادی است، نه خطا.
//  ۲. «نبودِ موضوع» هرگز pass نیست (بندِ ۴ منشور): نبودِ محیط ⇒ BLOCKED،
//     و BLOCKED سفر را قرمز می‌کند.
//  ۳. runner هرگز `ci.green` را محاسبه نمی‌کند — فقط کپی می‌کند. درباره‌ی
//     سیستمی که خودش اجرایش نکرده ادعا نمی‌کند (بندِ ۴i).
//
//  ── و یک صداقتِ لازم، پس از حمله‌ی Red Team (`rezv-18`، ۲۰۲۶-۰۹-۱۸) ──
//  شاهدِ شبکه‌ای (IPِ resolve‌شده و صادرکننده‌ی گواهی) **جعل را گران‌تر
//  می‌کند، نه ناممکن**: این runner در محیطی اجرا می‌شود که نویسنده‌اش کنترلش
//  می‌کند، پس `NODE_TLS_REJECT_UNAUTHORIZED=0` یا یک ورودیِ hosts آن را
//  می‌شکند، و با کنترلِ DNS می‌شود گواهیِ معتبرِ واقعی صادر کرد. پس این‌ها
//  **مشاهده**اند نه اثبات، و در `not_measured_here` صریح نوشته می‌شوند.
//  بستنِ واقعی در گیت است: گیت باید خودش اجرای CI را fetch کند و
//  `conclusion == success` و `head_sha == کامیتِ استقرار` را assert کند.
//  (حکمِ CEO ۲۰۲۶-۰۹-۱۸؛ تغییرِ گیت جدا از این فایل است.)
//
//  اجرا:
//    LANDING_URL=https://staging.example.ir API_BASE=https://api.staging.example.ir \
//      node tools/run-golden-journeys.mjs
//  خروج: ۰ اگر هر چهار سفر پاس شدند · ۱ در غیرِ این صورت (و فایل **همیشه** نوشته می‌شود)
// ═══════════════════════════════════════════════════════════════════════
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASS, FAIL, BLOCKED, record, journey, writeRaw, writeEvidence } from './golden-journeys/evidence.mjs';
import { networkEvidence } from './golden-journeys/network-evidence.mjs';
import { runWebLanding } from './golden-journeys/journey-web-landing.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const cfg = {
  landingUrl: process.env.LANDING_URL || process.env.BASE_URL || '',
  apiBase: process.env.API_BASE || '',
  customerUrl: process.env.CUSTOMER_URL || '',
  businessUrl: process.env.BUSINESS_URL || '',
  companyUrl: process.env.COMPANY_URL || '',
  ciRunId: process.env.CI_RUN_ID || null,
  ciCommit: process.env.CI_COMMIT || null,
};

/**
 * سفرهایی که هنوز پیاده‌سازیِ اجرایی ندارند.
 *
 * ⚠️ این **stubِ سبز نیست**. فهرستِ assertionهای تأییدشده‌ی CEO (§۲–§۵ سندِ
 * PROPOSAL) با وضعیتِ BLOCKED و دلیلِ دقیق ثبت می‌شود، چون:
 *   · تا محیطِ staging نباشد هیچ‌کدام اجرا نشده‌اند، و
 *   · «اجرا نشده» را نباید از سکوت حدس زد.
 * وقتی محیط آمد، هر ردیف پیاده‌سازی می‌شود و همین شناسه‌ها پر می‌شوند.
 */
const PENDING = {
  'customer-pwa': {
    url: () => cfg.customerUrl,
    rows: [
      ['C1', 'بازکردنِ سرد ۲۰۰ می‌دهد و فید ≥۱ رستورانِ واقعیِ دیتابیس را نشان می‌دهد'],
      ['C2', 'هیچ محتوای نمونه/دمو در فید نیست'],
      ['C3', 'صفحه‌ی رستوران از فید باز می‌شود و با ردیفِ دیتابیس می‌خواند'],
      ['C4', 'تاریخ/نفر/ساعت اسلات‌های واقعیِ API می‌دهد، نه فهرستِ ثابت'],
      ['C5', 'درخواستِ OTP توسط ارائه‌دهنده پذیرفته می‌شود، با پاسخِ خام'],
      ['C6', 'واردکردنِ کد نشست می‌سازد'],
      ['C7', 'رزرو کد می‌دهد و ردیفش در دیتابیس هست'],
      ['C8', 'رزرو در «رزروهای من» با همان کد دیده می‌شود'],
      ['C9', 'پیامکِ تأیید توسط ارائه‌دهنده پذیرفته شد (provider_accepted)'],
      ['C10', 'لغو وضعیت را در UI و دیتابیس عوض می‌کند و برچسب با متنِ پیامک تناقض ندارد'],
      ['C11', 'کنترلِ منفی: با APIِ ۵۰۰ این سفر باید شکست بخورد'],
      ['C12', 'کوپن: یا مهمان تا آخر استفاده‌اش می‌کند، یا هیچ جای کوپن نشان داده نمی‌شود'],
      ['C13', 'هیچ متنی به مهمان قولِ پرداختِ آنلاین/بیعانه نمی‌دهد (بیعانه در لانچ خاموش است)'],
    ],
    // حکمِ CEO (Q1): تا چرخاندنِ کلیدِ پیامک این سفر صادقانه قرمز می‌ماند، و
    // باید **به نام** بگوید کدام assertion جلویش را گرفته.
    reason: (id) =>
      ['C5', 'C6', 'C9'].includes(id)
        ? 'مسدود روی مالک: کلیدِ ملی‌پیامک چرخانده نشده. OTP_DEV_MODE راهِ دور زدن نیست — بای‌پسِ کاملِ احراز هویت است و assertProductionSecretsSafe در production ردش می‌کند.'
        : 'محیطِ staging وجود ندارد؛ این assertion هرگز اجرا نشده.',
  },
  'business-panel': {
    url: () => cfg.businessUrl,
    rows: [
      ['B1', 'ورود با رمز (نه OTP) برای کارمند کار می‌کند'],
      ['B2', 'فهرستِ امروز فقط ردیف‌های همان رستوران را دارد'],
      ['B3', 'تغییرِ وضعیت در چرخه‌ی واقعی ماندگار است و در اپِ مشتری دیده می‌شود'],
      ['B4', 'مهمانِ بدونِ رزرو ساخته و نشانده می‌شود'],
      ['B5', 'لیستِ انتظار → پیشنهاد → تخصیصِ میز کامل می‌شود'],
      ['B6', 'سابقه/یادداشتِ مهمان روی ردیف دیده می‌شود'],
      ['B7', 'یک پیامکِ کمپین پذیرفته شد، دقیقاً یک اعتبار کم شد، ردیفِ تراکنش نوشته شد'],
      ['B8', 'کنترلِ منفی: ردیفِ رستورانِ دیگر نه دیده می‌شود نه تغییر می‌کند'],
    ],
    reason: () => 'محیطِ staging وجود ندارد؛ این assertion هرگز اجرا نشده. (ورودِ این پنل با رمز است، پس به کلیدِ پیامک وابسته نیست — حکمِ مالک ۰۹-۱۸.)',
  },
  'company-panel': {
    url: () => cfg.companyUrl,
    rows: [
      ['K1', 'ورود با TOTP کار می‌کند و بدونِ TOTP fail-closed است'],
      ['K2', 'دستِ‌کم یک KPI با کوئریِ مستقیمِ دیتابیس تطبیق داده شد'],
      ['K3', 'ساختِ رستوران پلن و تاریخِ انقضا را اجباری می‌کند'],
      ['K4', 'تغییرِ پلن/فیچر اثرِ دیدنی در پنلِ بیزنس دارد'],
      ['K5', 'شارژِ پیامک دقیقاً به اندازه‌ی مبلغ زیاد می‌شود، با ردیفِ دفتر'],
      ['K6', 'فیدِ ممیزی ورودِ همین نشست را نشان می‌دهد'],
      ['K7', 'تغییرِ تنظیماتِ پلتفرم هیچ رازِ خامی برنمی‌گرداند'],
    ],
    reason: () => 'محیطِ staging وجود ندارد؛ این assertion هرگز اجرا نشده. (ورودِ این پنل هم با رمز/TOTP است، نه پیامک.)',
  },
};

async function main() {
  const journeys = [];

  // ── سفرِ ۴: تنها سفری که کاملاً روی HTTP سنجیدنی است ──
  if (cfg.landingUrl) {
    const net = await networkEvidence(cfg.landingUrl);
    const { assertions, raw } = await runWebLanding(cfg);
    const j = journey('web-landing', cfg.landingUrl, assertions, net);
    j.raw_output_path = writeRaw(REPO, 'web-landing', `${raw}\n\n--- network ---\n${JSON.stringify(net, null, 2)}\n`);
    journeys.push(j);
  } else {
    const a = [record('W0', 'آدرسِ لندینگ پیکربندی شده', BLOCKED, 'LANDING_URL/BASE_URL تنظیم نشده', null)];
    const j = journey('web-landing', '', a, null);
    j.raw_output_path = writeRaw(REPO, 'web-landing', 'LANDING_URL تنظیم نشده — هیچ چیزی سنجیده نشد.\n');
    journeys.push(j);
  }

  // ── سه سفرِ دیگر: فهرستِ assertionها ثبت می‌شود، همه BLOCKED ──
  for (const [name, spec] of Object.entries(PENDING)) {
    const url = spec.url();
    const net = url ? await networkEvidence(url) : null;
    const a = spec.rows.map(([id, title]) => record(id, title, BLOCKED, spec.reason(id), null));
    const j = journey(name, url, a, net);
    j.raw_output_path = writeRaw(
      REPO,
      name,
      `سفرِ ${name} — ${a.length} assertion، هیچ‌کدام اجرا نشده.\n` +
        a.map((x) => `${x.id}  BLOCKED  ${x.title}\n        ${x.detail}`).join('\n') +
        '\n',
    );
    journeys.push(j);
  }

  const { rel, doc } = writeEvidence(REPO, {
    journeys,
    ci: cfg.ciRunId || cfg.ciCommit ? { green: null, run_id: cfg.ciRunId, commit: cfg.ciCommit, note: 'کپی‌شده از ورودی؛ این runner سبزیِ CI را نمی‌سنجد (بندِ ۴i). گیت باید خودش fetch و assert کند.' } : null,
    rollback: null,
    secretsReseal: null,
  });

  // ── گزارشِ انسانی ──
  let allPassed = true;
  console.log(`شواهد نوشته شد: ${rel}\n`);
  for (const j of doc.journeys) {
    const p = j.assertions.filter((a) => a.status === PASS).length;
    const f = j.assertions.filter((a) => a.status === FAIL).length;
    const b = j.assertions.filter((a) => a.status === BLOCKED).length;
    if (!j.passed) allPassed = false;
    console.log(`${j.passed ? '✅' : '❌'} ${j.name.padEnd(16)} pass=${p} fail=${f} blocked=${b}  base_url=${j.base_url || '(تنظیم نشده)'}`);
    for (const a of j.assertions) {
      if (a.status === PASS) continue;
      console.log(`     ${a.status === FAIL ? '✗' : '⏸'} ${a.id}  ${a.title}`);
      if (a.detail) console.log(`        ${a.detail}`);
    }
  }
  console.log(`\nنتیجه: ${allPassed ? 'هر چهار سفر پاس' : 'حداقل یک سفر پاس نشده'} — گیت را جدا اجرا کن: node tools/gate-deploy.mjs`);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  // حتی شکستِ خودِ runner هم باید دیده شود، نه اینکه بی‌صدا صفر برگرداند.
  console.error(`❌ runner شکست خورد: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
