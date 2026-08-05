import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';

// صفحه‌ی محتوایی — متن، ترتیبِ بلوک‌ها و فیلدهای سئو همه از استودیو می‌آیند.
const OPTS: CmsPageOptions = {
  slug: 'features',
  path: '/features',
  fallbackTitle: 'امکانات رزرونو | همه‌ی قابلیت‌های پلتفرم رستوران',
  fallbackDescription: 'فهرستِ کاملِ امکاناتِ رزرونو: رزرو، میز و ظرفیت، لیستِ انتظار، باشگاهِ مشتریان، بازاریابی، تحلیل، امنیت و سئو.',
  crumbs: [{ name: 'امکانات', path: '/features' }],
};

export const revalidate = 300;
export const generateMetadata = () => cmsMetadata(OPTS);
export default function Page() { return <CmsPage {...OPTS} />; }
