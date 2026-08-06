import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseParams, parseQuery, z } from '@/lib/schemas';
import { COLLECTIONS, REGISTRY, isCollection, invalidateCollection, mapPrismaError } from '@/lib/site-content';

// ═══════════════════════════════════════════════════════════════════════
//  /api/v1/admin/site/{collection} — مدیریتِ محتوای سایت (استودیو)
//
//  GET  → لیستِ کاملِ استودیو (پیش‌نویس + منتشرشده، با جستجو و صفحه‌بندی)
//  POST → ساختِ ردیفِ تازه
//
//  احرازِ هویت: همان مدیرِ پلتفرمِ پنلِ شرکت (adminAuthFromRequest). یک هویت،
//  یک صفِ دسترسی — استودیو نقشِ کاربریِ موازی نمی‌سازد.
//
//  هر نوشتن: کشِ نمای عمومیِ همان مجموعه فوراً باطل و عمل audit می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({ collection: z.string().min(1).max(40) });
const querySchema = z.object({
  q: z.string().max(120).optional(),
  status: z.enum(['draft', 'published'] as const).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).max(100_000).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ collection: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);
    const { collection } = parseParams(await params, paramsSchema);
    if (!isCollection(collection)) throw Err.notFound(`مجموعه (مجازها: ${COLLECTIONS.join('، ')})`);
    const { q, status, limit, offset } = parseQuery(req, querySchema);

    const cfg = REGISTRY[collection];
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (q) where.OR = cfg.searchFields.map((f) => ({ [f]: { contains: q, mode: 'insensitive' } }));

    const [rows, total] = await Promise.all([
      cfg.read().findMany({ where, orderBy: cfg.adminOrderBy, take: limit ?? 100, skip: offset ?? 0 }),
      cfg.read().count({ where }),
    ]);

    return NextResponse.json({ collection, total, count: rows.length, items: rows.map(cfg.toAdmin) });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request, { params }: { params: Promise<{ collection: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = adminAuthFromRequest(req);
    const { collection } = parseParams(await params, paramsSchema);
    if (!isCollection(collection)) throw Err.notFound('مجموعه');

    const cfg = REGISTRY[collection];
    const input = await parseBody(req, cfg.createSchema);

    let data: Record<string, unknown>;
    try {
      data = cfg.toData(input);
    } catch (err) {
      // خطاهای قاعده‌ی دامنه (بازه‌ی بنر، نوعِ بلوک، تاریخِ نامعتبر) → ۴۲۲ نه ۵۰۰
      throw Err.validation((err as Error).message);
    }

    const row = await cfg.write()
      .create({ data: { ...data, updatedBy: admin.sub } })
      .catch((err: unknown) => { throw mapPrismaError(err); });

    await invalidateCollection(collection);
    await audit({
      action: 'admin.action', actorId: admin.sub, actorType: 'admin',
      targetId: String(row.id), ip: clientIp(req),
      detail: { operation: 'site_content_create', collection, ref: String(row.slug ?? row.key ?? row.id) },
    });

    return NextResponse.json(cfg.toAdmin(row), { status: 201 });
  } catch (e) { return errorResponse(e); }
}
