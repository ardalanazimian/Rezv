import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════
//  پوششِ ریت‌لیمیت — گاردِ ساختاری
//
//  ⚠️ از یک یافته‌ی واقعیِ ممیزیِ نهایی زاده شد (۲۰۲۶-۰۸-۲۵):
//  `RULES.reservation` از روزِ اول تعریف شده بود و **صفر مصرف‌کننده** داشت.
//  یعنی گران‌ترین عملیاتِ سیستم — ثبتِ رزرو، با تراکنشِ Serializable و قفلِ
//  Redis و قیدِ EXCLUDE — هیچ سقفِ اختصاصی نداشت، در حالی که قانونش نوشته
//  شده بود و هرکس فهرست را می‌خواند فرض می‌کرد اعمال می‌شود.
//
//  همین الگو در `RULES.otpPerIp` هم رخ داده بود (قبلاً رفع شد). قانونی که
//  تعریف شود ولی مصرف نشود، بدتر از نبودنش است: ظاهرِ حفاظت را می‌دهد.
//
//  ⚠️ محدودیتِ صادقانه‌ی این تست: «مصرف‌کننده دارد» را می‌سنجد، نه «سقفش
//  درست است». عددِ درست را فقط ترافیکِ واقعی معلوم می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const SRC = new URL('../src/', import.meta.url).pathname;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (e.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** متنِ فایل بدونِ کامنت — کامنت‌ها اسمِ قانون را دارند و نتیجه را جعل می‌کنند. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const ALL_TS = walk(SRC);
const CODE = new Map(ALL_TS.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]));

describe('هر قانونِ ریت‌لیمیت واقعاً مصرف می‌شود', () => {

  test('🔴 هیچ قانونی در RULES بدونِ مصرف‌کننده نمانده', async () => {
    const ratelimitFile = join(SRC, 'lib/ratelimit.ts');
    const body = CODE.get(ratelimitFile)!;
    const block = body.slice(body.indexOf('export const RULES'));
    const ruleNames = [...block.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s*\{/gm)].map((m) => m[1]);
    assert.ok(ruleNames.length >= 7, `کنترلِ مثبتِ خودِ اسکنر: باید قوانین را پیدا کند، شد ${ruleNames.length}`);

    const unused: string[] = [];
    for (const name of ruleNames) {
      const used = [...CODE.entries()].some(([f, src]) =>
        f !== ratelimitFile && src.includes(`RULES.${name}`));
      if (!used) unused.push(name);
    }
    assert.deepEqual(unused, [],
      `این قوانین تعریف شده‌اند ولی هیچ‌جا اعمال نمی‌شوند — یا مصرفشان کن یا حذفشان: ${unused.join(', ')}`);
  });

  test('🔴 ثبتِ رزرو سقفِ اختصاصیِ خودش را دارد', async () => {
    // مستقیم و نقطه‌ای: این همان مسیری است که باگ رویش بود.
    const f = join(SRC, 'app/api/v1/reservations/route.ts');
    const src = CODE.get(f)!;
    assert.match(src, /enforceRateLimit\(\s*clientIp\(req\)\s*,\s*RULES\.reservation\s*\)/,
      'POST /v1/reservations باید RULES.reservation را اعمال کند');
  });

  test('🔴 دعوت دوست دو سقف دارد: per-IP و per-user', async () => {
    // ⚠️ چرا دو تا: این مسیر پیامکِ **پولیِ پلتفرم** به شماره‌ی شخصِ ثالث
    // می‌فرستد و از موجودیِ هیچ رستورانی کم نمی‌کند. per-IP جلوی انفجار را
    // می‌گیرد؛ per-user جلوی همان حمله از چند IP را.
    const f = join(SRC, 'app/api/v1/me/referral/route.ts');
    const src = CODE.get(f)!;
    assert.match(src, /enforceRateLimit\(\s*clientIp\(req\)/, 'سقفِ per-IP لازم است');
    assert.match(src, /enforceRateLimit\(\s*auth\.sub/, 'سقفِ per-user لازم است');
  });

  test('⚠️ کنترلِ مثبتِ روش: کامنت‌ها شمرده نمی‌شوند', async () => {
    // ⚠️ این تست از یک اشتباهِ واقعیِ همین ممیزی زاده شد: اسکنِ اولِ یک
    // ایجنت `RULES.reservation` را «مصرف‌شده» دید چون نامش داخلِ یک
    // **کامنت** بود. هر گاردِ ساختاری که کامنت را strip نکند، دقیقاً همان
    // چیزی را که باید بگیرد از دست می‌دهد.
    const withComment = stripComments('// RULES.fake\nconst x = 1;');
    assert.equal(withComment.includes('RULES.fake'), false, 'کامنتِ خطی باید حذف شود');
    assert.equal(stripComments('/* RULES.fake */ const y = 2;').includes('RULES.fake'), false,
      'کامنتِ بلوکی باید حذف شود');
    assert.equal(stripComments('const z = RULES.real;').includes('RULES.real'), true,
      'کدِ واقعی باید بماند');
  });
});
