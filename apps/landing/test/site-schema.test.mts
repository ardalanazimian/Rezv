import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا (سازگار با tsx+node:test) — سازنده‌های خالصِ JSON-LD وب‌سایت.
const {
  organizationJsonLd, websiteJsonLd, softwareApplicationJsonLd,
  siteFaqJsonLd, articleJsonLd, breadcrumbJsonLd, webPageJsonLd, graph,
  ORG_ID, WEBSITE_ID,
} = await import('../lib/site-schema.ts');
const { renderMarkdown, markdownToText } = await import('../lib/markdown.ts');
const { buildMetadata } = await import('../lib/seo.ts');
const { fallbackPlans, fallbackFaqs, fallbackPage } = await import('../lib/content-types.ts');
import content from '../content/site-content.json';

type Node = Record<string, unknown>;
const nodes = (g: unknown): Node[] => (g as { '@graph': Node[] })['@graph'];
const nodeOf = (g: unknown, type: string) => nodes(g).find((n) => n['@type'] === type);

const PLANS = [
  { key: 'm3', name: 'سه‌ماهه', tagline: null, months: 3, price_toman: 18_000_000, monthly_toman: 6_000_000, compare_at_toman: null, saving_toman: 0, saving_percent: 0, badge: null, features: [], highlight: false, sort_order: 1 },
  { key: 'm12', name: 'یک‌ساله', tagline: null, months: 12, price_toman: 65_000_000, monthly_toman: 5_416_667, compare_at_toman: 72_000_000, saving_toman: 7_000_000, saving_percent: 10, badge: null, features: [], highlight: false, sort_order: 3 },
];

describe('graph — بسته‌بندیِ JSON-LD', () => {
  test('نودهای خالی حذف می‌شوند (schemaی معتبر، بدونِ null)', () => {
    const g = graph([{ '@type': 'A' }, null, undefined, { '@type': 'B' }]);
    assert.equal(nodes(g).length, 2);
    assert.equal((g as Node)['@context'], 'https://schema.org');
  });
});

describe('organizationJsonLd / websiteJsonLd', () => {
  test('سازمان @id پایدار دارد تا بقیه‌ی نودها به آن ارجاع دهند', () => {
    const org = organizationJsonLd() as Node;
    assert.equal(org['@id'], ORG_ID);
    assert.equal(org['@type'], 'Organization');
    assert.ok(String(org.url).startsWith('https://'));
  });

  test('وب‌سایت به سازمان ارجاع می‌دهد و SearchAction دارد', () => {
    const site = websiteJsonLd() as Node;
    assert.equal(site['@id'], WEBSITE_ID);
    assert.deepEqual(site.publisher, { '@id': ORG_ID });
    const action = site.potentialAction as Node;
    assert.equal(action['@type'], 'SearchAction');
    assert.ok(String((action.target as Node).urlTemplate).includes('{search_term_string}'));
  });
});

describe('softwareApplicationJsonLd — پیشنهادهای واقعی', () => {
  test('AggregateOffer از همان پلن‌هایی ساخته می‌شود که در صفحه دیده می‌شوند', () => {
    const node = softwareApplicationJsonLd(PLANS) as Node;
    const offers = node.offers as Node;
    assert.equal(offers['@type'], 'AggregateOffer');
    assert.equal(offers.offerCount, 2);
    // تومان → ریال؛ عدد باید با priceCurrency بخواند وگرنه قیمتِ اعلامی ده برابر غلط است.
    assert.equal(offers.priceCurrency, 'IRR');
    assert.equal(offers.lowPrice, 18_000_000 * 10);
    assert.equal(offers.highPrice, 65_000_000 * 10);
  });

  test('هر پیشنهاد مدتِ اشتراک را به‌صورتِ ماه اعلام می‌کند', () => {
    const node = softwareApplicationJsonLd(PLANS) as Node;
    const list = (node.offers as Node).offers as Node[];
    const yearly = list.find((o) => o.name === 'یک‌ساله')!;
    assert.deepEqual(yearly.eligibleDuration, { '@type': 'QuantitativeValue', value: 12, unitCode: 'MON' });
  });

  test('بدونِ پلن، اصلاً offers emit نمی‌شود (نه offersِ خالی)', () => {
    const node = softwareApplicationJsonLd([]) as Node;
    assert.equal(node.offers, undefined);
  });
});

describe('siteFaqJsonLd', () => {
  test('هر پرسش یک Question با پاسخِ پذیرفته‌شده می‌سازد', () => {
    const faq = siteFaqJsonLd([
      { id: '1', question: 'پرسش؟', answer: 'پاسخ.', scope: 'general', sort_order: 0 },
    ]) as Node;
    assert.equal(faq['@type'], 'FAQPage');
    const q = (faq.mainEntity as Node[])[0];
    assert.equal(q.name, 'پرسش؟');
    assert.equal((q.acceptedAnswer as Node).text, 'پاسخ.');
  });

  test('فهرستِ خالی → null (صفحه FAQPageِ توخالی نمی‌سازد)', () => {
    assert.equal(siteFaqJsonLd([]), null);
  });
});

describe('articleJsonLd', () => {
  const article = {
    slug: 'x', title: 'عنوان', excerpt: 'چکیده', body: 'یک دو سه چهار',
    cover_url: null, cover_alt: null, tags: ['رزرو'], author_name: 'تیم رزرونو',
    author_role: null, reading_minutes: 5, featured: false,
    seo: { title: null, description: null, keywords: [], og_image: null, noindex: false },
    published_at: '2026-08-01T00:00:00.000Z', updated_at: null,
  };

  test('BlogPosting با تاریخ، ناشر و شمارشِ کلمه', () => {
    const node = articleJsonLd(article, 'https://rezervno.ir/blog/x') as Node;
    assert.equal(node['@type'], 'BlogPosting');
    assert.equal(node.datePublished, '2026-08-01T00:00:00.000Z');
    assert.deepEqual(node.publisher, { '@id': ORG_ID });
    assert.equal(node.wordCount, 4);
  });

  test('نبودِ تصویر → فیلدِ image اصلاً نمی‌آید', () => {
    const node = articleJsonLd(article, 'https://rezervno.ir/blog/x') as Node;
    assert.equal(node.image, undefined);
  });

  test('dateModified در نبودِ updated_at به تاریخِ انتشار برمی‌گردد', () => {
    const node = articleJsonLd(article, 'https://rezervno.ir/blog/x') as Node;
    assert.equal(node.dateModified, '2026-08-01T00:00:00.000Z');
  });
});

describe('breadcrumbJsonLd / webPageJsonLd', () => {
  test('مسیر همیشه از ریشه شروع می‌شود و موقعیت‌ها پشتِ‌هم‌اند', () => {
    const bc = breadcrumbJsonLd([
      { name: 'بلاگ', path: '/blog' },
      { name: 'مقاله', path: '/blog/x' },
    ]) as Node;
    const items = bc.itemListElement as Node[];
    assert.equal(items.length, 3);
    assert.deepEqual(items.map((i) => i.position), [1, 2, 3]);
    assert.equal(items[0].name, 'رزرونو');
  });

  test('WebPage به وب‌سایت و سازمان وصل است', () => {
    const page = webPageJsonLd({ name: 'ص', description: null, pageUrl: 'https://rezervno.ir/x' }) as Node;
    assert.deepEqual(page.isPartOf, { '@id': WEBSITE_ID });
    // توضیحِ null نباید به‌عنوانِ فیلدِ خالی emit شود.
    assert.equal(page.description, undefined);
  });
});

describe('renderMarkdown — رندرِ امن', () => {
  test('HTMLِ خامِ داخلِ محتوا اجرا نمی‌شود', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\nمتنِ عادی');
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });

  test('لینکِ javascript: خنثی می‌شود', () => {
    const html = renderMarkdown('[کلیک](javascript:alert(1))');
    assert.ok(!html.includes('javascript:'));
    assert.ok(html.includes('href="#"'));
  });

  test('لینکِ بیرونی rel امن می‌گیرد، لینکِ داخلی نمی‌گیرد', () => {
    const ext = renderMarkdown('[س](https://example.com)');
    assert.ok(ext.includes('rel="noopener noreferrer"'));
    const int = renderMarkdown('[س](/pricing)');
    assert.ok(!int.includes('rel='));
  });

  test('عنوان، فهرست و پررنگ درست تبدیل می‌شوند', () => {
    const html = renderMarkdown('## سرفصل\n\n- یک\n- دو\n\nمتنِ **پررنگ**');
    assert.ok(html.includes('<h2>سرفصل</h2>'));
    assert.ok(html.includes('<ul>'));
    assert.equal((html.match(/<li>/g) || []).length, 2);
    assert.ok(html.includes('<strong>پررنگ</strong>'));
  });

  test('فهرستِ عددی و نقلِ‌قول', () => {
    const html = renderMarkdown('1. اول\n2. دوم\n\n> نقلِ قول');
    assert.ok(html.includes('<ol>'));
    assert.ok(html.includes('<blockquote>نقلِ قول</blockquote>'));
  });

  test('markdownToText نشانه‌گذاری را پاک و کوتاه می‌کند', () => {
    const text = markdownToText('## عنوان\n\n**متن** با [لینک](/x)', 20);
    assert.ok(!text.includes('#'));
    assert.ok(!text.includes('**'));
    assert.ok(text.length <= 20);
  });
});

describe('حالتِ امن — همان محتوایی که seed می‌کارد', () => {
  test('پلن‌های پیش‌فرض همان سه پلنِ اعلامی‌اند', () => {
    const plans = fallbackPlans(content);
    assert.deepEqual(plans.map((p) => p.key), ['m3', 'm6', 'm12']);
    assert.deepEqual(plans.map((p) => p.price_toman), [18_000_000, 34_000_000, 65_000_000]);
    assert.deepEqual(plans.map((p) => p.months), [3, 6, 12]);
  });

  test('معادلِ ماهانه درست حساب می‌شود', () => {
    const plans = fallbackPlans(content);
    assert.equal(plans[0].monthly_toman, 6_000_000);
    assert.equal(plans[1].monthly_toman, Math.round(34_000_000 / 6));
  });

  test('صرفه‌جویی فقط وقتی قیمتِ مرجع بزرگ‌تر باشد محاسبه می‌شود', () => {
    const plans = fallbackPlans(content);
    assert.equal(plans[0].saving_toman, 0);       // بدونِ compareAt
    assert.ok(plans[2].saving_percent > 0);        // یک‌ساله compareAt دارد
  });

  test('صفحه‌ی خانه بلوکِ hero و pricing دارد', () => {
    const page = fallbackPage(content, 'home');
    const types = page.sections.map((s) => s.type);
    assert.ok(types.includes('hero'));
    assert.ok(types.includes('pricing'));
    assert.ok(page.seo.title && page.seo.title.length > 0);
  });

  test('همه‌ی بلوک‌های همه‌ی صفحه‌ها کلیدِ type دارند', () => {
    for (const page of (content as { pages: { slug: string; sections: { type?: string }[] }[] }).pages) {
      for (const [i, section] of page.sections.entries()) {
        assert.equal(typeof section.type, 'string', `${page.slug}.sections[${i}] بدونِ type`);
      }
    }
  });

  test('پرسش‌ها بر اساسِ scope فیلتر می‌شوند', () => {
    const pricing = fallbackFaqs(content, 'pricing');
    assert.ok(pricing.length > 0);
    assert.ok(pricing.every((f) => f.scope === 'pricing'));
  });

  test('اسلاگِ صفحه‌ی ناموجود → صفحه‌ی خالیِ معتبر (نه پرتابِ خطا)', () => {
    const page = fallbackPage(content, 'no-such-page');
    assert.deepEqual(page.sections, []);
    assert.equal(page.slug, 'no-such-page');
  });
});

// ── عنوانِ صفحه: جلوگیری از تکرارِ نامِ برند ─────────────────────────────
//
// لایه‌اوت قالبِ «%s | رزرونو» دارد. عنوان‌هایی که خودشان نامِ برند را دارند
// باید absolute برگردند وگرنه نتیجه «درباره رزرونو | تیم | رزرونو» می‌شود.
// این باگ روی همه‌ی صفحه‌ها بود و با تستِ واقعیِ <title> پیدا شد.
describe('buildMetadata — عنوان', () => {
  test('عنوانی که نامِ برند دارد، absolute می‌شود (قالب دوباره نمی‌چسبد)', () => {
    const m = buildMetadata({ title: 'درباره رزرونو | تیم', description: 'x', path: '/about' });
    assert.deepEqual(m.title, { absolute: 'درباره رزرونو | تیم' });
  });

  test('عنوانی بدونِ نامِ برند رشته می‌ماند تا قالب برندش کند', () => {
    const m = buildMetadata({ title: 'تماس با فروش', description: 'x', path: '/contact' });
    assert.equal(m.title, 'تماس با فروش');
  });

  test('عنوانِ Open Graph و Twitter همیشه رشته‌ی خام است', () => {
    const m = buildMetadata({ title: 'درباره رزرونو | تیم', description: 'x', path: '/about' });
    assert.equal(m.openGraph?.title, 'درباره رزرونو | تیم');
    assert.equal((m.twitter as { title?: string })?.title, 'درباره رزرونو | تیم');
  });
});
