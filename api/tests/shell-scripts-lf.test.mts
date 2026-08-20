import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════
//  قفلِ رگرسیون: هیچ شل‌اسکریپتی نباید CRLF داشته باشد
//
//  ⚠️ یافته‌ی واقعیِ P0 (۲۰۲۶-۰۸-۲۰): پنج اسکریپت با شبنگِ `#!/bin/sh` به
//  CRLF ذخیره شده بودند. روی لینوکس کرنل دنبالِ مفسری به نامِ `/bin/sh\r`
//  می‌گردد که وجود ندارد. اثباتِ تجربی (نه استدلال):
//
//      نسخه‌ی CRLF:  exit=127  «cannot execute: required file not found»
//      نسخه‌ی LF:    اجرا شد و وارد منطقِ خودش شد
//
//  و api/Dockerfile دقیقاً همان را exec می‌کند:
//      ENTRYPOINT ["dumb-init", "--"] ; CMD ["/docker-entrypoint.sh"]
//  یعنی کانتینرِ API بالا نمی‌آمد. طبقِ git، از اولین کامیت (۲۰۲۶-۰۷-۲۹)
//  این‌طور بوده — پس مسیرِ استقرارِ Docker هرگز آن‌طور که نوشته شده کار نکرده.
//
//  .gitattributes حالا `*.sh text eol=lf` دارد و جلوی برگشتنش را می‌گیرد،
//  ولی .gitattributes فقط روی چیزی که از طریقِ git می‌آید اثر دارد. این تست
//  خودِ فایل‌هایِ رویِ دیسک را می‌خواند — یعنی حتی اگر کسی فایلی را با ابزارِ
//  دیگری اضافه کند، باز هم گرفته می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const REPO_ROOT = new URL('../../', import.meta.url).pathname;
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'playwright-report', 'test-results']);

function findShellScripts(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;   // پوشه‌ی غیرقابلِ‌خواندن نباید کلِ تست را بشکند
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) findShellScripts(full, out);
    else if (name.endsWith('.sh') || name.endsWith('.bash')) out.push(full);
  }
  return out;
}

describe('شل‌اسکریپت‌ها باید LF باشند (باگِ شبنگِ CRLF)', () => {
  const scripts = findShellScripts(REPO_ROOT);

  test('اسکنر واقعاً فایل پیدا می‌کند (وگرنه تستِ زیر توخالی است)', () => {
    // بدونِ این، اگر مسیر عوض شود اسکنر صفر فایل می‌دهد و تستِ بعدی
    // بی‌سروصدا همیشه سبز می‌ماند — یعنی هیچ‌چیز را محافظت نمی‌کند.
    assert.ok(scripts.length >= 5,
      `انتظارِ دست‌کم ۵ شل‌اسکریپت، ولی ${scripts.length} پیدا شد — مسیرِ اسکنر را چک کن`);
  });

  test('هیچ شل‌اسکریپتی کاراکترِ CR ندارد', () => {
    const offenders = scripts
      .filter(p => readFileSync(p, 'utf8').includes('\r'))
      .map(p => p.replace(REPO_ROOT, ''));
    assert.deepEqual(offenders, [],
      `این اسکریپت‌ها CRLF دارند و روی لینوکس اجرا نمی‌شوند: ${offenders.join(', ')}`);
  });

  test('هر اسکریپتی که شبنگ دارد، شبنگش سالم است', () => {
    const broken: string[] = [];
    for (const p of scripts) {
      const first = readFileSync(p, 'utf8').split('\n')[0];
      if (first.startsWith('#!') && first.endsWith('\r')) broken.push(p.replace(REPO_ROOT, ''));
    }
    assert.deepEqual(broken, [], `شبنگِ خراب (با \\r در انتها): ${broken.join(', ')}`);
  });
});
