// ═══════════════════════════════════════════════════════════════════════
//  گاردِ ایستا: هیچ مسیری به no_show نمی‌رسد مگر از دو درِ گیت‌دار (F001 · STATE M-13/M-17 · D-20)
//
//  چرا: کلاسِ این نقص «جریمه بدونِ سیگنال» بود و **دو** مسیر داشت، نه یکی — cron (فروپاشیِ
//  یک‌تیکی) و routeِ وضعیتِ پرسنل (no_show حتی پیش از ساعتِ رزرو). هر دو حالا گیت دارند. خطرِ بعدی
//  مسیرِ سوم است: کسی `transitionReservation({ to: 'no_show' })` را در یک lib یا route تازه صدا بزند،
//  یا وضعیت را مستقیم در DB بنویسد، و گیت‌ها بی‌صدا دور زده شوند.
//
//  قاعده، روی سورسِ واقعیِ api/src:
//   ۱) `to: 'no_show'` به‌صورتِ لیترال فقط در `autoMarkNoShow` (lib/lifecycle.ts) — گیتِ cron.
//   ۲) `to:`ِ **پویا** (هر چیزی جز لیترال) فقط در routeِ وضعیتِ پرسنل، و آن فایل باید خودِ گیت را داشته
//      باشد (`guestDeadline(` + `Err.noShowBeforeDeadline(`).
//   ۳) هیچ `data: { … status: 'no_show' … }` ِ مستقیم در api/src.
//  هر کدام کنترلِ مثبت دارد: اسکنری که چیزی پیدا نکند سبزِ دروغ است.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const API = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(API, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

type Call = { file: string; line: number; to: string; fnContext: string };

/** هر `transitionReservation(` → عبارتِ `to:` داخلِ همان پرانتز (با شمارشِ پرانتز/آکولاد). */
function transitionCalls(): Call[] {
  const calls: Call[] = [];
  for (const abs of walk(SRC)) {
    const src = readFileSync(abs, 'utf8');
    const file = relative(API, abs).split(sep).join('/');
    const re = /transitionReservation\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const before = src.slice(Math.max(0, m.index - 30), m.index);
      if (/function\s+$/.test(before)) continue; // خودِ تعریف
      let depth = 0; let i = m.index + 'transitionReservation'.length; let end = i;
      for (; i < src.length; i++) {
        const c = src[i];
        if (c === '(' || c === '{') depth++;
        else if (c === ')' || c === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      const args = src.slice(m.index, end + 1);
      const to = /\bto:\s*([^,}\n]+)/.exec(args)?.[1]?.trim() ?? '<none>';
      const line = src.slice(0, m.index).split('\n').length;
      const fns = [...src.slice(0, m.index).matchAll(/export\s+async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*withRestaurantAuth/g)];
      const last = fns[fns.length - 1];
      calls.push({ file, line, to, fnContext: last ? (last[1] ?? last[2]) : '' });
    }
  }
  return calls;
}

const isLiteral = (to: string) => /^'[a-z_]+'$/.test(to);

describe('گاردِ ایستا — درهای رسیدن به no_show', () => {
  const calls = transitionCalls();

  test('کنترلِ مثبت: اسکنر واقعاً فراخوانی‌ها را می‌یابد', () => {
    assert.ok(calls.length >= 8, `فقط ${calls.length} فراخوانی پیدا شد — اسکنر خراب است یا کد جابه‌جا شده`);
    assert.ok(calls.some((c) => c.to === "'cancelled'"), 'لیترالِ شناخته‌شده‌ی routeِ لغو باید پیدا شود');
    assert.ok(calls.some((c) => !isLiteral(c.to)), 'دستِ‌کم یک to پویا (routeِ وضعیت) باید پیدا شود');
  });

  test("۱) to: 'no_show' فقط داخلِ autoMarkNoShow", () => {
    const literal = calls.filter((c) => c.to === "'no_show'");
    assert.equal(literal.length, 1, `لیترالِ no_show باید دقیقاً یک جا باشد: ${JSON.stringify(literal)}`);
    assert.equal(literal[0].file, 'src/lib/lifecycle.ts');
    assert.equal(literal[0].fnContext, 'autoMarkNoShow');
  });

  test('۲) to پویا فقط در routeِ وضعیتِ پرسنل، و آن route خودِ گیت را دارد', () => {
    const dynamic = calls.filter((c) => !isLiteral(c.to));
    assert.deepEqual([...new Set(dynamic.map((c) => c.file))], ['src/app/api/v1/restaurant/reservations/[code]/status/route.ts'],
      'مسیرِ تازه‌ای با to پویا می‌تواند no_show بنویسد و از گیتِ مهلت رد شود — اول گیت، بعد این فهرست');
    const route = readFileSync(join(API, dynamic[0].file), 'utf8');
    assert.match(route, /guestDeadline\(/, 'routeِ وضعیت باید مهلت را از guestDeadline بخواند');
    assert.match(route, /Err\.noShowBeforeDeadline\(/, 'routeِ وضعیت باید پیش از مهلت ۴۰۹ بدهد');
  });

  test('۳) هیچ نوشتنِ مستقیمِ status: no_show در api/src', () => {
    const direct = /data:\s*\{[^}]*\bstatus:\s*['"]no_show['"]/;
    assert.ok(direct.test("db.reservation.update({ where: { id }, data: { status: 'no_show' } })"), 'کنترلِ مثبتِ الگو');
    const hits = walk(SRC).filter((f) => direct.test(readFileSync(f, 'utf8')));
    assert.deepEqual(hits.map((f) => relative(API, f)), []);
  });
});
