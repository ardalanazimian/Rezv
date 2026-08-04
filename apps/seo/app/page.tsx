import type { Metadata } from 'next';
import { CmsPage, cmsMetadata, type CmsPageOptions } from '@/lib/cms-page';

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

export async function generateMetadata(): Promise<Metadata> {
  const meta = await cmsMetadata(OPTS);
  // صفحه‌ی اصلی از قالبِ «%s | رزرونو» مستثناست تا عنوانش دوباره برندسازی نشود.
  return { ...meta, title: { absolute: (meta.title as string) ?? OPTS.fallbackTitle } };
}

export default function HomePage() {
  return <CmsPage {...OPTS} />;
}
