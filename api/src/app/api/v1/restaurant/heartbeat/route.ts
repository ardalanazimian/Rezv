import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';

/**
 * POST /api/v1/restaurant/heartbeat — پنل بیزنس هر ~۳۰ ثانیه این را صدا می‌زند
 * تا به سرور بگوید «اینترنتم وصل است». سرور last_seen_at را به‌روز می‌کند.
 *
 * چرا لازم است: وقتی اینترنت یک رستوران قطع می‌شود، پنل بیزنسش به سرور وصل نیست،
 * ولی سرور (که اپ مشتری از آن داده می‌گیرد) روی دیتاسنتری دیگر است و آنلاین است.
 * پس سرور از heartbeat می‌فهمد کدام رستوران زنده است. اگر مدتی heartbeat نیاید،
 * رستوران از اپ مشتری پنهان می‌شود تا رزرو آنلاینی ثبت نشود که با ثبت حضوریِ
 * آفلاینِ پرسنل تضاد پیدا کند (حذف کامل سناریوی رزرو دوبل).
 *
 * rateLimit سبک ('search') کافی است چون فراوان صدا زده می‌شود.
 */
export const POST = withRestaurantAuth(
  { rateLimit: 'search' },
  async (_req, ctx) => {
    await db.restaurant.update({
      where: { id: ctx.restaurant.id },
      data: { lastSeenAt: new Date() },
    });
    // فاصله‌ی heartbeat پیشنهادی به کلاینت (ثانیه) — تا اگر خواستیم مرکزی تنظیمش کنیم
    return NextResponse.json({ ok: true, interval: 30 });
  },
);
