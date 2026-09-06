// ═══════════════════════════════════════════════════════════════════════
//  «قطعیِ API» هرگز نباید به یک **قیمتِ مشخص و اشتباه** تبدیل شود (§۱۰)
//
//  یافته‌ی واقعیِ ۲۰۲۶-۰۹-۰۷ (directive 028): `getPlans` روی
//  `plans && plans.length ? plans : fallbackPlans(fallback)` بود و `getJson`
//  در **هر** شکستی `null` می‌داد — شبکه، DNS، تایم‌اوت، ۵xx. یعنی یک قطعیِ
//  گذرا به `content/site-content.json` سقوط می‌کرد که قیمت‌های ثابتِ
//  ۱۸/۳۴/۶۵ میلیون را کامیت‌شده دارد.
//
//  قیمتِ زنده از `db.sitePlan` می‌آید و از استودیو ویرایش می‌شود؛ فایلِ
//  کامیت‌شده فقط با یک کامیتِ کد عوض می‌شود. هیچ چیزی این دو را همگام
//  نمی‌کند. پس fallback تا اولین تغییرِ قیمت درست است و از آن به بعد
//  **برای همیشه بی‌صدا غلط**.
//
//  و چون این صفحه‌ها ISR هستند (`/pricing` → `revalidate = 120`)، آن قیمتِ
//  غلط **کش می‌شود** و تا دو دقیقه بدونِ هیچ خطایی سرو می‌شود. این از
//  کلاسِ «نمی‌دانیم را خالی نشان بده» بدتر است: بخشِ خالی کاربر را به
//  رفرش دعوت می‌کند، یک عددِ قاطع نه.
//
//  تفکیکِ اجباری — همان الگویِ apps/seo/lib/api.ts:10-45:
//    • پاسخِ واقعیِ بالادست (۲۰۰) → همان، حتی اگر خالی باشد
//    • هر شکستِ زیرساختی        → throw (ISR آخرین صفحه‌ی سالم را نگه می‌دارد)
//
//  ⚠️ این تست بدونِ **هر دو** حالت بی‌ارزش است: اگر فقط throw را بسنجد،
//  «همه‌چیز حالا throw می‌کند» هم سبز می‌شود. پس فهرستِ واقعاً خالی و
//  fallbackِ متنِ ویترین هم اینجا قفل شده‌اند.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.SITE_API_BASE = 'http://api.test';
// namespace import عمدی است: پیش از رفع، `UpstreamUnavailableError` هنوز
// وجود ندارد و یک import نام‌دار کلِ فایل را با خطای ماژول می‌شکست — که
// «قرمزِ ساختاری» است نه «قرمزِ رفتاری». با این شکل، قرمزِ پیش از رفع دقیقاً
// همان ادعای واقعی است: getPlans به‌جای rejectکردن، fallback را resolve می‌کند.
const api = await import('../lib/site-api.ts');
const { getPlans, getPage, getFaqs, getArticles, getReleaseNotes } = api;

const realFetch = globalThis.fetch;
/** پاسخِ ساختگی با وضعیتِ دلخواه. */
function stubStatus(status: number, body: unknown = {}) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
}
/** شکستِ شبکه — همان چیزی که fetch در قطعیِ واقعی می‌اندازد. */
function stubNetworkError() {
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
}
function restore() { globalThis.fetch = realFetch; }

/** قیمت‌های کامیت‌شده — هیچ‌کدام نباید هنگامِ قطعی به کاربر برسد. */
const COMMITTED_PRICES = [18_000_000, 34_000_000, 65_000_000];

describe('قیمت هنگامِ قطعیِ بالادست جعل نمی‌شود', () => {
  test('۵۰۰ِ بالادست → خطا، نه قیمتِ کامیت‌شده', async () => {
    stubStatus(500);
    await assert.rejects(
      () => getPlans(),
      api.UpstreamUnavailableError,
      'getPlans در ۵۰۰ باید throw کند تا ISR آخرین قیمتِ سالم را نگه دارد',
    );
    restore();
  });

  test('۵۰۳ (نگهداریِ بالادست) → خطا', async () => {
    stubStatus(503);
    await assert.rejects(() => getPlans(), api.UpstreamUnavailableError);
    restore();
  });

  test('قطعیِ شبکه/DNS/تایم‌اوت → خطا', async () => {
    stubNetworkError();
    await assert.rejects(() => getPlans(), api.UpstreamUnavailableError);
    restore();
  });

  test('بدنه‌ی خرابِ غیر-JSON (صفحه‌ی گیت‌وی) → خطا، نه قیمتِ کامیت‌شده', async () => {
    globalThis.fetch = (async () =>
      new Response('<html>۵۰۲ Bad Gateway</html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
    await assert.rejects(() => getPlans(), api.UpstreamUnavailableError);
    restore();
  });

  test('پاسخِ ۲۰۰ با شکلِ نامعتبر (items آرایه نیست) → خطا', async () => {
    stubStatus(200, { items: 'not-an-array' });
    await assert.rejects(() => getPlans(), api.UpstreamUnavailableError);
    restore();
  });

  // ── ادعایِ مکمل: هیچ‌یک از مسیرهای بالا نباید عددِ کامیت‌شده را برگرداند.
  // بدونِ این، یک رگرسیونِ «throw حذف شد ولی fallback ماند» می‌توانست با
  // تغییرِ نوعِ خطا از تست‌های بالا رد شود.
  test('هیچ مسیرِ شکستی قیمتِ کامیت‌شده را برنمی‌گرداند', async () => {
    for (const arrange of [() => stubStatus(500), () => stubStatus(503), stubNetworkError]) {
      arrange();
      let returned: unknown = null;
      try { returned = await getPlans(); } catch { returned = null; }
      if (returned !== null) {
        const prices = (returned as { price_toman: number }[]).map((p) => p.price_toman);
        for (const committed of COMMITTED_PRICES) {
          assert.ok(
            !prices.includes(committed),
            `قیمتِ کامیت‌شده‌ی ${committed} هنگامِ قطعی به کاربر رسید`,
          );
        }
      }
      restore();
    }
  });
});

describe('فهرستِ واقعاً خالی همچنان خالی است — نه خطا، نه fallback', () => {
  // ⚠️ این بلوک کنترلِ مثبتِ بلوکِ بالا است. بدونِ آن، «همه‌چیز throw می‌کند»
  // و «قطعی درست مدیریت شد» هر دو یک سوئیتِ سبز تولید می‌کنند.
  test('۲۰۰ با items خالی → [] (مدیر همه‌ی پلن‌ها را غیرفعال کرده)', async () => {
    stubStatus(200, { items: [] });
    const plans = await getPlans();
    assert.deepEqual(plans, [], 'خالیِ واقعیِ بالادست باید خالی بماند، نه قیمتِ کامیت‌شده');
    restore();
  });

  test('۲۰۰ با پلنِ واقعی → همان پلن، دست‌نخورده', async () => {
    const live = {
      key: 'm3', name: 'سه‌ماهه', tagline: null, months: 3,
      price_toman: 21_000_000, monthly_toman: 7_000_000, compare_at_toman: null,
      saving_toman: 0, saving_percent: 0, badge: null, features: [], highlight: false, sort_order: 0,
    };
    stubStatus(200, { items: [live] });
    const plans = await getPlans();
    assert.equal(plans.length, 1);
    assert.equal(plans[0].price_toman, 21_000_000, 'قیمتِ زنده باید عبور کند، نه بازنویسی شود');
    restore();
  });
});

describe('متنِ ویترین همچنان fallback دارد — تفکیک بر پایه‌ی «تعهد» است، نه سراسری', () => {
  // اگر این‌ها هم throw کنند یعنی رفع بیش از حد جارو کشیده و کلِ سایت با
  // یک قطعیِ API پایین می‌آید. متنِ ثابت گمراه‌کننده نیست؛ قیمتِ ثابت هست.
  test('getPage در ۵۰۰ همچنان صفحه‌ی حالتِ امن را می‌دهد', async () => {
    stubStatus(500);
    const page = await getPage('about');
    assert.equal(page.slug, 'about');
    restore();
  });

  test('getFaqs در قطعیِ شبکه همچنان پرسش‌های حالتِ امن را می‌دهد', async () => {
    stubNetworkError();
    const faqs = await getFaqs('pricing');
    assert.ok(Array.isArray(faqs), 'باید آرایه بدهد، نه throw');
    restore();
  });

  test('getArticles در ۵۰۰ همچنان مقاله‌های حالتِ امن را می‌دهد', async () => {
    stubStatus(500);
    const articles = await getArticles({ limit: 5 });
    assert.ok(Array.isArray(articles));
    restore();
  });

  test('getReleaseNotes در ۵۰۰ همچنان یادداشت‌های حالتِ امن را می‌دهد', async () => {
    stubStatus(500);
    const notes = await getReleaseNotes();
    assert.ok(Array.isArray(notes));
    restore();
  });
});

describe('دستیار در قطعی سکوت می‌کند، نه اینکه قیمتِ کهنه بگوید', () => {
  // buildKb از layoutِ ریشه صدا زده می‌شود (app/layout.tsx:70) — یک throw
  // آنجا کلِ سایت را پایین می‌آورد. پس اینجا «حذفِ سندِ قیمت» درست است، و
  // این تست هر دو خطا را می‌گیرد: هم کرشِ سراسری، هم قیمتِ جعلی.
  test('۵۰۰ِ بالادست → پیکره ساخته می‌شود ولی سندِ قیمت ندارد', async () => {
    stubStatus(500);
    const { buildKb } = await import('../lib/kb.ts');
    const docs = await buildKb();
    assert.ok(docs.length > 0, 'دستیار باید با پرسش‌ها و مقاله‌ها کار کند');
    assert.ok(
      !docs.some((d) => d.id === 'plans:all'),
      'سندِ قیمت نباید ساخته شود وقتی قیمتِ زنده در دسترس نیست',
    );
    const committedToman = '۱۸٬۰۰۰٬۰۰۰ تومان';
    assert.ok(
      !docs.some((d) => d.body.includes(committedToman)),
      `قیمتِ کامیت‌شده «${committedToman}» به پاسخِ دستیار نشت کرد`,
    );
    restore();
  });
});

describe('حالتِ امنِ اعلام‌شده (بدونِ SITE_API_BASE) هنوز بیلد می‌شود', () => {
  // ci.yml:539 عمداً بیلدِ landing را بدونِ SITE_API_BASE اجرا می‌کند: «باید
  // در حالتِ امن هم سبز باشد، وگرنه یک قطعیِ API می‌تواند دیپلوی را هم زمین
  // بزند». وقتی هیچ APIای پیکربندی نشده، هیچ دیتابیسی در تصویر نیست که
  // بتواند واگرا شود — فایلِ کامیت‌شده تنها مرجع است، پس دروغی در کار نیست.
  test('بدونِ API پیکربندی‌شده → قیمتِ کامیت‌شده، بدونِ throw', async () => {
    const prev = process.env.SITE_API_BASE;
    const prevSeo = process.env.SEO_API_BASE;
    process.env.SITE_API_BASE = '';
    process.env.SEO_API_BASE = '';
    const fresh = await import('../lib/site-api.ts?noplanbase');
    const plans = await fresh.getPlans();
    assert.ok(plans.length > 0, 'حالتِ امن باید پلن بدهد وگرنه بیلدِ CI می‌شکند');
    process.env.SITE_API_BASE = prev;
    process.env.SEO_API_BASE = prevSeo;
  });
});
