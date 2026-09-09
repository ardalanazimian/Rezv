#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ کهنگیِ اسناد (سفارشِ ۳الف)
//
//  چرا: «سندی که دروغ می‌گوید» هم‌کلاسِ «فیچرِ جعلی» است، و این مخزن **چهار
//  بار** همین را تحویل داده:
//    ۱) RLS به‌عنوانِ defense-in-depthِ فعال (P0-021)
//    ۲) CUSTOMER_APP_URL که ۲۰۲۶-۰۸-۲۲ حذف شد ولی هنوز استناد می‌شد
//    ۳) biz.rezervno.ir در برابرِ business. که پروکسی واقعاً سرو می‌کند
//    ۴) github.com/ardalanaz/RezervnoOS — و این یکی **قبلاً تصحیح شده بود**
//       و دوباره برگشت، چون تصحیح فقط در تاریخچه‌ی چت زندگی می‌کرد.
//
//  سه چک: آدرسِ مخزن · میزبانی که پروکسی سرو نمی‌کند · متغیرِ محیطیِ ناموجود.
//
//  ⚠️ تفکیکِ اصلی: سندی که غلط را **ثبت** می‌کند (گزارشِ تاریخ‌دار، رکوردِ
//     ممیزی، جدولِ «غلط ← درست») مشروع است — کارش همین است. سندی که غلط را
//     **دستور** می‌دهد نقص است. پس فایل‌های تاریخی معافند و بقیه نه؛ معافیت
//     بر اساسِ مسیر است تا هیچ‌کس نتواند با یک کامنت خطی را ساکت کند.
//
//  ⚠️ محدودیتِ **آگاهانه** — لطفاً «بهترش» نکن:
//     این گارد فقط مقدارِ **کاملاً‌مشخص** را می‌گیرد، نه قطعه‌ی برهنه را.
//     `github.com/wrong/repo` قرمز می‌شود؛ `wrong/repo` تنها نه.
//     `biz.rezervno.ir` قرمز می‌شود؛ کلمه‌ی `biz.` تنها نه.
//     دلیلش این نیست که فراموش شده — قطعه‌ی برهنه در متنِ فارسیِ عادی مثبتِ
//     کاذب می‌سازد، و همین گارد در اجرای اولش ۲۳ کاذب از ۲۶ داد. گاردی که
//     نویز بدهد ظرف یک هفته خاموش می‌شود و آن‌وقت هیچ‌چیز را نمی‌گیرد.
//     نقصِ واقعی همیشه در شکلِ کاملاً‌مشخص ظاهر شده است (یک `git clone`، یک
//     ردیفِ جدولِ DNS)، چون دستور باید قابلِ اجرا باشد تا ضرر بزند.
//
//  ⚠️ دامنه: فقط ۱۱۵ فایلِ **داخلِ مخزن**. دستورهای مالک، تصحیح‌های داخلِ چت،
//     و هر چیزی که paste می‌شود ولی commit نمی‌شود بیرونِ دیدِ این گاردند.
//     docs/audit/SESSION-HANDOFF.md بزرگ‌ترین سوراخ را بست؛ کلاس وقتی کامل
//     بسته می‌شود که هر فکتی که یک نشست به آن تکیه می‌کند خانه‌ی commit‌شده
//     داشته باشد.
//
//  اجرا:  node tools/check-doc-staleness.mjs
//  خروج:  ۰ سالم · ۱ با فهرستِ دقیقِ file:line
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];

// ── فایل‌هایی که کارشان ثبتِ تاریخ است و حق دارند غلط را عیناً نقل کنند ──
// مسیر-محور و عمدی: یک مارکرِ خطی («stale-ok») به هرکس اجازه می‌داد گارد را
// با یک کامنت ساکت کند، و آن دقیقاً همان درِ فرارِ خاموش است.
const HISTORY = [
  'docs/reports/',                 // گزارش‌های تاریخ‌دارِ CEO — سندِ لحظه‌ی خودشان‌اند
  'docs/audit/reports/',           // همان گزارش‌ها پس از جابه‌جایی به این مسیر (۲۰۲۶-۰۹-۰۴)
  'docs/audit/PRE-LAUNCH-',        // ممیزی‌های بسته‌شدهی دورهای ۳–۱۴
  'docs/AUDIT-FIXES-',             // همان
  'docs/PRODUCT-EXPERIENCE-AUDIT', // همان
  'docs/UI-UX-AUDIT-',             // همان
  'docs/PROJECT-AUDIT-HANDOFF',    // همان
  'docs/KNOWN_LIMITATIONS.md',     // فهرستِ محدودیت‌ها: کارش نام‌بردنِ چیزهای غلط است
  'docs/audit/redteam/',          // رونوشتِ حمله‌هایِ Red Team: نامِ متغیرهایِ probe عمداً ساختگی‌اند
];
const isHistory = (rel) => HISTORY.some((h) => rel.startsWith(h));

function mdFiles() {
  const out = [];
  for (const f of readdirSync(REPO)) if (f.endsWith('.md')) out.push(f);
  const walk = (d) => {
    for (const e of readdirSync(join(REPO, d))) {
      const rel = `${d}/${e}`;
      if (statSync(join(REPO, rel)).isDirectory()) walk(rel);
      else if (e.endsWith('.md')) out.push(rel);
    }
  };
  if (existsSync(join(REPO, 'docs'))) walk('docs');
  return out.filter((r) => !isHistory(r));
}

const files = mdFiles();
// قاعده‌ی ۵: نبودِ موضوع خطاست، نه عبور.
if (files.length === 0) { console.error('❌ هیچ سندی برای بررسی پیدا نشد — گاردِ توخالی'); process.exit(1); }

const lines = new Map(files.map((f) => [f, readFileSync(join(REPO, f), 'utf8').replace(/\r\n/g, '\n').split('\n')]));
const each = (fn) => { for (const [f, ls] of lines) ls.forEach((l, i) => fn(f, i + 1, l)); };

// ── فنس‌های کدی (```/~~~) که چکِ ۲ و چکِ ۳ باید نادیده بگیرند ────────────
// چرا: قانونِ راستی‌آزمایی همین مخزن ایجاب می‌کند شواهد به‌شکلِ transcriptِ خام
// (دستور + EXIT کد) عیناً paste شوند. داخلِ آن transcript متغیرهای شِلِ محلی
// (مثلِ `EXIT=$?`, `REAL_NPM_TEST_EXIT=$?`) یا حتی یک `export JWT_ACCESS_SECRET=…`
// در حینِ آماده‌سازیِ تست می‌آیند — این‌ها **ادعای پیکربندی نیستند، رونوشتِ
// یک اجرا هستند**. بدونِ این فنس‌گیری، تنها راهِ رد شدن از گارد دستکاریِ خودِ
// شاهد بود (کوچک‌نویسیِ `EXIT=`، حذفِ نام‌های واقعی) — یعنی گارد رکوردی را که
// قرار است ازش محافظت کند خراب می‌کرد.
//
// چه چیزی «فنس» حساب می‌شود: خطی که — با هر مقدار فاصله/تبِ پیشوند (فنسِ
// تودرتوی زیرِ یک آیتمِ لیست هم باید تشخیص داده شود) — با ۳+ بک‌تیک یا ۳+
// تیلد شروع می‌شود. برای بک‌تیک: اگر باقیِ همان خط (برچسبِ زبان) خودش بک‌تیک
// دارد، این فنس نیست بلکه یک اسپنِ این‌لاین است که تصادفاً خطش با بک‌تیک شروع
// شده. فنسِ بسته باید همان کاراکتر را داشته باشد، طولش حداقل برابرِ فنسِ باز
// باشد، و بعدش چیزی جز فاصله نیاید — همان قاعده‌ی CommonMark.
//
// فنسِ **بازمانده تا آخرِ فایل**: CommonMark می‌گوید چنین بلوکی تا انتهای سند
// ادامه دارد. اگر همین‌جا بی‌صدا همه‌چیز تا EOF را «داخلِ فنس» بدانیم و کارِ
// دیگری نکنیم، یک درِ فرارِ تازه باز شده — کافی است یک نویسنده یک ``` را
// نبندد تا بقیه‌ی سند از دیدِ چکِ ۲/۳ پنهان شود. پس: قلمروِ فنس را طبقِ
// CommonMark تا EOF می‌گیریم (با رندرشدنِ واقعی هم‌خوان)، **ولی علاوه بر آن**
// خودِ نبستنِ فنس را به‌عنوانِ یک نقصِ ساختاری در `fails` ثبت می‌کنیم — گارد
// صفر برنمی‌گردد تا فنس بسته شود. پس این یک راهِ فرار نیست، یک نقصِ
// اجباری‌الاصلاح است.
//
// اسپنِ این‌لاینِ تک‌بک‌تیک (مثلِ «مقدارش را با `EXIT=0` تایید کن» وسطِ یک
// جمله) فنس نیست و **عمداً معاف نمی‌شود**: دقیقاً همین شکل — ادعای پیکربندی
// وسطِ نثر، نه داخلِ یک transcript — موضوعِ اصلیِ این گارد است. معاف کردنش
// یک allowlistِ تازه می‌ساخت که قانونِ ۴ب صریحاً ممنوعش کرده.
//
// ── راندِ ۲ (۲۰۲۶-۰۹-۰۴): قاعده‌ی افزایشیِ scan-if — نه معافیتِ کورکورانه ──
// راندِ ۱ همه‌ی فنس‌ها را یکسان معاف کرد. اثباتش این بود که یک recipeِ واقعیِ
// اجرایی (`docs/recovery/BASELINE-TEST-STATUS.md:23`, `export DATABASE_URL=…`
// داخلِ یک فنس) اگر تغییرِ نام بخورد دیگر گرفته نمی‌شود — چون فقط «فنس بودن»
// را می‌سنجید، نه «این فنس دستورالعملِ زنده است یا رونوشتِ یک اجرا».
//
// راه‌حل: نویسنده‌ها از قبل این تفکیک را با tagِ زبان اعلام می‌کنند — سنجشِ
// زنده‌ی کورپوس (۲۰۲۶-۰۹-۰۴، با همین fenceMask روی همین ۱۱۸ فایل):
//   bash 45 · text 23 · mermaid 22 · ts 14 · json 11 · sql 8 · js 7 · css 6 ·
//   prisma 6 · sh 4 · jsonc 2 · html 2 · tsx 2 · ini 1 · python 1 · بدونِ‌تگ 87
// (فرمانِ سنجش در `audit/round-20/STALENESS-FENCE-FIX-2.md`ثبت شده — این
// اعداد با اعدادِ اولیه‌ی سفارش‌دهنده کمی فرق دارد چون کورپوس زنده است و
// عامل‌های دیگر هم‌زمان روی docs/ کار می‌کنند؛ سنجش را تکرار کن، حدس نزن.)
// `text`/`mermaid`/`ts`/`json`/… یک خوشه‌ی مجزا و بزرگ‌اند (کارشان مستندسازی
// یا رونوشتِ خروجی است)، `bash`/`sh`/`ini` خوشه‌ی مجزای کوچک‌تری‌اند (کارشان
// «این را اجرا کن» است). این **allowlist نیست** — یک allowlist استثنا به یک
// سیگنالِ نویزی اضافه می‌کند تا ساکت شود؛ این‌جا سیگنال از اول تمیز است،
// چون نویسنده‌ها از قبل همین قرارداد را رعایت می‌کنند. ما فقط دارد همان
// قراردادِ موجود را برمی‌خوانیم، استثنایی اختراع نمی‌کنیم.
//
// قاعده — **فقط افزایشی، هیچ بندِ کاهشی جایی نیست**: یک بلوکِ فنس‌شده
// scan می‌شود اگر (الف) فایل در EXEC_PATHS باشد — با هر tagی، حتی بدونِ tag —
// یا (ب) خودِ بلوک info-stringِ اجرایی داشته باشد (`EXEC_TAGS`). مسیر
// scopeاضافه می‌کند، tag هم اضافه می‌کند؛ هیچ‌کدام scope را کم نمی‌کنند. شکلِ
// کاهشی (مثلِ «فقط بدونِ‌تگ‌ها در EXEC_PATHS اسکن شوند») یک بایپاسِ یک‌کلمه‌ای
// می‌ساخت: نوشتنِ ` ```text ` روی یک recipeِ واقعی در docs/recovery/ آن را
// بی‌صدا از scope بیرون می‌انداخت. زیرِ قاعده‌ی افزایشی هیچ کلیدواژه‌ای
// coverage را کم نمی‌کند — فقط می‌تواند اضافه کند.
//
// چرا مسیر (نه یک مارکرِ این‌لاین مثلِ «<!-- exec -->»): همان استدلالِ خودِ
// HISTORY در بالا — یک مارکر به هرکس اجازه می‌دهد گارد را با یک کامنت خاموش
// (یا روشن) کند؛ مسیر را فقط کسی تغییر می‌دهد که PR بزند.
const EXEC_PATHS = [
  'docs/recovery/',
  'docs/DEPLOYMENT.md',
  'docs/ENVIRONMENT.md',
  'docs/VERCEL-DEPLOYMENT-CHECKLIST.md',
  'docs/DEPLOY_API_VERCEL.md',
];
const isExecPath = (rel) => EXEC_PATHS.some((p) => rel.startsWith(p));
// دقیقاً همان ۹ تگِ سفارش‌شده — نه مترادف، نه حدس (`shell`، `yml`، `console`
// عمداً نیستند؛ اضافه‌کردنشان همان اختراعِ heuristic است که این قاعده رد کرده).
// case-insensitive عمدی است: تایپِ ```Dockerfile یا ```DOCKERFILE نباید
// نتیجه‌ی متفاوتی بدهد — هیچ کیس‌ای نباید coverage را کم کند.
const EXEC_TAGS = new Set(['bash', 'sh', 'zsh', 'yaml', 'env', 'dotenv', 'ini', 'dockerfile', 'make']);

function fenceMask(fileLines, rel) {
  const mask = new Array(fileLines.length).fill(false);
  const execPath = isExecPath(rel);
  const skipCounts = { nonExecutable: 0, untaggedOutsideSet: 0 };
  let inFence = false;
  let fenceChar = null;
  let fenceLen = 0;
  let openLine = -1;
  let scanning = false; // این فنسِ بازِ فعلی طبقِ قاعده‌ی افزایشی اسکن می‌شود؟
  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i];
    if (inFence) {
      const close = /^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
        mask[i] = true; // خودِ خطِ بستن، مثلِ خطِ باز، صرفاً نحوِ مارک‌داون است
        inFence = false; fenceChar = null; fenceLen = 0; openLine = -1; scanning = false;
        continue;
      }
      mask[i] = !scanning; // محتوا: اسکن‌شده یعنی نادیده‌گرفته‌نشده
      continue;
    }
    const open = /^[ \t]*(`{3,}|~{3,})(.*)/.exec(line);
    if (!open) continue;
    const marker = open[1];
    const infoString = open[2];
    if (marker[0] === '`' && infoString.includes('`')) continue; // اسپنِ این‌لاین روی خطِ خودش، نه بازکننده‌ی بلاک
    mask[i] = true; // خطِ بازکننده هم مثلِ بستن، نحو است نه محتوا
    inFence = true;
    fenceChar = marker[0];
    fenceLen = marker.length;
    openLine = i + 1;
    const tag = infoString.trim().split(/\s+/)[0] ?? '';
    if (execPath || (tag && EXEC_TAGS.has(tag.toLowerCase()))) {
      scanning = true;
    } else {
      scanning = false;
      const reason = tag ? 'nonExecutable' : 'untaggedOutsideSet';
      skipCounts[reason] += 1;
    }
  }
  return { mask, unclosedAt: inFence ? openLine : null, skipCounts };
}

const fenceByFile = new Map();
// شرطِ ضدِ سکوت (سفارشِ راندِ ۲): هر بلوکِ نادیده‌گرفته‌شده باید شمرده و
// گزارش شود — نه فقط جمعِ کل، به‌تفکیکِ فایل هم، چون «نادیده‌گرفتنی که هیچ‌جا
// دیده نشود» همان درِ فرارِ خاموشی است که قانونِ ۴ ممنوعش کرده.
const skipTotals = { nonExecutable: 0, untaggedOutsideSet: 0 };
const skipsByFile = new Map();
for (const [f, ls] of lines) {
  const { mask, unclosedAt, skipCounts } = fenceMask(ls, f);
  fenceByFile.set(f, mask);
  skipTotals.nonExecutable += skipCounts.nonExecutable;
  skipTotals.untaggedOutsideSet += skipCounts.untaggedOutsideSet;
  if (skipCounts.nonExecutable > 0 || skipCounts.untaggedOutsideSet > 0) skipsByFile.set(f, skipCounts);
  if (unclosedAt !== null) {
    fails.push(
      `${f}:${unclosedAt} — فنسِ کد باز شده و تا انتهای فایل بسته نشده؛ طبقِ CommonMark ` +
        'محتوای بعدش همه کدِ همان بلوک حساب می‌شود، ولی خودِ نبستن یک نقصِ ساختاری است — فنس را ببند.',
    );
  }
}
// چکِ ۲ و چکِ ۳ فقط خطوطِ «نادیده‌گرفته‌شده» را رد می‌کنند؛ چکِ ۱ عمداً دست‌نخورده
// می‌ماند (دامنه‌ی این تغییر طبقِ سفارش فقط چکِ ۲ و ۳ است).
const eachOutsideFence = (fn) => {
  for (const [f, ls] of lines) {
    const mask = fenceByFile.get(f);
    ls.forEach((l, i) => { if (!mask[i]) fn(f, i + 1, l); });
  }
};

// ═══ چک ۱ — آدرسِ مخزن باید با git remote بخواند ═══════════════════════
const origin = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: REPO, encoding: 'utf8' }).trim();
const om = /github\.com[/:]([^/]+)\/([^/\s.]+)/.exec(origin);
if (!om) { console.error(`❌ origin خوانده نشد: ${origin}`); process.exit(1); }
const [, OWNER, NAME] = om;

// فقط URLهایی که **ادعای همین پروژه** را دارند؛ لینکِ کتابخانه‌ی ثالث ربطی ندارد.
const OURS = /rezerv|rezv/i;
let ghSeen = 0;
each((f, n, line) => {
  for (const m of line.matchAll(/github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?=[)\s`"'/]|$)/g)) {
    const [, o, r] = m;
    if (!OURS.test(r) && !OURS.test(o)) continue;   // ثالث
    ghSeen++;
    if (o !== OWNER || r !== NAME) {
      fails.push(`${f}:${n} — آدرسِ مخزن «${o}/${r}» با origin («${OWNER}/${NAME}») نمی‌خواند`);
    }
  }
});
if (ghSeen === 0) fails.push('چکِ ۱ هیچ آدرسِ مخزنی ندید — یا اسناد عوض شده‌اند یا الگو شکسته است');

// ═══ چک ۲ — زیردامنه‌ای که پروکسی سرو نمی‌کند ═══════════════════════════
const caddy = readFileSync(join(REPO, 'deploy/caddy/Caddyfile'), 'utf8');
const served = new Set([...caddy.matchAll(/^\s*([a-z0-9-]+)\.\{\$DOMAIN\}\s*\{/gm)].map((m) => m[1]));
if (served.size === 0) { console.error('❌ هیچ vhostی در Caddyfile پیدا نشد — چکِ ۲ توخالی می‌شد'); process.exit(1); }

// زیردامنه‌هایی که عمداً پروکسیِ ما سرو نمی‌کند. هر ردیف یک **افشا**ست، نه تأیید.
const NOT_OURS = new Map([
  ['www', 'ریدایرکتِ ریشه؛ در ALLOWED_ORIGINS هست، vhostِ جدا ندارد'],
  ['find', 'apps/seo روی Vercel است (ADR 0002 §۶) — عمداً نه روی این سرور'],
  ['staging', 'آینه‌ی staging؛ روی همان الگو ولی میزبانِ دیگر'],
]);
let hostSeen = 0;
// eachOutsideFence نه each: میزبانِ داخلِ یک transcriptِ paste‌شده (خروجیِ curl/dig)
// شاهد است، ادعای vhost نیست.
eachOutsideFence((f, n, line) => {
  for (const m of line.matchAll(/\b([a-z][a-z0-9-]*)\.rezervno\.(?:ir|com)\b/g)) {
    const sub = m[1];
    hostSeen++;
    if (served.has(sub) || NOT_OURS.has(sub)) continue;
    fails.push(
      `${f}:${n} — میزبانِ «${sub}.rezervno.ir» را هیچ vhostی سرو نمی‌کند ` +
        `(Caddy: ${[...served].join(', ')}). با این نام TLS صادر نمی‌شود.`,
    );
  }
});
if (hostSeen === 0) fails.push('چکِ ۲ هیچ زیردامنه‌ای ندید — الگو شکسته است');

// ═══ چک ۳ — متغیرِ محیطی که هیچ‌جا وجود ندارد ══════════════════════════
// ⚠️ اجرای اولِ این چک ۲۳ مثبتِ کاذب از ۲۶ داد: الگوی `| `UPPER_SNAKE` |` سیگنالِ
// «متغیرِ محیطی» نیست — جدولِ کدهای خطا (`FORBIDDEN_TENANT`) و enumها
// (`SERVER_VERIFIED`) دقیقاً همان شکل را دارند. گاردی با این نرخ ظرف یک هفته
// خاموش می‌شود، و allowlistِ ۲۳تایی هم پوشاندنِ مسئله بود نه حلش.
// دو سیگنالِ دقیق جایش نشست:
//   الف) ردیفِ جدول **فقط در docs/ENVIRONMENT.md** — ماتریسِ رسمیِ env
//   ب) خطِ انتسابِ `VAR=...` در هر سند — یعنی دستورِ تنظیم
// جمله‌ای که می‌گوید «VAR حذف شد» هیچ‌کدام نیست و قرمز نمی‌کند — درست هم همین است.
const envExample = existsSync(join(REPO, 'api/.env.example'))
  ? readFileSync(join(REPO, 'api/.env.example'), 'utf8') : '';
const composeText = ['docker-compose.yml', 'docker-compose.prod.yml', 'docker-compose.observability.yml']
  .filter((p) => existsSync(join(REPO, p))).map((p) => readFileSync(join(REPO, p), 'utf8')).join('\n');
let codeText = '';
try {
  codeText = execFileSync('git', ['grep', '-h', '-oE', 'process\\.env\\.[A-Z][A-Z0-9_]*', '--', 'api/src', 'api/tests', 'api/*.ts', 'tools', 'apps', 'e2e', 'loadtest', 'cron', 'backup'],
    { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
} catch { /* git grep exits 1 when nothing matches */ }
const known = new Set([
  ...envExample.matchAll(/^#?\s*([A-Z][A-Z0-9_]{2,})\s*=/gm),
  ...composeText.matchAll(/\b([A-Z][A-Z0-9_]{2,})\s*:/g),
  ...composeText.matchAll(/\$\{([A-Z][A-Z0-9_]{2,})/g),
  ...codeText.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g),
].map((m) => m[1]));
if (known.size === 0) { console.error('❌ هیچ متغیرِ محیطیِ شناخته‌شده‌ای جمع نشد — چکِ ۳ توخالی می‌شد'); process.exit(1); }

// ⚠️ ۲۰۲۶-۰۹-۰۹ — متغیرهای ذاتیِ پوسته هرگز «پیکربندیِ اپ» نیستند؛ خودِ محیط‌اند.
//    این چک عمداً داخلِ فنسِ `sh` را اسکن می‌کند (`EXEC_TAGS` شاملِ `sh` است، و
//    قاعده افزایشی است تا نوشتنِ یک تگِ بی‌ضرر روی یک recipeِ واقعی بایپاسِ
//    یک‌کلمه‌ای نشود) — و آن تصمیم درست است، عوض نشد.
//    ولی نتیجه‌ی جانبی‌اش این بود که خطِ
//        export PATH="/c/Program Files/nodejs:$PATH"
//    یعنی رایج‌ترین خطِ هر رونوشتِ اجرا روی این ماشین، به‌عنوانِ «متغیرِ
//    پیکربندیِ ناشناس» گیت را قرمز می‌کرد. اولین قربانی‌اش
//    `docs/audit/deputy/ORDER-001-xss-rereview-queue.md:450` بود که با ادغامِ
//    ۲۰۲۶-۰۹-۰۹ روی main آمد.
//    قانونِ §4b: گاردی که با قالبِ شواهدِ اجباریِ ما دشمن است، همان رکوردی را
//    خراب می‌کند که برای محافظتش ساخته شده — نویسنده مجبور می‌شود شواهدِ خودش
//    را تحریف کند تا گیت سبز شود.
//    پس **سیگنال باریک شد، نه allowlist**: این‌ها نام‌های ذاتیِ POSIX/پوسته‌اند
//    که هیچ‌وقت در `.env.example` نمی‌آیند، نه معافیتِ پروژه‌ای. یک نامِ واقعیِ
//    پیکربندی همچنان گرفته می‌شود.
const SHELL_INTRINSIC = new Set([
  'PATH', 'HOME', 'PWD', 'OLDPWD', 'SHELL', 'TERM', 'USER', 'LOGNAME',
  'LANG', 'LC_ALL', 'TMPDIR', 'TMP', 'TEMP', 'HOSTNAME', 'EDITOR', 'PAGER',
]);

let envSeen = 0;
const ENV_MATRIX = 'docs/ENVIRONMENT.md';
// eachOutsideFence نه each: خطِ `export FOO=...` داخلِ یک transcript رونوشتِ
// اجراست، نه دستورِ تنظیمِ پیکربندی (سرصفحه‌ی بالای فایل را ببین).
eachOutsideFence((f, n, line) => {
  let name = null;
  if (f === ENV_MATRIX) name = (/^\|\s*`([A-Z][A-Z0-9_]{2,})`\s*\|/.exec(line) ?? [])[1] ?? null;
  // ⚠️ یک انتسابِ تنها (مثلِ `EXIT=1` در بلوکِ **خروجی**) دستورِ تنظیم نیست.
  // فقط وقتی دستور است که خط واقعاً چیزی را اجرا کند یا export باشد.
  if (!name && /(?:^|[^A-Za-z])(?:export|npm|npx|node|sh|bash|docker|psql|prisma)(?![A-Za-z])/.test(line)) {
    name = (/(?:^|[\s`$])(?:export\s+)?([A-Z][A-Z0-9_]{2,})=/.exec(line) ?? [])[1] ?? null;
  }
  if (!name || SHELL_INTRINSIC.has(name)) return;
  envSeen++;
  if (!known.has(name)) {
    fails.push(`${f}:${n} — متغیرِ «${name}» به‌عنوانِ پیکربندی عرضه شده ولی نه در .env.example است، نه در compose، نه در کد`);
  }
});
if (envSeen === 0) fails.push('چکِ ۳ هیچ ردیفِ متغیری ندید — الگو شکسته است');

// ═══ گزارشِ فنس‌هایِ نادیده‌گرفته‌شده — شرطِ ضدِ سکوت ═══════════════════════
// «نادیده‌گرفتنی که هیچ‌جا دیده نشود» خودش همان درِ فرارِ خاموشی است که این
// فایل برای بستنش نوشته شده. همیشه چاپ می‌شود — چه گارد سبز باشد چه قرمز —
// و با تعدادِ صفر هم چاپ می‌شود تا «هیچی نادیده گرفته نشد» ادعایی قابلِ رصد
// باشد، نه فقط غیابِ یک خط.
const skipLine =
  `${skipTotals.nonExecutable} فنسِ غیرِ-اجرایی (نادیده) · ` +
  `${skipTotals.untaggedOutsideSet} فنسِ بدونِ‌برچسب-خارجِ-دامنه (نادیده)`;
console.error(`— فنس‌هایِ نادیده‌گرفته‌شده طبقِ قاعده‌ی افزایشی: ${skipLine}`);
if (skipsByFile.size > 0) {
  for (const [f, c] of [...skipsByFile.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    console.error(`  ⤷ ${f} — ${c.nonExecutable} غیرِ-اجرایی · ${c.untaggedOutsideSet} بدونِ‌برچسب-خارجِ-دامنه`);
  }
}

// ═══ گزارش ═══════════════════════════════════════════════════════════
if (fails.length) {
  console.error(`\n❌ کهنگیِ سند — ${fails.length} مورد:\n`);
  for (const x of fails) console.error('  • ' + x);
  console.error('\nسندی که دروغ می‌گوید هم‌کلاسِ فیچرِ جعلی است. یا سند را درست کن، یا اگر');
  console.error('واقعاً ثبتِ تاریخ است، مسیرش را به فهرستِ HISTORY در همین فایل اضافه کن.');
  process.exit(1);
}
console.log(
  `✓ اسناد تازه‌اند — ${files.length} فایل · ${ghSeen} آدرسِ مخزن · ${hostSeen} زیردامنه · ${envSeen} ردیفِ متغیر · ${skipLine}`,
);
