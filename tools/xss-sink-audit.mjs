#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  xss-sink-audit.mjs — اسکنرِ خودکارِ sinkهایِ خطرناکِ XSS
//
//  چرا این اسکریپت: esc() در shared/js/format.js تنها پیاده‌سازیِ کانونیِ
//  ضدِّ XSS سه پنل است و خودش تست شده (api/tests/esc.test.mts) — ولی تا
//  امروز هیچ چیزی تضمین نمی‌کرد که همه‌ی innerHTML/insertAdjacentHTML/... در
//  apps/customer|business|company واقعاً از آن عبور می‌کنند. این اسکریپت
//  همه‌ی sinkهای شناخته‌شده را با regex محافظه‌کارانه پیدا می‌کند، هرکدام
//  را طبقه‌بندی می‌کند (safe_static / escaped / dom_api_safe / unsafe / review)
//  و یک گزارشِ ماشین‌خوان (JSON) + انسان‌خوان (Markdown) می‌سازد.
//
//  محدودیتِ صادقانه: این طبقه‌بندی heuristic است، نه AST-level dataflow
//  واقعی (که نیازِ یک analyzer کامل جاوااسکریپت دارد و از دامنه‌ی این ابزار
//  خارج است). ولی heuristic ≠ سرسری: عبارتِ sink با یک اسکنرِ واقعیِ
//  رشته/template/پرانتز تا پایانِ statement خوانده می‌شود (grabExpression) و
//  بعد **تک‌تکِ** عملوندها و interpolationها جداگانه ارزیابی می‌شوند
//  (evalExpr) — بدترینشان تعیین‌کننده است. یعنی یک esc() در میانِ بیست
//  interpolation، نوزده‌تایِ دیگر را امن اعلام نمی‌کند.
//  هرچه اثبات‌پذیر نباشد `unsafe` می‌ماند و در فیلدِ `unproven`ِ گزارش دقیقاً
//  نام برده می‌شود — هرگز خوش‌بینانه `escaped`/`safe_static` فرض نمی‌شود.
//
//  اجرا: node tools/xss-sink-audit.mjs [--paths p1,p2,...]
//        node tools/xss-sink-audit.mjs --explain apps/x/y.js[:42]   ← استدلالِ ابزار
//  خروجی: tools/xss-sink-audit-report.json + docs/XSS_SINK_AUDIT.md
//  کدِ خروج: 0 اگر zero «unsafe» زیرِ apps/*+shared/js باشد، وگرنه 1.
// ═══════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from './internal/simple-glob.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const DEFAULT_SCAN_PATHS = ['apps/customer', 'apps/business', 'apps/company', 'shared/js'];
const REPORT_ONLY_PATHS = ['demo-mvp', 'standalone']; // اسکن می‌شن ولی exit code رو تعیین نمی‌کنن
const EXTENSIONS = ['.js', '.mjs', '.ts', '.tsx', '.jsx', '.html'];

// ── الگوهایِ sink — هرکدام یک regex + نوع ──
const SINK_PATTERNS = [
  { kind: 'innerHTML', re: /\.innerHTML\s*=/g },
  { kind: 'outerHTML', re: /\.outerHTML\s*=/g },
  { kind: 'insertAdjacentHTML', re: /\.insertAdjacentHTML\s*\(/g },
  { kind: 'document.write', re: /\bdocument\.write(?:ln)?\s*\(/g },
  { kind: 'eval', re: /\beval\s*\(/g },
  { kind: 'new Function', re: /\bnew\s+Function\s*\(/g },
  { kind: 'jquery.html', re: /\$\([^)]*\)\.html\s*\(/g },
];

/** رد کردنِ یک رشته‌یِ تک/دابل‌کوت از کوتیشنِ باز تا کوتیشنِ بسته‌یِ متناظر. */
function skipQuoted(text, start, cap) {
  const q = text[start];
  let i = start + 1;
  while (i < cap) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === q) return i + 1;
    i++;
  }
  return cap;
}

/**
 * رد کردنِ یک template literal از backtickِ باز تا backtickِ بستنِ **متناظر**.
 *
 * ⚠️ رفعِ باگِ سومِ این تابع (۲۰۲۶-۰۸-۲۳): نسخه‌یِ قبلی صرفاً تا «اولین
 * backtickِ بدونِ backslash» جلو می‌رفت. در این کدبیس templateهایِ تودرتو
 * (`...${arr.map(x=>`<li>...`).join('')}...`) بسیار رایج‌اند، و آنجا اولین
 * backtickِ بعدی، backtickِ *بازِ* templateِ داخلی است نه بستنِ بیرونی —
 * پس عبارت وسطِ کار بریده می‌شد و esc()هایِ عمیق‌تر اصلاً دیده نمی‌شدند.
 * نتیجه: انبوهی «unsafe»ِ کاذب رویِ کدی که کاملاً escape شده بود.
 * حالا `${...}` به‌صورتِ بازگشتی رد می‌شود.
 */
function skipTemplate(text, start, cap) {
  let i = start + 1;
  while (i < cap) {
    const c = text[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return i + 1;
    if (c === '$' && text[i + 1] === '{') { i = skipBalanced(text, i + 1, cap, '{', '}'); continue; }
    i++;
  }
  return cap;
}

/**
 * balance کردنِ یک بلوکِ کد — `(...)`ِ یک فراخوانی یا `{...}`ِ داخلِ `${}`.
 * رشته‌ها و templateهایِ تودرتو کامل رد می‌شوند تا پرانتز/آکولادِ داخلِ یک
 * رشته (`'}'`) عمقِ شمارش را خراب نکند.
 */
function skipBalanced(text, start, cap, open, close) {
  let depth = 0;
  let i = start;
  while (i < cap) {
    const c = text[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { i = skipTemplate(text, i, cap); continue; }
    if (c === "'" || c === '"') { i = skipQuoted(text, i, cap); continue; }
    if (c === open) { depth++; i++; continue; }
    if (c === close) { depth--; i++; if (depth === 0) return i; continue; }
    i++;
  }
  return cap;
}

/**
 * تکه‌کردنِ یک عبارت رویِ یک جداکننده‌یِ **سطحِ بالا** (`,` بینِ آرگومان‌ها یا
 * `+` بینِ عملوندهایِ concatenation). رشته/template/گروهِ تودرتو کامل رد
 * می‌شوند تا `,`ِ داخلِ `icon('x',{size:1})` یا `+`ِ داخلِ یک رشته، اشتباهی
 * جداکننده حساب نشود.
 */
function splitTopLevel(src, delim) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { i = skipTemplate(src, i, src.length); continue; }
    if (c === "'" || c === '"') { i = skipQuoted(src, i, src.length); continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; i++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; i++; continue; }
    if (depth === 0 && c === delim) { parts.push(src.slice(start, i)); start = i + 1; }
    i++;
  }
  parts.push(src.slice(start));
  return parts;
}

// کاراکترهایی که اگر آخرِ یک خط بیایند یعنی عبارت در خطِ بعد ادامه دارد،
// یا اگر اولِ خطِ بعد بیایند یعنی همان عبارتِ خطِ قبل است (ASIِ ساده‌شده).
const CONTINUES_AFTER = /[+\-*/%?:,.&|=<>({[]$/;
const CONTINUES_BEFORE = /^[+\-*/%?:,.&|)}\]]/;

/**
 * گرفتنِ «عبارتِ کاملِ» sink از رویِ متنِ خامِ فایل.
 *
 * ⚠️ بازنویسی (۲۰۲۶-۰۸-۲۳). نسخه‌ی قبلی «تا اولین جداکننده جلو برو، بعد
 * همان یکی را ببند» بود؛ سه‌جور می‌شکست و هر سه‌تا در همین کدبیس واقعی بودند:
 *   ۱. templateِ تودرتو — اولین backtickِ بعدی، backtickِ *بازِ* templateِ
 *      داخلی بود نه بستنِ بیرونی (حالا در skipTemplate حل شده).
 *   ۲. RHSِ زنجیره‌ای مثلِ `arr.slice(0,4).map(...).join('')` — روی `)`ِ
 *      همان `slice(0,4)` متوقف می‌شد و اصلاً به template نمی‌رسید. (خودِ
 *      ابزار این را در کامنتِ «الگو ۷»ِ جدولِ override به‌عنوانِ محدودیت
 *      ثبت کرده بود.)
 *   ۳. concatenation مثلِ `'<a>' + esc(x) + '</a>'` — بعدِ بستنِ اولین
 *      کوتیشن تمام می‌شد و esc()ِ بعدش را نمی‌دید.
 * حالا کلِ RHS تا پایانِ واقعیِ statement خوانده می‌شود: رشته/template/
 * کامنت کامل رد می‌شوند و `()`/`[]`/`{}` بالانس می‌شود؛ پایان = `;` در عمقِ
 * صفر، یا بسته‌شدنِ یک گروهِ بیرونی، یا خطِ جدیدی که ادامه‌ی عبارت نیست.
 */
function grabExpression(text, matchStart, searchFrom = matchStart) {
  const CAP = 20000;
  const n = Math.min(text.length, matchStart + CAP);

  // sinkهایِ call-style (`insertAdjacentHTML(`, `document.write(`, `eval(`، …):
  // خودِ matchِ regex به `(` ختم می‌شود؛ کلِ آرگومان‌ها تا `)`ِ متناظر.
  if (text[searchFrom - 1] === '(') {
    return text.slice(matchStart, skipBalanced(text, searchFrom - 1, n, '(', ')'));
  }

  // sinkهایِ انتساب (`.innerHTML =` / `.outerHTML =`): از شروعِ RHS تا پایانِ
  // statement. فاصله و خطِ خالیِ بینِ `=` و شروعِ RHS رد می‌شود (این کدبیس
  // زیاد `el.innerHTML =\n  '<div>…'` دارد).
  let i = searchFrom;
  while (i < n && /\s/.test(text[i])) i++;
  const rhsStart = i;
  let depth = 0;
  while (i < n) {
    const c = text[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { i = skipTemplate(text, i, n); continue; }
    if (c === "'" || c === '"') { i = skipQuoted(text, i, n); continue; }
    if (c === '/' && text[i + 1] === '/') { const nl = text.indexOf('\n', i); i = nl < 0 ? n : nl; continue; }
    if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i); i = e < 0 ? n : e + 2; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; i++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break; // گروهِ بیرونی بسته شد → statement تمام است
      depth--; i++; continue;
    }
    if (depth === 0 && c === ';') break;
    if (depth === 0 && c === '\n') {
      const before = text.slice(rhsStart, i).trimEnd();
      let k = i;
      while (k < n && /\s/.test(text[k])) k++;
      if (CONTINUES_AFTER.test(before) || CONTINUES_BEFORE.test(text.slice(k, k + 2))) { i = k; continue; }
      break;
    }
    i++;
  }
  return text.slice(matchStart, i);
}

// ── شناساییِ interpolationهایِ «قابلِ‌اعتماد» داخلِ یک template literal ──
// اینها نه رشته‌یِ ثابتِ خالص‌اند، نه از esc() رد شدن — ولی دیتایِ
// کاربر/API هم نیستن؛ حالتِ محلیِ UI (نامِ تب، بولین) یا خروجیِ کتابخانه‌ی
// آیکنِ ثابتِ پروژه‌اند. برایِ جلوگیری از هشدارِ کاذبِ انبوه رویِ صدها خطِ
// «${cond?'a':'b'}» یا «${icon('x')}»، این الگوها را از اعتبارسنجی معاف
// می‌کنیم — ولی محافظه‌کارانه: اگر حتی یک interpolation با این الگوها
// مچ نشه، کلِ sink همچنان unsafe می‌مونه.
// نامِ توابعِ کمکیِ شناخته‌شده‌یِ پروژه که خروجیشان یا HTMLِ ثابت/امن است
// (icon) یا رشته‌ی صرفاً عددی/escape‌شده (fa/fmtFa/esc/chatEsc/...). این
// فهرست دستی نگه‌داشته می‌شود و باید با shared/js/format.js + الگویِ
// تکرارشده در apps/* هماهنگ بماند.
const TRUSTED_CALL_NAMES = ['icon', 'fa', 'fmtFa', 'esc', 'chatEsc', 'faTime', 'faRelative', 'faD', 'toFaDigits', 'fnl'];
const TRUSTED_CALL_RE = new RegExp(`^(?:${TRUSTED_CALL_NAMES.join('|')})\\s*\\(`);

const TRUSTED_INTERP_PATTERNS = [
  /^[a-zA-Z_$][\w.]*\s*===?\s*['"][^'"]*['"]\s*\?\s*['"][^'"]*['"]\s*:\s*['"][^'"]*['"]$/, // cond==='x'?'a':'b'
  /^!?[a-zA-Z_$][\w.]*\s*\?\s*['"][^'"]*['"]\s*:\s*['"][^'"]*['"]$/,                        // cond?'a':'b'
  TRUSTED_CALL_RE,        // icon(...)/fa(...)/esc(...)/... — رجوع کن به TRUSTED_CALL_NAMES
  /^i\d*$/, /^idx$/, /^index$/,                                                              // اندیسِ حلقه
  /^\d+$/,                // عددِ خام
  /^['"][^'"]*['"]$/,     // رشته‌ی ثابتِ تودرتو
];

/**
 * ترنری‌هایی که هر دو شاخه‌شون یک فراخوانیِ تابعِ قابلِ‌اعتماد یا رشته‌یِ
 * ثابته — مثلِ `cond?icon('a'):icon('b')` یا `x?fa(n):'—'`. جدا از
 * TRUSTED_INTERP_PATTERNS چون نیازِ چک‌کردنِ هر دو شاخه به‌صورتِ بازگشتی داره،
 * نه یک regexِ تخت.
 */
function isTrustedTernary(expr) {
  const m = expr.trim().match(/^!?[a-zA-Z_$][\w.]*(?:\s*[=!]==?\s*['"][^'"]*['"])?\s*\?\s*([\s\S]+)\s*:\s*([\s\S]+)$/);
  if (!m) return false;
  const [, a, b] = m;
  const branchOk = (s) => {
    const t = s.trim();
    return TRUSTED_CALL_RE.test(t) || /^['"][^'"]*['"]$/.test(t) || t === "''" || t === '""';
  };
  return branchOk(a) && branchOk(b);
}

function isTrustedInterpolation(inner) {
  const t = inner.trim();
  return TRUSTED_INTERP_PATTERNS.some((re) => re.test(t)) || isTrustedTernary(t);
}

/**
 * همه‌ی `${...}`هایِ **سطحِ بالایِ** یک template literal را استخراج می‌کند.
 * نسخه‌ی قبلی فقط `{`/`}` را می‌شمرد؛ یعنی یک آکولادِ داخلِ رشته یا داخلِ
 * متنِ HTMLِ یک templateِ تودرتو عمقِ شمارش را خراب می‌کرد. حالا از همان
 * skipBalanced استفاده می‌شود که رشته‌ها و templateهایِ تودرتو را کامل رد
 * می‌کند، پس هر عضوِ خروجی دقیقاً یک interpolationِ کامل است.
 */
function extractInterpolations(expr) {
  const out = [];
  const n = expr.length;
  let i = expr[0] === '`' ? 1 : 0;
  while (i < n) {
    const c = expr[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') break; // backtickِ بستنِ همین template — بقیه‌اش دیگر مالِ ما نیست
    if (c === '$' && expr[i + 1] === '{') {
      const end = skipBalanced(expr, i + 1, n, '{', '}'); // شاملِ `}`ِ پایانی
      out.push(expr.slice(i + 2, end - 1));
      i = end;
      continue;
    }
    i++;
  }
  return out;
}

/**
 * جداکردنِ RHS از عبارتِ خامِ sink — چون grabExpression از خودِ matchِ
 * `.innerHTML=`/`.insertAdjacentHTML(` شروع می‌شه، عبارتِ خام همیشه با
 * پیشوندِ نامِ sink همراهه؛ برایِ classify باید فقط سمتِ راستِ = (برایِ
 * innerHTML/outerHTML) یا داخلِ پرانتز (برایِ insertAdjacentHTML/document.write/
 * eval/jquery.html) رو در نظر بگیریم — نه کلِ خطِ خام.
 */
function extractRhs(expr, kind) {
  if (kind === 'innerHTML' || kind === 'outerHTML') {
    const eq = expr.indexOf('=');
    return eq === -1 ? '' : expr.slice(eq + 1).trim();
  }
  // sinkهایِ call-style: اولین ( تا آخرین )
  const open = expr.indexOf('(');
  const close = expr.lastIndexOf(')');
  if (open === -1) return '';
  const inner = (close > open ? expr.slice(open + 1, close) : expr.slice(open + 1)).trim();

  // ⚠️ رفعِ باگِ واقعیِ ابزار (۲۰۲۶-۰۸-۲۳): امضایِ insertAdjacentHTML
  // `(position, html)` است — آرگومانِ **دوم** HTML است، نه اولی. ترکیبِ این
  // با برشِ قدیمیِ grabExpression باعث می‌شد rhs فقط `'beforeend'` باشد و
  // classify آن را «رشته‌یِ ثابتِ خالص» ببیند. نتیجه‌ی اندازه‌گیری‌شده:
  // **هر ۱۴ موردِ insertAdjacentHTML در کلِ کدبیس safe_static علامت خورده
  // بودند** — یعنی اسکنر آرگومانِ HTMLشان را هرگز ندیده بود (false-negativeِ
  // سیستماتیک، نه گاه‌به‌گاه).
  if (kind === 'insertAdjacentHTML') {
    const args = splitTopLevel(inner, ',');
    return (args.length >= 2 ? args.slice(1).join(',') : inner).trim();
  }
  return inner;
}

/**
 * بدترین (محافظه‌کارانه‌ترین) نتیجه بینِ چند عملوند: کافی است یکی نامعلوم
 * باشد تا کلِ عبارت نامعلوم شود.
 */
const EVAL_RANK = { static: 0, trusted: 1, escaped: 2, unknown: 3 };
function worstOf(list) {
  return list.reduce((a, b) => (EVAL_RANK[b] > EVAL_RANK[a] ? b : a), 'static');
}

/**
 * اگر عبارت شکلِ `X.map(fn)` / `.filter(fn)` / `.flatMap(fn)` داشته باشد،
 * بدنه‌یِ arrow را برمی‌گرداند — چون HTMLِ تولیدشده همان مقدارِ بازگشتیِ
 * callback است. الگویِ فراگیرِ این کدبیس: ``list.map(x=>`<li>${esc(x)}</li>`).join('')``.
 * اگر شکل را نشناسد null برمی‌گرداند (یعنی محافظه‌کارانه «نامعلوم»).
 */
function arrowBodies(expr) {
  const out = [];
  const re = /\.(?:map|flatMap|filter)\s*\(/g;
  let m;
  while ((m = re.exec(expr)) !== null) {
    const argsEnd = skipBalanced(expr, m.index + m[0].length - 1, expr.length, '(', ')');
    const args = splitTopLevel(expr.slice(m.index + m[0].length, argsEnd - 1), ',');
    const cb = (args[0] || '').trim();
    const arrow = cb.indexOf('=>');
    if (arrow === -1) return null; // callbackِ نام‌برده (نه arrow) — دیتافلو معلوم نیست
    let body = cb.slice(arrow + 2).trim();
    if (body.startsWith('{')) {
      // بدنه‌یِ بلوکی: همه‌ی `return`هایش را ارزیابی کن
      const rets = [...body.matchAll(/\breturn\b/g)].map((r) => body.slice(r.index + 6));
      if (!rets.length) return null;
      out.push(...rets);
    } else out.push(body);
  }
  return out.length ? out : null;
}

/**
 * ارزیابیِ یک عبارت که خروجی‌اش قرار است HTML شود.
 * 'static'  = فقط رشته/عددِ ثابت
 * 'trusted' = فراخوانیِ کمکیِ شناخته‌شده یا حالتِ محلیِ UI (icon/fa/…)
 * 'escaped' = مقدارِ متغیر هست ولی از esc() عبور کرده
 * 'unknown' = نمی‌شود اثبات کرد → محافظه‌کارانه unsafe
 *
 * ⚠️ چرا این تابع جایگزینِ قاعده‌یِ قبلی شد: قبلاً «اگر جایی در RHS رشته‌یِ
 * `esc(` دیده شد ⇒ escaped». وقتی grabExpression برش می‌خورد این قاعده کم‌ضرر
 * بود؛ ولی حالا که کلِ عبارتِ (گاهی چندصدخطیِ) RHS خوانده می‌شود، همان قاعده
 * یعنی «یک esc() در میانِ ۲۰ interpolation، هر ۱۹ تایِ دیگر را هم امن اعلام
 * کند» — دقیقاً یک false-negativeِ امنیتی. حالا **هر** عملوند/interpolation
 * جداگانه ارزیابی می‌شود و بدترینشان تعیین‌کننده است.
 */
function evalExpr(src, depth = 0, unproven = null) {
  const rec = (s, d = depth + 1) => evalExpr(s, d, unproven);
  const t = String(src).trim().replace(/;+\s*$/, '').trim();
  if (!t) return 'static';
  if (depth > 8) { unproven?.push(t.slice(0, 120)); return 'unknown'; }

  // ترنری اول از همه: `+` تنگ‌تر از `?:` می‌بندد، پس اگر اول رویِ `+` تکه
  // کنیم یک ترنریِ حاویِ concatenation را وسط نصف می‌کنیم و هر دو نیمه
  // بی‌معنا («نامعلوم») ارزیابی می‌شوند. (`?.` و `??` ترنری نیستند.)
  const q = splitTopLevel(t, '?');
  if (q.length === 2 && !q[1].startsWith('.') && !q[1].startsWith('?') && !q[0].endsWith('?')) {
    const colon = splitTopLevel(q[1], ':');
    if (colon.length === 2) return worstOf([rec(colon[0]), rec(colon[1])]);
  }

  // concatenation: `'<a>' + esc(x) + '</a>'`
  const plus = splitTopLevel(t, '+');
  if (plus.length > 1) return worstOf(plus.map((p) => rec(p)));

  // پرانتزِ دورِ کلِ عبارت
  if (t.startsWith('(') && skipBalanced(t, 0, t.length, '(', ')') === t.length) {
    return rec(t.slice(1, -1));
  }

  if (/^-?\d+(?:\.\d+)?$/.test(t)) return 'static';
  if (/^(['"])(?:(?!\1)[^\\]|\\.)*\1$/.test(t)) return 'static';
  // esc()/chatEsc() قبل از isTrustedInterpolation چک می‌شوند: هردو در
  // TRUSTED_CALL_NAMES هم هستند، ولی برچسبِ دقیق‌ترشان «escaped» است نه
  // «trusted» — و همین تفکیک است که در گزارش نشان می‌دهد دیتایِ متغیرِ
  // واقعی از escape عبور کرده، در برابرِ HTMLِ ثابتِ icon().
  if (/^(?:esc|chatEsc)\s*\(/.test(t)) return 'escaped';
  if (isTrustedInterpolation(t)) return 'trusted';

  // template literal → همه‌ی interpolationهایش
  if (/^`[\s\S]*`$/.test(t)) {
    const interps = extractInterpolations(t);
    if (!interps.length) return 'static';
    return worstOf(interps.map((x) => rec(x)));
  }

  // زنجیره‌ی آرایه‌ای (`.map(...).join('')`) → بدنه‌یِ callback
  const bodies = arrowBodies(t);
  if (bodies) return worstOf(bodies.map((b) => rec(b)));

  unproven?.push(t.replace(/\s+/g, ' ').slice(0, 120));
  return 'unknown';
}

function classify(expr, kind, unproven = null) {
  // eval/new Function: همیشه لایقِ review دستی‌اند (به‌ندرت با دیتایِ کاربر، ولی خطرناکن)
  if (kind === 'eval' || kind === 'new Function') return 'review';

  const rhs = extractRhs(expr, kind);

  // RHSِ شناسه‌ی خام (مثلِ `.innerHTML=html;` یا `.innerHTML=tpl`) — نه
  // literal/template/call. بدونِ dataflow واقعی نمی‌شه مطمئن شد این متغیر
  // بالادست از esc() رد شده یا نه؛ نه به‌اشتباه unsafe (چون واقعاً معلوم
  // نیست) و نه escaped/safe_static (چون واقعاً هیچ‌کدوم رو نمی‌بینیم اینجا)
  // — «review» صادقانه‌ترین برچسبه.
  if (/^[a-zA-Z_$][\w.]*$/.test(rhs)) return 'review';

  // dom_api_safe: این خط sink است، ولی اگر بلافاصله در همون statement از
  // textContent به‌جایِ HTML استفاده شده (false-positiveِ نزدیکِ کامنت/رشته)
  if (/\btextContent\s*=/.test(rhs) && !/^\s*\.(innerHTML|outerHTML)\s*=/.test(rhs)) {
    return 'dom_api_safe';
  }

  // ارزیابیِ بازگشتیِ کلِ RHS — رجوع کن به توضیحِ evalExpr برایِ اینکه چرا
  // جایِ قاعده‌یِ «هرجا esc( دیدی ⇒ escaped» را گرفت.
  switch (evalExpr(rhs, 0, unproven)) {
    case 'static': return 'safe_static';
    case 'trusted': return 'dom_api_safe';
    case 'escaped': return 'escaped';
    default: return 'unsafe';
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Manual review overrides — این اسکنر regex-based است، نه dataflow واقعی؛
//  خیلی از هشدارهای «unsafe» وقتی escِ واقعی *داخلِ یک تابعِ کمکیِ جداگانه*
//  (مثلِ cardHTML/wlCard/resItemHTML) یا *چند خط بالاتر در یک متغیرِ محلی*
//  (مثلِ `const f=esc(...)` که چند خط بعد استفاده می‌شه) اتفاق می‌افته، به
//  اشتباه unsafe علامت می‌خورن — چون اسکنر فقط همون خطِ sink رو می‌بینه، نه
//  کدِ اطرافش.
//
//  هر ردیفِ این جدول با خواندنِ واقعیِ کد بررسی و توجیه شده (نه حدس) —
//  رجوع کن به بدنه‌ی PR برایِ جزئیاتِ کاملِ ممیزی.
//
//  ⚠️ بازطراحیِ کلید (۲۰۲۶-۰۸-۲۳) — چرا کلید دیگر `file:line` نیست:
//  این override وضعیت را از unsafe به dom_api_safe می‌بَرَد، یعنی یک
//  **سرکوبِ امنیتی** است. با کلیدِ شماره‌خط، هر جابه‌جاییِ کد می‌توانست
//  همان سرکوب را رویِ یک sinkِ کاملاً متفاوت بنشاند — خطای fail-open و
//  کاملاً بی‌صدا. اندازه‌گیری شد: **۳۱ از ۷۳ override (۴۲٪)** به خطی
//  اشاره می‌کردند که دیگر اصلاً sink نداشت.
//  حالا کلید `file#hash` است (`exprHash` رویِ خودِ عبارت). نتیجه:
//    • هر تغییر در خودِ عبارت → کلید عوض می‌شود → override خودکار بی‌اثر
//      می‌شود و sink دوباره unsafe دیده می‌شود (fail-safe).
//    • overrideی که دیگر هیچ sinkی را مچ نکند، به‌صراحت به‌عنوانِ «پوسیده»
//      گزارش می‌شود و exit code را ۱ می‌کند — دیگر بی‌صدا از کار نمی‌افتد.
//  کلیدِ هر sink در خروجیِ JSON (فیلدِ `key`) هست؛ برای افزودنِ override
//  جدید همان را کپی کن.
//
//  ⚠️ مهاجرتِ ۲۰۲۶-۰۸-۲۳ **مکانیکی** بود (line → hash)، نه بازبینیِ مجددِ
//  محتوا: ۳۷ ردیف کلیدشان عوض شد، ۳۱ ردیف (بدونِ sink) و ۴ ردیف (که خودِ
//  classifier حالا امن می‌داندشان) حذف شدند. یعنی توجیهِ نوشته‌شده در هر
//  ردیف هنوز همان توجیهِ نشستِ قبلی است و دورِ بعدیِ ممیزی باید محتوایشان
//  را دوباره بخواند.
// ═══════════════════════════════════════════════════════════════════════
/**
 * کلیدِ محتواییِ یک sink — sha1ِ عبارت با فاصله‌هایِ یکدست‌شده.
 *
 * چرا محتوا و نه شماره‌خط (بازطراحیِ ۲۰۲۶-۰۸-۲۳): کلیدِ قبلی `file:line`
 * بود و چون override وضعیت را از unsafe به dom_api_safe می‌بَرَد (یعنی یک
 * سرکوبِ امنیتیِ واقعی است)، هر جابه‌جاییِ کد می‌توانست همان سرکوب را رویِ
 * یک sinkِ کاملاً متفاوت بنشاند — یعنی خطای fail-open و بی‌صدا. اندازه‌گیری
 * شد: در همان زمانِ بازطراحی **۳۱ از ۷۳ override (۴۲٪) به خطی اشاره
 * می‌کردند که دیگر اصلاً sink نداشت**. با کلیدِ محتوایی، کوچک‌ترین تغییر در
 * خودِ عبارت کلید را عوض می‌کند و override خودکار بی‌اثر می‌شود (fail-safe:
 * دوباره unsafe دیده می‌شود و باید آگاهانه بازبینی شود).
 */
function exprHash(expr) {
  return createHash('sha1').update(expr.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);
}

/** کلیدهایی که واقعاً در این اجرا مصرف شدند — برایِ کشفِ overrideِ پوسیده. */
const USED_OVERRIDE_KEYS = new Set();

const MANUAL_REVIEW_OVERRIDES = new Map([
  // ── الگو ۱: escِ واقعی داخلِ تابعِ کمکیِ جداگانه‌ست (cardHTML/hCardHTML/
  //    wlCard/resItemHTML/sugCard/bubble/chatEsc/itemHTML/...) — بررسی و
  //    تأیید شد که خودِ آن تابع esc()/chatEsc() رو صحیح استفاده می‌کنه. ──
  // ⛔ حذف‌شد: «apps/customer/js/data/discover.js:109» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/customer/js/data/discover.js:195» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/customer/js/data/discover.js:202» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/customer/js/data/discover.js:220» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/customer/js/features/chat.js:112» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/customer/js/features/economy.js#e5482a47def2', 'missionCard(m) دیگه esc(m.title)/esc(m.description) داره (رفع‌شده در همین PR).'],
  ['apps/customer/js/features/palette.js#3a2708a1b553', 'itemHTML(it,i) از قبل esc(it.t)/esc(it.sub) داشت — بررسی شد.'],
  ['apps/customer/js/reservation.js#121414a5b2a9', 'cardHTML() دیگه esc(r.n) داره (رفع‌شده در همین PR).'],
  ['apps/business/js/waitlist.js#25f65b54b53c', 'wlCard(w,i) از قبل esc(w.name) داشت — بررسی شد.'],
  // ⛔ حذف‌شد: «apps/business/js/reservations.js:75» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/business/js/staff-system.js#8b0ead2c9a82', 'sugCard از PR#13 قبلاً esc(s.reason) داره؛ r.label هم در همین PR با esc() رفع شد.'],
  ['apps/company/js/badges.js#7a9462a28ba2', 'BADGES_LIST.map از قبل esc(b.name)/esc(b.description)/... داشت — بررسی شد.'],
  ['apps/company/js/missions.js#90e02b824f6e', 'MISSIONS_LIST.map از قبل esc(m.title) داشت — بررسی شد.'],
  // ⛔ حذف‌شد: «apps/business/js/crm.js:891» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).

  // ── الگو ۲: متغیرِ محلی از قبل چند خط بالاتر esc() شده، اسکنر فقط
  //    استفاده‌ی نهاییش رو می‌بینه نه تعریفش. ──
  ['apps/customer/js/features/food-dna.js#2d1a14276797', 'f/l در همون تابع با esc(USER.firstName/lastName) تعریف شدن — بررسی شد.'],

  // ── الگو ۳: تنها interpolationِ ریسکی یک lookupِ محلیِ ثابته (نه دیتایِ
  //    کاربر/API) — کلید از یک enumِ ثابت میاد، نه ورودیِ آزاد. ──
  // ⛔ حذف‌شد: «apps/business/js/crm.js:492» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/business/js/crm.js:611» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/business/js/crm.js:670» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/business/js/staff-system.js#51181e27725d', 'cards آرایه‌ی literal محلیه (تعریف‌شده دو خط بالاتر در همون تابع).'],
  // ⛔ حذف‌شد: «apps/business/js/reservations.js:57» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).

  // ── الگو ۴: فیلدهایِ صرفاً عددی/بولینِ محلی (شمارنده، درصد، طول آرایه) —
  //    حتی اگر از API بیان، نوعشون number/boolean است، نه string. ──
  ['apps/business/js/overview.js#0782b4d2d10d', 'pct محاسبه‌ی محلیِ عددیه (Math.round).'],
  ['apps/business/js/overview.js#126f139c2a3b', 'liveStatusBadge()/dashboardUsingDemoData() توابعِ محلیِ trusted‌اند.'],
  ['apps/company/js/overview.js#a55e2de7b8b0', 'lowBalanceCount عددِ محلیه.'],
  ['apps/company/js/sales.js#f68ecc196f1b', 'openInquiries عددِ محلیه.'],
  // ⛔ حذف‌شد: «apps/business/js/marketing.js:265» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).

  // ── الگو ۵: sinkِ اسکلتونِ لودینگ (skeleton) — بدونِ دیتایِ واقعی. ──
  // ⛔ حذف‌شد: «apps/customer/js/data/discover.js:107» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/customer/js/reservation.js:70» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/customer/js/features/food-dna.js#a9763efb2175', 'Array.from محلی — نوارِ پیشرفتِ ثابت، بدونِ دیتا.'],

  // ── الگو ۶: مقایسه/ترنریِ محلی که رجکسِ ابزار نتونست parse کنه ولی
  //    دستی بررسی شد کاملاً امنه (رشته‌ی ثابت/تابعِ trusted). ──
  // ⛔ حذف‌شد: «apps/customer/js/data/discover.js:151» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/customer/js/features/loyalty.js#1f622f4c0c0a', 'perksBlock() از PERKS محلی (shared/js seed) می‌سازه؛ tier فقط esc(b.name) بعدِ رفعِ این PR.'],
  ['apps/customer/js/features/loyalty.js#b481bf9fee26', 'badges.map دیگه esc(b.name) داره (رفع‌شده در همین PR)؛ tier.emoji/tier.name از enumِ ثابتِ سطحِ باشگاهه.'],
  // ⛔ حذف‌شد: «apps/customer/js/features/notifications.js:73» را خودِ classifier حالا safe_static می‌داند — override لازم نیست.
  ['apps/customer/js/features/notifications.js#ab19ad63d5ec', 'Object.entries(CATS) — آبجکتِ محلیِ ثابت.'],
  // ⛔ حذف‌شد: «apps/customer/js/features/onboarding.js:42» را خودِ classifier حالا safe_static می‌داند — override لازم نیست.
  ['apps/customer/js/features/rewards.js#d949731de67e', 'd.valid ترنری با icon(...)؛ d.balance_toman از fmtFa می‌گذره.'],
  ['apps/customer/js/waitlist.js#5a5ef1d832bf', 'isOffered ترنری رویِ HTMLِ استاتیک.'],
  // ⛔ حذف‌شد: «apps/customer/js/data/booking.js:69» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/customer/js/data/booking.js:82» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/customer/js/data/booking.js:92» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/customer/js/data/booking.js:219» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/business/js/chat.js#1401bdf4e72e', 'chatEsc در همه‌ی فیلدها استفاده شده؛ t.id ستونِ Postgres UUID (فرمت تضمین‌شده).'],
  // ⛔ حذف‌شد: «apps/business/js/chat.js:75» را خودِ classifier حالا safe_static می‌داند — override لازم نیست.
  // ⛔ حذف‌شد: «apps/business/js/chat.js:94» را خودِ classifier حالا safe_static می‌داند — override لازم نیست.
  ['apps/business/js/crm.js#26d2c9882f8b', 'logoPhoto.url دیگه esc شده (رفع‌شده در همین PR).'],
  ['apps/business/js/crm.js#d459996da353', 'dist فقط {star:number,count:number} — بدونِ رشته.'],
  // ⛔ حذف‌شد: «apps/business/js/crm.js:551» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/business/js/crm.js:850» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/business/js/crm.js:876» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/business/js/loyalty.js#59be0e774ff7', 'Array.from({length:31}) — تقویمِ محلیِ عددی.'],
  // ⛔ حذف‌شد: «apps/business/js/marketing.js:36» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/business/js/marketing.js:86» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/business/js/reservations.js:65» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/business/js/staff-system.js#8da13a6228ab', 'isDemo ترنری + fa(STAFF_LIST.length) — عدد.'],
  ['apps/business/js/staff-system.js#3a2ae36142ab', 'iconName?icon(...):"" — ترنریِ icon، رجکسِ ابزار پارسش نکرد ولی امنه.'],
  // ⛔ حذف‌شد: «apps/business/js/staff-system.js:399» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/business/js/waitlist.js#5cb5acb17afb', 'floorEdit ترنریِ بولینِ محلی رویِ HTMLِ استاتیک.'],
  // ⛔ حذف‌شد: «apps/business/js/waitlist.js:270» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/company/js/intelligence.js#f4f0cc93c4cb', 'fa(d.guests.total_clv_toman) + rfm_distribution.map — اعداد/توابعِ trusted.'],
  ['apps/company/js/intelligence.js#3dd1c3e7e593', 'RESTAURANTS.map — فیلدهایِ نمایش‌داده‌شده اعداد/enumِ status‌اند.'],
  ['apps/company/js/intelligence.js#714a85f9e868', 'متنِ ثابتِ توضیحی + fa(needsAttention.length).'],
  ['apps/company/js/intelligence.js#42e21e50614b', 'healthMeta از یک لوکاپِ محلیِ ثابت؛ d.jobs.dead عدد.'],
  // ⛔ حذف‌شد: «apps/company/js/intelligence.js:252» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/company/js/intelligence.js:442» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/company/js/intelligence.js:573» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  // ⛔ حذف‌شد: «apps/company/js/intelligence.js:730» دیگر هیچ sinkی ندارد (کد جابه‌جا شده).
  ['apps/company/js/photos.js#144978537f8c', "['pending','approved','rejected','all'].map — آرایه‌ی literal محلی."],
  ['apps/company/js/restaurant.js#c5203174f987', 'Object.entries(planDist) — شمارشِ محلیِ اعداد.'],

  // ── الگو ۷: محدودیتِ شناخته‌شده‌یِ ابزار — RHSِ زنجیره‌ایِ چندتابعی
  //    (`.slice(...).map(...).join(...)`) باعث می‌شه grabExpression رویِ
  //    اولین گروهِ پرانتزِ متعادل (اینجا `.slice(0,4)`) متوقف بشه، قبل از
  //    رسیدن به backtickِ اصلی — یک محدودیتِ واقعیِ parserِ regex-based، نه
  //    یافته‌ی امنیتی. خطِ واقعی (بررسیِ دستی) چهار interpolation داره که
  //    هرچهارتا امن‌اند: esc(i.c)، icon(i.ic,...)، esc(i.t)، esc(i.d). ──
  ['apps/business/js/overview.js#b164d795c4ad', 'RHSِ زنجیره‌ای (.slice().map().join()) — بررسیِ دستی: esc(i.c)/icon(i.ic)/esc(i.t)/esc(i.d) هرچهارتا امن‌اند.'],

  // ── الگو ۸ (review، نه unsafe): تابعِ سینکِ عمومی که یک پارامترِ html
  //    می‌گیره (openSheet/openModal) — امنیتِ واقعی به فراخوان‌ها بستگی
  //    داره، نه به خودِ این خط. برایِ هرکدوم چندین فراخوان‌کننده‌ی واقعی
  //    بررسی شد (نمونه‌گیریِ گسترده، نه صرفاً یکی) و همه از esc()/fmtFa()/
  //    قالب‌هایِ کاملاً استاتیک استفاده می‌کردن — هیچ فراخوانِ خامِ
  //    escape‌نشده‌ای پیدا نشد. ──
  ['apps/customer/js/auth.js#ecb1f6abcac3', 'openSheet(html) — فراخوان‌ها بررسی شدن (bookStep2/3 با esc(r.n)، rewards.js/trips.js با قالبِ استاتیک) — امن.'],
  ['apps/customer/js/features/live-strip.js#b1dfdec7d130', 'out فقط از pill(fmtFa(عدد)) ساخته می‌شه — بدونِ متنِ کاربر/API.'],
  ['apps/business/js/overview.js#ecb1f6abcac3', 'heatmapِ html فقط از slots/days (محلیِ ثابت) + fa(v) (عدد) ساخته می‌شه.'],
  ['apps/business/js/staff-system.js#6070b1ce706b', 'openModal(html) — فراخوان‌هایِ نمونه‌گیری‌شده (data.js changeStatus با esc(r.name)) امن بودن.'],
  ['apps/company/js/overview.js#ecb1f6abcac3', 'openModal(html) — همون الگویِ staff-system.js:91؛ فراخوان‌هایِ نمونه‌گیری‌شده امن بودن.'],
]);

/**
 * `--explain <file>[:<line>]` — چاپِ استدلالِ خودِ ابزار برایِ هر sink:
 * عبارتی که استخراج کرده، RHS، و ارزیابیِ تک‌تکِ interpolationها. بدونِ این،
 * تنها راهِ دیباگ نوشتنِ یک اسکریپتِ جداگانه است که منطق را دوباره پیاده کند
 * — و همان دوباره‌پیاده‌سازی خودش منبعِ تشخیصِ غلط می‌شود.
 */
function explain(expr, kind) {
  const rhs = extractRhs(expr, kind);
  const lines = [`   kind=${kind}  verdict=${classify(expr, kind)}  evalExpr(rhs)=${evalExpr(rhs)}`];
  lines.push(`   expr(${expr.length}ch)= ${JSON.stringify(expr.slice(0, 220))}`);
  lines.push(`   rhs (${rhs.length}ch)= ${JSON.stringify(rhs.slice(0, 220))}`);
  const parts = splitTopLevel(rhs.trim().replace(/;+\s*$/, ''), '+');
  const units = parts.length > 1 ? parts : extractInterpolations(rhs.trim());
  const label = parts.length > 1 ? 'operand' : 'interp';
  for (const u of units) lines.push(`     ${label} [${evalExpr(u)}] ${JSON.stringify(u.trim().slice(0, 140))}`);
  return lines.join('\n');
}

function scanFile(absPath, relPath, explainFilter = null) {
  const text = readFileSync(absPath, 'utf8');
  const hits = [];
  for (const { kind, re } of SINK_PATTERNS) {
    const lineRe = new RegExp(re.source, 'g');
    let m;
    while ((m = lineRe.exec(text)) !== null) {
      const expr = grabExpression(text, m.index, m.index + m[0].length);
      // «unproven» = دقیقاً آن زیرعبارت‌هایی که ابزار نتوانست امن‌بودنشان را
      // اثبات کند. بدونِ این، گزارش فقط می‌گوید «unsafe» و آدم باید کلِ خطِ
      // چندصدکاراکتری را دوباره از اول بخواند تا بفهمد کدام تکه‌اش مشکل دارد.
      const unproven = [];
      let classification = classify(expr, kind, unproven);
      const lineNum = text.slice(0, m.index).split('\n').length;
      if (explainFilter && (explainFilter.line === null || explainFilter.line === lineNum)) {
        console.log(`── ${relPath}:${lineNum}`);
        console.log(explain(expr, kind));
      }
      const snippet = text.split('\n')[lineNum - 1].trim().slice(0, 160);
      // ⚠️ کلیدِ override از *محتوایِ* عبارت ساخته می‌شود، نه شماره‌خط
      // (بازطراحیِ ۲۰۲۶-۰۸-۲۳ — دلیلِ کامل در کامنتِ بالایِ
      // MANUAL_REVIEW_OVERRIDES). خلاصه: override وضعیت را از unsafe به
      // dom_api_safe تغییر می‌دهد، یعنی یک سرکوبِ امنیتی است؛ با کلیدِ
      // شماره‌خط، جابه‌جاییِ کد باعث می‌شد این سرکوب رویِ یک sinkِ *دیگر*
      // بنشیند (fail-open). با کلیدِ محتوایی، هر تغییرِ خودِ عبارت کلید را
      // عوض می‌کند و override به‌صورتِ خودکار بی‌اثر می‌شود (fail-safe).
      const overrideKey = `${relPath}#${exprHash(expr)}`;
      const overridable = classification === 'unsafe' || classification === 'review';
      const overrideNote = overridable ? MANUAL_REVIEW_OVERRIDES.get(overrideKey) : undefined;
      if (overrideNote) { classification = 'dom_api_safe'; USED_OVERRIDE_KEYS.add(overrideKey); }
      hits.push({
        file: relPath, line: lineNum, kind, snippet, key: overrideKey, classification,
        ...(classification === 'unsafe' && unproven.length ? { unproven: [...new Set(unproven)].slice(0, 8) } : {}),
        ...(overrideNote ? { manual_review_note: overrideNote } : {}),
      });
    }
  }
  return hits;
}

function main() {
  const args = process.argv.slice(2);
  const pathsArgIdx = args.indexOf('--paths');
  const scanPaths = pathsArgIdx >= 0 ? args[pathsArgIdx + 1].split(',') : DEFAULT_SCAN_PATHS;
  const allScanPaths = [...scanPaths, ...REPORT_ONLY_PATHS];

  // --explain path/to/file.js[:line] — استدلالِ ابزار را چاپ می‌کند و خارج می‌شود
  const explainIdx = args.indexOf('--explain');
  let explainTarget = null;
  if (explainIdx >= 0) {
    const raw = args[explainIdx + 1] || '';
    const c = raw.lastIndexOf(':');
    const hasLine = c > 1 && /^\d+$/.test(raw.slice(c + 1));
    explainTarget = { file: hasLine ? raw.slice(0, c) : raw, line: hasLine ? Number(raw.slice(c + 1)) : null };
  }

  const allHits = [];
  for (const rel of allScanPaths) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    const files = fg(abs, EXTENSIONS);
    for (const f of files) {
      // ⚠️ رفعِ باگِ واقعیِ cross-platform (۲۰۲۶-۰۸-۲۲): path.relative روی
      // ویندوز مسیر را با `\` برمی‌گرداند (`demo-mvp\customer\…`)، در حالی
      // که هر دو مصرف‌کننده‌یِ این مقدار با `/` مقایسه می‌کنند. سه اثرِ
      // واقعی داشت (همه رویِ ویندوز، رویِ لینوکس/CI سالم بود):
      //   ۱) isReportOnly هیچ‌وقت match نمی‌شد → همه‌ی hitهایِ demo-mvp/ و
      //      standalone/ به‌اشتباه «enforced» حساب می‌شدند.
      //   ۲) کلیدِ MANUAL_REVIEW_OVERRIDES (که با `/` نوشته شده) هرگز
      //      match نمی‌شد → هیچ overrideای اعمال نمی‌شد.
      //   ۳) مسیرهایِ داخلِ JSONِ گزارش بینِ ویندوز و لینوکس فرق می‌کرد و
      //      diffِ ساختگی تولید می‌کرد.
      // در عمل: شمارشِ unsafeِ enforced از ۱۹۵ به ۳۸ اصلاح شد.
      // (همان کلاسِ باگی که در PR #64 برایِ photo-moderation.test.mts رفع
      // شد — hardcodeِ جداکننده‌ی مسیر.)
      const relPath = relative(ROOT, f).split(sep).join('/');
      const hits = scanFile(f, relPath, explainTarget && relPath === explainTarget.file ? explainTarget : null);
      allHits.push(...hits);
    }
  }
  if (explainTarget) return 0;

  const isReportOnly = (file) => REPORT_ONLY_PATHS.some((p) => file.startsWith(p + '/'));
  const enforced = allHits.filter((h) => !isReportOnly(h.file));
  const reportOnly = allHits.filter((h) => isReportOnly(h.file));

  const byClass = {};
  for (const h of enforced) byClass[h.classification] = (byClass[h.classification] ?? 0) + 1;

  const report = {
    generated_at: new Date().toISOString(),
    scan_paths: scanPaths,
    report_only_paths: REPORT_ONLY_PATHS,
    total_hits: enforced.length,
    by_classification: byClass,
    hits: enforced,
    report_only_hits: reportOnly,
  };

  writeFileSync(join(ROOT, 'tools/xss-sink-audit-report.json'), JSON.stringify(report, null, 2) + '\n');

  const unsafe = enforced.filter((h) => h.classification === 'unsafe' || h.classification === 'review');
  const md = renderMarkdown(report, unsafe);
  writeFileSync(join(ROOT, 'docs/XSS_SINK_AUDIT.md'), md);

  console.log(JSON.stringify({ total: enforced.length, by_classification: byClass, unsafe_or_review: unsafe.length }, null, 2));

  // ── overrideهایِ پوسیده ──
  // یک overrideی که هیچ sinkی را مچ نکرده یعنی کدِ زیرش عوض شده. این را
  // نباید بی‌صدا رد کرد: تا وقتی در فهرست بماند، خواننده فکر می‌کند آن sink
  // بررسی و تأیید شده، در حالی که دیگر اصلاً به چیزی وصل نیست. (این دقیقاً
  // همان degradationِ بی‌صدایی است که کلیدِ شماره‌خطیِ قبلی تولید می‌کرد.)
  const staleOverrides = [...MANUAL_REVIEW_OVERRIDES.keys()].filter((k) => !USED_OVERRIDE_KEYS.has(k));
  if (staleOverrides.length > 0) {
    console.error(`\n✗ ${staleOverrides.length} override پوسیده (هیچ sinkی را مچ نکرد — کدشان تغییر کرده):`);
    for (const k of staleOverrides) console.error(`   ${k}`);
    console.error('  هرکدام را دوباره بخوان: یا کدش امن شده (override را حذف کن) یا هنوز نیاز به بررسی دارد (کلید را با hashِ جدید به‌روز کن).');
  }

  const stillUnsafe = enforced.filter((h) => h.classification === 'unsafe');
  if (stillUnsafe.length > 0) {
    console.error(`\n✗ ${stillUnsafe.length} sinkِ unsafe زیرِ apps/*+shared/js باقی مانده — رجوع کن به docs/XSS_SINK_AUDIT.md`);
  }
  if (stillUnsafe.length > 0 || staleOverrides.length > 0) process.exit(1);
  console.log('\n✓ صفر sinkِ unsafe زیرِ apps/*+shared/js · صفر overrideِ پوسیده');
  process.exit(0);
}

function renderMarkdown(report, unsafe) {
  const lines = [];
  lines.push('# XSS Sink Audit');
  lines.push('');
  lines.push(`> Generated by \`tools/xss-sink-audit.mjs\` on ${report.generated_at}. Auditor tone — this is a heuristic scan (regex-based, not real dataflow analysis), not a formal proof.`);
  lines.push('');
  lines.push(`Scanned: ${report.scan_paths.join(', ')} (enforced — non-zero \`unsafe\` fails the script). Report-only (not enforced): ${report.report_only_paths.join(', ')}.`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Classification | Count |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(report.by_classification).sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${k}\` | ${v} |`);
  }
  lines.push(`| **Total sinks found** | **${report.total_hits}** |`);
  lines.push('');
  lines.push('- `safe_static` — sink argument is a literal/constant string, no interpolated variable.');
  lines.push('- `escaped` — the sink expression routes through `esc(` before use.');
  lines.push('- `dom_api_safe` — line uses `textContent`, not an HTML sink, or is a benign adjacent match.');
  lines.push('- `unsafe` — a sink interpolates a variable without going through `esc(`. **Must be zero for this script to exit 0.**');
  lines.push('- `review` — `eval`/`new Function` calls; always flagged for manual review regardless of content.');
  lines.push('');
  if (unsafe.length > 0) {
    lines.push('## Findings requiring attention');
    lines.push('');
    lines.push('| File:Line | Kind | Classification | Snippet |');
    lines.push('|---|---|---|---|');
    for (const h of unsafe) {
      lines.push(`| \`${h.file}:${h.line}\` | ${h.kind} | \`${h.classification}\` | \`${h.snippet.replace(/\|/g, '\\|')}\` |`);
    }
    lines.push('');
  } else {
    lines.push('## Findings requiring attention');
    lines.push('');
    lines.push('None — zero `unsafe` sinks under the enforced scan paths as of this pass.');
    lines.push('');
  }
  const reviewed = report.hits.filter((h) => h.manual_review_note);
  if (reviewed.length > 0) {
    lines.push('## Manually reviewed (not auto-classified safe)');
    lines.push('');
    lines.push('The regex classifier flagged these as `unsafe`/`review`; each was read by hand and reclassified with a justification (see `MANUAL_REVIEW_OVERRIDES` in `tools/xss-sink-audit.mjs`). Re-review if the cited line ever changes.');
    lines.push('');
    lines.push('| File:Line | Justification |');
    lines.push('|---|---|');
    for (const h of reviewed) {
      lines.push(`| \`${h.file}:${h.line}\` | ${h.manual_review_note.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }
  if (report.report_only_hits.length > 0) {
    const roUnsafe = report.report_only_hits.filter((h) => h.classification === 'unsafe' || h.classification === 'review');
    lines.push(`## Report-only paths (${report.report_only_paths.join(', ')})`);
    lines.push('');
    lines.push(`Not enforced (per scope: no mass rewrite of generated/duplicate frontends). ${roUnsafe.length} unsafe/review sink(s) found there — see \`tools/xss-sink-audit-report.json\` → \`report_only_hits\` for the full list.`);
    lines.push('');
  }
  lines.push('## Re-running');
  lines.push('');
  lines.push('```sh');
  lines.push('node tools/xss-sink-audit.mjs');
  lines.push('```');
  lines.push('');
  lines.push('Deterministic given the same source tree. Regenerates both this file and `tools/xss-sink-audit-report.json`.');
  lines.push('');
  return lines.join('\n');
}

main();
