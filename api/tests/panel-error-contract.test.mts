// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Err } from '../src/lib/errors.ts';

// ═══════════════════════════════════════════════════════════════════════
//  قراردادِ خطای پنلِ رستوران — کد → متنِ پرسنل + کار
//
//  اسپک: `docs/audit/design/DS-003-panel-error-vocabulary.md` §۴‑۳
//  (نشستِ Designer `rezv-f3 [54834f]`). یافته مالِ اوست؛ اجرا مالِ من.
//
//  ⚠️ جمله‌ای که تصحیح شد و مسیرِ رفع را عوض کرد: «پرسنل خطای **عمومی**
//  می‌بینند» غلط بود. پنل پیامِ فارسیِ سرور را در ۵۳ جا نشان می‌دهد. نقصِ
//  واقعی این است که **روی `code` شاخه نمی‌زند**، پس هیچ خطایی به یک کارِ
//  قابلِ انجام ختم نمی‌شود.
//
//  ⚠️ این تست **رفتاری** است: توابع از `api-errors.js` استخراج و واقعاً
//  اجرا می‌شوند، با خطاهایی که از خودِ `Err.*` ساخته شده‌اند — نه رشته‌های
//  دستیِ شبیه‌سازی‌شده.
// ═══════════════════════════════════════════════════════════════════════

const SRC = readFileSync(
  fileURLToPath(new URL('../../apps/business/js/api-errors.js', import.meta.url)), 'utf8',
);

const panel = new Function(`${SRC}
  return { PANEL_ERROR_MAP, PANEL_ERROR_ACTIONS, panelErrorText, panelErrorAction, panelErrorIcon };`,
)() as {
  PANEL_ERROR_MAP: Record<string, { staff: string | null; action: string }>;
  PANEL_ERROR_ACTIONS: Record<string, string>;
  panelErrorText: (e: unknown, fb?: string) => string;
  panelErrorAction: (e: unknown) => string;
  panelErrorIcon: (e: unknown) => string;
};

describe('قراردادِ خطای پنل — کد به کار وصل است', () => {

  test('⚠️ هر کدِ نگاشت واقعاً در errors.ts وجود دارد', () => {
    // جهتِ اول: پنل نباید کدی را ادعا کند که سرور هرگز نمی‌دهد.
    const real = new Set<string>();
    for (const f of Object.values(Err as Record<string, unknown>)) {
      if (typeof f !== 'function') continue;
      try {
        const e: any = (f as (...a: unknown[]) => unknown)(1, 1);
        if (e?.code) real.add(e.code);
      } catch { /* سازنده‌ای که با این ورودی نمی‌سازد */ }
    }
    // `BRANCH_NOT_ACCESSIBLE` بیرون از `Err.*` ساخته می‌شود (staff-helpers.ts).
    const known = new Set([...real, 'BRANCH_NOT_ACCESSIBLE']);
    const ghosts = Object.keys(panel.PANEL_ERROR_MAP).filter((c) => !known.has(c));
    assert.deepEqual(ghosts, [], `پنل کدهایی را مدیریت می‌کند که سرور نمی‌دهد: ${ghosts.join(', ')}`);
  });

  test('⚠️ هر ردیف یک کارِ معتبر دارد — نه فقط یک جمله', () => {
    // تفاوتِ عمدیِ دوم با نسخه‌ی کاستومر (DS-003 §۴‑۳).
    const valid = new Set(Object.values(panel.PANEL_ERROR_ACTIONS));
    for (const [code, row] of Object.entries(panel.PANEL_ERROR_MAP)) {
      assert.ok(valid.has(row.action), `کدِ ${code} کارِ نامعتبر دارد: ${row.action}`);
    }
  });

  test('⚠️ خطای گذرا به «دوباره بزن» می‌رسد، نه به بن‌بست', () => {
    // با خطای واقعیِ سرور، نه یک شیءِ دستی.
    const busy = Err.serviceUnavailable('سرویس موقتاً شلوغ است');
    assert.equal(busy.code, 'SERVICE_UNAVAILABLE');
    assert.equal(panel.panelErrorAction({ code: busy.code }), 'retry');
    assert.equal(panel.panelErrorIcon({ code: busy.code }), '⏳');
    assert.match(panel.panelErrorText({ code: busy.code, message: busy.message }), /دوباره بزن/);
  });

  test('⚠️ متنِ پرسنل با متنِ مهمان یکی نیست', () => {
    // تفاوتِ عمدیِ اولِ اسپک. متنِ سرور برای مشتری نوشته شده.
    const conflict = Err.tableConflict();
    const staffText = panel.panelErrorText({ code: conflict.code, message: conflict.message });
    assert.notEqual(staffText, conflict.message, 'پنل باید متنِ مخصوصِ پرسنل بدهد');
    assert.match(staffText, /میزِ دیگری/, 'به پرسنل بگو چه کند، نه فقط چه شد');
  });

  test('⚠️ جایی که متنِ اختصاصی نداریم، پیامِ سرور بازنویسی نمی‌شود', () => {
    // `staff: null` یعنی سرور دقیق‌تر است — مثلاً VALIDATION که می‌گوید
    // کدام فیلد. بازنویسی‌اش اطلاعات را از بین می‌برد.
    const v = Err.validation('تعداد نفر نامعتبر است');
    assert.equal(panel.panelErrorText({ code: v.code, message: v.message }), v.message);
    assert.equal(panel.PANEL_ERROR_MAP.VALIDATION.staff, null, 'VALIDATION عمداً متنِ اختصاصی ندارد');
  });

  test('⚠️ کدِ ناشناخته و خطای بی‌کد بن‌بستِ خاموش نمی‌سازند', () => {
    assert.equal(panel.panelErrorText({ code: 'ZZZ_UNKNOWN', message: 'پیامِ سرور' }), 'پیامِ سرور');
    assert.equal(panel.panelErrorAction({ code: 'ZZZ_UNKNOWN' }), 'none');
    assert.equal(panel.panelErrorText(undefined, 'پیش‌فرض'), 'پیش‌فرض');
  });

  test('⚠️ RATE_LIMITED عمداً بیرون است — و این یک تصمیم است نه فراموشی', () => {
    // `details.retryAfterSec` دارد، پس کارِ درستش «صبر کن، بعد دوباره» است.
    // دکمه‌ای که بلافاصله دوباره رد شود، از پیامِ سرور بدتر است.
    // اسپکِ انتظار از `rezv-f3` خواسته شده؛ تا آن موقع این ردیف نباید
    // بی‌سروصدا به 'retry' نگاشت شود.
    assert.equal(panel.PANEL_ERROR_MAP.RATE_LIMITED, undefined);
    assert.equal(panel.panelErrorAction({ code: 'RATE_LIMITED' }), 'none');
  });

  test('⚠️ مسیرِ تغییرِ وضعیت واقعاً از قرارداد رد می‌شود', () => {
    // بدونِ این، ماژول می‌تواند بی‌نقص باشد و هیچ‌جا صدا زده نشود —
    // همان کدِ مرده‌ای که کلِ این کار درباره‌ی حذفش است.
    const dataJs = readFileSync(
      fileURLToPath(new URL('../../apps/business/js/data.js', import.meta.url)), 'utf8',
    );
    const code = dataJs.split('\n').map((l) => {
      const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i);
    }).join('\n');
    assert.ok(code.includes('panelErrorText('), 'متنِ خطای تغییرِ وضعیت باید از قرارداد رد شود');
    assert.ok(code.includes('panelErrorIcon('), '`action` باید مصرف‌کننده‌ی واقعی داشته باشد');
  });

  test('⚠️ فایل در index.html ثبت شده — وگرنه در پنل بارگذاری نمی‌شود', () => {
    // پنل کلاسیک است: فایلی که تگ نداشته باشد اصلاً وجود ندارد، و
    // `typeof panelErrorText==='function'` بی‌صدا false می‌شود.
    const html = readFileSync(
      fileURLToPath(new URL('../../apps/business/index.html', import.meta.url)), 'utf8',
    );
    const errIdx = html.indexOf('js/api-errors.js');
    const dataIdx = html.indexOf('js/data.js');
    assert.notEqual(errIdx, -1, 'api-errors.js در index.html ثبت نشده');
    assert.ok(errIdx < dataIdx, 'باید پیش از data.js بار شود');
  });

  test('⚠️ ماژول کلاسیک است — یک export کلِ پنل را می‌کشد', () => {
    // رخدادِ واقعیِ PR #77: یک `export`ِ سرگردان در یک اسکریپتِ کلاسیک،
    // کلِ فایل را با SyntaxError کشت و همه‌ی توابعش undefined شدند.
    assert.ok(!/^\s*export\s/m.test(SRC), 'api-errors.js پنل نباید export داشته باشد');
  });

  test('⚠️ DS-003 §۵ — پیامِ «با رستوران تماس بگیرید» به کارکنانِ رستوران نمی‌رسد', () => {
    // ⚠️ این ردیف **تأیید شد، رد نشد.** `rezv-f3` دو مسیرِ پرسنلی را ترِیس
    // کرد و نرسید؛ مسیرِ سومی هست که ندیده بود: رزروِ دستی از پنل
    // (`apps/business/js/reservations.js:512` → `POST /reservations` →
    // شاخه‌ی پرسنلیِ route → `createReservation`).
    const staffText = panel.panelErrorText({
      code: 'PARTY_TOO_LARGE', message: Err.partyTooLarge(12).message,
    });
    assert.doesNotMatch(staffText, /با رستوران تماس بگیرید/,
      'به کارکنانِ رستوران نباید گفته شود با رستوران تماس بگیرند');
    assert.doesNotMatch(staffText, /رزرو آنلاین/,
      'رزروِ دستیِ پرسنل «رزروِ آنلاین» نیست — سقفش هم به آن‌ها ربط ندارد');
    // و متنِ سرور واقعاً همان چیزی است که این تست ادعا می‌کند (مبنا).
    assert.match(Err.partyTooLarge(12).message, /با رستوران تماس بگیرید/);

    const slotText = panel.panelErrorText({ code: 'SLOT_FULL', message: Err.slotFull('20:00').message });
    assert.notEqual(slotText, Err.slotFull('20:00').message, 'کارِ پرسنل با کارِ مهمان فرق دارد');
  });

  test('⚠️ RESTAURANT_OFFLINE عمداً ردیف ندارد — چون به پرسنل نمی‌رسد', () => {
    // تنها موردی از آن سه که `rezv-f3` درباره‌اش درست گفته بود: پرتابش پشتِ
    // `source === 'app'` است، پس رزروِ دستی مستثناست. ردیف‌دادن به کدی که
    // نمی‌رسد، همان ادعای بی‌مکانیزم است — فقط در جهتِ مخالف.
    assert.equal(panel.PANEL_ERROR_MAP.RESTAURANT_OFFLINE, undefined);
    const src = readFileSync(
      fileURLToPath(new URL('../src/lib/reservations.ts', import.meta.url)), 'utf8',
    );
    const i = src.indexOf('Err.restaurantOffline()');
    assert.notEqual(i, -1, 'محلِ پرتاب پیدا نشد — کد عوض شده؟');
    assert.match(src.slice(Math.max(0, i - 400), i), /input\.source === 'app'/,
      'اگر این گارد برداشته شود، پیام به پرسنل می‌رسد و باید ردیف بگیرد');
  });

  test('⚠️ فرضِ دسترسی‌پذیری هنوز برقرار است — پنل واقعاً رزروِ دستی می‌سازد', () => {
    // اگر روزی رزروِ دستی از پنل برداشته شود، دو ردیفِ بالا بی‌مورد می‌شوند.
    // این assert همان لحظه خبر می‌دهد، به‌جای اینکه ردیف‌ها بی‌صدا بمانند.
    const panelSrc = readFileSync(
      fileURLToPath(new URL('../../apps/business/js/reservations.js', import.meta.url)), 'utf8',
    );
    assert.match(panelSrc, /API\.post\('\/reservations'/,
      'پنل دیگر رزروِ دستی نمی‌سازد؟ آن‌وقت ردیف‌های PARTY_TOO_LARGE/SLOT_FULL را بازبینی کن');
  });
});
