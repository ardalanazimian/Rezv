import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseQuery, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/admin/telemetry — کمترین مصرف‌کننده‌ی ممکن برایِ platform_events
//
//  ── چرا این فایل وجود دارد (دلیل، نه توضیح) ──
//  تا ۲۰۲۶-۰۸-۲۶ جدولِ `platform_events` یک **بن‌بست** بود: نوشته می‌شد
//  (`lib/platform-events.ts`)، هرس می‌شد (`maintenance/retention`)، و در کلِ
//  `api/src/` **صفر** کوئریِ خواندنی رویش وجود داشت — نه Prisma، نه
//  `$queryRaw`. یعنی هزینه‌ی ذخیره‌سازی و ریسکِ حریمِ داده پرداخت می‌شد بدونِ
//  اینکه حتی یک نفر بتواند بپرسد «آیا اصلاً داده‌ای می‌رسد؟».
//
//  ── چرا این‌قدر کوچک است ──
//  ساختنِ یک داشبوردِ تحلیلی خودسرانه می‌بود: هیچ‌کس چنین چیزی نخواسته و هر
//  تصمیمِ محصولی‌اش (کدام متریک؟ کدام برش؟) حدس می‌شد. ولی «جمع‌آوری را قطع
//  کن» هم زودهنگام است، چون بلافاصله بعدِ بستنِ شکافِ allowlist تازه اولین
//  دادهٔ واقعی دارد می‌رسد و باید دیده شود. پس کمترین چیزِ **واقعاً مفید**
//  انتخاب شد: شمارش بر حسب نام و بازه، به‌علاوه‌ی «تازه‌ترین رویداد کِی بود».
//  همین یک عدد به تنهایی جواب می‌دهد که خطِ لوله زنده است یا دوباره مرده.
//
//  عمداً **تجمیعی** است و نه ردیف‌به‌ردیف: `payload` می‌تواند زمینه‌ی مشتری
//  داشته باشد (§۸ — کمینه‌ی دسترسی). این endpoint سلامتِ خطِ لوله را نشان
//  می‌دهد، نه دیتای شخص را. هیچ payload/session/user_id ای برنمی‌گرداند.
// ═══════════════════════════════════════════════════════════════════════

const MAX_TYPES = 100;

const querySchema = z.object({
  // پنجره‌ی زمانی بر حسب روز. سقفِ ۴۰۰ = بلندترین سطلِ نگه‌داری
  // (`TELEMETRY_RETENTION_VERIFIED_DAYS`)؛ فراتر از آن ردیفی وجود ندارد.
  days: z.number().int().min(1).max(400).default(7),
});

async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    // ⚠️ خروجی باید مصرف شود (await): promiseِ شناور یعنی گاردِ بی‌اثر.
    await requireAdmin(req);

    const { days } = parseQuery(req, querySchema);
    const since = new Date(Date.now() - days * 86_400_000);

    const [byType, bySource, byTrust, total, newest] = await Promise.all([
      db.platformEvent.groupBy({
        by: ['type'],
        where: { occurredAt: { gte: since } },
        _count: true,
        orderBy: { _count: { type: 'desc' } },
        take: MAX_TYPES,
      }),
      db.platformEvent.groupBy({ by: ['source'], where: { occurredAt: { gte: since } }, _count: true }),
      db.platformEvent.groupBy({ by: ['trustLevel'], where: { occurredAt: { gte: since } }, _count: true }),
      db.platformEvent.count({ where: { occurredAt: { gte: since } } }),
      // مُهرِ زمانیِ **سروری**، نه occurred_at: دومی ورودیِ کلاینت است و برای
      // پاسخ به «آیا ingest زنده است؟» بی‌اعتبار.
      db.platformEvent.findFirst({ orderBy: { serverReceivedAt: 'desc' }, select: { serverReceivedAt: true } }),
    ]);

    // Number(...) با اینکه groupBy عددِ JS می‌دهد: قاعده‌ی «هر دو لایه» در
    // CLAUDE.md §۶؛ اگر روزی این کوئری به $queryRaw تبدیل شود، BigInt بی‌صدا
    // به رشته‌ی JSON تبدیل نمی‌شود.
    const asMap = (rows: Array<{ _count: number } & Record<string, unknown>>, key: string): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const r of rows) out[String(r[key])] = Number(r._count);
      return out;
    };

    return NextResponse.json({
      window_days: days,
      since: since.toISOString(),
      total: Number(total),
      // اگر این `null` باشد یعنی جدول کاملاً خالی است — یا خطِ لوله مرده.
      last_event_at: newest?.serverReceivedAt ?? null,
      by_type: byType.map((r) => ({ type: r.type, count: Number(r._count) })),
      truncated: byType.length >= MAX_TYPES,
      by_source: asMap(bySource, 'source'),
      by_trust_level: asMap(byTrust, 'trustLevel'),
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/telemetry', GET_impl);
