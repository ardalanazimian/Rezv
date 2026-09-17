import { readFileSync } from 'node:fs';
import path from 'node:path';

// ═══════════════════════════════════════════════════════════════════════
//  نام‌های دادهٔ نمونه — از خودِ seed.js خوانده می‌شوند، نه از یک فهرستِ دستی
//
//  ⚠️ چرا (۲۰۲۶-۰۹-۱۶): customer-empty-not-fake.spec.ts شش نام را دستی نوشته
//  بود و پنج‌تایش دیگر در seed.js وجود نداشت («باغِ ایرانی»، «کافه نورا»،
//  «سنتوری»، «لاویا»، «ترمه»). ادعای «نامِ نمونه نشان داده نشد» برای آن پنج
//  هرگز نمی‌توانست قرمز شود — شبیهِ پوشش، بدونِ پوشش. نام‌ها حالا از منبع
//  استخراج می‌شوند و کنترلِ مثبتِ تعداد جلوی استخراجِ خالی را می‌گیرد.
// ═══════════════════════════════════════════════════════════════════════

const SEED = path.join(__dirname, '..', '..', '..', 'apps', 'customer', 'js', 'data', 'seed.js');

/** نامِ هر رستورانِ نمونه بدونِ برچسبِ `[DEMO]` — همان متنی که روی کارت دیده می‌شود. */
export function sampleRestaurantNames(): string[] {
  const src = readFileSync(SEED, 'utf8');
  const names = [...src.matchAll(/\bn:'([^']+)'/g)]
    .map(m => m[1].replace('[DEMO]', '').trim())
    .filter(Boolean);
  if (names.length < 6) {
    throw new Error(`sample-names: فقط ${names.length} نام از seed.js استخراج شد — الگوی استخراج با فایل هم‌خوان نیست`);
  }
  return [...new Set(names)];
}
