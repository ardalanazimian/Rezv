// ═══════════════════════════════════════════════════════════════════════
//  هیروی صفحه‌ی اصلی — «اکسپلور»
//
//  دستورِ مالک (۲۰۲۶-۰۹-۱۳): «از طراحیِ اپل الهام بگیر + اسکرولِ زنده‌ی
//  تیک‌تاک + اکسپلورِ اینستاگرام». این قاب هر سه را در یک جا می‌گذارد:
//
//   • اپل  → تیترِ دوصدایی، درشت و خاموش: نیمه‌ی اول جوهری، نیمه‌ی دوم
//            خاکستری. دو صدا = دو جمله‌ی حکمِ L6 (DS-010 §۴‑ب: یک جمله برای
//            مهمان، یک جمله برای صاحبِ رستوران، کنارِ هم) — و هر صدا دکمه‌ی
//            خودش را دارد. پس «درها» دیگر دو کارتِ جدا نیستند.
//   • اینستاگرام → شبکه‌ی لبه‌به‌لبه با فاصله‌ی ۲px و یک کاشیِ ۲×۲، دقیقاً
//            ریتمِ صفحه‌ی Explore. روی موبایل ۳ ستون × ۴ ردیف، روی دسکتاپ
//            ۶ × ۲ — همان ۹ کاشی، بدونِ حفره (grid-auto-flow: dense).
//   • تیک‌تاک → کاشیِ ۲×۲ یک «ریل» است: سه صفحه‌ی عمودی که با اسکرولِ صفحه
//            ورق می‌خورند (animation-timeline: scroll). پیش‌نمایشِ بخشِ بعد.
//
//  چرا کاشی‌ها تایپوگرافی‌اند نه عکس یا ایموجی: سایت هیچ عکسی ندارد و
//  ایموجی روی هر سیستم‌عامل شکلِ دیگری دارد (روی ویندوز تخت و کارتونی دیده
//  شد — اسکرین‌شاتِ ۰۹-۱۳). نامِ غذا با وزنِ ۹۰۰ در گوشه‌ی کاشی همان کارِ
//  عکس را می‌کند: می‌گوید این‌جا چه می‌خوری — و در همه‌ی دستگاه‌ها یکسان
//  است. اندازه‌اش از طولِ واژه می‌آید تا هیچ واژه‌ای بریده نشود.
//
//  صداقت (همان قاعده‌ی ExploreMosaicِ قبلی): روی هیچ کاشی نامِ رستوران،
//  امتیاز یا شمارشِ رزرو نیست. فقط واژگانِ رابطِ واقعیِ اپ: نوعِ غذا،
//  حال‌وهوا، ساعتِ رزرو.
//
//  کلِ شبکه یک پیوند به اپِ مشتری است (D-006)؛ کاشی‌ها aria-hidden‌اند و
//  معنای پیوند در برچسبش است.
// ═══════════════════════════════════════════════════════════════════════

import { appBase } from '@/lib/i18n';

type Dish = 'saffron' | 'pomegranate' | 'pistachio' | 'turquoise' | 'rosewater' | 'eggplant' | 'charcoal' | 'tea';

interface Tile {
  dish: Dish;
  /** واژه‌ی درشت — نوعِ غذا، حال‌وهوا یا ساعت */
  word: string;
  /** برچسبِ کوچکِ گوشه */
  tag: string;
  /** واژه‌ی عددی (ساعت) چپ‌به‌راست نوشته می‌شود */
  numeric?: boolean;
}

/** ترتیب = ترتیبِ جریانِ شبکه. ریل بعد از سه کاشیِ اول می‌آید تا روی موبایل
 *  ردیفِ ۲ و ۳ را بگیرد و روی دسکتاپ ستون‌های ۴–۵. */
const BEFORE: Tile[] = [
  { dish: 'saffron', word: 'کباب', tag: 'ایرانی' },
  { dish: 'turquoise', word: 'سوشی', tag: 'ژاپنی' },
  { dish: 'charcoal', word: '۲۰:۳۰', tag: 'امشب، دو نفر', numeric: true },
];
const AFTER: Tile[] = [
  { dish: 'pistachio', word: 'سالاد', tag: 'سبک' },
  { dish: 'rosewater', word: 'دسر', tag: 'بعد از شام' },
  { dish: 'pomegranate', word: 'استیک', tag: 'مناسبت' },
  { dish: 'tea', word: 'دنج', tag: 'برای دو نفر' },
  { dish: 'eggplant', word: 'روف‌تاپ', tag: 'با ویو' },
];

const REEL: { dish: Dish; word: string }[] = [
  { dish: 'tea', word: 'دیزی' },
  { dish: 'pomegranate', word: 'پیتزا' },
  { dish: 'saffron', word: 'جوجه' },
];

/** طولِ دیداریِ واژه — نیم‌فاصله (ZWNJ) حرف نیست. */
const visibleLength = (w: string) => w.replace(/\u200c/g, '').length;

function TileView({ t }: { t: Tile }) {
  return (
    <span className={`xt xt--${t.dish}${t.numeric ? ' xt--numeric' : ''}`} aria-hidden="true">
      <span className="xt__tag">{t.tag}</span>
      <span className="xt__word" style={{ '--len': visibleLength(t.word) } as React.CSSProperties}>{t.word}</span>
    </span>
  );
}

export function ExploreHero() {
  return (
    <section className="xh" aria-labelledby="xh-title">
      <div className="container xh__head">
        <h1 id="xh-title" className="xh__title">
          <span className="xh__voice">میزت را رزرو کن.</span>{' '}
          <span className="xh__voice xh__voice--2">یا میزهایت را پر کن.</span>
        </h1>
        <div className="xh__cta">
          <a href={appBase()} className="btn btn--primary btn--lg">رزرو میز</a>
          <a href="#for-restaurants" className="btn btn--ghost btn--lg">برای رستوران‌ها</a>
        </div>
      </div>

      <a
        className="xh__grid"
        href={appBase()}
        aria-label="بازکردنِ اپِ مشتری — کشفِ رستوران و رزروِ میز"
      >
        {BEFORE.map((t) => <TileView key={t.word} t={t} />)}

        <span className="xt xt--reel" aria-hidden="true">
          <span className="xr">
            {REEL.map((r) => (
              <span key={r.word} className={`xr__page xt--${r.dish}`}>
                <span className="xr__word">{r.word}</span>
              </span>
            ))}
          </span>
          <span className="xr__chrome">
            <span className="xr__bars"><i /><i /><i /></span>
            <span className="xr__slots">
              <span>۱۹:۳۰</span>
              <span className="is-on">۲۰:۳۰</span>
              <span>۲۱:۰۰</span>
            </span>
          </span>
        </span>

        {AFTER.map((t) => <TileView key={t.word} t={t} />)}
      </a>
    </section>
  );
}
