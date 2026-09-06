#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گیتِ A1 — عملیاتِ مخرب و برگشت‌ناپذیر
//
//  دستورِ خودمختاریِ v2 §A1: drop/delete/purge/force-push فقط وقتی مجاز است که
//  یک درِیلِ بازیابیِ **موفق** در ۲۴ ساعتِ گذشته روی همان دامنه‌ی داده اجرا شده
//  باشد و یک نسخه‌ی خارج از هاست وجود داشته باشد. «بک‌آپی که هرگز restore نشده
//  بک‌آپ نیست» — و همین، نه امضای مالک، چیزی است که از داده محافظت می‌کند.
//
//  اجرا:  node tools/gate-destructive.mjs --scope <label> [--max-age-hours 24]
//  خروج:  ۰ = مجاز · غیرِصفر = ممنوع، با دلیلِ صریح
//
//  ⚠️ اجراکننده‌ی درِیل (tools/restore-drill.sh) و تفسیرکننده‌اش (این فایل)
//     عمداً جدا هستند. اسکریپتی که هم کار را انجام دهد و هم خودش را تأیید کند،
//     همان «سازنده برگه‌ی خودش را تصحیح می‌کند» است در مقیاسِ کوچک.
// ═══════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRILLS = join(REPO, 'audit/drills');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i === -1 ? dflt : argv[i + 1];
};
const scope = arg('--scope');
const maxAgeHours = Number(arg('--max-age-hours', '24'));

const deny = (reason) => {
  console.error(`❌ گیتِ A1 رد کرد — عملیاتِ مخرب مجاز نیست.\n   دلیل: ${reason}`);
  process.exit(1);
};

if (!scope) deny('--scope داده نشد. گیت باید بداند کدام دامنه‌ی داده قرار است نابود شود');
if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) deny('--max-age-hours معتبر نیست');

if (!existsSync(DRILLS)) deny(`پوشه‌ی ${DRILLS} وجود ندارد — هیچ درِیلی هرگز اجرا نشده`);

const records = readdirSync(DRILLS)
  .filter((f) => f.startsWith('restore-drill-') && f.endsWith('.json'))
  .map((f) => {
    try {
      return { file: f, ...JSON.parse(readFileSync(join(DRILLS, f), 'utf8')) };
    } catch (e) {
      return { file: f, __unparsable: String(e) };
    }
  });

// قاعده‌ی ۵: نبودِ موضوع خطاست، نه عبور.
if (records.length === 0) deny('هیچ رکوردِ درِیلی پیدا نشد');

const broken = records.filter((r) => r.__unparsable);
if (broken.length) deny(`رکوردِ خراب: ${broken[0].file} — ${broken[0].__unparsable}`);

// دامنه باید دقیقاً بخورد. یک درِیلِ محلی مجوزِ حذف روی تولید نیست.
const forScope = records.filter((r) => r.scope === scope);
if (forScope.length === 0) {
  const seen = [...new Set(records.map((r) => r.scope))].join(' | ') || '(هیچ)';
  deny(`هیچ درِیلی برای دامنه‌ی «${scope}» وجود ندارد. دامنه‌های درِیل‌شده: ${seen}`);
}

forScope.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
const d = forScope[0];

// هر شرط جداگانه، تا پیامِ رد بگوید دقیقاً چه چیزی کم است.
if (d.exit_code !== 0) deny(`آخرین درِیل شکست خورد (exit_code=${d.exit_code}) — ${d.failure ?? 'بدونِ دلیلِ ثبت‌شده'}`);

const ageMs = Date.now() - Date.parse(d.completed_at);
if (!Number.isFinite(ageMs)) deny(`completed_at خوانده نشد: ${d.completed_at}`);
const ageH = ageMs / 3_600_000;
if (ageH > maxAgeHours) deny(`آخرین درِیل ${ageH.toFixed(1)} ساعت پیش بوده (سقف: ${maxAgeHours})`);
if (ageH < -0.1) deny(`completed_at در آینده است (${d.completed_at}) — رکوردِ قابلِ اعتماد نیست`);

if (!(d.tables_compared > 0)) deny('tables_compared صفر است — درِیل هیچ چیزی را مقایسه نکرده');
if (d.row_count_diff !== 0) deny(`اختلافِ شمارشِ ردیف: ${d.row_count_diff} — restore داده را بازنساخت`);
if (d.off_host?.verified !== true) deny('نسخه‌ی خارج از هاست تأیید نشده — بک‌آپ روی همان دیسک بک‌آپ نیست');

// فایلِ dump باید هنوز باشد و همان باشد. رکوردی که به فایلِ
// نابودشده اشاره کند یک ادعای تاریخی است، نه یک بک‌آپِ موجود.
const dumpPath = d.dump?.path ? join(REPO, d.dump.path) : null;
if (!dumpPath || !existsSync(dumpPath)) deny(`فایلِ dump وجود ندارد: ${d.dump?.path ?? '(مسیر ثبت نشده)'}`);
if (statSync(dumpPath).size !== d.dump.size_bytes) deny('اندازه‌ی dump با رکورد فرق دارد');
const sha = createHash('sha256').update(readFileSync(dumpPath)).digest('hex');
if (sha !== d.dump.sha256) deny(`sha256 ی فایل با رکورد نمی‌خواند — dump عوض شده`);

console.log(
  `✅ گیتِ A1 مجاز کرد — دامنه‌ی «${scope}»\n` +
    `   درِیل: ${d.file} · ${ageH.toFixed(1)} ساعت پیش · ${d.tables_compared} جدول · اختلاف ${d.row_count_diff}\n` +
    `   dump: ${d.dump.size_bytes} بایت · sha256 تطبیق دارد · off-host: ${d.off_host.kind}`,
);
