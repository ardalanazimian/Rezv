import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════════
//  ماندگاریِ ردِ حسابرسی — «کنش انجام شد» ≠ «ردش ثبت شد»
//
//  ⚠️ سوراخی که این فایل می‌بندد (۲۰۲۶-۰۹-۰۶): `lib/audit.ts` طبقِ طراحی
//  هرگز throw نمی‌کند؛ شکستِ نوشتن در `audit_logs` داخلِ خودش گرفته و به یک
//  `log.warn` تنزل داده می‌شد. هیچ شمارنده‌ای، هیچ آلارمی، و هیچ راهی برایِ
//  صداکننده که بفهمد رد گم شده.
//
//  ⚠️ و نکته‌ی مکانیزمی که باید در تست پین شود، چون خلافِ شهود است:
//  صداکننده‌هایی مثلِ `lib/fraud.ts` دور همین فراخوان `.catch(() => {})`
//  گذاشته بودند. آن catch **هرگز چیزی نمی‌گرفت** — چیزی پرتاب نمی‌شد. پس
//  برداشتنِ آن catchها به‌تنهایی هیچ چیزی را رفع نمی‌کرد. تستِ «هرگز throw
//  نمی‌کند» پایین دقیقاً همین را ثابت می‌کند تا کسی دوباره لایه‌ی اشتباه را
//  «رفع» نکند.
//
//  چرا این فقط «انطباق» نیست: `fraud.listFlaggedAbuseUsers` نسب‌نامه‌ی
//  فلگ‌ها (چه کسی، چرا، کدام رستوران) را از همین `audit_logs` می‌خواند و به
//  پنلِ شرکت می‌دهد. یعنی این جدول یک **مسیرِ خواندنِ محصولی** است، نه فقط
//  بایگانی — و ردیفِ غایب به «نسب‌نامه‌ی نادرست» ترجمه می‌شود، نه «کمی
//  لاگِ کمتر».
//
//  تزریقِ خطا: فقط `db.auditLog.create` استاب می‌شود — یعنی **سینکِ**
//  حسابرسی، نه موضوعِ تست. هیچ شبکه‌ی بیرونی درگیر نیست.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { audit } = await import('../src/lib/audit.ts');
const { clearAbuseFlag } = await import('../src/lib/fraud.ts');
const { renderMetrics } = await import('../src/lib/metrics.ts');

const METRIC = 'rezervno_audit_write_failed_total';
const TAG = `aud-${randomUUID().slice(0, 8)}`;

/** جمعِ نمونه‌هایِ یک متریک (کپیِ الگویِ observability-coverage.test.mts). */
function sampleValue(dump: string, metric: string, labelFilter?: (labels: string) => boolean): number {
  let total = 0;
  for (const line of dump.split('\n')) {
    if (!line.startsWith(metric)) continue;
    if (line.startsWith('#')) continue;
    const m = line.match(/^([a-z_]+)(?:\{([^}]*)\})?\s+(-?[\d.eE+]+)$/);
    if (!m || m[1] !== metric) continue;
    if (labelFilter && !labelFilter(m[2] ?? '')) continue;
    total += Number(m[3]);
  }
  return total;
}

const realCreate = db.auditLog.create.bind(db.auditLog);

/** سینکِ حسابرسی را برایِ مدتِ اجرای `fn` می‌شکند و حتماً برمی‌گرداند. */
async function withBrokenAuditSink<T>(fn: () => Promise<T>): Promise<T> {
  (db.auditLog as unknown as { create: unknown }).create = async () => {
    throw new Error(`[DEMO] سینکِ audit عمداً شکسته شد (${TAG})`);
  };
  try {
    return await fn();
  } finally {
    (db.auditLog as unknown as { create: unknown }).create = realCreate;
  }
}

let userId: string;
let staffActorId: string;

before(async () => {
  const u = await db.user.create({
    data: { phone: `+98903${String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0')}`.slice(0, 13), firstName: `[DEMO] ${TAG}` },
    select: { id: true },
  });
  userId = u.id;
  staffActorId = randomUUID();
  await db.customerEconomyProfile.create({ data: { userId, hasActiveAbuseFlag: true } });
});

after(async () => {
  (db.auditLog as unknown as { create: unknown }).create = realCreate;
  await db.auditLog.deleteMany({ where: { targetId: userId } });
  await db.customerEconomyProfile.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: userId } });
});

describe('ماندگاریِ audit — مسیرِ سالم (کنترلِ مثبت)', () => {
  test('audit() مقدارِ true می‌دهد و ردیف واقعاً در audit_logs می‌نشیند', async () => {
    const target = randomUUID();
    const ok = await audit({
      action: 'security.abuse_flag', actorType: 'staff', actorId: staffActorId,
      targetId: target, restaurantId: null, detail: { probe: TAG }, success: true,
    });
    assert.equal(ok, true, 'audit() روی DBِ سالم باید ماندگاری را true گزارش کند');

    const rows = await db.auditLog.findMany({ where: { targetId: target }, select: { action: true } });
    // نبودِ موضوع = خطا، نه عبور.
    assert.equal(rows.length, 1, `ردیفِ audit ننشست — ادعایِ ماندگاری بی‌موضوع می‌شود (دیده شد ${rows.length})`);
    assert.equal(rows[0].action, 'security.abuse_flag');
    await db.auditLog.deleteMany({ where: { targetId: target } });
  });
});

describe('ماندگاریِ audit — سینکِ شکسته', () => {
  test('audit() با DBِ خراب throw نمی‌کند (چرا `.catch(() => {})`ِ قدیمی بی‌اثر بود)', async () => {
    // ⚠️ این ادعا مکانیزم را پین می‌کند: اگر روزی audit() شروع به throw کند،
    // این تست قرمز می‌شود و یادآوری می‌کند صداکننده‌ها روی «throw نمی‌کند»
    // حساب باز کرده‌اند. و اگر کسی فکر کند برداشتنِ آن catchها سوراخ را
    // می‌بندد، همین خط نشان می‌دهد چیزی برایِ گرفتن وجود نداشت.
    const returned = await withBrokenAuditSink(async () => audit({
      action: 'security.abuse_flag', actorType: 'staff', actorId: staffActorId,
      targetId: randomUUID(), restaurantId: null, detail: { probe: TAG }, success: true,
    }));
    assert.equal(returned, false, 'audit() باید شکستِ ماندگاری را false گزارش کند، نه throw و نه true');
  });

  test('شکستِ نوشتنِ audit دقیقاً یک‌بار در rezervno_audit_write_failed_total شمرده می‌شود', async () => {
    const before = sampleValue(renderMetrics(), METRIC, (l) => l.includes('action="security.abuse_flag"'));

    await withBrokenAuditSink(async () => audit({
      action: 'security.abuse_flag', actorType: 'staff', actorId: staffActorId,
      targetId: randomUUID(), restaurantId: null, detail: { probe: TAG }, success: true,
    }));

    const after = sampleValue(renderMetrics(), METRIC, (l) => l.includes('action="security.abuse_flag"'));
    assert.equal(after, before + 1,
      `شمارنده بالا نرفت (${before} → ${after}) — شکستِ ثبتِ حسابرسی نامرئی می‌ماند`);
  });

  test('کنترلِ منفی: مسیرِ سالم شمارنده را بالا نمی‌برد', async () => {
    // بدونِ این، ادعایِ بالا با یک شمارنده‌ی «هر بار +۱» هم سبز می‌ماند.
    const target = randomUUID();
    const before = sampleValue(renderMetrics(), METRIC, (l) => l.includes('action="security.abuse_flag"'));
    await audit({
      action: 'security.abuse_flag', actorType: 'staff', actorId: staffActorId,
      targetId: target, restaurantId: null, detail: { probe: TAG }, success: true,
    });
    const after = sampleValue(renderMetrics(), METRIC, (l) => l.includes('action="security.abuse_flag"'));
    assert.equal(after, before, `نوشتنِ موفق نباید شمارنده‌ی شکست را تکان دهد (${before} → ${after})`);
    await db.auditLog.deleteMany({ where: { targetId: target } });
  });
});

describe('clearAbuseFlag — نوشتنِ برگشت‌ناپذیر نباید موفقیتِ حسابرسی را جعل کند', () => {
  test('با سینکِ شکسته: فلگ پاک می‌شود ولی audited=false گزارش می‌شود', async () => {
    await db.customerEconomyProfile.update({ where: { userId }, data: { hasActiveAbuseFlag: true } });
    const before = sampleValue(renderMetrics(), METRIC, (l) => l.includes('action="security.abuse_flag"'));

    const res = await withBrokenAuditSink(async () =>
      clearAbuseFlag(userId, staffActorId, null, 'staff'));

    assert.equal(res.cleared, 1, 'کنشِ اصلی باید انجام شده باشد — شکستِ حسابرسی آن را وارونه نمی‌کند');
    assert.equal(res.audited, false, 'ماندگاریِ حسابرسی نباید true گزارش شود وقتی ردیف ننشسته');

    const profile = await db.customerEconomyProfile.findUnique({ where: { userId }, select: { hasActiveAbuseFlag: true } });
    assert.equal(profile?.hasActiveAbuseFlag, false, 'کنترلِ مثبت: فلگ واقعاً پاک شد');

    const after = sampleValue(renderMetrics(), METRIC, (l) => l.includes('action="security.abuse_flag"'));
    assert.equal(after, before + 1, `شمارنده بالا نرفت (${before} → ${after})`);
  });

  test('کنترلِ مثبت: با سینکِ سالم، audited=true و ردیفِ واقعی وجود دارد', async () => {
    await db.customerEconomyProfile.update({ where: { userId }, data: { hasActiveAbuseFlag: true } });
    await db.auditLog.deleteMany({ where: { targetId: userId } });

    const res = await clearAbuseFlag(userId, staffActorId, null, 'staff');
    assert.equal(res.cleared, 1);
    assert.equal(res.audited, true, 'روی DBِ سالم باید ماندگاری true باشد');

    const rows = await db.auditLog.findMany({ where: { targetId: userId }, select: { detail: true } });
    assert.equal(rows.length, 1, `نبودِ موضوع = خطا: انتظار یک ردیفِ audit، دیده شد ${rows.length}`);
    const detail = rows[0].detail as Record<string, unknown>;
    assert.equal(detail.cleared, true);
    // دامنه‌ی واقعیِ نوشتن صریح در ردِ حسابرسی می‌آید — تحقیقِ بعدی نباید
    // مجبور باشد از کد حدس بزند که این پاک‌کردن سراسری بوده.
    assert.equal(detail.scope, 'platform_wide',
      'دامنه‌ی سراسریِ این نوشتن باید در خودِ ردِ حسابرسی ثبت شود');
  });
});
