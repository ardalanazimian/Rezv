import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { invalidate, cacheKey } from '@/lib/cache';

// ═══════════════════════════════════════════════════════════════════════
//  GET/PATCH /api/v1/restaurant/menu/branding
//  شخصی‌سازیِ صفحه‌ی منویِ عمومی — کنترلِ خودِ رستوران، بدونِ دخالتِ شرکت.
//
//  مسئله‌ای که حل می‌کند: تا مهاجرتِ ۰۵۳، صفحه‌ی منویی که رستوران QRش را
//  روی میز چاپ می‌کرد برایِ همه‌ی رستوران‌ها عیناً یک‌شکل بود. رستوران‌دار
//  هیچ کنترلی بر هویتِ بصریِ چیزی که مهمانش می‌بیند نداشت.
//
//  دامنه عمداً کوچک و واقعی است، نه یک «سیستمِ تمِ کامل»: رنگِ تأکید، روشن/
//  تیره، یک خطِ معرفی، و فهرست/شبکه. هرکدام NULL بماند یعنی «انتخاب نشده»
//  و صفحه به پیش‌فرضِ پلتفرم برمی‌گردد.
//
//  اعتبارسنجی دو لایه است: همین schema، و قیدهایِ CHECK در خودِ دیتابیس
//  (مهاجرتِ ۰۵۳) — تا یک اسکریپتِ دستی هم نتواند مقدارِ بی‌معنا بنشاند.
// ═══════════════════════════════════════════════════════════════════════

const THEMES = ['light', 'dark', 'auto'] as const;
const LAYOUTS = ['list', 'grid'] as const;
/** همان الگویی که قیدِ CHECKِ دیتابیس اعمال می‌کند. */
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

const patchSchema = z.object({
  // nullable چون «برگرد به پیش‌فرض» باید ممکن باشد — با null، نه رشته‌ی خالی.
  menu_accent: z.string().max(7).trim().regex(HEX_RE, 'رنگ باید به شکلِ #RRGGBB باشد').nullable().optional(),
  menu_theme: z.string().max(10).trim().nullable().optional(),
  menu_tagline: z.string().max(160).trim().nullable().optional(),
  menu_layout: z.string().max(10).trim().nullable().optional(),
});

const SELECT = {
  menuAccent: true, menuTheme: true, menuTagline: true, menuLayout: true,
} as const;

function view(r: { menuAccent: string | null; menuTheme: string | null; menuTagline: string | null; menuLayout: string | null }) {
  return {
    menu_accent: r.menuAccent,
    menu_theme: r.menuTheme,
    menu_tagline: r.menuTagline,
    menu_layout: r.menuLayout,
    // مقادیرِ مجاز همراهِ پاسخ می‌آیند تا پنل مجبور نباشد فهرست را
    // هاردکد کند و با سرور از هم بیفتد.
    options: { themes: THEMES, layouts: LAYOUTS },
  };
}

export const GET = withRestaurantAuth({ permission: 'canManageSettings' }, async (_req, ctx) => {
  const r = await db.restaurant.findUnique({ where: { id: ctx.restaurant.id }, select: SELECT });
  return NextResponse.json(view(r ?? { menuAccent: null, menuTheme: null, menuTagline: null, menuLayout: null }));
});

export const PATCH = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx) => {
  const b = await parseBody(req, patchSchema);

  const data: Record<string, unknown> = {};
  if (b.menu_accent !== undefined) data.menuAccent = b.menu_accent || null;
  if (b.menu_tagline !== undefined) data.menuTagline = b.menu_tagline || null;
  if (b.menu_theme !== undefined) {
    // رشته‌ی خالی = «پاکش کن». مقدارِ خارج از فهرست رد می‌شود، نه اینکه
    // بی‌صدا به پیش‌فرض بیفتد — وگرنه رستوران‌دار فکر می‌کند ذخیره شده.
    const v = b.menu_theme || null;
    if (v !== null && !(THEMES as readonly string[]).includes(v)) {
      throw Err.validation(`حالتِ نمایش باید یکی از ${THEMES.join('، ')} باشد`);
    }
    data.menuTheme = v;
  }
  if (b.menu_layout !== undefined) {
    const v = b.menu_layout || null;
    if (v !== null && !(LAYOUTS as readonly string[]).includes(v)) {
      throw Err.validation(`چیدمان باید یکی از ${LAYOUTS.join('، ')} باشد`);
    }
    data.menuLayout = v;
  }

  if (Object.keys(data).length === 0) {
    throw Err.validation('چیزی برای تغییر فرستاده نشده');
  }

  const updated = await db.restaurant.update({
    where: { id: ctx.restaurant.id },
    data,
    select: { ...SELECT, slug: true },
  });

  // صفحه‌ی عمومی این مقادیر را می‌خواند؛ بدونِ باطل‌کردنِ کش، رستوران‌دار
  // تغییرش را تا انقضایِ کش نمی‌بیند و فکر می‌کند ذخیره نشده.
  if (updated.slug) {
    await invalidate(cacheKey('restaurant-detail', updated.slug));
    await invalidate(cacheKey('restaurant-public-menu', updated.slug));
  }

  return NextResponse.json(view(updated));
});
