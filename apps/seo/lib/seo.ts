// ═══════════════════════════════════════════════════════════════════════
//  ساختِ Metadata — یک جا، تا هیچ صفحه‌ای بدونِ canonical/OG/Twitter نماند.
//
//  هر صفحه فقط عنوان/توضیح/مسیر می‌دهد؛ بقیه (canonical، hreflang، Open Graph،
//  Twitter Card، robots) اینجا یکدست ساخته می‌شوند.
// ═══════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next';
import { SITE, alternates } from './i18n';
import { BRAND_NAME } from './site-schema';
import type { SiteSeo } from './content-types';

export interface PageSeoInput {
  title: string;
  description: string;
  path: string;                 // با «/» شروع می‌شود
  keywords?: string[];
  image?: string | null;        // آدرسِ کاملِ تصویرِ اشتراک‌گذاری
  noindex?: boolean;
  type?: 'website' | 'article';
  publishedTime?: string | null;
  modifiedTime?: string | null;
  tags?: string[];
}

/** تصویرِ پیش‌فرضِ اشتراک‌گذاری — از روتِ opengraph-image ساخته می‌شود. */
function defaultImage(path: string): string {
  return `${SITE}${path === '/' ? '' : path}/opengraph-image`;
}

export function buildMetadata(input: PageSeoInput): Metadata {
  const url = `${SITE}${input.path}`;
  const image = input.image ?? defaultImage(input.path);

  const meta: Metadata = {
    title: input.title,
    description: input.description,
    alternates: alternates(input.path),
    keywords: input.keywords?.length ? input.keywords : undefined,
    robots: input.noindex
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
        },
    openGraph: {
      type: input.type ?? 'website',
      url,
      siteName: BRAND_NAME,
      locale: 'fa_IR',
      title: input.title,
      description: input.description,
      images: [{ url: image, width: 1200, height: 630, alt: input.title }],
      ...(input.type === 'article'
        ? {
            publishedTime: input.publishedTime ?? undefined,
            modifiedTime: input.modifiedTime ?? undefined,
            tags: input.tags,
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [image],
    },
  };

  return meta;
}

/**
 * متادیتای صفحه‌ای که محتوایش از CMS می‌آید. فیلدهای سئوی صفحه بر عنوان/توضیحِ
 * پیش‌فرض غالب‌اند — یعنی ویرایشِ سئو در استودیو واقعاً روی تگ‌ها اثر می‌گذارد.
 */
export function metadataFromCms(
  seo: SiteSeo | undefined,
  fallbackTitle: string,
  fallbackDescription: string,
  path: string,
): Metadata {
  return buildMetadata({
    title: seo?.title || fallbackTitle,
    description: seo?.description || fallbackDescription,
    path,
    keywords: seo?.keywords,
    image: seo?.og_image || null,
    noindex: seo?.noindex ?? false,
  });
}
