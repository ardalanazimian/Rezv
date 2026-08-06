import type { Metadata } from 'next';
import { Studio } from '@/components/studio/Studio';
import { buildMetadata } from '@/lib/seo';

// استودیوی محتوا — پشتِ احرازِ هویتِ مدیرِ پلتفرم.
//
// noindex + robots disallow: این صفحه محتوای عمومی ندارد و نباید در نتایجِ
// جست‌وجو ظاهر شود. خودِ دسترسی هم سمتِ سرور کنترل می‌شود (هر فراخوانِ API
// توکنِ مدیر می‌خواهد)، نه فقط با پنهان‌کردنِ رابط.
export const metadata: Metadata = buildMetadata({
  title: 'استودیوی محتوا',
  description: 'مدیریتِ محتوای وب‌سایتِ رزرونو.',
  path: '/studio',
  noindex: true,
});

export const dynamic = 'force-dynamic';

export default function StudioPage() {
  return <Studio />;
}
