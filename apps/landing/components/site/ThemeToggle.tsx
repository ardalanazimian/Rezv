'use client';

// کلیدِ روشن/تاریک.
//
// عمداً بدونِ state در React: منبعِ حقیقت `document.documentElement.dataset.theme`
// است که اسکریپتِ head پیش از نخستین رنگ‌آمیزی می‌نویسد. اگر آن را در state
// آینه می‌کردیم، هم یک رندرِ اضافه داشتیم و هم ریسکِ ناهماهنگیِ سرور/کلاینت.
// نمایشِ آیکنِ درست را CSS بر اساسِ همان ویژگی انجام می‌دهد.

import { Icon } from './Icon';

export const THEME_KEY = 'rz_theme';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* حالتِ خصوصی مرورگر */ }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={compact ? 'btn btn--ghost btn--sm theme-toggle' : 'btn btn--ghost theme-toggle'}
      aria-label="تغییرِ حالتِ روشن و تاریک"
      title="تغییرِ حالتِ روشن و تاریک"
    >
      {/* هر دو آیکن رندر می‌شوند؛ CSS یکی را بر اساسِ تمِ فعال نشان می‌دهد. */}
      <Icon name="moon" size={18} className="theme-toggle__moon" />
      <Icon name="sun" size={18} className="theme-toggle__sun" />
    </button>
  );
}

/**
 * اسکریپتی که پیش از نخستین رنگ‌آمیزی اجرا می‌شود.
 *
 * دو کار: (۱) تمِ مؤثر را به‌صورتِ صریح روی <html data-theme> می‌نشاند — چه
 * ذخیره‌شده باشد چه از ترجیحِ سیستم — تا هم پرشِ تم نباشد و هم CSS بتواند
 * بدونِ ابهام آیکنِ درست را انتخاب کند. (۲) js-reveal را ست می‌کند تا
 * انیمیشنِ ورود فقط وقتی فعال شود که جاوااسکریپت واقعاً در دسترس است.
 */
export function ThemeScript() {
  const code = `(function(){try{
    var s=localStorage.getItem('${THEME_KEY}');
    var t=(s==='dark'||s==='light')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
    document.documentElement.dataset.theme=t;
    document.documentElement.classList.add('js-reveal');
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
