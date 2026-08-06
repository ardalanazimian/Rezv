// ═══════════════════════════════════════════════════════════════════════
//  کلاینتِ محتوای سایت — خواندنِ CMS از api/ رزرونو (سمتِ سرور)
//
//  دو منبعِ آدرس:
//    SITE_API_BASE           → فقط سرور (Server Components، sitemap)
//    NEXT_PUBLIC_API_BASE    → مرورگر (فرم‌ها و استودیو)
//
//  SEO_API_BASE نامِ قدیمی است (زمانی که این اپ داخلِ apps/seo بود) و هنوز
//  به‌عنوانِ fallback خوانده می‌شود تا محیط‌هایی که آن را ست کرده‌اند نشکنند.
//
//  «حالتِ امن»: اگر API تنظیم/در دسترس نباشد، محتوا از فایلِ همگام‌شده‌ی
//  content/site-content.json خوانده می‌شود (همان متنی که seed در دیتابیس
//  می‌کارد). یعنی سایت هیچ‌وقت خالی رندر نمی‌شود — نه در بیلدِ CI، نه هنگامِ
//  قطعیِ موقتِ API. وقتی API در دسترس است، دیتابیس منبعِ حقیقت است.
// ═══════════════════════════════════════════════════════════════════════
import fallback from '../content/site-content.json';
import type {
  SitePage, SiteArticle, SiteFaq, SitePlan, SiteTestimonial, SiteBanner, SiteReleaseNote,
} from './content-types';
import { fallbackPage, fallbackPlans, fallbackFaqs, fallbackArticles, fallbackReleaseNotes } from './content-types';

const SERVER_BASE = (process.env.SITE_API_BASE || process.env.SEO_API_BASE || '').replace(/\/$/, '');

/** آدرسِ API برای مرورگر (فرم‌ها/استودیو). در سرور به SITE_API_BASE برمی‌گردد. */
export function browserApiBase(): string {
  const pub = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
  return pub || SERVER_BASE;
}

type CollectionName =
  | 'pages' | 'articles' | 'faqs' | 'plans' | 'testimonials' | 'banners' | 'release-notes';

async function getJson<T>(path: string, revalidateSec: number): Promise<T | null> {
  if (!SERVER_BASE) return null;
  try {
    const res = await fetch(`${SERVER_BASE}${path}`, { next: { revalidate: revalidateSec } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // شبکه/DNS/timeout → حالتِ امن. صفحه نباید به‌خاطرِ API پایین بیاید.
    return null;
  }
}

async function getList<T>(
  collection: CollectionName,
  query: Record<string, string | number | undefined> = {},
  revalidateSec = 300,
): Promise<T[] | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await getJson<{ items?: T[] }>(`/api/v1/site/${collection}${suffix}`, revalidateSec);
  return data && Array.isArray(data.items) ? data.items : null;
}

// ── صفحه‌ها ─────────────────────────────────────────────────────────────

export async function getPage(slug: string): Promise<SitePage> {
  const page = await getJson<SitePage>(`/api/v1/site/pages/${encodeURIComponent(slug)}`, 120);
  return page ?? fallbackPage(fallback, slug);
}

// ── پلن‌ها ──────────────────────────────────────────────────────────────

export async function getPlans(): Promise<SitePlan[]> {
  const plans = await getList<SitePlan>('plans', {}, 120);
  return plans && plans.length ? plans : fallbackPlans(fallback);
}

// ── پرسش‌های متداول ─────────────────────────────────────────────────────

export async function getFaqs(scope?: string): Promise<SiteFaq[]> {
  const faqs = await getList<SiteFaq>('faqs', { scope, limit: 100 }, 180);
  return faqs && faqs.length ? faqs : fallbackFaqs(fallback, scope);
}

// ── مقاله‌ها ────────────────────────────────────────────────────────────

export async function getArticles(opts: { tag?: string; limit?: number } = {}): Promise<SiteArticle[]> {
  const items = await getList<SiteArticle>('articles', { tag: opts.tag, limit: opts.limit }, 180);
  if (items && items.length) return items;
  const local = fallbackArticles(fallback);
  const filtered = opts.tag ? local.filter((a) => a.tags.includes(opts.tag as string)) : local;
  return opts.limit ? filtered.slice(0, opts.limit) : filtered;
}

export async function getArticle(slug: string): Promise<SiteArticle | null> {
  const article = await getJson<SiteArticle>(`/api/v1/site/articles/${encodeURIComponent(slug)}`, 180);
  if (article) return article;
  return fallbackArticles(fallback).find((a) => a.slug === slug) ?? null;
}

// ── نظرها، بنرها، یادداشتِ انتشار ──────────────────────────────────────

/** نظرِ مشتری هرگز fallback ندارد: یا واقعی و منتشرشده است، یا نمایش داده نمی‌شود. */
export async function getTestimonials(): Promise<SiteTestimonial[]> {
  return (await getList<SiteTestimonial>('testimonials', {}, 600)) ?? [];
}

export async function getBanner(): Promise<SiteBanner | null> {
  const items = await getList<SiteBanner>('banners', { limit: 1 }, 60);
  return items && items.length ? items[0] : null;
}

export async function getReleaseNotes(): Promise<SiteReleaseNote[]> {
  const items = await getList<SiteReleaseNote>('release-notes', {}, 600);
  return items && items.length ? items : fallbackReleaseNotes(fallback);
}

// ── پیگیریِ سفارش (صفحه‌ی /order/{code}) ───────────────────────────────

export interface OrderStatus {
  code: string;
  kind: 'trial' | 'purchase';
  status: 'pending' | 'contacted' | 'activated' | 'rejected' | 'cancelled';
  plan_name: string | null;
  months: number | null;
  amount_toman: number | null;
  business_name: string;
  trial_ends_at: string | null;
  activated_at: string | null;
  plan_expires_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

/** وضعیتِ سفارش هرگز کش نمی‌شود — کاربر باید حالِ لحظه‌ای را ببیند. */
export async function getOrderStatus(code: string): Promise<OrderStatus | null> {
  if (!SERVER_BASE) return null;
  try {
    const res = await fetch(`${SERVER_BASE}/api/v1/site/orders/${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as OrderStatus;
  } catch {
    return null;
  }
}

// ── داده‌ی sitemap ──────────────────────────────────────────────────────

export interface SitemapData {
  restaurants: { slug: string; updated_at: string }[];
  cities: string[];
  cuisines: string[];
  articles: { slug: string; updated_at: string; published_at: string | null }[];
  pages: { slug: string; updated_at: string }[];
}

export async function getSitemapData(): Promise<SitemapData> {
  const empty: SitemapData = { restaurants: [], cities: [], cuisines: [], articles: [], pages: [] };
  const d = await getJson<Partial<SitemapData>>('/api/v1/seo/sitemap', 3600);
  if (!d) {
    // بدونِ API هم مقاله‌های حالتِ امن باید در sitemap باشند.
    return {
      ...empty,
      articles: fallbackArticles(fallback).map((a) => ({
        slug: a.slug,
        updated_at: a.published_at ?? new Date().toISOString(),
        published_at: a.published_at,
      })),
    };
  }
  return {
    restaurants: Array.isArray(d.restaurants) ? d.restaurants : [],
    cities: Array.isArray(d.cities) ? d.cities : [],
    cuisines: Array.isArray(d.cuisines) ? d.cuisines : [],
    articles: Array.isArray(d.articles) ? d.articles : [],
    pages: Array.isArray(d.pages) ? d.pages : [],
  };
}
