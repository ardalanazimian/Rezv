#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  شمارشِ ارجاع‌ها به یک نماد — با AST، نه با grep.
//
//  چرا وجود دارد: منشورِ ممیزی می‌گوید «قبل از گزارشِ یک عدد، با پارسر
//  بشمار». یک تخمینِ «~۱۹» یک بار ۵۶ از آب درآمد. grep روی نامِ یک تابع،
//  کامنت‌ها، رشته‌ها و نامِ فیلدهای هم‌نام را هم می‌شمارد و در جهتِ
//  «چیزی نیست» هم می‌تواند اشتباه کند.
//
//  ⚠️ گاردِ ضدِ «سبزِ توخالی» (منشور §۳): اگر هیچ فایلی اسکن نشود یا خودِ
//  اعلانِ نماد پیدا نشود، این ابزار با کدِ ۲ می‌میرد. «صفر ارجاع» فقط وقتی
//  معنا دارد که ثابت شده باشد ابزار واقعاً چیزی را دیده — یعنی
//  فهرستِ اسکن نباید بی‌صدا به صفر فایل حل شود.
//
//  استفاده:
//    node tools/count-symbol-refs.mjs <symbol> [ریشه‌ها...]
//  کدهای خروج:
//    0 = اجرا شد (تعداد در خروجی) · 2 = ابزار نتوانست اندازه بگیرد
// ═══════════════════════════════════════════════════════════════════════
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const symbol = process.argv[2];
if (!symbol) { console.error('استفاده: node tools/count-symbol-refs.mjs <symbol> [roots...]'); process.exit(2); }
const roots = process.argv.length > 3 ? process.argv.slice(3) : ['src'];

const EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs']);
const SKIP = new Set(['node_modules', '.next', 'dist', 'build', '.git']);

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(p.slice(p.lastIndexOf('.')))) out.push(p);
  }
  return out;
}

const files = [];
for (const r of roots) walk(r, files);

if (files.length === 0) {
  console.error(`⛔ فهرستِ اسکن به صفر فایل حل شد (ریشه‌ها: ${roots.join(', ')}) — ابزار خراب است، نه اینکه ارجاعی نیست.`);
  process.exit(2);
}

const declarations = [];
const references = [];

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text === symbol) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const p = node.parent;
      const isDecl =
        (ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p) ||
         ts.isClassDeclaration(p) || ts.isVariableDeclaration(p)) && p.name === node;
      // `export { completeReferral }` و `import { completeReferral }` ارجاعِ
      // صدازدن نیستند ولی ارجاعِ ماژولی‌اند — جدا شمرده می‌شوند تا کسی
      // «صفر صداکننده» را با «صفر ارجاع» یکی نگیرد.
      const kind = isDecl ? 'decl'
        : (ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) ? 'import/export'
        : ts.isCallExpression(p) && p.expression === node ? 'call'
        : ts.isPropertyAccessExpression(p) && p.name === node ? 'property'
        : 'other';
      (isDecl ? declarations : references).push(
        `${relative(process.cwd(), f).replace(/\\/g, '/')}:${line}  [${kind}]`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (declarations.length === 0) {
  console.error(`⛔ اعلانِ «${symbol}» در ${files.length} فایلِ اسکن‌شده پیدا نشد — یا نام غلط است یا ابزار خراب. «صفر ارجاع» بی‌معنا می‌شود.`);
  process.exit(2);
}

const calls = references.filter(r => r.endsWith('[call]'));
console.log(`نماد: ${symbol}`);
console.log(`فایل‌های اسکن‌شده: ${files.length}   (ریشه‌ها: ${roots.join(', ')})`);
console.log(`اعلان‌ها: ${declarations.length}`);
for (const d of declarations) console.log(`  ${d}`);
console.log(`ارجاع‌های غیرِاعلان: ${references.length}   — که ${calls.length} تای‌شان صدازدنِ واقعی است`);
for (const r of references) console.log(`  ${r}`);
process.exit(0);
