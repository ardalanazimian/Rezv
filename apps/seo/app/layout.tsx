import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { alternates } from '@/lib/i18n';
import { organizationJsonLd } from '@/lib/schema';

// اپِ عمومیِ SEO رزرونو — لِی‌اوتِ ریشه. RTL/فارسی، مطابقِ برندِ رزرونو.
export const metadata: Metadata = {
  metadataBase: new URL('https://rezervno.ir'),
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
    url: 'https://rezervno.ir',
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
      <body style={{ fontFamily: 'Vazirmatn, system-ui, sans-serif', margin: 0 }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />
        {children}
      </body>
    </html>
  );
}
