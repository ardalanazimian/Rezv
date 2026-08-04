import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';

// صفحه‌ی محتوایی — متن، ترتیبِ بلوک‌ها و فیلدهای سئو همه از استودیو می‌آیند.
const OPTS: CmsPageOptions = {
  slug: 'terms',
  path: '/terms',
  fallbackTitle: 'شرایط استفاده از رزرونو',
  fallbackDescription: 'شرایطِ استفاده از سرویسِ رزرونو: تعریفِ خدمات، اشتراک و پرداخت، مسئولیت‌ها و شرایطِ پایانِ همکاری.',
  crumbs: [{ name: 'شرایط استفاده', path: '/terms' }],
};

export const revalidate = 300;
export const generateMetadata = () => cmsMetadata(OPTS);
export default function Page() { return <CmsPage {...OPTS} />; }
