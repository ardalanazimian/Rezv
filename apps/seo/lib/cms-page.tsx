// ═══════════════════════════════════════════════════════════════════════
//  رندرِ صفحه‌ی CMS — یک مسیرِ مشترک برای همه‌ی صفحه‌های محتوایی
//
//  هر صفحه‌ی بازاریابی فقط اسلاگش را می‌دهد؛ این ماژول:
//    ۱) صفحه را از CMS می‌گیرد (با حالتِ امن)
//    ۲) فقط دیتای زنده‌ای را می‌کشد که بلوک‌های همان صفحه واقعاً لازم دارند
//    ۳) JSON-LD متناسب می‌سازد (WebPage + Breadcrumb + FAQ/Product در صورتِ وجود)
//
//  نتیجه: افزودنِ صفحه‌ی تازه از استودیو، یعنی یک فایلِ ۵ خطی در app/.
// ═══════════════════════════════════════════════════════════════════════
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { SectionRenderer, hasBlock, faqScopesOf, type SectionData } from '@/components/sections/Blocks';
import { getPage, getPlans, getFaqs, getTestimonials } from './site-api';
import { metadataFromCms } from './seo';
import { SITE } from './i18n';
import {
  graph, webPageJsonLd, breadcrumbJsonLd, siteFaqJsonLd, softwareApplicationJsonLd, type Crumb,
} from './site-schema';
import type { SiteFaq } from './content-types';

export interface CmsPageOptions {
  slug: string;
  path: string;
  /** عنوان/توضیحِ پشتیبان وقتی فیلدهای سئوی CMS خالی‌اند. */
  fallbackTitle: string;
  fallbackDescription: string;
  crumbs: Crumb[];
}

export async function cmsMetadata(opts: CmsPageOptions): Promise<Metadata> {
  const page = await getPage(opts.slug);
  return metadataFromCms(page.seo, opts.fallbackTitle, opts.fallbackDescription, opts.path);
}

export async function CmsPage({ slug, path, crumbs }: CmsPageOptions) {
  const page = await getPage(slug);
  // صفحه‌ای که نه در CMS هست و نه در حالتِ امن → ۴۰۴ واقعی (نه صفحه‌ی خالی).
  if (!page.sections.length) notFound();

  const needsPlans = hasBlock(page.sections, 'pricing');
  const needsTestimonials = hasBlock(page.sections, 'testimonials');
  const scopes = faqScopesOf(page.sections);

  const [plans, testimonials, faqGroups] = await Promise.all([
    needsPlans ? getPlans() : Promise.resolve([]),
    needsTestimonials ? getTestimonials() : Promise.resolve([]),
    Promise.all(scopes.map((scope) => getFaqs(scope))),
  ]);

  // پرسش‌های همه‌ی بلوک‌های faq — بدونِ تکرار (اگر دو بلوک یک scope داشتند).
  const faqs: SiteFaq[] = [];
  const seenIds = new Set<string>();
  for (const group of faqGroups) {
    for (const f of group) {
      if (seenIds.has(f.id)) continue;
      seenIds.add(f.id);
      faqs.push(f);
    }
  }

  const data: SectionData = { plans, faqs, testimonials };
  const pageUrl = `${SITE}${path}`;

  const nodes: (object | null)[] = [
    webPageJsonLd({ name: page.seo.title || page.title, description: page.seo.description, pageUrl }),
    breadcrumbJsonLd(crumbs),
  ];
  // FAQPage فقط وقتی که پرسش‌ها واقعاً روی همین صفحه رندر شده‌اند.
  if (faqs.length) nodes.push(siteFaqJsonLd(faqs));
  if (plans.length) nodes.push(softwareApplicationJsonLd(plans));
  // JSON-LD دستیِ استودیو (اگر مدیر چیزی اضافه کرده باشد) هم به گراف می‌آید.
  if (page.seo.structured_data && typeof page.seo.structured_data === 'object') {
    nodes.push(page.seo.structured_data as object);
  }

  return (
    <>
      <JsonLd data={graph(nodes)} id={`page-${slug}`} />
      <SectionRenderer sections={page.sections} data={data} />
    </>
  );
}
