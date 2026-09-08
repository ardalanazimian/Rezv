import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';
import { Intro } from '@/components/site/Intro';
import { HomeGate } from '@/components/site/HomeGate';

// صفحه‌ی اصلی — همان موتورِ CMS، فقط بدونِ مسیرِ راهنما (خودش ریشه است).
const OPTS: CmsPageOptions = {
  slug: 'home',
  path: '/',
  fallbackTitle: 'رزرونو | نرم‌افزارِ رزروِ میز و مدیریتِ رستوران',
  fallbackDescription:
    'رزرونو پلتفرمِ رزروِ آنلاینِ میز و مدیریتِ رستوران است: اپِ مشتری برای کشف و رزرو، و پنلِ کسب‌وکار برای رزرو، میز، لیستِ انتظار، باشگاهِ مشتریان و تحلیل. دموی ۳۰ روزه‌ی رایگان.',
  crumbs: [],
};

export const revalidate = 300;

// جلوگیری از تکرارِ نامِ برند در <title> حالا مرکزی است (lib/seo.ts · titleField)
// و شاملِ همه‌ی صفحه‌ها می‌شود، نه فقط این یکی.
export const generateMetadata = () => cmsMetadata(OPTS);

export default function HomePage() {
  // پرده فقط روی صفحه‌ی اصلی و فقط یک بار در هر نشست — صفحه‌های داخلی باید
  // بی‌درنگ باز شوند (کاربری که از گوگل به یک مقاله می‌رسد پرده نمی‌خواهد).
  return (
    <>
      <Intro />
      {/* اولین چیزی که مهمان می‌بیند: انتخابِ نقش. تصمیمِ بنیان‌گذار
          (۲۰۲۶-۰۹-۰۸): «کسی رفت توش گیج نشه و راحت بتونه به پنل کاستومر
          دسترسی پیدا کنه». محتوایِ CMS زیرِ همین می‌آید و دست‌نخورده
          می‌ماند — این بخش وابسته به CMS نیست، پس هرگز غایب نمی‌شود. */}
      <HomeGate />
      <CmsPage {...OPTS} />
    </>
  );
}
