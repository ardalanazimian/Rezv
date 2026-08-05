// ساختِ پیکره‌ی دستیار از محتوای زنده‌ی CMS.
//
// همان پرسش‌ها، مقاله‌ها و صفحه‌هایی که در سایت منتشرند. یعنی هر چیزی که
// مدیر در داشبورد بنویسد یا اصلاح کند، بلافاصله پاسخِ دستیار را هم عوض
// می‌کند — بدونِ اینکه جایی دوباره نوشته شود.

import { getFaqs, getArticles, getPlans, getSitemapData } from './site-api';
import { markdownToText } from './markdown';
import { toman, faNum } from './format';
import type { KbDoc } from './answer';

/** مسیرهای اختصاصیِ صفحه‌های محتوایی، برای لینکِ «بیشتر بخوانید». */
const PAGE_HREF: Record<string, string> = {
  home: '/', product: '/product', 'customer-app': '/customer-app',
  'business-app': '/business-app', features: '/features',
  'how-it-works': '/how-it-works', about: '/about',
  terms: '/terms', privacy: '/privacy',
};

/** پرسش‌ها در کدام صفحه دیده می‌شوند (برای لینکِ منبع). */
const SCOPE_HREF: Record<string, string> = {
  customer: '/customer-app',
  business: '/business-app',
  pricing: '/pricing',
  demo: '/demo',
  general: '/faq',
};

export async function buildKb(): Promise<KbDoc[]> {
  const [faqs, articles, plans] = await Promise.all([
    getFaqs(),          // بدونِ scope = همه‌ی حوزه‌ها
    getArticles({ limit: 40 }),
    getPlans(),
  ]);

  const docs: KbDoc[] = [];

  for (const f of faqs) {
    docs.push({
      id: `faq:${f.id}`,
      title: f.question,
      body: f.answer,
      href: SCOPE_HREF[f.scope ?? 'general'] ?? '/faq',
      kind: 'faq',
      scope: f.scope ?? 'general',
    });
  }

  // قیمت‌ها در پلن‌ها هستند نه در پرسش‌ها. بدونِ این، سؤالِ «قیمت چنده؟»
  // جوابِ «تفاوتِ پلن‌ها» می‌گرفت بدونِ هیچ عددی — با تست گرفته شد.
  if (plans.length) {
    const lines = plans.map(
      (p) => `${p.name}: ${toman(p.price_toman)} برای ${faNum(p.months)} ماه` +
        (p.monthly_toman ? ` (معادلِ ماهانه ${toman(p.monthly_toman)})` : ''),
    );
    docs.push({
      id: 'plans:all',
      title: 'قیمتِ اشتراکِ رزرونو چند است؟',
      body:
        `قیمتِ پلن‌ها: ${lines.join(' · ')}. ` +
        'هر سه پلن دسترسیِ کاملِ محصول را می‌دهند و تفاوتشان در مدت و سطحِ پشتیبانی است. ' +
        'پیش از خرید هم ۳۰ روز دموی رایگان بدونِ کارتِ بانکی دارید.',
      href: '/pricing',
      kind: 'page',
      scope: 'pricing',
    });
  }

  for (const a of articles) {
    docs.push({
      id: `article:${a.slug}`,
      title: a.title,
      // متنِ خام از Markdown — دستیار نباید علائمِ نشانه‌گذاری را بخواند
      body: a.excerpt || markdownToText(a.body ?? '', 400),
      href: `/blog/${a.slug}`,
      kind: 'article',
    });
  }

  // صفحه‌های محتوایی: عنوان و توضیحِ سئو کافی است؛ متنِ بلوک‌ها ساختارِ
  // تودرتو دارد و برای بازیابی نویز می‌شود.
  try {
    const data = await getSitemapData();
    for (const p of data.pages) {
      const href = PAGE_HREF[p.slug] ?? `/${p.slug}`;
      docs.push({ id: `page:${p.slug}`, title: p.slug, body: '', href, kind: 'page' });
    }
  } catch {
    // بدونِ API هم دستیار باید کار کند — فقط با پرسش‌ها و مقاله‌ها.
  }

  // سندِ بی‌متن ارزشِ بازیابی ندارد
  return docs.filter((d) => d.title.trim() && (d.body.trim() || d.kind === 'faq'));
}
