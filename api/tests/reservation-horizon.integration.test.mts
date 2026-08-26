import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  افقِ زمانیِ رزرو — گاردِ TOO_FAR_AHEAD / PAST_TIME
//
//  ⚠️ چرا این فایل ساخته شد، با اینکه باگی رفع نشد:
//  یافته‌ی «رزرو سقفِ تاریخِ آینده ندارد» (یافته‌ی ۱۸ در
//  docs/recovery/OPEN-FINDINGS.md) هنگامِ بازبینی **کهنه** از آب درآمد —
//  `MAX_DAYS_AHEAD = 90` از ۲۰۲۶-۰۸-۱۴ (کامیت 71364bd) در
//  `src/lib/reservations.ts:139` هست و `date: "9999-12-31"` واقعاً رد
//  می‌شود. طبقِ بندِ ۰ پروتکل: «تناقضِ سند با ریپو → ریپو برنده».
//
//  ولی یک شکافِ واقعی ماند: **هیچ تستی این گارد را قفل نمی‌کرد.** جست‌وجوی
//  کلِ `tests/` فقط دو *اشاره* در کامنت پیدا کرد
//  (`table-merge-occupancy.test.mts:28`، `otp-ratelimit-and-deadlock…:146`)
//  که صرفاً می‌گویند «تاریخِ تست را داخلِ سقف نگه دار» — نه یک assertion.
//  یعنی حذفِ خطِ ۱۳۹ هیچ تستی را قرمز نمی‌کرد. این فایل آن را می‌بندد.
//
//  چرا مهم است: `slot_start`ِ سالِ ۹۹۹۹ برایِ طرحِ پارتیشن‌بندیِ ماهانه
//  (prisma/sql/011) هیچ پارتیشنی ندارد. (آن مهاجرت امروز `-- @manual-only`
//  است و `apply-sql.sh` ردش می‌کند، پس ریسک بالفعل نیست — ولی گارد باید
//  قفل بماند.)
//
//  دو نقطه‌ی مرزی عمداً هر دو سنجیده می‌شوند: روزِ ۸۹ باید **رد نشود** و
//  روزِ ۹۱ باید رد شود. بدونِ نقطه‌ی اول، یک گاردِ «همیشه رد کن» هم سبز
//  می‌شد — یعنی تست هیچ‌چیزی را قفل نمی‌کرد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation } = await import('../src/lib/reservations.ts');
const { ApiError } = await import('../src/lib/errors.ts');

let tenantId: string;
let restaurantId: string;

/** 'YYYY-MM-DD' برایِ N روز بعد از الان (UTC — فقط برای ساختنِ رشته). */
function dayOffset(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

/** کدِ خطایِ پرتاب‌شده، یا null اگر چیزی پرتاب نشد. */
async function codeOf(date: string): Promise<string | null> {
  try {
    await createReservation({
      restaurantId, date, time: '19:00', partySize: 2,
      // manual تا گاردِ onlineGating و گاردِ ساعتِ کاری وارد ماجرا نشوند و
      // این تست دقیقاً همان یک گاردِ افق را بسنجد، نه چیزِ دیگری.
      source: 'manual',
      guest: { name: '[DEMO] مهمانِ تستِ افق' },
    });
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.code : `RAW:${(e as Error).name}`;
  }
}

before(async () => {
  const t = await db.tenant.create({ data: { name: '[DEMO] tenant (reservation-horizon)' }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-horizon-${Date.now()}`,
      name: '[DEMO] رستورانِ تستِ افقِ رزرو', clubPrefix: 'HRZ',
      isOpen: true,
      // بدونِ میز: رزروِ داخلِ افق به NO_TABLE… می‌رسد، نه به موفقیت. برایِ
      // این تست کافی است — ادعا «TOO_FAR_AHEAD پرتاب نمی‌شود» است، نه «رزرو
      // ساخته می‌شود» (آن را تست‌های موتورِ رزرو جدا پوشش می‌دهند).
    },
    select: { id: true },
  });
  restaurantId = r.id;
});

after(async () => {
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('افقِ رزرو — TOO_FAR_AHEAD', () => {
  test('تاریخِ «9999-12-31» با TOO_FAR_AHEAD رد می‌شود (سناریوی دقیقِ یافته)', async () => {
    assert.equal(await codeOf('9999-12-31'), 'TOO_FAR_AHEAD');
  });

  test('روزِ ۹۱ (یک روز بعدِ سقف) رد می‌شود', async () => {
    assert.equal(await codeOf(dayOffset(91)), 'TOO_FAR_AHEAD');
  });

  // ═══ کنترلِ مثبت — بدونِ این، گاردِ «همیشه رد کن» هم سبز می‌شد ═══
  test('روزِ ۸۹ (داخلِ سقف) با TOO_FAR_AHEAD رد نمی‌شود', async () => {
    const code = await codeOf(dayOffset(89));
    assert.notEqual(code, 'TOO_FAR_AHEAD', 'گاردِ افق نباید داخلِ سقف شلیک کند');
  });

  test('تاریخِ گذشته با PAST_TIME رد می‌شود (گاردِ همسایه، آن هم بی‌تست بود)', async () => {
    assert.equal(await codeOf(dayOffset(-1)), 'PAST_TIME');
  });
});
