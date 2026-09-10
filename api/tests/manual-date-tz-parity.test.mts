// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dateKeyInTz } from '../src/lib/hours.ts';

// ═══════════════════════════════════════════════════════════════════════
//  تاریخِ رزروِ دستی — تایم‌زونِ رستوران، نه ساعتِ دستگاهِ پرسنل
//
//  یافته: دستورِ ۰۴۵ بازبین روی `75eb9df`.
//
//  ⚠️ نقص: `manualDateFor` از `new Date()` و اجزای **محلیِ دستگاه** می‌آمد و
//  `manualDateLabel` بدونِ `timeZone` صدا زده می‌شد. تبلتی که روی UTC مانده —
//  خیلی محتمل‌تر از کشورِ دوم — ساعتِ ۰۲:۳۰ تهران را «دیروز» می‌دید.
//
//  ⚠️ و چرا این از نقصِ **قبلی** بدتر بود: رفعِ B-01 درست بود و دو محاسبه‌ی
//  یک واقعیت را به یک منبع رساند — ولی آن منبع ساعتِ دستگاه بود. پس برچسب و
//  مقدار از «واگرا و **دیدنی**» به «هم‌خوان و هر دو غلط» رفتند.
//  **توافق شبیهِ درستی خوانده می‌شود.**
//
//  ⚠️ چرا این تست شکلِ «برابری» دارد و نه «یک پیاده‌سازی»: کدِ سرور
//  (`hours.ts`) در پنلِ مرورگر قابلِ import نیست. پس تنها راهِ داشتنِ **یک
//  قاعده** این است که برابریِ دو طرف اثبات شود — وگرنه «قاعده‌ی مشترک» یک
//  ادعا می‌ماند، از همان جنسی که این هفته چند بار پرداختش کردیم.
// ═══════════════════════════════════════════════════════════════════════

const SRC = readFileSync(
  fileURLToPath(new URL('../../apps/business/js/reservations.js', import.meta.url)), 'utf8',
);

/** توابعِ خالصِ تاریخ را از پنل بیرون می‌کشد و **واقعاً اجرا** می‌کند. */
function panel(tz: string) {
  const pick = (start: string) => {
    const i = SRC.indexOf(start);
    assert.notEqual(i, -1, `بلاکِ «${start}» پیدا نشد — نامش عوض شده؟`);
    const j = SRC.indexOf('\n}', i);
    return SRC.slice(i, j + 2);
  };
  return new Function('__TZ__', `
    const HOURS_STATE = { timezone: __TZ__ };
    ${pick('function manualTz(){')}
    ${pick('function manualDateFor(dateVal){')}
    ${pick('function manualDateLabel(dateVal){')}
    ${pick('function manualDateToISO(dateVal, faTime){')}
    return { manualDateFor, manualDateLabel, manualDateToISO };
  `)(tz) as {
    manualDateFor: (v: string) => Date;
    manualDateLabel: (v: string) => string;
    manualDateToISO: (v: string, t?: string) => { date: string; time: string };
  };
}

const TZS = ['Asia/Tehran', 'UTC', 'America/Los_Angeles', 'Pacific/Kiritimati'];

describe('تاریخِ رزروِ دستی — برابری با قاعده‌ی سرور', () => {

  test('⚠️ «امروز» همان روزی است که سرور با dateKeyInTz می‌گوید', () => {
    // ⚠️ همان تابعِ سرور صدا زده می‌شود، نه بازنویسی‌اش.
    for (const tz of TZS) {
      const p = panel(tz);
      const expected = dateKeyInTz(new Date(), tz);
      assert.equal(p.manualDateToISO('today').date, expected,
        `${tz}: «امروزِ» پنل با «امروزِ» سرور یکی نیست`);
    }
  });

  test('⚠️ فردا و روزهای بعد هم با سرور می‌خوانند', () => {
    for (const tz of TZS) {
      const p = panel(tz);
      for (const [val, days] of [['tomorrow', 1], ['d7', 7], ['d30', 30]] as const) {
        const expect = dateKeyInTz(new Date(Date.now() + days * 86_400_000), tz);
        assert.equal(p.manualDateToISO(val).date, expect, `${tz}/${val}`);
      }
    }
  });

  test('⚠️ برچسب و مقدار **همان** روز را می‌گویند — و هر دو درست', () => {
    // نقصِ اصلی این بود که این دو از هم افتادند؛ رفعِ قبلی هم‌خوانشان کرد
    // ولی هر دو را غلط گذاشت. پس هر دو شرط با هم assert می‌شوند.
    for (const tz of TZS) {
      const p = panel(tz);
      const iso = p.manualDateToISO('today').date;
      const labelDay = new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
      }).format(new Date(`${iso}T12:00:00Z`));
      assert.equal(p.manualDateLabel('today'), labelDay, `${tz}: برچسب با مقدار نمی‌خواند`);
    }
  });

  test('⚠️ ساعتِ دستگاه دیگر خوانده نمی‌شود', () => {
    // گاردِ ساختاری در کنارِ رفتاری: اگر روزی کسی به اجزای محلی برگردد،
    // ممکن است در تایم‌زونِ همین ماشین اتفاقاً سبز بماند.
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); })
      .join('\n');
    const i = code.indexOf('function manualDateFor(dateVal){');
    const body = code.slice(i, code.indexOf('\n}', i));
    assert.ok(!/\bt\.setDate\(/.test(body), 'setDate محلی است — باید setUTCDate باشد');
    assert.match(body, /timeZone\s*:\s*manualTz\(\)/, 'روزِ «امروز» باید از تایم‌زونِ رستوران بیاید');

    const j = code.indexOf('function manualDateToISO(dateVal, faTime){');
    const isoBody = code.slice(j, code.indexOf('\n}', j));
    assert.ok(!/\.getFullYear\(\)|\.getMonth\(\)|\.getDate\(\)/.test(isoBody),
      'اجزای محلی خوانده می‌شوند — مقدارِ POST دوباره به ساعتِ دستگاه گره می‌خورد');

    const k = code.indexOf('function manualDateLabel(dateVal){');
    const labelBody = code.slice(k, code.indexOf('\n}', k));
    assert.match(labelBody, /timeZone\s*:\s*'UTC'/,
      'بدونِ timeZone، مرورگر برچسب را به تایم‌زونِ دستگاه می‌برد');
  });
});
