#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ کلیدِ تکراری در .env.example
//
//  چرا (اندازه‌گیریِ ۲۰۲۶-۰۹-۱۸، مسیرِ S-06): `.env.example` متغیرِ
//  `ALLOWED_ORIGINS` را **دو بار** تعریف کرده بود — خطِ ۴۵ زیرِ هشدارِ
//  «مهم‌ترین متغیرِ لانچ» با دامنه‌ی نمونه، و خطِ ۱۶۳ با دامنه‌های
//  `rezervno.ir` به‌صورتِ ثابت. اپراتوری که فایل را کپی می‌کند، هشدار را
//  می‌خواند و خطِ ۴۵ را با دامنه‌ی واقعیِ خودش پر می‌کند، **مقدارش بی‌صدا
//  دور ریخته می‌شود.**
//
//  چرا بی‌صدا، و چرا گاردِ موجود نمی‌گیردش — این نکته‌ی اصلی است:
//    ۱. اندازه‌گیری‌شده با خودِ ابزار (Docker Compose 29.7.2 روی همین ماشین):
//       با کلیدِ تکراری در `.env`، **مقدارِ آخر برنده است**. یعنی خطِ ۱۶۳.
//    ۲. `docker-compose.prod.yml:22` از `${ALLOWED_ORIGINS:?…}` استفاده می‌کند
//       که فقط **خالی** را می‌گیرد، نه **غلط**.
//    ۳. `api/src/middleware.ts` (`assertAllowedOriginsConfigured`) عمداً در
//       ۲۰۲۶-۰۸-۱۹ گسترش یافت تا «پرشدنِ غلط» را هم بگیرد — ولی آنچه می‌سنجد
//       **نحو** است (`parseAllowedOrigins` → `problems`). `https://rezervno.ir`
//       کاملاً خوش‌ساخت است. پس دقیقاً همان یک حالتی که این گارد برایش نوشته
//       شد، از دستش رد می‌شود.
//
//  پیامدش را خودِ همان فایل نوشته است: اگر originِ اپ در فهرست نباشد، مرورگر
//  درخواست‌ها را بلاک می‌کند، هیچ خطایی در لاگ نیست، و اپِ مشتری به دادهٔ
//  «نمونه» برمی‌گردد. یعنی روزِ لانچ روی دامنه‌ی واقعی، همه محتوایِ آزمایشی
//  می‌بینند — همان کلاسِ S-04، این بار در production.
//
//  محورِ سنجش (بندِ ۴c منشور — falsifiability محورمحور است): این گارد فقط
//  محورِ «کلیدِ تکراری در فایلِ نمونه» را می‌سنجد. **نمی‌سنجد** که مقدارِ
//  داخلِ `.env`ِ واقعی درست است یا با دامنه‌ی مستقرشده می‌خواند — آن فایل
//  gitignore است و هرگز به CI نمی‌رسد.
//
//  اجرا:  node tools/check-env-example-duplicates.mjs
//  خروج:  ۰ تمیز · ۱ با file:line هر تکرار
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// دامنه: هر فایلِ نمونه‌ی محیطیِ ردیابی‌شده. `.env`ِ واقعی عمداً بیرون است —
// gitignore شده و هرگز در مخزن نیست.
const IS_ENV_EXAMPLE = (p) => basename(p) === '.env.example' || basename(p).endsWith('.env.example');

// یک انتساب: نامِ متغیر در ابتدای خط، با `=` بعدش. خطِ کامنت (`#`) و خطِ
// خالی انتساب نیست. `export FOO=` هم پوشش داده می‌شود چون بعضی فایل‌های
// نمونه آن شکل را دارند.
const ASSIGNMENT = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=/;

let files;
try {
  files = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(IS_ENV_EXAMPLE);
} catch (err) {
  console.error(`❌ فهرستِ فایل‌ها از git گرفته نشد: ${err}`);
  process.exit(1);
}

// نبودِ موضوع خطاست، نه پاس (بندِ ۴ منشور): اگر هیچ .env.example ردیابی نشود،
// این گارد دارد هیچ‌چیز را می‌سنجد و باید همان را بگوید.
if (files.length === 0) {
  console.error('❌ هیچ فایلِ .env.example ردیابی‌شده‌ای پیدا نشد — این گارد چیزی نمی‌سنجد.');
  process.exit(1);
}

const offences = [];

for (const rel of files) {
  const seen = new Map(); // نامِ متغیر → [شماره‌ی خط، …]
  const text = readFileSync(join(REPO, rel), 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, i) => {
    const m = ASSIGNMENT.exec(line);
    if (!m) return;
    const key = m[1];
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(i + 1);
  });

  for (const [key, at] of seen) {
    if (at.length > 1) offences.push({ rel, key, at });
  }
}

if (offences.length) {
  console.error('❌ کلیدِ تکراری در فایلِ نمونه‌ی محیطی — مقدارِ آخر بی‌صدا برنده می‌شود:');
  for (const o of offences) {
    console.error(`   · ${o.rel}: «${o.key}» ${o.at.length} بار — خطوطِ ${o.at.join('، ')}`);
    console.error(`     برنده: خطِ ${o.at[o.at.length - 1]} (اندازه‌گیری‌شده با docker compose config)`);
  }
  console.error('   یکی را نگه دار و بقیه را حذف کن. اگر دو جا توضیح لازم است، دومی را کامنت کن.');
  process.exit(1);
}

const keyCount = files.reduce((n, rel) => {
  const text = readFileSync(join(REPO, rel), 'utf8');
  return n + text.split(/\r?\n/).filter((l) => ASSIGNMENT.test(l)).length;
}, 0);

console.log(`✓ کلیدِ تکراری نیست — ${files.length} فایلِ نمونه، ${keyCount} انتساب بررسی شد.`);
