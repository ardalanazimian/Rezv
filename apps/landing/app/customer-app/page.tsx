import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';

// صفحه‌ی محتوایی — متن، ترتیبِ بلوک‌ها و فیلدهای سئو همه از استودیو می‌آیند.
const OPTS: CmsPageOptions = {
  slug: 'customer-app',
  path: '/customer-app',
  fallbackTitle: 'اپ مشتری رزرونو | کشف رستوران و رزرو آنلاین میز',
  fallbackDescription: 'با اپِ مشتریِ رزرونو رستوران پیدا کنید، ظرفیتِ واقعیِ هر ساعت را ببینید و در چند ثانیه میز رزرو کنید.',
  crumbs: [{ name: 'اپ مشتری', path: '/customer-app' }],
};

export const revalidate = 300;
export const generateMetadata = () => cmsMetadata(OPTS);
export default function Page() { return <CmsPage {...OPTS} />; }
