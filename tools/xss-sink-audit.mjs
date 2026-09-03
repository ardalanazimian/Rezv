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
//  خارج است). قاعده‌ی محافظه‌کارانه: خطی که escِ صریح `esc(` را در همان
//  عبارتِ template/انتساب نبیند و ثابتِ خالص هم نباشد، `unsafe` یا `review`
//  علامت می‌خورد — هرگز به‌صورتِ خوش‌بینانه `escaped`/`safe_static` فرض
//  نمی‌شود صرفاً چون regex قطعی نبود.
//
//  اجرا: node tools/xss-sink-audit.mjs [--paths p1,p2,...]
//  خروجی: tools/xss-sink-audit-report.json + docs/XSS_SINK_AUDIT.md
//  کدِ خروج: 0 اگر zero «unsafe» زیرِ apps/*+shared/js باشد، وگرنه 1.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
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

/**
 * گرفتنِ «عبارتِ کاملِ» sink از رویِ متنِ خامِ فایل (نه خط‌به‌خط) — رفعِ باگِ
 * واقعیِ نسخه‌یِ اول: template literalهایِ چندخطی (خیلی رایج در این کدبیس؛
 * innerHTML=`...چند ده خط...` با escِ داخلش عمیق‌تر از حدِ دیدِ خط‌به‌خط) به‌
 * اشتباه «unsafe» می‌شدند چون تابعِ قبلی فقط ۳-۶ خط بعدی رو می‌خوند.
 *
 * الگوریتم: از ایندکسِ matchِ sink، جلو می‌ریم؛ اگر به یک backtick رسیدیم،
 * template literal رو تا backtickِ بستنِ متناظر (بدونِ escape با \) دنبال
 * می‌کنیم؛ اگر به پرانتزِ باز رسیدیم (مثلِ insertAdjacentHTML(...))، پرانتزها
 * رو balance می‌کنیم. برایِ innerHTML= با رشته‌ی معمولی (' یا ")، تا کوتیشنِ
 * بسته می‌ریم. Fallback: تا اولین ; یا سقفِ ۲۰۰۰ کاراکتر.
 */
function grabExpression(text, matchStart, searchFrom = matchStart) {
  const CAP = 4000;
  let i = searchFrom;
  const n = Math.min(text.length, matchStart + CAP);
  // اول برو جلو تا اولین backtick/کوتیشن/پرانتز بعدِ searchFrom (پایانِ خودِ
  // matchِ sink، نه matchStart — رجوع کن به پاراگرافِ بعدی) — ولی نه فراتر
  // از اولین ; یا خطِ خالیِ *واقعی* (رفعِ باگِ واقعیِ نسخه‌ی اول: برایِ
  // `x.innerHTML=someVar;` که هیچ کوتیشن/پرانتزی نداره، اسکن بدونِ این مرز
  // به کدِ خطوطِ بعدی سرریز می‌کرد و یک «عبارتِ» بی‌ربط و طولانی می‌ساخت که
  // به‌اشتباه unsafe طبقه‌بندی می‌شد — نه چون واقعاً بود، بلکه چون متنِ بعدی
  // به‌طورِ تصادفی کوتیشن داشت).
  //
  // ⚠️ رفعِ باگِ دوم (کشف‌شده حینِ همین ممیزی): وقتی RHSِ واقعی در خطِ *بعدِ*
  // = میاد (مثلِ `ov.innerHTML =\n    '<div>...'` — الگویِ رایج در این
  // کدبیس برایِ concatenationِ +) ، مرزِ «تا اولین \n» قبلاً بلافاصله بعدِ =
  // متوقف می‌شد، قبل از اینکه اصلاً RHS شروع بشه — یعنی expr خالی می‌موند و
  // به‌غلط unsafe می‌شد. حالا: تا وقتی به کاراکترِ غیرِفاصله‌یِ واقعی نرسیدیم
  // (شروعِ واقعیِ RHS)، \n را هم مثلِ فاصله رد می‌کنیم؛ فقط *بعدِ* شروعِ یک
  // شناسه‌ی خام (sawIdentChar)، \n واقعاً پایانِ آن شناسه حساب می‌شه.
  let sawIdentChar = false;
  while (i < n) {
    const c = text[i];
    if (/[`'"(;]/.test(c)) break;
    if (c === '\n') { if (sawIdentChar) break; i++; continue; }
    if (/\S/.test(c)) sawIdentChar = true;
    i++;
  }
  if (i >= n || text[i] === ';' || text[i] === '\n') {
    // RHS یک شناسه‌ی خام است (نه literal/template/call) — دیتافلو معلوم
    // نیست؛ محافظه‌کارانه فقط تا همینجا برمی‌گردانیم تا classify() آن را
    // «review» علامت بزند، نه اینکه با متنِ بی‌ربطِ بعدی اشتباه گرفته شود.
    return text.slice(matchStart, i);
  }
  const opener = text[i];
  if (opener === '(') {
    let depth = 0;
    const start = i;
    for (; i < n; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') { depth--; if (depth === 0) { i++; break; } }
    }
    return text.slice(matchStart, i);
  }
  // backtick یا کوتیشن: تا بستنِ متناظرِ بدونِ backslash قبلش
  const closer = opener;
  let j = i + 1;
  while (j < n) {
    if (text[j] === '\\') { j += 2; continue; }
    if (text[j] === closer) { j++; break; }
    j++;
  }
  return text.slice(matchStart, j);
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

/** همه‌ی ${...}های سطحِ بالا را از یک template literal استخراج می‌کند (بدونِ nested backtick واقعی). */
function extractInterpolations(expr) {
  const out = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === '$' && expr[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      const start = j;
      while (j < expr.length && depth > 0) {
        if (expr[j] === '{') depth++;
        else if (expr[j] === '}') depth--;
        if (depth > 0) j++;
      }
      out.push(expr.slice(start, j));
      i = j + 1;
    } else i++;
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
  return (close > open ? expr.slice(open + 1, close) : expr.slice(open + 1)).trim();
}

// ── آیا یک درجِ `${...}` به‌تنهایی امن است؟ ──
// امن یعنی یکی از این‌ها: از esc()/jsq() رد شده · فراخوانیِ یک تولیدکننده‌ی
// allowlistشده که ثابت است HTMLِ مهاجم نمی‌سازد · یا عبارتی کاملاً literal.
// هر چیزِ دیگر «نمی‌دانیم» است و برچسبِ review می‌گیرد تا دستی بررسی شود.
//
// ⚠️ `faNum` عمداً در این فهرست **نیست**: فقط ارقام را نگاشت می‌کند و بقیه
//    را خام رد می‌کند. اگر روزی کسی وسوسه شد اضافه‌اش کند، اول باید خودِ
//    faNum را به یک escaper تبدیل کند.
const SAFE_GENERATORS = /^\$\{\s*(?:icon|fmtFa|gradFor|jsq|esc)\s*\(/;

function isSafeInterp(interp) {
  if (/\b(?:esc|jsq)\s*\(/.test(interp)) return true;
  if (SAFE_GENERATORS.test(interp)) return true;
  // فقط عدد/رشته‌ی literal و عملگرهای ساده — بدونِ هیچ شناسه‌ای
  const inner = interp.slice(2, -1);
  if (/^[\s\d+\-*/%().,'"?:]*$/.test(inner)) return true;
  return false;
}


// ── خطِ پایه‌ی ratchet ──────────────────────────────────────────────
// این دو عدد «کف»‌اند، نه هدف: گیت فقط اجازه‌ی **کاهش** می‌دهد. اگر یک
// sinkِ ناامنِ تازه اضافه شود CI قرمز می‌شود؛ اگر تعداد کم شود، گیت خودش
// می‌گوید عدد را پایین بیاور تا پیشرفت قفل شود.
//
// ⚠️ چرا لازم شد (ممیزیِ ۲۰۲۶-۰۸-۲۸): تنها چیزی که CI اجرا می‌کرد
// `--check` بود و آن **فقط کهنگیِ آرتیفکت** را می‌سنجید. شرطِ شکستِ خودِ
// ابزار («۶۶ sinkِ unsafe باقی مانده» با exit 1) در مسیرِ تولیدِ آرتیفکت
// بود که CI هرگز اجرایش نمی‌کرد — یعنی jobِ security می‌توانست سبز باشد
// در حالی که خودِ ابزار کدبیس را مردود می‌دانست، و هیچ‌کس متوجه نمی‌شد
// اگر عدد از ۶۶ به ۸۰ می‌رفت.
// ۲۰۲۶-۰۸-۲۸ — پایین آمد (۶۶/۲۲ → ۶۵/۲۰): هر ۴۰ درجِ **برهنه‌ی داده‌ای**
// (`${x.y}` بدونِ هیچ wrapper) حالا از `esc()` رد می‌شوند. آن‌ها امروز
// هم بی‌خطر بودند — عدد، enum، تاریخِ قالب‌بندی‌شده، جدولِ محلی — ولی
// امنیتشان به **تایپِ سمتِ سرور** تکیه داشت نه به کاری که کلاینت می‌کند.
// حالا آن وابستگی قطع است. تنها استثنا `trips.js:105` است
// (SVGِ QR از کتابخانه — markupِ عمدی، escape کردنش فیچر را می‌شکند).
const UNSAFE_BASELINE = 65;
const REVIEW_BASELINE = 20;

function classify(expr, kind) {
  // eval/new Function: همیشه لایقِ review دستی‌اند (به‌ندرت با دیتایِ کاربر، ولی خطرناکن)
  if (kind === 'eval' || kind === 'new Function') return 'review';

  const rhs = extractRhs(expr, kind);

  // RHSِ شناسه‌ی خام (مثلِ `.innerHTML=html;` یا `.innerHTML=tpl`) — نه
  // literal/template/call. بدونِ dataflow واقعی نمی‌شه مطمئن شد این متغیر
  // بالادست از esc() رد شده یا نه؛ نه به‌اشتباه unsafe (چون واقعاً معلوم
  // نیست) و نه escaped/safe_static (چون واقعاً هیچ‌کدوم رو نمی‌بینیم اینجا)
  // — «review» صادقانه‌ترین برچسبه.
  if (/^[a-zA-Z_$][\w.]*$/.test(rhs)) return 'review';

  // escaped: **هر** درجِ ${...} باید امن باشد — نه فقط یکی از آن‌ها.
  //
  // ⚠️ چرا این سخت‌گیری (ممیزیِ ۲۰۲۶-۰۸-۲۸): قاعده‌ی قبلی یک تستِ زیررشته‌ای
  // بود و کلِ sink را `escaped` اعلام می‌کرد اگر `esc(` فقط **یک‌جا** دیده
  // می‌شد. یک templateِ پانزده‌درجی که چهارده تایش خام بود، با یک esc()
  // برچسبِ امن می‌گرفت و از شمارشِ unsafe بیرون می‌افتاد. دو موردِ واقعی که
  // بازبینِ بیرونی گرفت و ما نگرفتیم: `${faNum(USER.phone)}` در food-dna و
  // `${t.party}` در reservation — هر دو داخلِ templateهایی که جایِ دیگرشان
  // esc() داشت. `faNum` فقط ارقامِ اسکی را نگاشت می‌کند و هر کاراکترِ دیگر
  // (از جمله `<`) را دست‌نخورده رد می‌کند؛ escaper نیست.
  if (/\besc\s*\(/.test(rhs)) {
    const interps = rhs.match(/\$\{[\s\S]*?\}/g) || [];
    if (interps.every(isSafeInterp)) return 'escaped';
    return 'review';   // esc() هست ولی همه‌ی درج‌ها را نمی‌پوشاند
  }

  // safe_static: فقط رشته‌یِ literal (تک/دابل‌کوت یا template بدونِ ${...})،
  // بدونِ concatenation با متغیر و بدونِ ${varName} در template.
  const isPureStringLiteral = /^(['"])(?:(?!\1)[^\\]|\\.)*\1;?$/.test(rhs);
  const hasInterp = /\$\{/.test(rhs);
  const isTemplateLiteral = /^`[\s\S]*`;?$/.test(rhs);
  if (isPureStringLiteral || (isTemplateLiteral && !hasInterp)) return 'safe_static';

  // dom_api_safe: این خط sink است، ولی اگر بلافاصله در همون statement از
  // textContent به‌جایِ HTML استفاده شده (false-positiveِ نزدیکِ کامنت/رشته)
  if (/\btextContent\s*=/.test(rhs) && !/^\s*\.(innerHTML|outerHTML)\s*=/.test(rhs)) {
    return 'dom_api_safe';
  }

  // اگر template literal است، همه‌ی interpolationها رو چک کن — اگه همه
  // «قابلِ‌اعتماد» بودن (state محلی/آیکن/عدد)، dom_api_safe؛ وگرنه unsafe.
  if (isTemplateLiteral && hasInterp) {
    const interps = extractInterpolations(rhs);
    if (interps.length > 0 && interps.every(isTrustedInterpolation)) return 'dom_api_safe';
  }

  // فراخوانیِ مستقیمِ icon()/fa() به‌عنوانِ کلِ RHS (نه داخلِ template literal) —
  // مثلاً `el.innerHTML = icon('search');` در خودِ icons.js. icon() از یک
  // نقشه‌ی ثابتِ SVG (PATHS در icons.js) می‌خواند، نه از دیتایِ کاربر/API.
  const rhsNoSemi = rhs.replace(/;\s*$/, '').trim();
  if (TRUSTED_CALL_RE.test(rhsNoSemi)) return 'dom_api_safe';

  return 'unsafe';
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
//  رجوع کن به بدنه‌ی PR برایِ جزئیاتِ کاملِ ممیزی. اگر فایلی که override
//  داره بعداً واقعاً تغییر کنه، override همچنان با شماره‌خطِ قدیمی می‌مونه؛
//  دورِ بعدیِ ممیزی باید override‌هایی که دیگه با کدِ واقعی مچ نمی‌شن (خطِ
//  متفاوت/محتوایِ متفاوت) رو دوباره بررسی کنه.
// ═══════════════════════════════════════════════════════════════════════
const MANUAL_REVIEW_OVERRIDES = new Map([
  // ── فرمِ ورودِ سه‌عاملیِ پنلِ شرکت ──
  ['apps/company/js/intelligence.js:862',
   'فرمِ ورودِ مدیر (TOTP، ۲۰۲۶-۰۸-۲۹): هر دو درجِ این قالب markupِ **داخلیِ ثابت** است — `totpBlock` یک رشته‌ی literal یا خالی، و ternaryِ onkeydown دو literal. هیچ داده‌ی کاربر/سرور واردش نمی‌شود؛ پرچمِ `_totpRequired` یک boolean از GET /auth/admin/login است. پیش از این تغییر همین محل safe_static بود چون اصلاً درج نداشت. ۲۰۲۶-۰۹-۰۲: درجِ سومِ _otpLoginEnabled هم اضافه شد — همان جنس: یک booleanِ سرور که فقط تصمیم می‌گیرد رشته‌ی literal ساخته شود یا نه.'],
  ['standalone/company.html:3161',
   'فرمِ ورودِ مدیر (TOTP، ۲۰۲۶-۰۸-۲۹): هر دو درجِ این قالب markupِ **داخلیِ ثابت** است — `totpBlock` یک رشته‌ی literal یا خالی، و ternaryِ onkeydown دو literal. هیچ داده‌ی کاربر/سرور واردش نمی‌شود؛ پرچمِ `_totpRequired` یک boolean از GET /auth/admin/login است. پیش از این تغییر همین محل safe_static بود چون اصلاً درج نداشت. ۲۰۲۶-۰۹-۰۲: درجِ سومِ _otpLoginEnabled هم اضافه شد — همان جنس: یک booleanِ سرور که فقط تصمیم می‌گیرد رشته‌ی literal ساخته شود یا نه.'],
  // ── بازبینِ بیرونی (Sourcery/opengrep) روی PR #79 ──
  // این سه محل را قاعده‌ی `insecure-innerhtml` علامت زد. تک‌تک در سورس بررسی
  // شدند؛ نتیجه در گزارشِ دورِ ششم. دو موردِ اولِ آن سه (food-dna:191 و
  // reservation:152) **واقعی بودند و رفع شدند** (faNum یک escaper نیست)، پس
  // اینجا override نمی‌خورند. فقط موردِ زیر مثبتِ کاذب بود:
  ['apps/customer/js/features/trips.js:206',
   'مثبتِ کاذبِ opengrep: تنها مقدارِ پویا esc(res.error?.message||…) است و '
   + "icon(alert,{size:13}) کلیدِ literal است. قاعده الگویِ innerHTML= را "
   + 'بدونِ dataflow علامت می‌زند. گاردِ خودمان هم مستقل «escaped» می‌دهد.'],
  // ── الگو ۱: escِ واقعی داخلِ تابعِ کمکیِ جداگانه‌ست (cardHTML/hCardHTML/
  //    wlCard/resItemHTML/sugCard/bubble/chatEsc/itemHTML/...) — بررسی و
  //    تأیید شد که خودِ آن تابع esc()/chatEsc() رو صحیح استفاده می‌کنه. ──
  ['apps/customer/js/data/discover.js:109', 'cardHTML() دیگه esc(r.n) داره (رفع‌شده در همین PR).'],
  ['apps/customer/js/data/discover.js:195', 'hCardHTML() از قبل esc(r.n) داشت — بررسی شد.'],
  ['apps/customer/js/data/discover.js:202', 'hCardHTML() از قبل esc(r.n) داشت — بررسی شد.'],
  ['apps/customer/js/data/discover.js:220', 'hCardHTML() از قبل esc(r.n) داشت — بررسی شد.'],
  ['apps/customer/js/features/chat.js:112', 'bubble(m) از قبل esc(m.body) داشت — بررسی شد.'],
  ['apps/customer/js/features/economy.js:106', 'missionCard(m) دیگه esc(m.title)/esc(m.description) داره (رفع‌شده در همین PR).'],
  ['apps/customer/js/features/palette.js:94', 'itemHTML(it,i) از قبل esc(it.t)/esc(it.sub) داشت — بررسی شد.'],
  ['apps/customer/js/reservation.js:21', 'cardHTML() دیگه esc(r.n) داره (رفع‌شده در همین PR).'],
  ['apps/business/js/waitlist.js:38', 'wlCard(w,i) از قبل esc(w.name) داشت — بررسی شد.'],
  ['apps/business/js/reservations.js:75', 'resItemHTML(r,i) از قبل esc(r.name)/esc(r.phone)/esc(r.note)/esc(r.cancelReason) داشت — بررسی شد.'],
  ['apps/business/js/staff-system.js:282', 'sugCard از PR#13 قبلاً esc(s.reason) داره؛ r.label هم در همین PR با esc() رفع شد.'],
  ['apps/company/js/badges.js:21', 'BADGES_LIST.map از قبل esc(b.name)/esc(b.description)/... داشت — بررسی شد.'],
  ['apps/company/js/missions.js:21', 'MISSIONS_LIST.map از قبل esc(m.title) داشت — بررسی شد.'],
  ['apps/business/js/crm.js:891', 'کارت‌هایِ AI/تماس از قبل esc(c.title)/esc(c.detail)/esc(c.name)/esc(c.reason) داشتن — بررسی شد.'],

  // ── الگو ۲: متغیرِ محلی از قبل چند خط بالاتر esc() شده، اسکنر فقط
  //    استفاده‌ی نهاییش رو می‌بینه نه تعریفش. ──
  ['apps/customer/js/features/food-dna.js:233', 'f/l در همون تابع با esc(USER.firstName/lastName) تعریف شدن — بررسی شد.'],

  // ── الگو ۳: تنها interpolationِ ریسکی یک lookupِ محلیِ ثابته (نه دیتایِ
  //    کاربر/API) — کلید از یک enumِ ثابت میاد، نه ورودیِ آزاد. ──
  ['apps/business/js/crm.js:492', 'RFM_META[s.segment] — آبجکتِ محلیِ ثابت، کلید از enumِ segment.'],
  ['apps/business/js/crm.js:611', 'برچسب‌ها/دکمه‌هایِ ثابتِ محلی (custSort tabs) — بدونِ دیتایِ کاربر.'],
  ['apps/business/js/crm.js:670', 'HOURS_DOW_ORDER محلیِ ثابت؛ oh[d] ساعتِ کاریِ خودِ رستوران (نه ورودیِ آزادِ مهمان).'],
  ['apps/business/js/staff-system.js:225', 'cards آرایه‌ی literal محلیه (تعریف‌شده دو خط بالاتر در همون تابع).'],
  ['apps/business/js/reservations.js:57', 'icon(...)/icon(...) ترنری + dateLabel از یک lookupِ محلیِ ثابت (نه ورودیِ کاربر).'],

  // ── الگو ۴: فیلدهایِ صرفاً عددی/بولینِ محلی (شمارنده، درصد، طول آرایه) —
  //    حتی اگر از API بیان، نوعشون number/boolean است، نه string. ──
  ['apps/business/js/overview.js:274', 'pct محاسبه‌ی محلیِ عددیه (Math.round).'],
  ['apps/business/js/overview.js:153', 'liveStatusBadge()/dashboardUsingDemoData() توابعِ محلیِ trusted‌اند.'],
  ['apps/company/js/overview.js:26', 'lowBalanceCount عددِ محلیه.'],
  ['apps/company/js/sales.js:105', 'openInquiries عددِ محلیه.'],
  ['apps/business/js/marketing.js:265', 'avgVisits عددِ محلیه؛ days.map رویِ Object.entries(محلی) کار می‌کنه.'],

  // ── الگو ۵: sinkِ اسکلتونِ لودینگ (skeleton) — بدونِ دیتایِ واقعی. ──
  ['apps/customer/js/data/discover.js:107', 'اسکلتونِ لودینگ — list.map(()=>...) هیچ فیلدی از آیتم نمی‌خونه.'],
  ['apps/customer/js/reservation.js:70', 'skTrip.repeat(3) — رشته‌ی اسکلتونِ ثابت.'],
  ['apps/customer/js/features/food-dna.js:59', 'Array.from محلی — نوارِ پیشرفتِ ثابت، بدونِ دیتا.'],

  // ── الگو ۶: مقایسه/ترنریِ محلی که رجکسِ ابزار نتونست parse کنه ولی
  //    دستی بررسی شد کاملاً امنه (رشته‌ی ثابت/تابعِ trusted). ──
  ['apps/customer/js/data/discover.js:151', 'ترنریِ icon(...)+رشته یا esc(el.textContent) — هردو امن.'],
  ['apps/customer/js/features/loyalty.js:25', 'perksBlock() از PERKS محلی (shared/js seed) می‌سازه؛ tier فقط esc(b.name) بعدِ رفعِ این PR.'],
  ['apps/customer/js/features/loyalty.js:64', 'badges.map دیگه esc(b.name) داره (رفع‌شده در همین PR)؛ tier.emoji/tier.name از enumِ ثابتِ سطحِ باشگاهه.'],
  ['apps/customer/js/features/notifications.js:73', 'رشته‌هایِ ثابت (concat با +) — بدونِ دیتایِ کاربر.'],
  ['apps/customer/js/features/notifications.js:93', 'Object.entries(CATS) — آبجکتِ محلیِ ثابت.'],
  ['apps/customer/js/features/onboarding.js:42', 'کارتِ onboarding کاملاً استاتیکه.'],
  ['apps/customer/js/features/rewards.js:108', 'd.valid ترنری با icon(...)؛ d.balance_toman از fmtFa می‌گذره.'],
  ['apps/customer/js/waitlist.js:55', 'isOffered ترنری رویِ HTMLِ استاتیک.'],
  ['apps/customer/js/data/booking.js:69', 'r.slots رشته‌هایِ ساعتِ ثابت‌فرمت (HH:MM) از سرور، نه متنِ آزاد.'],
  ['apps/customer/js/data/booking.js:82', 's.time مشابه — فرمتِ ثابتِ ساعت.'],
  ['apps/customer/js/data/booking.js:92', 'مشابهِ L69.'],
  ['apps/customer/js/data/booking.js:219', 'Array.from({length:PARTY_MAX}) — آرایه‌ی محلیِ عددی.'],
  ['apps/business/js/chat.js:24', 'chatEsc در همه‌ی فیلدها استفاده شده؛ t.id ستونِ Postgres UUID (فرمت تضمین‌شده).'],
  ['apps/business/js/chat.js:75', 'bizBubble از الگویِ chatEsc پیروی می‌کنه (مشابهِ chat.js:94).'],
  ['apps/business/js/chat.js:94', 'chatEsc(body) مستقیم رویِ ورودی.'],
  ['apps/business/js/crm.js:89', 'logoPhoto.url دیگه esc شده (رفع‌شده در همین PR).'],
  ['apps/business/js/crm.js:379', 'dist فقط {star:number,count:number} — بدونِ رشته.'],
  ['apps/business/js/crm.js:551', 'کارتِ hero — اعداد/توابعِ trusted (fnl/fa)؛ متنِ ثابت.'],
  ['apps/business/js/crm.js:850', 'segs از RFM_META محلی می‌گذره (مشابهِ crm.js:492).'],
  ['apps/business/js/crm.js:876', 'esc(SEG_FA[...]||...) و esc(l.message) از قبل صحیح‌اند.'],
  ['apps/business/js/loyalty.js:22', 'Array.from({length:31}) — تقویمِ محلیِ عددی.'],
  ['apps/business/js/marketing.js:36', 'Object.entries(COUPON_SEG_FA) — آبجکتِ محلیِ ثابت.'],
  ['apps/business/js/marketing.js:86', 'Object.entries(AUTOMATION_TRIGGER_FA) — آبجکتِ محلیِ ثابت.'],
  ['apps/business/js/reservations.js:65', 'demoNote + برچسب‌هایِ ثابتِ محلی؛ fa()/icon() برایِ اعداد.'],
  ['apps/business/js/staff-system.js:35', 'isDemo ترنری + fa(STAFF_LIST.length) — عدد.'],
  ['apps/business/js/staff-system.js:192', 'iconName?icon(...):"" — ترنریِ icon، رجکسِ ابزار پارسش نکرد ولی امنه.'],
  ['apps/business/js/staff-system.js:399', 'devCode — کدِ OTPِ حالتِ دمو، رشته‌ی محلی (نه ورودیِ کاربر).'],
  ['apps/business/js/waitlist.js:115', 'floorEdit ترنریِ بولینِ محلی رویِ HTMLِ استاتیک.'],
  ['apps/business/js/waitlist.js:270', 'undoFn نامِ تابعِ ثابتیه که خودِ کدِ ما در toastUndo(msg, "fnName") پاس می‌ده، نه ورودیِ کاربر.'],
  ['apps/company/js/intelligence.js:22', 'fa(d.guests.total_clv_toman) + rfm_distribution.map — اعداد/توابعِ trusted.'],
  ['apps/company/js/intelligence.js:50', 'RESTAURANTS.map — فیلدهایِ نمایش‌داده‌شده اعداد/enumِ status‌اند.'],
  ['apps/company/js/intelligence.js:183', 'متنِ ثابتِ توضیحی + fa(needsAttention.length).'],
  ['apps/company/js/intelligence.js:212', 'healthMeta از یک لوکاپِ محلیِ ثابت؛ d.jobs.dead عدد.'],
  ['apps/company/js/intelligence.js:252', 'متنِ ثابتِ مستندسازی + fa(...) برایِ اعداد.'],
  ['apps/company/js/intelligence.js:442', 'moderationQueuePanelHTML/featureFlagsPanelHTML بررسی شدن — همه‌جا esc(label)/esc(key)/esc(x.ip) دارن.'],
  ['apps/company/js/intelligence.js:573', 'renderCustomer360(res.data) بررسی شد — esc(name)/esc(u.phone)/esc(u.id)/esc(...reason) در همه‌جا هست.'],
  ['apps/company/js/intelligence.js:730', 'devCode مشابهِ staff-system.js:399 — کدِ OTPِ دمو.'],
  ['apps/company/js/photos.js:131', "['pending','approved','rejected','all'].map — آرایه‌ی literal محلی."],
  ['apps/company/js/restaurant.js:62', 'Object.entries(planDist) — شمارشِ محلیِ اعداد.'],

  // ── الگو ۷: محدودیتِ شناخته‌شده‌یِ ابزار — RHSِ زنجیره‌ایِ چندتابعی
  //    (`.slice(...).map(...).join(...)`) باعث می‌شه grabExpression رویِ
  //    اولین گروهِ پرانتزِ متعادل (اینجا `.slice(0,4)`) متوقف بشه، قبل از
  //    رسیدن به backtickِ اصلی — یک محدودیتِ واقعیِ parserِ regex-based، نه
  //    یافته‌ی امنیتی. خطِ واقعی (بررسیِ دستی) چهار interpolation داره که
  //    هرچهارتا امن‌اند: esc(i.c)، icon(i.ic,...)، esc(i.t)، esc(i.d). ──
  ['apps/business/js/overview.js:349', 'RHSِ زنجیره‌ای (.slice().map().join()) — بررسیِ دستی: esc(i.c)/icon(i.ic)/esc(i.t)/esc(i.d) هرچهارتا امن‌اند.'],

  // ── الگو ۸ (review، نه unsafe): تابعِ سینکِ عمومی که یک پارامترِ html
  //    می‌گیره (openSheet/openModal) — امنیتِ واقعی به فراخوان‌ها بستگی
  //    داره، نه به خودِ این خط. برایِ هرکدوم چندین فراخوان‌کننده‌ی واقعی
  //    بررسی شد (نمونه‌گیریِ گسترده، نه صرفاً یکی) و همه از esc()/fmtFa()/
  //    قالب‌هایِ کاملاً استاتیک استفاده می‌کردن — هیچ فراخوانِ خامِ
  //    escape‌نشده‌ای پیدا نشد. ──
  ['apps/customer/js/auth.js:209', 'openSheet(html) — فراخوان‌ها بررسی شدن (bookStep2/3 با esc(r.n)، rewards.js/trips.js با قالبِ استاتیک) — امن.'],
  ['apps/customer/js/features/live-strip.js:38', 'out فقط از pill(fmtFa(عدد)) ساخته می‌شه — بدونِ متنِ کاربر/API.'],
  ['apps/business/js/overview.js:315', 'heatmapِ html فقط از slots/days (محلیِ ثابت) + fa(v) (عدد) ساخته می‌شه.'],
  ['apps/business/js/staff-system.js:91', 'openModal(html) — فراخوان‌هایِ نمونه‌گیری‌شده (data.js changeStatus با esc(r.name)) امن بودن.'],
  ['apps/company/js/overview.js:129', 'openModal(html) — همون الگویِ staff-system.js:91؛ فراخوان‌هایِ نمونه‌گیری‌شده امن بودن.'],

  // ── الگو ۹: sinkهایِ واردشده پس از تولیدِ آرتیفکتِ ۲۰۲۶-۰۸-۲۶ (ممیزیِ
  //    پیش از لانچ، ۲۰۲۶-۰۸-۲۸). هر پنج مورد تک‌تک خوانده و امن تأیید شد؛
  //    منشأشان: f658687 «صداقتِ سراسری» · d525e48 SPEC-A فاز ۲ ·
  //    f4c27e4 SPEC-B provisioning. هیچ‌کدام رانشِ کیفیت نیست. ──
  ['apps/business/js/crm.js:132', 'loadErrorBlock(title, retry) — هر دو آرگومان literalِ خودِ کدند؛ title با esc() می‌گذره و retry عمداً یک رشته‌ی **کد** برایِ onclick است (نه دیتا).'],
  ['apps/business/js/crm.js:136', 'کارتِ هویت: RESTAURANT.name با esc() می‌گذره (تنها فیلدِ API)؛ logoEmoji/logoGradient فقط از پیکرِ محلی ست می‌شن (crm.js:274-275 ← pickLogoEmoji/pickLogoGrad)، هرگز از پاسخِ سرور؛ logoPhoto.url و statusLabel هم esc دارن؛ GALLERY.indexOf عدد است.'],
  ['apps/business/js/crm.js:427', 'همان loadErrorBlock مثلِ crm.js:132 — آرگومان‌ها literalِ کدند.'],
  ['apps/business/js/menu.js:674', 'گروه/آپشنِ افزودنی‌ها: esc(g.name)/esc(o.name) رویِ متن، jsq(itemId)/jsq(g.id)/jsq(g.name) داخلِ onclick، و fa(min_select)/fa(max_select) رویِ اعداد — هر مسیرِ دیتا پوشش داره.'],
  ['apps/company/js/restaurant.js:176', 'btn.innerHTML = label که خودش چهار خط بالاتر از همان دکمه خوانده شده (ذخیره/بازگرداندنِ برچسبِ دکمه حینِ لودینگ) — رفت‌وبرگشتِ markupِ خودِ عنصر، بدونِ ورودِ هیچ دادهٔ بیرونی.'],
]);

function scanFile(absPath, relPath) {
  const text = readFileSync(absPath, 'utf8');
  const hits = [];
  for (const { kind, re } of SINK_PATTERNS) {
    const lineRe = new RegExp(re.source, 'g');
    let m;
    while ((m = lineRe.exec(text)) !== null) {
      const expr = grabExpression(text, m.index, m.index + m[0].length);
      let classification = classify(expr, kind);
      const lineNum = text.slice(0, m.index).split('\n').length;
      const snippet = text.split('\n')[lineNum - 1].trim().slice(0, 160);
      const overrideKey = `${relPath}:${lineNum}`;
      const overrideNote = (classification === 'unsafe' || classification === 'review') ? MANUAL_REVIEW_OVERRIDES.get(overrideKey) : undefined;
      if (overrideNote) classification = 'dom_api_safe';
      hits.push({ file: relPath, line: lineNum, kind, snippet, classification, ...(overrideNote ? { manual_review_note: overrideNote } : {}) });
    }
  }
  return hits;
}

function main() {
  const args = process.argv.slice(2);
  const pathsArgIdx = args.indexOf('--paths');
  const scanPaths = pathsArgIdx >= 0 ? args[pathsArgIdx + 1].split(',') : DEFAULT_SCAN_PATHS;
  const allScanPaths = [...scanPaths, ...REPORT_ONLY_PATHS];

  const allHits = [];
  for (const rel of allScanPaths) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    const files = fg(abs, EXTENSIONS);
    for (const f of files) {
      // مسیر همیشه با `/` ثبت می‌شود، مستقل از سیستم‌عامل: روی ویندوز
      // `relative()` بک‌اسلش می‌دهد و آن‌وقت هم آرتیفکت با خروجیِ CI فرق
      // می‌کند (‏`--check` همیشه «کهنه» می‌گوید)، هم چکِ report-only پایین
      // که `startsWith(p + '/')` است هرگز نمی‌گیرد و `standalone/` اشتباهاً
      // enforced شمرده می‌شود.
      const relPath = relative(ROOT, f).split('\\').join('/');
      const hits = scanFile(f, relPath);
      allHits.push(...hits);
    }
  }

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

  const unsafe = enforced.filter((h) => h.classification === 'unsafe' || h.classification === 'review');
  const jsonOut = JSON.stringify(report, null, 2) + '\n';
  const md = renderMarkdown(report, unsafe);

  // ── حالتِ `--check` (برای CI) ──
  // ⚠️ چرا اضافه شد (یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۵): `docs/XSS_SINK_AUDIT.md`
  // یک آرتیفکتِ **تولیدشده‌ی commit‌شده** است و از ۲۰۲۶-۰۸-۱۴ بازتولید نشده
  // بود. در آن فاصله محتوایش می‌گفت «None — zero `unsafe` sinks» در حالی که
  // واقعیت ۶۳ مورد بود. یعنی سندِ امنیتی چیزی را تضمین می‌کرد که وجود نداشت
  // — دقیقاً همان الگویِ کهنه‌شدنِ بی‌صدای `standalone/*.html` که برای آن هم
  // گیتِ CI گذاشتیم. آرتیفکتی که بی‌صدا کهنه شود از نبودش بدتر است.
  //
  // این حالت **تعدادِ** unsafe را قضاوت نمی‌کند (آن کارِ خطِ آخرِ همین تابع
  // است)؛ فقط می‌پرسد «آیا فایلِ commit‌شده همان چیزی است که امروز تولید
  // می‌شود؟». مهرِ زمان از مقایسه کنار گذاشته می‌شود چون هر اجرا عوضش می‌کند.
  // ⚠️ ترتیبِ بازتولید مهم است (خودِ همین گیت در اولین اجرا گرفتش):
  // `REPORT_ONLY_PATHS` شاملِ `standalone/` است و ۲۱۲ hitِ آن فقط در JSON
  // می‌آید، نه در Markdown. پس اگر اول این ابزار را بزنی و **بعد**
  // `tools/build-standalone.py` را، فایلِ JSON به بسته‌ی قدیمی اشاره می‌کند و
  // `--check` در CI قرمز می‌شود در حالی که MD سبز است. قاعده: **اول**
  // standalone را بساز، **بعد** این را.
  const stripStamp = (t) => t
    .replace(/"generated_at":\s*"[^"]*"/g, '"generated_at":"—"')
    .replace(/ on \d{4}-\d{2}-\d{2}T[^.]*\.\d+Z\./g, ' on —.');

  if (args.includes('--check')) {
    const targets = [
      ['tools/xss-sink-audit-report.json', jsonOut],
      ['docs/XSS_SINK_AUDIT.md', md],
    ];
    const stale = [];
    for (const [rel, fresh] of targets) {
      const abs = join(ROOT, rel);
      const onDisk = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
      if (stripStamp(onDisk) !== stripStamp(fresh)) stale.push(rel);
    }
    if (stale.length) {
      console.error(`✗ آرتیفکتِ ممیزیِ XSS کهنه است: ${stale.join('، ')}`);
      console.error('  بازتولید: node tools/xss-sink-audit.mjs  (و خروجی‌اش را کامیت کن)');
      process.exit(1);
    }
    console.log('✓ آرتیفکتِ ممیزیِ XSS با کد هماهنگ است');

    // ── ratchet: عدد فقط پایین می‌رود ──
    const nUnsafe = enforced.filter((h) => h.classification === 'unsafe').length;
    const nReview = enforced.filter((h) => h.classification === 'review').length;
    let regressed = false;

    for (const [label, n, base] of [
      ['unsafe', nUnsafe, UNSAFE_BASELINE],
      ['review', nReview, REVIEW_BASELINE],
    ]) {
      if (n > base) {
        console.error(`✗ sinkهای ${label} از ${base} به ${n} رسید (+${n - base}).`);
        console.error(`  یا امنش کن یا — اگر واقعاً امن است — در MANUAL_REVIEW_OVERRIDES ثبتش کن.`);
        regressed = true;
      } else if (n < base) {
        console.log(`✓ sinkهای ${label}: ${n} (خطِ پایه ${base}) — عدد را در`);
        console.log(`  tools/xss-sink-audit.mjs به ${n} برسان تا این پیشرفت قفل شود.`);
      } else {
        console.log(`✓ sinkهای ${label} روی خطِ پایه: ${n}`);
      }
    }
    if (regressed) process.exit(1);
    process.exit(0);
  }

  writeFileSync(join(ROOT, 'tools/xss-sink-audit-report.json'), jsonOut);
  writeFileSync(join(ROOT, 'docs/XSS_SINK_AUDIT.md'), md);

  console.log(JSON.stringify({ total: enforced.length, by_classification: byClass, unsafe_or_review: unsafe.length }, null, 2));

  const stillUnsafe = enforced.filter((h) => h.classification === 'unsafe');
  if (stillUnsafe.length > 0) {
    console.error(`\n✗ ${stillUnsafe.length} sinkِ unsafe زیرِ apps/*+shared/js باقی مانده — رجوع کن به docs/XSS_SINK_AUDIT.md`);
    process.exit(1);
  }
  console.log('\n✓ صفر sinkِ unsafe زیرِ apps/*+shared/js');
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
