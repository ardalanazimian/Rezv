#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ محلِ حافظه‌ی عامل‌ها — «`.claude/` فقط در ریشه»
//
//  ⚠️ چرا این فایل وجود دارد:
//  یک عاملی که cwdش `api/` است، حافظه‌اش را در `api/.claude/agent-memory/`
//  می‌نویسد، نه در ریشه. الگوهای `.claude/`ِ `.gitignore`ِ ریشه مسیرِ
//  **تودرتو** را نمی‌گیرند، پس آن پوشه untracked ولی **ignore‌نشده** می‌ماند:
//  یک `git add -A` از هر نشستی، حافظه‌ی خصوصیِ یک عامل را واردِ مخزنِ عمومی
//  می‌کند.
//
//  دو بار رخ داده و بارِ اول **واقعاً کامیت شد**:
//    ۲۰۲۶-۰۹-۰۴  عاملِ test-integrity → فایل‌هایش در یک کامیتِ جاروبی نشستند
//    ۲۰۲۶-۰۹-۰۶  عاملِ security      → پیش از کامیت گرفته شد، ولی فقط چون
//                                      کسی حینِ کارِ دیگری تعدادِ فایل‌ها را
//                                      diff کرد. هیچ گیرنده‌ی سومی نبود.
//
//  دو عاملِ مستقل با یک اشتباه = خاصیتِ ستاپ، نه خطای عامل. طبقِ قاعده‌ی ۲
//  منشور، چیزی که دوبار افتاده باید اجراشدنی شود نه به‌خاطر سپرده.
//
//  ⚠️ چرا `.gitignore` جوابِ این نیست:
//  ریشه‌ی `.claude/` **عمداً tracked** است (۳۸ فایل: عامل‌ها، skillها،
//  حافظه‌ی مشترک). چیزی که می‌خواهیم نگه داریم و چیزی که می‌خواهیم رد کنیم
//  **هم‌نام‌اند**. پس یک الگوی ignore یا هر دو را می‌گیرد یا هیچ‌کدام را —
//  تشخیص لازم است، نه پنهان‌کردن.
// ═══════════════════════════════════════════════════════════════════════

import { readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));

// جاهایی که اصلاً واردشان نمی‌شویم — نه استثنا برای `.claude`، بلکه
// پوشه‌هایی که محتوایشان مالِ ما نیست یا حجمشان پیمایش را بی‌معنا می‌کند.
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo']);

/** هر پوشه‌ی `.claude` را برمی‌گرداند، به‌جز ریشه. */
function findStray(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // پوشه‌ی بی‌اجازه یا ناپدیدشده — سکوت، نه شکستِ کاذب
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.name === '.claude') {
      const rel = relative(REPO, full);
      if (rel !== '.claude') out.push(rel.split(sep).join('/'));
      continue; // داخلِ خودِ `.claude` نمی‌رویم
    }
    findStray(full, out);
  }
  return out;
}

const stray = findStray(REPO);

if (stray.length) {
  console.error(`❌ پوشه‌ی \`.claude\` خارج از ریشه — ${stray.length} مورد:`);
  for (const s of stray) {
    let n = 0;
    try {
      n = readdirSync(join(REPO, s), { recursive: true }).filter((f) => {
        try { return statSync(join(REPO, s, f)).isFile(); } catch { return false; }
      }).length;
    } catch { /* شمارش شکست خورد — عدد را ادعا نکن */ }
    console.error(`  • ${s}${n ? `  (${n} فایل)` : ''}`);
  }
  console.error('');
  console.error('  `.claude/` فقط در ریشه‌ی مخزن معتبر است. یک پوشه‌ی تودرتو');
  console.error('  ignore **نمی‌شود** (الگوهای ریشه مسیرِ تودرتو را نمی‌گیرند)، پس');
  console.error('  یک `git add -A` حافظه‌ی خصوصیِ عامل را واردِ مخزن می‌کند.');
  console.error('');
  console.error('  رفع — **کپی و تأیید، بعد حذف**؛ هرگز مستقیم `mv` نکن، چون اگر');
  console.error('  مقصد از قبل فایلِ هم‌نام داشته باشد کارِ کسی را می‌بلعد:');
  console.error('    mkdir -p .claude/agent-memory/<agent>/');
  console.error('    cp -n <stray>/agent-memory/<agent>/*.md .claude/agent-memory/<agent>/');
  console.error('    diff -q ... # هر فایل، پیش از حذف');
  console.error('    rm -rf <stray>');
  process.exit(1);
}

console.log('✓ محلِ حافظه‌ی عامل‌ها درست است — هیچ پوشه‌ی `.claude` خارج از ریشه نیست');
