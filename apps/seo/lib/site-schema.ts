// ═══════════════════════════════════════════════════════════════════════
//  JSON-LD وب‌سایتِ عمومی (schema.org) — توابعِ خالص و قابل‌تست
//
//  جدا از lib/schema.ts (که مخصوصِ صفحاتِ رستوران است) تا دو دامنه قاطی نشوند.
//  همه‌ی سازنده‌ها فقط فیلدهایی را emit می‌کنند که واقعاً داده دارند — یک
//  schemaی ناقصِ پر از null بدتر از نبودنِ schema است.
// ═══════════════════════════════════════════════════════════════════════
import { SITE } from './i18n';
import type { SiteArticle, SitePlan, SiteFaq } from './content-types';

export const ORG_ID = `${SITE}/#organization`;
export const WEBSITE_ID = `${SITE}/#website`;
export const PRODUCT_ID = `${SITE}/#product`;

export const BRAND_NAME = 'رزرونو';
export const BRAND_NAME_EN = 'Rezervno';

/** هویتِ سازمان — لنگرِ همه‌ی گرافِ سایت (بقیه‌ی نودها به @id آن ارجاع می‌دهند). */
export function organizationJsonLd(): object {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: BRAND_NAME,
    alternateName: BRAND_NAME_EN,
    url: `${SITE}/`,
    logo: { '@type': 'ImageObject', url: `${SITE}/icon.svg`, caption: BRAND_NAME },
    description:
      'رزرونو پلتفرمِ رزروِ آنلاینِ میز و مدیریتِ عملیاتِ رستوران است: اپِ مشتری برای کشف و رزرو، و پنلِ کسب‌وکار برای رزرو، میز، باشگاهِ مشتریان و تحلیل.',
    areaServed: { '@type': 'Country', name: 'ایران' },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      availableLanguage: ['fa'],
      url: `${SITE}/contact`,
    },
  };
}

/** وب‌سایت + جست‌وجوی داخلی (SearchAction) برای نتایجِ sitelinks searchbox. */
export function websiteJsonLd(): object {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${SITE}/`,
    name: BRAND_NAME,
    inLanguage: 'fa-IR',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/blog?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * خودِ محصول به‌عنوان SoftwareApplication با پیشنهادهای واقعی.
 * قیمت‌ها از همان پلن‌هایی می‌آیند که در صفحه دیده می‌شوند — تناقضِ بینِ
 * دادهٔ ساخت‌یافته و متنِ صفحه بدترین خطای سئوی محصولی است.
 */
export function softwareApplicationJsonLd(plans: SitePlan[]): object {
  const priced = plans.filter((p) => p.price_toman > 0);
  const node: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': PRODUCT_ID,
    name: `${BRAND_NAME} — پلتفرمِ رزرو و مدیریتِ رستوران`,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Restaurant Reservation Software',
    operatingSystem: 'Web, iOS, Android',
    url: `${SITE}/product`,
    inLanguage: 'fa-IR',
    publisher: { '@id': ORG_ID },
    description:
      'نرم‌افزارِ رزروِ میز و مدیریتِ رستوران با اپِ مشتری، پنلِ کسب‌وکار، لیستِ انتظار، باشگاهِ مشتریان، بازاریابی و تحلیل. دموی ۳۰ روزه‌ی رایگان.',
    featureList: [
      'رزرو آنلاین میز',
      'نقشه و مدیریت میز',
      'لیست انتظار',
      'باشگاه مشتریان و CRM',
      'کمپین بازاریابی و اتوماسیون',
      'امتیاز، کش‌بک و کارت هدیه',
      'تحلیل و گزارش عملکرد',
      'چندشعبه‌ای و سطح دسترسی کارکنان',
    ],
  };

  if (priced.length) {
    node.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'IRR',
      offerCount: priced.length,
      // تومان → ریال (واحدِ رسمیِ ISO). عدد باید با priceCurrency بخواند.
      lowPrice: Math.min(...priced.map((p) => p.price_toman)) * 10,
      highPrice: Math.max(...priced.map((p) => p.price_toman)) * 10,
      offers: priced.map((p) => ({
        '@type': 'Offer',
        name: p.name,
        price: p.price_toman * 10,
        priceCurrency: 'IRR',
        url: `${SITE}/pricing`,
        availability: 'https://schema.org/InStock',
        category: 'subscription',
        eligibleDuration: { '@type': 'QuantitativeValue', value: p.months, unitCode: 'MON' },
      })),
    };
  }

  return node;
}

/** FAQPage از پرسش‌های واقعیِ همان صفحه (نه فهرستِ عمومی). */
export function siteFaqJsonLd(faqs: SiteFaq[]): object | null {
  if (!faqs.length) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/** BlogPosting برای صفحه‌ی مقاله. */
export function articleJsonLd(article: SiteArticle, pageUrl: string): object {
  const node: Record<string, unknown> = {
    '@type': 'BlogPosting',
    '@id': `${pageUrl}#article`,
    headline: article.title,
    description: article.excerpt,
    url: pageUrl,
    inLanguage: 'fa-IR',
    mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
    author: { '@type': 'Organization', name: article.author_name, url: `${SITE}/about` },
    publisher: { '@id': ORG_ID },
    isAccessibleForFree: true,
    wordCount: article.body.replace(/\s+/g, ' ').trim().split(' ').length,
  };
  if (article.published_at) node.datePublished = article.published_at;
  node.dateModified = article.updated_at ?? article.published_at ?? undefined;
  if (article.tags.length) node.keywords = article.tags.join(', ');
  if (article.cover_url) node.image = [article.cover_url];
  return node;
}

/** فهرستِ مقاله‌ها (صفحه‌ی بلاگ) — Blog + ItemList. */
export function blogJsonLd(articles: SiteArticle[], pageUrl: string): object {
  return {
    '@type': 'Blog',
    '@id': `${pageUrl}#blog`,
    url: pageUrl,
    name: `بلاگ ${BRAND_NAME}`,
    inLanguage: 'fa-IR',
    publisher: { '@id': ORG_ID },
    blogPost: articles.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      description: a.excerpt,
      url: `${SITE}/blog/${encodeURIComponent(a.slug)}`,
      datePublished: a.published_at ?? undefined,
    })),
  };
}

export interface Crumb { name: string; path: string }

/** مسیرِ راهنما — همیشه از ریشه شروع می‌شود. */
export function breadcrumbJsonLd(crumbs: Crumb[]): object {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: BRAND_NAME, item: `${SITE}/` }].concat(
      crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: c.name,
        item: `${SITE}${c.path}`,
      })),
    ),
  };
}

/** صفحه‌ی معمولی (WebPage) که به سازمان و وب‌سایت وصل است. */
export function webPageJsonLd(opts: { name: string; description?: string | null; pageUrl: string }): object {
  const node: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${opts.pageUrl}#webpage`,
    url: opts.pageUrl,
    name: opts.name,
    inLanguage: 'fa-IR',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
  };
  if (opts.description) node.description = opts.description;
  return node;
}

/** بسته‌بندیِ نهایی: یک @graph به‌ازای هر صفحه (نه چند اسکریپتِ پراکنده). */
export function graph(nodes: (object | null | undefined)[]): object {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}
