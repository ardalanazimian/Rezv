// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════
//  پنلِ شرکت — هر `details.reason`ِ سرور ترجمه‌ی انسانی دارد
//
//  ⚠️ `apps/company` تنها اپی بود که هیچ ممیزی نگرفته بود (دستورِ CEO،
//  ۲۰۲۶-۰۹-۰۹). اولین چیزی که پیدا شد، **پنجمین نمونه‌ی امروز از یک کلاس**
//  است: نگاشتی که از منبعش عقب افتاده.
//
//      سرور  → ۵ reason  (Err.conflict(...) در provisioning.ts و admin routes)
//      پنل   → ۴ ردیف    (PROV_REASON_FA در overview.js:235)
//      کم    → attach_existing_owner_unsupported
//
//  ⚠️ و چرا این «فقط یک ترجمه‌ی گم‌شده» نیست: fallback صادق بود — پیامِ
//  سرور نشان داده می‌شد، نه «خطای ناشناخته». ولی پیامِ سرورِ همین یکی
//  **مسیرِ خامِ HTTP** دارد:
//      «… از POST /admin/restaurants/{id}/branches استفاده کنید»
//  پس مدیرِ پلتفرم یک اندپوینتِ API را در رابطِ کاربری می‌دید — همان کلاسِ
//  «تغییر وضعیت از seated به completed» در پنلِ رستوران.
//
//  ⚠️ این تست کلاس را قفل می‌کند نه نمونه را: **هر** reasonِ تازه‌ای که به
//  سرور اضافه شود و ترجمه نگیرد، همین‌جا قرمز می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const OVERVIEW = fileURLToPath(new URL('apps/company/js/overview.js', ROOT));
const API_SRC = fileURLToPath(new URL('api/src/', ROOT));

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walkTs(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** هر `reason`ی که سرور می‌تواند در `Err.conflict` بدهد — از خودِ منبع. */
function serverReasons(): string[] {
  const found = new Set<string>();
  for (const f of walkTs(API_SRC)) {
    const src = readFileSync(f, 'utf8');
    // ⚠️ `[\s\S]` عمداً: نیمی از این فراخوان‌ها چندخطی‌اند و reason روی خطِ
    // بعد است. یک regexِ تک‌خطی سه‌تا از پنج‌تا را نمی‌دید — و آن‌وقت تست
    // «کامل است» می‌گفت در حالی که نصفِ منبع را ندیده بود.
    for (const m of src.matchAll(/Err\.conflict\(\s*[\r\n]?\s*'([a-z_]+)'/g)) found.add(m[1]);
  }
  return [...found].sort();
}

/** ردیف‌های نگاشتِ پنل — از خودِ فایل، نه یک رونوشتِ دستی در تست. */
function panelReasons(): { keys: string[]; texts: Record<string, string> } {
  const src = readFileSync(OVERVIEW, 'utf8');
  const i = src.indexOf('const PROV_REASON_FA = {');
  assert.notEqual(i, -1, 'PROV_REASON_FA پیدا نشد — نامش عوض شده؟');
  const body = src.slice(i, src.indexOf('\n};', i));
  const texts: Record<string, string> = {};
  for (const m of body.matchAll(/^\s*([a-z_]+):\s*'([^']*)'/gm)) texts[m[1]] = m[2];
  return { keys: Object.keys(texts).sort(), texts };
}

describe('پنلِ شرکت — پوششِ details.reason', () => {

  test('⚠️ هر reasonِ سرور ترجمه‌ی انسانی دارد', () => {
    const server = serverReasons();
    assert.ok(server.length >= 5, `فقط ${server.length} reason از منبع استخراج شد — روشِ استخراج شکسته است`);
    const panel = panelReasons().keys;
    const missing = server.filter((r) => !panel.includes(r));
    assert.deepEqual(
      missing, [],
      'این reasonها ترجمه ندارند، پس پیامِ خامِ سرور به مدیرِ پلتفرم می‌رسد: ' + missing.join(', '),
    );
  });

  test('⚠️ هیچ ترجمه‌ای مسیرِ خامِ API را به کاربر نشان نمی‌دهد', () => {
    // همان دلیلی که این ردیف اصلاً پیدا شد.
    const { texts } = panelReasons();
    const leaks = Object.entries(texts)
      .filter(([, t]) => /\/admin\/|POST |GET |PATCH |\{id\}/.test(t))
      .map(([k]) => k);
    assert.deepEqual(leaks, [], `متنِ این ردیف‌ها مسیرِ API دارد: ${leaks.join(', ')}`);
  });

  test('⚠️ پنل هیچ reasonی را ادعا نمی‌کند که سرور نمی‌دهد', () => {
    // جهتِ مخالف: ردیفِ مرده هم یک ادعای بی‌مکانیزم است.
    const server = serverReasons();
    const ghosts = panelReasons().keys.filter((r) => !server.includes(r));
    assert.deepEqual(ghosts, [], `ردیفِ بدونِ منبع در سرور: ${ghosts.join(', ')}`);
  });
});
