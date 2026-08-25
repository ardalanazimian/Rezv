export const metadata = {
  title: 'رزرونو API',
  description: 'بک‌اند پلتفرم رزرو رستوران رزرونو',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
