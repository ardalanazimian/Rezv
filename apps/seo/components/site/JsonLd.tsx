// درجِ JSON-LD. محتوا همیشه از توابعِ سازنده‌ی خودمان می‌آید (نه ورودیِ خام)،
// ولی برای دفاع در عمق `<` هم escape می‌شود تا هیچ رشته‌ای نتواند تگِ script
// را زودتر ببندد و از سیاستِ امنیتی فرار کند.
export function JsonLd({ data, id }: { data: object; id?: string }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      id={id}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
