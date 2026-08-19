'use client';

// ⚠️ اضافه‌شده (شکاف‌سنجی لانچ، ۲۰۲۶-۰۸-۱۹): قبلاً هیچ error.tsx نبود، پس یک
// خطایِ رندرِ سمتِ کلاینت در صفحه‌یِ غیر-API (مثلاً page.tsx) صفحه‌ی خطایِ
// پیش‌فرضِ Next را نشان می‌داد. روت‌هایِ API این فایل را نمی‌بینند — خطاهایِ
// آن‌ها همیشه در همان route.ts با errorResponse() به envelope JSON تبدیل
// می‌شوند (رجوع کن به src/lib/errors.ts)؛ این فایل فقط بخشِ React (page/layout) را می‌پوشاند.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 40, textAlign: 'center', direction: 'rtl' }}>
      <h1>خطایی پیش آمد</h1>
      <p>مشکلی در نمایش این صفحه رخ داد.</p>
      <button onClick={() => reset()} style={{ padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}>
        تلاش دوباره
      </button>
    </main>
  );
}
