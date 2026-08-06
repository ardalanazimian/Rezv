// ═══════════════════════════════════════════════════════════════════════
//  Photo — تنها راهِ گذاشتنِ عکس روی سایت
//
//  پیش از این هیچ زیرساختی برای عکس نبود: نه next/image جایی استفاده شده
//  بود، نه بلوکی که عکس بپذیرد. یعنی حتی اگر عکسِ خوب داشتیم، جایی برای
//  گذاشتنش نبود. این کامپوننت آن شکاف را پر می‌کند.
//
//  چهار تصمیم که عکاسیِ متفرقه را به یک سیستمِ واحد تبدیل می‌کند:
//
//  ۱) نسبتِ ابعاد اجباری است. بدونِ آن، هر عکس ارتفاعِ خودش را تحمیل می‌کند
//     و چیدمان با هر عکسِ تازه می‌پرد (و CLS می‌گیرد).
//  ۲) نقطه‌ی کانونی. برشِ وسط، سرِ آدم‌ها و بشقاب را می‌بُرد. focal روی
//     object-position می‌نشیند تا سوژه هرگز قربانیِ برش نشود.
//  ۳) گریدِ برند. یک لایه‌ی گرمِ خیلی ملایم روی همه‌ی عکس‌ها می‌نشیند تا
//     عکس‌هایی که در نور و دوربینِ متفاوت گرفته شده‌اند مثلِ یک مجموعه
//     دیده شوند. این همان کاری است که تیمِ هنریِ یک برند انجام می‌دهد.
//  ۴) حالتِ خالیِ صادق. تا وقتی عکسِ واقعی نیامده، جای عکس با برچسبِ روشن
//     نشان داده می‌شود — نه یک قابِ شکسته و نه یک تصویرِ ساختگی که وانمود
//     کند عکسِ واقعی است.
// ═══════════════════════════════════════════════════════════════════════

import NextImage from 'next/image';

export interface PhotoData {
  src: string;
  /** متنِ جایگزین. برای عکسِ صرفاً تزئینی رشته‌ی خالی بگذارید. */
  alt: string;
  width?: number;
  height?: number;
  /** نقطه‌ی کانونی برای برش، مثلِ '50% 30%' */
  focal?: string;
  caption?: string;
  credit?: string;
}

export type PhotoRatio = 'wide' | 'ultra' | 'square' | 'portrait' | 'classic';

const RATIO: Record<PhotoRatio, string> = {
  ultra: '21 / 9',
  wide: '16 / 9',
  classic: '4 / 3',
  square: '1 / 1',
  portrait: '3 / 4',
};

/** خواندنِ امنِ عکس از محتوای CMS — نبودِ src یعنی عکسی نیست. */
export function photo(v: unknown): PhotoData | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const src = typeof o.src === 'string' ? o.src.trim() : '';
  if (!src) return null;
  return {
    src,
    alt: typeof o.alt === 'string' ? o.alt : '',
    width: typeof o.width === 'number' ? o.width : undefined,
    height: typeof o.height === 'number' ? o.height : undefined,
    focal: typeof o.focal === 'string' ? o.focal : undefined,
    caption: typeof o.caption === 'string' ? o.caption : undefined,
    credit: typeof o.credit === 'string' ? o.credit : undefined,
  };
}

export function Photo({
  data,
  ratio = 'wide',
  priority = false,
  sizes = '100vw',
  grade = true,
  className,
  placeholderLabel = 'جای عکس',
}: {
  data: PhotoData | null;
  ratio?: PhotoRatio;
  /** فقط برای عکسِ بالای صفحه. بیش از یکی در هر صفحه، LCP را بدتر می‌کند. */
  priority?: boolean;
  sizes?: string;
  grade?: boolean;
  className?: string;
  placeholderLabel?: string;
}) {
  const style = { aspectRatio: RATIO[ratio] } as React.CSSProperties;

  if (!data) {
    return (
      <div className={`ph ph--empty${className ? ` ${className}` : ''}`} style={style}>
        <span className="ph__label">{placeholderLabel}</span>
      </div>
    );
  }

  return (
    <figure className={`ph${grade ? ' ph--grade' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <NextImage
        src={data.src}
        alt={data.alt}
        fill
        sizes={sizes}
        priority={priority}
        // عکسِ زیرِ خطِ تا نباید در بارگذاریِ اول رقابت کند
        loading={priority ? undefined : 'lazy'}
        style={data.focal ? { objectPosition: data.focal } : undefined}
      />
      {(data.caption || data.credit) && (
        <figcaption className="ph__cap">
          {data.caption}
          {data.credit && <span className="ph__credit">{data.credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}
