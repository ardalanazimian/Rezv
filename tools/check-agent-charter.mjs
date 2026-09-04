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

// نامِ هر عاملِ واقعاً موجود — برای اعتبارسنجیِ فهرستِ scope در Agent(...).
const agentStems = new Set(files.map((f) => f.slice(0, -3)));

// گرافِ spawn: هر عامل → مجموعه‌ی نام‌هایی که واقعاً در Agent(...)ِ خودش
// scope کرده (فقط نام‌های موجود؛ خودارجاعی جدا و با پیامِ اختصاصی‌اش
// می‌گیریم، پس اینجا وارد نمی‌شود). بعد از حلقه با DFS چرخه‌ی طولِ ≥۲ را
// روی همین گراف پیدا می‌کنیم — همان خطرِ omitِ reviewer، یک لایه آن‌طرف‌تر:
// A عامل B را spawn می‌کند، B عامل A را — زنجیره‌ای که هیچ‌کس بیرونش چک نمی‌کند.
const agentGraph = new Map();

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

  // فهرستِ scope در Agent(...) باید یک کنترلِ واقعی باشد، نه تزئین. چهار شرط:
  // ۱) هیچ نامی نباید غایب باشد (.claude/agents/<name>.md وجود نداشته باشد)،
  // ۲) «reviewer» هرگز در هیچ فهرستی نباید باشد — عاملِ ممیزی‌شده نباید
  //    بازرسِ خودش را spawn کند، ۳) grantِ بازِ بدونِ scope (`Agent` تنها،
  //    بدونِ پرانتز) ممنوع است چون از هر فهرستِ scopeشده‌ای بازتر است و همان
  //    راهِ فرارِ reviewer-spawn را دوباره باز می‌کند، ۴) هیچ عاملی نباید خودش
  //    را در فهرستِ خودش داشته باشد — یک خودارجاعی همان زنجیره‌ی اختیارِ
  //    بی‌مرز را یک لایه پایین‌تر بازتولید می‌کند: subagent مأموریتِ عاملِ
  //    مادر را به ارث می‌برد، خودش هم Agent(...) دارد، و می‌تواند دوباره
  //    spawn کند — بدونِ آنکه هیچ ناظرِ بیرونی وجود داشته باشد. طولِ ۲+ (چرخه‌ی
  //    میانِ چند عامل) پایین‌تر، بعد از این حلقه، با DFS روی agentGraph گرفته می‌شود.
  let agentScopeOk = true;
  const tokens = toolsLine ? toolsLine.split(/,(?![^(]*\))/).map((t) => t.trim()) : [];
  for (const tok of tokens) {
    if (tok === 'Agent') {
      fails.push(`${f} — «Agent» بدونِ scope (بدونِ فهرستِ نام) ممنوع است؛ باید Agent(name1, name2, …) باشد — یک grantِ باز هر عاملی از جمله reviewer را قابلِ spawn می‌کند`);
      agentScopeOk = false;
      continue;
    }
    const scoped = /^Agent\(([^)]*)\)$/.exec(tok);
    if (!scoped) continue;
    const names = scoped[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) {
      fails.push(`${f} — Agent() با فهرستِ خالی؛ اگر spawn لازم نیست خودِ Agent را از تولز حذف کن`);
      agentScopeOk = false;
    }
    for (const n of names) {
      if (n === stem) {
        fails.push(`${f} — «${stem}» خودش را در فهرستِ Agent(...) دارد؛ یک عامل نباید خودش را spawn کند — همان زنجیره‌ی اختیارِ بی‌مرز که omitِ reviewer برایش طراحی شده بود، یک لایه پایین‌تر`);
        agentScopeOk = false;
      }
      if (n === 'reviewer') {
        fails.push(`${f} — «reviewer» در فهرستِ Agent(...) مجاز نیست؛ عاملِ ممیزی‌شده نباید بازرسِ خودش را spawn کند`);
        agentScopeOk = false;
      }
      if (!agentStems.has(n)) {
        fails.push(`${f} — Agent(...) نامِ «${n}» را دارد که .claude/agents/${n}.md وجود ندارد`);
        agentScopeOk = false;
      }
      // گراف را فقط با یال‌های معتبر و غیرِ خودارجاعی می‌سازیم — خودارجاعی
      // بالا با پیامِ اختصاصی‌اش گرفته شد؛ دوباره‌کاری در چرخه‌ی زیر لازم نیست.
      if (n !== stem && agentStems.has(n)) {
        if (!agentGraph.has(stem)) agentGraph.set(stem, new Set());
        agentGraph.get(stem).add(n);
      }
    }
  }

  rows.push({
    agent: stem,
    tier: TIER[model] ? `${TIER[model]} · ${model}` : model,
    skills: skills.length ? skills.map((s) => s.replace('rezervno-', '')).join(' + ') : '—',
    tools: toolsLine.includes('Agent(') ? `${nTools} (+spawn)` : String(nTools),
    ok: missing.length === 0 && skillKeys === 1 && nTools > 0 && agentScopeOk,
  });
}

// چرخه‌ی spawn میانِ چند عامل (طولِ ≥۲): A، B را scope می‌کند، B هم A را —
// خودارجاعی بالاتر گرفته شد؛ اینجا حالتِ چندنفره‌اش را با DFSِ استاندارد
// (رنگِ سفید/خاکستری/سیاه) روی کلِ agentGraph پیدا می‌کنیم. گراف کوچک است
// (حداکثر به تعدادِ فایل‌های .claude/agents)، پس بازگشتی بودن مشکلی ندارد.
const color = new Map();
const cyclesReported = new Set();
function dfsCycle(node, path) {
  color.set(node, 1);
  path.push(node);
  for (const next of agentGraph.get(node) ?? []) {
    if (color.get(next) === 1) {
      const idx = path.indexOf(next);
      const cyclePath = path.slice(idx).concat(next).join(' → ');
      if (!cyclesReported.has(cyclePath)) {
        cyclesReported.add(cyclePath);
        fails.push(`چرخه‌ی spawn پیدا شد: ${cyclePath} — زنجیره‌ی اختیارِ بی‌مرز که هیچ عاملی بیرونش نیست تا چکش کند`);
      }
    } else if (!color.get(next)) {
      dfsCycle(next, path);
    }
  }
  path.pop();
  color.set(node, 2);
}
for (const node of agentGraph.keys()) {
  if (!color.get(node)) dfsCycle(node, []);
}

// چرخه یک ویژگیِ چندفایلی است؛ هیچ ردیفِ تکی «ناقص» نیست، اما اگر جدول را
// دست‌نخورده بگذاریم، دقیقاً همان چیزی که فایل از خودش خواسته («یک ردیفِ
// ناقص در نگاهِ اول دیده می‌شود») نقض می‌شود: exit=1 درست است ولی هر دو ردیف
// ✓ می‌مانند. هر عاملی که در هر چرخه‌ی گزارش‌شده باشد را در جدول هم ✗ کن.
if (cyclesReported.size) {
  const cycleNodes = new Set();
  for (const p of cyclesReported) for (const n of p.split(' → ')) cycleNodes.add(n);
  for (const r of rows) if (cycleNodes.has(r.agent)) r.ok = false;
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
