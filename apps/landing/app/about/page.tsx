import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';

// صفحه‌ی محتوایی — متن، ترتیبِ بلوک‌ها و فیلدهای سئو همه از استودیو می‌آیند.
const OPTS: CmsPageOptions = {
  slug: 'about',
  path: '/about',
  fallbackTitle: 'درباره رزرونو | تیم و مأموریت',
  fallbackDescription: 'رزرونو با یک هدف ساخته شد: رزروِ رستوران در ایران باید برای مهمان ساده و برای رستوران قابلِ اتکا باشد.',
  crumbs: [{ name: 'درباره‌ی ما', path: '/about' }],
};

export const revalidate = 300;
export const generateMetadata = () => cmsMetadata(OPTS);
export default function Page() { return <CmsPage {...OPTS} />; }
