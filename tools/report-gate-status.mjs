#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  فهرستِ گیت‌ها — اجراشده، نه به‌خاطرسپرده
//
//  چرا این ابزار وجود دارد: docs/audit/FOUNDER-REVIEW-HANDOFF.md §4 یک
//  جدولِ دست‌نویس از «کدِ خروجِ هر گیت روی این ماشین در یک روزِ خاص» بود.
//  چنین جدولی خودش دقیقاً همان چیزی است که این ممیزی از آن پرهیز می‌کند:
//  یک ادعا که تاریخِ انقضا دارد و کسی جز کدِ اجراشده نمی‌تواند تازه نگهش
//  دارد. این اسکریپت جدول را **هر بار از نو می‌سازد** — خودِ گیت‌ها را اجرا
//  می‌کند، کدِ خروجِ واقعی را می‌خواند، و هیچ نتیجه‌ای را از حافظه نمی‌گوید.
//
//  سه حالت، نه دو: هر گیت یکی از این‌هاست —
//    GREEN          — اجرا شد، کدِ خروج ۰
//    RED            — اجرا شد، کدِ خروجِ غیرِصفرِ «واقعی» (رد/انحراف/ممنوعیت)
//    COULD_NOT_RUN  — اصلاً اجرا نشد (پیش‌نیازِ غایب، پروسه spawn نشد، یا
//                     خودِ گیت با کدِ اختصاصی‌اش اعلام کرد که ندوید)
//    UNKNOWN        — عمداً اجرا نشد (نیاز به آرگومانی داشت که این‌جا
//                     تصمیمِ مستندی برایش گرفته نشد، یا اجرایش عملی/بیرونی بود)
//
//  RED در این طرح **هرگز** به هیچ‌وجه پاس شمرده نمی‌شود، و نبودِ نتیجه
//  (UNKNOWN) هم هرگز به‌عنوانِ پاس رندر نمی‌شود — قاعده‌ی ۵ همین‌جا هم صادق
//  است: نبودِ موضوع باید خطا/نامعلوم باشد، نه عبور.
//
//  ⚠️ محدودیتِ عمدی: این ابزار فقط گیت‌هایی را اجرا می‌کند که **صرفاً
//  ارزیابی**اند — چیزی نمی‌نویسند، دیپلوی نمی‌کنند، پیامک واقعی نمی‌فرستند،
//  و دیتابیسِ تولید را دست نمی‌زنند. هر گیتی که این شرط را نداشته باشد در
//  EXCLUDED_GATES با دلیل ثبت می‌شود، نه این‌که بی‌صدا حذف شود. یک اسکریپت
//  هم نباید عملی انجام دهد هم آن عمل را تأیید کند.
//
//  ⚠️ بدونِ allowlist: این ابزار **نمی‌داند** هر گیت باید چه نتیجه‌ای بدهد.
//  فقط چیزی که واقعاً رخ داد را گزارش می‌کند.
//
//  🚨 این گزارش‌گر است، نه گیت — و **همیشه با ۰ خارج می‌شود**، حتی وقتی
//  ردیف‌هایِ RED گزارش می‌کند. به CI یا به فهرستِ اجباریِ CLAUDE.md اضافه‌اش
//  نکن: یک مرحله‌ی همیشه-سبز که شبیهِ اجرا به‌نظر می‌رسد، قدیمی‌ترین نقصِ
//  ثبت‌شده‌ی این مخزن است (`--check`ِ گاردِ XSS که فقط کهنگی را می‌سنجید، و
//  jobِ boot-path که هیچ سروری بالا نمی‌آورد — هر دو در قاعده‌ی ۲ CLAUDE.md).
//
//  ۲۰۲۶-۰۹-۰۵: به همین دلیل از `gate-inventory.mjs` به این نام تغییر کرد.
//  هر چهار `tools/gate-*.mjs`ی دیگر با `process.exit(1)` رد می‌کنند؛ این یکی
//  هیچ خروجِ غیرصفری ندارد. پیشوندِ `gate-` در این مخزن یعنی «اگر برآورده
//  نشد، غیرصفر خارج شو» — و این فایل آن قول را نمی‌دهد. اگر روزی خواستی
//  حکم بدهد، ارزشِ اصلی‌اش (بی‌طرفی) را از دست می‌دهد؛ به‌جایش یک گیتِ جدا بساز.
//
//  اجرا:  node tools/report-gate-status.mjs
//  خروجی: جدولِ Markdown روی stdout + JSONِ کامل و لاگِ خامِ هر گیت در
//          audit/round-20/gate-inventory/
// ═══════════════════════════════════════════════════════════════════════

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(REPO, 'audit/round-20/gate-inventory');
mkdirSync(OUT_DIR, { recursive: true });

// ── هویتِ اجرا — چون این جدول ذاتاً محلی است ──────────────────────────
const RUN_META = {
  generated_at: new Date().toISOString(),
  hostname: os.hostname(),
  platform: `${process.platform} ${os.release()}`,
  node_version: process.version,
  cwd: REPO,
};

// ── کدهایِ اختصاصیِ «اجرا نشد» که خودِ گیت اعلام می‌کند ────────────────
// این‌ها باید با خودِ گیت هم‌خوان بمانند — برای check-schema-drift.sh:
// ۰=بدونِ انحراف · ۱=انحرافِ واقعی · ۲=«did NOT run» (پیش‌نیازِ غایب/خراب).
const SCHEMA_DRIFT_COULD_NOT_RUN = [2];

// ── فهرستِ ID‌هایِ تصمیمِ ثبت‌شده — از خودِ دفتر خوانده می‌شود، نه هاردکد ──
// اگر فردا ردیفی اضافه/کم شود، این ابزار خودش را با آن هماهنگ می‌کند.
function discoverDecisionIds() {
  const ledger = join(REPO, 'docs/DECISIONS.md');
  if (!existsSync(ledger)) return [];
  const text = readFileSync(ledger, 'utf8').replace(/\r\n/g, '\n');
  const ids = [...text.matchAll(/^##\s+(D-\d+)\s+—/gm)].map((m) => m[1]);
  return [...new Set(ids)];
}
const DECISION_IDS = discoverDecisionIds();

// ── تعریفِ گیت‌ها ────────────────────────────────────────────────────
// هر ردیف: { id, area, cmd, args, cwd?, timeoutMs?, couldNotRunExitCodes?,
//            couldNotRunLabel?, why }
// «why» فقط برایِ خوانایی است؛ در طبقه‌بندی اثری ندارد (هیچ allowlistی نیست).
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

const GATES = [
  {
    id: 'agent-charter',
    area: 'Agent charter',
    cmd: 'node',
    args: ['tools/check-agent-charter.mjs'],
    why: 'هر عاملِ .claude/agents باید هر دو مهارتِ الزامی را preload کرده باشد',
  },
  {
    id: 'control-bytes',
    area: 'Control bytes',
    cmd: 'node',
    args: ['tools/check-control-bytes.mjs'],
    why: 'بایتِ کنترلیِ نامرئی (مثلِ heredocی که \\b را به 0x08 تبدیل می‌کند) می‌تواند گاردی را بی‌صدا از کار بیندازد',
  },
  {
    id: 'doc-staleness',
    area: 'Doc staleness',
    cmd: 'node',
    args: ['tools/check-doc-staleness.mjs'],
    why: 'اسنادِ کهنه که با سورس نمی‌خوانند؛ توجه: این فایل الان توسطِ عاملِ دیگری هم ویرایش می‌شود، پس نتیجه ممکن است لحظه‌به‌لحظه فرق کند',
  },
  {
    id: 'classic-scripts',
    area: 'Classic scripts',
    cmd: 'sh',
    args: ['tools/check-classic-scripts.sh'],
    why: 'اسکریپت‌هایِ کلاسیکِ business/company باید با پارسرِ واقعیِ V8 پارس شوند',
  },
  {
    id: 'fonts',
    area: 'Fonts',
    cmd: 'python',
    args: ['tools/check-fonts.py'],
    why: 'فونتِ self-hosted باید واقعاً موجود/جاسازی‌شده باشد، نه فقط اعلام‌شده',
  },
  {
    id: 'schema-drift',
    area: 'Schema drift',
    cmd: 'sh',
    args: ['tools/check-schema-drift.sh'],
    timeoutMs: 15 * 60 * 1000,
    couldNotRunExitCodes: SCHEMA_DRIFT_COULD_NOT_RUN,
    couldNotRunLabel:
      'خودِ گیت اعلام کرد اجرا نشد (کدِ خروجِ ۲ — پیش‌نیازِ غایب/خراب، مثلِ psql). جزئیات در لاگِ خام.',
    why: 'می‌سنجد که مسیرِ تولید (migrate deploy + apply-sql) هرچه Prisma لازم دارد را دارد؛ نیازمندِ psql و یک Postgresِ مدیریتی است',
  },
  ...(['local/rezervno_verify', 'production'].map((scope) => ({
    id: `destructive-${scope.replace(/[^a-z0-9]+/gi, '_')}`,
    area: `A1 destructive (--scope ${scope})`,
    cmd: 'node',
    args: ['tools/gate-destructive.mjs', '--scope', scope],
    why:
      scope === 'local/rezervno_verify'
        ? 'تنها scopeی که رکوردِ درِیلِ واقعی دارد (audit/drills)'
        : 'scopeِ تولید — عمداً بدونِ رکورد؛ رد شدن اینجا خودش یک یافته‌ی معتبر است، نه «نتوانستیم بسنجیم»',
  }))),
  {
    id: 'deploy',
    area: 'A2 deploy/DNS',
    cmd: 'node',
    args: ['tools/gate-deploy.mjs'],
    why: 'بدونِ آرگومان اجرا می‌شود؛ شواهدش را از audit/staging/golden-journeys.json می‌خواند',
  },
  ...DECISION_IDS.map((id) => ({
    id: `decision-${id}`,
    area: `A3 decision (--id ${id})`,
    cmd: 'node',
    args: ['tools/gate-decision.mjs', '--id', id],
    why: `ردیفِ «${id}» از docs/DECISIONS.md به‌صورتِ خودکار کشف شد (نه هاردکد)`,
  })),
  {
    id: 'send',
    area: 'A4 real sends (--recipients 1)',
    cmd: 'node',
    args: ['tools/gate-send.mjs', '--recipients', '1'],
    why: 'فقط شواهدِ audit/sms/transport-proof.json را می‌خواند — هیچ پیامکی نمی‌فرستد',
  },
];

// اگر docs/DECISIONS.md هیچ IDی نداشت، این را باید UNKNOWN گزارش کنیم —
// نبودِ موضوع خطاست، نه سکوت.
if (DECISION_IDS.length === 0) {
  GATES.push({
    id: 'decision-none',
    area: 'A3 decision (--id <ID>)',
    unknown: true,
    reason:
      'هیچ ردیفِ «## D-xxx —» در docs/DECISIONS.md پیدا نشد؛ گیت بدونِ id قابلِ اجرا نیست و یک id دلبخواه اختراع نشد',
  });
}

// ── گیت‌هایی که *عمداً* اجرا نشدند — با دلیل، نه سکوت ───────────────────
// نبودِ نتیجه هرگز نباید مثلِ پاس خوانده شود؛ برایِ همین این‌ها را هم در
// خروجیِ نهایی به‌عنوانِ UNKNOWN/EXCLUDED چاپ می‌کنیم.
const EXCLUDED_GATES = [
  {
    area: 'A1 restore drill executor (tools/restore-drill.sh)',
    reason:
      'اجراکننده است، نه گیت: واقعاً pg_dump/CREATE DATABASE/pg_restore/DROP DATABASE انجام می‌دهد. ' +
      'خودِ فایل هم تصریح می‌کند اجراکننده و تفسیرکننده (gate-destructive.mjs) عمداً جدا نگه داشته شده‌اند. ' +
      'این ابزار طبقِ محدودیتِ صریحِ خودش («فقط ارزیابی») چنین چیزی را اجرا نمی‌کند.',
  },
  {
    area: 'boot-path (tools/check-boot-path.sh)',
    reason:
      'یک Postgresِ کاملاً خالی و دورانداختنی می‌سازد/می‌شکند و برایِ ۹ دقیقه یک سرورِ واقعی روی یک پورت بالا می‌آورد — ' +
      'یک jobِ سنگینِ CI است (ci.yml)، نه یک چکِ سبکِ محلی؛ به‌علاوه cwd را عوض می‌کند و روی وضعیتِ DB اثر می‌گذارد.',
  },
  {
    area: 'CI-only jobs (build, test, image-build, security, observability, e2e, design-system, standalone, seo, landing, base-freshness)',
    reason:
      'در .github/workflows/ci.yml تعریف شده‌اند، نیازمندِ سرویس‌های Postgres/Redisِ CI، Docker build، یا مرورگرهایِ Playwright‌اند. ' +
      'این‌ها jobِ CI‌اند نه گیتِ محلیِ سبک؛ اجرایشان اینجا محدودیتِ «بدونِ عملِ سنگین/بیرونی» را نقض می‌کند.',
  },
];

// ── اجرا ─────────────────────────────────────────────────────────────
function runGate(gate) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(gate.cmd, gate.args, {
    cwd: gate.cwd ?? REPO,
    encoding: 'utf8',
    timeout: gate.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    env: process.env,
  });
  const finishedAt = new Date().toISOString();

  const logPath = join(OUT_DIR, `${gate.id}.log`);
  const rawLog =
    `$ ${gate.cmd} ${gate.args.join(' ')}\n` +
    `cwd: ${gate.cwd ?? REPO}\n` +
    `started: ${startedAt}\n` +
    `finished: ${finishedAt}\n` +
    `status: ${result.status === null ? '(null)' : result.status}\n` +
    `signal: ${result.signal ?? '(none)'}\n` +
    `spawn error: ${result.error ? String(result.error) : '(none)'}\n` +
    `\n--- stdout ---\n${result.stdout ?? ''}\n` +
    `\n--- stderr ---\n${result.stderr ?? ''}\n`;
  writeFileSync(logPath, rawLog, 'utf8');

  return { gate, result, startedAt, finishedAt, logPath };
}

function classify({ gate, result }) {
  if (result.error) {
    return { state: 'COULD_NOT_RUN', note: `spawn نشد: ${result.error.message ?? result.error}` };
  }
  if (result.signal) {
    return { state: 'COULD_NOT_RUN', note: `با سیگنالِ ${result.signal} کشته شد (تایم‌اوت؟)` };
  }
  if (result.status === 127) {
    return { state: 'COULD_NOT_RUN', note: 'کدِ خروجِ ۱۲۷ — مفسر/دستورِ داخلیِ اسکریپت روی PATH نیست' };
  }
  if (gate.couldNotRunExitCodes?.includes(result.status)) {
    return { state: 'COULD_NOT_RUN', note: gate.couldNotRunLabel ?? 'خودِ گیت اعلام کرد اجرا نشد' };
  }
  if (result.status === 0) {
    return { state: 'GREEN', note: null };
  }
  return { state: 'RED', note: null };
}

const rows = [];

for (const gate of GATES) {
  if (gate.unknown) {
    rows.push({ area: gate.area, command: '—', exit: '—', state: 'UNKNOWN', note: gate.reason, log: null });
    continue;
  }
  const cmdLabel = `${gate.cmd} ${gate.args.join(' ')}`;
  process.stderr.write(`→ در حالِ اجرا: ${cmdLabel}\n`);
  const outcome = runGate(gate);
  const { state, note } = classify(outcome);
  const exitLabel = outcome.result.error
    ? '(spawn نشد)'
    : outcome.result.status === null
      ? `(null، سیگنال ${outcome.result.signal})`
      : String(outcome.result.status);
  rows.push({
    area: gate.area,
    command: cmdLabel,
    exit: exitLabel,
    state,
    note,
    log: `audit/round-20/gate-inventory/${gate.id}.log`,
  });
  process.stderr.write(`   → ${state} (exit=${exitLabel})\n`);
}

for (const excluded of EXCLUDED_GATES) {
  rows.push({ area: excluded.area, command: '(اجرا نشد)', exit: '—', state: 'UNKNOWN', note: excluded.reason, log: null });
}

// ── خروجیِ ماشین‌خوان کامل ─────────────────────────────────────────────
const jsonPath = join(OUT_DIR, 'gate-inventory.json');
writeFileSync(jsonPath, JSON.stringify({ meta: RUN_META, rows }, null, 2), 'utf8');

// ── جدولِ Markdown (جایگزینِ §۴ی FOUNDER-REVIEW-HANDOFF.md) ────────────
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const lines = [];
lines.push(
  `> تولیدشده توسطِ \`node tools/report-gate-status.mjs\` در ${RUN_META.generated_at} روی ` +
    `${RUN_META.hostname} (${RUN_META.platform}, node ${RUN_META.node_version}). ` +
    `**این جدول یک عکسِ لحظه‌ای است، نه یک ادعای دائمی — دوباره اجرا کن، اعتماد نکن.**`,
);
lines.push('');
lines.push('| Gate | Command | Exit | State | Note |');
lines.push('|---|---|---|---|---|');
for (const r of rows) {
  const noteWithLog = r.log ? [r.note, `evidence: \`${r.log}\``].filter(Boolean).join(' — ') : (r.note ?? '');
  lines.push(`| ${esc(r.area)} | \`${esc(r.command)}\` | ${esc(r.exit)} | ${r.state} | ${esc(noteWithLog)} |`);
}
const markdown = lines.join('\n') + '\n';

const mdPath = join(OUT_DIR, 'gate-inventory.md');
writeFileSync(mdPath, markdown, 'utf8');

console.log(markdown);
console.log(`\n(JSONِ کامل: ${jsonPath})`);
console.log(`(لاگِ خامِ هر گیت: audit/round-20/gate-inventory/<id>.log)`);

const nGreen = rows.filter((r) => r.state === 'GREEN').length;
const nRed = rows.filter((r) => r.state === 'RED').length;
const nCNR = rows.filter((r) => r.state === 'COULD_NOT_RUN').length;
const nUnk = rows.filter((r) => r.state === 'UNKNOWN').length;
console.error(`\n${rows.length} ردیف — ${nGreen} GREEN · ${nRed} RED · ${nCNR} COULD_NOT_RUN · ${nUnk} UNKNOWN`);
