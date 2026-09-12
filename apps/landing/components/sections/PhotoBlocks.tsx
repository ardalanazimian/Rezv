// ═══════════════════════════════════════════════════════════════════════
//  بلوک‌های عکس‌محور
//
//  اینها بخش‌هایی‌اند که *با عکس* بهترین شکلِ خود را دارند. تا امروز سایت
//  هیچ‌کدام را نداشت و به همین دلیل تماماً از شکل و آیکن ساخته شده بود.
//
//  بدونِ عکس، هر بلوک صادقانه کوتاه می‌آید — نه جای عکسِ برچسب‌دار، نه
//  تصویرِ ساختگی:
//    • Scene      → نوارِ متنیِ فشرده روی زمینه‌ی برند (متن و دکمه‌اش محتوای
//                   واقعی‌اند و می‌مانند)
//    • Gallery    → اصلاً رندر نمی‌شود (جز عکس چیزی ندارد)
//    • PhotoSplit → فقط متن، تمام‌عرض
//
//  ⚠️ چرا این قاعده اینجا صریح است: ممیزیِ ۲۰۲۶-۰۸-۲۴ فقط گالری را رفع کرد و
//  دو بلوکِ دیگر تا ۲۰۲۶-۰۹-۱۲ روی صفحه‌ی اصلیِ زنده قابِ خاکستریِ «عکسِ
//  تمام‌عرضِ سالن در ساعتِ شلوغی — افقی، دستِ‌کم ۲۴۰۰px» را به بازدیدکننده
//  نشان می‌دادند. حالا خودِ Photo بدونِ src هیچ‌چیز رندر نمی‌کند و هر بلوک
//  شاخه‌ی بدونِ رسانه‌ی خودش را دارد؛ فیلدِ `placeholder` در محتوا خوانده
//  نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { Icon } from '../site/Icon';
import { Reveal } from '../site/Motion';
import { Parallax } from '../site/Kinetic';
import { Photo, photo, type PhotoData } from '../site/Photo';
import type { Section, Cta } from '@/lib/content-types';

const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const cta = (v: unknown): Cta | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const label = s(o.label);
  const href = s(o.href);
  return label && href ? { label, href } : null;
};

// ═══════════════ scene — عکسِ تمام‌عرض با متنِ روی آن ═══════════════
//
// نامِ showcase از قبل برای بلوکِ تب‌دارِ صفحه‌ی پنل گرفته شده است.
//
// پرتأثیرترین نوعِ بخش در یک لندینگ‌پیج: یک عکسِ بزرگ که فضا را می‌سازد و
// چند کلمه روی آن. عمداً محدود است — عنوان، یک جمله، یک دکمه. هر چیزِ
// بیشتری روی عکس، هم عکس را خراب می‌کند هم متن را ناخوانا.

export function Scene({ sec }: { sec: Section }) {
  const img = photo(sec.image);
  const align = s(sec.align) === 'start' ? 'start' : 'center';
  // «tall» فقط با عکس معنا دارد؛ نوارِ متنی ارتفاعش را از محتوا می‌گیرد.
  const height = img && s(sec.height) === 'tall' ? ' scene--tall' : '';
  const mode = img ? '' : ' scene--text';
  const primary = cta(sec.primary);

  return (
    <section className={`scene scene--${align}${height}${mode}`}>
      {img && (
        <>
          {/* پارالاکسِ ملایم: عکس کمی کندتر از صفحه حرکت می‌کند و همین کافی
              است تا بخش «زنده» حس شود بدونِ اینکه حواس را پرت کند. */}
          <Parallax speed={0.14} className="scene__media">
            <Photo data={img} ratio="ultra" sizes="100vw" grade={false} className="scene__img" />
          </Parallax>
          {/* پرده‌ی خوانایی: متنِ سفید روی عکسِ روشن بدونِ این ناخواناست. شدتش
              از سمتِ متن بیشتر است تا خودِ عکس زیرِ یک لایه‌ی یکنواخت دفن نشود. */}
          <span className="scene__scrim" aria-hidden="true" />
        </>
      )}

      <div className="container scene__body">
        <Reveal>
          {s(sec.eyebrow) && <span className="eyebrow eyebrow--on-photo">{s(sec.eyebrow)}</span>}
          {s(sec.title) && <h2 className="scene__title">{s(sec.title)}</h2>}
          {s(sec.subtitle) && <p className="scene__lead">{s(sec.subtitle)}</p>}
          {primary && (
            <Link href={primary.href} className="btn btn--primary btn--lg">
              {primary.label}
              <Icon name="arrowLeft" size={18} className="btn__arrow" />
            </Link>
          )}
        </Reveal>
      </div>
    </section>
  );
}

// ═══════════════ gallery — شبکه‌ی تحریریه ═══════════════
//
// شبکه‌ی یکنواختِ چهارخانه، «آلبومِ عکس» به‌نظر می‌رسد. چیدمانِ تحریریه
// (یک عکسِ بزرگ + چند کوچک‌تر) به مجموعه ریتم می‌دهد.

interface GalleryItem { image?: unknown; caption?: string }

export function Gallery({ sec }: { sec: Section }) {
  // فقط آیتم‌هایی که واقعاً عکس دارند؛ آیتمِ بدونِ src خانه‌ی خالی نمی‌سازد.
  const items = list<GalleryItem>(sec.items)
    .map((it) => ({ img: photo(it.image), caption: it.caption }))
    .filter((it): it is { img: PhotoData; caption: string | undefined } => it.img !== null);
  // ⚠️ اصلاح‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴): وقتی هیچ تصویری تعریف نشده، این بخش در
  // *سایتِ زنده* پنج جعبه‌ی خاکستریِ «جای عکس» زیرِ عنوانِ «فضا، غذا، و آدم‌ها»
  // رندر می‌کرد — روی صفحه‌ی مارکتینگِ عمومی، یک بخشِ خالیِ شکسته‌نما (مکانیزمِ
  // پیش‌نمایشِ جداگانه‌ای هم وجود ندارد که placeholder فقط در استودیو بماند).
  // حالا گالریِ بدونِ محتوا اصلاً رندر نمی‌شود — تا وقتی عکسِ واقعی اضافه شود.
  if (!items.length) return null;

  return (
    <section className="section">
      <div className="container">
        {(s(sec.eyebrow) || s(sec.title)) && (
          <Reveal className="section-head section-head--center">
            {s(sec.eyebrow) && <span className="eyebrow">{s(sec.eyebrow)}</span>}
            {s(sec.title) && <h2 className="h2">{s(sec.title)}</h2>}
            {s(sec.subtitle) && <p className="lead">{s(sec.subtitle)}</p>}
          </Reveal>
        )}

        <div className="gal">
          {items.slice(0, 5).map((it, i) => (
            <Reveal key={it.img.src} delay={i * 70} className={`gal__cell gal__cell--${i + 1}`}>
              {/* نسبت را شبکه تعیین می‌کند (grid-auto-rows)، نه خودِ عکس —
                  وگرنه خانه‌ها هم‌ارتفاع نمی‌شوند. */}
              <Photo
                data={it.img}
                ratio="square"
                sizes={i === 0 ? '(max-width: 860px) 100vw, 50vw' : '(max-width: 860px) 50vw, 25vw'}
              />
              {it.caption && <span className="gal__cap">{it.caption}</span>}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════ portrait — عکسِ کنارِ متن، با نسبتِ عمودی ═══════════════
//
// برای «داستانِ یک رستوران»: عکسِ عمودیِ آدم/فضا کنارِ متن. نسبتِ عمودی
// عمدی است — عکسِ افقیِ کنارِ متن همیشه شبیهِ بنرِ تبلیغاتی می‌شود.
// بدونِ عکس، متن تمام‌عرض می‌نشیند (psplit--text) و جای رسانه خالی نمی‌ماند.

export function PhotoSplit({ sec }: { sec: Section }) {
  const img = photo(sec.image);
  const reverse = sec.reverse === true;
  const points = list<string>(sec.points);
  const primary = cta(sec.primary);

  return (
    <section className="section">
      <div className={`container psplit${reverse ? ' psplit--reverse' : ''}${img ? '' : ' psplit--text'}`}>
        {img && (
          <Reveal className="psplit__media">
            <Photo data={img} ratio="portrait" sizes="(max-width: 900px) 100vw, 42vw" />
          </Reveal>
        )}

        <Reveal delay={img ? 110 : 0} className="psplit__body">
          {s(sec.eyebrow) && <span className="eyebrow">{s(sec.eyebrow)}</span>}
          {s(sec.title) && <h2 className="h2">{s(sec.title)}</h2>}
          {s(sec.body) && <p className="lead">{s(sec.body)}</p>}
          {points.length > 0 && (
            <ul className="split__list">
              {points.map((p) => <li key={p}><Icon name="check" size={17} />{p}</li>)}
            </ul>
          )}
          {primary && (
            <Link href={primary.href} className="btn btn--ghost">
              {primary.label}
              <Icon name="arrowLeft" size={17} className="btn__arrow" />
            </Link>
          )}
        </Reveal>
      </div>
    </section>
  );
}

export type { PhotoData };
