import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Vazirmatn } from 'next/font/google';
import './globals.css';
import './site.css';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { AnnounceBanner } from '@/components/site/AnnounceBanner';
import { ThemeScript } from '@/components/site/ThemeToggle';
import { ScrollProgress } from '@/components/site/Motion';
import { JsonLd } from '@/components/site/JsonLd';
import { getBanner } from '@/lib/site-api';
import { alternates, SITE } from '@/lib/i18n';
import { graph, organizationJsonLd, websiteJsonLd, BRAND_NAME } from '@/lib/site-schema';

// فونتِ برند از طریقِ next/font: در زمانِ build دانلود و self-host می‌شود، پس
// در زمانِ اجرا هیچ درخواستی به دامنه‌ی بیرونی نمی‌رود (سریع‌تر + سازگار با CSP).
const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-vazirmatn',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'رزرونو | نرم‌افزارِ رزروِ میز و مدیریتِ رستوران',
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    'رزرونو پلتفرمِ رزروِ آنلاینِ میز و مدیریتِ رستوران است: اپِ مشتری برای کشف و رزرو، و پنلِ کسب‌وکار برای رزرو، میز، لیستِ انتظار، باشگاهِ مشتریان و تحلیل. دموی ۳۰ روزه‌ی رایگان.',
  applicationName: BRAND_NAME,
  authors: [{ name: BRAND_NAME, url: SITE }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  alternates: alternates('/'),
  openGraph: { type: 'website', siteName: BRAND_NAME, locale: 'fa_IR', url: `${SITE}/` },
  twitter: { card: 'summary_large_image' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  formatDetection: { telephone: false },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // رنگِ نوارِ مرورگر با تمِ فعال هماهنگ می‌شود
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#08090f' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // بنر از CMS می‌آید؛ نبودش یعنی هیچ نواری رندر نمی‌شود (نه یک جای خالی).
  const banner = await getBanner();

  return (
    // suppressHydrationWarning لازم است چون ThemeScript پیش از hydration
    // عمداً data-theme و کلاسِ js-reveal را روی <html> می‌گذارد (برای حذفِ
    // پرشِ تم). این تنها اختلافِ سرور/کلاینت است و آگاهانه ایجاد شده.
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body style={{ fontFamily: 'var(--font-vazirmatn), system-ui, sans-serif' }}>
        {/* گرافِ هویتیِ سایت — یک‌بار در ریشه، بقیه‌ی صفحه‌ها به @id آن ارجاع می‌دهند */}
        <JsonLd data={graph([organizationJsonLd(), websiteJsonLd()])} id="site-graph" />

        <a href="#main" className="skip-link">پرش به محتوای اصلی</a>
        <ScrollProgress />
        {banner && <AnnounceBanner banner={banner} />}
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
