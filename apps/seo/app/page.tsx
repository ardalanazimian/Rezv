// صفحه‌ی اصلیِ اپِ SEO (اسکلت). عمداً استاتیک است تا build بدونِ نیاز به API سبز باشد.
// صفحاتِ واقعیِ محتوایی در فازهای بعد اضافه می‌شوند: /r/{slug}، /city/{c}، /cuisine/{c}.
export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 40, textAlign: 'center', lineHeight: 1.9 }}>
      <h1>🍽️ رزرونو</h1>
      <p>لایه‌ی عمومیِ SEO — کشف و رزرو آنلاین رستوران.</p>
      <p style={{ color: '#666', fontSize: 14 }}>
        این اپ (Next.js SSR/ISR) صفحاتِ ایندکس‌پذیرِ رستوران/شهر/آشپزی را سرو می‌کند.
        اپِ رزرو/حسابِ کاربری جداست. جزئیاتِ معماری: <code>docs/adr/0001</code>.
      </p>
    </main>
  );
}

// اسکلت پایدار و کم‌تغییر؛ فعلاً استاتیک (revalidate بعد از افزودنِ صفحاتِ داده‌محور تنظیم می‌شود).
export const dynamic = 'force-static';
