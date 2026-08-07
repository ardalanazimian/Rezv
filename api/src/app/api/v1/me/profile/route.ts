import { getGuestProfile, getVisitPercentile } from '@/lib/guest-profile';
import { authFromRequest } from '@/lib/jwt';
import { Err, errorResponse } from '@/lib/errors';
import { NextResponse } from 'next/server';

/**
 * GET /api/v1/me/profile — پروفایل سراسری مهمان (نمای ۳۶۰ درجه).
 * مشتری پروفایل خودش را می‌بیند: CLV کل، رستوران‌های بازدیدشده، VIP، سگمنت‌ها.
 * visit_percentile: درصدِ واقعیِ کاربرانِ دیگری که بازدیدِ کمتری دارند —
 * null یعنی جامعه‌ی مقایسه هنوز کوچک است (نه صفر٪، فقط «هنوز قابلِ‌سنجش نیست»).
 */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const profile = await getGuestProfile(auth.sub);
    if (!profile) {
      // هنوز پروفایلی محاسبه نشده (مشتری جدید بدون بازدید تکمیل‌شده)
      return NextResponse.json({ profile: null, message: 'هنوز سابقه‌ی کافی برای پروفایل وجود ندارد' });
    }
    const visitPercentile = await getVisitPercentile(auth.sub);
    return NextResponse.json({ profile, visit_percentile: visitPercentile });
  } catch (e) { return errorResponse(e); }
}
