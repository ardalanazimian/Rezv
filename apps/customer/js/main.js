// ═══════════════════════════════════════════════════════════
//  main.js — نقطه‌ی ورودِ اپ کاستومر (ES Modules)
//
//  این تنها فایلی است که در index.html با <script type="module"> لود می‌شود.
//  همه‌ی ماژول‌های دیگر از اینجا import می‌شوند تا:
//    • اجرا شوند (side-effectها مثل ثبتِ توابع روی window، تمِ اولیه)
//    • گرافِ وابستگی صریح و قابلِ فهم باشد
//
//  ترتیبِ import مهمِ منطقی نیست (ES Modules خودش وابستگی‌ها را حل می‌کند)،
//  ولی برای خوانایی به‌ترتیبِ لایه چیده شده است.
// ═══════════════════════════════════════════════════════════

// زیربنا
import './icons.js';
import './store.js';
import './actions.js';

// لایه‌ی داده و API
import './api.js';
import './analytics.js';
import './data/seed.js';
import './data/discover.js';
import './data/detail.js';

// رزرو و امکانات
import './reservation.js';
import './features/trips.js';
import './features/loyalty.js';
import './features/rewards.js';
import './features/food-dna.js';
import './features/chat.js';
import './features/palette.js';
import './features/notifications.js';
import './features/a11y.js';
import './features/onboarding.js';
import './features/pull-refresh.js';
import './features/swipe-actions.js';
import './features/live-strip.js';

// پروفایل و احراز هویت
import './user-profile.js';
import './auth.js';

// تم، حرکت، PWA (side-effect: ثبتِ SW، تمِ اولیه)
import './theme-pwa.js';

// شروعِ اپ (خودش startup را در DOMContentLoaded اجرا می‌کند)
import './init.js';
