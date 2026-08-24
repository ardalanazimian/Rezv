import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ ساختاری — «transitionReservation تنها نویسنده‌ی وضعیتِ رزرو است»
//  (فازِ ۲ · ADR-P2-001، پروتکل §۴)
//
//  چرا این تست وجود دارد:
//  پروتکل §۴ می‌خواهد «هیچ route/worker/cron/helper چرخه‌ی حیات را دور نزند».
//  بررسیِ دستیِ این نشست تأیید کرد که همین حالا درست است — پس طبقِ §۳۲
//  هیچ بازنویسی‌ای انجام نشد. ولی «الان درست است» با «فردا هم درست می‌ماند»
//  فرق دارد: این ثابت با هیچ چیزی در کامپایلر محافظت نمی‌شود. یک نفر می‌تواند
//  فردا یک `tx.reservation.update({ data: { status } })` اضافه کند و همه‌ی
//  تست‌ها سبز بمانند، در حالی که audit/اعلان/اقتصادِ رزرو بی‌صدا دور زده شده.
//
//  این تست منبعِ کد را اسکن می‌کند (نه رفتار را) و دقیقاً همان چیزی را پین
//  می‌کند که بررسیِ دستی اثبات کرد. تحلیلِ ایستا اینجا ابزارِ درست است، چون
//  ادعا خودش درباره‌ی *شکلِ کد* است، نه درباره‌ی یک اجرا.
//
//  اگر این تست شکست، دو حالت دارد و هر دو نیاز به تصمیمِ انسانی دارند:
//   • واقعاً یک دور زدنِ جدید اضافه شده  → باید از transitionReservation رد شود
//   • یک استثنایِ آگاهانه و مستند لازم است → به ALLOWLIST زیر با دلیل اضافه شود
// ═══════════════════════════════════════════════════════════════════════

const SRC = join(import.meta.dirname, '..', 'src');

/** تنها فایل‌هایی که مجازند وضعیتِ رزرو را بنویسند. */
const STATUS_WRITE_ALLOWLIST = new Set([
  // خودِ state machine — تنها نویسنده‌ی مجاز.
  join('lib', 'lifecycle.ts'),
]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const FILES = walk(SRC).map((f) => ({ path: f, rel: relative(SRC, f), text: readFileSync(f, 'utf8') }));

/** حذفِ کامنت‌ها تا کامنتِ توضیحی (که عمداً همین الگو را نقل می‌کند) false-positive نسازد. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('گاردِ چرخه‌ی حیاتِ رزرو (ADR-P2-001)', () => {
  test('هیچ فایلی به‌جز lifecycle.ts وضعیتِ رزرو را مستقیم نمی‌نویسد', () => {
    // الگو: یک update/updateMany روی reservation که در آبجکتِ data یک کلیدِ status دارد.
    // عمداً محافظه‌کارانه است: به‌جایِ پارسِ کاملِ AST، متنِ فراخوانی را می‌گیرد و
    // بررسی می‌کند آیا `status:` داخلِ همان بلاک هست.
    const offenders: string[] = [];

    for (const f of FILES) {
      if (STATUS_WRITE_ALLOWLIST.has(f.rel)) continue;
      const code = stripComments(f.text);
      // هر فراخوانیِ reservation.update / reservation.updateMany را پیدا کن
      const re = /\breservation\.update(Many)?\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        // بدنه‌ی فراخوانی را با شمارشِ پرانتز بردار (تا انتهایِ همان call).
        let depth = 0, i = m.index + m[0].length - 1, end = -1;
        for (; i < code.length; i++) {
          if (code[i] === '(') depth++;
          else if (code[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end === -1) continue;
        const call = code.slice(m.index, end + 1);
        // فقط اگر واقعاً status را ست می‌کند (نه depositStatus / cancelReason / …)
        if (/(^|[{,\s])status\s*:/.test(call)) {
          const line = code.slice(0, m.index).split('\n').length;
          offenders.push(`${f.rel}:${line}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      'این فایل‌ها وضعیتِ رزرو را مستقیم می‌نویسند و state machine را دور می‌زنند.\n' +
      'باید از transitionReservation (lib/lifecycle.ts) رد شوند — وگرنه نه رویدادِ\n' +
      'audit ثبت می‌شود، نه اعلان/اقتصاد اجرا می‌شود، نه انتقالِ نامعتبر رد می‌شود.\n' +
      'موارد: ' + offenders.join(', ')
    );
  });

  test('هیچ SQLِ خامی وضعیتِ رزرو را به‌روزرسانی نمی‌کند', () => {
    // مسیرِ دومِ دور زدن: $executeRaw/$queryRaw با UPDATE reservations SET status.
    const offenders: string[] = [];
    for (const f of FILES) {
      if (STATUS_WRITE_ALLOWLIST.has(f.rel)) continue;
      const code = stripComments(f.text);
      if (/UPDATE\s+reservations[\s\S]{0,200}?\bSET\b[\s\S]{0,200}?\bstatus\s*=/i.test(code)) {
        offenders.push(f.rel);
      }
    }
    assert.deepEqual(offenders, [], 'SQLِ خامِ نویسنده‌ی وضعیتِ رزرو: ' + offenders.join(', '));
  });

  test('مجموعه‌ی وضعیت‌هایِ «اشغال‌کننده» فقط در reservation-status.ts تعریف شده', () => {
    // ADR-P2-002: این لیست قبلاً در ۶ جا کپی شده بود (باگِ C1) و هر جا که جا
    // می‌افتاد یک راهِ double-booking باز می‌کرد. حالا منبعِ واحد دارد؛ این تست
    // جلویِ برگشتنِ کپی‌ها را می‌گیرد.
    // دو استثنایِ **آگاهانه** (نه سهل‌انگاری):
    //  • lib/lifecycle.ts — جدولِ TRANSITIONS خودِ state machine است؛ ذاتاً باید
    //    همه‌ی وضعیت‌ها را نام ببرد. این تعریفِ مرجع است، نه کپیِ آن.
    //  • .../reservations/[code]/status/route.ts — RSTATUS آن‌جا «کلِ enum برایِ
    //    اعتبارسنجیِ ورودی» است (کدام مقادیر اصلاً معتبرند)، نه «مجموعه‌ی
    //    اشغال‌کننده‌ی میز». دو مفهومِ متفاوت با دو دامنه‌ی متفاوت.
    const STATUS_LIST_ALLOWLIST = new Set([
      join('lib', 'reservation-status.ts'),
      join('lib', 'lifecycle.ts'),
      join('app', 'api', 'v1', 'restaurant', 'reservations', '[code]', 'status', 'route.ts'),
    ]);
    const offenders: string[] = [];
    for (const f of FILES) {
      if (STATUS_LIST_ALLOWLIST.has(f.rel)) continue;
      const code = stripComments(f.text);
      // یک آرایه/لیستِ literal که هم 'confirmed' هم 'seated' دارد و کنارِ هم
      // با 'pending' آمده — امضایِ همان لیستِ کپی‌شده.
      if (/'pending'[\s\S]{0,160}'confirmed'[\s\S]{0,160}'seated'/.test(code)
        || /"pending"[\s\S]{0,160}"confirmed"[\s\S]{0,160}"seated"/.test(code)) {
        offenders.push(f.rel);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      'لیستِ وضعیت‌هایِ فعال دوباره کپی شده. از ACTIVE_RESERVATION_STATUSES در\n' +
      'lib/reservation-status.ts استفاده کن (رجوع به باگِ C1 و ADR-P2-002). موارد: ' + offenders.join(', ')
    );
  });

  test('گاردها واقعاً کار می‌کنند (تستِ خودِ تست)', () => {
    // یک تستِ منفی برایِ خودِ رجکس‌ها: اگر روزی الگو را خراب کنیم و همیشه
    // خالی برگردد، تست‌هایِ بالا بی‌صدا بی‌فایده می‌شوند — دقیقاً همان کلاسِ
    // «تستِ سبزِ بی‌معنی» که این پروژه قبلاً تجربه‌اش کرده.
    const bad = `await tx.reservation.update({ where: { id }, data: { status: 'seated' } });`;
    const re = /\breservation\.update(Many)?\s*\(/g;
    const m = re.exec(bad);
    assert.ok(m, 'رجکسِ تشخیصِ update باید این نمونه را بگیرد');
    assert.ok(/(^|[{,\s])status\s*:/.test(bad), 'رجکسِ تشخیصِ status باید این نمونه را بگیرد');

    // و نباید depositStatus را با status اشتباه بگیرد:
    const ok = `await db.reservation.update({ where: { id }, data: { depositStatus: 'paid' } });`;
    assert.ok(!/(^|[{,\s])status\s*:/.test(ok), 'depositStatus نباید به‌عنوانِ status شمرده شود');
  });
});
