import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseBody, z } from '@/lib/schemas';

// ═══════════════════════════════════════════════════════════
//  GET/PUT /api/v1/restaurant/profile — هویتِ نمایشیِ رستوران (اسم)
//
//  ⚠️ رفعِ باگ (پیدا‌شده در ممیزیِ «یافته‌های جانبیِ» PR #4): این endpoint
//  قبلاً اصلاً وجود نداشت. پنلِ بیزنس (apps/business/js/data.js) یک
//  RESTAURANT.name هاردکد («کافه‌رستوران ویستا») داشت که هیچ‌وقت از سرور
//  خوانده نمی‌شد، و دکمه‌ی «تغییرِ نام» (saveRestName در crm.js) فقط همان
//  متغیرِ محلیِ جاوااسکریپت را عوض می‌کرد — هیچ درخواستی به سرور نمی‌رفت.
//  یعنی هر رستوران‌دارِ واقعی که وارد پنل می‌شد، تبِ «پروفایل» را با نامِ
//  رستورانِ یک نفرِ دیگر می‌دید، و اگر نامش را «تغییر» می‌داد، آن تغییر با
//  اولین رفرش گم می‌شد و هیچ‌جای دیگری (اپِ مشتری، سایرِ دستگاه‌ها) هم
//  دیده نمی‌شد. لوگو مشمولِ این باگ نبود — از قبل از مسیرِ واقعیِ
//  آپلود/بازبینیِ گالری رد می‌شود.
// ═══════════════════════════════════════════════════════════

export const GET = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'search' }, async (_req, ctx) => {
  // withRestaurantAuth از قبل ctx.restaurant را (شاملِ name) resolve کرده — کوئریِ اضافه لازم نیست.
  return NextResponse.json({ id: ctx.restaurant.id, name: ctx.restaurant.name });
});

const profileSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const PUT = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'auth' }, async (req, ctx) => {
  const b = await parseBody(req, profileSchema);
  const restaurant = await db.restaurant.update({
    where: { id: ctx.restaurant.id },
    data: { name: b.name },
    select: { id: true, name: true },
  });
  return NextResponse.json({ ok: true, id: restaurant.id, name: restaurant.name });
});
