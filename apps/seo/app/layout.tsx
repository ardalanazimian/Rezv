import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { alternates } from '@/lib/i18n';
import { organizationJsonLd } from '@/lib/schema';
import { SITE } from '@/lib/urls';
import './globals.css';

// اپِ عمومیِ SEO رزرونو — لِی‌اوتِ ریشه. RTL/فارسی، مطابقِ برندِ رزرونو.
export const metadata: Metadata = {
  // ⚠️ ۲۰۲۶-۰۹-۱۸: این و openGraph.url پایین، دو کپیِ ثابتِ باقی‌مانده از جاروی ۰۹-۰۸
  // بودند. metadataBase پایه‌ی **canonicalِ هر صفحه‌ی این اپ** است، پس با مقدارِ ثابت
  // هر استقرارِ غیرِتولید canonicalِ دامنه‌ی تولید را اعلام می‌کرد — یعنی گیتِ لایه‌ی وب
  // روی staging به دلیلِ باگِ ما قرمز می‌شد، نه به دلیلِ محیط.
  metadataBase: new URL(SITE),
  title: {
    default: 'رزرونو | رزرو آنلاین بهترین رستوران‌های شهر',
    template: '%s | رزرونو',
  },
  description:
    'رزرونو — کشف و رزرو آنلاین میز در بهترین رستوران‌های شهر. رستوران‌ها بر اساس شهر، آشپزی و حال‌وهوا.',
  keywords: ['رزرو آنلاین', 'رستوران', 'تهران', 'آشپزی', 'میز رزرو'],
  alternates: alternates('/'),
  openGraph: {
    type: 'website',
    siteName: 'رزرونو',
    locale: 'fa_IR',
    title: 'رزرونو | رزرو آنلاین بهترین رستوران‌های شهر',
    description:
      'رزرونو — کشف و رزرو آنلاین میز در بهترین رستوران‌های شهر. رستوران‌ها بر اساس شهر، آشپزی و حال‌وهوا.',
    url: SITE,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'رزرونو | رزرو آنلاین بهترین رستوران‌های شهر',
    description:
      'رزرونو — کشف و رزرو آنلاین میز در بهترین رستوران‌های شهر. رستوران‌ها بر اساس شهر، آشپزی و حال‌وهوا.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* فونتِ self-hosted زودتر شروع شود — روی موبایلِ سرِ میز مهم است.
            فونت و صفحه هم‌ریشه‌اند، ولی preloadِ فونت طبقِ مشخصات همیشه
            CORS-mode است، پس crossOrigin لازم است وگرنه مرورگر دوباره
            دانلودش می‌کند و preload بی‌اثر (و هشدارِ کنسول) می‌شود. */}
        <link rel="preload" href="/fonts/vazirmatn-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
        {children}
      </body>
    </html>
  );
}
