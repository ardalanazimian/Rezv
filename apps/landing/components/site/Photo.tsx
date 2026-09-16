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
//  ۴) عکسی که نیست، جایی هم ندارد. نسخه‌ی اول جای عکسِ نیامده را با یک قابِ
//     خاکستری و برچسب نشان می‌داد و آن را «حالتِ خالیِ صادق» می‌نامید. صادق
//     نبود: هیچ مکانیزمِ پیش‌نمایشی وجود ندارد که برچسب را فقط در استودیو
//     نگه دارد، پس همان قاب روی سایتِ زنده رندر می‌شد. ممیزیِ ۲۰۲۶-۰۸-۲۴ آن
//     را در گالری گرفت، ولی دو بلوکِ دیگرِ همان فایل جا ماندند و تا
//     ۲۰۲۶-۰۹-۱۲ صفحه‌ی اصلی جمله‌ی «عکسِ تمام‌عرضِ سالن در ساعتِ شلوغی…» را
//     به بازدیدکننده نشان می‌داد. حالا رفع در ریشه است: بدونِ src هیچ‌چیز
//     رندر نمی‌شود، و بلوکِ والد تصمیم می‌گیرد بدونِ رسانه چه شکلی باشد
//     (PhotoBlocks.tsx). تصویرِ ساختگی هم هرگز جایگزین نمی‌شود.
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
}: {
  data: PhotoData | null;
  ratio?: PhotoRatio;
  /** فقط برای عکسِ بالای صفحه. بیش از یکی در هر صفحه، LCP را بدتر می‌کند. */
  priority?: boolean;
  sizes?: string;
  grade?: boolean;
  className?: string;
}) {
  // بدونِ عکس، هیچ‌چیز — نه قاب، نه برچسب (تصمیمِ ۴ در سرآیند).
  if (!data) return null;

  const style = { aspectRatio: RATIO[ratio] } as React.CSSProperties;

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
