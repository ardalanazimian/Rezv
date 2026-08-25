import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  اعمالِ واقعیِ رضایتِ اعلان در نقاطِ صدور (پروتکل §۱۳ و §۱۷)
//
//  ⚠️ تفاوتش با `notification-consent.test.mts`: آن فایل *قاعده* را تست
//  می‌کند (`allowsCategory` درست تصمیم می‌گیرد). این فایل تست می‌کند که
//  قاعده اصلاً **صدا زده می‌شود**.
//
//  باگی که این فایل از آن زاده شد (اندازه‌گیری‌شده با grep روی api/src،
//  ۲۰۲۶-۰۸-۲۵): `allowsCategory` فقط **دو** فراخوان داشت، هر دو در
//  `restaurant/sms/route.ts` و هر دو فقط برای دسته‌ی `offers`. یعنی از پنج
//  کلیدی که اپِ مشتری نشان می‌دهد و سرور صادقانه ذخیره و بازگردانی‌شان
//  می‌کند (`/me/notification-prefs` واقعاً کار می‌کند)، بقیه هیچ اثری
//  نداشتند: کاربر «امتیاز و پاداش» را خاموش می‌کرد و همچنان پیامکِ امتیازِ
//  تولد می‌گرفت، «میز خالی شد» را خاموش می‌کرد و همچنان آفرِ صف می‌گرفت.
//
//  و باگِ وارونه‌ی همان (خطرناک‌تر): پیامکِ **خوش‌آمدِ چک‌ین** — که تراکنشی
//  است — از پنل با `kind:'campaign'` می‌رفت و پشتِ رضایتِ *تبلیغاتیِ*
//  `offers` گیت می‌شد. یعنی مهمانی که فقط از تبلیغات انصراف داده بود، رسیدِ
//  ورودش (شاملِ موجودیِ امتیازش) را هم از دست می‌داد.
//
//  ⚠️ مهم‌ترین تستِ این فایل «کنترلِ منفی»هاست، نه ادعاهای مثبت: پیامک‌های
//  تراکنشی باید با **همه‌ی پنج کلیدِ false** هنوز بروند. اگر روزی کسی گارد
//  را «برای یکدستی» به آن‌ها هم اضافه کند، این‌جا قرمز می‌شود.
//
//  دو مشاهده‌گرِ واقعی (نه mock):
//   • جدولِ `jobs` — هر `enqueueSms` یک ردیفِ واقعی می‌سازد (lib/queue.ts).
//   • متریکِ `rezervno_sms_suppressed_total` — تنها جایی که «نفرستادنِ
//     عمدی» شمرده می‌شود. صفر ماندنش یعنی هیچ گاردی شلیک نکرده.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { redis } = await import('../src/lib/redis.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const { renderMetrics } = await import('../src/lib/metrics.ts');
const {
  NOTIFICATION_CATEGORIES, UNGATED_SMS_TEMPLATES,
  smsAllowedForCategory, phoneLookupVariants, findUsersByPhonesForConsent,
} = await import('../src/lib/notification-prefs.ts');
const { transitionReservation } = await import('../src/lib/lifecycle.ts');
const { runAutomation } = await import('../src/lib/automation.ts');
const { createReferral, grantBirthdayRewards } = await import('../src/lib/loyalty.ts');
const { promoteNext } = await import('../src/lib/waitlist.ts');
const smsRoute = await import('../src/app/api/v1/restaurant/sms/route.ts');

const SRC = new URL('../src/lib/', import.meta.url).pathname;
const TAG = `nce-${Math.random().toString(36).slice(2, 8)}`;
// پیش‌شماره‌ی ۰۹۰۰ در ایران تخصیص داده نشده — هیچ شماره‌ی واقعی‌ای این‌جا نیست.
const PHONE_BASE = 900_000 + Math.floor(Math.random() * 90_000);
let phoneSeq = 0;
const newPhone = () => `+9890${String(PHONE_BASE + (++phoneSeq)).slice(-8)}`;

const ALL_OFF = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, false]));

let tenantId: string;
let restaurantId: string;
let ownerToken: string;
const madeUserIds: string[] = [];

async function makeUser(prefs: Record<string, boolean> = {}, phone = newPhone()) {
  const u = await db.user.create({
    data: { phone, firstName: '[DEMO] مهمان', notificationPrefs: prefs },
    select: { id: true, phone: true },
  });
  madeUserIds.push(u.id);
  return u;
}

/** همه‌ی قالب‌های پیامکِ صف‌شده برای یک شماره — از جدولِ واقعیِ `jobs`. */
async function smsTemplatesFor(phone: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ template: string }[]>`
    SELECT payload->>'template' AS template FROM jobs
    WHERE kind = 'sms' AND payload->>'to' = ${phone}
    ORDER BY created_at ASC
  `;
  return rows.map((r) => r.template);
}

/**
 * مقدارِ فعلیِ شمارنده‌ی سرکوب. برچسبِ خالی = مجموعِ همه‌ی سری‌ها.
 * (رجیستری in-memory است و بینِ تست‌ها ریست نمی‌شود، پس همیشه **دلتا**
 * اندازه گرفته می‌شود نه مقدارِ مطلق.)
 */
function suppressed(filter?: { category?: string; site?: string }): number {
  let total = 0;
  for (const line of renderMetrics().split('\n')) {
    if (!line.startsWith('rezervno_sms_suppressed_total')) continue;
    const m = line.match(/^rezervno_sms_suppressed_total(?:\{([^}]*)\})?\s+(-?[\d.]+)$/);
    if (!m) continue;
    const labels = m[1] ?? '';
    if (filter?.category && !labels.includes(`category="${filter.category}"`)) continue;
    if (filter?.site && !labels.includes(`site="${filter.site}"`)) continue;
    total += Number(m[2]);
  }
  return total;
}

const jsonReq = (token: string, body: unknown) =>
  new Request('http://x/api/v1/restaurant/sms', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

before(async () => {
  const stale = await redis.keys('*auth*');
  if (stale.length) await redis.del(...stale);
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-${TAG}`, name: `[DEMO] رستورانِ تستِ رضایت`,
      clubPrefix: 'NCE', timezone: 'Asia/Tehran', isOpen: true,
    },
    select: { id: true },
  });
  restaurantId = r.id;
  const owner = await db.staff.create({
    data: { tenantId, phone: newPhone().slice(0, 13), role: 'owner', isActive: true },
    select: { id: true },
  });
  ownerToken = signAccess({ sub: owner.id, kind: 'staff', tenantId, role: 'owner' });
});

after(async () => {
  await db.job.deleteMany({ where: { kind: 'sms' } }).catch(() => {});
  await db.waitlistEntry.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.outreachLog.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.campaignLog.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.marketingAutomation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  if (madeUserIds.length) {
    await db.pointsLedger.deleteMany({ where: { userId: { in: madeUserIds } } }).catch(() => {});
    await db.referral.deleteMany({ where: { referrerId: { in: madeUserIds } } }).catch(() => {});
    await db.user.deleteMany({ where: { id: { in: madeUserIds } } }).catch(() => {});
  }
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

// ═══════════════════════════════════════════════════════════════════════
//  ۱) مکانیزم — هر پنج دسته، با کنترلِ مثبت روی خودِ متریک
// ═══════════════════════════════════════════════════════════════════════
describe('رضایت · مکانیزمِ گیت برای هر پنج دسته', () => {
  for (const cat of NOTIFICATION_CATEGORIES) {
    test(`دسته‌ی «${cat}»: false ⇒ مسدود · true ⇒ باز · کلیدِ غایب ⇒ باز`, () => {
      const ctx = { site: `unit.${cat}` };
      const before = suppressed({ category: cat, site: `unit.${cat}` });

      assert.equal(smsAllowedForCategory({ [cat]: false }, cat, ctx), false,
        'انصرافِ صریح باید مانع شود');
      assert.equal(suppressed({ category: cat, site: `unit.${cat}` }), before + 1,
        'سرکوب باید شمرده شود، نه سکوت (بخشِ ۹ CLAUDE.md)');

      assert.equal(smsAllowedForCategory({ [cat]: true }, cat, ctx), true);
      assert.equal(smsAllowedForCategory({}, cat, ctx), true,
        'کلیدِ غایب یعنی «نظری نداده»، نه «انصراف»');
      assert.equal(smsAllowedForCategory(null, cat, ctx), true);

      assert.equal(suppressed({ category: cat, site: `unit.${cat}` }), before + 1,
        'مسیرِ مجاز نباید شمارنده را تکان بدهد (کنترلِ منفیِ خودِ متریک)');
    });
  }

  test('انصراف از یک دسته بقیه را نمی‌بندد', () => {
    for (const cat of NOTIFICATION_CATEGORIES) {
      for (const other of NOTIFICATION_CATEGORIES) {
        if (other === cat) continue;
        assert.equal(smsAllowedForCategory({ [cat]: false }, other, { site: 'unit.cross' }), true,
          `انصراف از ${cat} نباید ${other} را ببندد`);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  ۲) 🔴 کنترلِ منفی — تراکنشی‌ها با **همه‌ی کلیدها false** هنوز می‌روند
//     (مهم‌ترین بخشِ فایل: هزینه‌ی اشتباه این‌جا از دست‌رفتنِ رزرو است)
// ═══════════════════════════════════════════════════════════════════════
describe('🔴 کنترلِ منفی — پیامکِ تراکنشی هرگز پشتِ رضایت نمی‌رود', () => {
  test('چرخه‌ی حیاتِ رزرو (confirmed) با همه‌ی پنج کلیدِ false هنوز پیامک می‌دهد', async () => {
    const u = await makeUser({ ...ALL_OFF });
    const now = new Date();
    const resv = await db.reservation.create({
      data: {
        restaurantId, userId: u.id, code: `NCE${TAG.slice(-4).toUpperCase()}1`,
        guestName: '[DEMO] مهمان', guestPhone: u.phone, partySize: 2,
        slotStart: new Date(+now + 3 * 3600_000), slotEnd: new Date(+now + 5 * 3600_000),
        status: 'pending',
      },
      select: { id: true },
    });
    const before = suppressed();
    await transitionReservation({ reservationId: resv.id, to: 'confirmed', actor: 'staff:test' });

    assert.deepEqual(await smsTemplatesFor(u.phone), ['booking_confirm'],
      'تأییدِ رزرو باید ارسال شود حتی وقتی کاربر از همه‌چیز انصراف داده');
    assert.equal(suppressed(), before, 'هیچ گاردی نباید در مسیرِ چرخه‌ی حیات شلیک کند');
  });

  test('لغوِ رزرو با همه‌ی کلیدها false هنوز پیامک می‌دهد', async () => {
    const u = await makeUser({ ...ALL_OFF });
    const now = new Date();
    const resv = await db.reservation.create({
      data: {
        restaurantId, userId: u.id, code: `NCE${TAG.slice(-4).toUpperCase()}2`,
        guestName: '[DEMO] مهمان', guestPhone: u.phone, partySize: 2,
        slotStart: new Date(+now + 3 * 3600_000), slotEnd: new Date(+now + 5 * 3600_000),
        status: 'confirmed',
      },
      select: { id: true },
    });
    const before = suppressed();
    await transitionReservation({ reservationId: resv.id, to: 'cancelled', actor: 'staff:test' });
    assert.deepEqual(await smsTemplatesFor(u.phone), ['booking_cancelled']);
    assert.equal(suppressed(), before);
  });

  test('پیامکِ خوش‌آمدِ چک‌ین با `offers:false` هنوز می‌رود (باگی که رفع شد)', async () => {
    const u = await makeUser({ ...ALL_OFF });
    const before = suppressed();
    const res = await smsRoute.POST(jsonReq(ownerToken, { kind: 'welcome', phones: [u.phone] }));
    const body = await res.json();

    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.queued, 1, 'رسیدِ ورود نباید پشتِ رضایتِ تبلیغاتی گیت شود');
    assert.equal(body.opted_out, 0);
    assert.deepEqual(await smsTemplatesFor(u.phone), ['welcome_visit'],
      'و باید با قالبِ welcome_visit برود، نه campaign');
    assert.equal(suppressed(), before);
  });

  test('نامِ مستعارِ کهنه‌ی پنل (kind=campaign + message=welcome) هم تراکنشی حساب می‌شود', async () => {
    // apps/business/js/reservations.js:190 هنوز همین را می‌فرستد.
    const u = await makeUser({ ...ALL_OFF });
    const res = await smsRoute.POST(jsonReq(ownerToken, {
      kind: 'campaign', phones: [u.phone], message: 'welcome',
    }));
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.kind, 'welcome', 'باید به welcome ترجمه شود');
    assert.deepEqual(await smsTemplatesFor(u.phone), ['welcome_visit']);
  });

  test('خوش‌آمد دفترِ بازاریابی و تاریخچه‌ی کمپین را آلوده نمی‌کند', async () => {
    const u = await makeUser();
    const outreachBefore = await db.outreachLog.count({ where: { restaurantId } });
    const campaignBefore = await db.campaignLog.count({ where: { restaurantId } });

    await smsRoute.POST(jsonReq(ownerToken, { kind: 'welcome', phones: [u.phone] }));
    assert.equal(await db.outreachLog.count({ where: { restaurantId } }), outreachBefore,
      'رسیدِ تراکنشی «ارتباط‌گیریِ بازاریابی» نیست');
    assert.equal(await db.campaignLog.count({ where: { restaurantId } }), campaignBefore);

    // کنترلِ مثبت: همان مسیر با kind=campaign **باید** ثبت کند — وگرنه این تست
    // فقط ثابت می‌کرد که ledger اصلاً کار نمی‌کند.
    const u2 = await makeUser();
    await smsRoute.POST(jsonReq(ownerToken, { kind: 'campaign', phones: [u2.phone] }));
    assert.equal(await db.outreachLog.count({ where: { restaurantId } }), outreachBefore + 1);
    assert.equal(await db.campaignLog.count({ where: { restaurantId } }), campaignBefore + 1);
  });

  test('گاردِ ساختاری — نقاطِ تراکنشی اصلاً ماژولِ رضایت را import نمی‌کنند', () => {
    for (const f of ['otp.ts', 'lifecycle.ts', 'reservations.ts']) {
      const src = readFileSync(SRC + f, 'utf8');
      assert.ok(src.includes('enqueueSms'), `کنترلِ مثبت: ${f} باید واقعاً پیامک بفرستد`);
      assert.ok(!src.includes("from './notification-prefs'"),
        `${f} نباید گاردِ رضایت داشته باشد — پیامکش تراکنشی/امنیتی است`);
    }
  });

  test('فهرستِ قالب‌های بدونِ گارد با قالب‌های واقعیِ sms.ts می‌خواند', () => {
    const smsSrc = readFileSync(SRC + 'sms.ts', 'utf8');
    for (const tpl of UNGATED_SMS_TEMPLATES) {
      assert.ok(smsSrc.includes(`'${tpl}'`), `قالبِ ${tpl} دیگر در sms.ts نیست — فهرست کهنه شده`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  ۳) دسته‌ی offers — کمپین/automation/دعوت
// ═══════════════════════════════════════════════════════════════════════
describe('رضایت · دسته‌ی offers در مسیرهای واقعی', () => {
  test('automation: `offers:false` هدف را حذف می‌کند، کلیدِ غایب نه', async () => {
    const optOut = await makeUser({ offers: false });
    const neutral = await makeUser();
    for (const u of [optOut, neutral]) {
      await db.customerInsight.create({
        data: { restaurantId, userId: u.id, segment: 'at_risk' },
      });
    }
    const automation = {
      id: '00000000-0000-0000-0000-000000000000', restaurantId, trigger: 'winback',
      triggerConfig: {}, messageTemplate: '', couponId: null, lastRunAt: null,
    };
    const before = suppressed({ category: 'offers', site: 'automation.winback' });
    const r = await runAutomation(automation as never);

    assert.equal(r.sent, 1, 'فقط کاربرِ بدونِ انصراف پیامک می‌گیرد');
    assert.equal(r.opted_out, 1, 'و تعدادِ منصرف صریحاً گزارش می‌شود');
    assert.deepEqual(await smsTemplatesFor(optOut.phone), [], 'منصرف نباید پیامک بگیرد');
    assert.deepEqual(await smsTemplatesFor(neutral.phone), ['winback_offer']);
    assert.equal(suppressed({ category: 'offers', site: 'automation.winback' }), before + 1);
    await db.customerInsight.deleteMany({ where: { restaurantId } });
  });

  test('automation: منصرف در دفترِ ارتباط‌گیری هم ثبت نمی‌شود', async () => {
    const optOut = await makeUser({ offers: false });
    await db.customerInsight.create({ data: { restaurantId, userId: optOut.id, segment: 'at_risk' } });
    const before = await db.outreachLog.count({ where: { restaurantId } });
    const r = await runAutomation({
      id: '00000000-0000-0000-0000-000000000000', restaurantId, trigger: 'winback',
      triggerConfig: {}, messageTemplate: '', couponId: null, lastRunAt: null,
    } as never);
    assert.equal(r.sent, 0);
    assert.equal(await db.outreachLog.count({ where: { restaurantId } }), before,
      'کسی که پیام نگرفته نباید در نرخِ تبدیل شمرده شود');
    await db.customerInsight.deleteMany({ where: { restaurantId } });
  });

  test('کمپینِ دستی: منصرف حذف و صریحاً گزارش می‌شود', async () => {
    const optOut = await makeUser({ offers: false });
    const neutral = await makeUser();
    const res = await smsRoute.POST(jsonReq(ownerToken, {
      kind: 'campaign', phones: [optOut.phone, neutral.phone],
    }));
    const body = await res.json();
    assert.equal(body.queued, 1);
    assert.equal(body.opted_out, 1);
    assert.deepEqual(await smsTemplatesFor(optOut.phone), []);
    assert.deepEqual(await smsTemplatesFor(neutral.phone), ['campaign']);
  });

  test('🔴 انصراف با شماره‌ی خامِ `09…` هم رعایت می‌شود (شکافِ نرمال‌سازی)', async () => {
    // پنل شماره را همان‌طور که در رزرو ذخیره شده پس می‌دهد؛ `users.phone`
    // همیشه نرمال (`+98…`) است. تطبیقِ دقیقِ قبلی این کاربر را پیدا نمی‌کرد
    // و انصرافش بی‌صدا نادیده گرفته می‌شد.
    const local = `09${String(PHONE_BASE + (++phoneSeq)).slice(-9)}`.slice(0, 11);
    const normalized = '+98' + local.slice(1);
    const u = await makeUser({ offers: false }, normalized);

    assert.ok(phoneLookupVariants(local).includes(normalized), 'پیش‌شرطِ نرمال‌سازی');
    const found = await findUsersByPhonesForConsent([local]);
    assert.equal(found.get(local)?.id, u.id, 'کاربر باید با شکلِ خام هم پیدا شود');

    const res = await smsRoute.POST(jsonReq(ownerToken, { kind: 'campaign', phones: [local] }));
    const body = await res.json();
    assert.equal(res.status, 400, 'همه منصرف بودند ⇒ خطای صریح، نه ارسالِ خاموش');
    assert.match(String(body.error?.message ?? ''), /انصراف/);
    assert.deepEqual(await smsTemplatesFor(local), []);
    assert.deepEqual(await smsTemplatesFor(normalized), []);
  });

  test('دعوتِ دوست: گیرنده‌ی منصرف پیامک نمی‌گیرد، گیرنده‌ی بی‌نظر می‌گیرد', async () => {
    const referrer = await makeUser();
    const invitedOut = await makeUser({ offers: false });
    const invitedOk = await makeUser();
    const before = suppressed({ site: 'loyalty.referral_invite' });

    await createReferral(referrer.id, invitedOut.phone);
    assert.deepEqual(await smsTemplatesFor(invitedOut.phone), []);
    assert.equal(suppressed({ site: 'loyalty.referral_invite' }), before + 1);

    await createReferral(referrer.id, invitedOk.phone);
    assert.deepEqual(await smsTemplatesFor(invitedOk.phone), ['campaign']);

    // شماره‌ی بدونِ حساب: هیچ ترجیحی وجود ندارد ⇒ دعوت می‌رود (کنترلِ منفی
    // برای «غیبت = انصراف» که یک رگرسیونِ بدتر می‌بود).
    const stranger = newPhone();
    await createReferral(referrer.id, stranger);
    assert.deepEqual(await smsTemplatesFor(stranger), ['campaign']);
    await db.referral.deleteMany({ where: { referrerId: referrer.id } });
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  ۴) دسته‌ی availability — فقط «میز آماده شد»، نه رسید و نه تأییدِ رزرو
// ═══════════════════════════════════════════════════════════════════════
describe('رضایت · دسته‌ی availability (لیستِ انتظار)', () => {
  async function seedWaiting(prefs: Record<string, boolean>) {
    const u = await makeUser(prefs);
    const table = await db.table.create({
      data: { restaurantId, number: 900 + (++phoneSeq), capacity: 4, state: 'free', isActive: true },
      select: { id: true },
    });
    const e = await db.waitlistEntry.create({
      data: {
        restaurantId, userId: u.id, guestName: '[DEMO] مهمان', guestPhone: u.phone,
        partySize: 2, status: 'waiting', notifySms: true, notifyPush: false, notifyEmail: false,
      },
      select: { id: true },
    });
    return { u, table, entryId: e.id };
  }

  test('`availability:false` ⇒ پیامکِ آفرِ میز نمی‌رود (ولی ورودی واقعاً آفر می‌شود)', async () => {
    const { u, entryId } = await seedWaiting({ availability: false });
    const before = suppressed({ category: 'availability', site: 'waitlist.offered' });
    const r = await promoteNext(restaurantId);

    assert.equal(r.promoted, true, 'ترفیع باید واقعاً انجام شود — رضایت فقط کانالِ اعلان است');
    assert.equal(r.entryId, entryId);
    assert.deepEqual(await smsTemplatesFor(u.phone), []);
    assert.equal(suppressed({ category: 'availability', site: 'waitlist.offered' }), before + 1);
    await db.waitlistEntry.deleteMany({ where: { restaurantId } });
    await db.table.deleteMany({ where: { restaurantId } });
  });

  test('کلیدِ غایب ⇒ پیامکِ آفر می‌رود (کنترلِ مثبت)', async () => {
    const { u } = await seedWaiting({});
    const r = await promoteNext(restaurantId);
    assert.equal(r.promoted, true);
    assert.deepEqual(await smsTemplatesFor(u.phone), ['waitlist_offer']);
    await db.waitlistEntry.deleteMany({ where: { restaurantId } });
    await db.table.deleteMany({ where: { restaurantId } });
  });

  test('🔴 `availability:false` رسیدِ پیوستن به صف را خاموش نمی‌کند', async () => {
    // `waitlist_joined` رسیدِ کنشِ خودِ مهمان است، نه اطلاع از آزادشدنِ میز.
    const src = readFileSync(SRC + 'waitlist.ts', 'utf8');
    const gate = src.match(/const gated = kind === '(\w+)'/);
    assert.ok(gate, 'گاردِ رضایتِ waitlist پیدا نشد');
    assert.equal(gate![1], 'offered',
      'فقط آفرِ میز گیت می‌شود؛ joined (رسید) و accepted (تأییدِ رزرو) هرگز');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  ۵) دسته‌ی loyalty — امتیازِ تولد
// ═══════════════════════════════════════════════════════════════════════
describe('رضایت · دسته‌ی loyalty (امتیازِ تولد)', () => {
  /** تاریخِ تولدی که `grantBirthdayRewards` امروز می‌بیند (ظرفِ ماه/روزِ شمسی). */
  async function birthdayUser(prefs: Record<string, boolean>) {
    const { jalaliMonthDayToday } = await import('../src/lib/loyalty.ts');
    const { mm, dd } = jalaliMonthDayToday(new Date());
    const u = await makeUser(prefs);
    await db.user.update({
      where: { id: u.id },
      data: { birthDate: new Date(Date.UTC(1990, mm - 1, dd)) },
    });
    return u;
  }

  test('`loyalty:false` ⇒ پیامک نمی‌رود، ولی امتیاز همچنان ثبت می‌شود', async () => {
    const u = await birthdayUser({ loyalty: false });
    const before = suppressed({ category: 'loyalty', site: 'loyalty.birthday_points' });
    await grantBirthdayRewards();

    assert.deepEqual(await smsTemplatesFor(u.phone), []);
    assert.equal(suppressed({ category: 'loyalty', site: 'loyalty.birthday_points' }), before + 1);
    const pts = await db.pointsLedger.count({ where: { userId: u.id, reason: 'birthday' } });
    assert.equal(pts, 1, '🔴 انصراف از اعلان نباید خودِ پاداش را حذف کند');
  });

  test('کلیدِ غایب ⇒ پیامکِ امتیازِ تولد می‌رود (کنترلِ مثبت)', async () => {
    const u = await birthdayUser({});
    await grantBirthdayRewards();
    assert.deepEqual(await smsTemplatesFor(u.phone), ['campaign']);
    assert.equal(await db.pointsLedger.count({ where: { userId: u.id, reason: 'birthday' } }), 1);
  });

  test('`offers:false` جلوی امتیازِ تولد را نمی‌گیرد (نگاشتِ دسته درست است)', async () => {
    const u = await birthdayUser({ offers: false });
    await grantBirthdayRewards();
    assert.deepEqual(await smsTemplatesFor(u.phone), ['campaign'],
      'دسته‌ی این پیام `loyalty` است («امتیاز و پاداش»)، نه `offers` («تخفیف و کش‌بک»)');
  });
});
