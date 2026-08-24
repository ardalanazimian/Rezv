// ═══════════════════════════════════════════════════════════
//  رزرونو — شروع اپ (ES Module)
//  R متغیر زنده‌ی رستوران‌هاست: اول از نمونه (نمایش فوری)، بعد از API به‌روز می‌شود.
// ═══════════════════════════════════════════════════════════

import { Actions } from './actions.js';
import { API, loadRestaurants, refreshAuthUI, setUSER } from './api.js';
import { renderDiscoverSections, renderFeed } from './data/discover.js';
import { R_SAMPLE } from './data/seed.js';
import { runPendingCheckIn } from './features/checkin.js';
import { armReveals, updateThemeIcon } from './theme-pwa.js';
export let R = R_SAMPLE;

// پیداکردنِ رستوران با id — همیشه با مقایسه‌ی String، چون idِ نمونه عدد است و
// idِ واقعیِ بک‌اند UUID (string). مقایسه‌ی === مستقیم بین این دو، برای هر
// رستورانِ واقعی شکست می‌خورد (باگی که همه‌ی CTAهای کارت را می‌شکست).
export const findR = id => R.find(x => String(x.id) === String(id));

// ── startup: بعد از آماده‌شدنِ DOM اجرا شو (چرخه‌ی load-time را می‌شکند) ──
function boot(){
  Actions.init();                    // فعال‌سازی event delegation
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
async function syncRestaurants(){
  const fresh = await loadRestaurants();
  R = fresh;
  if (document.getElementById('page-discover')?.classList.contains('active')) {
    renderFeed(R);
    renderDiscoverSections();
  }
}

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
