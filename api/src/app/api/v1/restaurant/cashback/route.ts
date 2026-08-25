import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

const pct = () => z.number().min(0).max(50).optional();
const cashbackSchema = z.object({
  base_pct: pct(), preorder_pct: pct(), vip_pct: pct(), winback_pct: pct(),
});

/** GET — درصدهای فعلی کش‌بک (مهاجرت‌شده به wrapper: rate-limit/auth/metric/trace خودکار) */
// ⚠️ رفعِ ممیزیِ RBAC: `PATCH` از قبل `canManageSettings` داشت ولی `GET` نه —
// یعنی درصدهایِ کش‌بک (پیکربندیِ مالی) برایِ هر کارمندی خواندنی بود.
// مصرف‌کننده: `rCashback()` در `apps/business/js/staff-system.js:211`، داخلِ
// تبِ «کش‌بک» که با همین کلید گیت شده — و همان‌جا ۴۰۳ را صادقانه به
// «تنظیمات بارگذاری نشد» تبدیل می‌کند، نه به عددِ پیش‌فرضِ ساختگی.
export const GET = withRestaurantAuth(
  { permission: 'canManageSettings', rateLimit: 'search' },
  async (_req, ctx) => {
    const r = await db.restaurant.findUnique({
      where: { id: ctx.restaurant.id },
      select: { cbBasePct: true, cbPreorderPct: true, cbVipPct: true, cbWinbackPct: true },
    });
    return NextResponse.json({
      base_pct: r!.cbBasePct, preorder_pct: r!.cbPreorderPct,
      vip_pct: r!.cbVipPct, winback_pct: r!.cbWinbackPct,
    });
  },
);

/** PATCH — به‌روزرسانی کش‌بک. نیاز به دسترسی مدیریت تنظیمات. */
export const PATCH = withRestaurantAuth(
  { permission: 'canManageSettings', rateLimit: 'auth' },
  async (req, ctx) => {
    const b = await parseBody(req, cashbackSchema);
    const round = (v?: number) => v === undefined ? undefined : Math.round(v);
    const data: Record<string, number> = {};
    const base = round(b.base_pct); if (base !== undefined) data.cbBasePct = base;
    const pre = round(b.preorder_pct); if (pre !== undefined) data.cbPreorderPct = pre;
    const vip = round(b.vip_pct); if (vip !== undefined) data.cbVipPct = vip;
    const win = round(b.winback_pct); if (win !== undefined) data.cbWinbackPct = win;
    if (Object.keys(data).length === 0) throw Err.validation('حداقل یک مقدار لازم است');

    const updated = await db.restaurant.update({
      where: { id: ctx.restaurant.id }, data,
      select: { cbBasePct: true, cbPreorderPct: true, cbVipPct: true, cbWinbackPct: true },
    });
    return NextResponse.json({
      base_pct: updated.cbBasePct, preorder_pct: updated.cbPreorderPct,
      vip_pct: updated.cbVipPct, winback_pct: updated.cbWinbackPct,
    });
  },
);
