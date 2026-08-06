// ═══════════════════════════════════════════════════════════════════════
//  نقطه‌ی ورودِ پیش‌نمایشِ آفلاین
//
//  چرا وجود دارد: باندلِ Turbopack روی file:// بالا نمی‌آید (چانک‌ها را در
//  زمانِ اجرا با fetch می‌گیرد و روی پروتکلِ فایل شکست می‌خورد و hydration
//  بی‌صدا متوقف می‌ماند — اندازه‌گیری شد). برای فایلِ تک‌نفره‌ای که با
//  دابل‌کلیک روی گوشی باز شود، این ورودی با esbuild به یک اسکریپتِ کلاسیک
//  تبدیل می‌شود.
//
//  قاعده‌ی مهم: اینجا هیچ منطقی دوباره نوشته نمی‌شود. همان کامپوننت‌های
//  واقعیِ سایت import و روی همان جای خودشان سوار می‌شوند. اگر فردا حرکتی در
//  کامپوننت عوض شود، پیش‌نمایش خودبه‌خود همان را نشان می‌دهد.
//
//  الگو: هر بخشِ تعاملی در HTMLِ سرور یک نشانه دارد (کلاس یا تگ). آن گره با
//  یک ریشه‌ی React جایگزین می‌شود که همان کامپوننت را رندر می‌کند. چون این
//  کامپوننت‌ها خودبسنده‌اند (نه prop از سرور می‌گیرند نه context)، جایگزینی
//  دقیقاً همان چیزی را می‌سازد که سایتِ زنده دارد.
// ═══════════════════════════════════════════════════════════════════════

import { createRoot } from 'react-dom/client';
import { FlowField } from '../components/sections/FlowField';
import { ServiceNight } from '../components/sections/ServiceNight';
import { LiveFlow } from '../components/sections/LiveFlow';
import { PinnedStory } from '../components/sections/PinnedStory';
import { Ambient } from '../components/site/Kinetic';
import { Cursor } from '../components/site/Cursor';
import { ScrollProgress } from '../components/site/Motion';
import { Header } from '../components/site/Header';
import { AskBot } from '../components/site/AskBot';
import { kbFrom } from '../lib/kb';
import { fallbackPlans, fallbackFaqs, fallbackArticles } from '../lib/content-types';
import content from '../content/site-content.json';

declare global { interface Window { __RZ_PAGE__?: () => void } }

// پیکره‌ی دستیار از همان فایلِ حالتِ امن ساخته می‌شود، با همان دو تابعی که
// سایتِ زنده هنگام نبودِ API استفاده می‌کند: fallback* شکلِ JSON را به شکلِ
// API ترجمه می‌کند و kbFrom پیکره را می‌سازد. بدونِ این ترجمه، قیمت‌ها
// «NaN تومان» می‌شدند (priceToman در JSON، price_toman در API) — در
// پیش‌نمایش دیده شد.
const KB = kbFrom({
  faqs: fallbackFaqs(content),
  articles: fallbackArticles(content),
  plans: fallbackPlans(content),
  pageSlugs: (content.pages as { slug: string }[]).map((p) => p.slug),
});

// ریشه‌های صفحه‌ی جاری. پیش از سوارکردنِ صفحه‌ی بعد باید unmount شوند وگرنه
// حلقه‌ی rAF صحنه‌های قبلی زنده می‌ماند و با هر جابه‌جایی یکی اضافه می‌شود.
let pageRoots: ReturnType<typeof createRoot>[] = [];

/** گره‌ی نشانه‌گذاری‌شده را با یک ریشه‌ی React جایگزین می‌کند. */
function swap(scope: ParentNode, selector: string, node: React.ReactNode, tag = 'div', track = true) {
  scope.querySelectorAll(selector).forEach((el) => {
    const host = document.createElement(tag);
    // پوسته نباید هندسه را عوض کند. بوم‌های پس‌زمینه absolute با inset:0 و
    // اندازه‌ی ۱۰۰٪ هستند؛ اگر پوسته یک بلوکِ عادی باشد، درصدها نسبت به آن
    // حساب می‌شوند و بوم ۰ ارتفاع می‌گیرد (در پیش‌نمایش ۳۹۰×۰ دیده شد).
    // پس پوسته دقیقاً همان جایگاه را می‌گیرد و قابِ عنصرِ اصلی را پر می‌کند.
    const pos = getComputedStyle(el).position;
    if (pos === 'absolute' || pos === 'fixed') {
      host.style.cssText = `position:${pos};inset:0;pointer-events:none`;
    } else {
      host.style.display = 'contents';
    }
    el.replaceWith(host);
    const root = createRoot(host);
    root.render(node);
    if (track) pageRoots.push(root);
  });
}

/** ریشه‌ای که در markup وجود ندارد و باید ساخته شود (مثلِ نشانگر). */
function append(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  createRoot(host).render(node);
}

/**
 * بخش‌های تعاملیِ داخلِ <main> را سوار می‌کند. با هر جابه‌جاییِ صفحه دوباره
 * صدا زده می‌شود؛ روترِ پیش‌نمایش همین را فراخوانی می‌کند.
 */
function mountPage() {
  for (const r of pageRoots) r.unmount();
  pageRoots = [];

  const main = document.getElementById('rz-host') ?? document.body;
  swap(main, 'canvas.flowfield', <FlowField />);
  swap(main, 'canvas.kx-ambient', <Ambient />);
  swap(main, '.night', <ServiceNight />);
  swap(main, '.flow', <LiveFlow />);
  swap(main, '.pin', <PinnedStory />, 'section');
  // آکاردئونِ پرسش‌ها با <details>/<summary> بومی کار می‌کند و به React نیاز
  // ندارد — عمداً دست‌نخورده می‌ماند.

  // Reveal ها روی markupِ موجود: کامپوننتِ Reveal اینجا رندر نمی‌شود، پس
  // همان قرارداد (data-visible) را با یک observer برقرار می‌کنیم.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.visible = 'true';
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  main.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}

/** پوسته: یک بار سوار می‌شود و بینِ صفحه‌ها دست‌نخورده می‌ماند. */
function mountShell() {
  swap(document, 'header.site-header', <Header />, 'div', false);
  swap(document, '.scroll-progress', <ScrollProgress />, 'div', false);
  document.querySelectorAll('.askbot, .askbot__fab').forEach((el) => el.remove());
  append(<AskBot docs={KB} />);
  append(<Cursor />);
}

function boot() {
  mountShell();
  mountPage();
}

window.__RZ_PAGE__ = mountPage;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
