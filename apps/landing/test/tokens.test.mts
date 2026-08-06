import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  توکن‌های CSS باید واقعاً تعریف شده باشند
//
//  چرا این تست وجود دارد: `clamp(var(--sp-14), 9vh, var(--sp-24))` وقتی
//  --sp-14 تعریف نشده باشد یک مقدارِ نامعتبر است و مرورگر **کلِ اعلان را
//  بی‌صدا دور می‌اندازد**. نه خطایی می‌دهد، نه در build گیر می‌کند — فقط
//  فاصله صفر می‌شود. دقیقاً همین اتفاق افتاد و صحنه‌ی هیرو روی ردیفِ
//  ویژگی‌ها افتاد؛ فقط با اندازه‌گیریِ هندسه در مرورگر پیدا شد.
//
//  توکن‌هایی که در زمانِ اجرا با JS یا style خطی ست می‌شوند استثنا هستند و
//  همیشه fallback دارند.
// ═══════════════════════════════════════════════════════════════════════

const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const site = readFileSync(new URL('../app/site.css', import.meta.url), 'utf8');

/** توکن‌هایی که از JS/inline می‌آیند، نه از فایلِ توکن‌ها. */
const RUNTIME = new Set([
  '--i',            // نمایه‌ی تیغه‌های پرده‌ی ورود (style خطی)
  '--mx', '--my',   // مکانِ اشاره‌گر روی کارتِ سه‌بعدی
  '--kx-mx', '--kx-my',
  '--progress',     // نوارِ پیشرفتِ اسکرول
  '--reveal-delay', // تأخیرِ پلکانیِ Reveal
  '--vel',          // سرعتِ اسکرول
]);

const defined = new Set([...globals.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

describe('توکن‌های CSS', () => {
  test('هر var() یا تعریف شده است یا در زمانِ اجرا ست می‌شود', () => {
    const missing = new Map<string, string>();
    for (const [file, src] of [['site.css', site], ['globals.css', globals]] as const) {
      for (const m of src.matchAll(/var\((--[a-z0-9-]+)/g)) {
        const name = m[1];
        if (defined.has(name) || RUNTIME.has(name)) continue;
        if (!missing.has(name)) {
          missing.set(name, `${file}:${src.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    assert.equal(
      missing.size, 0,
      `توکنِ تعریف‌نشده: ${[...missing].map(([k, v]) => `${k} (${v})`).join('، ')}`,
    );
  });

  test('مقیاسِ فاصله پیوسته است — عددی که وجود ندارد استفاده نشود', () => {
    const scale = new Set(
      [...globals.matchAll(/--sp-(\d+)\s*:/g)].map((m) => Number(m[1])),
    );
    assert.ok(scale.size >= 8, 'مقیاسِ فاصله باید چند پله داشته باشد');
    const used = new Set(
      [...(site + globals).matchAll(/var\(--sp-(\d+)/g)].map((m) => Number(m[1])),
    );
    const orphan = [...used].filter((n) => !scale.has(n));
    assert.deepEqual(orphan, [], `پله‌ی فاصله‌ی ناموجود: ${orphan.join('، ')}`);
  });
});
