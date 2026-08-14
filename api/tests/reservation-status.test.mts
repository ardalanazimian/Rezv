import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { ACTIVE_RESERVATION_STATUSES, activeStatusList } = await import('../src/lib/reservation-status.ts');

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════
//  Part B (حسابرسیِ Time-Range/EXCLUDE/Redis-evidence، ۲۰۲۶-۰۸-۱۴):
//
//  ACTIVE_RESERVATION_STATUSES (منبعِ حقیقتِ TS) باید همیشه دقیقاً همان
//  مجموعه‌ای باشد که WHERE کانسترینتِ EXCLUDE (`no_table_overlap`) در
//  prisma/sql/026-consolidate-exclusion-constraint.sql پوشش می‌دهد — درصورتِ
//  انحراف، یک میز می‌تواند در وضعیت‌هایِ جدید (که TS فعال می‌داند ولی SQL
//  نمی‌شناسد) دوباره رزرو شود، بدونِ اینکه EXCLUDE جلویش را بگیرد
//  (همان باگِ تاریخیِ C1 که ۰۱۶ رفعش کرد).
//
//  این تست به‌جایِ کپیِ دستیِ یک آرایه‌ی «منتظره» (که خودش می‌تواند از SQL
//  واقعی جدا بیفتد)، مستقیماً متنِ ۰۲۶ را می‌خواند و آرایه‌ی active_statuses
//  را از داخلِ آن پارس می‌کند — یعنی اگر کسی فردا وضعیتی به یکی اضافه/حذف
//  کند بدونِ به‌روزکردنِ دیگری، این تست با خواندنِ خودِ فایلِ SQL (نه یک
//  کپیِ ایستا) شکست می‌خورد.
// ═══════════════════════════════════════════════════════════════════════

function extractSqlActiveStatuses(): string[] {
  const sqlPath = join(__dirname, '..', 'prisma', 'sql', '026-consolidate-exclusion-constraint.sql');
  const sql = readFileSync(sqlPath, 'utf8');
  const match = sql.match(/active_statuses\s+CONSTANT\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/);
  assert.ok(match, 'الگویِ active_statuses در ۰۲۶ پیدا نشد — اسکریپت را چک کن');
  return match![1]
    .split(',')
    .map((s) => s.trim().replace(/^'/, '').replace(/'$/, ''))
    .filter(Boolean);
}

describe('پاریتیِ ACTIVE_RESERVATION_STATUSES با WHERE کانسترینتِ EXCLUDE (026)', () => {
  test('فهرستِ TS دقیقاً همان فهرستِ داخلِ ۰۲۶ است (بدونِ کم/زیاد، بدونِ توجه به ترتیب)', () => {
    const sqlStatuses = extractSqlActiveStatuses();
    const tsStatuses = activeStatusList();
    assert.deepEqual(
      [...tsStatuses].sort(),
      [...sqlStatuses].sort(),
      `انحراف: TS=${JSON.stringify([...tsStatuses].sort())} در برابرِ SQL(026)=${JSON.stringify([...sqlStatuses].sort())}`,
    );
  });

  test('همان فهرست در متنِ SELECT برایِ ساختنِ constraint هم به‌صورتِ رشته‌ای تکرار شده (position-check خودِ ۰۲۶)', () => {
    // ۰۲۶ خودش هم یک self-check دارد (position('''status'''...)) — این تست فقط
    // تأیید می‌کند که آن رشته‌های تک‌کوتیشن‌شده در فایل واقعاً برایِ همه‌ی
    // وضعیت‌هایِ TS وجود دارند، مستقل از self-checkِ داخلیِ خودِ SQL.
    const sqlPath = join(__dirname, '..', 'prisma', 'sql', '026-consolidate-exclusion-constraint.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    for (const st of activeStatusList()) {
      assert.ok(sql.includes(`'${st}'`), `وضعیتِ '${st}' در متنِ ۰۲۶ پیدا نشد`);
    }
  });

  test('فهرست منجمد است (frozen array مستندشده) — تغییرش باید عمدی و همراه با آپدیتِ ۰۲۶ باشد', () => {
    // این آرایه عمداً اینجا هم تکرار شده: اگر یک تغییرِ عمدی در reservation-status.ts
    // این فهرست را جابه‌جا کند، این تست هم باید دستی آپدیت شود — یادآوریِ
    // صریح برایِ آپدیتِ هم‌زمانِ SQL.
    assert.deepEqual(ACTIVE_RESERVATION_STATUSES, [
      'pending', 'confirmed', 'auto_confirmed', 'preparing', 'checked_in',
      'running_late', 'arrived', 'seated', 'dining',
    ]);
  });
});
