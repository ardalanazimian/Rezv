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
//  «حالتِ امن»: اگر API **تنظیم نشده باشد**، محتوا از فایلِ همگام‌شده‌ی
//  content/site-content.json خوانده می‌شود (همان متنی که seed در دیتابیس
//  می‌کارد). یعنی سایت هیچ‌وقت خالی رندر نمی‌شود — بیلدِ CI عمداً بدونِ
//  SITE_API_BASE اجرا می‌شود (ci.yml:539). وقتی API در دسترس است، دیتابیس
//  منبعِ حقیقت است.
//
//  ⚠️ ولی حالتِ امن روی **تعهد** اعمال نمی‌شود — ببین UpstreamUnavailableError.
// ═══════════════════════════════════════════════════════════════════════
import fallback from '../content/site-content.json';
import type {
  SitePage, SiteArticle, SiteFaq, SitePlan, SiteTestimonial, SiteBanner, SiteReleaseNote,
} from './content-types';
import { fallbackPage, fallbackPlans, fallbackFaqs, fallbackArticles, fallbackReleaseNotes } from './content-types';

/**
 * آدرسِ سرورِ API — **در زمانِ فراخوانی** خوانده می‌شود، نه در زمانِ لودِ ماژول.
 *
 * ⚠️ چرا تابع شد و constِ سطحِ ماژول نماند (شکستِ واقعیِ CI، ۲۰۲۶-۰۹-۰۷):
 * وقتی این یک const بود، مقدارش برای همیشه در لحظه‌ی اولین importِ ماژول قفل
 * می‌شد. تست‌ها برای ساختنِ حالتِ «API پیکربندی نشده» env را خالی می‌کردند و
 * با `import('./site-api.ts?noplanbase')` امیدِ نمونه‌ی تازه داشتند — یعنی
 * ادعای رفتاری را به یک **جزئیاتِ loader** گره زده بودند.
 *
 * روی Node 24 آن کش‌شکن کار می‌کند و تست سبز بود؛ روی **Node 20** (همان که
 * `ci.yml` برای هر هشت jobِ node تعیین می‌کند) کار نمی‌کند: ماژولِ کش‌شده با
 * baseِ قدیمی برمی‌گردد، `fetch` واقعاً اجرا می‌شود و تست می‌افتد.
 *
 * یعنی روی نصفِ محیط‌ها تست **موضوعش را اصلاً لمس نمی‌کرد** و سبز بود — دقیقاً
 * کلاسِ «تستی که وقتی موضوعش غایب است سبز می‌ماند».
 *
 * با خواندنِ تنبل، «پیکربندی نشده» یک حالتِ واقعیِ قابلِ ساخت است و هیچ تستی
 * به کش‌شکن نیاز ندارد. رفتارِ تولید عوض نمی‌شود: env آنجا در تمامِ عمرِ پروسه
 * ثابت است، پس خواندنِ هر بار همان مقدار را می‌دهد.
 */
function serverBase(): string {
  return (process.env.SITE_API_BASE || process.env.SEO_API_BASE || '').replace(/\/$/, '');
}

/** آدرسِ API برای مرورگر (فرم‌ها/استودیو). در سرور به SITE_API_BASE برمی‌گردد. */
export function browserApiBase(): string {
  const pub = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
  return pub || serverBase();
}

type CollectionName =
  | 'pages' | 'articles' | 'faqs' | 'plans' | 'testimonials' | 'banners' | 'release-notes';

/**
 * بالادست (api/) در دسترس نیست — شبکه، تایم‌اوت، ۵xx، یا بدنه‌ی خراب.
 *
 * ⚠️ چرا این کلاس وجود دارد (یافته‌ی واقعیِ ۲۰۲۶-۰۹-۰۷، directive 028):
 * `getJson` در **هر** شکستی `null` می‌داد و `getPlans` روی همان به
 * `fallbackPlans` سقوط می‌کرد — یعنی قیمت‌های ثابتِ کامیت‌شده‌ی
 * `content/site-content.json` (۱۸/۳۴/۶۵ میلیون).
 *
 * قیمتِ زنده از `db.sitePlan` می‌آید و از استودیو ویرایش می‌شود؛ فایلِ
 * کامیت‌شده فقط با کامیتِ کد عوض می‌شود و **هیچ چیزی این دو را همگام
 * نمی‌کند**. پس آن fallback تا اولین تغییرِ قیمت درست است و از آن به بعد
 * برای همیشه بی‌صدا غلط. و چون صفحه‌ها ISR هستند (`/pricing` →
 * `revalidate = 120`)، آن عدد **کش می‌شود** و بدونِ هیچ خطایی سرو می‌شود.
 *
 * این از کلاسِ «نمی‌دانیم را خالی نشان بده» بدتر است: یک بخشِ خالی کاربر را
 * به رفرش دعوت می‌کند، یک عددِ قاطعِ اشتباه نه.
 *
 * الگو عیناً از `apps/seo/lib/api.ts:10-45` گرفته شده (که همین را با استنادِ
 * مستقیم به راهنمای ISRِ Next.js v16.2.9 حل کرده): throw هنگامِ revalidate
 * باعث می‌شود **آخرین صفحه‌ی موفق از کش سرو بماند**، در حالی که یک نتیجه‌ی
 * خالی/جعلی خودش کش می‌شود و می‌ماند.
 *
 * دامنه: فقط جایی که مقدار یک **تعهد** است (قیمت). متنِ ویترین fallback
 * دارد — متنِ کهنه گمراه‌کننده نیست، قیمتِ کهنه هست.
 */
export class UpstreamUnavailableError extends Error {
  constructor(public readonly detail: string) {
    super(`سرویسِ داده در دسترس نیست (${detail})`);
    this.name = 'UpstreamUnavailableError';
  }
}

/**
 * `strict = true` یعنی «این مقدار یک تعهد است»: شکستِ زیرساختی throw می‌شود
 * تا ISR آخرین مقدارِ سالم را نگه دارد، نه اینکه به فایلِ کامیت‌شده سقوط کند.
 *
 * `null` در حالتِ strict فقط یک معنا دارد: API اصلاً پیکربندی نشده
 * (حالتِ امنِ اعلام‌شده). آنجا هیچ دیتابیسی در تصویر نیست که واگرا شده باشد،
 * پس فایلِ کامیت‌شده تنها مرجع است و دروغی در کار نیست.
 */
async function getJson<T>(path: string, revalidateSec: number, strict = false): Promise<T | null> {
  const base = serverBase();
  if (!base) return null;   // حالتِ امنِ اعلام‌شده (ci.yml:539)
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { next: { revalidate: revalidateSec } });
  } catch (e) {
    // شبکه/DNS/timeout
    if (strict) throw new UpstreamUnavailableError(`${path} → ${(e as Error)?.message ?? 'network'}`);
    return null;
  }
  if (!res.ok) {
    if (strict) throw new UpstreamUnavailableError(`${path} → HTTP ${res.status}`);
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    // بدنه‌ی خراب/غیر-JSON (صفحه‌ی گیت‌وی) هم شکستِ زیرساخت است، نه «داده‌ای نیست»
    if (strict) throw new UpstreamUnavailableError(`${path} → پاسخِ نامعتبر`);
    return null;
  }
}

async function getList<T>(
  collection: CollectionName,
  query: Record<string, string | number | undefined> = {},
  revalidateSec = 300,
  strict = false,
): Promise<T[] | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const path = `/api/v1/site/${collection}${suffix}`;
  const data = await getJson<{ items?: T[] }>(path, revalidateSec, strict);
  if (data && Array.isArray(data.items)) return data.items;
  // پاسخِ ۲۰۰ با شکلِ نامعتبر: در مسیرِ تعهد «نمی‌دانیم» است، نه «خالی».
  if (strict && data) throw new UpstreamUnavailableError(`${path} → شکلِ نامعتبر`);
  return null;
}

// ── صفحه‌ها ─────────────────────────────────────────────────────────────

export async function getPage(slug: string): Promise<SitePage> {
  const page = await getJson<SitePage>(`/api/v1/site/pages/${encodeURIComponent(slug)}`, 120);
  return page ?? fallbackPage(fallback, slug);
}

// ── پلن‌ها ──────────────────────────────────────────────────────────────

/**
 * قیمت یک **تعهد** است، پس تنها تابعِ مجموعه‌ایِ strict است.
 *
 * سه نتیجه‌ی متفاوت که نباید یکی شوند:
 *   • ۲۰۰ با پلن      → همان پلن‌های زنده
 *   • ۲۰۰ ولی خالی    → `[]` — مدیر همه را غیرفعال کرده؛ حالتِ خالیِ صادق
 *                        (قبلاً همین‌جا به قیمتِ کامیت‌شده سقوط می‌کرد)
 *   • شکستِ زیرساختی  → throw — ISR آخرین قیمتِ سالم را نگه می‌دارد
 *
 * `null` فقط یعنی API پیکربندی نشده (حالتِ امنِ بیلدِ CI) — آنجا فایل تنها
 * مرجع است و چیزی برای واگرایی وجود ندارد.
 */
export async function getPlans(): Promise<SitePlan[]> {
  const plans = await getList<SitePlan>('plans', {}, 120, true);
  return plans ?? fallbackPlans(fallback);
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

/**
 * نتیجه‌ی پیگیریِ سفارش — سه حالتِ **متفاوت** که نباید یکی شوند.
 *
 * ⚠️ یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۵: این تابع قبلاً در هر سه حالت `null` می‌داد و
 * صفحه‌ی `/order/[code]` روی آن «درخواستی با این کد پیدا نشد» می‌نوشت و
 * می‌گفت «کد را دوباره بررسی کنید». یعنی وقتی API در دسترس نبود، به کسی که
 * واقعاً ثبت‌نام/خرید کرده گفته می‌شد سفارشش **وجود ندارد** — و به سمتِ
 * نتیجه‌گیریِ غلط هدایت می‌شد. این همان قاعده‌ی §۱۰ در جهتِ معکوس است:
 * قطعیِ شبکه نباید به یک «واقعیتِ» جعلی درباره‌ی دادهٔ کاربر تبدیل شود.
 *
 * توجه: بیلدِ CI عمداً بدونِ SITE_API_BASE اجرا می‌شود («حالتِ امن»)، پس
 * حالتِ پیکربندی‌نشده یک وضعیتِ استقرارِ واقعی است، نه فرضِ نظری.
 */
export type OrderLookup =
  | { kind: 'found'; order: OrderStatus }
  | { kind: 'not_found' }
  | { kind: 'unavailable' };

/** وضعیتِ سفارش هرگز کش نمی‌شود — کاربر باید حالِ لحظه‌ای را ببیند. */
export async function getOrderStatus(code: string): Promise<OrderLookup> {
  const base = serverBase();
  if (!base) return { kind: 'unavailable' };
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/site/orders/${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });
  } catch {
    return { kind: 'unavailable' };   // شبکه/DNS/timeout — «نمی‌دانیم»، نه «نیست»
  }
  if (res.status === 404) return { kind: 'not_found' };   // بالادست صریح گفت نیست
  if (!res.ok) return { kind: 'unavailable' };            // ۵xx و بقیه — نمی‌دانیم
  try {
    return { kind: 'found', order: (await res.json()) as OrderStatus };
  } catch {
    return { kind: 'unavailable' };   // بدنه‌ی خراب هم «نمی‌دانیم» است
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
