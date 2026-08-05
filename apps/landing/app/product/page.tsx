import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';

// صفحه‌ی محتوایی — متن، ترتیبِ بلوک‌ها و فیلدهای سئو همه از استودیو می‌آیند.
const OPTS: CmsPageOptions = {
  slug: 'product',
  path: '/product',
  fallbackTitle: 'معرفی محصول رزرونو | پلتفرم رزرو و مدیریت رستوران',
  fallbackDescription: 'نمای کاملِ پلتفرمِ رزرونو: موتورِ رزرو، عملیاتِ سالن، باشگاهِ مشتریان، بازاریابی، تحلیل و زیرساختِ چندشعبه‌ای.',
  crumbs: [{ name: 'معرفی محصول', path: '/product' }],
};

export const revalidate = 300;
export const generateMetadata = () => cmsMetadata(OPTS);
export default function Page() { return <CmsPage {...OPTS} />; }
