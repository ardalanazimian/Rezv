import { NextResponse } from 'next/server';
import { cached, cacheKey } from '@/lib/cache';
import { errorResponse } from '@/lib/errors';
import { parseQuery, zDateStr, z } from '@/lib/schemas';
import { withApiMetrics } from '@/lib/api-metrics';

import {
  BULK_AVAILABILITY_MAX,
  bulkEntriesFromRaw,
  computeBulkSlots,
  type BulkAvailabilityRaw,
} from '@/lib/availability';

// ═══════════════════════════════════════════════════════════
//  GET /api/v1/restaurants/availability?ids=<uuid,uuid,…>&date=YYYY-MM-DD&party=N
//
//  «چیپِ ساعت» رویِ کارت‌هایِ فیدِ کشف. اپِ مشتری از روزِ اول فیلدِ
//  `available_slots` را می‌خواند (`api.js:mapApiRestaurant`) ولی هیچ روتی
//  آن را نمی‌داد — پس کارتِ هر رستورانِ *واقعی* همیشه بدونِ ساعت می‌ماند و
//  فقط CTAِ «ببین سانس‌ها» می‌گرفت. این روت همان حلقه‌ی نیمه‌کاره را می‌بندد.
//  (پیش از رفعِ ۲۰۲۶-۰۸-۱۴ بدتر بود: ساعتِ یک رستورانِ *نمونه* به‌عنوانِ سانسِ
//  واقعیِ رستورانِ زنده نشان داده می‌شد.)
//
//  چرا جدا از `GET /restaurants`: لیست ۶۰ ثانیه کش می‌شود و به تاریخ/تعدادِ
//  نفر وابسته نیست. availability به هر دو وابسته است و با هر تغییرِ انتخابِ
//  کاربر باید تازه شود؛ ادغامشان یعنی یا کشِ لیست بی‌اثر شود یا سانسِ کهنه
//  سرو کنیم.
//
//  صداقت: پاسخ فقط سانس‌هایی را نام می‌برد که موتورِ availability آزاد
//  می‌داند — همان `computeSlots`ی که شیتِ رزرو هم مصرفش می‌کند، پس چیپِ روی
//  کارت نمی‌تواند چیزی بگوید که شیت تکذیبش کند. شناسه‌ی ناشناخته اصلاً در
//  خروجی نمی‌آید، نه با آرایه‌ی خالی: «نمی‌شناسیم» با «جا ندارد» یکی نیست.
//
//  ⚠️ مسیر: سگمنتِ ثابتِ `availability` رویِ `[slug]` سایه می‌اندازد، یعنی
//  رستورانی با slugِ `availability` از `/restaurants/availability` در دسترس
//  نخواهد بود. همان الگویِ `restaurants/live-stats`ِ موجود است و ریپو هیچ
//  فهرستِ slugِ رزروشده ندارد — به‌عنوانِ یافته در KNOWN_LIMITATIONS ثبت شد.
// ═══════════════════════════════════════════════════════════

const querySchema = z.object({
  ids: z.string().min(1).max(2000),
  date: zDateStr,
  party: z.number().int().min(1).max(30).default(2),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** همان پنجره‌ی «تازه»یِ مسیرِ تکی (FRESH_SEC در getAvailability) — یک قرارداد، نه دو. */
const FRESH_SEC = 30;

async function GET_impl(req: Request) {
  try {
    const { ids, date, party } = parseQuery(req, querySchema);
    // شناسه‌یِ بدشکل بی‌صدا کنار گذاشته می‌شود (نه ۴۲۲): یک idِ خراب در یک
    // صفحه‌ی ۲۴تایی نباید ساعتِ ۲۳ رستورانِ دیگر را هم از بین ببرد.
    // مرتب‌سازی فقط برایِ کلیدِ کش است تا ترتیبِ متفاوتِ همان مجموعه، کشِ
    // جداگانه نسازد؛ خروجی به هر حال نگاشتِ id→سانس است، نه آرایه‌ی مرتب.
    const list = [...new Set(ids.split(',').map(s => s.trim()).filter(s => UUID_RE.test(s)))]
      .slice(0, BULK_AVAILABILITY_MAX)
      .sort();

    // فقط سانس‌هایِ *خام* کش می‌شوند. فیلترِ «سانسِ گذشته» بعد از کش اجرا
    // می‌شود، وگرنه تا ۳۰ ثانیه ساعتِ ردشده را «آزاد» اعلام می‌کردیم.
    const raw = list.length
      ? await cached<Record<string, BulkAvailabilityRaw>>(
          cacheKey('avail-bulk', date, String(party), list.join(',')),
          FRESH_SEC,
          () => computeBulkSlots(list, date, party),
        )
      : {};

    const restaurants: Record<string, { available_slots: string[]; has_schedule: boolean }> = {};
    for (const [id, entry] of bulkEntriesFromRaw(raw, date)) {
      restaurants[id] = { available_slots: entry.open, has_schedule: entry.hasSchedule };
    }

    return NextResponse.json({
      date,
      party,
      restaurants,
      // اگر کلاینت بیش از سقف بفرستد بقیه حذف می‌شوند — صریح می‌گوییم چند تا
      // واقعاً حساب شد تا «ساعت ندارد» با «اصلاً حساب نشد» اشتباه نشود.
      requested: list.length,
      max_per_request: BULK_AVAILABILITY_MAX,
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/restaurants/availability', GET_impl);
