// ⚠️ اضافه‌شده (شکاف‌سنجی لانچ، ۲۰۲۶-۰۸-۱۹): قبلاً هیچ not-found.tsx نبود، پس
// هر مسیرِ غیر-API که پیدا نمی‌شد صفحه‌ی پیش‌فرضِ عمومیِ Next را نشان می‌داد
// (بدون برندِ رزرونو). خودِ روت‌های API این فایل را نمی‌بینند — آن‌ها همیشه
// envelope خطایِ JSON برمی‌گردانند (رجوع کن به src/lib/errors.ts)، چون
// route.ts هر متدِ HTTP را صریح تعریف می‌کند و به‌جایِ این صفحه، ۴۰۴ عمومیِ
// Next فقط برایِ مسیرهایی که اصلاً route.ts ندارند اجرا می‌شود.
export default function NotFound() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 40, textAlign: 'center', direction: 'rtl' }}>
      <h1>۴۰۴</h1>
      <p>این مسیر پیدا نشد.</p>
      <p style={{ color: '#666', fontSize: 14 }}>مسیرِ API: <code>/api/v1</code></p>
    </main>
  );
}
