import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { REGISTRY, isCollection, invalidateCollection, mapPrismaError } from '@/lib/site-content';

// ═══════════════════════════════════════════════════════════════════════
//  /api/v1/admin/site/{collection}/{id} — یک ردیفِ محتوایی (استودیو)
//
//  GET    → خواندنِ کامل برای فرمِ ویرایش (شاملِ پیش‌نویس)
//  PATCH  → ویرایشِ جزئی (فقط کلیدهای فرستاده‌شده تغییر می‌کنند)
//  DELETE → حذفِ کامل
//
//  PATCHِ جزئی عمدی است: استودیو فقط فیلدهای تغییرکرده را می‌فرستد، پس دو
//  ویرایشِ همزمانِ دو فیلدِ متفاوت یکدیگر را پاک نمی‌کنند.
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({
  collection: z.string().min(1).max(40),
  id: zUuid,
});

export async function GET(req: Request, { params }: { params: Promise<{ collection: string; id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);
    const { collection, id } = parseParams(await params, paramsSchema);
    if (!isCollection(collection)) throw Err.notFound('مجموعه');

    const cfg = REGISTRY[collection];
    const row = await cfg.read().findUnique({ where: { id } });
    if (!row) throw Err.notFound('ردیف');
    return NextResponse.json(cfg.toAdmin(row));
  } catch (e) { return errorResponse(e); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ collection: string; id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = adminAuthFromRequest(req);
    const { collection, id } = parseParams(await params, paramsSchema);
    if (!isCollection(collection)) throw Err.notFound('مجموعه');

    const cfg = REGISTRY[collection];
    const existing = await cfg.read().findUnique({ where: { id } });
    if (!existing) throw Err.notFound('ردیف');

    const input = await parseBody(req, cfg.updateSchema);
    if (Object.keys(input).length === 0) throw Err.validation('هیچ فیلدی برای تغییر فرستاده نشده است');

    let data: Record<string, unknown>;
    try {
      data = cfg.toData(input, existing);
    } catch (err) {
      throw Err.validation((err as Error).message);
    }

    const row = await cfg.write()
      .update({ where: { id }, data: { ...data, updatedBy: admin.sub } })
      .catch((err: unknown) => { throw mapPrismaError(err); });

    await invalidateCollection(collection);
    await audit({
      action: 'admin.action', actorId: admin.sub, actorType: 'admin',
      targetId: id, ip: clientIp(req),
      detail: {
        operation: 'site_content_update', collection,
        fields: Object.keys(input),
        status: (data.status as string) ?? (existing.status as string),
      },
    });

    return NextResponse.json(cfg.toAdmin(row));
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ collection: string; id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = adminAuthFromRequest(req);
    const { collection, id } = parseParams(await params, paramsSchema);
    if (!isCollection(collection)) throw Err.notFound('مجموعه');

    const cfg = REGISTRY[collection];
    const row = await cfg.write().delete({ where: { id } })
      .catch((err: unknown) => { throw mapPrismaError(err); });

    await invalidateCollection(collection);
    await audit({
      action: 'admin.action', actorId: admin.sub, actorType: 'admin',
      targetId: id, ip: clientIp(req),
      detail: { operation: 'site_content_delete', collection, ref: String(row.slug ?? row.key ?? id) },
    });

    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) { return errorResponse(e); }
}
