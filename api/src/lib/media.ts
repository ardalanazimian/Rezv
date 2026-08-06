// ═══════════════════════════════════════════════════════════════════════
//  media — بازرسیِ فایلِ تصویرِ آپلودشده
//
//  این ماژول عمداً «خالص» است: بایت می‌گیرد و نتیجه برمی‌گرداند. نه به دیسک
//  دست می‌زند، نه به دیتابیس. برای همین کاملاً قابلِ تست است و همان کدی که
//  در تست اجرا می‌شود در تولید هم اجرا می‌شود.
//
//  چرا بدونِ کتابخانه‌ی تصویر (sharp و امثالش): کلِ وابستگی‌های api شش تاست.
//  sharp یک باینریِ نیتیوِ ده‌ها مگابایتی است که buildِ داکر را سنگین و
//  شکننده می‌کند. کاری که ما لازم داریم — تشخیصِ قالب و خواندنِ ابعاد — با
//  چند ده خط خواندنِ هدر انجام می‌شود.
//
//  ── تصمیمِ امنیتی: فقط سه قالبِ رستری ──
//  SVG عمداً پذیرفته نمی‌شود. SVG یک سندِ XML است که می‌تواند <script> داشته
//  باشد؛ سرو کردنش از همان دامنه‌ی API یعنی XSS روی نشستِ مدیر و رستوران‌دار.
//  همین‌طور به Content-Type ای که مرورگر می‌فرستد اعتماد نمی‌کنیم — هر کسی
//  می‌تواند در یک درخواستِ دستی بنویسد image/png. تنها منبعِ حقیقت، بایت‌های
//  ابتدای فایل است.
// ═══════════════════════════════════════════════════════════════════════

export type ImageFormat = 'jpeg' | 'png' | 'webp';

export const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const EXT_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

/** سقفِ حجم — بالاتر از این، آپلود رد می‌شود (پیش از نوشتن روی دیسک). */
export const MAX_BYTES = 8 * 1024 * 1024;
/** کف: چیزی کوچک‌تر از این عملاً تصویرِ معتبر نیست و احتمالاً فایلِ خراب است. */
export const MIN_BYTES = 256;
/** بزرگ‌ترین بُعدِ مجاز. جلوی «بمبِ ابعاد» را می‌گیرد (تصویرِ ۵۰٬۰۰۰ پیکسلی). */
export const MAX_DIMENSION = 8000;
/** کوچک‌ترین بُعدِ مفید برای گالری — کمتر از این روی صفحه زشت می‌شود. */
export const MIN_DIMENSION = 200;

export interface InspectOk {
  ok: true;
  format: ImageFormat;
  mime: string;
  width: number;
  height: number;
  bytes: number;
}
export interface InspectFail {
  ok: false;
  /** پیامِ فارسیِ آماده برای نمایش به کاربر */
  error: string;
}
export type InspectResult = InspectOk | InspectFail;

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

/** قالب را فقط از روی بایت‌های آغازین تشخیص می‌دهد (نه از پسوند و نه از هدر). */
export function sniffFormat(b: Uint8Array): ImageFormat | null {
  if (b.length < 12) return null;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return 'png';
  // WebP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'webp';
  return null;
}

/** ابعادِ PNG — همیشه در چانکِ IHDR که اولین چانک است. */
function pngSize(b: Uint8Array): [number, number] | null {
  if (b.length < 24) return null;
  return [be32(b, 16), be32(b, 20)];
}

/**
 * ابعادِ JPEG — باید مارکرها را پیمود تا به یکی از SOFها رسید.
 * SOF0/1/2/3, 5/6/7, 9/10/11, 13/14/15 همگی هدرِ ابعاد دارند؛ C4/C8/CC
 * مارکرهای دیگری‌اند و باید رد شوند.
 */
function jpegSize(b: Uint8Array): [number, number] | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }          // همگام‌سازیِ دوباره روی مارکر
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; }         // بایتِ پرکننده
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    const len = be16(b, i + 2);
    if (len < 2) return null;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) return [be16(b, i + 7), be16(b, i + 5)];   // [عرض, ارتفاع]
    i += 2 + len;
  }
  return null;
}

/** ابعادِ WebP — سه گویشِ متفاوت: ساده (VP8)، بی‌اتلاف (VP8L)، توسعه‌یافته (VP8X). */
function webpSize(b: Uint8Array): [number, number] | null {
  if (b.length < 30) return null;
  const tag = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (tag === 'VP8 ') {
    // کلیدِ همگام‌سازیِ فریم، سپس عرض/ارتفاعِ ۱۴ بیتی
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return [le16(b, 26) & 0x3fff, le16(b, 28) & 0x3fff];
  }
  if (tag === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = le32(b, 21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  if (tag === 'VP8X') {
    return [le24(b, 24) + 1, le24(b, 27) + 1];
  }
  return null;
}

function le32(b: Uint8Array, i: number): number {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}

/** ابعاد را بر اساسِ قالبِ تشخیص‌داده‌شده می‌خواند. */
export function readDimensions(b: Uint8Array, format: ImageFormat): [number, number] | null {
  const size = format === 'png' ? pngSize(b) : format === 'jpeg' ? jpegSize(b) : webpSize(b);
  if (!size) return null;
  const [w, h] = size;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return [w, h];
}

/**
 * بازرسیِ کاملِ یک فایلِ آپلودشده. تنها دروازه‌ی ورود — هر مسیری که فایل
 * می‌پذیرد باید از اینجا رد شود.
 */
export function inspectImage(bytes: Uint8Array): InspectResult {
  if (bytes.length < MIN_BYTES) {
    return { ok: false, error: 'فایل خیلی کوچک است و تصویرِ معتبری نیست' };
  }
  if (bytes.length > MAX_BYTES) {
    return { ok: false, error: `حجمِ عکس نباید از ${Math.round(MAX_BYTES / 1024 / 1024)} مگابایت بیشتر باشد` };
  }

  const format = sniffFormat(bytes);
  if (!format) {
    // پیام عمداً می‌گوید چه چیزی پذیرفته می‌شود، نه فقط «نامعتبر».
    return { ok: false, error: 'فقط عکسِ JPEG، PNG یا WebP پذیرفته می‌شود' };
  }

  const dims = readDimensions(bytes, format);
  if (!dims) {
    return { ok: false, error: 'فایل خراب است یا ابعادش خوانده نشد' };
  }
  const [width, height] = dims;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return { ok: false, error: `ابعادِ عکس نباید از ${MAX_DIMENSION} پیکسل بیشتر باشد` };
  }
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return { ok: false, error: `عکس باید دستِ‌کم ${MIN_DIMENSION}×${MIN_DIMENSION} پیکسل باشد` };
  }

  return { ok: true, format, mime: MIME_BY_FORMAT[format], width, height, bytes: bytes.length };
}

/**
 * کلیدِ ذخیره‌سازی: <سالِ میلادی>/<ماه>/<uuid>.<پسوند>
 *
 * پوشه‌بندیِ تاریخی برای این است که یک دایرکتوری با ده‌ها هزار فایل روی
 * برخی فایل‌سیستم‌ها کند می‌شود. نامِ فایل از uuid می‌آید نه از نامِ کاربر —
 * نامِ کاربر می‌تواند «../../etc/passwd» یا کاراکترِ کنترلی داشته باشد.
 */
export function storageKey(format: ImageFormat, uuid: string, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}/${m}/${uuid}.${EXT_BY_FORMAT[format]}`;
}

/**
 * اعتبارسنجیِ کلیدی که از URL آمده، پیش از هر لمسِ فایل‌سیستم.
 *
 * ⚠️ این تابع مرزِ path traversal است. الگو عمداً «فهرستِ سفید»ِ سخت‌گیرانه
 * است و نه «حذفِ ../»: پاک‌سازیِ رشته‌ای همیشه دور زده می‌شود (کدگذاریِ
 * درصدی، یونیکد، بک‌اسلش). چیزی که با این الگو نخواند، اصلاً فایل نیست.
 */
const KEY_RE = /^\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function isValidStorageKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** MIME از روی پسوندِ کلید — برای سرو کردن، بدونِ اعتماد به چیزی که ذخیره شده. */
export function mimeFromKey(key: string): string | null {
  if (!isValidStorageKey(key)) return null;
  if (key.endsWith('.jpg')) return MIME_BY_FORMAT.jpeg;
  if (key.endsWith('.png')) return MIME_BY_FORMAT.png;
  return MIME_BY_FORMAT.webp;
}
