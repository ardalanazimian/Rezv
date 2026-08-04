// ═══════════════════════════════════════════════════════════════════════
//  محتوایِ وب‌سایتِ عمومی (apps/seo) — رجیستریِ مجموعه‌ها (CMS)
//
//  چرا رجیستری و نه ۷ روتِ جداگانه: هر مجموعه‌ی محتوایی دقیقاً یک الگو دارد
//  (list/get/create/update/delete + انتشار). با یک رجیستریِ داده‌محور، دو روتِ
//  داینامیک (عمومی و ادمین) کلِ CMS را پوشش می‌دهند؛ افزودنِ مجموعه‌ی جدید
//  یعنی یک ورودی در همین فایل، نه یک درختِ روتِ تازه.
//
//  دو نما برای هر ردیف:
//    toPublic → چیزی که سایت می‌بیند (snake_case، بدونِ فیلدِ داخلی/پیش‌نویس)
//    toAdmin  → چیزی که استودیو می‌بیند (همه‌ی فیلدها برای ویرایش)
// ═══════════════════════════════════════════════════════════════════════

import { db, dbRead } from './db';
import { cached, invalidatePattern } from './cache';
import { Err } from './errors';
import { z, Schema } from './schemas';

// ── نوعِ حداقلیِ delegate که رجیستری لازم دارد (همه‌ی مدل‌های site_* آن را دارند) ──
export interface CrudDelegate {
  findMany(args?: unknown): Promise<Record<string, unknown>[]>;
  findFirst(args?: unknown): Promise<Record<string, unknown> | null>;
  findUnique(args?: unknown): Promise<Record<string, unknown> | null>;
  create(args: unknown): Promise<Record<string, unknown>>;
  update(args: unknown): Promise<Record<string, unknown>>;
  delete(args: unknown): Promise<Record<string, unknown>>;
  count(args?: unknown): Promise<number>;
}

export const COLLECTIONS = [
  'pages', 'articles', 'faqs', 'plans', 'testimonials', 'banners', 'release-notes',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export function isCollection(v: string): v is CollectionName {
  return (COLLECTIONS as readonly string[]).includes(v);
}

// ── پرایمیتیوهای مشترکِ محتوا ──
const zStatus = z.enum(['draft', 'published'] as const);
const zSlug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'اسلاگ فقط حروفِ کوچکِ لاتین، عدد و خط‌تیره');
const zTags = z.array(z.string().min(1).max(40)).max(12);
const zUrl = z.string().max(500).regex(/^(https?:\/\/|\/)/, 'آدرس باید با http(s):// یا / شروع شود');
const zIsoDate = z.string().min(4).max(40);

/**
 * بلوک‌های محتوایی یک صفحه. عمداً schemaی آزاد (فقط `type` الزامی است) تا
 * افزودنِ بلوکِ تازه از استودیو، بدونِ تغییرِ بک‌اند ممکن باشد؛ سایت بلوکِ
 * ناشناخته را نادیده می‌گیرد (رندر نمی‌شکند). سقفِ تعداد برای جلوگیری از
 * بدنه‌ی غول‌پیکر.
 */
const zSections = z.array(z.record()).max(60);

function assertSectionTypes(sections: Record<string, unknown>[] | undefined): void {
  if (!sections) return;
  sections.forEach((s, i) => {
    if (typeof s.type !== 'string' || !s.type.trim()) {
      throw new Error(`sections[${i}].type الزامی است`);
    }
  });
}

/** تاریخِ ISO ورودی → Date (با خطای روشن به‌جای Invalid Date خاموش). */
export function parseIsoDate(v: string, field: string): Date {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`${field}: تاریخ معتبر نیست`);
  return d;
}

type Row = Record<string, unknown>;
const str = (r: Row, k: string) => (r[k] == null ? null : String(r[k]));
const num = (r: Row, k: string) => (r[k] == null ? null : Number(r[k]));
const bool = (r: Row, k: string) => Boolean(r[k]);
const arr = (r: Row, k: string) => (Array.isArray(r[k]) ? (r[k] as string[]) : []);
const iso = (r: Row, k: string) => (r[k] instanceof Date ? (r[k] as Date).toISOString() : null);

export interface CollectionConfig {
  /** delegateِ نوشتنی (primary) و خواندنی (replica اگر باشد). */
  write: () => CrudDelegate;
  read: () => CrudDelegate;
  createSchema: Schema<Record<string, unknown>>;
  updateSchema: Schema<Record<string, unknown>>;
  /** فیلترِ نمای عمومی — علاوه بر status=published. */
  publicWhere?: () => Record<string, unknown>;
  publicOrderBy: Record<string, unknown> | Record<string, unknown>[];
  adminOrderBy: Record<string, unknown> | Record<string, unknown>[];
  /** اگر ست باشد، مسیرِ «یک ردیف» با همین فیلد کار می‌کند (نه id). */
  detailKey?: 'slug';
  /** فیلدهایی که در جستجوی استودیو نگاه می‌شوند. */
  searchFields: string[];
  publicTtlSec: number;
  /** سقفِ پیش‌فرضِ لیستِ عمومی. */
  publicLimit: number;
  toPublic: (row: Row) => Record<string, unknown>;
  toAdmin: (row: Row) => Record<string, unknown>;
  /** نگاشتِ ورودیِ اعتبارسنجی‌شده → دادهٔ Prisma (تبدیلِ تاریخ، انتشار و…). */
  toData: (input: Record<string, unknown>, existing?: Row) => Record<string, unknown>;
}

// ── نماهای عمومی ──

const publicPage = (r: Row) => ({
  slug: str(r, 'slug'),
  title: str(r, 'title'),
  description: str(r, 'description'),
  sections: Array.isArray(r.sections) ? r.sections : [],
  seo: {
    title: str(r, 'seoTitle'),
    description: str(r, 'seoDescription'),
    keywords: arr(r, 'seoKeywords'),
    og_image: str(r, 'ogImage'),
    noindex: bool(r, 'noindex'),
    structured_data: r.structuredData ?? null,
  },
  published_at: iso(r, 'publishedAt'),
  updated_at: iso(r, 'updatedAt'),
});

const publicArticle = (r: Row) => ({
  slug: str(r, 'slug'),
  title: str(r, 'title'),
  excerpt: str(r, 'excerpt'),
  body: str(r, 'body'),
  cover_url: str(r, 'coverUrl'),
  cover_alt: str(r, 'coverAlt'),
  tags: arr(r, 'tags'),
  author_name: str(r, 'authorName'),
  author_role: str(r, 'authorRole'),
  reading_minutes: num(r, 'readingMinutes'),
  featured: bool(r, 'featured'),
  seo: {
    title: str(r, 'seoTitle'),
    description: str(r, 'seoDescription'),
    keywords: arr(r, 'seoKeywords'),
    og_image: str(r, 'ogImage'),
    noindex: bool(r, 'noindex'),
  },
  published_at: iso(r, 'publishedAt'),
  updated_at: iso(r, 'updatedAt'),
});

const publicFaq = (r: Row) => ({
  id: str(r, 'id'),
  question: str(r, 'question'),
  answer: str(r, 'answer'),
  scope: str(r, 'scope'),
  sort_order: num(r, 'sortOrder'),
});

const publicPlan = (r: Row) => {
  const months = Number(r.months) || 1;
  const price = Number(r.priceToman) || 0;
  const compareAt = r.compareAtToman == null ? null : Number(r.compareAtToman);
  return {
    key: str(r, 'key'),
    name: str(r, 'name'),
    tagline: str(r, 'tagline'),
    months,
    price_toman: price,
    // معادلِ ماهانه سمتِ سرور حساب می‌شود تا هر سه اپ یک عدد را نشان دهند.
    monthly_toman: Math.round(price / months),
    compare_at_toman: compareAt,
    saving_toman: compareAt && compareAt > price ? compareAt - price : 0,
    saving_percent: compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0,
    badge: str(r, 'badge'),
    features: arr(r, 'features'),
    highlight: bool(r, 'highlight'),
    sort_order: num(r, 'sortOrder'),
  };
};

const publicTestimonial = (r: Row) => ({
  id: str(r, 'id'),
  quote: str(r, 'quote'),
  author: str(r, 'author'),
  role: str(r, 'role'),
  company: str(r, 'company'),
  avatar_url: str(r, 'avatarUrl'),
  rating: num(r, 'rating'),
});

const publicBanner = (r: Row) => ({
  id: str(r, 'id'),
  message: str(r, 'message'),
  cta_label: str(r, 'ctaLabel'),
  cta_href: str(r, 'ctaHref'),
  tone: str(r, 'tone'),
});

const publicReleaseNote = (r: Row) => ({
  id: str(r, 'id'),
  version: str(r, 'version'),
  title: str(r, 'title'),
  body: str(r, 'body'),
  tags: arr(r, 'tags'),
  released_at: iso(r, 'releasedAt'),
});

/** نمای استودیو: همه‌ی فیلدها + متادیتای ویرایش. تاریخ‌ها ISO می‌شوند. */
function adminView(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out;
}

/**
 * منطقِ انتشار — فقط برای مجموعه‌هایی که ستونِ publishedAt دارند (صفحه و مقاله).
 * وقتی وضعیت به published می‌رود و تاریخِ انتشار خالی است، همان لحظه ثبت می‌شود
 * تا ترتیبِ بلاگ و lastmodِ sitemap درست باشد. برگشت به draft تاریخ را پاک
 * نمی‌کند — تاریخِ انتشارِ اولیه سندِ سئویی است.
 *
 * ⚠️ روی مجموعه‌های دیگر (faqs/plans/…) صدا زده نمی‌شود؛ آن‌ها این ستون را
 * ندارند و فرستادنِ فیلدِ ناشناخته به Prisma خطای اعتبارسنجی می‌دهد.
 */
function withPublishedAt(data: Record<string, unknown>, existing?: Row): Record<string, unknown> {
  if (data.status === 'published' && data.publishedAt === undefined && !existing?.publishedAt) {
    return { ...data, publishedAt: new Date() };
  }
  return data;
}

/** مجموعه‌های بدونِ چرخه‌ی انتشارِ تاریخ‌دار: ورودی بدونِ تغییر به Prisma می‌رود. */
const passthrough = (input: Record<string, unknown>) => ({ ...input });

export const REGISTRY: Record<CollectionName, CollectionConfig> = {
  pages: {
    write: () => db.sitePage as unknown as CrudDelegate,
    read: () => dbRead.sitePage as unknown as CrudDelegate,
    createSchema: z.object({
      slug: zSlug,
      title: z.string().min(1).max(200).trim(),
      description: z.string().max(1000).optional(),
      sections: zSections.default([]),
      seoTitle: z.string().max(200).optional(),
      seoDescription: z.string().max(400).optional(),
      seoKeywords: zTags.default([]),
      ogImage: zUrl.optional(),
      noindex: z.boolean().default(false),
      structuredData: z.record().optional(),
      status: zStatus.default('draft'),
    }),
    updateSchema: z.object({
      slug: zSlug.optional(),
      title: z.string().min(1).max(200).trim().optional(),
      description: z.string().max(1000).nullable().optional(),
      sections: zSections.optional(),
      seoTitle: z.string().max(200).nullable().optional(),
      seoDescription: z.string().max(400).nullable().optional(),
      seoKeywords: zTags.optional(),
      ogImage: zUrl.nullable().optional(),
      noindex: z.boolean().optional(),
      structuredData: z.record().nullable().optional(),
      status: zStatus.optional(),
    }),
    publicOrderBy: { slug: 'asc' },
    adminOrderBy: { updatedAt: 'desc' },
    detailKey: 'slug',
    searchFields: ['slug', 'title'],
    publicTtlSec: 60,
    publicLimit: 60,
    toPublic: publicPage,
    toAdmin: adminView,
    toData: (input, existing) => {
      assertSectionTypes(input.sections as Record<string, unknown>[] | undefined);
      return withPublishedAt({ ...input }, existing);
    },
  },

  articles: {
    write: () => db.siteArticle as unknown as CrudDelegate,
    read: () => dbRead.siteArticle as unknown as CrudDelegate,
    createSchema: z.object({
      slug: zSlug,
      title: z.string().min(1).max(200).trim(),
      excerpt: z.string().min(1).max(600).trim(),
      body: z.string().min(1).max(80_000),
      coverUrl: zUrl.optional(),
      coverAlt: z.string().max(200).optional(),
      tags: zTags.default([]),
      authorName: z.string().min(1).max(80).default('تیم رزرونو'),
      authorRole: z.string().max(80).optional(),
      readingMinutes: z.number().int().min(1).max(120).default(5),
      seoTitle: z.string().max(200).optional(),
      seoDescription: z.string().max(400).optional(),
      seoKeywords: zTags.default([]),
      ogImage: zUrl.optional(),
      noindex: z.boolean().default(false),
      featured: z.boolean().default(false),
      status: zStatus.default('draft'),
      publishedAt: zIsoDate.optional(),
    }),
    updateSchema: z.object({
      slug: zSlug.optional(),
      title: z.string().min(1).max(200).trim().optional(),
      excerpt: z.string().min(1).max(600).trim().optional(),
      body: z.string().min(1).max(80_000).optional(),
      coverUrl: zUrl.nullable().optional(),
      coverAlt: z.string().max(200).nullable().optional(),
      tags: zTags.optional(),
      authorName: z.string().min(1).max(80).optional(),
      authorRole: z.string().max(80).nullable().optional(),
      readingMinutes: z.number().int().min(1).max(120).optional(),
      seoTitle: z.string().max(200).nullable().optional(),
      seoDescription: z.string().max(400).nullable().optional(),
      seoKeywords: zTags.optional(),
      ogImage: zUrl.nullable().optional(),
      noindex: z.boolean().optional(),
      featured: z.boolean().optional(),
      status: zStatus.optional(),
      publishedAt: zIsoDate.nullable().optional(),
    }),
    publicOrderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    adminOrderBy: { updatedAt: 'desc' },
    detailKey: 'slug',
    searchFields: ['slug', 'title', 'excerpt'],
    publicTtlSec: 120,
    publicLimit: 50,
    toPublic: publicArticle,
    toAdmin: adminView,
    toData: (input, existing) => {
      const data: Record<string, unknown> = { ...input };
      if (typeof input.publishedAt === 'string') data.publishedAt = parseIsoDate(input.publishedAt, 'publishedAt');
      return withPublishedAt(data, existing);
    },
  },

  faqs: {
    write: () => db.siteFaq as unknown as CrudDelegate,
    read: () => dbRead.siteFaq as unknown as CrudDelegate,
    createSchema: z.object({
      question: z.string().min(3).max(400).trim(),
      answer: z.string().min(3).max(4000).trim(),
      scope: z.enum(['general', 'pricing', 'demo', 'business', 'customer'] as const).default('general'),
      sortOrder: z.number().int().min(0).max(9999).default(0),
      status: zStatus.default('published'),
    }),
    updateSchema: z.object({
      question: z.string().min(3).max(400).trim().optional(),
      answer: z.string().min(3).max(4000).trim().optional(),
      scope: z.enum(['general', 'pricing', 'demo', 'business', 'customer'] as const).optional(),
      sortOrder: z.number().int().min(0).max(9999).optional(),
      status: zStatus.optional(),
    }),
    publicOrderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    adminOrderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }],
    searchFields: ['question', 'answer'],
    publicTtlSec: 120,
    publicLimit: 100,
    toPublic: publicFaq,
    toAdmin: adminView,
    toData: passthrough,
  },

  plans: {
    write: () => db.sitePlan as unknown as CrudDelegate,
    read: () => dbRead.sitePlan as unknown as CrudDelegate,
    createSchema: z.object({
      key: z.string().min(1).max(30).regex(/^[a-z0-9_-]+$/, 'کلید فقط حروفِ کوچکِ لاتین، عدد، _ و -'),
      name: z.string().min(1).max(80).trim(),
      tagline: z.string().max(200).optional(),
      months: z.number().int().min(1).max(60),
      priceToman: z.number().int().min(0).max(100_000_000_000),
      compareAtToman: z.number().int().min(0).max(100_000_000_000).optional(),
      badge: z.string().max(40).optional(),
      features: z.array(z.string().min(1).max(200)).max(30).default([]),
      highlight: z.boolean().default(false),
      tenantPlan: z.enum(['free', 'starter', 'pro', 'enterprise'] as const).default('pro'),
      sortOrder: z.number().int().min(0).max(9999).default(0),
      status: zStatus.default('published'),
    }),
    updateSchema: z.object({
      key: z.string().min(1).max(30).regex(/^[a-z0-9_-]+$/, 'کلید فقط حروفِ کوچکِ لاتین، عدد، _ و -').optional(),
      name: z.string().min(1).max(80).trim().optional(),
      tagline: z.string().max(200).nullable().optional(),
      months: z.number().int().min(1).max(60).optional(),
      priceToman: z.number().int().min(0).max(100_000_000_000).optional(),
      compareAtToman: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
      badge: z.string().max(40).nullable().optional(),
      features: z.array(z.string().min(1).max(200)).max(30).optional(),
      highlight: z.boolean().optional(),
      tenantPlan: z.enum(['free', 'starter', 'pro', 'enterprise'] as const).optional(),
      sortOrder: z.number().int().min(0).max(9999).optional(),
      status: zStatus.optional(),
    }),
    publicOrderBy: [{ sortOrder: 'asc' }, { months: 'asc' }],
    adminOrderBy: { sortOrder: 'asc' },
    detailKey: 'slug', // برای پلن‌ها مسیرِ جزئیاتِ عمومی لازم نیست؛ کلید در لیست هست
    searchFields: ['key', 'name'],
    publicTtlSec: 60,
    publicLimit: 20,
    toPublic: publicPlan,
    toAdmin: adminView,
    toData: passthrough,
  },

  testimonials: {
    write: () => db.siteTestimonial as unknown as CrudDelegate,
    read: () => dbRead.siteTestimonial as unknown as CrudDelegate,
    createSchema: z.object({
      quote: z.string().min(5).max(1200).trim(),
      author: z.string().min(1).max(80).trim(),
      role: z.string().max(120).optional(),
      company: z.string().max(120).optional(),
      avatarUrl: zUrl.optional(),
      rating: z.number().int().min(1).max(5).default(5),
      sortOrder: z.number().int().min(0).max(9999).default(0),
      status: zStatus.default('published'),
    }),
    updateSchema: z.object({
      quote: z.string().min(5).max(1200).trim().optional(),
      author: z.string().min(1).max(80).trim().optional(),
      role: z.string().max(120).nullable().optional(),
      company: z.string().max(120).nullable().optional(),
      avatarUrl: zUrl.nullable().optional(),
      rating: z.number().int().min(1).max(5).optional(),
      sortOrder: z.number().int().min(0).max(9999).optional(),
      status: zStatus.optional(),
    }),
    publicOrderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    adminOrderBy: { sortOrder: 'asc' },
    searchFields: ['author', 'company', 'quote'],
    publicTtlSec: 300,
    publicLimit: 30,
    toPublic: publicTestimonial,
    toAdmin: adminView,
    toData: passthrough,
  },

  banners: {
    write: () => db.siteBanner as unknown as CrudDelegate,
    read: () => dbRead.siteBanner as unknown as CrudDelegate,
    createSchema: z.object({
      message: z.string().min(3).max(400).trim(),
      ctaLabel: z.string().max(60).optional(),
      ctaHref: zUrl.optional(),
      tone: z.enum(['brand', 'success', 'warning', 'info'] as const).default('brand'),
      startsAt: zIsoDate.optional(),
      endsAt: zIsoDate.optional(),
      sortOrder: z.number().int().min(0).max(9999).default(0),
      status: zStatus.default('draft'),
    }),
    updateSchema: z.object({
      message: z.string().min(3).max(400).trim().optional(),
      ctaLabel: z.string().max(60).nullable().optional(),
      ctaHref: zUrl.nullable().optional(),
      tone: z.enum(['brand', 'success', 'warning', 'info'] as const).optional(),
      startsAt: zIsoDate.nullable().optional(),
      endsAt: zIsoDate.nullable().optional(),
      sortOrder: z.number().int().min(0).max(9999).optional(),
      status: zStatus.optional(),
    }),
    // بنر فقط داخلِ بازه‌ی زمانی‌اش دیده می‌شود (کمپینِ زمان‌دار بدونِ ری‌دیپلوی).
    publicWhere: () => {
      const now = new Date();
      return {
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      };
    },
    publicOrderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    adminOrderBy: { sortOrder: 'asc' },
    searchFields: ['message'],
    publicTtlSec: 30,
    publicLimit: 5,
    toPublic: publicBanner,
    toAdmin: adminView,
    toData: (input) => {
      const data: Record<string, unknown> = { ...input };
      if (typeof input.startsAt === 'string') data.startsAt = parseIsoDate(input.startsAt, 'startsAt');
      if (typeof input.endsAt === 'string') data.endsAt = parseIsoDate(input.endsAt, 'endsAt');
      if (data.startsAt instanceof Date && data.endsAt instanceof Date && data.endsAt <= data.startsAt) {
        throw new Error('پایانِ بازه باید بعد از شروع باشد');
      }
      return data;
    },
  },

  'release-notes': {
    write: () => db.siteReleaseNote as unknown as CrudDelegate,
    read: () => dbRead.siteReleaseNote as unknown as CrudDelegate,
    createSchema: z.object({
      version: z.string().min(1).max(30).trim(),
      title: z.string().min(1).max(200).trim(),
      body: z.string().min(1).max(20_000),
      tags: zTags.default([]),
      releasedAt: zIsoDate,
      status: zStatus.default('published'),
    }),
    updateSchema: z.object({
      version: z.string().min(1).max(30).trim().optional(),
      title: z.string().min(1).max(200).trim().optional(),
      body: z.string().min(1).max(20_000).optional(),
      tags: zTags.optional(),
      releasedAt: zIsoDate.optional(),
      status: zStatus.optional(),
    }),
    publicOrderBy: { releasedAt: 'desc' },
    adminOrderBy: { releasedAt: 'desc' },
    searchFields: ['version', 'title'],
    publicTtlSec: 300,
    publicLimit: 50,
    toPublic: publicReleaseNote,
    toAdmin: adminView,
    toData: (input) => {
      const data: Record<string, unknown> = { ...input };
      if (typeof input.releasedAt === 'string') data.releasedAt = parseIsoDate(input.releasedAt, 'releasedAt');
      return data;
    },
  },
};

/**
 * خطاهای شناخته‌شده‌ی Prisma → خطای دامنه با پیامِ فارسیِ روشن.
 * P2002 = نقضِ کلیدِ یکتا (اسلاگ/کلیدِ تکراری)، P2025 = ردیف پیدا نشد.
 * بقیه دست‌نخورده برمی‌گردند تا errorResponse همان ۵۰۰ی عمومی را بدهد.
 */
export function mapPrismaError(err: unknown): unknown {
  const code = (err as { code?: string })?.code;
  if (code === 'P2002') return Err.validation('این اسلاگ/کلید قبلاً استفاده شده است');
  if (code === 'P2025') return Err.notFound('ردیف');
  return err;
}

// ── کش ──

const CACHE_PREFIX = 'site-content';

export function contentCacheKey(collection: CollectionName, suffix: string): string {
  return `${CACHE_PREFIX}:${collection}:${suffix}`;
}

/** بعد از هر نوشتنِ استودیو، نمای عمومیِ همان مجموعه فوراً باطل می‌شود. */
export async function invalidateCollection(collection: CollectionName): Promise<void> {
  await invalidatePattern(`${CACHE_PREFIX}:${collection}:*`);
}

/** لیستِ عمومیِ یک مجموعه (کش‌شده). scope فقط برای faqs معنا دارد. */
export async function readPublicList(
  collection: CollectionName,
  opts: { scope?: string; limit?: number; tag?: string } = {},
): Promise<Record<string, unknown>[]> {
  const cfg = REGISTRY[collection];
  const limit = Math.min(opts.limit ?? cfg.publicLimit, cfg.publicLimit);
  const key = contentCacheKey(collection, `list:${opts.scope ?? '-'}:${opts.tag ?? '-'}:${limit}`);

  return cached(key, cfg.publicTtlSec, async () => {
    const where: Record<string, unknown> = { status: 'published', ...(cfg.publicWhere?.() ?? {}) };
    if (opts.scope && collection === 'faqs') where.scope = opts.scope;
    if (opts.tag && collection === 'articles') where.tags = { has: opts.tag };
    const rows = await cfg.read().findMany({ where, orderBy: cfg.publicOrderBy, take: limit });
    return rows.map(cfg.toPublic);
  });
}

/** یک ردیفِ عمومی بر اساسِ slug (کش‌شده). برای مجموعه‌های بدونِ slug → null. */
export async function readPublicDetail(
  collection: CollectionName,
  slug: string,
): Promise<Record<string, unknown> | null> {
  const cfg = REGISTRY[collection];
  if (collection !== 'pages' && collection !== 'articles') return null;
  const key = contentCacheKey(collection, `one:${slug}`);
  return cached(key, cfg.publicTtlSec, async () => {
    const row = await cfg.read().findFirst({ where: { slug, status: 'published' } });
    return row ? cfg.toPublic(row) : null;
  });
}
