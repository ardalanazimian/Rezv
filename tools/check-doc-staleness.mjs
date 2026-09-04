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
  'docs/audit/PRE-LAUNCH-',        // ممیزی‌های بسته‌شدهی دورهای ۳–۱۴
  'docs/AUDIT-FIXES-',             // همان
  'docs/PRODUCT-EXPERIENCE-AUDIT', // همان
  'docs/UI-UX-AUDIT-',             // همان
  'docs/PROJECT-AUDIT-HANDOFF',    // همان
  'docs/KNOWN_LIMITATIONS.md',     // فهرستِ محدودیت‌ها: کارش نام‌بردنِ چیزهای غلط است
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
each((f, n, line) => {
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

let envSeen = 0;
const ENV_MATRIX = 'docs/ENVIRONMENT.md';
each((f, n, line) => {
  let name = null;
  if (f === ENV_MATRIX) name = (/^\|\s*`([A-Z][A-Z0-9_]{2,})`\s*\|/.exec(line) ?? [])[1] ?? null;
  // ⚠️ یک انتسابِ تنها (مثلِ `EXIT=1` در بلوکِ **خروجی**) دستورِ تنظیم نیست.
  // فقط وقتی دستور است که خط واقعاً چیزی را اجرا کند یا export باشد.
  if (!name && /(?:^|[^A-Za-z])(?:export|npm|npx|node|sh|bash|docker|psql|prisma)(?![A-Za-z])/.test(line)) {
    name = (/(?:^|[\s`$])(?:export\s+)?([A-Z][A-Z0-9_]{2,})=/.exec(line) ?? [])[1] ?? null;
  }
  if (!name) return;
  envSeen++;
  if (!known.has(name)) {
    fails.push(`${f}:${n} — متغیرِ «${name}» به‌عنوانِ پیکربندی عرضه شده ولی نه در .env.example است، نه در compose، نه در کد`);
  }
});
if (envSeen === 0) fails.push('چکِ ۳ هیچ ردیفِ متغیری ندید — الگو شکسته است');

// ═══ گزارش ═══════════════════════════════════════════════════════════
if (fails.length) {
  console.error(`❌ کهنگیِ سند — ${fails.length} مورد:\n`);
  for (const x of fails) console.error('  • ' + x);
  console.error('\nسندی که دروغ می‌گوید هم‌کلاسِ فیچرِ جعلی است. یا سند را درست کن، یا اگر');
  console.error('واقعاً ثبتِ تاریخ است، مسیرش را به فهرستِ HISTORY در همین فایل اضافه کن.');
  process.exit(1);
}
console.log(
  `✓ اسناد تازه‌اند — ${files.length} فایل · ${ghSeen} آدرسِ مخزن · ${hostSeen} زیردامنه · ${envSeen} ردیفِ متغیر`,
);
