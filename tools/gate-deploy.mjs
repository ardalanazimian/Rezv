#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گیتِ A2 — دیپلوی تولید و DNS
//
//  دستورِ خودمختاریِ v2 §A2: هر چهار golden journey روی staging و روی دامنه‌ی
//  واقعی پاس شده باشند با خروجیِ خام ثبت‌شده · CI سبز · مسیرِ rollback با
//  **اجرای واقعیِ یک‌بار** اثبات شده باشد (دیپلوی → برگشت → تأیید که نسخه‌ی
//  قبلی سرو می‌شود).
//
//  اجرا:  node tools/gate-deploy.mjs
//  خروج:  ۰ = مجاز · غیرِصفر = ممنوع
//
//  ⚠️ امروز این گیت **قرمز است و باید باشد**: نه میزبانِ staging وجود دارد،
//     نه دامنه، نه هیچ journeyی اجرا شده. گیتی که پیش از وجودِ زیرساخت سبز
//     باشد، چیزی را نمی‌سنجد.
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EVID = join(REPO, 'audit/staging/golden-journeys.json');

const REQUIRED_JOURNEYS = ['customer-pwa', 'business-panel', 'company-panel', 'web-landing'];
const MAX_AGE_HOURS = Number(process.env.DEPLOY_EVIDENCE_MAX_AGE_HOURS ?? 24);

const deny = (r) => { console.error(`❌ گیتِ A2 رد کرد — دیپلوی تولید/DNS مجاز نیست.\n   دلیل: ${r}`); process.exit(1); };

if (!existsSync(EVID)) {
  deny(
    `${EVID} وجود ندارد.\n` +
      '   هیچ golden journeyی روی staging اجرا نشده — که طبیعی است، چون هنوز\n' +
      '   میزبانِ staging و دامنه‌ای وجود ندارد (P0-017/F6، دستِ مالک).',
  );
}

let e;
try { e = JSON.parse(readFileSync(EVID, 'utf8')); } catch (err) { deny(`شواهد قابلِ خواندن نیست: ${err}`); }

if (!Array.isArray(e.journeys) || e.journeys.length === 0) deny('هیچ journeyی در شواهد نیست — نبودِ موضوع خطاست');

const names = e.journeys.map((j) => j.name);
const missing = REQUIRED_JOURNEYS.filter((n) => !names.includes(n));
if (missing.length) deny(`journeyهای غایب: ${missing.join('، ')}`);

for (const j of e.journeys) {
  if (j.passed !== true) deny(`journey «${j.name}» پاس نشده (passed=${j.passed})`);
  if (j.exit_code !== 0) deny(`journey «${j.name}» کدِ خروجِ ${j.exit_code} داشت`);
  // «خروجیِ خام ثبت‌شده» یعنی فایلش واقعاً هست، نه اینکه ادعا شده باشد.
  if (!j.raw_output_path) deny(`journey «${j.name}» مسیرِ خروجیِ خام ندارد`);
  if (!existsSync(join(REPO, j.raw_output_path))) deny(`خروجیِ خامِ «${j.name}» وجود ندارد: ${j.raw_output_path}`);
  // دامنه‌ی واقعی، نه localhost — کلِ نکته‌ی این گیت همین است.
  if (!j.base_url || /localhost|127\.0\.0\.1|\.local\b/i.test(j.base_url)) {
    deny(`journey «${j.name}» روی «${j.base_url ?? '(نامشخص)'}» اجرا شده — لوکال شاهدِ staging نیست`);
  }
}

const ageH = (Date.now() - Date.parse(e.completed_at)) / 3_600_000;
if (!Number.isFinite(ageH)) deny(`completed_at خوانده نشد: ${e.completed_at}`);
if (ageH > MAX_AGE_HOURS) deny(`شواهد ${ageH.toFixed(1)} ساعت قدیمی است (سقف ${MAX_AGE_HOURS})`);

if (e.ci?.green !== true) deny('CI سبز ثبت نشده');
if (!e.ci?.run_url && !e.ci?.commit) deny('CI بدونِ شناسه‌ی اجرا یا کامیت — قابلِ راستی‌آزمایی نیست');

const rb = e.rollback;
if (rb?.executed !== true) deny('مسیرِ rollback اجرا نشده — یک runbookِ نوشته‌شده اثبات نیست');
if (rb.verified_previous_version_served !== true) deny('پس از rollback تأیید نشده که نسخه‌ی قبلی سرو می‌شود');
if (!rb.raw_output_path || !existsSync(join(REPO, rb.raw_output_path))) deny('خروجیِ خامِ rollback وجود ندارد');

console.log(`✅ گیتِ A2 مجاز کرد — ${e.journeys.length} journey روی ${e.journeys[0].base_url} · rollback اجراشده`);
