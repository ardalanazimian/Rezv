#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ «سندِ زنده به فایلی ارجاع ندهد که وجود ندارد»
//
//  چرا این ابزار ساخته شد (۲۰۲۶-۰۹-۰۹، به‌درخواستِ مالک):
//  `api/vercel.json` در ۲۰۲۶-۰۸-۲۸ عمداً حذف شد و زمان‌بندی به `cron/crontab`
//  منتقل شد. یازده سند هنوز نامش را می‌بردند. هزینه‌اش فرضی نیست: در
//  ۲۰۲۶-۰۹-۰۹ نشستِ CEO دنبالِ `vercel.json` گشت، نیافت، و در
//  `audit/ESCALATIONS.md` — سندی که مالک می‌خواند — نوشت «هیچ زمان‌بندی‌ای در
//  مخزن وجود ندارد». سه ادعا از آن یک جمله باطل شد. **سندِ کهنه فقط بی‌فایده
//  نیست؛ خواننده را به نتیجه‌ی غلط هدایت می‌کند.**
//
//  ⚠️ درسِ اصلی، که این ابزار حولِ آن ساخته شده:
//  از یازده سند، **هشت‌تایشان درست بودند** — نامِ فایلِ حذف‌شده را داخلِ
//  جمله‌ای می‌آوردند که می‌گفت حذف شده. آن سند کهنه نیست، دقیقاً درست است.
//  گاردی که این تمایز را نفهمد ۸ هشدارِ کاذب به ازای هر ۳ یافته می‌دهد، و
//  گاردِ پرِ هشدارِ کاذب گاردی است که آدم‌ها یاد می‌گیرند دورش بزنند. پس
//  «نشانه‌ی زمینه» صریح چک می‌شود.
//
//  ⚠️ دو باگ در نسخه‌ی اولِ همین کاوش، هر دو **ارجاعِ سالم را مرده نشان
//  می‌دادند** و اگر گزارش شده بودند ۱۲۵ سند را به‌غلط متهم می‌کردند:
//    ۱. alternationِ پسوند اولین‌تطبیق‌برنده است — `js` روی `json` می‌نشیند و
//       `api/package.json` به `api/package.js` بریده می‌شود. پسوندها **باید**
//       بلندترین‌اول بمانند.
//    ۲. تطبیق از وسطِ مسیر شروع می‌شد: `api/prisma/apply-sql.sh` از `prisma/`
//       شروع می‌گرفت. lookbehind لازم است.
//  هر دو در همین فایل رفع‌اند. اگر کسی الگو را عوض می‌کند، این دو را دوباره
//  بسنجد.
//
//  محدوده‌ی صریح: فقط **سندِ زنده**. `audit/round-*`, `docs/audit/directives`,
//  گزارش‌ها و سندهای تحویل، ثبتِ تاریخی‌اند و مجازند به چیزی ارجاع دهند که
//  دیگر نیست — بازنویسیِ گذشته بدتر از کهنگی است.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const EXT = 'tsx|json|yaml|prisma|html|mjs|mts|yml|css|sql|ts|js|py|sh|md';
const PATH_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9_/.\-])((?:api|apps|shared|tools|docs|standalone|cron|deploy|loadtest|audit)\/[A-Za-z0-9_./\-\[\]]+\.(?:${EXT}))(?![A-Za-z0-9])`,
  'g',
);

// ثبتِ تاریخی — مجاز است به گذشته ارجاع دهد.
// ⚠️ `.claude/agent-memory/` عمداً این‌جاست: آن‌ها **ثبتِ حادثه‌ی** یک نشست‌اند
// («فایلِ X سرِ فلان ساعت staged بود و بعد ?? شد»)، نه دستورالعمل. اگر فایلی که
// در حادثه نقش داشته بعداً حذف شود، حادثه همچنان درست است — و ویرایشِ حافظه‌ی
// ایجنتِ دیگر برای ساکت‌کردنِ یک گارد، بدترین شکلِ سبزکردن است.
const HISTORICAL = /^(audit\/round-|docs\/audit\/(directives|reports|redteam|round-|deputy|fixes|design|research)\/|docs\/recovery\/|docs\/AUDIT-FIXES|docs\/audit\/PRE-LAUNCH|docs\/audit\/SESSION-HANDOFF|\.claude\/agent-memory\/)/;

// نشانه‌هایی که می‌گویند نویسنده **می‌داند** این مسیر وجود ندارد.
const CONTEXT_OK = [
  'حذف شد', 'حذف‌شده', 'حذف شده', 'وجود ندارد', 'دیگر نیست', 'کهنه', 'منسوخ',
  'پیشنهادی', 'پیشنهاد', 'قرار است', 'هنوز ساخته نشده', 'does not exist',
  'deleted', 'removed', 'proposed', 'planned', 'no longer', 'was replaced',
  'does not yet', 'not exist', '~~',
];

function liveDocs() {
  const out = execSync('git ls-files "*.md"', { encoding: 'utf8', maxBuffer: 1e8 });
  return out.split('\n').filter((f) => f && !f.startsWith('node_modules/') && !HISTORICAL.test(f));
}

const docs = liveDocs();
// نبودِ موضوع = خطا. اگر روزی glob یا مسیرِ اجرا عوض شود و صفر فایل اسکن شود،
// این ابزار **نباید** سبز بماند — همان تله‌ای که گاردِ وفاداری امروز داشت.
if (docs.length === 0) {
  console.error('❌ هیچ سندی برای اسکن پیدا نشد — این خطاست، نه پاس. از ریشه‌ی مخزن اجرا کن.');
  process.exit(1);
}

const findings = [];
for (const f of docs) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(PATH_RE)) {
      const p = m[1].replace(/[.,;:)]+$/, '');
      if (existsSync(p)) continue;
      // زمینه: خودِ خط و یک خط بالا/پایین — تصحیح معمولاً خطِ بعد می‌آید.
      const ctx = [lines[i - 1] ?? '', line, lines[i + 1] ?? '', lines[i + 2] ?? ''].join('\n');
      if (CONTEXT_OK.some((k) => ctx.includes(k))) continue;
      findings.push({ file: f, line: i + 1, path: p });
    }
  });
}

console.log(`سندِ زنده اسکن‌شده: ${docs.length}`);
console.log('محدوده: فقط ارجاعِ مسیر. ادعاهای عددی، file:line و متنِ داخلِ سند سنجیده **نمی‌شوند** — این پوششِ کامل نیست.');

if (findings.length === 0) {
  console.log('\n✓ هیچ سندِ زنده‌ای به مسیرِ ناموجود ارجاع نمی‌دهد');
  process.exit(0);
}

console.error(`\n❌ ارجاعِ مرده در سندِ زنده — ${findings.length} مورد:\n`);
for (const x of findings) console.error(`  • ${x.file}:${x.line} → ${x.path}`);
console.error(
  '\nیا مسیر را درست کن، یا اگر فایل عمداً حذف/پیشنهادی است همان را **در متن بنویس**\n'
  + '(«حذف شد ۲۰۲۶-…»، «پیشنهادی»، یا خط‌خورده). سندی که خواننده را به نامِ اشتباه\n'
  + 'می‌فرستد، همان‌قدر خطرناک است که سندی که دروغ می‌گوید.',
);
process.exit(1);
