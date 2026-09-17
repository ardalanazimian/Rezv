#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ «هوکِ هر-تستِ سطحِ ماژول در api/tests» — ratchet، نه sweep (BE-14)
//
//  چرا وجود دارد (اندازه‌گیریِ ۲۰۲۶-۰۹-۱۶/۱۷، تیمِ اجرا، هنگامِ مهاجرتِ ۰۹۰):
//  `api/tests/_all.runner.mts` همه‌ی فایل‌های تست را در **یک** پردازه import می‌کند. در
//  node:test، `beforeEach`/`afterEach`ای که بیرونِ هر `describe` صدا زده شود روی تستِ
//  **ریشه** ثبت می‌شود — یعنی پیش/پس از *هر* تستِ کلِ سوئیت اجرا می‌شود، نه فقط تست‌های
//  همان فایل. وقتی DELETEِ درونِ `beforeEach`ِ سطحِ ماژولِ `fraud.integration.test.mts` به
//  تریگرِ فقط-افزودنیِ ۰۹۰ خورد، **۱۸۲۹ تستِ نامربوط** با همان خطا قرمز شدند و هر شکستِ
//  واقعیِ دیگری زیرش پنهان ماند.
//
//  ⚠️ چرا ratchet و نه رفعِ همه (حکمِ CEO `rezv-87`، ۲۰۲۶-۰۹-۱۷): فایل‌های موجود با
//  baseline نگه داشته می‌شوند؛ این گارد فقط نمی‌گذارد فایلِ **تازه**ای بی‌صدا اضافه شود،
//  و baseline فقط می‌تواند کوچک شود:
//    • فایلِ بیرونِ baseline با هوکِ سطحِ ماژول                → exit 1
//    • فایلِ داخلِ baseline با هوکِ **بیشتر** از ثبت‌شده          → exit 1
//    • فایلِ داخلِ baseline که دیگر هوک ندارد یا کمتر دارد       → exit 1 («baseline را کوچک کن»)
//      — وگرنه آن فایل بی‌صدا می‌توانست دوباره هوک بگیرد.
//
//  ⚠️ «سطحِ ماژول» با **عمقِ پرانتز/آکولاد** تشخیص داده می‌شود، نه با ستونِ صفر: یک
//  `beforeEach(` می‌تواند در ستونِ صفر ولی داخلِ یک `describe(…, () => {` باشد (همان شکلی
//  که بازنویسیِ fraud در ۰۹۰ دارد) و آن **درست** است. رشته، تمپلیت، کامنت و regex literal
//  نادیده گرفته می‌شوند — همان روشِ tools/check-rejects-matcher.mjs، به‌علاوه‌ی تشخیصِ regex
//  پس از کلیدواژه‌ها (`return /x/`).
//
//  ⚠️ آنچه **نمی‌سنجد**، صریح: `before`/`after`ِ سطحِ ماژول (یک‌بار برای کلِ سوئیت اجرا
//  می‌شوند؛ کلاسِ خویشاوند، ولی دامنه‌ی این حکم نیست)؛ import با نامِ مستعار
//  (`import { beforeEach as be }`)؛ فراخوانیِ عضو (`x.beforeEach(`).
//
//  کنترلِ مثبت اجباری است (قاعده‌ی ۲ی CLAUDE.md): پیش از هر ادعا، اسکنر روی نمونه‌های
//  ساختگی آزموده می‌شود؛ اگر نبیند یا اشتباه ببیند، با کدِ ۲ («گیت اجرا نشد») می‌میرد.
//
//  اجرا:  node tools/check-module-level-test-hooks.mjs
//  خروج:  0 = هم‌داستان با baseline · 1 = نقض · 2 = گیت اجرا نشد
// ═══════════════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SCAN_DIR = join(ROOT, 'api', 'tests');
const GATE_DID_NOT_RUN = 2;
const HOOKS = ['beforeEach', 'afterEach'];

/**
 * فایل → تعدادِ هوکِ هر-تستِ سطحِ ماژول که امروز وجود دارد (شمرده روی درختِ مهاجرتِ ۰۹۰،
 * `impl/rezv-85-090-append-only @ 553ecf4`). **فقط کوچک شود.** هر فایلی که هوکش را داخلِ
 * describe برد، خطش را همین‌جا پاک کند.
 *
 * کوچک‌شده: dna-summary (۲۰۲۶-۰۹-۱۷، m-21 — هوکِ کاربرِ تازه داخلِ دو describeی مصرف‌کننده رفت).
 */
const BASELINE = {
  'api/tests/automation.integration.test.mts': 1,
  'api/tests/economy-ledger.integration.test.mts': 1,
  'api/tests/feature-flags.integration.test.mts': 1,
  'api/tests/lifecycle-cron.integration.test.mts': 1,
  'api/tests/metrics-endpoint.test.mts': 1,
  'api/tests/ml-auto-rollback.integration.test.mts': 1,
  'api/tests/ml-platform-model.integration.test.mts': 1,
  'api/tests/otp-ratelimit-and-deadlock.integration.test.mts': 1,
  'api/tests/reminder-sms.integration.test.mts': 1,
  'api/tests/reward-delivery-guard.integration.test.mts': 1,
  'api/tests/rewards.integration.test.mts': 1,
  'api/tests/sms-transport-failclosed.integration.test.mts': 1,
  'api/tests/waitlist-flow.integration.test.mts': 1,
};

const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'else', 'yield', 'await', 'do']);

/** همه‌ی فراخوانی‌هایِ `beforeEach(`/`afterEach(` در عمقِ صفر، با شماره‌ی خط. */
export function findModuleLevelHooks(src) {
  const hits = [];
  let depth = 0;
  let i = 0;
  let prevMeaningful = ';';
  let lastWord = '';
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;

  while (i < src.length) {
    const c = src[i];
    const c2 = src[i + 1];

    if (c === '/' && c2 === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl; continue; }
    if (c === '/' && c2 === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 2; continue; }

    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          let d = 1; i += 2;
          while (i < src.length && d > 0) { if (src[i] === '{') d++; else if (src[i] === '}') d--; i++; }
          continue;
        }
        i++;
      }
      prevMeaningful = quote; lastWord = '';
      continue;
    }

    if (c === '/' && (/[(,=:&|!?+\-*%~^[{};]/.test(prevMeaningful) || KEYWORDS_BEFORE_REGEX.has(lastWord))) {
      i++;
      let inClass = false;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { i++; break; }
        else if (src[i] === '\n') break;
        i++;
      }
      while (i < src.length && /[a-z]/.test(src[i])) i++;
      prevMeaningful = '/'; lastWord = '';
      continue;
    }

    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (depth === 0 && HOOKS.includes(word) && prevMeaningful !== '.') {
        const after = src.slice(j).match(/^\s*\(/);
        if (after) hits.push({ hook: word, line: lineAt(i) });
      }
      lastWord = word;
      prevMeaningful = src[j - 1];
      i = j;
      continue;
    }

    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
    if (!/\s/.test(c)) { prevMeaningful = c; lastWord = ''; }
    i++;
  }
  return hits;
}

/** نمونه‌های ساختگی — هیچ‌کدام از مخزن نمی‌آیند؛ فقط ابزار را می‌سنجند. */
const MUST_FLAG = [
  ['هوکِ برهنه', "import { beforeEach } from 'node:test';\nbeforeEach(async () => { await x(); });\n", 1],
  ['afterEach با ارجاع', 'afterEach(clearBuckets);\n', 1],
  ['پس از بسته‌شدنِ یک describe', "describe('a', () => {\n  test('t', () => {});\n});\nbeforeEach(() => {});\n", 1],
  ['پس از regexِ دارای پرانتز', 'const R = /\\(/;\nbeforeEach(() => {});\n', 1],
  ['پس از return /x/ در یک تابع', 'function f() { return /[(]/.test(s); }\nafterEach(() => {});\n', 1],
  ['پس از رشته‌ی دارای آکولاد', "const s = '{{{';\nbeforeEach(() => {});\n", 1],
  ['پس از تمپلیتِ دارای ${}', 'const s = `${ {a: 1}.a }`;\nbeforeEach(() => {});\n', 1],
];
const MUST_NOT_FLAG = [
  ['داخلِ describe (تورفته)', "describe('a', () => {\n  beforeEach(() => {});\n});\n"],
  ['داخلِ describe در ستونِ صفر (شکلِ fraud)', "describe('a', () => {\n\nbeforeEach(() => {});\n\n});\n"],
  ['در رشته', "const s = 'beforeEach(';\n"],
  ['در کامنت', '// beforeEach(() => {})\n/* afterEach(x) */\n'],
  ['فراخوانیِ عضو', 'suite.beforeEach(() => {});\n'],
  ['شناسه‌ی مشابه', 'myBeforeEach(() => {});\nconst beforeEachCount = 1;\n'],
  ['هوکِ یک‌باره (خارج از دامنه)', 'before(async () => {});\nafter(async () => {});\n'],
];

function selfTest() {
  const bad = [];
  for (const [label, src, n] of MUST_FLAG) {
    const got = findModuleLevelHooks(src).length;
    if (got !== n) bad.push(`باید ${n} می‌دید، دید ${got}: ${label}`);
  }
  for (const [label, src] of MUST_NOT_FLAG) {
    const got = findModuleLevelHooks(src).length;
    if (got !== 0) bad.push(`نباید می‌دید، دید ${got}: ${label}`);
  }
  if (bad.length) {
    console.error('⛔ خودِ گارد خراب است — گیت اجرا نشد (این «صفر یافته» نیست):');
    for (const b of bad) console.error(`   ${b}`);
    process.exit(GATE_DID_NOT_RUN);
  }
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.mts') || p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function main() {
  selfTest();
  let files;
  try {
    if (!statSync(SCAN_DIR).isDirectory()) throw new Error('not a directory');
    files = walk(SCAN_DIR);
  } catch (e) {
    console.error(`⛔ ${relative(ROOT, SCAN_DIR)} خوانده نشد — گیت اجرا نشد: ${e.message}`);
    process.exit(GATE_DID_NOT_RUN);
  }
  if (files.length < 50) {
    console.error(`⛔ فقط ${files.length} فایل زیرِ ${relative(ROOT, SCAN_DIR)} دیده شد — دامنه مشکوک است، گیت اجرا نشد.`);
    process.exit(GATE_DID_NOT_RUN);
  }

  const found = {};
  for (const f of files) {
    const hits = findModuleLevelHooks(readFileSync(f, 'utf8'));
    if (hits.length) found[relative(ROOT, f).split(sep).join('/')] = hits;
  }

  if (process.argv.includes('--print-baseline')) {
    for (const [f, hits] of Object.entries(found).sort()) console.log(`  '${f}': ${hits.length},`);
    return;
  }

  const problems = [];
  for (const [f, hits] of Object.entries(found)) {
    const allowed = BASELINE[f] ?? 0;
    if (hits.length > allowed) {
      const where = hits.map((h) => `${h.hook}:${h.line}`).join(' ');
      problems.push(allowed === 0
        ? `تازه: ${f} (${where}) — هوک را داخلِ describe ِ همان فایل بگذار`
        : `بیشتر شد: ${f} ${allowed} → ${hits.length} (${where})`);
    }
  }
  for (const [f, allowed] of Object.entries(BASELINE)) {
    const now = found[f]?.length ?? 0;
    if (now < allowed) problems.push(`کوچک شد (پیشرفت): ${f} ${allowed} → ${now} — خطِ baseline را در همین کامیت به ${now} برسان یا پاکش کن`);
  }

  if (problems.length) {
    console.error('');
    console.error('✗ هوکِ هر-تستِ سطحِ ماژول در api/tests — با baseline هم‌داستان نیست (BE-14):');
    for (const p of problems) console.error(`    ${p}`);
    console.error('');
    console.error('  runner همه‌ی فایل‌ها را در یک پردازه اجرا می‌کند؛ beforeEach/afterEach ِ بیرونِ describe');
    console.error('  پیش/پس از *هر* تستِ کلِ سوئیت اجرا می‌شود. یک throw در آن، کلِ سوئیت را قرمز می‌کند.');
    process.exit(1);
  }

  const total = Object.values(found).reduce((s, h) => s + h.length, 0);
  console.log(`✓ هوکِ هر-تستِ سطحِ ماژول: ${Object.keys(found).length} فایل / ${total} هوک، همه در baseline (${files.length} فایلِ اسکن‌شده) — و اسکنر روی ${MUST_FLAG.length + MUST_NOT_FLAG.length} نمونه‌ی ساختگی ثابت کرد می‌بیند و اشتباه نمی‌بیند.`);
}

main();
