// کلاینتِ سمتِ سرورِ اپِ SEO برای خواندن از api/ رزرونو.
// آدرسِ API از env می‌آید (SEO_API_BASE)، مثلِ https://api.rezervno.ir — بدونِ اسلشِ انتهایی.
// این ماژول در Server Components/Route Handlers استفاده می‌شود (نه در مرورگر).

const API_BASE = (process.env.SEO_API_BASE || '').replace(/\/$/, '');

/**
 * بالادست (api/) در دسترس نیست — شبکه، تایم‌اوت، ۵xx، یا اصلاً پیکربندی‌نشده.
 *
 * ⚠️ چرا این کلاس وجود دارد (یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۵): تا امروز همه‌ی
 * fetcherهایِ این ماژول در **هر** شکستی `null` برمی‌گرداندند — چه رستوران
 * واقعاً وجود نداشت (۴۰۴) و چه API یک لحظه قطع بود. صفحه‌ها روی همان `null`
 * `notFound()` صدا می‌زنند، پس یک قطعیِ گذرا تبدیل می‌شد به **HTTP 404 روی
 * صفحه‌ی رستورانی که واقعاً وجود دارد**.
 *
 * و چون این صفحه‌ها ISR هستند (`revalidate = 300`)، آن ۴۰۴ **کش می‌شد** و به
 * Googlebot سرو می‌شد. گوگل ۴۰۴ را «این صفحه دیگر نیست» می‌فهمد و صفحه را از
 * ایندکس بیرون می‌اندازد — یعنی یک قطعیِ چنددقیقه‌ای می‌توانست رتبه‌ی
 * ارگانیکِ صفحاتِ رستوران را از بین ببرد، که دقیقاً کلِ دلیلِ وجودِ این اپ
 * است (ADR 0001).
 *
 * پس تفکیک اجباری است:
 *   • ۴۰۴ِ واقعیِ بالادست → `null` → `notFound()` (درست است)
 *   • هر شکستِ زیرساختی   → این خطا (throw)
 *
 * ✅ راستی‌آزمایی‌شده با مستندِ خودِ Next.js (v16.2.9، «Handling uncaught
 * exceptions» در راهنمایِ ISR) — نه استنتاج:
 *   ۱. «اگر هنگامِ revalidate یا بازتولیدِ پس‌زمینه خطایی throw شود،
 *      **آخرین صفحه/دادهٔ موفق همچنان از کش سرو می‌شود** و Next در درخواستِ
 *      بعدی دوباره تلاش می‌کند.» یعنی throw در قطعیِ API نتیجه‌اش «۵۰۰ به
 *      کاربر» نیست — صفحه‌ی سالمِ قبلی سرِ جایش می‌ماند. (۵۰۰ فقط وقتی است
 *      که اصلاً نسخه‌ی کش‌شده‌ای وجود نداشته باشد.)
 *   ۲. در مقابل، مسیرِ not-found **کش می‌شود** (ورودیِ کش با `value: null` و
 *      همان `revalidate`) — یعنی ۴۰۴ِ اشتباه می‌ماند و سرو می‌شود.
 *   ۳. و همان مستند صریحاً همین کار را توصیه می‌کند: «اگر خطای سرور بود،
 *      بهتر است به‌جای return یک خطا throw کنی تا کش تا درخواستِ موفقِ بعدی
 *      به‌روز نشود.»
 */
export class UpstreamUnavailableError extends Error {
  constructor(public readonly detail: string) {
    super(`سرویسِ داده در دسترس نیست (${detail})`);
    this.name = 'UpstreamUnavailableError';
  }
}

/** پاسخِ غیر-۲xx را تفکیک می‌کند: ۴۰۴ یعنی «نیست»، بقیه یعنی «نمی‌دانیم». */
function assertNotUpstreamFailure(res: Response, what: string): void {
  if (res.status === 404) return;              // نبودِ واقعی — فراخوان null می‌گیرد
  throw new UpstreamUnavailableError(`${what} → HTTP ${res.status}`);
}

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
  // ── SPEC-A فاز ۲ (۰۷۸) — همه اختیاری تا پاسخ‌های قدیمی هم type-check شوند ──
  is_out_of_stock?: boolean;
  tags?: string[];
  modifiers?: {
    id: string; name: string; min_select: number; max_select: number;
    options: { id: string; name: string; price_delta_toman: number }[];
  }[];
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
 * برای ISR: نتیجه با revalidate کش می‌شود.
 *   • ۴۰۴ِ بالادست            → `null` (فراخوان `notFound()` می‌دهد — درست)
 *   • هر شکستِ زیرساختیِ دیگر → `UpstreamUnavailableError` (۵۰۰، کش نمی‌شود)
 */
export async function fetchRestaurant(slug: string, revalidateSec = 300): Promise<RestaurantDetail | null> {
  if (!API_BASE) throw new UpstreamUnavailableError('SEO_API_BASE تنظیم نشده');
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/restaurants/${encodeURIComponent(slug)}`, {
      next: { revalidate: revalidateSec },
    });
  } catch (e) {
    throw new UpstreamUnavailableError(`restaurants/${slug} → ${(e as Error)?.message ?? 'network'}`);
  }
  if (!res.ok) { assertNotUpstreamFailure(res, `restaurants/${slug}`); return null; }
  try {
    const d = (await res.json()) as RestaurantDetail;
    return {
      ...d,
      menu: (d.menu || []).map((m) => ({ ...m, image_url: resolveMediaUrl(m.image_url) })),
      photos: (d.photos || []).map((p) => ({ ...p, url: resolveMediaUrl(p.url) || p.url })),
      logo_url: resolveMediaUrl(d.logo_url),
    };
  } catch (e) {
    // بدنه‌ی خراب/غیر-JSON هم شکستِ زیرساخت است، نه «رستوران نیست».
    throw new UpstreamUnavailableError(`restaurants/${slug} → پاسخِ نامعتبر`);
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
  /**
   * `true` یعنی «این فهرست تصمیمِ ۴۰۴ می‌سازد» — صفحه‌ی شهر/آشپزی وقتی فهرست
   * خالی باشد `notFound()` می‌دهد. در آن حالت یک قطعیِ API **نباید** به
   * فهرستِ خالی ترجمه شود، وگرنه همان ۴۰۴ِ کش‌شده‌ی ضدِّ‌SEO تکرار می‌شود.
   * `false` (پیش‌فرض) برای مصرفِ تزئینی است — مثلِ «رستوران‌های مشابه» — که
   * نبودنش صفحه را خراب نمی‌کند و خالی‌بودن پاسخِ درستی است.
   */
  strict = false,
): Promise<RestaurantListItem[]> {
  if (!API_BASE) {
    if (strict) throw new UpstreamUnavailableError('SEO_API_BASE تنظیم نشده');
    return [];
  }
  const qs = new URLSearchParams();
  if (filter.city) qs.set('city', filter.city);
  if (filter.cuisine) qs.set('cuisine', filter.cuisine);
  const what = `restaurants?${qs.toString()}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/restaurants?${qs.toString()}`, {
      next: { revalidate: revalidateSec },
    });
  } catch (e) {
    if (strict) throw new UpstreamUnavailableError(`${what} → ${(e as Error)?.message ?? 'network'}`);
    return [];
  }
  if (!res.ok) {
    if (strict) throw new UpstreamUnavailableError(`${what} → HTTP ${res.status}`);
    return [];
  }
  try {
    const data = (await res.json()) as { items?: RestaurantListItem[] };
    return Array.isArray(data.items) ? data.items : [];
  } catch (e) {
    if (strict) throw new UpstreamUnavailableError(`${what} → پاسخِ نامعتبر`);
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
 *   • null                 → بالادست ۴۰۴ داد: این رستوران/منو واقعاً نیست
 *   • throw                → API در دسترس نیست؛ «نیست» را نمی‌دانیم، پس ادعا نمی‌کنیم
 * هیچ‌کدام نباید به «منویِ نمونه» تبدیل شود، و «نمی‌دانیم» نباید «نیست» شود.
 */
export async function fetchPublicMenu(slug: string, revalidateSec = 300): Promise<PublicMenu | null> {
  if (!API_BASE) throw new UpstreamUnavailableError('SEO_API_BASE تنظیم نشده');
  const what = `restaurants/${slug}/menu`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/restaurants/${encodeURIComponent(slug)}/menu`, {
      next: { revalidate: revalidateSec },
    });
  } catch (e) {
    throw new UpstreamUnavailableError(`${what} → ${(e as Error)?.message ?? 'network'}`);
  }
  if (!res.ok) { assertNotUpstreamFailure(res, what); return null; }
  try {
    const d = (await res.json()) as Partial<PublicMenu>;
    if (!d.restaurant) return null;
    // عکس‌ها اینجا (یک نقطه) به آدرسِ قابلِ‌استفاده در مرورگر تبدیل می‌شوند،
    // نه در هر کامپوننتی که تصادفاً آن‌ها را رندر می‌کند.
    const items = (Array.isArray(d.items) ? d.items : []).map((m) => ({
      ...m, image_url: resolveMediaUrl(m.image_url),
    }));
    return { restaurant: d.restaurant, items };
  } catch (e) {
    throw new UpstreamUnavailableError(`${what} → پاسخِ نامعتبر`);
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
