// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  A1-006 — «رزرو تأیید شد!» فقط وقتی گفته شود که واقعاً تأیید شده
//
//  ⚠️ این ردیف را در حینِ سوئیپِ «فیلدِ سوم» پیدا کردم (سؤالِ CEO: آیا فیلدِ
//  دیگری هم همین شکاف را دارد؟). جواب بله، و **قوی‌تر** از موردی که سفارش
//  شده بود:
//
//    `reservations.ts:375`  needsApproval = cancellationPolicy.autoConfirm === false
//                           ⇒ وضعیتِ رزرو `pending` می‌شود
//    `reservations.ts:481`  status در همان پاسخ **برمی‌گردد**
//    `booking.js:385`       اپ فقط `res.data.code` را می‌خواند
//    `booking.js` (success) و بعد بی‌قیدوشرط «رزرو تأیید شد!» می‌گفت
//
//  یعنی رستورانی که تأییدِ دستی را روشن کرده، مشتری‌اش «تأیید شد» می‌دید و
//  میزش **قطعی نبود**.
//
//  ⚠️ و تفاوتش با `paymentEnabled`: آن‌جا داده به اپ نمی‌رسید (نیازمندِ کارِ
//  بک‌اند). این‌جا داده **از قبل در پاسخ بود** و اپ نمی‌خواندش — پس کاملاً در
//  دستِ همین لایه بود و هیچ وابستگی‌ای نداشت.
//
//  ⚠️ و الگوی درست از قبل در همین اپ بود: `reservation.js:76`
//  (`awaitingApproval`) همین نقص را برای فهرستِ سفرها رفع کرده، با کامنتی که
//  عیناً می‌گوید «مشتری فکر می‌کرد میزش قطعی است در حالی که رستوران هنوز
//  تأیید نکرده». شیتِ موفقیت آن رفع را نگرفته بود — همان شکلِ
//  `loyalty.js:35` در برابرِ پنلِ کش‌بک، و `STATUS_META` در برابرِ `ST_FA`.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8');
const SRC = read('apps/customer/js/data/booking.js');

function codeOnly(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); })
    .join('\n');
}

/** بلوکِ تمپلیتِ شیتِ موفقیت — همان رشته‌ای که واقعاً رندر می‌شود. */
function successTemplate(): string {
  const code = codeOnly(SRC);
  const i = code.indexOf('class="success"');
  assert.notEqual(i, -1, 'شیتِ موفقیت پیدا نشد — ساختارش عوض شده؟');
  return code.slice(i, code.indexOf('</div>`', i));
}

describe('A1-006 — ادعای تأیید با وضعیتِ واقعی می‌خواند', () => {

  test('⚠️ سرور وضعیت را در همان پاسخِ رزرو برمی‌گرداند (مبنای این تست)', () => {
    // اگر این روزی عوض شود، رفعِ اپ بی‌پایه می‌شود و باید بداند.
    const resv = read('api/src/lib/reservations.ts');
    assert.match(resv, /status:\s*result\.resv\.status/,
      'createReservation باید status را برگرداند — رفعِ اپ رویش سوار است');
    assert.match(resv, /autoConfirm\s*===\s*false/,
      'needsApproval باید از autoConfirm مشتق شود — یعنی pending واقعاً ممکن است');
  });

  test('⚠️ اپ وضعیتِ واقعی را می‌خواند، نه فقط کد را', () => {
    const code = codeOnly(SRC);
    assert.match(code, /res\.data\.status/,
      'وضعیت از پاسخ خوانده نمی‌شود ⇒ اپ نمی‌تواند بداند تأیید شده یا نه');
  });

  test('⚠️ عنوانِ «تأیید شد» **مشروط** است، نه ثابت', () => {
    const tpl = successTemplate();
    assert.ok(tpl.includes('رزرو تأیید شد!'), 'متنِ حالتِ تأییدشده باید بماند');
    // و باید پشتِ یک شرط روی وضعیت باشد — نه یک رشته‌ی بی‌قید.
    assert.match(tpl, /bookedStatus\s*===\s*'pending'\s*\?/,
      'عنوان باید از وضعیت مشتق شود؛ رشته‌ی بی‌قید همان ادعای قبلی است');
    assert.match(tpl, /در انتظارِ تأیید/, 'حالتِ pending باید متنِ خودش را داشته باشد');
  });

  test('⚠️ شیت و فهرستِ سفرها یک حرف می‌زنند', () => {
    // دو صفحه‌ی یک اپ که یکی «در انتظار» بگوید و دیگری «پیش‌رو»، همان
    // واگراییِ ST_FA/STATUS_META است — یک واقعیت، دو نمایش.
    const code = codeOnly(SRC);
    assert.match(code, /awaitingApproval:\s*bookedStatus\s*===\s*'pending'/,
      'ردیفِ TRIPS هم باید وضعیتِ واقعی را ببرد');
    // و فیلدش باید همان نامی باشد که بقیه‌ی اپ از قبل می‌شناسد.
    assert.match(read('apps/customer/js/reservation.js'), /awaitingApproval/,
      'نامِ فیلد باید همان چیزی باشد که reservation.js از قبل دارد — نه مکانیزمِ دوم');
  });
});
