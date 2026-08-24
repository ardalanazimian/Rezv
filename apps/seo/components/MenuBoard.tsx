import type { MenuItem } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════════
//  نمایشِ منو — یک رندرِ واحد برایِ هر دو مصرف‌کننده:
//    • بخشِ «منو» در صفحه‌ی رستوران (/r/{slug})
//    • صفحه‌ی کاملِ منویِ QR (/r/{slug}/menu)
//
//  چرا یکی: اگر دو رندرِ جدا باشد، روزی یکی‌شان توضیح یا عکس را نشان می‌دهد
//  و دیگری نه — و آن‌که خزنده می‌بیند با آن‌که مهمان می‌بیند فرق می‌کند.
//
//  همه‌چیز HTMLِ سرورساید است: نه جاوااسکریپتِ کلاینت، نه fetchِ مرورگری.
//  متنِ منو باید در خودِ سورسِ صفحه باشد تا هم خزنده ببیند و هم مهمانی که
//  سرِ میز با دادهٔ ضعیفِ موبایل صفحه را باز می‌کند.
// ═══════════════════════════════════════════════════════════════════════

export interface MenuSection { name: string | null; items: MenuItem[] }

/** آیتم‌ها را به ترتیبِ همان آرایه (که API با sort_order مرتب کرده) دسته می‌کند. */
export function groupByCategory(items: MenuItem[]): MenuSection[] {
  const map = new Map<string, MenuItem[]>();
  for (const m of items) {
    const key = m.category || '';
    const list = map.get(key);
    if (list) list.push(m); else map.set(key, [m]);
  }
  return [...map.entries()].map(([name, list]) => ({ name: name || null, items: list }));
}

/** شناسه‌ی لنگر برایِ چیپ‌هایِ دسته — پایدار و بدونِ کاراکترِ خطرناک. */
export function sectionId(name: string | null, i: number): string {
  return `cat-${i}${name ? '' : '-x'}`;
}

const money = (t: number) => `${t.toLocaleString('fa-IR')} تومان`;

function Row({ m }: { m: MenuItem }) {
  return (
    <li className="mi">
      {m.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mi-img" src={m.image_url} alt={m.name} loading="lazy" decoding="async" width={72} height={72} />
      ) : m.emoji ? (
        <span className="mi-emoji" aria-hidden="true">{m.emoji}</span>
      ) : null}
      <div className="mi-body">
        <div className="mi-top">
          <span className="mi-name">{m.name}</span>
          <span className="mi-price">{money(m.price_toman)}</span>
        </div>
        {m.description ? <p className="mi-desc">{m.description}</p> : null}
      </div>
    </li>
  );
}

/**
 * تخته‌ی منو. `sections` از groupByCategory می‌آید.
 * وقتی هیچ دسته‌ای نام ندارد، تیترِ بخش رندر نمی‌شود (به‌جایِ ساختنِ «سایر»).
 */
export default function MenuBoard({ sections }: { sections: MenuSection[] }) {
  return (
    <>
      {sections.map((s, i) => (
        <section key={i} id={sectionId(s.name, i)} className="mcat" aria-label={s.name || 'منو'}>
          {s.name ? <h2 className="mcat-h">{s.name}</h2> : null}
          <ul className="mlist">
            {s.items.map((m) => <Row key={m.id} m={m} />)}
          </ul>
        </section>
      ))}
    </>
  );
}
