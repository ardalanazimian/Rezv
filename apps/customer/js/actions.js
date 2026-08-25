// ═══════════════════════════════════════════════════════════
//  رفتارهایِ کیبوردِ سراسری — Escape برای بستن، Enter/Space برای عناصرِ
//  تعاملیِ غیر-<button> (نقشِ دسترسی‌پذیریِ صفحه).
//
//  ⚠️ تاریخچه (پاک‌سازیِ ۲۰۲۶-۰۸-۲۳، پروتکل §۵/§۷): این فایل قبلاً یک لایه‌ی
//  کاملِ event-delegation داشت (`registry`, `register`, `registerAll` و یک
//  handlerِ کلیک روی `[data-action]`) با این توضیح که «۱۰۱ تا onclick را
//  جایگزین می‌کند». **هیچ‌وقت پذیرفته نشد**: در کلِ مخزن — شاملِ خروجیِ
//  تولیدشده‌ی standalone/customer.html — صفر فراخوانِ `Actions.register(...)`
//  و صفر صفتِ `data-action` وجود داشت (تأییدشده با grep). یعنی رجیستری همیشه
//  خالی بود و handlerِ کلیک هرگز هیچ تابعی را صدا نمی‌زد.
//
//  چرا به‌جایِ پذیرفتن، حذف شد: خودِ اپ با الگویِ `window.fn` + `onclick` کار
//  می‌کند و کار هم می‌کند؛ مهاجرتِ ۱۰۱ نقطه هیچ سودِ کاربری ندارد و ریسکِ
//  رگرسیون دارد (§۴۰). نگه‌داشتنِ یک انتزاعِ استفاده‌نشده که ادعا می‌کند در
//  حالِ استفاده است، تیمِ بعدی را گمراه می‌کند (§۳۶).
//
//  `import { go }` هم حذف شد: استفاده نمی‌شد و یک یالِ اضافی به گرافِ حلقویِ
//  ماژول‌ها می‌داد — همان حلقه‌ای که یک‌بار باعثِ خطای TDZ و از‌کار‌افتادنِ
//  بی‌صدایِ restoreSession/syncRestaurants شده بود (رجوع کن به init.js).
// ═══════════════════════════════════════════════════════════
export const Actions = {
  /** فعال‌سازی (یک‌بار، روی document). */
  init() {
    if (Actions._wired) return;
    Actions._wired = true;

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // بستنِ هر overlay/sheet که باز است (استانداردِ UX)
        const dna = document.getElementById('dnaOverlay');
        const sheet = document.getElementById('sheet');
        // ⚠️ باگِ واقعیِ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴): اینجا 'show' چک می‌شد ولی
        // CSSِ این اورلی با کلاسِ «open» نمایش می‌دهد (.dna-overlay.open) —
        // یعنی Escape هرگز دیالوگِ تمام‌صفحه‌ی DNA را نمی‌بست.
        if (dna && dna.classList.contains('open')) { window.closeFoodDNA && window.closeFoodDNA(); return; }
        if (sheet && sheet.classList.contains('show')) { window.closeSheet && window.closeSheet(); return; }
      }
      // Enter/Space روی عناصرِ تعاملیِ غیر-button/a → فعال‌سازی
      if (e.key === 'Enter' || e.key === ' ') {
        const el = e.target.closest('[role="button"]');
        if (el && el.tagName !== 'BUTTON' && el.tagName !== 'A') {
          e.preventDefault();
          el.click();
        }
      }
    });
  },
  _wired: false,
};
