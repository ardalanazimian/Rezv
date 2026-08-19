import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا (سازگار با tsx+node:test) — سازنده‌های خالصِ JSON-LD.
const { restaurantJsonLd, listJsonLd, faqJsonLd, organizationJsonLd, menuJsonLd, tomanToRial } =
  await import('../lib/schema.ts');
const { formatOpeningHours } = await import('../lib/hours.ts');
import type { MenuItem, RestaurantDetail, RestaurantListItem } from '../lib/api';

const PAGE = 'https://rezervno.ir/r/vista';

/** سازنده‌ی آیتمِ منو — فقط چیزی که هر تست لازم دارد را override می‌کند. */
function mi(over: Partial<MenuItem> = {}): MenuItem {
  return {
    id: over.id ?? 'm1', name: 'پاستا', emoji: '🍝', price_toman: 185000,
    category: null, description: null, image_url: null, sort_order: 0, ...over,
  };
}

function fullRestaurant(): RestaurantDetail {
  return {
    id: 'x', slug: 'vista', name: 'ویستا', cuisine: 'ایتالیایی', vibes: [], price_band: 3,
    logo_url: null,
    location: { address: 'تهران، زعفرانیه', city: 'تهران', district: 'زعفرانیه', postal_code: '111', country: 'IR', latitude: 35.81, longitude: 51.42 },
    opening_hours: null, timezone: 'Asia/Tehran', rating: 4.6, reviews_count: 12,
    menu: [mi()],
    photos: [{ url: 'https://x/a.jpg', caption: null, category: 'food' }],
  };
}
function minimalRestaurant(): RestaurantDetail {
  return {
    id: 'y', slug: 'geram', name: 'گرام', cuisine: null, vibes: [], price_band: 2,
    logo_url: null,
    location: { address: null, city: null, district: null, postal_code: null, country: null, latitude: null, longitude: null },
    opening_hours: null, timezone: 'Asia/Tehran', rating: null, reviews_count: 0, menu: [], photos: [],
  };
}
function node(graph: unknown, type: string): Record<string, unknown> | undefined {
  const arr = (graph as { '@graph': Record<string, unknown>[] })['@graph'];
  return arr.find((n) => n['@type'] === type);
}

describe('restaurantJsonLd', () => {
  test('دادهٔ کامل → همه‌ی زیرشاخه‌ها ساخته می‌شوند', () => {
    const g = restaurantJsonLd(fullRestaurant(), PAGE) as Record<string, unknown>;
    assert.equal(g['@context'], 'https://schema.org');
    const r = node(g, 'Restaurant')!;
    assert.equal(r.name, 'ویستا');
    assert.equal(r.servesCuisine, 'ایتالیایی');
    assert.equal(r.priceRange, '$$$');
    assert.equal((r.address as Record<string, unknown>)['@type'], 'PostalAddress');
    assert.equal((r.geo as Record<string, unknown>)['@type'], 'GeoCoordinates');
    assert.equal((r.aggregateRating as Record<string, unknown>).ratingValue, 4.6);
    assert.equal((r.aggregateRating as Record<string, unknown>).reviewCount, 12);
    assert.ok(Array.isArray(r.image));
    assert.equal((r.hasMenu as Record<string, unknown>)['@type'], 'Menu');
    assert.ok(node(g, 'BreadcrumbList'));
  });

  test('دادهٔ حداقلی → فیلدهای بدونِ داده حذف می‌شوند (schemaِ معتبر، بدونِ null)', () => {
    const g = restaurantJsonLd(minimalRestaurant(), PAGE) as Record<string, unknown>;
    const r = node(g, 'Restaurant')!;
    assert.equal(r.name, 'گرام');
    assert.equal(r.priceRange, '$$');
    assert.equal(r.servesCuisine, undefined);
    assert.equal(r.address, undefined);
    assert.equal(r.geo, undefined);
    assert.equal(r.aggregateRating, undefined);
    assert.equal(r.image, undefined);
    assert.equal(r.hasMenu, undefined);
  });
});

describe('listJsonLd', () => {
  test('CollectionPage + ItemList با موقعیتِ درست', () => {
    const items: RestaurantListItem[] = [
      { id: '1', slug: 'vista', name: 'ویستا', cuisine: 'ایتالیایی', city: 'تهران', vibes: [], rating: 4.6, reviews_count: 12 },
      { id: '2', slug: 'ava', name: 'آوا', cuisine: 'فیوژن', city: 'تهران', vibes: [], rating: 4.8, reviews_count: 8 },
    ];
    const g = listJsonLd({ name: 'رستوران‌های تهران', pageUrl: 'https://rezervno.ir/city/tehran', items }) as Record<string, unknown>;
    const cp = node(g, 'CollectionPage')!;
    const il = cp.mainEntity as Record<string, unknown>;
    assert.equal(il['@type'], 'ItemList');
    assert.equal(il.numberOfItems, 2);
    const els = il.itemListElement as Record<string, unknown>[];
    assert.equal(els[0].position, 1);
    assert.equal(els[1].position, 2);
    assert.ok(String(els[0].url).endsWith('/r/vista'));
    assert.ok(node(g, 'BreadcrumbList'));
  });
});

describe('faqJsonLd', () => {
  test('FAQPage با Question/Answer', () => {
    const g = faqJsonLd([{ q: 'آیا رزرو دارد؟', a: 'بله.' }]) as Record<string, unknown>;
   assert.equal(g['@type'], 'FAQPage');
   const qs = g.mainEntity as Record<string, unknown>[];
   assert.equal(qs.length, 1);
   assert.equal(qs[0]['@type'], 'Question');
   assert.equal(qs[0].name, 'آیا رزرو دارد؟');
   assert.equal((qs[0].acceptedAnswer as Record<string, unknown>).text, 'بله.');
 });
});

describe('organizationJsonLd', () => {
 test('Organization + WebSite schema برای صفحه‌ی اصلی ساخته می‌شود', () => {
   const g = organizationJsonLd() as Record<string, unknown>;
   assert.equal(g['@context'], 'https://schema.org');
   const graph = g['@graph'] as Record<string, unknown>[];
   const organization = graph.find((node) => node['@type'] === 'Organization');
   const website = graph.find((node) => node['@type'] === 'WebSite');
   assert.ok(organization);
   assert.ok(website);
   assert.equal(organization?.name, 'رزرونو');
   assert.equal((website as Record<string, unknown>).url, 'https://rezervno.ir');
 });
});

// ═══════════════════════════════════════════════════════════════════════
//  منو — قفلِ رگرسیونِ باگی که در ممیزیِ ۲۰۲۶-۰۸-۱۹ پیدا شد.
// ═══════════════════════════════════════════════════════════════════════
describe('menuJsonLd', () => {
  test('قیمت به ریال منتشر می‌شود، نه تومان (باگِ ۱۰ برابری)', () => {
    // تومان واحدِ رسمی نیست؛ IRR یعنی ریال. اگر price_toman خام با
    // priceCurrency:'IRR' برود، هر قیمتی یک‌دهم اعلام می‌شود.
    const m = menuJsonLd([mi({ price_toman: 185_000 })], '#m') as Record<string, unknown>;
    const section = (m.hasMenuSection as Record<string, unknown>[])[0];
    const item = (section.hasMenuItem as Record<string, unknown>[])[0];
    const offer = item.offers as Record<string, unknown>;
    assert.equal(offer.priceCurrency, 'IRR');
    assert.equal(offer.price, 1_850_000, 'باید ۱۰ برابرِ تومان باشد');
    assert.notEqual(offer.price, 185_000, 'مقدارِ خامِ تومان نباید منتشر شود');
  });

  test('tomanToRial ضریبِ دقیقِ ۱۰ دارد', () => {
    assert.equal(tomanToRial(0), 0);
    assert.equal(tomanToRial(1), 10);
    assert.equal(tomanToRial(185_000), 1_850_000);
  });

  test('هر دسته یک MenuSectionِ نام‌دارِ جدا می‌شود', () => {
    const items = [
      mi({ id: 'a', name: 'سوپ', category: 'پیش‌غذا' }),
      mi({ id: 'b', name: 'سالاد', category: 'پیش‌غذا' }),
      mi({ id: 'c', name: 'تیرامیسو', category: 'دسر' }),
    ];
    const m = menuJsonLd(items, '#m') as Record<string, unknown>;
    const sections = m.hasMenuSection as Record<string, unknown>[];
    assert.equal(sections.length, 2, 'دو دسته → دو بخش');
    assert.equal(sections[0].name, 'پیش‌غذا');
    assert.equal((sections[0].hasMenuItem as unknown[]).length, 2);
    assert.equal(sections[1].name, 'دسر');
  });

  test('آیتمِ بدونِ دسته در بخشِ بی‌نام می‌ماند (نه دسته‌ی ساختگیِ «سایر»)', () => {
    const m = menuJsonLd([mi({ category: null })], '#m') as Record<string, unknown>;
    const section = (m.hasMenuSection as Record<string, unknown>[])[0];
    assert.equal(section.name, undefined, 'نامِ جعلی نباید ساخته شود');
  });

  test('توضیح و عکس فقط وقتی واقعاً هستند emit می‌شوند', () => {
    const withData = menuJsonLd([mi({ description: 'با سسِ قارچ', image_url: 'https://x/p.jpg' })], '#m') as Record<string, unknown>;
    const a = ((withData.hasMenuSection as Record<string, unknown>[])[0].hasMenuItem as Record<string, unknown>[])[0];
    assert.equal(a.description, 'با سسِ قارچ');
    assert.equal(a.image, 'https://x/p.jpg');

    const without = menuJsonLd([mi()], '#m') as Record<string, unknown>;
    const b = ((without.hasMenuSection as Record<string, unknown>[])[0].hasMenuItem as Record<string, unknown>[])[0];
    assert.ok(!('description' in b), 'توضیحِ null نباید کلیدِ خالی بسازد');
    assert.ok(!('image' in b), 'عکسِ null نباید کلیدِ خالی بسازد');
  });

  test('منویِ خالی → رستوران اصلاً hasMenu نمی‌گیرد', () => {
    const g = restaurantJsonLd(minimalRestaurant(), PAGE) as Record<string, unknown>;
    const r = node(g, 'Restaurant')!;
    assert.ok(!('hasMenu' in r), 'بدونِ آیتم نباید منویِ خالی ادعا شود');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  ساعتِ کاری — مقدارِ JSONِ آزاد از API می‌آید، پس هر شکلِ نامعتبری ممکن است.
// ═══════════════════════════════════════════════════════════════════════
describe('formatOpeningHours', () => {
  test('شکلِ معتبر → ردیفِ روزها با ارقامِ فارسی', () => {
    const rows = formatOpeningHours({ '1': [['12:00', '16:00'], ['19:00', '23:30']], '2': [] });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].day, 'دوشنبه');
    assert.equal(rows[0].text, '۱۲:۰۰–۱۶:۰۰ · ۱۹:۰۰–۲۳:۳۰');
    assert.equal(rows[1].text, 'تعطیل');
  });

  test('null/رشته/آرایه → آرایه‌ی خالی، بدونِ پرتابِ خطا', () => {
    for (const bad of [null, undefined, 'باز', 42, [], [['12:00', '16:00']]]) {
      assert.deepEqual(formatOpeningHours(bad), [], `ورودیِ ${JSON.stringify(bad)}`);
    }
  });

  test('ساعتِ بدشکل نادیده گرفته می‌شود، نه اینکه «تعطیل» جا بزند', () => {
    // «۲۵:۰۰» ساعت نیست. اعلامِ تعطیلی برایِ روزی که رستوران باز است، بدتر
    // از نگفتن است — پس آن روز اصلاً ردیف نمی‌گیرد.
    assert.deepEqual(formatOpeningHours({ '3': [['25:00', '99:99']] }), []);
  });

  test('همه‌ی روزها تعطیل → چیزی نشان داده نمی‌شود', () => {
    assert.deepEqual(formatOpeningHours({ '0': [], '1': [], '2': [] }), []);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  گروه‌بندیِ منو — همان تابعی که هم صفحه‌ی رستوران و هم صفحه‌ی QR
//  از آن استفاده می‌کنند، پس یک باگ اینجا هر دو را با هم خراب می‌کند.
// ═══════════════════════════════════════════════════════════════════════
describe('groupByCategory', () => {
  test('ترتیبِ ورودی (که API با sort_order چیده) حفظ می‌شود', async () => {
    const { groupByCategory } = await import('../components/MenuBoard.tsx');
    const items = [
      mi({ id: '1', name: 'سوپ', category: 'پیش‌غذا' }),
      mi({ id: '2', name: 'استیک', category: 'اصلی' }),
      mi({ id: '3', name: 'سالاد', category: 'پیش‌غذا' }),
    ];
    const s = groupByCategory(items);
    // «پیش‌غذا» اول است چون اولین آیتم مالِ آن بود — نه چون الفبایی مرتب شده.
    assert.deepEqual(s.map((x) => x.name), ['پیش‌غذا', 'اصلی']);
    assert.deepEqual(s[0].items.map((i) => i.name), ['سوپ', 'سالاد']);
  });

  test('آیتمِ بدونِ دسته → بخشی با نامِ null (نه رشته‌ی خالی، نه «سایر»)', async () => {
    const { groupByCategory } = await import('../components/MenuBoard.tsx');
    const s = groupByCategory([mi({ category: null })]);
    assert.equal(s.length, 1);
    assert.equal(s[0].name, null);
  });

  test('منویِ خالی → هیچ بخشی', async () => {
    const { groupByCategory } = await import('../components/MenuBoard.tsx');
    assert.deepEqual(groupByCategory([]), []);
  });

  test('sectionId برایِ هر بخش یکتاست (لنگرِ چیپ‌ها نباید تصادم کند)', async () => {
    const { groupByCategory, sectionId } = await import('../components/MenuBoard.tsx');
    const s = groupByCategory([
      mi({ id: '1', category: 'الف' }),
      mi({ id: '2', category: 'ب' }),
      mi({ id: '3', category: null }),
    ]);
    const ids = s.map((x, i) => sectionId(x.name, i));
    assert.equal(new Set(ids).size, ids.length, 'شناسه‌ی تکراری یعنی پرشِ چیپ به بخشِ اشتباه');
  });
});
