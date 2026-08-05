import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';

// صفحه‌ی محتوایی — متن، ترتیبِ بلوک‌ها و فیلدهای سئو همه از استودیو می‌آیند.
const OPTS: CmsPageOptions = {
  slug: 'how-it-works',
  path: '/how-it-works',
  fallbackTitle: 'رزرونو چطور کار می‌کند؟ | از رزرو مهمان تا گزارش مدیریت',
  fallbackDescription: 'مسیرِ کاملِ کار در رزرونو: از جست‌وجو و رزروِ مهمان تا عملیاتِ سالن و گزارشِ مدیریت.',
  crumbs: [{ name: 'چطور کار می‌کند', path: '/how-it-works' }],
};

export const revalidate = 300;
export const generateMetadata = () => cmsMetadata(OPTS);
export default function Page() { return <CmsPage {...OPTS} />; }
