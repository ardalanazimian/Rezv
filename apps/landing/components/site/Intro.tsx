 'use client';

// ═══════════════════════════════════════════════════════════════════════
//  پرده‌ی ورود — ثانیه‌ی اولِ سایت
//
//  کاملاً با CSS اجرا می‌شود، نه با جاوااسکریپت. دلیلش دو چیز است:
//   • بدونِ JS هم پرده بالا می‌رود (animation-fill-mode: forwards). یک
//     پرده‌ی گیرکرده روی صفحه بدترین حالتِ ممکن است.
//   • چون در HTMLِ سرور هست، هیچ پرشی بینِ رندرِ اول و hydration نیست.
//
//  فقط یک بار در هر نشست: یک effectِ سبک بعد از mount بررسی می‌کند که این
//  پرده قبلاً دیده شده یا نه؛ اگر دیده شده باشد data-intro="done" را می‌گذارد.
//  CSS آن را کاملاً حذف می‌کند. پس رفتن به صفحه‌ی دوم پرده ندارد.
//
//  مدتِ کل ۱٫۲ ثانیه است — عمداً کوتاه. پرده روی LCP می‌نشیند و هر ۱۰۰
//  میلی‌ثانیه‌ی اضافه مستقیم به آن اضافه می‌شود.
//
//  با prefers-reduced-motion اصلاً رندر نمی‌شود (display:none در CSS).
// ═══════════════════════════════════════════════════════════════════════

import { useEffect } from 'react';

/** پیش از اولین رنگ‌آمیزی: اگر پرده در این نشست دیده شده، حذفش کن. */
const BARS = 6;

export function Intro() {
  useEffect(() => {
    try {
      const k = 'rz_intro';
      if (sessionStorage.getItem(k)) {
        document.documentElement.dataset.intro = 'done';
      } else {
        sessionStorage.setItem(k, '1');
      }
    } catch {
      // اگر sessionStorage در دسترس نبود، پرده فقط همان‌بارِ فعلی نمایش داده می‌شود.
    }
  }, []);

  return (
    <>
      <div className="intro" aria-hidden="true">
        {/* تیغه‌ها یکی‌یکی بالا می‌روند — در RTL از راست به چپ خوانده می‌شود */}
        {Array.from({ length: BARS }, (_, i) => (
          <span key={i} className="intro__bar" style={{ '--i': i } as React.CSSProperties} />
        ))}
        <div className="intro__mark">
          <span className="intro__word">رزرونو</span>
          <span className="intro__line" />
          <span className="intro__count">
            <span className="intro__roll">
              <b>۰</b><b>۲۴</b><b>۵۱</b><b>۷۸</b><b>۹۳</b><b>۱۰۰</b>
            </span>
          </span>
        </div>
      </div>
    </>
  );
}
