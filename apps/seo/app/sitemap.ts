import type { MetadataRoute } from 'next';
import { getSitemapData } from '@/lib/site-api';
import { SITE } from '@/lib/i18n';

// ═══════════════════════════════════════════════════════════════════════
//  sitemap.xml پویا — صفحاتِ ثابتِ بازاریابی + محتوای CMS + صفحاتِ رستوران
//
//  force-dynamic تا دادهٔ زنده خوانده شود (نه نسخه‌ی خالیِ زمانِ build)؛ کشِ
//  یک‌ساعته‌ی fetch بارِ API را می‌گیرد. نبودِ API → فقط صفحاتِ ثابت (سایت
//  همچنان یک sitemap معتبر دارد، نه خطای ۵۰۰).
//
//  صفحاتِ noindex (مثلِ /order و /studio) عمداً اینجا نیستند: sitemap و
//  متاتگِ robots نباید سیگنالِ متناقض بدهند.
// ═══════════════════════════════════════════════════════════════════════
export const dynamic = 'force-dynamic';

interface StaticEntry { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }

const STATIC_PAGES: StaticEntry[] = [
  { path: '/', priority: 1.0, freq: 'daily' },
  { path: '/product', priority: 0.9, freq: 'weekly' },
  { path: '/pricing', priority: 0.95, freq: 'weekly' },
  { path: '/demo', priority: 0.95, freq: 'weekly' },
  { path: '/business-app', priority: 0.9, freq: 'weekly' },
  { path: '/customer-app', priority: 0.85, freq: 'weekly' },
  { path: '/features', priority: 0.85, freq: 'weekly' },
  { path: '/how-it-works', priority: 0.8, freq: 'monthly' },
  { path: '/blog', priority: 0.8, freq: 'daily' },
  { path: '/faq', priority: 0.75, freq: 'monthly' },
  { path: '/changelog', priority: 0.6, freq: 'weekly' },
  { path: '/about', priority: 0.6, freq: 'monthly' },
  { path: '/contact', priority: 0.7, freq: 'monthly' },
  { path: '/login', priority: 0.4, freq: 'yearly' },
  { path: '/terms', priority: 0.3, freq: 'yearly' },
  { path: '/privacy', priority: 0.3, freq: 'yearly' },
];

// صفحاتی که مسیرِ اختصاصیِ خودشان را در app/ دارند و نباید از رکوردِ CMS دوباره
// اضافه شوند (وگرنه در sitemap تکراری می‌شوند).
const OWNED_PATHS = new Set(STATIC_PAGES.map((p) => p.path.replace(/^\//, '') || 'home'));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await getSitemapData();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
    url: `${SITE}${p.path}`,
    lastModified: now,
    changeFrequency: p.freq,
    priority: p.priority,
  }));

  for (const a of data.articles) {
    entries.push({
      url: `${SITE}/blog/${encodeURIComponent(a.slug)}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : undefined,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // صفحه‌ی محتوایی‌ای که مدیر در استودیو ساخته و مسیرِ اختصاصی ندارد.
  for (const p of data.pages) {
    if (OWNED_PATHS.has(p.slug)) continue;
    entries.push({
      url: `${SITE}/${encodeURIComponent(p.slug)}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  for (const r of data.restaurants) {
    entries.push({
      url: `${SITE}/r/${encodeURIComponent(r.slug)}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }
  for (const city of data.cities) {
    entries.push({ url: `${SITE}/city/${encodeURIComponent(city)}`, changeFrequency: 'daily', priority: 0.7 });
  }
  for (const cuisine of data.cuisines) {
    entries.push({ url: `${SITE}/cuisine/${encodeURIComponent(cuisine)}`, changeFrequency: 'weekly', priority: 0.6 });
  }

  return entries;
}
