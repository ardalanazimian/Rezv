// ═══════════════════════════════════════════════════════════════════════
//  L1 — «درهای» انتخابِ نقشِ لندینگ روی موبایل
//
//  یافته‌ی Designer (DS-009 §۷): روی ۳۹۰px دو درِ «مهمانید یا صاحبِ رستوران؟»
//  به دو قابِ خالی له می‌شوند و متنشان بریده می‌شود؛ روی دسکتاپ سالم‌اند.
//  این مسیرِ اصلیِ مهمان است — تصمیمِ مالک `D-006`: مهمان باید **بدونِ
//  خواندنِ چیزی** به اپ برسد.
//
//  ⚠️ چرا این ابزار وجود دارد و چرا به سرورِ زنده وصل می‌شود: لندینگ SSR است
//  و خروجیِ استاتیک ندارد. بازسازیِ دستیِ مارک‌آپ در یک فایلِ HTML وسوسه‌انگیز
//  بود، ولی آن **کپیِ من** را می‌سنجید نه صفحه‌ی واقعی — همان کلاسِ «ابزاری که
//  ویرایش کردی همان نیست که اجرا کردی».
//
//  ⚠️ و پورت پارامتر است چون روی این ماشین **دو سرورِ لندینگ** می‌تواند بالا
//  باشد: یکی از چک‌اوتِ اصلی (نشستِ دیگر) و یکی از worktreeِ من. اندازه‌گیریِ
//  تغییرِ من روی سرورِ آن یکی، هیچ چیز را ثابت نمی‌کند.
//      node tools/measure-landing-doors.mjs [port] [width]
//  خروجی: exit 0 اگر هر دو در قابلِ استفاده باشند، 1 اگر نه، 2 اگر محیط خراب
//  باشد — تا «مرورگر بالا نیامد» با «چیدمان شکسته است» قاطی نشود.
// ═══════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 3201);
const WIDTH = Number(process.argv[3] || 390);
// ⚠️ مسیر پارامتر است چون **دو جا** در رندر می‌کنند: `HomeGate.tsx` (صفحه‌ی
// اول) و `app/login/page.tsx`. گزارشِ اولیه مسیر را نمی‌گفت، و سنجیدنِ یکی و
// نتیجه‌گرفتن برای دیگری همان حدسی است که باید از آن پرهیز کرد.
const PATH_ = process.argv[4] || '/';
// ⚠️ آرگومانِ اول می‌تواند یک URL کامل هم باشد (`file://…` یا `http://…`) —
// لازم شد چون نسخه‌ی `standalone/website.html` یک **اسنپ‌شاتِ تاریخ‌دار** است
// که `build-standalone` نه می‌سازدش و نه تازگی‌اش را چک می‌کند، پس می‌تواند
// CSSِ کهنه داشته باشد و همان اختلافِ «گزارش در برابرِ اندازه‌گیری» را بسازد.
const ARG = String(process.argv[2] || '');
// ⚠️ localhost، نه 127.0.0.1 — یافته‌ی ۲۰۲۶-۰۹-۱۱: محافظِ dev-originِ Next چانک‌های
// کلاینت را برای مبدأِ 127.0.0.1 با 403 رد می‌کند (HTML می‌آید، JS نه). صفحه hydrate
// نمی‌شود، هیچ useEffectی نمی‌دود، بوم‌ها ۳۰۰×۱۵۰ می‌مانند و rAFِ صفحه صفر است —
// و هر عددِ frame-time روی چنین صفحه‌ای **صفحه‌ی ایستا** را می‌سنجد نه محصول را.
// همین یک حرف ۶۰fpsِ من را در برابرِ ۳۳msِ DS-009 توضیح داد؛ کد یکی بود.
const URL_ = /^(file|http):/.test(ARG) ? ARG : `http://localhost:${PORT}${PATH_}`;

let chromium;
try {
  ({ chromium } = createRequire(path.join(ROOT, 'api', 'package.json'))('playwright'));
} catch (e) {
  console.error('ENV: playwright resolve نشد —', e.message);
  process.exit(2);
}

let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  console.error('ENV: مرورگر بالا نیامد —', e.message);
  process.exit(2);
}

const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: 844 },
  deviceScaleFactor: 2, isMobile: WIDTH < 900, hasTouch: WIDTH < 900, locale: 'fa-IR',
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

try {
  await page.goto(URL_, { waitUntil: 'networkidle', timeout: 120000 });
} catch (e) {
  console.error(`ENV: ${URL_} جواب نداد —`, e.message);
  await browser.close();
  process.exit(2);
}
await page.waitForTimeout(1500);

const out = await page.evaluate(() => {
  // ⚠️ `querySelectorAll`، نه `querySelector`. نسخه‌ی اولِ این ابزار فقط
  // **اولین** `.doors` را می‌سنجید و سبز می‌داد — ولی صفحه می‌تواند بیش از یک
  // ظرف داشته باشد (`.home-gate .doors` یک واریانتِ جداست). یعنی ابزار
  // می‌توانست یک نمونه‌ی سالم را ببیند و از آن برای کلِ صفحه نتیجه بگیرد،
  // دقیقاً همان تعمیمی که باید از آن پرهیز کرد.
  const wraps = [...document.querySelectorAll('.doors')];
  if (!wraps.length) return { missing: true };
  const groups = wraps.map((wrap, gi) => {
  const cs = getComputedStyle(wrap);
  const doors = [...wrap.querySelectorAll('.door')].map((d) => {
    const r = d.getBoundingClientRect();
    const s = getComputedStyle(d);
    // ⚠️ «متن بریده شده» را از خودِ layout می‌پرسیم، نه از چشم: اگر ارتفاعِ
    // محتوا از ارتفاعِ جعبه بیشتر باشد و overflow مخفی باشد، بریده است.
    const clipped = d.scrollHeight > Math.ceil(r.height) + 1 && s.overflow !== 'visible';
    return {
      h: Math.round(r.height), w: Math.round(r.width),
      scrollH: d.scrollHeight,
      flexBasis: s.flexBasis, flexGrow: s.flexGrow, overflow: s.overflow,
      clipped,
      label: (d.textContent || '').trim().slice(0, 28),
    };
  });
  return {
    group: gi,
    selector: wrap.className,
    direction: cs.flexDirection,
    wrapH: Math.round(wrap.getBoundingClientRect().height),
    doors,
  };
  });
  return { groups, totalDoors: groups.reduce((n, g) => n + g.doors.length, 0) };
});

if (out.missing) {
  console.error('✗ `.doors` در صفحه پیدا نشد — ساختار عوض شده؟');
  await browser.close();
  process.exit(1);
}

// حدِ قابلِ‌استفاده‌بودن: هر در باید حداقل یک هدفِ لمسِ استاندارد جا بدهد و
// محتوایش بریده نشود. ۴۴px از WCAG 2.5.5 می‌آید، نه از سلیقه.
const MIN = 44;
const all = out.groups.flatMap((g) => g.doors.map((d) => ({ ...d, group: g.group })));
const bad = all.filter((d) => d.h < MIN || d.clipped);
console.log(JSON.stringify({ url: URL_, width: WIDTH, ...out, minPerDoor: MIN, failing: bad.length, pageErrors }, null, 1));

await browser.close();
if (all.length === 0) { console.error('✗ هیچ `.door`ی نیست'); process.exit(1); }
if (bad.length) {
  console.error(`✗ L1: ${bad.length} از ${all.length} در قابلِ استفاده نیست `
    + `(ارتفاع < ${MIN}px یا متنِ بریده) — گروه‌ها: `
    + [...new Set(bad.map((d) => d.group))].join(','));
  process.exit(1);
}
console.log(`✓ L1: هر ${all.length} در در ${out.groups.length} ظرف قابلِ استفاده — `
  + `ارتفاع‌ها ${all.map((d) => d.h).join('/')}px، بدونِ برش`);
