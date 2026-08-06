import { notFound } from 'next/navigation';
import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';
import { getSitemapData } from '@/lib/site-api';

// ═══════════════════════════════════════════════════════════════════════
//  صفحه‌های ساخته‌شده در استودیو — بدونِ نیاز به دیپلوی
//
//  مدیر در داشبورد یک صفحه‌ی تازه می‌سازد (مثلاً «رزرو-گروهی») و همان لحظه
//  روی /رزرو-گروهی زنده می‌شود. تا پیش از این، sitemap آدرسِ چنین صفحه‌ای را
//  اعلام می‌کرد ولی هیچ مسیری رندرش نمی‌کرد — یعنی ۴۰۴ در sitemap.
//
//  چرا با مسیرهای ثابت تداخل ندارد: در Next مسیرِ ثابت بر مسیرِ پویا اولویت
//  دارد، پس /pricing همچنان به app/pricing/page.tsx می‌رود و این فقط اسلاگ‌های
//  باقی‌مانده را می‌گیرد. RESERVED یک لایه‌ی دفاعیِ دوم است: اگر مدیر اشتباهی
//  صفحه‌ای با اسلاگِ یک مسیرِ واقعی بسازد، اینجا ۴۰۴ می‌دهیم تا نسخه‌ی CMS
//  بی‌صدا جای صفحه‌ی واقعی را نگیرد.
// ═══════════════════════════════════════════════════════════════════════

// اسلاگ‌هایی که مسیرِ اختصاصیِ خودشان را دارند و نباید از اینجا رندر شوند.
const RESERVED = new Set([
  'about', 'blog', 'business-app', 'changelog', 'contact', 'customer-app',
  'demo', 'faq', 'features', 'how-it-works', 'login', 'order', 'pricing',
  'privacy', 'product', 'studio', 'terms', 'home',
]);

export const revalidate = 300;
// اسلاگی که موقعِ build وجود نداشته هم رندر می‌شود (صفحه‌ی تازه، بدونِ دیپلوی).
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const data = await getSitemapData();
    return data.pages.filter((p) => !RESERVED.has(p.slug)).map((p) => ({ slug: p.slug }));
  } catch {
    // API در دسترس نیست (مثلاً بیلدِ CI): چیزی از پیش نمی‌سازیم و همه‌چیز
    // در زمانِ درخواست رندر می‌شود. بیلد نباید به‌خاطرِ نبودِ API بشکند.
    return [];
  }
}

function optionsFor(slug: string): CmsPageOptions {
  return {
    slug,
    path: `/${slug}`,
    fallbackTitle: 'رزرونو',
    fallbackDescription: 'پلتفرمِ رزرو و رشدِ رستوران‌ها.',
    crumbs: [{ name: slug, path: `/${slug}` }],
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (RESERVED.has(slug)) return {};
  return cmsMetadata(optionsFor(decodeURIComponent(slug)));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  if (RESERVED.has(decoded)) notFound();
  return <CmsPage {...optionsFor(decoded)} />;
}
