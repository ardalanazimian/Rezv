import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// import پویا عمداً — مطابقِ بقیه‌ی تست‌های این پروژه (باگ محیطیِ tsx+node:test).
const {
  sniffFormat, readDimensions, inspectImage, storageKey,
  isValidStorageKey, mimeFromKey, MAX_BYTES, MIN_BYTES, MAX_DIMENSION, MIN_DIMENSION,
} = await import('../src/lib/media.ts');

// ── سازنده‌های تصویرِ کمینه‌ی معتبر ──
// فایلِ واقعی روی دیسک نگه نمی‌داریم: هدرها همان چیزی‌اند که کد می‌خواند و
// ساختنشان در تست، آزمون را خودبسنده و سریع می‌کند.

function pad(head: number[], total = 1024): Uint8Array {
  const b = new Uint8Array(total);
  b.set(head, 0);
  return b;
}

function png(w: number, h: number): Uint8Array {
  const head = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  const b = pad(head);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, w);
  dv.setUint32(20, h);
  return b;
}

function jpeg(w: number, h: number): Uint8Array {
  // SOI، سپس یک APP0ِ ساختگی، سپس SOF0 با ابعاد
  const b = pad([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  const dv = new DataView(b.buffer);
  dv.setUint16(13, h);   // ارتفاع پیش از عرض می‌آید — همان ترتیبِ استاندارد
  dv.setUint16(15, w);
  return b;
}

function webpVp8x(w: number, h: number): Uint8Array {
  const b = pad([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const w1 = w - 1;
  const h1 = h - 1;
  b[24] = w1 & 0xff; b[25] = (w1 >> 8) & 0xff; b[26] = (w1 >> 16) & 0xff;
  b[27] = h1 & 0xff; b[28] = (h1 >> 8) & 0xff; b[29] = (h1 >> 16) & 0xff;
  return b;
}

describe('تشخیصِ قالب از روی بایت‌ها', () => {
  test('PNG، JPEG و WebP شناخته می‌شوند', () => {
    assert.equal(sniffFormat(png(400, 300)), 'png');
    assert.equal(sniffFormat(jpeg(400, 300)), 'jpeg');
    assert.equal(sniffFormat(webpVp8x(400, 300)), 'webp');
  });

  // ⚠️ مهم‌ترین تستِ این فایل. SVG یک سندِ XML است و می‌تواند <script> داشته
  // باشد؛ اگر پذیرفته و از دامنه‌ی API سرو شود، XSS روی نشستِ مدیر است.
  test('SVG هرگز پذیرفته نمی‌شود — حتی با پسوند و content-type درست', () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'.padEnd(1024, ' '),
    );
    assert.equal(sniffFormat(svg), null);
    const r = inspectImage(svg);
    assert.equal(r.ok, false);
  });

  test('HTMLِ نقاب‌زده به عکس رد می‌شود', () => {
    const html = new TextEncoder().encode('<!doctype html><script>fetch("/steal")</script>'.padEnd(1024, ' '));
    assert.equal(sniffFormat(html), null);
  });

  test('فایلِ خالی یا خیلی کوتاه چیزی را نمی‌شکند', () => {
    assert.equal(sniffFormat(new Uint8Array(0)), null);
    assert.equal(sniffFormat(new Uint8Array([0xff, 0xd8])), null);
  });
});

describe('خواندنِ ابعاد', () => {
  test('PNG', () => assert.deepEqual(readDimensions(png(1280, 720), 'png'), [1280, 720]));
  test('JPEG', () => assert.deepEqual(readDimensions(jpeg(1920, 1080), 'jpeg'), [1920, 1080]));
  test('WebP (VP8X)', () => assert.deepEqual(readDimensions(webpVp8x(800, 600), 'webp'), [800, 600]));

  test('JPEGِ بدونِ SOF یعنی ابعاد خوانده نشد، نه صفر', () => {
    const broken = pad([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
    assert.equal(readDimensions(broken, 'jpeg'), null);
  });
});

describe('بازرسیِ کاملِ آپلود', () => {
  test('عکسِ سالم پذیرفته می‌شود', () => {
    const r = inspectImage(png(1200, 800));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.format, 'png');
      assert.equal(r.mime, 'image/png');
      assert.equal(r.width, 1200);
      assert.equal(r.height, 800);
    }
  });

  test('حجمِ بیش از سقف رد می‌شود', () => {
    const big = new Uint8Array(MAX_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const r = inspectImage(big);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /مگابایت/);
  });

  test('فایلِ کوچک‌تر از کف رد می‌شود', () => {
    assert.equal(inspectImage(new Uint8Array(MIN_BYTES - 1)).ok, false);
  });

  // «بمبِ ابعاد»: فایلِ چند کیلوبایتی که ادعا می‌کند ۵۰٬۰۰۰ پیکسل است و هر
  // پردازشگرِ تصویری را از پا درمی‌آورد.
  test('ابعادِ غول‌آسا رد می‌شود حتی اگر حجم کم باشد', () => {
    const r = inspectImage(png(50000, 50000));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, new RegExp(String(MAX_DIMENSION)));
  });

  test('عکسِ خیلی کوچک برای گالری رد می‌شود', () => {
    const r = inspectImage(png(MIN_DIMENSION - 1, MIN_DIMENSION - 1));
    assert.equal(r.ok, false);
  });

  test('پیامِ خطا همیشه فارسی و قابلِ‌نمایش است', () => {
    const r = inspectImage(new TextEncoder().encode('x'.repeat(1024)));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /[؀-ۿ]/);
  });
});

describe('کلیدِ ذخیره‌سازی — مرزِ path traversal', () => {
  const uuid = '11111111-2222-4333-8444-555555555555';

  test('کلیدِ ساخته‌شده معتبر است و پوشه‌بندیِ تاریخی دارد', () => {
    const k = storageKey('jpeg', uuid, new Date(Date.UTC(2026, 7, 5)));
    assert.equal(k, `2026/08/${uuid}.jpg`);
    assert.ok(isValidStorageKey(k));
  });

  test('ماهِ تک‌رقمی صفرِ ابتدایی می‌گیرد', () => {
    assert.match(storageKey('png', uuid, new Date(Date.UTC(2026, 0, 9))), /^2026\/01\//);
  });

  // این‌ها دقیقاً چیزهایی‌اند که یک مهاجم در URL می‌فرستد.
  const bad = [
    '../../../etc/passwd',
    '2026/08/../../../etc/passwd',
    '2026/08/' + uuid + '.jpg/../../../root',
    '..%2f..%2fetc%2fpasswd',
    '2026/08/' + uuid + '.svg',
    '2026/08/' + uuid + '.php',
    '2026/08/' + uuid + '.jpg.php',
    '/etc/passwd',
    '2026/08/not-a-uuid.jpg',
    '2026/8/' + uuid + '.jpg',
    '',
  ];
  for (const k of bad) {
    test(`رد می‌شود: «${k || '(خالی)'}»`, () => {
      assert.equal(isValidStorageKey(k), false);
      assert.equal(mimeFromKey(k), null);
    });
  }

  test('MIME از پسوندِ کلید می‌آید، نه از دیتابیس', () => {
    assert.equal(mimeFromKey(`2026/08/${uuid}.jpg`), 'image/jpeg');
    assert.equal(mimeFromKey(`2026/08/${uuid}.png`), 'image/png');
    assert.equal(mimeFromKey(`2026/08/${uuid}.webp`), 'image/webp');
  });
});
