// ═══════════════════════════════════════════════════════════════════════
//  توضیحِ متایِ /pricing نباید قیمتِ hardcode داشته باشد
//
//  یافته‌ی واقعیِ ۲۰۲۶-۰۹-۰۷ (خواهرِ directive 028): کامیتِ 4c4df28 سقوطِ
//  `getPlans` به قیمتِ کامیت‌شده را بست، ولی **متادیتای همان صفحه** هنوز
//  `export const metadata` ثابت بود و در توضیحش نوشته بود
//  «سه‌ماهه ۱۸ میلیون، شش‌ماهه ۳۴ میلیون و یک‌ساله ۶۵ میلیون تومان».
//
//  آن رشته هیچ‌وقت `db.sitePlan` را نمی‌خواند. یعنی برخلافِ بدنه‌ی صفحه،
//  برای غلط‌شدنش **هیچ قطعی‌ای لازم نیست**: از اولین تغییرِ قیمت در استودیو
//  غلط است، حتی وقتی API کاملاً سالم است. و این دقیقاً همان متنی است که
//  گوگل زیرِ عنوان نشان می‌دهد — یعنی جایی که کاربر قیمت را اول می‌بیند.
//
//  قرارداد اینجا دو طرفه است و بدونِ **هر دو** طرف بی‌ارزش می‌شود:
//    ۱) وقتی قیمتِ زنده هست → همان عددهای زنده در توضیح بیایند
//       (با دو دیتاستِ متفاوت سنجیده می‌شود، وگرنه یک رشته‌ی ثابت هم سبز می‌شد)
//    ۲) وقتی قیمتِ زنده نیست → توضیح **بدونِ قیمت**، نه قیمتِ کهنه، و
//       بدونِ throw. «نمی‌دانیم» را با یک عددِ قاطع پر نکن.
//
//  «قیمتِ زنده نیست» سه حالتِ متفاوت دارد و هر سه اینجا هستند: API اصلاً
//  پیکربندی نشده (حالتِ امنِ بیلدِ CI — ci.yml:539)، API پیکربندی شده ولی
//  خطا می‌دهد، و پاسخِ سالمِ خالی.
//
//  ⚠️ حالتِ «پیکربندی‌نشده» ظریف‌ترین است: آنجا `getPlans` throw نمی‌کند،
//  بلکه fallbackِ content/site-content.json را می‌دهد — همان ۱۸/۳۴/۶۵.
//  اگر متادیتا آن را بپذیرد، همان نقص یک لایه پایین‌تر برگشته است.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// باید پیش از importِ ماژولِ صفحه ست شود: site-api.ts آدرسِ سرور را در
// scopeِ ماژول می‌خواند (site-api.ts:25).
process.env.SITE_API_BASE = 'http://api.test';
const page = await import('../app/pricing/page.tsx');

const realFetch = globalThis.fetch;
function restore() { globalThis.fetch = realFetch; }

/** پاسخِ ساختگی با وضعیتِ دلخواه — همان الگوی plan-price-honesty. */
function stubStatus(status: number, body: unknown = {}) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
}
function stubNetworkError() {
  globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
}

/** یک پلنِ زنده با قیمتِ دلخواه. */
function livePlan(key: string, name: string, months: number, price: number) {
  return {
    key, name, tagline: null, months,
    price_toman: price, monthly_toman: Math.round(price / months),
    compare_at_toman: null, saving_toman: 0, saving_percent: 0,
    badge: null, features: [], highlight: false, sort_order: 0,
  };
}

/**
 * فراخوانِ متادیتای واقعیِ همان routeی که Next اجرا می‌کند.
 *
 * عمداً `generateMetadata`ِ خودِ ماژولِ صفحه صدا زده می‌شود، نه یک helperِ
 * جدا: گاردی که موضوعش را از یک ماژولِ کمکی می‌گیرد در حالی که خطر در
 * فایلِ route زندگی می‌کند، به دلیلِ ساختاری سبز است نه امن. اگر روزی
 * page.tsx دوباره به `export const metadata`ِ ثابت برگردد، این تابع
 * `undefined` می‌شود و این تست می‌شکند — همان چیزی که باید.
 */
async function meta(): Promise<Record<string, unknown>> {
  const gen = (page as { generateMetadata?: () => unknown }).generateMetadata;
  assert.equal(
    typeof gen, 'function',
    '/pricing باید generateMetadata داشته باشد؛ متادیتای ثابت نمی‌تواند قیمتِ زنده را بخواند',
  );
  const m = await (gen as () => Promise<unknown>)();
  // round-tripِ JSON دقیقاً همان دیدی است که مبنا با آن گرفته شد و کلیدهای
  // undefined را یکدست می‌کند؛ چون هیچ مقدارِ موردِ انتظاری undefined نیست،
  // چیزی را پنهان نمی‌کند (کلیدِ گم‌شده باز هم mismatch می‌دهد).
  return JSON.parse(JSON.stringify(m)) as Record<string, unknown>;
}

async function description(): Promise<string> {
  const d = (await meta()).description;
  assert.equal(typeof d, 'string', 'توضیح باید رشته باشد');
  return d as string;
}

/** قیمت‌های کامیت‌شده‌ی content/site-content.json — هیچ‌کدام نباید در متا بیاید. */
const COMMITTED = ['۱۸ میلیون', '۳۴ میلیون', '۶۵ میلیون'];

/** هیچ ادعای قیمتی در متن نیست. */
function assertPriceless(desc: string, where: string) {
  assert.ok(!desc.includes('میلیون'), `${where}: واحدِ «میلیون» در توضیح ماند`);
  assert.ok(!desc.includes('تومان'), `${where}: واحدِ «تومان» در توضیح ماند`);
  for (const c of COMMITTED) {
    assert.ok(!desc.includes(c), `${where}: قیمتِ کامیت‌شده‌ی «${c}» به متایِ گوگل رسید`);
  }
  // «حذفِ قیمت» نباید به «حذفِ توضیح» تبدیل شود — صفحه بدونِ description
  // در نتایج بدتر از صفحه‌ی بی‌قیمت است.
  assert.ok(desc.length > 40, `${where}: توضیح عملاً خالی شد (${desc.length} نویسه)`);
}

/**
 * مبنایِ متادیتای پیش از تغییر (خروجیِ واقعیِ همین ماژول، ثبت‌شده در
 * ۲۰۲۶-۰۹-۰۷). همه‌چیز جز description باید بیت‌به‌بیت همین بماند: دامنه‌ی
 * این کار فقط ادعای قیمت است، نه عنوان/canonical/کلیدواژه/robots/OG.
 */
const TITLE = 'قیمت‌گذاری رزرونو | پلن‌های ۳، ۶ و ۱۲ ماهه';
const URL_ = 'https://rezervno.ir/pricing';
const IMAGE = 'https://rezervno.ir/pricing/opengraph-image';
function expectedMetadata(desc: string) {
  return {
    title: { absolute: TITLE },
    description: desc,
    alternates: { canonical: URL_, languages: { 'fa-IR': URL_, 'x-default': URL_ } },
    keywords: ['قیمت نرم افزار رستوران', 'اشتراک رزرونو', 'هزینه سیستم رزرو رستوران'],
    robots: {
      index: true, follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    openGraph: {
      type: 'website', url: URL_, siteName: 'رزرونو', locale: 'fa_IR',
      title: TITLE, description: desc,
      images: [{ url: IMAGE, width: 1200, height: 630, alt: TITLE }],
    },
    twitter: { card: 'summary_large_image', title: TITLE, description: desc, images: [IMAGE] },
  };
}

describe('۱ — با قیمتِ زنده، توضیح همان قیمتِ زنده را می‌گوید', () => {
  test('قیمت‌های دیتابیس در توضیح می‌آیند، نه قیمتِ کامیت‌شده', async () => {
    stubStatus(200, {
      items: [
        livePlan('m3', 'سه‌ماهه', 3, 21_000_000),
        livePlan('m6', 'شش‌ماهه', 6, 39_000_000),
        livePlan('m12', 'یک‌ساله', 12, 74_000_000),
      ],
    });
    const desc = await description();
    restore();
    for (const price of ['۲۱ میلیون تومان', '۳۹ میلیون تومان', '۷۴ میلیون تومان']) {
      assert.ok(desc.includes(price), `قیمتِ زنده‌ی «${price}» در توضیح نیست: ${desc}`);
    }
    for (const c of COMMITTED) {
      assert.ok(!desc.includes(c), `قیمتِ کامیت‌شده‌ی «${c}» با وجودِ دیتای زنده در توضیح ماند`);
    }
  });

  // ⚠️ بدونِ این تست، یک رشته‌ی کاملاً ثابتِ دیگر هم از تستِ بالا رد می‌شد.
  // ادعا این است که توضیح **تابعِ داده** است، نه اینکه یک بار درست نوشته شده.
  test('با دیتای متفاوت، توضیح هم متفاوت می‌شود', async () => {
    stubStatus(200, { items: [livePlan('m3', 'سه‌ماهه', 3, 21_000_000)] });
    const first = await description();
    restore();

    stubStatus(200, { items: [livePlan('m3', 'سه‌ماهه', 3, 26_500_000)] });
    const second = await description();
    restore();

    assert.notEqual(first, second, 'تغییرِ قیمت در دیتابیس هیچ اثری روی توضیح نگذاشت');
    assert.ok(first.includes('۲۱ میلیون تومان'), `دیتاستِ اول در توضیح نیست: ${first}`);
    assert.ok(second.includes('۲۶.۵ میلیون تومان'), `دیتاستِ دوم در توضیح نیست: ${second}`);
    assert.ok(!second.includes('۲۱ میلیون'), 'قیمتِ دیتاستِ قبلی در توضیحِ بعدی ماند');
  });

  test('نامِ پلن هم از داده می‌آید، نه از متنِ ثابت', async () => {
    stubStatus(200, { items: [livePlan('m1', 'یک‌ماهه [DEMO]', 1, 7_000_000)] });
    const desc = await description();
    restore();
    assert.ok(desc.includes('یک‌ماهه [DEMO]'), `نامِ پلنِ زنده در توضیح نیست: ${desc}`);
  });

  test('جز توضیح، هیچ فیلدِ متادیتا عوض نشده است', async () => {
    stubStatus(200, { items: [livePlan('m3', 'سه‌ماهه', 3, 21_000_000)] });
    const m = await meta();
    restore();
    assert.deepEqual(m, expectedMetadata(m.description as string));
  });
});

describe('۲ — بدونِ قیمتِ زنده، توضیح بدونِ قیمت است و throw نمی‌کند', () => {
  test('۵۰۰ِ بالادست → توضیحِ بدونِ قیمت', async () => {
    stubStatus(500);
    await assert.doesNotReject(() => meta(), 'generateMetadata نباید throw کند؛ متایِ کلِ صفحه از بین می‌رود');
    const desc = await description();
    restore();
    assertPriceless(desc, '۵۰۰ِ بالادست');
  });

  test('قطعیِ شبکه/DNS → توضیحِ بدونِ قیمت', async () => {
    stubNetworkError();
    const desc = await description();
    restore();
    assertPriceless(desc, 'قطعیِ شبکه');
  });

  test('بدنه‌ی خرابِ غیر-JSON (صفحه‌ی گیت‌وی) → توضیحِ بدونِ قیمت', async () => {
    globalThis.fetch = (async () =>
      new Response('<html>۵۰۲ Bad Gateway</html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
    const desc = await description();
    restore();
    assertPriceless(desc, 'بدنه‌ی خراب');
  });

  test('پاسخِ سالمِ خالی (مدیر همه را غیرفعال کرده) → توضیحِ بدونِ قیمت', async () => {
    stubStatus(200, { items: [] });
    const desc = await description();
    restore();
    assertPriceless(desc, 'فهرستِ خالی');
  });

  test('جز توضیح، در حالتِ قطعی هم هیچ فیلدِ دیگری عوض نمی‌شود', async () => {
    stubStatus(500);
    const m = await meta();
    restore();
    assert.deepEqual(m, expectedMetadata(m.description as string));
  });
});

describe('۳ — حالتِ امنِ بیلدِ CI: بدونِ SITE_API_BASE', () => {
  // ci.yml:539 عمداً بیلدِ landing را بدونِ SITE_API_BASE اجرا می‌کند تا یک
  // قطعیِ API نتواند دیپلوی را هم زمین بزند. این حالت از دو جهت خطرناک است:
  //   • `getPlans` اینجا throw **نمی‌کند** — fallbackِ ۱۸/۳۴/۶۵ را می‌دهد،
  //     پس یک generateMetadataی ساده‌لوح همان قیمتِ کهنه را در متا می‌کارد.
  //   • اگر throw کند، بیلدِ CI و پروداکشن می‌شکند.
  const withoutApi = async <T>(fn: () => Promise<T>): Promise<T> => {
    const prevSite = process.env.SITE_API_BASE;
    const prevSeo = process.env.SEO_API_BASE;
    process.env.SITE_API_BASE = '';
    process.env.SEO_API_BASE = '';
    try {
      return await fn();
    } finally {
      // ⚠️ `process.env.X = undefined` رشته‌ی "undefined" می‌گذارد، نه پاک می‌کند —
      // و چون این helper چند تست صدایش می‌زنند، مقدارِ آلوده به تست‌های بعدی
      // نشت می‌کرد و `SERVER_BASE` را truthy می‌ساخت.
      if (prevSite === undefined) delete process.env.SITE_API_BASE; else process.env.SITE_API_BASE = prevSite;
      if (prevSeo === undefined) delete process.env.SEO_API_BASE; else process.env.SEO_API_BASE = prevSeo;
    }
  };

  // ⚠️ خطای خودم، ثبت‌شده: نسخه‌ی اولِ این تست بدونِ stub نوشته شده بود و
  // با برداشتنِ گاردِ env هم **سبز می‌ماند** — چون site-api.ts آدرس را در
  // scopeِ ماژول می‌خواند و در فرآیندِ تست همچنان 'http://api.test' است، پس
  // مسیر به fetchِ واقعی و شکستِ شبکه می‌رسید و توضیح تصادفاً بی‌قیمت
  // می‌شد. یعنی تستی که وقتی موضوعش غایب است سبز می‌ماند. با stubِ زیر،
  // بالادست عمداً «سالم» است و همان ۱۸/۳۴/۶۵ را می‌دهد: تنها چیزی که جلوی
  // نشتِ قیمت را می‌گیرد خودِ گارد است.
  test('قیمتِ کامیت‌شده به متا نشت نمی‌کند — حتی وقتی بالادست همان را بدهد', async () => {
    stubStatus(200, {
      items: [
        livePlan('m3', 'سه‌ماهه', 3, 18_000_000),
        livePlan('m6', 'شش‌ماهه', 6, 34_000_000),
        livePlan('m12', 'یک‌ساله', 12, 65_000_000),
      ],
    });
    const desc = await withoutApi(() => description());
    restore();
    assertPriceless(desc, 'بدونِ SITE_API_BASE');
  });

  test('throw نمی‌کند (وگرنه بیلدِ CI و پروداکشن می‌شکند)', async () => {
    await withoutApi(() => assert.doesNotReject(() => meta()));
  });

  // ادعایِ سخت‌ترِ همین حالت: وقتی APIای پیکربندی نشده، متادیتا اصلاً نباید
  // به شبکه بزند. اگر این ادعا بشکند یعنی خواندنِ env به scopeِ ماژول منتقل
  // شده و در بیلد «پیکربندی‌شده» فرض می‌شود — همان چیزی که این تست را در
  // فرآیندِ تست (که SITE_API_BASE دارد) بی‌صدا از کار می‌انداخت.
  test('اصلاً fetch نمی‌کند — صفحه در حالتِ امن static می‌ماند', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const desc = await withoutApi(() => description());
    restore();
    assert.equal(calls, 0, 'در حالتِ امن نباید هیچ درخواستی برود');
    assertPriceless(desc, 'بدونِ SITE_API_BASE (بدونِ شبکه)');
  });
});
