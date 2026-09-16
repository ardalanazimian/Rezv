// ═══════════════════════════════════════════════════════════════════════
//  «اسکرولِ زنده» — لحظه‌ی هماهنگِ صفحه‌ی اصلی
//
//  یک بخشِ مشکی که سنجاق می‌شود و گوشی وسطش، با اسکرولِ خودِ کاربر، مسیرِ
//  واقعیِ رزرو را جلو می‌برد: ورق زدن (ریلِ تیک‌تاکی) → نگاه کردن (منو و
//  حال‌وهوا) → زدنِ ساعت (شیتِ ظرفیت) → تمام. نوارِ چهارتکه‌ی بالای صفحه‌ی
//  گوشی همان نوارِ استوریِ اینستاگرام است و پیشرفت را نشان می‌دهد.
//
//  این تنها حرکتِ غیرِ لمسیِ سایت است — «یک لحظه‌ی هماهنگ، نه اثرهای
//  پراکنده». و ترتیبِ چهار مرحله واقعاً یک توالی است، پس شماره‌گذاری‌شان
//  (<ol>) معنا دارد نه تزئین.
//
//  چطور کار می‌کند — بدونِ یک خط جاوااسکریپت:
//   • `.ls__track` چهار برابرِ ارتفاعِ قاب است و `view-timeline: --ls` دارد.
//   • `.ls__stage` داخلش sticky است؛ هر حرکت با `animation-timeline: --ls`
//     و `animation-range: contain` به پیشرفتِ همان بازه‌ی سنجاق بسته است.
//   • اسکرولِ مرورگر دست نمی‌خورد (نه scroll-jacking): تاچ‌پد، کیبورد و
//     صفحه‌خوان عادی کار می‌کنند.
//
//  بدونِ پشتیبانی (فایرفاکس امروز) یا با prefers-reduced-motion: بخش سنجاق
//  نمی‌شود، هر چهار مرحله کنارِ گوشی فهرست می‌شوند و گوشی حالتِ «ساعت را
//  بزن» را ثابت نشان می‌دهد — هیچ محتوایی پشتِ حرکت نمی‌ماند.
//
//  صداقت: هیچ نامِ رستوران، امتیاز یا قیمتی نیست. هر ادعای متن‌ها
//  (صفحه‌ی تمام‌قد برای هر رستوران، منو و فاصله، ظرفیتِ واقعیِ هر ساعت،
//  بدونِ نصب، بخشِ «رزروها») رفتارِ موجودِ اپِ مشتری است (DS-011).
// ═══════════════════════════════════════════════════════════════════════

import { Icon } from '@/components/site/Icon';
import { appBase } from '@/lib/i18n';

const STEPS = [
  { title: 'ورق بزن', body: 'هر رستوران یک صفحه‌ی تمام‌قد است. بالا بکش، بعدی می‌آید.' },
  { title: 'نگاه کن', body: 'حال‌وهوا، منو و فاصله همان‌جاست؛ لازم نیست صفحه‌ی دیگری باز کنی.' },
  { title: 'ساعت را بزن', body: 'ظرفیتِ واقعیِ امشب را می‌بینی. ساعتی که پر است، پر نشان داده می‌شود.' },
  { title: 'تمام', body: 'بدونِ تماس و بدونِ نصب. رزروت در بخشِ رزروهای اپ می‌ماند.' },
];

const REELS = [
  { dish: 'saffron', word: 'کباب', name: 'کبابیِ خانوادگی', meta: 'ایرانی، ۱٫۲ کیلومتر' },
  { dish: 'turquoise', word: 'سوشی', name: 'سوشی‌بارِ کوچک', meta: 'ژاپنی، ۲٫۵ کیلومتر' },
  { dish: 'tea', word: 'دیزی', name: 'دیزی‌سرای سنتی', meta: 'سنتی، ۸۰۰ متر' },
];

const SLOTS: { t: string; state?: 'full' | 'pick' }[] = [
  { t: '۱۹:۰۰', state: 'full' },
  { t: '۱۹:۳۰' },
  { t: '۲۰:۰۰' },
  { t: '۲۰:۳۰', state: 'pick' },
  { t: '۲۱:۰۰' },
  { t: '۲۱:۳۰', state: 'full' },
];

export function LiveScroll() {
  return (
    <section className="ls is-night" aria-labelledby="ls-title">
      <div className="container ls__head">
        <h2 id="ls-title" className="ls__title">رزرو، به سادگیِ ورق‌زدن.</h2>
      </div>

      <div className="ls__track">
        <div className="ls__stage">
          <div className="container ls__grid">
            <ol className="ls__steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`ls__step ls__step--${i + 1}`}>
                  <h3 className="ls__step-title">{s.title}</h3>
                  <p className="ls__step-body">{s.body}</p>
                </li>
              ))}
            </ol>

            <div className="ls__device" aria-hidden="true">
              <div className="ls__screen">
                <div className="ls__reels">
                  {REELS.map((r) => (
                    <div key={r.word} className={`ls__reel xt--${r.dish}`}>
                      <span className="ls__word">{r.word}</span>
                      <span className="ls__rail">
                        <span><Icon name="heart" size={18} /></span>
                        <span><Icon name="chat" size={18} /></span>
                        <span><Icon name="external" size={18} /></span>
                      </span>
                      <span className="ls__info">
                        <span className="ls__name">{r.name}</span>
                        <span className="ls__meta">{r.meta}</span>
                        <span className="ls__chips">
                          <span>۱۹:۳۰</span><span>۲۰:۰۰</span><span>۲۰:۳۰</span>
                          <span className="ls__book">رزرو</span>
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* نوارِ استوری — یک تکه برای هر مرحله */}
                <div className="ls__bars">
                  {STEPS.map((s, i) => <i key={s.title} className={`ls__bar ls__bar--${i + 1}`}><b /></i>)}
                </div>

                {/* مرحله‌ی ۲ — منو و حال‌وهوا روی همان ریل */}
                <div className="ls__peek">
                  <span className="ls__vibes"><span>دنج</span><span>خانوادگی</span><span>فضای باز</span></span>
                  <span className="ls__menu">
                    <span className="ls__menu-h">از منو</span>
                    <span className="ls__menu-i">دیزی سنگی</span>
                    <span className="ls__menu-i">کشک بادمجان</span>
                    <span className="ls__menu-i">دوغِ محلی</span>
                  </span>
                </div>

                {/* مرحله‌ی ۳ — شیتِ ساعت */}
                <div className="ls__sheet">
                  <span className="ls__grab" />
                  <span className="ls__sheet-h">کِی می‌آیی؟</span>
                  <span className="ls__seg"><span className="is-on">امشب</span><span>فردا</span><span>پس‌فردا</span></span>
                  <span className="ls__party"><span>تعداد</span><b>۲ نفر</b></span>
                  <span className="ls__slots">
                    {SLOTS.map((s) => (
                      <span key={s.t} className={`ls__slot${s.state ? ` is-${s.state}` : ''}`}>{s.t}</span>
                    ))}
                  </span>
                  <span className="ls__confirm">تأییدِ رزرو</span>
                </div>

                {/* مرحله‌ی ۴ — تمام */}
                <div className="ls__done">
                  <svg className="ls__check" viewBox="0 0 52 52" aria-hidden="true">
                    <circle cx="26" cy="26" r="25" />
                    <path d="M15 27l7 7 15-16" />
                  </svg>
                  <span className="ls__done-h">میزت رزرو شد</span>
                  <span className="ls__done-p">امشب، ساعت ۲۰:۳۰، برای دو نفر</span>
                  <span className="ls__done-s">دیزی‌سرای سنتی</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container ls__foot">
        <a href={appBase()} className="btn btn--primary btn--lg">امتحانش کن</a>
      </div>
    </section>
  );
}
