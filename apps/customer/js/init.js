// ═══════════════════════════════════════════════════════════
//  رزرونو — شروع اپ (ES Module)
//  R متغیر زنده‌ی رستوران‌هاست: اول از نمونه (نمایش فوری)، بعد از API به‌روز می‌شود.
// ═══════════════════════════════════════════════════════════

import { Actions } from './actions.js';
import { API, hydrateSlots, loadMoreRestaurants, loadRestaurants, refreshAuthUI, setUSER } from './api.js';
import { doSearch, paintSlots, renderDiscoverSections, renderFeed, renderRestaurantSections } from './data/discover.js';
import { R_SAMPLE, bookingCtx } from './data/seed.js';
import { runPendingCheckIn } from './features/checkin.js';
import { armReveals, updateThemeIcon } from './theme-pwa.js';
export let R = R_SAMPLE;

// پیداکردنِ رستوران با id — همیشه با مقایسه‌ی String، چون idِ نمونه عدد است و
// idِ واقعیِ بک‌اند UUID (string). مقایسه‌ی === مستقیم بین این دو، برای هر
// رستورانِ واقعی شکست می‌خورد (باگی که همه‌ی CTAهای کارت را می‌شکست).
export const findR = id => R.find(x => String(x.id) === String(id));

// ── startup: بعد از آماده‌شدنِ DOM اجرا شو (چرخه‌ی load-time را می‌شکند) ──
function boot(){
  Actions.init();                    // رفتارهایِ کیبوردِ سراسری (Escape / Enter-Space)
  updateThemeIcon();                 // آیکونِ تم (حالا DOM آماده است)
  renderFeed(R);                     // نمایش فوری با داده‌ی نمونه
  renderDiscoverSections();          // نزدیک تو، ترند، رویدادها
  armReveals();                      // انیمیشنِ اسکرول
  restoreSession();                  // بازیابی نشست
  syncRestaurants();                 // داده‌ی واقعی از بک‌اند
  // ورود با QRِ میز — فقط وقتی لینک `?checkin=` دارد کاری می‌کند.
  // عمداً `await` نمی‌شود و بعد از رندرِ اولیه صدا زده می‌شود: مهمانی که
  // کدِ میز را اسکن کرده باید اپ را ببیند، نه صفحه‌ی سفیدِ منتظرِ شبکه.
  runPendingCheckIn();
}

// بازیابی نشست از localStorage — اگر توکن داشت، کاربر را دوباره وارد نگه دار
async function restoreSession(){
  // ⚠️ حتی وقتی توکنی نیست هم باید UI را همگام کنیم: در غیر این صورت چیپِ
  // امتیازِ نوارِ بالا برایِ مهمانِ ناشناس روی حالتِ اولیه‌اش می‌ماند و دیده
  // می‌شود، در حالی که مهمان اصلاً امتیازی ندارد که نشان بدهیم.
  if (!API.restoreSession()) { refreshAuthUI(); return; }
  const res = await API.get('/me');
  if (res.ok && res.data?.user) {
    setUSER(res.data.user);
  }
  refreshAuthUI();
  // اگر ۴۰۱ برگشت، لایه‌ی request خودش refresh می‌کند.
}

// تلاش برای دریافت داده‌ی واقعی از بک‌اند
// export شده تا pull-to-refresh واقعاً دادهٔ تازه بگیرد (نه فقط همان داده را
// دوباره رندر کند) — رجوع کن به توضیحِ features/pull-refresh.js.
export async function syncRestaurants(){
  const fresh = await loadRestaurants();
  R = fresh;
  if (document.getElementById('page-discover')?.classList.contains('active')) {
    // ⚠️ اگر کاربر در این فاصله جست‌وجو کرده، renderFeed(R) نتیجه‌اش را با
    // فهرستِ کامل بازنویسی می‌کرد (همان باگِ رقابتِ رندر؛ توضیحِ کامل روی
    // renderFeed در data/discover.js). doSearch هم فیلتر را با دادهٔ تازه‌ی
    // سرور دوباره اعمال می‌کند، هم وقتی جست‌وجو خالی است خودش renderFeed(R)
    // را صدا می‌زند — پس هر دو حالت درست می‌ماند.
    if (document.getElementById('sQ')?.value.trim()) doSearch();
    else renderFeed(R);
    // فقط بخش‌هایِ وابسته به R — عمداً renderDiscoverSections نه، چون آن
    // `GET /events` و خواندنِ موقعیت را دوباره می‌فرستد و boot از قبل انجامشان
    // داده. (توضیحِ کامل روی renderDiscoverSections در data/discover.js.)
    renderRestaurantSections();
  }
  refreshCardSlots();
}

// ═══════════════════════════════════════════════════════════
//  چیپ‌هایِ ساعتِ کارت — از availabilityِ واقعی، نه حدس
//
//  تا پیش از این `mapApiRestaurant` فیلدِ `available_slots` را می‌خواند که هیچ
//  روتی برنمی‌گرداند، پس کارتِ هر رستورانِ زنده همیشه بدونِ ساعت بود. حالا روتِ
//  گروهیِ `/restaurants/availability` همان موتورِ شیتِ رزرو را صدا می‌زند.
//
//  ⚠️ محافظِ ترتیب: کاربر می‌تواند تاریخ را سریع عوض کند. بدونِ این توکن،
//  پاسخِ کندترِ انتخابِ *قبلی* می‌توانست بعد از پاسخِ انتخابِ جدید بنشیند و
//  ساعت‌هایِ یک روزِ دیگر را زیرِ برچسبِ روزِ فعلی نشان بدهد.
// ═══════════════════════════════════════════════════════════
let slotsToken = 0;

export async function refreshCardSlots(){
  const token = ++slotsToken;
  const { date, party } = bookingCtx;
  const target = R;
  const changed = await hydrateSlots(target, date, party);
  // انتخابِ کاربر (یا خودِ فهرست) عوض شده — این پاسخ دیگر معتبر نیست.
  if (token !== slotsToken || target !== R) return;
  if (changed) paintSlots(R);
}

/**
 * انتخابِ تاریخ/تعدادِ نفر عوض شد: ساعت‌هایِ قبلی دیگر معتبر نیستند.
 *
 * اول پاکشان می‌کنیم و کارت به CTAِ «ببین سانس‌ها» برمی‌گردد، بعد تازه‌اش را
 * می‌گیریم. نگه‌داشتنِ ساعتِ قبلی تا رسیدنِ پاسخ یعنی چیپِ «۲۰:۰۰» زیرِ
 * برچسبِ «فردا، ۶ نفر» دیده شود در حالی که برایِ «امروز، ۲ نفر» حساب شده بود.
 */
export function invalidateCardSlots(){
  let had = false;
  for (const r of R) {
    if (r && Array.isArray(r.slots) && r.slots.length && r.slug) { r.slots = []; had = true; }
  }
  if (had) paintSlots(R);
  refreshCardSlots();
}

// صفحه‌ی بعدیِ رستوران‌ها (دکمه‌ی «رستوران‌های بیشتر» در فیدِ کشف).
// فقط لیست و بخش‌هایِ وابسته به R را نو می‌کند — عمداً renderDiscoverSections
// صدا زده نمی‌شود تا `GET /events` بی‌دلیل تکرار نشود.
window.loadMoreFeed = async function(){
  const btn = document.getElementById('feedMore');
  if (btn) { btn.disabled = true; btn.textContent = 'در حال بارگذاری…'; }
  try {
    const more = await loadMoreRestaurants();
    if (more.length) {
      R = R.concat(more);
      renderFeed(R);
      renderRestaurantSections();
      // کارت‌هایِ تازه هم باید چیپِ ساعتِ واقعی بگیرند، وگرنه صفحه‌ی دومِ فید
      // همیشه فقط CTAِ «ببین سانس‌ها» نشان می‌داد.
      refreshCardSlots();
      return;
    }
    // سرور چیزی نداد: یا واقعاً تمام شده یا درخواست شکست خورده — در هر دو حالت
    // دکمه‌ی «بیشتر»ی که کاری نمی‌کند باقی نمی‌ماند.
    if (btn) btn.remove();
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = 'دوباره تلاش کن'; }
  }
};

// اجرای startup پس از آماده‌شدنِ DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // اسکریپت‌های module معمولاً وقتی اجرا می‌شوند که DOM آماده است؛ اگر boot را
  // همین‌جا همزمان صدا بزنیم، حین ارزیابیِ گرافِ ماژول (importهای حلقوی) اجرا می‌شود
  // و به bindingهای هنوز‌مقداردهی‌نشده (API، SAMPLE_EVENTS) برمی‌خورد → خطای TDZ که
  // restoreSession و syncRestaurants را بی‌صدا از کار می‌انداخت. با defer به تیکِ بعد،
  // گرافِ ماژول کامل می‌شود و چرخه‌ی load-time واقعاً شکسته می‌شود.
  setTimeout(boot, 0);
}
