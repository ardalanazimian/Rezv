import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';
import { Intro } from '@/components/site/Intro';
import { ExploreHero } from '@/components/home/ExploreHero';
import { LiveScroll } from '@/components/home/LiveScroll';

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
  //
  // ترتیب (۰۹-۱۳، جهتِ «اپل + تیک‌تاک + اکسپلور»):
  //   ۱) ExploreHero — تیترِ دوصدایی و شبکه‌ی اکسپلور؛ اولین چیزی که مهمان
  //      می‌بیند خودِ محصول است و «رزرو میز» یک لمس فاصله دارد (D-006).
  //   ۲) LiveScroll — مسیرِ رزرو در گوشی، با اسکرولِ خودِ کاربر.
  //   ۳) محتوای CMS — نیمه‌ی صاحبِ رستوران. هیروی CMS این‌جا h2 است چون
  //      h1ِ صفحه تیترِ دوصدایی است؛ دکمه‌ی «برای رستوران‌ها» به همین لنگر
  //      می‌پرد. این بخش وابسته به CMS نیست، پس دو بخشِ اول هرگز غایب نمی‌شوند.
  return (
    <>
      <Intro />
      <ExploreHero />
      <LiveScroll />
      <div id="for-restaurants">
        <CmsPage {...OPTS} heroHeading="h2" />
      </div>
    </>
  );
}
