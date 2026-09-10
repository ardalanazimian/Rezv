#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  شمارشِ `catch`های بلعنده — با AST، نه با grep.
//
//  چرا وجود دارد: دستورِ ۰۴۴ عددِ **۷۱ بلعنده در ۳۵ فایل** را ثبت کرده و
//  ترتیبِ بازکردنشان را داده. آن عدد مبنای یک برنامه‌ی کاری است، و منشور
//  می‌گوید عددی که با پارسر شمرده نشده وارد دفتر نمی‌شود. grep روی `catch`
//  هم `catch`هایی را می‌شمارد که واقعاً چیزی برمی‌گردانند یا log می‌کنند —
//  یعنی در جهتِ «بزرگ‌تر» اشتباه می‌کند و کارِ بی‌خود می‌سازد.
//
//  تعریفِ «بلعنده» اینجا، عمداً باریک:
//    • `catch { }`  یا  `catch (e) { }`   ← بدنه‌ی کاملاً خالی
//    • `.catch(() => {})`  و خویشاوندانش: بدنه‌ی خالی یا یک **لیترالِ ثابت**
//      (`[]`، `{}`، `null`، `undefined`، `0`، `''`، `false`)
//  یعنی `catch` که log می‌کند، مقدارِ معنادار برمی‌گرداند، یا دوباره throw
//  می‌کند، بلعنده **نیست** و شمرده نمی‌شود.
//
//  ⚠️ این ابزار قضاوت نمی‌کند که یک بلعنده **بد** است. قاعده‌ی ۰۴۴ قضاوت را
//  می‌کند: «بلعیدن وقتی درست است که شکست پیامدی نداشته باشد که کسی متوجهش
//  شود، و غلط است وقتی چیزی را پنهان کند که قرار بوده برای پول، برای یک
//  رکورد، یا برای یک پیام اتفاق بیفتد.» این فقط سیاهه را می‌دهد.
//
//  گاردهای ضدِ «سبزِ توخالی»: فهرستِ اسکنِ خالی ⇦ کدِ ۲. هرگز «۰ بلعنده» به
//  دلیلِ ابزارِ خراب چاپ نمی‌شود.
//
//  اجرا:  node tools/count-swallowed-catches.mjs [ریشه‌ها...]
//  خروج:  0 = شمرده شد · 2 = ابزار نتوانست اندازه بگیرد
// ═══════════════════════════════════════════════════════════════════════
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = process.argv.length > 2 ? process.argv.slice(2) : ['src'];
const EXT = new Set(['.ts', '.tsx', '.mts', '.cts']);
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
  console.error(`⛔ فهرستِ اسکن به صفر فایل حل شد (ریشه‌ها: ${roots.join(', ')}) — ابزار خراب است، نه اینکه بلعنده‌ای نیست.`);
  process.exit(2);
}

// یک لیترالِ ثابت که یعنی «خطا را دور بریز و چیزِ بی‌خطر برگردان»
function isDiscardLiteral(node) {
  if (!node) return false;
  if (ts.isBlock(node)) return node.statements.length === 0;
  if (ts.isArrayLiteralExpression(node)) return node.elements.length === 0;
  if (ts.isObjectLiteralExpression(node)) return node.properties.length === 0;
  if (node.kind === ts.SyntaxKind.NullKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return true;
  if (ts.isIdentifier(node) && node.text === 'undefined') return true;
  if (ts.isNumericLiteral(node) && node.text === '0') return true;
  if (ts.isStringLiteral(node) && node.text === '') return true;
  if (ts.isVoidExpression(node)) return true;
  return false;
}

const hits = [];
let totalCatchClauses = 0;
let totalDotCatch = 0;

for (const f of files) {
  const text = readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
  const rel = relative(process.cwd(), f).replace(/\\/g, '/');
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  const visit = (node) => {
    if (ts.isCatchClause(node)) {
      totalCatchClauses++;
      if (node.block.statements.length === 0) {
        hits.push({ file: rel, line: lineOf(node), form: 'catch{}' });
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'catch'
    ) {
      totalDotCatch++;
      const [arg] = node.arguments;
      if (arg && (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))) {
        if (isDiscardLiteral(arg.body)) {
          hits.push({ file: rel, line: lineOf(node.expression.name), form: '.catch(()=>…)' });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (totalCatchClauses + totalDotCatch === 0) {
  console.error(`⛔ در ${files.length} فایل هیچ catchی از هیچ نوعی پیدا نشد — ابزار خراب است، نه اینکه کد بدونِ catch است.`);
  process.exit(2);
}

const byFile = new Map();
for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);

console.log(`فایل‌های اسکن‌شده: ${files.length}   (ریشه‌ها: ${roots.join(', ')})`);
console.log(`کلِ catchها: ${totalCatchClauses} بلوکِ catch + ${totalDotCatch} فراخوانِ .catch()`);
console.log(`بلعنده‌ها: ${hits.length} در ${byFile.size} فایل`);
console.log('');
for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  console.log(`  ${String(n).padStart(3)}  ${file}`);
}
console.log('');
for (const h of hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
  console.log(`    ${h.file}:${h.line}  ${h.form}`);
}
process.exit(0);
