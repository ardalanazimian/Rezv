// ═══════════════════════════════════════════════════════════════════════
//  فونتِ فارسی برای تصویرِ اشتراک‌گذاری (next/og)
//
//  مسئله: موتورِ رندرِ next/og با فونتِ پیش‌فرضِ لاتین نمی‌تواند متنِ فارسی را
//  شکل‌دهی کند (خطای shaping) و کلِ تولیدِ تصویر شکست می‌خورد.
//
//  ⚠️ اصلاح‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴): نسخه‌ی قبلی فونت را در *زمانِ اجرا* از
//  fonts.googleapis.com می‌گرفت — یک وابستگیِ runtime به دامنه‌ای که در ایران
//  در دسترس نیست؛ یعنی روی سرورِ داخلِ کشور، کارتِ اشتراک‌گذاری همیشه به
//  نسخه‌ی لاتین سقوط می‌کرد. حالا از فایلِ محلی می‌خوانیم:
//  app/fonts/vazirmatn-bold.ttf — نمونه‌ی استاتیکِ وزنِ ۷۰۰ که از همان
//  فونتِ variableِ self-hostedِ shared/fonts ساخته شده (satori فقط
//  TTF/OTF/WOFF می‌پذیرد، نه woff2، و با فونتِ variable هم وزنِ پیش‌فرض را
//  می‌گیرد — برای همین نمونه‌ی استاتیکِ ۷۰۰ کنارِ woff2 نگه‌داری می‌شود).
//
//  اگر فایل خوانا نبود، null برمی‌گردد و فراخوان به نسخه‌ی لاتینِ کارت
//  برمی‌گردد — تصویرِ اشتراک‌گذاری هرگز نباید باعثِ خطای صفحه شود.
// ═══════════════════════════════════════════════════════════════════════

import { readFile } from 'fs/promises';
import { join } from 'path';

let cached: Promise<ArrayBuffer | null> | null = null;

async function load(): Promise<ArrayBuffer | null> {
  try {
    const buf = await readFile(join(process.cwd(), 'app', 'fonts', 'vazirmatn-bold.ttf'));
    // Buffer → ArrayBuffer (برشِ دقیق، نه کلِ pool)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  } catch {
    return null;
  }
}

/** بافرِ فونتِ فارسی، یا null اگر در دسترس نبود. */
export function persianFont(): Promise<ArrayBuffer | null> {
  if (!cached) cached = load();
  return cached;
}
