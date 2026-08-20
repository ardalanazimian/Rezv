import { randomBytes } from 'crypto';
import { db } from './db';
import { Err } from './errors';
import { enqueueSms } from './sms';

// ═══════════════════════════════════════════════════════════
//  سرویس وفاداری رزرونو — امتیاز، دعوت، کارت هدیه، پاداش
// ═══════════════════════════════════════════════════════════

const POINTS = {
  signup: 200,           // امتیاز خوش‌آمد
  perReservation: 100,   // هر رزرو تکمیل‌شده
  referralReward: 500,   // پاداش دعوت موفق
  birthday: 1000,        // هدیه‌ی تولد
  anniversary: 1000,     // هدیه‌ی سالگرد
};

const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(prefix: string, len = 8): string {
  const b = randomBytes(len);
  let s = prefix;
  for (let i = 0; i < len; i++) s += B32[b[i] % 32];
  return s;
}

// ── افزودن/کسر امتیاز (با ثبت در دفتر) ──
export async function addPoints(opts: {
  userId: string; delta: number; reason: string; restaurantId?: string; note?: string;
}): Promise<number> {
  // ledger الگوی append-only است (فقط insert، هیچ‌وقت update روی مجموع) — پس
  // داده‌ی ذخیره‌شده ذاتاً امن در برابر همزمانی است. اما insert و aggregate را
  // در یک تراکنش می‌گذاریم تا «مجموع برگشتی» با همان snapshot سازگار باشد
  // (وگرنه دو addPoints همزمان می‌توانند مجموع‌های میانی ناسازگار برگردانند).
  return db.$transaction(async (tx) => {
    await tx.pointsLedger.create({
      data: {
        userId: opts.userId, delta: opts.delta, reason: opts.reason as any,
        restaurantId: opts.restaurantId ?? null, note: opts.note ?? null,
      },
    });
    const agg = await tx.pointsLedger.aggregate({ where: { userId: opts.userId }, _sum: { delta: true } });
    return agg._sum.delta ?? 0;
  });
}

// ── موجودی امتیاز کاربر ──
export async function getPointsBalance(userId: string): Promise<number> {
  const agg = await db.pointsLedger.aggregate({ where: { userId }, _sum: { delta: true } });
  return agg._sum.delta ?? 0;
}

// ── تاریخچه‌ی امتیاز ──
export async function getPointsHistory(userId: string, limit = 50) {
  return db.pointsLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
}

// ═══════════ دعوت دوستان (Referral) ═══════════

// کد دعوت یکتای کاربر را بساز یا برگردان
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (u?.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = genCode('REF', 6);
    try {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch (e) { if (i === 4) throw e; }
  }
  throw Err.validation('ساخت کد دعوت ناموفق بود');
}

// ثبت دعوت (کاربر دوستش را با شماره دعوت می‌کند)
export async function createReferral(referrerId: string, inviteePhone: string) {
  const existing = await db.referral.findFirst({
    where: { referrerId, inviteePhone, status: { in: ['pending', 'completed'] } },
  });
  if (existing) throw Err.validation('این شماره را قبلاً دعوت کرده‌اید');
  const ref = await db.referral.create({
    data: { referrerId, inviteePhone, rewardPoints: POINTS.referralReward },
  });
  // پیامک دعوت
  const referrer = await db.user.findUnique({ where: { id: referrerId }, select: { firstName: true, referralCode: true } });
  await enqueueSms({
    to: inviteePhone, template: 'campaign',
    tokens: [referrer?.firstName ?? 'دوست شما', referrer?.referralCode ?? ''],
  }).catch(() => {});
  return { id: ref.id, status: ref.status, reward_points: ref.rewardPoints };
}

// تکمیل دعوت (وقتی دعوت‌شده ثبت‌نام و اولین رزرو را کرد → پاداش به دعوت‌کننده)
export async function completeReferral(inviteePhone: string, inviteeId: string) {
  const ref = await db.referral.findFirst({
    where: { inviteePhone, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  if (!ref) return null;
  // NEW-H2: claim اتمیک — فقط اگر هنوز pending است update می‌شود. اگر صفر ردیف
  // (یعنی یک درخواست همزمان زودتر claim کرده)، پاداش داده نمی‌شود (ضد double-reward).
  const claimed = await db.referral.updateMany({
    where: { id: ref.id, status: 'pending' },
    data: { status: 'rewarded', inviteeId, completedAt: new Date() },
  });
  if (claimed.count === 0) return null; // کس دیگری زودتر claim کرد
  // پاداش فقط پس از claim موفق
  await addPoints({
    userId: ref.referrerId, delta: ref.rewardPoints, reason: 'referral',
    note: `دعوت موفق ${inviteePhone}`,
  });
  return { rewarded: true, referrer_id: ref.referrerId, points: ref.rewardPoints };
}

// آمار دعوت‌های کاربر
export async function getReferralStats(userId: string) {
  const all = await db.referral.findMany({ where: { referrerId: userId } });
  const code = await getOrCreateReferralCode(userId);
  return {
    code,
    total_invited: all.length,
    completed: all.filter(r => r.status === 'rewarded').length,
    pending: all.filter(r => r.status === 'pending').length,
    points_earned: all.filter(r => r.status === 'rewarded').reduce((s, r) => s + r.rewardPoints, 0),
  };
}

// ═══════════ کارت هدیه (Gift Card) ═══════════

export async function createGiftCard(opts: {
  buyerId?: string; restaurantId?: string; amountToman: number;
  recipientName?: string; recipientPhone?: string; message?: string;
}) {
  if (!Number.isInteger(opts.amountToman) || opts.amountToman < 50_000) {
    throw Err.validation('مبلغ کارت هدیه باید حداقل ۵۰٬۰۰۰ تومان باشد');
  }
  let code = '';
  for (let i = 0; i < 5; i++) {
    code = genCode('GIFT', 10);
    const dup = await db.giftCard.findUnique({ where: { code } });
    if (!dup) break;
    if (i === 4) throw Err.validation('ساخت کد ناموفق بود');
  }
  const expiresAt = new Date(Date.now() + 365 * 86_400_000); // یک سال اعتبار
  const card = await db.giftCard.create({
    data: {
      code, buyerId: opts.buyerId ?? null, restaurantId: opts.restaurantId ?? null,
      amountToman: opts.amountToman, balanceToman: opts.amountToman,
      recipientName: opts.recipientName ?? null, recipientPhone: opts.recipientPhone ?? null,
      message: opts.message ?? null, expiresAt,
    },
  });
  // پیامک به گیرنده
  if (opts.recipientPhone) {
    await enqueueSms({ to: opts.recipientPhone, template: 'campaign', tokens: [opts.recipientName ?? 'دوست عزیز', code] }).catch(() => {});
  }
  return { code: card.code, amount_toman: card.amountToman, expires_at: card.expiresAt };
}

// M10: نرمال‌سازی یکسان کد کارت هدیه — کدها همیشه Base32 بزرگ ذخیره می‌شوند،
// پس ورودی هم باید uppercase+trim شود تا check و redeem هر دو یکسان رفتار کنند
// (قبلاً redeem uppercase می‌کرد ولی check نه → «کارت پیدا نشد» ناسازگار).
function normalizeGiftCode(code: string): string {
  return String(code || '').trim().toUpperCase();
}

// بررسی موجودی کارت هدیه
export async function checkGiftCard(code: string) {
  const card = await db.giftCard.findUnique({ where: { code: normalizeGiftCode(code) } });
  if (!card) throw Err.notFound('کارت هدیه');
  const valid = card.status === 'active' && (!card.expiresAt || card.expiresAt > new Date());
  return {
    code: card.code, amount_toman: card.amountToman, balance_toman: card.balanceToman,
    status: card.status, valid, expires_at: card.expiresAt,
  };
}

// استفاده از کارت هدیه (کسر مبلغ)
// ⚠️ امنیت همزمانی: این تابع read-modify-write است. بدون قفل، دو استفاده‌ی همزمان
// از یک کارت می‌توانند هر دو موجودی را بخوانند و دوبار خرج کنند (double-spend).
// راه‌حل: SELECT ... FOR UPDATE که ردیف کارت را تا پایان تراکنش قفل می‌کند، پس
// استفاده‌ی همزمان دوم تا commit اولی منتظر می‌ماند و سپس موجودی به‌روز را می‌بیند.
// تأییدشده روی PostgreSQL واقعی.
export async function redeemGiftCard(code: string, amountToman: number) {
  // NEW-C1: مبلغ باید مثبت و صحیح باشد — وگرنه مبلغ منفی موجودی را افزایش می‌داد (ساخت پول)
  if (!Number.isInteger(amountToman) || amountToman <= 0) {
    throw Err.validation('مبلغ استفاده باید عددی مثبت باشد');
  }
  return db.$transaction(async (tx) => {
    return redeemGiftCardTx(tx, code, amountToman);
  });
}

/** نسخه‌ی tx-aware کارت هدیه (برای فراخوانی داخل تراکنش رزرو). با قفل FOR UPDATE. */
export async function redeemGiftCardTx(tx: any, code: string, amountToman: number) {
  if (!Number.isInteger(amountToman) || amountToman <= 0) {
    throw Err.validation('مبلغ استفاده باید عددی مثبت باشد');
  }
  // قفل ردیف کارت (FOR UPDATE) — ضد double-spend همزمان
  const locked = await tx.$queryRaw<{ id: string; balance_toman: number; status: string; expires_at: Date | null }[]>`
    SELECT id, balance_toman, status, expires_at FROM gift_cards WHERE code = ${normalizeGiftCode(code)} FOR UPDATE
  `;
  const card = locked[0];
  if (!card) throw Err.notFound('کارت هدیه');
  if (card.status !== 'active') throw Err.validation('کارت هدیه فعال نیست');
  if (card.expires_at && card.expires_at < new Date()) throw Err.validation('کارت هدیه منقضی شده است');
  if (amountToman > card.balance_toman) throw Err.validation('موجودی کارت کافی نیست');
  const newBalance = card.balance_toman - amountToman;
  await tx.giftCard.update({
    where: { id: card.id },
    data: { balanceToman: newBalance, status: newBalance === 0 ? 'redeemed' : 'active' },
  });
  return { applied: amountToman, remaining: newBalance };
}

// ═══════════ پاداش تولد و سالگرد ═══════════

// بررسی و اعطای پاداش تولد/سالگرد (توسط cron روزانه)
export async function grantBirthdayRewards(): Promise<{ birthday: number; anniversary: number }> {
  const today = new Date();
  const mm = today.getMonth() + 1;
  const dd = today.getDate();

  // کاربرانی که امروز تولدشان است — نام و تلفن را یک‌جا می‌گیریم (بدون N+1)
  const birthdayUsers = await db.$queryRaw<{ id: string; phone: string | null; first_name: string | null }[]>`
    SELECT id, phone, first_name FROM users
    WHERE birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM birth_date) = ${mm}
      AND EXTRACT(DAY FROM birth_date) = ${dd}
  `;
  // PERF: چک dedup با findFirst حذف شد — ایندکس یکتای uniq_annual_reward خودش
  // پاداش دوگانه را قطعی جلوگیری می‌کند و catch روی P2002 مسابقه را مدیریت می‌کند.
  // پس به‌جای ۳ کوئری per user (dedup + addPoints + phone)، فقط addPoints می‌ماند.
  for (const u of birthdayUsers) {
    try {
      await addPoints({ userId: u.id, delta: POINTS.birthday, reason: 'birthday', note: 'هدیه‌ی تولد 🎂' });
      if (u.phone) await enqueueSms({ to: u.phone, template: 'campaign', tokens: [u.first_name ?? 'دوست عزیز', String(POINTS.birthday)] }).catch(() => {});
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // فقط پاداش تکراری (unique violation) را رد کن
    }
  }

  // سالگرد — همان الگو
  const annivUsers = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE anniversary_date IS NOT NULL
      AND EXTRACT(MONTH FROM anniversary_date) = ${mm}
      AND EXTRACT(DAY FROM anniversary_date) = ${dd}
  `;
  for (const u of annivUsers) {
    try {
      await addPoints({ userId: u.id, delta: POINTS.anniversary, reason: 'anniversary', note: 'هدیه‌ی سالگرد 💍' });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // پاداش تکراری از اجرای همزمان را نادیده بگیر
    }
  }

  return { birthday: birthdayUsers.length, anniversary: annivUsers.length };
}

export { POINTS };
