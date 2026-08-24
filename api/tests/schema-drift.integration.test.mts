import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ انحرافِ اسکیما (فازِ ۲، پروتکل §۲۴)
//
//  چرا این تست وجود دارد — دو باگِ واقعی که هیچ‌کدام از سورس دیده نمی‌شدند و
//  فقط با نگاه‌کردن به خودِ دیتابیس پیدا شدند:
//
//  ۱) **۴۵ جفت ایندکسِ کاملاً تکراری** رویِ ۲۵ جدول. پروژه دو منبعِ DDL دارد
//     (`@@index` در schema.prisma، و `CREATE INDEX` دستی در prisma/sql/*.sql)
//     که هرکدام همان ایندکس را با نامِ متفاوت می‌سازند — پس `IF NOT EXISTS`
//     هیچ‌وقت جلویش را نمی‌گرفت. هر نوشتن رویِ آن جدول‌ها تقریباً دو برابرِ
//     کارِ لازم را انجام می‌داد. (migration 048 پاکشان کرد.)
//
//  ۲) **پنج ایندکس که در DB بودند ولی در schema.prisma اعلام نشده بودند** —
//     یعنی `prisma db push` رویِ یک DBِ زنده آن‌ها را DROP می‌کرد، از جمله
//     ایندکس‌هایِ مرزِ اعتمادِ تله‌متری (046) و هرسِ نگه‌داری (047).
//
//  این تست هر دو را برایِ همیشه پین می‌کند. اگر کسی ایندکسی را فقط در یکی از
//  دو منبع اضافه کند، این‌جا قرمز می‌شود — نه شش ماه بعد در تولید.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');

// تنها انحرافِ *پذیرفته‌شده*: reservations.block_end یک ستونِ
// `GENERATED ALWAYS AS (...) STORED` است (migration 026) که کانستریتِ
// EXCLUDE ضدِ double-booking به آن وابسته است. Prisma 5 ستونِ generated را
// اصلاً نمی‌تواند بیان کند، پس همیشه قصدِ DROPش را دارد. Postgres آن DROP را
// رد می‌کند («cannot drop column ... constraint no_table_overlap depends on
// it») — تأییدشده با اجرایِ واقعی. یعنی `prisma db push` رویِ یک DBِ
// migrate‌شده شکست می‌خورد؛ این یک ویژگیِ محافظ است، نه یک باگِ قابلِ رفع.
const ACCEPTED_DRIFT = /ALTER TABLE "reservations" DROP COLUMN "block_end"/;

describe('انحرافِ اسکیما بینِ schema.prisma و DBِ اعمال‌شده (§۲۴)', () => {
  test('هیچ دو ایندکسی با تعریفِ یکسان وجود ندارد', async () => {
    const dupes = await db.$queryRaw<Array<{ tablename: string; names: string; def: string }>>`
      SELECT t.tablename,
             string_agg(t.indexname, ', ' ORDER BY t.indexname) AS names,
             t.def
      FROM (
        SELECT tablename, indexname,
               regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX [^ ]+ ON ', '') AS def
        FROM pg_indexes WHERE schemaname = 'public'
      ) t
      GROUP BY t.tablename, t.def
      HAVING count(*) > 1
      ORDER BY t.tablename
    `;
    assert.equal(
      dupes.length, 0,
      `ایندکسِ تکراری پیدا شد (هر جفت یعنی نوشتنِ دوبرابر):\n` +
        dupes.map(d => `  ${d.tablename}: ${d.names}\n      → ${d.def}`).join('\n'),
    );
  });

  test('ایندکس‌هایِ حیاتیِ SQL در schema.prisma هم اعلام شده‌اند', async () => {
    // اگر این‌ها در schema نباشند، `prisma db push` بی‌صدا DROPشان می‌کند.
    const required = [
      'platform_events_trust_level_idx',      // 046 — واجدِ شرایطِ آموزش (§۱۵)
      'platform_events_trust_ingested_idx',   // 047 — هرسِ نگه‌داری (§۱۴)
      'idx_jobs_status_created',
      'staff_restaurant_id_idx',
      'model_training_runs_restaurant_kind_idx',
      // migration 049 — دو ایندکسِ مسیرِ داغ که با EXPLAINِ ساختاری اثبات شدند:
      // بدونشان getGuestProfile و فهرستِ رزروِ پنل به scanِ ترتیبی می‌افتادند.
      'customer_insights_user_id_idx',
      'reservations_restaurant_slot_idx',
    ];
    const rows = await db.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;
    const have = new Set(rows.map(r => r.indexname));
    const missing = required.filter(n => !have.has(n));
    assert.deepEqual(missing, [], `ایندکسِ لازم در DB نیست: ${missing.join(', ')}`);
  });

  test('`prisma db push` هیچ چیزی جز انحرافِ پذیرفته‌شده را تغییر نمی‌دهد', () => {
    const cli = 'node_modules/prisma/build/index.js';
    if (!existsSync(cli)) {
      assert.fail('CLIِ prisma پیدا نشد — این تست باید واقعاً اجرا شود، نه skip');
    }
    const out = execFileSync(
      process.execPath,
      [cli, 'migrate', 'diff',
       '--from-schema-datasource', 'prisma/schema.prisma',
       '--to-schema-datamodel', 'prisma/schema.prisma',
       '--script'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );

    const statements = out
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('--'));

    const unexpected = statements.filter(l => !ACCEPTED_DRIFT.test(l));
    assert.deepEqual(
      unexpected, [],
      'انحرافِ تازه بینِ schema.prisma و DB:\n  ' + unexpected.join('\n  ') +
        '\n\nیا `@@index`/فیلد را به schema.prisma اضافه کن، یا migrationِ SQL را.',
    );
  });
});
