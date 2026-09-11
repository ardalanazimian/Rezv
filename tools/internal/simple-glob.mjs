// ═══════════════════════════════════════════════════════════════════════
//  simple-glob.mjs — پیمایشِ بازگشتیِ سبک برای xss-sink-audit.mjs
//  عمداً بدونِ dependency (نه glob/fast-glob) — این پروژه در ریشه package.json
//  ندارد و افزودنِ یک dependency فقط برایِ یک اسکنرِ ساده منطقی نیست.
// ═══════════════════════════════════════════════════════════════════════
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage']);

export default function simpleGlob(rootDir, extensions) {
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
  }
  walk(rootDir);
  // ⚠️ مرتب‌سازی تزئینی نیست — گیت بدونش وابسته به فایل‌سیستم است (۲۰۲۶-۰۹-۱۱).
  //
  // `readdirSync` ترتیبِ فایل‌سیستم را می‌دهد: روی NTFS الفبایی، روی ext4 با
  // dir_index ترتیبِ هَش. آرتیفکتِ `xss-sink-audit` **کامیت می‌شود** و
  // `--check` آن را بایت‌به‌بایت با بازتولیدِ همان لحظه می‌سنجد. پس آرتیفکتی
  // که روی ویندوز ساخته شده، روی رانرِ لینوکسِ CI می‌تواند فقط به‌خاطرِ
  // **ترتیب** ناهم‌خوان دربیاید و «کهنه است» گزارش شود — شکستی که هیچ ربطی
  // به تازگیِ محتوا ندارد و با بازتولیدِ دوباره هم درست نمی‌شود.
  //
  // اندازه‌گیری‌شده، نه فرض: همین اسکنر با پیمایشِ معکوس روی همین درخت،
  // همان ۲۲۴ سینک و همان شمارشِ طبقه‌بندی را می‌دهد ولی JSONِ **بایت‌متفاوت**
  // (حتی ترتیبِ کلیدهای by_classification عوض می‌شود، چون از ترتیبِ برخورد
  // می‌آید). یعنی خروجی به ترتیبِ پیمایش گره خورده بود.
  //
  // مقایسه روی مسیرِ نرمال‌شده است، نه مسیرِ خامِ سیستم‌عامل: جداکننده‌ی
  // ویندوز `\` (0x5C) و لینوکس `/` (0x2F) نسبت به حروفِ بزرگ (0x41–0x5A)
  // دو طرفِ مخالف می‌افتند، پس sortِ خام خودش یک اختلافِ بین‌سکویی می‌سازد.
  return out.sort((a, b) => {
    const na = a.split('\\').join('/');
    const nb = b.split('\\').join('/');
    return na < nb ? -1 : na > nb ? 1 : 0;
  });
}
