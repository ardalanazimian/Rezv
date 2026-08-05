'use client';

// ═══════════════════════════════════════════════════════════════════════
//  صحنه‌ی سنجاق‌شده — روایتِ اسکرول‌محور
//
//  امضای سایت‌های گران‌قیمت همین است: بخش سرِ جایش سنجاق می‌شود و به‌جای
//  اسکرولِ صفحه، *محتوا* فصل‌به‌فصل جلو می‌رود. حرکت اینجا تزئین نیست؛
//  خودِ روایت است — هر فصل یک کارِ واقعیِ پنل را نشان می‌دهد.
//
//  چرا position: sticky و نه ربودنِ اسکرول: اسکرولِ سفارشی (scroll-jacking)
//  روی تاچ‌پد و صفحه‌خوان و کیبورد خراب می‌شود و صفحه را غیرقابلِ‌استفاده
//  می‌کند. با sticky، اسکرولِ مرورگر دست‌نخورده می‌ماند و ما فقط پیشرفت را
//  می‌خوانیم — هم روان‌تر، هم قابلِ‌دسترس.
//
//  با prefers-reduced-motion به فهرستِ ساده‌ی عمودی تبدیل می‌شود: همه‌ی
//  فصل‌ها هم‌زمان دیده می‌شوند و هیچ چیزی سنجاق یا محو نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../site/Icon';

export interface Chapter {
  key: string;
  label: string;
  title: string;
  body: string;
  points: string[];
  icon: string;
}

/** فصل‌ها = کارهای واقعیِ پنل. ترتیب همان ترتیبِ یک شبِ کاری است. */
const CHAPTERS: Chapter[] = [
  {
    key: 'reservations', label: 'رزروها', icon: 'calendar',
    title: 'شب با یک فهرست شروع می‌شود',
    body: 'همه‌ی رزروهای امشب یک‌جا، با وضعیتی که با یک لمس عوض می‌شود.',
    points: ['تأیید، رسید، سرو شد، لغو، عدمِ‌حضور', 'تاریخچه‌ی هر تغییر با نامِ کاربر', 'رزروِ تازه بدونِ رفرش ظاهر می‌شود'],
  },
  {
    key: 'floor', label: 'نقشه‌ی سالن', icon: 'layout',
    title: 'سالن را از یک صفحه بچرخانید',
    body: 'چیدمانِ واقعیِ میزها با ظرفیت و ناحیه؛ وضعیتِ هر میز زنده است.',
    points: ['آزاد، رزروشده، مشغول — با یک نگاه', 'کنارِ پنجره، داخلی، VIP، فضای باز', 'مهمانِ بدونِ رزرو هم روی همین نقشه می‌نشیند'],
  },
  {
    key: 'waitlist', label: 'لیستِ انتظار', icon: 'clock',
    title: '«جا نداریم» آخرین جمله نیست',
    body: 'مهمان در صف می‌ماند و با آزادشدنِ میز خبردار می‌شود.',
    points: ['پیشنهادِ خودکار به نفرِ بعدی', 'رد کرد؟ نوبت جلو می‌رود', 'می‌بینید چه‌قدر تقاضا از دست داده‌اید'],
  },
  {
    key: 'crm', label: 'مشتریان', icon: 'users',
    title: 'مهمان را بشناسید، نه فقط بشمارید',
    body: 'پرونده‌ی هر مهمان: چند بار، آخرین بار، چه‌قدر، و یادداشتِ تیم.',
    points: ['تحلیلِ RFM — تازگی، تکرار، ارزش', 'یادداشتِ ترجیحِ میز و آلرژی', 'باشگاهِ امتیاز و کش‌بک'],
  },
  {
    key: 'growth', label: 'رشد', icon: 'chart',
    title: 'شبِ بعد را با داده بچینید',
    body: 'کمپین، کوپن و گزارش — تصمیم بر عدد، نه بر حس.',
    points: ['پیامکِ گروهی و اتوماسیون', 'نرخِ اشغال و عدمِ‌حضور', 'عملکردِ هر کمپین جدا'],
  },
];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function PinnedStory() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  // حالتِ کاهشِ حرکت کاملاً با CSS اداره می‌شود، نه با شاخه‌ی جداگانه در JS:
  // اینجا فقط حلقه‌ی rAF اجرا نمی‌شود. این‌طور نه setState همزمان در افکت
  // داریم (که رندرِ آبشاری می‌سازد) و نه دو نسخه‌ی موازیِ markup که از هم
  // واگرا شوند.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = wrapRef.current;
    if (!el) return;

    let raf = 0;
    let visible = false;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '10%' });
    io.observe(el);

    const tick = () => {
      if (visible) {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        // ۰ وقتی بالای بخش به بالای قاب می‌رسد، ۱ وقتی پایینش می‌رسد
        const total = r.height - vh;
        const p = clamp01(total > 0 ? -r.top / total : 0);
        setProgress(p);
        setActive(Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  return (
    <section className="pin" ref={wrapRef} style={{ blockSize: `${CHAPTERS.length * 92}vh` }}>
      <div className="pin__stage">
        <div className="container pin__grid">
          {/* ستونِ چپ: فصل‌ها، با نشانگرِ پیشرفت */}
          <nav className="pin__rail" aria-label="فصل‌ها">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.key}
                type="button"
                className={`pin__step${i === active ? ' is-on' : ''}${i < active ? ' is-done' : ''}`}
                onClick={() => {
                  const el = wrapRef.current;
                  if (!el) return;
                  const total = el.offsetHeight - window.innerHeight;
                  window.scrollTo({
                    top: el.offsetTop + (total * (i + 0.5)) / CHAPTERS.length,
                    behavior: 'smooth',
                  });
                }}
              >
                <span className="pin__dot"><Icon name={c.icon} size={15} /></span>
                <span className="pin__step-label">{c.label}</span>
              </button>
            ))}
            <span className="pin__bar" aria-hidden="true">
              <span className="pin__bar-fill" style={{ blockSize: `${progress * 100}%` }} />
            </span>
          </nav>

          {/* ستونِ راست: خودِ فصل، با گذارِ نرم */}
          <div className="pin__panel">
            {CHAPTERS.map((c, i) => (
              <article
                key={c.key}
                className={`pin__chapter${i === active ? ' is-on' : ''}`}
                aria-hidden={i !== active}
              >
                <span className="pin__num">{toFa(i + 1)}<span className="pin__num-of">/{toFa(CHAPTERS.length)}</span></span>
                <h3 className="pin__title">{c.title}</h3>
                <p className="pin__body">{c.body}</p>
                <ul className="pin__points">
                  {c.points.map((p) => <li key={p}><Icon name="check" size={17} />{p}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}
