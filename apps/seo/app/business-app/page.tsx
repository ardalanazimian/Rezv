import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';

// صفحه‌ی محتوایی — متن، ترتیبِ بلوک‌ها و فیلدهای سئو همه از استودیو می‌آیند.
const OPTS: CmsPageOptions = {
  slug: 'business-app',
  path: '/business-app',
  fallbackTitle: 'پنل کسب‌وکار رزرونو | مدیریت رزرو، میز، CRM و تحلیل',
  fallbackDescription: 'پنلِ کسب‌وکارِ رزرونو: مدیریتِ رزرو و میز، لیستِ انتظار، باشگاهِ مشتریان، کمپین، وفاداری، تحلیل و چندشعبه.',
  crumbs: [{ name: 'اپ کسب‌وکار', path: '/business-app' }],
};

export const revalidate = 300;
export const generateMetadata = () => cmsMetadata(OPTS);
export default function Page() { return <CmsPage {...OPTS} />; }
