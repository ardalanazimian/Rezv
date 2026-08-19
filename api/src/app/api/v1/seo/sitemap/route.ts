import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { errorResponse } from '@/lib/errors';

// ═══════════════════════════════════════════════════════════
//  GET /api/v1/seo/sitemap — دادهٔ خامِ sitemap برای وب‌سایتِ عمومی (apps/seo).
//  slugِ همه‌ی رستوران‌های فعال + شهرها و آشپزی‌های متمایز + محتوای منتشرشده‌ی
//  سایت (مقاله/صفحه). عمومی، cache-شده.
//
//  چرا یک منبع: sitemap.xml سایت باید هم صفحاتِ محصول/بازاریابی و هم صفحاتِ
//  رستوران را در یک درخت داشته باشد؛ دو منبعِ جدا یعنی ریسکِ جاافتادنِ نیمی از
//  آدرس‌ها و لینک‌سازیِ داخلیِ ناقص.
//
//  مقیاس: فعلاً یک پاسخِ واحد (کافی برای این مرحله). برای ۵۰k+ رستوران، گامِ بعدی
//  صفحه‌بندی + sitemap-index است (در sitemap.ts اپِ SEO با generateSitemaps).
// ═══════════════════════════════════════════════════════════

const MAX_RESTAURANTS = 50_000; // سقفِ ایمنی؛ فراتر از آن نیازِ sitemap-index است.

/**
 * رستوران‌هایِ دمو/آزمایشی نباید در sitemapِ عمومی بیایند.
 *
 * یافته‌ی ۲۰۲۶-۰۸-۱۹: این endpoint هر رستورانِ `isOpen` را بیرون می‌داد، بدونِ
 * هیچ فیلتری. در دیتابیسِ توسعه ۳۴ رستوران از ۳۷ تا ردیفِ به‌جا‌مانده از
 * تست‌های integration بودند (`demo-concurrency-…`، `zz-menu-a-…`) و همه‌شان
 * در sitemap ظاهر می‌شدند. در تولید هم هر تنانتِ دمو همین‌طور منتشر می‌شد.
 *
 * تنها نشانه‌ی «دمو» در اسکیما پیشوندِ `[DEMO]` در نام است (فیلدِ boolean وجود
 * ندارد) — پس همان مبناست. اگر روزی فیلدِ `isDemo` اضافه شد، اینجا باید به آن
 * تکیه کند، نه به رشته. **(follow-up)**
 */
const DEMO_NAME_PREFIX = '[DEMO]';

export async function GET() {
  try {
    const data = await cached(cacheKey('seo-sitemap'), 300, async () => {
      const [restaurants, cityRows, cuisineRows, articles, pages] = await Promise.all([
        db.restaurant.findMany({
          where: { isOpen: true, NOT: { name: { startsWith: DEMO_NAME_PREFIX } } },
          select: { slug: true, createdAt: true },
          orderBy: { id: 'desc' },
          take: MAX_RESTAURANTS,
        }),
        // شهر و آشپزی هم از همان مجموعه‌ی غیرِ‌دمو می‌آیند — وگرنه صفحه‌ی
        // «رستوران‌های فلان‌شهر» ساخته می‌شود که تنها ساکنش یک رستورانِ دمو است.
        db.restaurant.findMany({
          where: { isOpen: true, city: { not: null }, NOT: { name: { startsWith: DEMO_NAME_PREFIX } } },
          select: { city: true }, distinct: ['city'],
        }),
        db.restaurant.findMany({
          where: { isOpen: true, cuisine: { not: null }, NOT: { name: { startsWith: DEMO_NAME_PREFIX } } },
          select: { cuisine: true }, distinct: ['cuisine'],
        }),
        // محتوایِ منتشرشده‌ی سایت — noindexها عمداً بیرون می‌مانند تا sitemap با
        // متاتگِ robots تناقض نداشته باشد (سیگنالِ متناقض به خزنده).
        db.siteArticle.findMany({
          where: { status: 'published', noindex: false },
          select: { slug: true, updatedAt: true, publishedAt: true },
          orderBy: { publishedAt: 'desc' },
          take: 5_000,
        }),
        db.sitePage.findMany({
          where: { status: 'published', noindex: false },
          select: { slug: true, updatedAt: true },
          take: 500,
        }),
      ]);

      return {
        restaurants: restaurants.map((r) => ({ slug: r.slug, updated_at: r.createdAt })),
        cities: cityRows.map((c) => c.city).filter(Boolean),
        cuisines: cuisineRows.map((c) => c.cuisine).filter(Boolean),
        articles: articles.map((a) => ({ slug: a.slug, updated_at: a.updatedAt, published_at: a.publishedAt })),
        pages: pages.map((p) => ({ slug: p.slug, updated_at: p.updatedAt })),
      };
    });

    return NextResponse.json(data);
  } catch (e) { return errorResponse(e); }
}
