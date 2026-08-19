// ساختِ JSON-LD (schema.org) از دادهٔ واقعیِ رستوران — تابعِ خالص و قابل‌تست.
// فقط فیلدهایی که داده دارند emit می‌شوند (بدونِ null/خالی → schemaِ معتبر).
import type { MenuItem, RestaurantDetail, RestaurantListItem } from './api';

const SITE = 'https://rezervno.ir';

export function organizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE}/#organization`,
        name: 'رزرونو',
        url: SITE,
        logo: `${SITE}/logo.png`,
        description: 'پلتفرم رزرو آنلاین میز در بهترین رستوران‌های ایران با تمرکز بر تجربه‌ی مشتری و مدیریت رستوران.',
        sameAs: ['https://www.instagram.com/rezervno', 'https://www.linkedin.com/company/rezervno'],
        areaServed: 'IR',
        availableLanguage: ['fa', 'en'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        name: 'رزرونو',
        url: SITE,
        inLanguage: 'fa-IR',
        description: 'کشف و رزرو آنلاین میز در رستوران‌های برتر شهر با جست‌وجوی سریع و تجربه‌ی موبایل‌محور.',
        publisher: { '@id': `${SITE}/#organization` },
      },
    ],
  };
}

/**
 * JSON-LD برای صفحاتِ لیست (شهر/آشپزی): CollectionPage + ItemList + BreadcrumbList.
 * items با ترتیب در ItemList قرار می‌گیرند و هرکدام به صفحه‌ی رستوران لینک می‌شوند.
 */
export function listJsonLd(opts: {
  name: string;
  pageUrl: string;
  items: RestaurantListItem[];
  crumbCity?: string;
}): object {
  const collection = {
    '@type': 'CollectionPage',
    '@id': `${opts.pageUrl}#collection`,
    name: opts.name,
    url: opts.pageUrl,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/r/${encodeURIComponent(r.slug)}`,
        name: r.name,
      })),
    },
  };

  const crumbs: object[] = [{ '@type': 'ListItem', position: 1, name: 'رزرونو', item: `${SITE}/` }];
  crumbs.push({ '@type': 'ListItem', position: 2, name: opts.name, item: opts.pageUrl });

  return {
    '@context': 'https://schema.org',
    '@graph': [collection, { '@type': 'BreadcrumbList', itemListElement: crumbs }],
  };
}

export interface FaqItem { q: string; a: string; }

/** JSON-LD برای بخشِ پرسش‌های متداول (schema.org FAQPage) — از پاسخ‌های factual. */
export function faqJsonLd(items: FaqItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/**
 * مبلغِ تومان → ریال، ارزی که در ISO 4217 با کدِ IRR ثبت شده.
 *
 * ⚠️ باگِ واقعیِ رفع‌شده (۲۰۲۶-۰۸-۱۹): قبلاً `price_toman` مستقیم با
 * `priceCurrency: 'IRR'` منتشر می‌شد. تومان واحدِ رسمی نیست — ۱ تومان = ۱۰
 * ریال — پس هر قیمتی در JSON-LD **یک‌دهمِ** مقدارِ واقعی اعلام می‌شد. یعنی
 * چلوکبابِ ۱۸۵٬۰۰۰ تومانی به گوگل «۱۸۵٬۰۰۰ ریال» (≈۱۸٬۵۰۰ تومان) معرفی
 * می‌شد. دادهٔ ساختاریافته‌ی غلط بدترین نوعِ غلط است: خودش را درست جا می‌زند.
 */
export function tomanToRial(priceToman: number): number {
  return priceToman * 10;
}

/**
 * schema.org Menu با بخش‌بندیِ واقعی بر اساسِ `category` هر آیتم.
 *
 * قبلاً همه‌ی آیتم‌ها در **یک** MenuSectionِ بی‌نام ریخته می‌شدند، حتی وقتی
 * رستوران‌دار دسته‌بندی کرده بود — پس ساختاری که در پنل ساخته شده بود به
 * خزنده نمی‌رسید. آیتم‌هایِ بدونِ دسته در یک بخشِ بی‌نام می‌مانند (نه یک
 * نامِ ساختگیِ «سایر»).
 */
export function menuJsonLd(items: MenuItem[], menuId: string): object {
  const sections = new Map<string, MenuItem[]>();
  for (const m of items) {
    const key = m.category || '';
    const list = sections.get(key);
    if (list) list.push(m); else sections.set(key, [m]);
  }

  const hasMenuSection = [...sections.entries()].map(([name, list]) => {
    const section: Record<string, unknown> = {
      '@type': 'MenuSection',
      hasMenuItem: list.map((m) => {
        const item: Record<string, unknown> = {
          '@type': 'MenuItem',
          name: m.name,
          offers: { '@type': 'Offer', price: tomanToRial(m.price_toman), priceCurrency: 'IRR' },
        };
        // فقط وقتی رستوران‌دار واقعاً پرشان کرده — نه رشته‌ی خالی.
        if (m.description) item.description = m.description;
        if (m.image_url) item.image = m.image_url;
        return item;
      }),
    };
    if (name) section.name = name;
    return section;
  });

  return { '@type': 'Menu', '@id': menuId, hasMenuSection };
}

/** price_band (۱..۴) → رشته‌ی priceRange به‌سبکِ schema.org. */
function priceRange(band: number): string {
  const n = Math.min(4, Math.max(1, band || 2));
  return '$'.repeat(n);
}

/**
 * @graph شاملِ Restaurant (+ PostalAddress/GeoCoordinates/AggregateRating/Menu) و
 * BreadcrumbList. pageUrl آدرسِ کاملِ همین صفحه است (canonical).
 */
export function restaurantJsonLd(r: RestaurantDetail, pageUrl: string): object {
  const restaurant: Record<string, unknown> = {
    '@type': 'Restaurant',
    '@id': `${pageUrl}#restaurant`,
    name: r.name,
    url: pageUrl,
  };

  if (r.cuisine) restaurant.servesCuisine = r.cuisine;
  restaurant.priceRange = priceRange(r.price_band);

  // آدرس (schema.org PostalAddress) — فقط اگر دستِ‌کم شهر یا آدرس باشد.
  const loc = r.location;
  if (loc.address || loc.city) {
    const addr: Record<string, unknown> = { '@type': 'PostalAddress', addressCountry: loc.country || 'IR' };
    if (loc.address) addr.streetAddress = loc.address;
    if (loc.city) addr.addressLocality = loc.city;
    if (loc.district) addr.addressRegion = loc.district;
    if (loc.postal_code) addr.postalCode = loc.postal_code;
    restaurant.address = addr;
  }

  // مختصات (GeoCoordinates) — فقط اگر هر دو موجود باشند.
  if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    restaurant.geo = { '@type': 'GeoCoordinates', latitude: loc.latitude, longitude: loc.longitude };
  }

  // امتیازِ تجمیعی — فقط اگر دستِ‌کم یک نظرِ منتشرشده باشد.
  if (r.rating != null && r.reviews_count > 0) {
    restaurant.aggregateRating = {
      '@type': 'AggregateRating', ratingValue: r.rating, reviewCount: r.reviews_count,
      bestRating: 5, worstRating: 1,
    };
  }

  // تصاویر
  if (r.photos.length) restaurant.image = r.photos.map((p) => p.url);

  // منو (schema.org Menu) — فقط اگر آیتم داشته باشد.
  if (r.menu.length) restaurant.hasMenu = menuJsonLd(r.menu, `${pageUrl}#menu`);

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'رزرونو', item: `${SITE}/` },
      ...(loc.city
        ? [{ '@type': 'ListItem', position: 2, name: loc.city, item: `${SITE}/city/${encodeURIComponent(loc.city)}` }]
        : []),
      { '@type': 'ListItem', position: loc.city ? 3 : 2, name: r.name, item: pageUrl },
    ],
  };

  return { '@context': 'https://schema.org', '@graph': [restaurant, breadcrumb] };
}
