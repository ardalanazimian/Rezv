/**
 * seed-site.ts — کاشتنِ محتوای پیش‌فرضِ وب‌سایتِ عمومی در دیتابیس.
 *
 * اجرا: npm run db:seed:site
 *
 * منبعِ محتوا: prisma/seed/site-content.json که با tools/sync-design-system.sh
 * از shared/content/site-content.json کپی می‌شود (همان فایلی که apps/seo هم
 * به‌عنوان «حالتِ امن» استفاده می‌کند) → یک متن، دو مصرف‌کننده، بدونِ واگرایی.
 *
 * ⚠️ idempotent و بی‌خطر روی محیطِ زنده: همه‌چیز upsert است و روی کلیدِ طبیعی
 * (slug/key/version) کار می‌کند. ردیفی که مدیر از استودیو ساخته حذف نمی‌شود.
 *
 * ⚠️ بازنویسیِ ویرایش‌های دستی: به‌صورتِ پیش‌فرض ردیفِ موجود دست‌نخورده می‌ماند
 * (فقط ردیفِ غایب ساخته می‌شود) تا اجرای دوباره‌ی seed، متنی را که تیم در
 * استودیو ویرایش کرده برنگرداند. برای بازگرداندنِ عمدیِ همه‌چیز به نسخه‌ی
 * پیش‌فرض:  npm run db:seed:site -- --force
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const FORCE = process.argv.includes('--force');

const here = dirname(fileURLToPath(import.meta.url));
const contentPath = join(here, 'seed', 'site-content.json');

interface PlanSeed {
  key: string; name: string; tagline?: string; months: number; priceToman: number;
  compareAtToman?: number; badge?: string | null; features: string[]; highlight?: boolean;
  tenantPlan?: 'free' | 'starter' | 'pro' | 'enterprise'; sortOrder?: number;
}
interface FaqSeed { scope: string; sortOrder: number; question: string; answer: string }
interface ArticleSeed {
  slug: string; title: string; excerpt: string; body: string; tags: string[];
  readingMinutes: number; featured?: boolean;
  seoTitle?: string; seoDescription?: string; seoKeywords?: string[];
}
interface ReleaseSeed { version: string; title: string; body: string; tags: string[]; releasedAt: string }
interface PageSeed {
  slug: string; title: string; description?: string; sections: Record<string, unknown>[];
  seoTitle?: string; seoDescription?: string; seoKeywords?: string[]; noindex?: boolean;
}
interface TestimonialSeed {
  quote: string; author: string; role?: string; company?: string; rating?: number; sortOrder?: number;
}
interface BannerSeed {
  message: string; ctaLabel?: string; ctaHref?: string; tone?: string; sortOrder?: number;
}
interface SiteContentFile {
  version: number;
  plans: PlanSeed[];
  faqs: FaqSeed[];
  articles: ArticleSeed[];
  releaseNotes: ReleaseSeed[];
  pages: PageSeed[];
  testimonials: TestimonialSeed[];
  banners: BannerSeed[];
}

// تاریخِ انتشارِ مقاله‌ها: عقب‌رونده از امروز تا ترتیبِ بلاگ معنادار باشد و
// sitemap تاریخِ واقعی داشته باشد (نه همه در یک ثانیه).
function publishDate(indexFromNewest: number): Date {
  return new Date(Date.now() - indexFromNewest * 9 * 86_400_000);
}

async function main(): Promise<void> {
  const raw = readFileSync(contentPath, 'utf8');
  const content = JSON.parse(raw) as SiteContentFile;
  console.log(`📦 محتوای پیش‌فرض (نسخه ${content.version}) — ${FORCE ? 'حالتِ بازنویسی (--force)' : 'فقط ردیف‌های غایب'}`);

  let created = 0;
  let skipped = 0;
  let updated = 0;

  // ── پلن‌ها ──────────────────────────────────────────────────────────
  for (const p of content.plans) {
    const data = {
      name: p.name,
      tagline: p.tagline ?? null,
      months: p.months,
      priceToman: p.priceToman,
      compareAtToman: p.compareAtToman ?? null,
      badge: p.badge ?? null,
      features: p.features,
      highlight: p.highlight ?? false,
      tenantPlan: p.tenantPlan ?? 'pro',
      sortOrder: p.sortOrder ?? 0,
      status: 'published' as const,
    };
    const existing = await db.sitePlan.findUnique({ where: { key: p.key }, select: { id: true } });
    if (existing && !FORCE) { skipped++; continue; }
    await db.sitePlan.upsert({ where: { key: p.key }, create: { key: p.key, ...data }, update: data });
    existing ? updated++ : created++;
  }
  console.log(`  پلن‌ها: ${content.plans.length} (${created} تازه)`);

  // ── پرسش‌های متداول ────────────────────────────────────────────────
  // بدونِ کلیدِ طبیعیِ یکتا در اسکیما → روی (scope, question) تطبیق داده می‌شود.
  let faqCreated = 0;
  for (const f of content.faqs) {
    const existing = await db.siteFaq.findFirst({
      where: { scope: f.scope, question: f.question },
      select: { id: true },
    });
    if (existing) {
      if (FORCE) {
        await db.siteFaq.update({
          where: { id: existing.id },
          data: { answer: f.answer, sortOrder: f.sortOrder, status: 'published' },
        });
        updated++;
      } else skipped++;
      continue;
    }
    await db.siteFaq.create({
      data: { scope: f.scope, question: f.question, answer: f.answer, sortOrder: f.sortOrder, status: 'published' },
    });
    faqCreated++;
  }
  console.log(`  پرسش‌ها: ${content.faqs.length} (${faqCreated} تازه)`);

  // ── مقاله‌ها ────────────────────────────────────────────────────────
  let articleCreated = 0;
  for (const [i, a] of content.articles.entries()) {
    const data = {
      title: a.title,
      excerpt: a.excerpt,
      body: a.body,
      tags: a.tags,
      readingMinutes: a.readingMinutes,
      featured: a.featured ?? false,
      seoTitle: a.seoTitle ?? null,
      seoDescription: a.seoDescription ?? null,
      seoKeywords: a.seoKeywords ?? [],
      status: 'published' as const,
      publishedAt: publishDate(i),
    };
    const existing = await db.siteArticle.findUnique({ where: { slug: a.slug }, select: { id: true } });
    if (existing && !FORCE) { skipped++; continue; }
    await db.siteArticle.upsert({
      where: { slug: a.slug },
      create: { slug: a.slug, ...data },
      // تاریخِ انتشارِ اولیه سندِ سئویی است — در بازنویسی هم دست نمی‌خورد.
      update: { ...data, publishedAt: undefined },
    });
    existing ? updated++ : articleCreated++;
  }
  console.log(`  مقاله‌ها: ${content.articles.length} (${articleCreated} تازه)`);

  // ── یادداشت‌های انتشار ─────────────────────────────────────────────
  let releaseCreated = 0;
  for (const r of content.releaseNotes) {
    const existing = await db.siteReleaseNote.findFirst({ where: { version: r.version }, select: { id: true } });
    const data = {
      title: r.title, body: r.body, tags: r.tags,
      releasedAt: new Date(r.releasedAt), status: 'published' as const,
    };
    if (existing) {
      if (FORCE) { await db.siteReleaseNote.update({ where: { id: existing.id }, data }); updated++; }
      else skipped++;
      continue;
    }
    await db.siteReleaseNote.create({ data: { version: r.version, ...data } });
    releaseCreated++;
  }
  console.log(`  یادداشت‌های انتشار: ${content.releaseNotes.length} (${releaseCreated} تازه)`);

  // ── صفحه‌ها ─────────────────────────────────────────────────────────
  let pageCreated = 0;
  for (const p of content.pages) {
    const data = {
      title: p.title,
      description: p.description ?? null,
      sections: p.sections as unknown as object,
      seoTitle: p.seoTitle ?? null,
      seoDescription: p.seoDescription ?? null,
      seoKeywords: p.seoKeywords ?? [],
      noindex: p.noindex ?? false,
      status: 'published' as const,
      publishedAt: new Date(),
    };
    const existing = await db.sitePage.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (existing && !FORCE) { skipped++; continue; }
    await db.sitePage.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...data },
      update: { ...data, publishedAt: undefined },
    });
    existing ? updated++ : pageCreated++;
  }
  console.log(`  صفحه‌ها: ${content.pages.length} (${pageCreated} تازه)`);

  // ── نظرهای مشتریان و بنرها ─────────────────────────────────────────
  // عمداً در فایلِ پیش‌فرض خالی‌اند: نظرِ مشتری باید واقعی باشد و از استودیو
  // ثبت شود. سایت وقتی داده‌ای نباشد بخش را با «حالتِ خالی» نشان می‌دهد،
  // نه با نقلِ‌قولِ ساختگی.
  for (const t of content.testimonials ?? []) {
    const existing = await db.siteTestimonial.findFirst({ where: { author: t.author, quote: t.quote }, select: { id: true } });
    if (existing) { skipped++; continue; }
    await db.siteTestimonial.create({
      data: {
        quote: t.quote, author: t.author, role: t.role ?? null, company: t.company ?? null,
        rating: t.rating ?? 5, sortOrder: t.sortOrder ?? 0, status: 'published',
      },
    });
    created++;
  }
  for (const b of content.banners ?? []) {
    const existing = await db.siteBanner.findFirst({ where: { message: b.message }, select: { id: true } });
    if (existing) { skipped++; continue; }
    await db.siteBanner.create({
      data: {
        message: b.message, ctaLabel: b.ctaLabel ?? null, ctaHref: b.ctaHref ?? null,
        tone: b.tone ?? 'brand', sortOrder: b.sortOrder ?? 0, status: 'draft',
      },
    });
    created++;
  }

  console.log(`\n✅ seed محتوای سایت کامل شد — ${created + faqCreated + articleCreated + releaseCreated + pageCreated} ردیفِ تازه، ${updated} به‌روزرسانی، ${skipped} دست‌نخورده.`);
  if (!FORCE && skipped > 0) {
    console.log('   (ردیف‌های موجود عمداً دست‌نخورده ماندند. برای بازگردانی به پیش‌فرض: npm run db:seed:site -- --force)');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
