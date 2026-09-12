// ═══════════════════════════════════════════════════════════════════════
//  موزاییکِ «کشف» — تصویرِ محصول در اولین قابِ صفحه‌ی اصلی
//
//  چرا این و نه عکس: سایت هیچ عکسی ندارد (شمارشِ ۰۹-۱۲: صفر <img>) و مالک
//  می‌خواهد صفحه‌ی اول مثلِ اینستاگرام/تیک‌تاک «محصول‌اول» باشد، نه متنِ
//  شرکتی. خودِ اپِ مشتری همین شکل است: فیدِ کشف یک شبکه‌ی فشرده از
//  کارت‌های گرادیانیِ رنگی است (`apps/customer/css/app.css` → `.rc` و
//  `.rc-panel`؛ شش گرادیان در `apps/customer/js/data/seed.js` → `GRAD`).
//  این‌جا همان زبان در مقیاسِ کوچک بازسازی می‌شود — پس تصویر صادق است:
//  چیزی را نشان می‌دهد که مهمان بعد از زدنِ در می‌بیند.
//
//  چه چیزی روی کاشی هست و چه چیزی نیست: دسته‌ی آشپزی و حال‌وهوا (همان
//  واژگانِ فیلترِ کشف در اپ: خانوادگی، لوکس، سریع، ویو، رمانتیک، آروم)،
//  چیپِ ساعتِ رزرو، نشانِ «داغ» و درصدِ کش‌بک (همان مقادیرِ نمونه‌ی اپ) —
//  یعنی *حالت‌های رابط*. هیچ نامِ رستوران، امتیاز یا شمارشِ رزروی روی
//  کاشی نیست، چون هر کدام ادعایی درباره‌ی یک کسب‌وکارِ واقعی می‌شد.
//
//  حرکت فقط اسکرول‌محور است (site.css › `.mosaic__col`، CSS
//  animation-timeline: scroll): ستون‌ها با اسکرولِ صفحه با سرعت‌های
//  متفاوت بالا می‌روند. تایمر ندارد، جاوااسکریپت ندارد، و با
//  prefers-reduced-motion کاملاً ثابت است.
//
//  کلِ موزاییک یک لینک به اپِ مشتری است — همان درِ D-006، فقط تصویری؛
//  معنایش در برچسبِ لینک و درِ زیرِ آن است، پس کاشی‌ها aria-hidden هستند.
// ═══════════════════════════════════════════════════════════════════════

import { Icon } from './Icon';
import { appBase } from '@/lib/i18n';

interface Tile {
  /** شماره‌ی گرادیان — همان کلیدهای ۱..۶ در GRADِ اپِ مشتری */
  g: 1 | 2 | 3 | 4 | 5 | 6;
  emoji: string;
  name: string;
  meta: string;
  slots: string[];
  hot?: boolean;
}

/** سه ستون؛ ترتیبِ کاشی‌ها همان ریتمِ فید است: کاشیِ داغ بالا، بقیه زیرش.
 *  متن‌ها کوتاه‌اند چون کاشی روی ۳۹۰px فقط ~۷۴px پهنای متن دارد و مثلِ خودِ اپ
 *  یک‌خطی با «…» می‌شود؛ متنِ بریده هیچ‌چیز را نشان نمی‌دهد (در مرورگر دیده شد). */
const COLUMNS: Tile[][] = [
  [
    { g: 3, emoji: '🫖', name: 'ایرانی · سنتی', meta: 'خانوادگی', slots: ['۲۰:۰۰', '۲۰:۳۰'], hot: true },
    { g: 4, emoji: '🍱', name: 'ژاپنی', meta: '۱۲٪ کش‌بک', slots: ['۲۱:۰۰'] },
    { g: 2, emoji: '🍔', name: 'برگر مدرن', meta: 'سریع', slots: ['۱۹:۰۰', '۱۹:۳۰'] },
  ],
  [
    { g: 6, emoji: '🌃', name: 'روف‌تاپ', meta: 'رمانتیک', slots: ['۲۱:۳۰'] },
    { g: 5, emoji: '🍕', name: 'ایتالیایی', meta: '۶٪ کش‌بک', slots: ['۲۰:۰۰'], hot: true },
    { g: 1, emoji: '🌿', name: 'کافه‌رستوران', meta: 'آروم', slots: ['۱۸:۳۰', '۱۹:۰۰'] },
  ],
  [
    { g: 2, emoji: '🍝', name: 'فیوژن', meta: 'لوکس', slots: ['۲۰:۳۰'] },
    { g: 6, emoji: '🥘', name: 'ایرانی', meta: '۱۵٪ کش‌بک', slots: ['۱۹:۳۰', '۲۰:۰۰'] },
    { g: 4, emoji: '🍟', name: 'برگر مدرن', meta: 'خانوادگی', slots: ['۱۸:۰۰'] },
  ],
];

export function ExploreMosaic() {
  return (
    <a
      className="mosaic"
      href={appBase()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="بازکردنِ اپِ مشتری — کشف و رزروِ رستوران"
    >
      <span className="mosaic__grid" aria-hidden="true">
        {COLUMNS.map((col, c) => (
          <span key={c} className={`mosaic__col mosaic__col--${c + 1}`}>
            {col.map((t, i) => (
              <span key={`${c}-${i}`} className={`mtile mtile--${t.g}`}>
                <span className="mtile__emoji">{t.emoji}</span>
                {t.hot && (
                  <span className="mtile__hot">
                    <Icon name="bolt" size={10} />
                    داغ
                  </span>
                )}
                <span className="mtile__panel">
                  <span className="mtile__name">{t.name}</span>
                  <span className="mtile__meta">{t.meta}</span>
                  <span className="mtile__slots">
                    {t.slots.map((slot, k) => (
                      <span key={slot} className={`mtile__slot${k === 0 ? ' is-go' : ''}`}>{slot}</span>
                    ))}
                  </span>
                </span>
              </span>
            ))}
          </span>
        ))}
      </span>
      <span className="mosaic__label">
        <Icon name="phone" size={14} />
        اپِ مشتری · کشف و رزرو
        <Icon name="external" size={13} />
      </span>
    </a>
  );
}
