// ═══════════════════════════════════════════════════════════════════════
//  انواعِ محتوای سایت + پلِ «حالتِ امن»
//
//  انواع دقیقاً شکلِ خروجیِ /api/v1/site/* را توصیف می‌کنند. توابعِ fallback*
//  همان شکل را از content/site-content.json (که فرمتِ seed را دارد) می‌سازند،
//  تا لایه‌ی بالاتر نفهمد داده از API آمده یا از فایل.
// ═══════════════════════════════════════════════════════════════════════

export interface Cta { label: string; href: string }

/** یک بلوکِ محتوایی. `type` تعیین می‌کند کدام کامپوننت رندرش کند؛ بقیه‌ی
 *  کلیدها آزادند تا افزودنِ بلوک از استودیو نیازی به تغییرِ تایپ نداشته باشد. */
export interface Section {
  type: string;
  [key: string]: unknown;
}

export interface SiteSeo {
  title: string | null;
  description: string | null;
  keywords: string[];
  og_image: string | null;
  noindex: boolean;
  structured_data?: unknown;
}

export interface SitePage {
  slug: string;
  title: string;
  description: string | null;
  sections: Section[];
  seo: SiteSeo;
  published_at: string | null;
  updated_at: string | null;
}

export interface SiteArticle {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_url: string | null;
  cover_alt: string | null;
  tags: string[];
  author_name: string;
  author_role: string | null;
  reading_minutes: number;
  featured: boolean;
  seo: SiteSeo;
  published_at: string | null;
  updated_at: string | null;
}

export interface SiteFaq {
  id: string;
  question: string;
  answer: string;
  scope: string;
  sort_order: number;
}

export interface SitePlan {
  key: string;
  name: string;
  tagline: string | null;
  months: number;
  price_toman: number;
  monthly_toman: number;
  compare_at_toman: number | null;
  saving_toman: number;
  saving_percent: number;
  badge: string | null;
  features: string[];
  highlight: boolean;
  sort_order: number;
}

export interface SiteTestimonial {
  id: string;
  quote: string;
  author: string;
  role: string | null;
  company: string | null;
  avatar_url: string | null;
  rating: number;
}

export interface SiteBanner {
  id: string;
  message: string;
  cta_label: string | null;
  cta_href: string | null;
  tone: string;
}

export interface SiteReleaseNote {
  id: string;
  version: string;
  title: string;
  body: string;
  tags: string[];
  released_at: string | null;
}

// ── شکلِ فایلِ محتوای پیش‌فرض (خروجیِ shared/content/site-content.json) ──

interface RawPage {
  slug: string; title: string; description?: string; sections: Section[];
  seoTitle?: string; seoDescription?: string; seoKeywords?: string[]; noindex?: boolean;
}
interface RawPlan {
  key: string; name: string; tagline?: string; months: number; priceToman: number;
  compareAtToman?: number; badge?: string | null; features: string[]; highlight?: boolean; sortOrder?: number;
}
interface RawFaq { scope: string; sortOrder: number; question: string; answer: string }
interface RawArticle {
  slug: string; title: string; excerpt: string; body: string; tags: string[];
  readingMinutes: number; featured?: boolean;
  seoTitle?: string; seoDescription?: string; seoKeywords?: string[];
}
interface RawRelease { version: string; title: string; body: string; tags: string[]; releasedAt: string }

export interface RawContent {
  version: number;
  pages: RawPage[];
  plans: RawPlan[];
  faqs: RawFaq[];
  articles: RawArticle[];
  releaseNotes: RawRelease[];
}

function seo(raw: { seoTitle?: string; seoDescription?: string; seoKeywords?: string[]; noindex?: boolean }): SiteSeo {
  return {
    title: raw.seoTitle ?? null,
    description: raw.seoDescription ?? null,
    keywords: raw.seoKeywords ?? [],
    og_image: null,
    noindex: raw.noindex ?? false,
  };
}

/** صفحه‌ی «حالتِ امن». اگر اسلاگ در فایل نبود، یک صفحه‌ی خالیِ معتبر برمی‌گردد
 *  تا رندر نشکند (خودِ روت تصمیم می‌گیرد ۴۰۴ بدهد یا نه). */
export function fallbackPage(content: unknown, slug: string): SitePage {
  const c = content as RawContent;
  const raw = c.pages.find((p) => p.slug === slug);
  if (!raw) {
    return {
      slug, title: '', description: null, sections: [],
      seo: { title: null, description: null, keywords: [], og_image: null, noindex: false },
      published_at: null, updated_at: null,
    };
  }
  return {
    slug: raw.slug,
    title: raw.title,
    description: raw.description ?? null,
    sections: raw.sections,
    seo: seo(raw),
    published_at: null,
    updated_at: null,
  };
}

export function fallbackPlans(content: unknown): SitePlan[] {
  const c = content as RawContent;
  return c.plans
    .map((p) => {
      const compareAt = p.compareAtToman ?? null;
      return {
        key: p.key,
        name: p.name,
        tagline: p.tagline ?? null,
        months: p.months,
        price_toman: p.priceToman,
        monthly_toman: Math.round(p.priceToman / p.months),
        compare_at_toman: compareAt,
        saving_toman: compareAt && compareAt > p.priceToman ? compareAt - p.priceToman : 0,
        saving_percent:
          compareAt && compareAt > p.priceToman
            ? Math.round(((compareAt - p.priceToman) / compareAt) * 100)
            : 0,
        badge: p.badge ?? null,
        features: p.features,
        highlight: p.highlight ?? false,
        sort_order: p.sortOrder ?? 0,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function fallbackFaqs(content: unknown, scope?: string): SiteFaq[] {
  const c = content as RawContent;
  return c.faqs
    .filter((f) => !scope || f.scope === scope)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f, i) => ({
      id: `local-${f.scope}-${i}`,
      question: f.question,
      answer: f.answer,
      scope: f.scope,
      sort_order: f.sortOrder,
    }));
}

export function fallbackArticles(content: unknown): SiteArticle[] {
  const c = content as RawContent;
  // تاریخِ انتشارِ عقب‌رونده — همان قاعده‌ی seed، تا ترتیبِ بلاگ یکسان بماند.
  const now = Date.now();
  return c.articles.map((a, i) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    body: a.body,
    cover_url: null,
    cover_alt: null,
    tags: a.tags,
    author_name: 'تیم رزرونو',
    author_role: null,
    reading_minutes: a.readingMinutes,
    featured: a.featured ?? false,
    seo: seo(a),
    published_at: new Date(now - i * 9 * 86_400_000).toISOString(),
    updated_at: null,
  }));
}

export function fallbackReleaseNotes(content: unknown): SiteReleaseNote[] {
  const c = content as RawContent;
  return c.releaseNotes.map((r, i) => ({
    id: `local-release-${i}`,
    version: r.version,
    title: r.title,
    body: r.body,
    tags: r.tags,
    released_at: r.releasedAt,
  }));
}
