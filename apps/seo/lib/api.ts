// کلاینتِ سمتِ سرورِ اپِ SEO برای خواندن از api/ رزرونو.
// آدرسِ API از env می‌آید (SEO_API_BASE)، مثلِ https://api.rezervno.ir — بدونِ اسلشِ انتهایی.
// این ماژول در Server Components/Route Handlers استفاده می‌شود (نه در مرورگر).

const API_BASE = (process.env.SEO_API_BASE || '').replace(/\/$/, '');

/**
 * دامنه‌ای که مرورگرِ کاربر باید فایل‌هایِ رسانه را از آن بگیرد.
 *
 * چرا جدا از `SEO_API_BASE`: آن یکی آدرسی است که *سرورِ* Next با آن به API
 * وصل می‌شود و در داکر معمولاً داخلی است (`http://api:3000`) — رندرکردنش
 * داخلِ `<img src>` یعنی مرورگرِ کاربر آدرسی می‌گیرد که اصلاً به آن نمی‌رسد.
 *
 * API آدرسِ عکس‌ها را به‌صورتِ نسبی می‌دهد (`/api/v1/media/<key>`). این
 * وقتی درست است که SEO و API پشتِ یک دامنه باشند — که پیکربندیِ هدفِ
 * تولید است (rewrite رویِ rezervno.ir). اگر روزی جدا شدند، همین متغیر
 * تنها چیزی است که باید ست شود.
 *
 * ست‌نشده = مسیرِ نسبی دست‌نخورده می‌ماند (رفتارِ هم‌دامنه).
 */
const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE || '').replace(/\/$/, '');

/**
 * آدرسِ عکس را برایِ مرورگر قابلِ‌استفاده می‌کند.
 * آدرسِ مطلق (http…) دست‌نخورده می‌ماند؛ مسیرِ نسبی فقط وقتی پیشوند
 * می‌گیرد که `NEXT_PUBLIC_MEDIA_BASE` تنظیم شده باشد.
 */
export function resolveMediaUrl(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return MEDIA_BASE ? `${MEDIA_BASE}${url.startsWith('/') ? '' : '/'}${url}` : url;
}

/**
 * یک آیتمِ منو، دقیقاً همان شکلی که API عمومی می‌دهد.
 * `category`/`description`/`image_url` می‌توانند null باشند — یعنی رستوران‌دار
 * پرشان نکرده، نه اینکه خطایی رخ داده. UI باید همان را بدونِ جاگذاریِ متنِ
 * ساختگی نشان دهد.
 */
export interface MenuItem {
  id: string;
  name: string;
  emoji: string | null;
  price_toman: number;
  category: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface RestaurantDetail {
  id: string;
  slug: string;
  name: string;
  cuisine: string | null;
  vibes: string[];
  price_band: number;
  /** لوگویِ تأییدشده (جدا از گالری). null = هنوز آپلود/تأیید نشده. */
  logo_url: string | null;
  location: {
    address: string | null;
    city: string | null;
    district: string | null;
    postal_code: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  opening_hours: unknown;
  timezone: string;
  rating: number | null;
  reviews_count: number;
  menu: MenuItem[];
  photos: { url: string; caption: string | null; category: string }[];
}

/**
 * جزئیاتِ یک رستوران را از API می‌گیرد (GET /api/v1/restaurants/{slug}).
 * برای ISR: نتیجه با revalidate کش می‌شود. نبودِ API یا 404 → null (صفحه 404 می‌دهد).
 */
export async function fetchRestaurant(slug: string, revalidateSec = 300): Promise<RestaurantDetail | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/restaurants/${encodeURIComponent(slug)}`, {
      next: { revalidate: revalidateSec },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as RestaurantDetail;
    return {
      ...d,
      menu: (d.menu || []).map((m) => ({ ...m, image_url: resolveMediaUrl(m.image_url) })),
      photos: (d.photos || []).map((p) => ({ ...p, url: resolveMediaUrl(p.url) || p.url })),
      logo_url: resolveMediaUrl(d.logo_url),
    };
  } catch {
    return null;
  }
}

export interface RestaurantListItem {
  id: string;
  slug: string;
  name: string;
  cuisine: string | null;
  city: string | null;
  vibes: string[];
  price_band?: number;
  priceBand?: number;
  rating: number | null;
  reviews_count: number;
}

/**
 * لیستِ رستوران‌ها با فیلترِ اختیاریِ شهر/آشپزی (GET /api/v1/restaurants?city=&cuisine=).
 * برای صفحاتِ /city/{c} و /cuisine/{c}. نبودِ API → آرایه‌ی خالی (صفحه گاردِ کیفیت را اعمال می‌کند).
 */
export async function fetchRestaurantList(
  filter: { city?: string; cuisine?: string },
  revalidateSec = 300,
): Promise<RestaurantListItem[]> {
  if (!API_BASE) return [];
  const qs = new URLSearchParams();
  if (filter.city) qs.set('city', filter.city);
  if (filter.cuisine) qs.set('cuisine', filter.cuisine);
  try {
    const res = await fetch(`${API_BASE}/api/v1/restaurants?${qs.toString()}`, {
      next: { revalidate: revalidateSec },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: RestaurantListItem[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

/**
 * شخصی‌سازیِ صفحه‌ی منو که رستوران‌دار در پنلِ خودش تعیین می‌کند.
 * هر فیلدِ null یعنی «انتخاب نشده» — صفحه به پیش‌فرضِ پلتفرم برمی‌گردد،
 * نه به یک مقدارِ ساختگی.
 */
export interface MenuBranding {
  /** #RRGGBB — در دیتابیس با قیدِ CHECK تضمین شده. */
  menu_accent: string | null;
  /** 'light' | 'dark' | 'auto' */
  menu_theme: string | null;
  menu_tagline: string | null;
  /** 'list' | 'grid' */
  menu_layout: string | null;
}

export interface PublicMenu {
  restaurant: {
    id: string; slug: string; name: string; cuisine: string | null; city: string | null;
  } & Partial<MenuBranding>;
  items: MenuItem[];
}

/**
 * منویِ عمومیِ یک رستوران (GET /api/v1/restaurants/{slug}/menu).
 *
 * سه نتیجه‌ی متفاوت که **نباید** با هم قاطی شوند — همان درسِ صفحه‌ی رویدادهایِ
 * اپِ مشتری که یک fallbackِ نمونه، دادهٔ ساختگی را به همه‌ی کاربران نشان می‌داد:
 *   • آبجکت با items پر  → منویِ واقعی
 *   • آبجکت با items خالی → رستوران هست ولی هنوز منو ثبت نکرده (حالتِ خالیِ صادق)
 *   • null                 → رستوران پیدا نشد یا API در دسترس نیست (۴۰۴/خطا)
 * هیچ‌کدام نباید به «منویِ نمونه» تبدیل شود.
 */
export async function fetchPublicMenu(slug: string, revalidateSec = 300): Promise<PublicMenu | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/restaurants/${encodeURIComponent(slug)}/menu`, {
      next: { revalidate: revalidateSec },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as Partial<PublicMenu>;
    if (!d.restaurant) return null;
    // عکس‌ها اینجا (یک نقطه) به آدرسِ قابلِ‌استفاده در مرورگر تبدیل می‌شوند،
    // نه در هر کامپوننتی که تصادفاً آن‌ها را رندر می‌کند.
    const items = (Array.isArray(d.items) ? d.items : []).map((m) => ({
      ...m, image_url: resolveMediaUrl(m.image_url),
    }));
    return { restaurant: d.restaurant, items };
  } catch {
    return null;
  }
}

export interface SitemapData {
  restaurants: { slug: string; updated_at: string }[];
  cities: string[];
  cuisines: string[];
}

/** دادهٔ خامِ sitemap از API (GET /api/v1/seo/sitemap). نبودِ API → خالی. */
export async function fetchSitemapData(revalidateSec = 3600): Promise<SitemapData> {
  const empty: SitemapData = { restaurants: [], cities: [], cuisines: [] };
  if (!API_BASE) return empty;
  try {
    const res = await fetch(`${API_BASE}/api/v1/seo/sitemap`, { next: { revalidate: revalidateSec } });
    if (!res.ok) return empty;
    const d = (await res.json()) as Partial<SitemapData>;
    return {
      restaurants: Array.isArray(d.restaurants) ? d.restaurants : [],
      cities: Array.isArray(d.cities) ? d.cities : [],
      cuisines: Array.isArray(d.cuisines) ? d.cuisines : [],
    };
  } catch {
    return empty;
  }
}
