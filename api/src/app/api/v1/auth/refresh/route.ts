import { NextResponse } from 'next/server';
import { verifyRefresh, signAccess, signRefresh, accessFromRefresh } from '@/lib/jwt';
import { isRefreshRevoked, revokeRefreshToken } from '@/lib/security';
import { db } from '@/lib/db';
import { isCurrentlyBanned } from '@/lib/ban';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

const schema = z.object({ refresh: z.string().min(1).max(2000) });

/**
 * POST /api/v1/auth/refresh
 * تمدید توکن با rotation: refresh قدیمی باطل و جدید صادر می‌شود.
 * اگر توکن باطل‌شده باشد (logout/سرقت)، رد می‌شود.
 *
 * C3: نوع اصلی توکن (customer/staff + tenant/role) از خود refresh خوانده و
 * access هم‌نوع صادر می‌شود.
 *
 * امنیت (CWE-613 — Insufficient Session Expiration): هنگام refresh، بررسی می‌شود
 * که principal هنوز وجود دارد و فعال است. بدون این، یک کارمند اخراج‌شده یا کاربر
 * حذف‌شده می‌توانست تا ۳۰ روز با refresh token همچنان توکن معتبر بگیرد. اگر نقش
 * staff در دیتابیس تغییر کرده باشد (مثلاً manager→staff)، توکن جدید نقش به‌روز را
 * می‌گیرد، نه نقش کهنه‌ی داخل refresh.
 */
export async function POST(req: Request) {
  try {
    const { refresh } = await parseBody(req, schema);
    const payload = verifyRefresh(refresh);
    // چک لیست سیاه — توکن باطل‌شده دیگر کار نمی‌کند
    if (await isRefreshRevoked(payload.jti)) {
      return NextResponse.json({ ok: false, error: { code: 'TOKEN_REVOKED', message: 'نشست منقضی شده؛ دوباره وارد شوید' } }, { status: 401 });
    }

    // بازتأیید وجود/فعال‌بودن principal + گرفتن نقش به‌روز
    let access = accessFromRefresh(payload);
    if (payload.kind === 'staff') {
      const staff = await db.staff.findUnique({
        where: { id: payload.sub },
        select: { id: true, tenantId: true, role: true, isActive: true },
      });
      if (!staff || !staff.isActive) {
        await revokeRefreshToken(payload.jti);
        return NextResponse.json({ ok: false, error: { code: 'ACCOUNT_DISABLED', message: 'حساب غیرفعال شده' } }, { status: 401 });
      }
      // نقش/tenant به‌روز از دیتابیس (نه از توکن کهنه)
      const role = (staff.role === 'owner' || staff.role === 'manager' || staff.role === 'staff') ? staff.role : 'staff';
      access = { sub: staff.id, kind: 'staff', tenantId: staff.tenantId, role };
    } else {
      const user = await db.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, bannedAt: true, unbannedAt: true, bannedReason: true },
      });
      if (!user) {
        await revokeRefreshToken(payload.jti);
        return NextResponse.json({ ok: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'حساب یافت نشد' } }, { status: 401 });
      }
      // بن سختِ پلتفرم: حسابِ بن‌شده نباید با refresh token همچنان access تازه بگیرد.
      if (isCurrentlyBanned(user)) {
        await revokeRefreshToken(payload.jti);
        return NextResponse.json({ ok: false, error: { code: 'USER_BANNED', message: 'دسترسیِ این حساب توسطِ رزرونو مسدود شده است', details: user.bannedReason ? { reason: user.bannedReason } : {} } }, { status: 403 });
      }
    }

    // rotation: توکن قدیمی را باطل کن، جدید بده (در صورت سرقت، پنجره کوتاه می‌شود)
    await revokeRefreshToken(payload.jti);
    return NextResponse.json({
      access: signAccess(access),
      refresh: signRefresh(access),
    });
  } catch (e) { return errorResponse(e); }
}
