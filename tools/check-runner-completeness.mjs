#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ کاملیِ runnerِ تست — «هر فایلِ تست واقعاً اجرا می‌شود؟»
//
//  ⚠️ چرا این فایل وجود دارد:
//  `api/tests/_all.runner.mts` با ایمپورتِ صریح جمع می‌کند، پس فایلی که
//  ایمپورت نشده باشد **هرگز** توسطِ `npm test` اجرا نمی‌شود. این دقیقاً یک‌بار
//  رخ داده (۲۰۲۶-۰۸-۱۴، ثبت‌شده در `_all.runner.mts:29-36`): سه فایل —
//  ban، crm-recommendations و customer-intelligence — ساخته شدند و ایمپورت
//  نشدند، و PRِ مربوطه «۳۷۵/۳۷۵ پاس» اعلام کرد در حالی که عددِ واقعی ۳۵۲ بود.
//
//  درسی که آن روز ثبت شد یک **کامنت** بود که به آدم می‌گفت یک دستورِ شل را
//  یادش بماند. قاعده‌ی ۱۳ منشور: چیزی که اجرا نمی‌شود گارد نیست. این اسکریپت
//  همان ادعا را اجراشدنی می‌کند.
//
//  ⚠️ چرا در tools/ و نه به‌عنوانِ یک تست داخلِ خودِ سوئیت:
//  یک تستِ کاملی که داخلِ سوئیت زندگی کند مشکلِ bootstrap دارد — اگر روزی
//  **خودش** فایلِ ایمپورت‌نشده باشد، اجرا نمی‌شود، و گارد دقیقاً در همان
//  حالتی که برای کشفش ساخته شده بی‌صدا غایب است.
//
//  اجرا:  node tools/check-runner-completeness.mjs
//  خروج:  ۰ = کامل · ۱ = ناقص (نام‌ها چاپ می‌شوند)
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TESTS_DIR = join(REPO, 'api/tests');
const RUNNER = join(TESTS_DIR, '_all.runner.mts');

const fails = [];

if (!existsSync(RUNNER)) {
  console.error(`❌ runner پیدا نشد: api/tests/_all.runner.mts`);
  process.exit(1);
}

// ── فایل‌هایِ تست رویِ دیسک ──────────────────────────────────────────────
// فقط `*.test.mts`. فایل‌هایِ کمکی (`_phone.helper.mts`, `helpers/…`) تست
// نیستند و نباید ایمپورتِ اجباری داشته باشند.
//
// ⚠️ **بازگشتی**، و این عمدی است. نسخه‌ی اولِ همین فایل با `readdirSync`ِ تخت
// می‌شمرد در حالی که جهتِ دوم `existsSync(join(TESTS_DIR, imp))` را صدا می‌زد و
// `imp` می‌تواند اسلش داشته باشد — `helpers/test-env.mts` همین حالا دارد. یعنی
// دو نیمه‌ی همین گارد سرِ «نامِ یک فایلِ تست چیست» با هم اختلاف داشتند: فایلی در
// `api/tests/integration/x.test.mts` برای جهتِ اول **نامرئی** بود، هرگز در
// فهرستِ یتیم‌ها نمی‌آمد، و گارد سبز چاپ می‌کرد — دقیقاً برای فایلی که وجودِ
// گارد به‌خاطرِ آن است. امروز مصداق ندارد (`find api/tests -mindepth 2 -name
// '*.test.mts'` خالی است) ولی اولین کسی که تست‌ها را در زیرپوشه مرتب کند —
// کارِ کاملاً معقولی — آن‌ها را بی‌صدا از تنها چکی که اجراشدنشان را می‌سنجد
// خارج می‌کرد. هر دو جهت حالا یک واژگان دارند: مسیرِ نسبی به TESTS_DIR.
function collectTests(dir, prefix = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...collectTests(join(dir, e.name), rel));
    else if (e.name.endsWith('.test.mts')) out.push(rel);
  }
  return out;
}
const onDisk = collectTests(TESTS_DIR).sort();

// ── ایمپورت‌هایِ واقعیِ runner ────────────────────────────────────────────
// خطِ ایمپورتِ واقعی، نه ذکر در کامنت. الگو لنگر دارد تا
// `//  import './x.test.mts'` داخلِ توضیحات به‌اشتباه شمرده نشود.
const runnerLines = readFileSync(RUNNER, 'utf8').replace(/\r\n/g, '\n').split('\n');
const imported = [];
for (const line of runnerLines) {
  const m = /^\s*import\s+['"]\.\/(.+?)['"]\s*;?\s*$/.exec(line);
  if (m) imported.push(m[1]);
}

// ── قاعده‌ی ۵: نبودِ موضوع خطاست، نه عبور ────────────────────────────────
if (onDisk.length === 0) {
  console.error('❌ هیچ فایلِ `*.test.mts`ی در api/tests پیدا نشد — گاردِ توخالی، الگو یا مسیر شکسته است');
  process.exit(1);
}
if (imported.length === 0) {
  console.error('❌ هیچ خطِ importی در runner پیدا نشد — گاردِ توخالی، الگویِ import شکسته است');
  process.exit(1);
}

// ── جهتِ ۱: فایلی که هست ولی اجرا نمی‌شود ───────────────────────────────
const importedSet = new Set(imported);
const orphans = onDisk.filter((f) => !importedSet.has(f));
for (const f of orphans) {
  fails.push(`«${f}» روی دیسک هست ولی در _all.runner.mts ایمپورت نشده — npm test هرگز اجرایش نمی‌کند`);
}

// ── جهتِ ۲: ایمپورتی که به فایلِ ناموجود اشاره می‌کند ────────────────────
// این بدتر از جهتِ ۱ است: runner همه را در **یک** پروسه ایمپورت می‌کند، پس
// یک ایمپورتِ شبح کلِ اجرا را می‌کشد — و «قرمز» می‌تواند یعنی «هیچ‌چیز اجرا نشد».
for (const imp of imported) {
  if (!existsSync(join(TESTS_DIR, imp))) {
    fails.push(`runner «${imp}» را ایمپورت می‌کند ولی این فایل وجود ندارد — کلِ اجرا در یک پروسه می‌میرد`);
  }
}

if (fails.length) {
  console.error(`❌ کاملیِ runner نقض شده — ${fails.length} مورد:`);
  for (const f of fails) console.error(`  • ${f}`);
  console.error('\n  هر فایلِ `*.test.mts` باید در api/tests/_all.runner.mts ایمپورت شود.');
  process.exit(1);
}

console.log(
  `✓ runner کامل است — ${onDisk.length} فایلِ تست، همه ایمپورت‌شده · ${imported.length} خطِ import، همه موجود`,
);
