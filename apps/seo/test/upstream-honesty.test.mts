// ═══════════════════════════════════════════════════════════════════════
//  «در دسترس نیست» هرگز نباید «وجود ندارد» شود  (پروتکل §۹ و §۱۰)
//
//  یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۵: همه‌ی fetcherهایِ apps/seo در هر شکستی `null`
//  (یا `[]`) برمی‌گرداندند، و صفحه‌ها روی همان `notFound()` صدا می‌زنند. یعنی
//  یک قطعیِ گذرایِ API تبدیل می‌شد به HTTP 404 رویِ صفحه‌ی رستورانی که
//  واقعاً وجود دارد — و چون این صفحه‌ها ISR هستند (`revalidate = 300`)، آن
//  ۴۰۴ کش می‌شد و به Googlebot سرو می‌شد ⇒ حذف از ایندکس.
//
//  این تست همان تفکیک را قفل می‌کند:
//    ۴۰۴ِ بالادست            → null  (صفحه ۴۰۴ می‌دهد — درست)
//    ۵xx / شبکه / پیکربندی‌نشده → throw (صفحه ۵۰۰ می‌دهد، کش نمی‌شود)
// ═══════════════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.SEO_API_BASE = 'http://api.test';
const api = await import('../lib/api.ts');
const { fetchRestaurant, fetchRestaurantList, fetchPublicMenu, UpstreamUnavailableError } = api;

const realFetch = globalThis.fetch;
/** پاسخِ ساختگی با وضعیتِ دلخواه. */
function stubStatus(status: number, body: unknown = {}) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
}
/** شکستِ شبکه (همان چیزی که fetch در قطعی می‌اندازد). */
function stubNetworkError() {
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
}
function restore() { globalThis.fetch = realFetch; }

describe('تفکیکِ «نیست» از «نمی‌دانیم» — صفحه‌ی رستوران', () => {
  test('۴۰۴ِ بالادست → null (اجازه‌ی notFound به صفحه)', async () => {
    stubStatus(404);
    assert.equal(await fetchRestaurant('ghost'), null);
    restore();
  });

  test('۵۰۰ِ بالادست → خطا، نه null (وگرنه ۴۰۴ِ کش‌شده و حذف از ایندکس)', async () => {
    stubStatus(500);
    await assert.rejects(() => fetchRestaurant('real-place'), UpstreamUnavailableError);
    restore();
  });

  test('قطعیِ شبکه → خطا، نه null', async () => {
    stubNetworkError();
    await assert.rejects(() => fetchRestaurant('real-place'), UpstreamUnavailableError);
    restore();
  });

  test('۵۰۳ (نگهداریِ بالادست) → خطا', async () => {
    stubStatus(503);
    await assert.rejects(() => fetchRestaurant('real-place'), UpstreamUnavailableError);
    restore();
  });
});

describe('تفکیکِ «نیست» از «نمی‌دانیم» — صفحه‌ی منو', () => {
  test('۴۰۴ → null', async () => {
    stubStatus(404);
    assert.equal(await fetchPublicMenu('ghost'), null);
    restore();
  });

  test('۵۰۲ → خطا', async () => {
    stubStatus(502);
    await assert.rejects(() => fetchPublicMenu('real-place'), UpstreamUnavailableError);
    restore();
  });

  test('رستورانِ بدونِ منو (۲۰۰ با items خالی) همچنان حالتِ خالیِ صادق است، نه خطا', async () => {
    stubStatus(200, { restaurant: { id: 'x', slug: 's', name: 'ن', cuisine: null, city: null }, items: [] });
    const m = await fetchPublicMenu('real-place');
    assert.ok(m, 'باید آبجکت بدهد');
    assert.deepEqual(m!.items, []);
    restore();
  });
});

describe('فهرستِ شهر/آشپزی — strict فقط جایی که تصمیمِ ۴۰۴ می‌سازد', () => {
  test('strict + ۵۰۰ → خطا (صفحه‌ی شهر نباید ۴۰۴ کند)', async () => {
    stubStatus(500);
    await assert.rejects(() => fetchRestaurantList({ city: 'تهران' }, 300, true), UpstreamUnavailableError);
    restore();
  });

  test('strict + قطعیِ شبکه → خطا', async () => {
    stubNetworkError();
    await assert.rejects(() => fetchRestaurantList({ city: 'تهران' }, 300, true), UpstreamUnavailableError);
    restore();
  });

  test('غیرِstrict (رستوران‌های مشابه) + ۵۰۰ → [] و صفحه سالم می‌ماند', async () => {
    stubStatus(500);
    assert.deepEqual(await fetchRestaurantList({ city: 'تهران' }), []);
    restore();
  });

  test('strict + ۲۰۰ِ واقعاً خالی → [] (نبودِ واقعی، نه شکست)', async () => {
    stubStatus(200, { items: [] });
    assert.deepEqual(await fetchRestaurantList({ city: 'شهرِ خالی' }, 300, true), []);
    restore();
  });
});

describe('پیکربندیِ غایب صادقانه اعلام می‌شود', () => {
  test('SEO_API_BASE تنظیم‌نشده → خطا، نه «رستوران پیدا نشد»', async () => {
    // ماژول با base خالی دوباره لود می‌شود (کشِ ESM با query دور زده می‌شود).
    const prev = process.env.SEO_API_BASE;
    process.env.SEO_API_BASE = '';
    const fresh = await import('../lib/api.ts?nobase');
    await assert.rejects(() => fresh.fetchRestaurant('x'), fresh.UpstreamUnavailableError);
    process.env.SEO_API_BASE = prev;
  });
});
