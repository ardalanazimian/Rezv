import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { parseQuery, z } from '@/lib/schemas';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/admin/site/orders — صفِ درخواست‌های سایت (پنلِ شرکت)
//
//  همان صفی که «اپِ شرکت» برای فعال‌سازیِ اشتراک می‌بیند: درخواست‌های خرید
//  (pending → activated) و حساب‌های دمویی که ساخته شده‌اند.
//
//  خروجی نمای کاملِ مدیریتی است (شاملِ تماس و انتساب) چون دقیقاً برای همین
//  کار لازم است — و پشتِ احرازِ هویتِ مدیرِ پلتفرم قفل است.
// ═══════════════════════════════════════════════════════════════════════

const querySchema = z.object({
  status: z.enum(['pending', 'contacted', 'activated', 'rejected', 'cancelled'] as const).optional(),
  kind: z.enum(['trial', 'purchase'] as const).optional(),
  q: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).max(100_000).optional(),
});

export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const { status, kind, q, limit, offset } = parseQuery(req, querySchema);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (kind) where.kind = kind;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { businessName: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    }

    const [rows, total, pendingCount] = await Promise.all([
      db.siteOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit ?? 50,
        skip: offset ?? 0,
      }),
      db.siteOrder.count({ where }),
      db.siteOrder.count({ where: { kind: 'purchase', status: 'pending' } }),
    ]);

    // تنانتِ پیشنهادی برای سفارش‌هایی که هنوز وصل نیستند: از روی شماره‌ی مالک.
    // این همان چیزی است که فعال‌سازی را یک‌کلیکی می‌کند به‌جای جست‌وجوی دستی.
    const unlinked = rows.filter((r) => !r.tenantId).map((r) => r.phone);
    const owners = unlinked.length
      ? await db.staff.findMany({
          where: { phone: { in: unlinked }, role: 'owner', isActive: true },
          select: { phone: true, tenantId: true, tenant: { select: { name: true } } },
        })
      : [];
    const ownerByPhone = new Map(owners.map((o) => [o.phone, { tenantId: o.tenantId, tenantName: o.tenant.name }]));

    return NextResponse.json({
      total,
      count: rows.length,
      pending_purchases: pendingCount,
      items: rows.map((o) => ({
        id: o.id,
        code: o.code,
        kind: o.kind,
        status: o.status,
        plan_key: o.planKey,
        plan_name: o.planName,
        months: o.months,
        amount_toman: o.amountToman,
        business_name: o.businessName,
        contact_name: o.contactName,
        phone: o.phone,
        email: o.email,
        city: o.city,
        branch_count: o.branchCount,
        note: o.note,
        tenant_id: o.tenantId,
        restaurant_id: o.restaurantId,
        suggested_tenant: o.tenantId ? null : (ownerByPhone.get(o.phone) ?? null),
        trial_ends_at: o.trialEndsAt,
        activated_at: o.activatedAt,
        activated_by: o.activatedBy,
        plan_expires_at: o.planExpiresAt,
        admin_note: o.adminNote,
        rejected_reason: o.rejectedReason,
        utm_source: o.utmSource,
        utm_campaign: o.utmCampaign,
        landing_path: o.landingPath,
        created_at: o.createdAt,
      })),
    });
  } catch (e) { return errorResponse(e); }
}
