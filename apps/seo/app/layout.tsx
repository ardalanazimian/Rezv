import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { alternates } from '@/lib/i18n';

// اپِ عمومیِ SEO رزرونو — لِی‌اوتِ ریشه. RTL/فارسی، مطابقِ برندِ رزرونو.
export const metadata: Metadata = {
  metadataBase: new URL('https://rezervno.ir'),
  title: {
    default: 'رزرونو | رزرو آنلاین بهترین رستوران‌های شهر',
    template: '%s | رزرونو',
  },
  description:
    'رزرونو — کشف و رزرو آنلاین میز در بهترین رستوران‌های شهر. رستوران‌ها بر اساس شهر، آشپزی و حال‌وهوا.',
  alternates: alternates('/'),
  openGraph: { type: 'website', siteName: 'رزرونو', locale: 'fa_IR' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body style={{ fontFamily: 'Vazirmatn, system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
