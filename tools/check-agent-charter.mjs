#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ منشورِ عامل‌ها (سفارشِ ۳ب)
//
//  هر عاملی که این مخزن می‌سازد، به ارث می‌برد یا retrofit می‌کند باید **هر دو**
//  مهارت را preload کند: منشورِ Gen-Z و قانون‌نامه‌ی ممیزی. عاملی که این دو را
//  نداشته باشد، همان عاملی است که به دستور اعتراض نمی‌کند، heuristic را هوش
//  برچسب می‌زند، و ادعای اثبات‌نشده را «مشکلی ندارد» می‌خواند.
//
//  این اسکریپت **جدول را تولید می‌کند** تا گزارش یک ادعا نباشد: agent · tier ·
//  skills · tools · OK. یک ردیفِ ناقص در نگاهِ اول دیده می‌شود.
//
//  اجرا:  node tools/check-agent-charter.mjs
//  خروج:  ۰ همه کامل · ۱ با نامِ عاملِ ناقص
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS = join(REPO, '.claude/agents');
const SKILLS = join(REPO, '.claude/skills');
const REQUIRED = ['rezervno-audit-constitution', 'genz-agent-charter'];
const TIER = { opus: 1, sonnet: 2, haiku: 3 };

const fails = [];

// مهارتِ اعلام‌شده‌ای که فایلش وجود ندارد بی‌صدا هیچ کاری نمی‌کند — همان
// fake-greenی که سرِ mcpServers هم بود.
for (const s of REQUIRED) {
  if (!existsSync(join(SKILLS, s, 'SKILL.md'))) fails.push(`مهارتِ «${s}» فایل ندارد: .claude/skills/${s}/SKILL.md`);
}

const files = readdirSync(AGENTS).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
// قاعده‌ی ۵: نبودِ موضوع خطاست، نه عبور.
if (files.length === 0) { console.error('❌ هیچ عاملی پیدا نشد — گاردِ توخالی'); process.exit(1); }

const rows = [];
for (const f of files) {
  const raw = readFileSync(join(AGENTS, f), 'utf8').replace(/\r\n/g, '\n');
  const stem = f.slice(0, -3);
  if (!raw.startsWith('---\n')) { fails.push(`${f} — frontmatter ندارد`); continue; }
  const fm = raw.slice(4, raw.indexOf('\n---\n', 4));

  const name = /^name:\s*(\S+)/m.exec(fm)?.[1] ?? null;
  const model = /^model:\s*(\S+)/m.exec(fm)?.[1] ?? 'inherit';
  const toolsLine = /^tools:\s*(.+)$/m.exec(fm)?.[1] ?? '';

  // یک بلوکِ skills، نه دو تا. کلیدِ تکراری در YAML بی‌صدا اولی را دور می‌ریزد.
  const skillKeys = (fm.match(/^skills:\s*$/gm) ?? []).length;
  if (skillKeys > 1) fails.push(`${f} — ${skillKeys} کلیدِ skills دارد؛ YAML همه جز یکی را دور می‌ریزد`);
  const block = /^skills:\s*\n((?:\s*-\s*\S+\s*\n?)+)/m.exec(fm)?.[1] ?? '';
  const skills = [...block.matchAll(/-\s*(\S+)/g)].map((m) => m[1]);

  if (name !== stem) fails.push(`${f} — name «${name}» با نامِ فایل نمی‌خواند`);
  const missing = REQUIRED.filter((k) => !skills.includes(k));
  if (missing.length) fails.push(`${f} — منشورِ ناقص، غایب: ${missing.join('، ')}`);

  const nTools = toolsLine ? toolsLine.split(/,(?![^(]*\))/).length : 0;
  if (nTools === 0) fails.push(`${f} — هیچ ابزاری اعلام نشده`);

  rows.push({
    agent: stem,
    tier: TIER[model] ? `${TIER[model]} · ${model}` : model,
    skills: skills.length ? skills.map((s) => s.replace('rezervno-', '')).join(' + ') : '—',
    tools: toolsLine.includes('Agent(') ? `${nTools} (+spawn)` : String(nTools),
    ok: missing.length === 0 && skillKeys === 1 && nTools > 0,
  });
}

// ── جدول ──────────────────────────────────────────────────────────────
const w = (s, n) => String(s).padEnd(n);
console.log(`${w('agent', 34)}${w('tier', 12)}${w('skills preloaded', 44)}${w('tools', 12)}ok`);
console.log('-'.repeat(106));
for (const r of rows) {
  console.log(`${w(r.agent, 34)}${w(r.tier, 12)}${w(r.skills, 44)}${w(r.tools, 12)}${r.ok ? '✓' : '✗'}`);
}
console.log('-'.repeat(106));
console.log(`${rows.length} عامل · ${rows.filter((r) => r.ok).length} کامل · ${rows.filter((r) => !r.ok).length} ناقص`);

if (fails.length) {
  console.error(`\n❌ منشور ناقص است — ${fails.length} مورد:`);
  for (const x of fails) console.error('  • ' + x);
  console.error('\nعاملی بدونِ این دو مهارت به دستور اعتراض نمی‌کند و heuristic را هوش برچسب می‌زند.');
  process.exit(1);
}
