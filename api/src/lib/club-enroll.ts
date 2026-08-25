import { db } from './db';
import { normalizePhone } from './otp';

// ═══════════════════════════════════════════════════════════════════════
//  enrollMemberByPhone — ثبتِ مستقیمِ عضوِ باشگاه با شماره‌ی موبایل، بدونِ رزرو.
//
//  چرا: تا امروز تنها راهِ عضویتِ باشگاه «auto-enroll هنگامِ رزرو/walk-in»
//  (createWalkin) بود و «ثبتِ دستیِ عضو» در پنل فقط در حافظه‌ی مرورگر می‌ماند
//  (route فقط GET داشت). این تابع همان منطقِ کاملاً یکسانِ createWalkin برای
//  user-upsert و عضویتِ اتمیک را دارد — فقط بدونِ ساختِ reservation — تا کدِ
//  عضویت واقعاً روی سرور بماند.
//
//  عمداً از createWalkin جدا نگه داشته شده تا مسیرِ حساسِ رزرو دست‌نخورده بماند
//  (تکرارِ ~۲۰ خط، در برابرِ ریسکِ رگرسیون روی موتورِ رزرو). قواعدِ یکسان:
//   • user با phone پیدا/ساخته می‌شود؛ نام/تولدِ ناقص بدونِ overwrite کامل می‌شود.
//   • birthDay/birthMonth *میلادی* هستند (پنل قبل از فراخوانی از شمسی تبدیل می‌کند)،
//     دقیقاً همان قراردادِ ورودیِ walkin route پس از رفعِ تقویمِ ۲۰۲۶-۰۸-۲۵.
//   • کدِ عضویت با clubCodeCounterِ اتمیک ساخته می‌شود (بدونِ تکرار، race-safe).
// ═══════════════════════════════════════════════════════════════════════

export interface EnrollMemberInput {
  restaurantId: string;
  clubPrefix: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  birthDay?: number | null;   // میلادی
  birthMonth?: number | null; // میلادی
}

export interface EnrollMemberResult {
  code: string;
  enrolledNow: boolean;
  userId: string;
}

function birthDateOf(day: number | null | undefined, month: number | null | undefined): Date | null {
  return (day && month) ? new Date(Date.UTC(1990, month - 1, day)) : null;
}

export async function enrollMemberByPhone(input: EnrollMemberInput): Promise<EnrollMemberResult> {
  const phone = normalizePhone(input.phone);

  return db.$transaction(async (tx) => {
    // کاربر را پیدا یا بساز (همان الگوی createWalkin/ورودِ OTP)
    const user = await tx.user.upsert({
      where: { phone },
      create: {
        phone,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        birthDate: birthDateOf(input.birthDay, input.birthMonth),
      },
      update: {},
    });

    // تکمیلِ اطلاعاتِ ناقص، بدونِ overwrite کردنِ مقدارِ موجود
    const patch: Record<string, unknown> = {};
    if ((input.firstName || input.lastName) && (!user.firstName || !user.lastName)) {
      patch.firstName = user.firstName || input.firstName || null;
      patch.lastName = user.lastName || input.lastName || null;
    }
    if (input.birthDay && input.birthMonth && !user.birthDate) {
      patch.birthDate = birthDateOf(input.birthDay, input.birthMonth);
    }
    if (Object.keys(patch).length) {
      await tx.user.update({ where: { id: user.id }, data: patch });
    }

    // عضویتِ اتمیک — اگر از قبل عضو است همان کد برمی‌گردد (idempotent روی phone)
    const existing = await tx.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId: input.restaurantId, userId: user.id } },
    });
    if (existing) {
      return { code: existing.code, enrolledNow: false, userId: user.id };
    }

    const counter = await tx.clubCodeCounter.upsert({
      where: { restaurantId: input.restaurantId },
      create: { restaurantId: input.restaurantId, nextValue: 1002 },
      update: { nextValue: { increment: 1 } },
    });
    const code = `${input.clubPrefix}-${counter.nextValue - 1}`;
    await tx.clubMember.create({ data: { restaurantId: input.restaurantId, userId: user.id, code } });
    return { code, enrolledNow: true, userId: user.id };
  });
}
