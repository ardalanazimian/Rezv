import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { normalize, tokenize, search, answer } = await import('../lib/answer.ts');
import content from '../content/site-content.json';

interface RawFaq { scope: string; question: string; answer: string }
interface RawPlan { name: string; priceToman: number; months: number }

// همان تبدیلی که lib/kb.ts انجام می‌دهد، ولی از فایلِ حالتِ امن.
const DOCS = [
  ...(content.faqs as RawFaq[]).map((f, i) => ({
    id: `faq:${i}`,
    title: f.question,
    body: f.answer,
    href: '/faq',
    kind: 'faq' as const,
    scope: f.scope,
  })),
  // سندِ قیمت — چون عددها در پلن‌ها هستند نه در پرسش‌ها
  {
    id: 'plans:all',
    title: 'قیمتِ اشتراکِ رزرونو چند است؟',
    body:
      'قیمتِ پلن‌ها: ' +
      (content.plans as RawPlan[])
        .map((p) => `${p.name}: ${p.priceToman.toLocaleString('fa-IR')} تومان برای ${p.months} ماه`)
        .join(' · ') +
      '. هر سه پلن دسترسیِ کاملِ محصول را می‌دهند.',
    href: '/pricing',
    kind: 'page' as const,
    scope: 'pricing',
  },
];

describe('نرمال‌سازیِ فارسی', () => {
  test('ی و ک عربی یکسان می‌شوند', () => {
    assert.equal(normalize('مي‌كنم'), normalize('می کنم'));
  });

  test('اعدادِ فارسی به لاتین تبدیل می‌شوند', () => {
    assert.equal(normalize('۳۰ روز'), '30 روز');
  });

  test('نیم‌فاصله مثلِ فاصله رفتار می‌کند', () => {
    assert.equal(normalize('کسب‌وکار'), 'کسب وکار');
  });

  test('واژه‌های پرتکرار از توکن‌ها حذف می‌شوند', () => {
    const t = tokenize('این چطور کار می‌کند برای من');
    assert.ok(!t.includes('این'));
    assert.ok(!t.includes('برای'));
  });
});

describe('بازیابی — سؤال باید به پاسخِ درست برسد', () => {
  // هر ردیف: سؤالِ کاربر → واژه‌ای که باید در پاسخ باشد
  const CASES: [string, string][] = [
    ['لیست انتظار چطور کار می‌کند؟', 'انتظار'],
    ['نقشه سالن چیه؟', 'میز'],
    ['قیمت اشتراک چنده؟', 'تومان'],
    ['دمو چند روزه است؟', '۳۰'],
    ['مهمان چطور رزروش رو کنسل می‌کنه؟', 'لغو'],
    ['چند تا کاربر می‌تونم بسازم؟', 'کاربر'],
    ['کش‌بک چیه؟', 'کش‌بک'],
    ['رزرو همزمان دو نفر یه میز رو بگیرن چی میشه؟', 'همزمان'],
  ];

  for (const [q, expect] of CASES) {
    test(`«${q}»`, () => {
      const a = answer(q, DOCS);
      assert.ok(a.confident, 'باید مطمئن باشد');
      assert.ok(
        a.text.includes(expect),
        `پاسخ باید «${expect}» داشته باشد ولی این آمد: ${a.text.slice(0, 90)}`,
      );
    });
  }
});

describe('صداقت — وقتی جواب ندارد', () => {
  test('سؤالِ کاملاً بی‌ربط → اعتراف به ندانستن، نه حدس', () => {
    const a = answer('قیمت بلیت هواپیما به استانبول چقدر است', DOCS);
    assert.equal(a.confident, false);
    assert.ok(a.text.includes('پیدا نکردم'));
    assert.equal(a.source?.href, '/contact');
  });

  test('ورودیِ خالی چیزی نمی‌شکند', () => {
    const a = answer('   ', DOCS);
    assert.equal(a.confident, false);
  });

  test('پاسخِ مطمئن همیشه منبع دارد', () => {
    const a = answer('پنل کسب‌وکار چه بخش‌هایی دارد؟', DOCS);
    assert.ok(a.confident);
    assert.ok(a.source && a.source.href.startsWith('/'));
  });
});

describe('رتبه‌بندی', () => {
  test('عنوانِ منطبق بر متنِ منطبق اولویت دارد', () => {
    const hits = search('کش‌بک', DOCS, 3);
    assert.ok(hits.length > 0);
    assert.ok(hits[0].doc.title.includes('کش‌بک'));
  });

  test('پاسخ هرگز از خودش متن نمی‌سازد — همیشه عیناً از پیکره است', () => {
    const a = answer('لیست انتظار چطور کار می‌کند؟', DOCS);
    assert.ok(DOCS.some((d) => d.body === a.text));
  });
});

// ── محافظ در برابرِ بازگشتِ باگِ «پنلِ چت از اول باز است» ──
//
// ویژگیِ hidden فقط display:none پیش‌فرضِ مرورگر است. هر قاعده‌ای که برای
// .askbot یک display بگذارد بر آن غلبه می‌کند و پنل از لحظه‌ی ورود باز
// می‌ماند. این تست فایلِ CSS را می‌خواند تا مطمئن شود قاعده‌ی خنثی‌کننده
// هست — یک بار واقعاً این اتفاق افتاد و در مرورگر پیدا شد.
describe('CSS دستیار', () => {
  test('.askbot[hidden] باید display را خنثی کند', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../app/site.css', import.meta.url), 'utf8');
    assert.match(css, /\.askbot\[hidden\]\s*\{\s*display:\s*none/);
  });
});
