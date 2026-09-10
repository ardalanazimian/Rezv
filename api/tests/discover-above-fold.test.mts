// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  DS-007 §۶ — فید اول: هیرو رفت، ولی هیچ قابلیتی با آن نرفت
//
//  حکمِ مالک (۲۰۲۶-۰۹-۱۰، به روایتِ `rezv-cf`): «A — فید اول، شعارِ برند از
//  داخلِ اپ می‌رود». اندازه‌گیریِ طراح پیش از تغییر: اولین کارتِ رستوران در
//  ۹۵۴px بود.
//
//  ⚠️ **این فایل ادعای اصلی را نمی‌سنجد و عمداً نمی‌تواند.**
//  ادعای اصلی دو چیزِ **رفتاری** است:
//      ۱) `offsetTop`ِ اولین `#feed .rc` در ۳۹۰×۸۴۴ کمتر از ۴۰۰px باشد
//      ۲) جست‌وجو از رابط **قابلِ رسیدن و کارا** باشد
//  هر دو DOM و layout لازم دارند و سوئیتِ `api/` مرورگر ندارد. طراح
//  (`rezv-e6`) هر دو را با Playwright روی باندل می‌سنجد — همان ابزاری که با
//  آن DS-006 §۴ را بازتولید کرد.
//
//  آنچه این‌جا هست **کمتر از آن ادعاست**: چند ناوردای ساختاری که اگر بشکنند،
//  رفتار حتماً شکسته است — ولی سبزبودنشان «کار می‌کند» را ثابت نمی‌کند. این
//  را صریح می‌نویسم چون یک تستِ ساختاری که به‌جای ادعای رفتاری فروخته شود،
//  همان سبزِ توخالی است که این تیم دو روز است شکارش می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8');
const HTML = read('apps/customer/index.html');
const DISCOVER = read('apps/customer/js/data/discover.js');
const BOOKING = read('apps/customer/js/data/booking.js');

function codeOnly(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); })
    .join('\n');
}

describe('DS-007 §۶ — هیرو رفت (ناوردای ساختاری، نه اثباتِ رفتار)', () => {

  test('⚠️ بلوکِ هیرو دیگر در صفحه نیست', () => {
    const html = codeOnly(HTML);
    for (const marker of ['class="hero"', 'hero-badge', 'id="sQ"', 'class="searchbar"', 'theme-fab']) {
      assert.ok(!html.includes(marker), `«${marker}» هنوز در index.html هست`);
    }
  });

  test('⚠️ هیچ کدِ زنده‌ای به عناصرِ حذف‌شده اشاره نمی‌کند', () => {
    // ⚠️ این مهم‌تر از تستِ بالاست: مارک‌آپ که برود، ارجاعِ جامانده یک
    // `TypeError` می‌دهد یا — بدتر — بی‌صدا no-op می‌شود.
    for (const [name, src] of [['discover.js', DISCOVER], ['booking.js', BOOKING],
      ['init.js', read('apps/customer/js/init.js')]] as const) {
      const code = codeOnly(src);
      for (const id of ["'sQ'", "'sWhen'", "'sParty'", 'initSearchCtx']) {
        assert.ok(!code.includes(id), `${name} هنوز به ${id} اشاره می‌کند`);
      }
    }
  });

  test('⚠️ متنِ جست‌وجو حالت است، نه یک عنصرِ DOM', () => {
    const code = codeOnly(DISCOVER);
    assert.match(code, /function doSearch\(q\)/, 'doSearch باید پرس را پارامتر بگیرد');
    assert.match(code, /let _query/, 'حالت باید در ماژول زندگی کند');
    assert.match(code, /export function activeQuery/, 'صداکننده‌ها باید بتوانند حالت را بخوانند');
  });

  test('⚠️ جست‌وجو روی موبایل از ظرفِ مخفی بیرون کشیده شده', () => {
    // ⚠️ **کمتر از ادعای واقعی**: این فقط می‌گوید قاعده‌ی CSS نوشته شده.
    // «واقعاً دیده می‌شود» را فقط اندازه‌گیریِ مرورگر می‌گوید — طراح می‌سنجد.
    const css = read('apps/customer/css/app.css');
    const mq = css.slice(css.indexOf('@media(max-width:880px){'));
    const block = mq.slice(0, mq.indexOf('\n}'));
    assert.match(block, /\.nav-right\{display:flex\}/, 'ظرف باید روی موبایل نمایان شود');
    assert.match(block, /\.nav-right>\.nav-keep\{display:inline-flex\}/, 'موردهای nav-keep باید نمایان بمانند');
    const html = codeOnly(HTML);
    assert.match(html, /class="nav-icn nav-keep"[^>]*onclick="openPalette\(\)"/,
      'دکمه‌ی جست‌وجو باید nav-keep داشته باشد وگرنه روی موبایل مخفی می‌ماند');
  });

  test('⚠️ هیچ قابلیتی با هیرو حذف نشد', () => {
    const html = codeOnly(HTML);
    // تمِ روشن/تاریک: تنها صداکننده‌اش `.theme-fab` بود. اگر این assert بیفتد،
    // یعنی کسی دکمه را برداشته و قابلیت بی‌جانشین مانده.
    assert.match(html, /onclick="toggleTheme\(\)"/,
      'تنها صداکننده‌ی toggleTheme رفته ⇒ تغییرِ تم برای کاربر غیرممکن شده');
    // «کِی/چند نفر»: بدونِ آن، چیپِ ساعت برای روزِ پیش‌فرض قول می‌دهد.
    assert.match(codeOnly(DISCOVER), /openSearchCtxSheet\(\)/,
      'قرصِ زمینه باید در سطرِ زیرِ فید باشد');
    assert.match(codeOnly(BOOKING), /export function openSearchCtxSheet/,
      'شیتِ «کِی و چند نفر» باید وجود داشته باشد');
  });

  test('⚠️ تغییرِ زمینه هنوز چیپ‌های ساعت را باطل می‌کند', () => {
    // اگر این بیفتد، کاربر «فردا، ۶ نفر» را انتخاب می‌کند و ساعت‌های
    // «امروز، ۲ نفر» را زیرِ برچسبِ جدید می‌بیند — ادعای غلط، بی‌سروصدا.
    const code = codeOnly(BOOKING);
    const i = code.indexOf('export function syncSearchCtx');
    const fn = code.slice(i, code.indexOf('\n}', i));
    assert.match(fn, /invalidateCardSlots\(\)/, 'چیپ‌ها باید باطل شوند');
    assert.match(fn, /ctxWhen/, 'باید از selectهای شیتِ تازه بخواند');
    assert.ok(!fn.includes("'sQ'"), 'شرطِ کهنه‌ی #sQ باید رفته باشد — همیشه غلط می‌شد');
  });
});
