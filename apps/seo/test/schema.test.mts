import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا (سازگار با tsx+node:test) — سازنده‌های خالصِ JSON-LD.
const { restaurantJsonLd, listJsonLd, faqJsonLd, organizationJsonLd } = await import('../lib/schema.ts');
import type { RestaurantDetail, RestaurantListItem } from '../lib/api';

const PAGE = 'https://rezervno.ir/r/vista';

function fullRestaurant(): RestaurantDetail {
  return {
    id: 'x', slug: 'vista', name: 'ویستا', cuisine: 'ایتالیایی', vibes: [], price_band: 3,
    location: { address: 'تهران، زعفرانیه', city: 'تهران', district: 'زعفرانیه', postal_code: '111', country: 'IR', latitude: 35.81, longitude: 51.42 },
    opening_hours: null, timezone: 'Asia/Tehran', rating: 4.6, reviews_count: 12,
    menu: [{ name: 'پاستا', emoji: '🍝', price_toman: 185000 }],
    photos: [{ url: 'https://x/a.jpg', caption: null, category: 'food' }],
  };
}
function minimalRestaurant(): RestaurantDetail {
  return {
    id: 'y', slug: 'geram', name: 'گرام', cuisine: null, vibes: [], price_band: 2,
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
