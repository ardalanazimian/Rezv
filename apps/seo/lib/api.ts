// کلاینتِ سمتِ سرورِ اپِ SEO برای خواندن از api/ رزرونو.
// آدرسِ API از env می‌آید (SEO_API_BASE)، مثلِ https://api.rezervno.ir — بدونِ اسلشِ انتهایی.
// این ماژول در Server Components/Route Handlers استفاده می‌شود (نه در مرورگر).

const API_BASE = (process.env.SEO_API_BASE || '').replace(/\/$/, '');

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
    return (await res.json()) as RestaurantDetail;
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

export interface PublicMenu {
  restaurant: { id: string; slug: string; name: string; cuisine: string | null; city: string | null };
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
    return { restaurant: d.restaurant, items: Array.isArray(d.items) ? d.items : [] };
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
