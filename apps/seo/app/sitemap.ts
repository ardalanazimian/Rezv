import type { MetadataRoute } from 'next';
import { fetchSitemapData } from '@/lib/api';

const SITE = 'https://rezervno.ir';

// sitemap.xml پویا از DB (رستوران/شهر/آشپزی). force-dynamic تا دادهٔ زنده خوانده شود
// (نه نسخه‌ی خالیِ زمانِ build)؛ کشِ ۱ساعته‌ی fetch در fetchSitemapData بارِ API را می‌گیرد.
// نبودِ API → فقط صفحه‌ی اصلی (بدونِ خطا). برای ۵۰k+ URL گامِ بعدی generateSitemaps است.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await fetchSitemapData();

  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'daily', priority: 1 },
  ];

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
