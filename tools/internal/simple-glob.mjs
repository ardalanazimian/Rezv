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
  return out;
}
