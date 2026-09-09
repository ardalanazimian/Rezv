// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════
//  یک نگاشتِ وضعیت در پنلِ رستوران، نه چند تا
//
//  اسپک: `docs/audit/design/DS-003-panel-error-vocabulary.md` §۳ و §۴‑۲
//  (نشستِ Designer `rezv-f3 [54834f]`). یافته مالِ اوست؛ اجرا مالِ من.
//
//  ⚠️ نقصی که رفع شد: `ST_FA` در `crm.js:1024` شش کلید از **هجده** مقدارِ
//  `RStatus` داشت، پس در تایم‌لاینِ پروفایلِ مشتری وضعیت‌هایی مثل
//  `waitlisted`/`preparing`/`checked_in`/`dining` کلیدِ خامِ انگلیسی می‌شدند.
//  دقیقاً همان کلاسِ DS-001 که پشتِ میزِ پذیرش `platinum` نشان می‌داد.
//
//  ⚠️ و بدتر از ناقص‌بودن: دو برچسب **واگرا** بودند — یک وضعیت، دو نامِ
//  فارسی در دو صفحه‌ی همین پنل:
//      seated  → «نشسته» در ST_FA  ·  «سر میز» در STATUS_META
//      no_show → «عدم‌حضور»        ·  «نیومد»
//  یعنی دو نفر که به یک صفحه نگاه می‌کنند دو چیز می‌بینند.
//
//  ⚠️ این تست **مکملِ** گاردِ §۴‑۴ است، نه رونوشتش: آن یکی می‌پرسد «نگاشت
//  همه‌ی `RStatus` را دارد؟» و مالِ `rezv-f3` است. این یکی می‌پرسد **«فقط
//  یک نگاشت وجود دارد؟»** — چون نگاشتِ کاملِ دوم هم بالاخره واگرا می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const BUSINESS_JS = fileURLToPath(new URL('apps/business/js/', ROOT));
const COMPANY_JS = fileURLToPath(new URL('apps/company/js/', ROOT));

/** کلیدهایی که فقط در وضعیتِ رزرو معنی دارند — نه در وضعیتِ اشتراک/پلن. */
const RESERVATION_ONLY_KEYS = ['seated', 'no_show', 'checked_in', 'waitlisted', 'preparing', 'dining'];

function jsFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => join(dir, f));
}

function codeOnly(src: string): string {
  return src.split('\n').map((l) => {
    const i = l.indexOf('//');
    return i === -1 ? l : l.slice(0, i);
  }).join('\n');
}

describe('پنلِ رستوران — یک نگاشتِ وضعیت', () => {

  test('⚠️ هیچ نگاشتِ دومِ وضعیتِ رزرو در apps/business نیست', () => {
    // هر object literal که دستِ‌کم دو کلیدِ **مخصوصِ رزرو** را به رشته نگاشت
    // کند، یک نگاشتِ وضعیت است. `STATUS_META` تنها نسخه‌ی مجاز است.
    const offenders: string[] = [];

    for (const file of jsFiles(BUSINESS_JS)) {
      const rel = relative(BUSINESS_JS, file).split('\\').join('/');
      const code = codeOnly(readFileSync(file, 'utf8'));
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        for (const lit of line.matchAll(/\{[^{}]*\}/g)) {
          const body = lit[0];
          const hits = RESERVATION_ONLY_KEYS.filter(
            (k) => new RegExp(`(^|[{,\\s])${k}\\s*:\\s*['\`]`).test(body),
          );
          if (hits.length < 2) continue;
          // خودِ STATUS_META مجاز است — تنها منبعِ حقیقت.
          if (/STATUS_META\s*=/.test(lines.slice(Math.max(0, i - 1), i + 1).join('\n'))) continue;
          offenders.push(`${rel}:${i + 1}  (${hits.join(', ')})`);
        }
      });
    }

    assert.deepEqual(
      offenders, [],
      'نگاشتِ دومِ وضعیتِ رزرو پیدا شد. تنها منبع باید `STATUS_META` در data.js باشد ' +
      '— نگاشتِ دوم یا ناقص است یا بالاخره واگرا می‌شود:\n  ' + offenders.join('\n  '),
    );
  });

  test('⚠️ ST_FA برنگشته است', () => {
    // نامِ مشخص، چون همین یکی بود که واگرا شده بود.
    const crm = codeOnly(readFileSync(join(BUSINESS_JS, 'crm.js'), 'utf8'));
    assert.ok(!/\bST_FA\s*=/.test(crm), '`ST_FA` دوباره تعریف شده — نگاشتِ ناقصِ دوم');
    assert.ok(crm.includes('STATUS_META['), 'crm.js باید از STATUS_META بخواند');
  });

  test('⚠️ نگاشتِ مرده‌ی وضعیتِ اشتراک در apps/company برنگشته است', () => {
    // ⚠️ اسپک این را «دو نگاشتِ یکسان» می‌خواند؛ اندازه‌گیری دقیق‌تر بود:
    // `SUB_STATUS_LABEL` **مرده** بود — تعریف می‌شد و هیچ‌جا خوانده نمی‌شد.
    // خطرش واگراییِ رفتاری نبود، بلکه این بود که کسی نسخه‌ی مرده را ویرایش
    // کند و فکر کند کاری کرده.
    const all = jsFiles(COMPANY_JS)
      .map((f) => codeOnly(readFileSync(f, 'utf8')))
      .join('\n');
    assert.ok(!/\bSUB_STATUS_LABEL\s*=/.test(all), '`SUB_STATUS_LABEL` برگشته — رونوشتِ مرده');
    assert.ok(/\bSTATUS_LABEL\s*=/.test(all), '`STATUS_LABEL` باید بماند — نسخه‌ی زنده');
  });
});
