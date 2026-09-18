// ═══════════════════════════════════════════════════════════════════════
//  لینکِ مستقیمِ رستوران — D-31 (m-24 · سفرِ طلاییِ ۴)
//
//  چرا: تا امروز این اپ deep-link به‌ازای هر رستوران **نداشت** (SPA بدونِ
//  روتینگِ URL)، پس `shareRestaurant` آدرسِ کلیِ اپ را می‌داد و QRِ میز /
//  فاکتور / اینستاگرامِ رستوران هیچ راهی نداشتند که مستقیم «همان رستوران» را
//  باز کنند — در حالی که طبقِ playbookِ مهمان، مهمانِ لانچ دقیقاً از همین سه
//  مسیر می‌آید.
//
//  ── چرا query و نه مسیر (`/r/<slug>`) ──
//  مسیر نیازِ rewrite در nginx/caddy دارد (سطحِ استقرار، سه فایلِ دیگر) و در
//  بسته‌ی آفلاینِ `file://` اصلاً کار نمی‌کند. query روی هر سه کار می‌کند،
//  مسیرِ سند را عوض نمی‌کند (پس shellِ service worker همان می‌ماند) و
//  قابلِ اشتراک است. همان الگویی که `?checkin=` از قبل دارد.
//
//  ── یک تفاوتِ عمدی با `?checkin=` ──
//  آن پارامتر بعد از اجرا **پاک** می‌شود تا رفرش دوباره check-in نکند. این‌جا
//  برعکس: لینک باید با رفرش و اشتراک‌گذاری همان رستوران را باز کند، پس پاک
//  نمی‌شود.
//
//  ── ورودی نامعتبر است تا خلافش ثابت شود ──
//  slug و پارامترها از یک لینکِ بیرونی می‌آیند. هیچ‌کدام بدونِ اعتبارسنجی به
//  DOM یا به URLِ درخواست نمی‌روند، و هیچ‌جا ناوبریِ خارجی از روی ورودی ساخته
//  نمی‌شود (بدونِ open redirect).
// ═══════════════════════════════════════════════════════════════════════
// ⚠️ عمداً `data/detail.js` را import نمی‌کند: خودِ detail برای ساختنِ لینکِ
// اشتراک به این ماژول نیاز دارد، و importِ دوطرفه یک چرخه می‌سازد. هماهنگیِ
// «لینک را بخوان و رستوران را باز کن» در `init.js` انجام می‌شود که هر دو را
// از قبل می‌شناسد.
import { esc } from '../auth.js';
import { go } from '../data/discover.js';
import { PARTY_MAX, setBookingCtx, todayISO } from '../data/seed.js';
import { icon } from '../icons.js';

// حروفِ مجازِ slug: لاتینِ کوچک، رقم، خطِ تیره، و حروفِ فارسی.
// اعراب (U+064B..U+0652, U+0670) عمداً **مجاز نیست**: از D-31 به بعد slugِ
// تولیدی اعراب ندارد، و پذیرفتنش این‌جا یعنی برگرداندنِ همان لینکِ
// تایپ‌نشدنی از درِ پشتی.
const SLUG_OK = /^[a-z0-9\u0621-\u064A\u066E-\u06D3\u06F0-\u06F9-]{2,60}$/;
const DIACRITIC = /[\u064B-\u0652\u0670]/;

/** پارامترهای لینک، یا `null` اگر لینک deep-link نیست. */
export function parseDeepLink(search) {
  let p;
  try { p = new URLSearchParams(search ?? location.search); } catch { return null; }
  const slug = (p.get('r') || '').trim();
  if (!slug || !SLUG_OK.test(slug) || DIACRITIC.test(slug)) return null;

  const out = { slug, date: null, party: null };

  const d = (p.get('d') || '').trim();
  // تاریخِ گذشته یا بدشکل نادیده گرفته می‌شود، ولی خودِ لینک باطل نمی‌شود:
  // مهمان باید رستوران را ببیند، حتی اگر تاریخِ لینک کهنه باشد.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d >= todayISO()) out.date = d;

  const n = Number((p.get('p') || '').trim());
  if (Number.isInteger(n) && n >= 1 && n <= PARTY_MAX) out.party = n;

  return out;
}

/** لینکِ قابلِ اشتراکِ همین رستوران. خروجی همیشه هم‌مبدأ است. */
export function buildRestaurantLink(slug, ctx) {
  const u = new URL(location.href);
  u.hash = '';
  u.search = '';
  u.searchParams.set('r', slug);
  if (ctx?.date) u.searchParams.set('d', ctx.date);
  if (ctx?.party) u.searchParams.set('p', String(ctx.party));
  return u.toString();
}

/** حالتِ صادقانه‌ی «پیدا نشد» — نه فیدِ جایگزین، نه توستِ گذرا. */
export function renderNotFound(slug) {
  const el = document.getElementById('page-rest');
  if (!el) return;
  el.innerHTML = `
    <div class="empty" role="alert" style="padding:48px 20px;text-align:center">
      <div style="display:flex;justify-content:center;color:var(--t3)" aria-hidden="true">${icon('alert', { size: 40 })}</div>
      <div class="empty-title" style="margin-top:12px">این رستوران پیدا نشد</div>
      <div class="empty-text">لینکی که باز کردی به رستورانی اشاره می‌کند که دیگر در دسترس نیست
        — شاید آدرسش عوض شده باشد.</div>
      <div class="tiny" style="color:var(--t3);margin-top:8px;direction:ltr">${esc(slug)}</div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="go('discover')">دیدنِ رستوران‌ها</button>
    </div>`;
  go('rest');
}

/**
 * تاریخ/نفرِ لینک را **قبل** از بازشدنِ صفحه می‌نشاند تا شیتِ رزرو از ابتدا
 * همان‌ها را نشان بدهد، نه مقدارِ پیش‌فرض و بعد یک پرش.
 * خروجی: همان لینکِ معتبر، یا `null` اگر لینک deep-link نبود.
 */
export function applyDeepLinkContext() {
  const link = parseDeepLink();
  if (!link) return null;
  const patch = {};
  if (link.date) patch.date = link.date;
  if (link.party) patch.party = link.party;
  if (Object.keys(patch).length) setBookingCtx(patch);
  return link;
}

// برای onclickِ اینلاینِ حالتِ «پیدا نشد»
if (typeof window !== 'undefined') window.go = window.go || go;
