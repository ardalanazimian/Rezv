import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';

// صفحه‌ی محتوایی — متن، ترتیبِ بلوک‌ها و فیلدهای سئو همه از استودیو می‌آیند.
const OPTS: CmsPageOptions = {
  slug: 'privacy',
  path: '/privacy',
  fallbackTitle: 'سیاست حریم خصوصی رزرونو',
  fallbackDescription: 'چه داده‌ای جمع می‌کنیم، چرا، چقدر نگه می‌داریم و شما چه حقوقی درباره‌ی دادهٔ خود دارید.',
  crumbs: [{ name: 'حریم خصوصی', path: '/privacy' }],
};

export const revalidate = 300;
export const generateMetadata = () => cmsMetadata(OPTS);
export default function Page() { return <CmsPage {...OPTS} />; }
