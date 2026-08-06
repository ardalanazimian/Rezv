import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  سیستمِ عکس
//
//  photo() تنها دروازه‌ی خواندنِ عکس از محتوای CMS است. محتوا از دیتابیس و
//  از استودیو می‌آید، پس هر شکلِ ناقصی ممکن است برسد؛ این تابع نباید هرگز
//  بیندازد و نباید چیزِ نصفه‌کاره را «عکسِ معتبر» اعلام کند.
// ═══════════════════════════════════════════════════════════════════════

const { photo } = await import('../components/site/Photo.tsx');

describe('خواندنِ عکس از محتوا', () => {
  test('عکسِ کامل خوانده می‌شود', () => {
    const p = photo({ src: '/photos/salon.jpg', alt: 'سالن', focal: '50% 30%', caption: 'شبِ جمعه' });
    assert.equal(p?.src, '/photos/salon.jpg');
    assert.equal(p?.alt, 'سالن');
    assert.equal(p?.focal, '50% 30%');
    assert.equal(p?.caption, 'شبِ جمعه');
  });

  test('بدونِ src یعنی عکسی نیست — نه یک عکسِ خراب', () => {
    for (const bad of [null, undefined, {}, { alt: 'فقط متن' }, { src: '' }, { src: '   ' }, 'رشته', 42, []]) {
      assert.equal(photo(bad), null, `باید null باشد برای ${JSON.stringify(bad)}`);
    }
  });

  test('فیلدهای اختیاریِ نوعِ اشتباه نادیده گرفته می‌شوند، نه اینکه بشکنند', () => {
    const p = photo({ src: '/a.jpg', alt: 123, focal: {}, width: '800', caption: null });
    assert.equal(p?.src, '/a.jpg');
    assert.equal(p?.alt, '');          // alt همیشه رشته است
    assert.equal(p?.focal, undefined);
    assert.equal(p?.width, undefined);
    assert.equal(p?.caption, undefined);
  });

  test('فاصله‌ی اضافه‌ی src حذف می‌شود', () => {
    assert.equal(photo({ src: '  /photos/x.jpg  ' })?.src, '/photos/x.jpg');
  });
});

describe('پیکربندیِ تصویرِ Next', () => {
  const cfg = readFileSync(new URL('../next.config.js', import.meta.url), 'utf8');

  // عکسِ آپلودشده‌ی رستوران‌ها از دامنه‌ی API می‌آید؛ بدونِ remotePatterns
  // مناسب، next/image آن‌ها را رد می‌کند و گالری خالی می‌ماند.
  test('مسیرِ رسانه‌ی API مجاز شده است', () => {
    assert.match(cfg, /remotePatterns/);
    assert.match(cfg, /\/api\/v1\/media\/\*\*/);
  });

  // همان دلیلِ امنیتیِ آپلودِ گالری: SVG می‌تواند اسکریپت داشته باشد.
  test('SVG از مسیرِ بهینه‌سازی رد نمی‌شود', () => {
    assert.match(cfg, /dangerouslyAllowSVG:\s*false/);
  });

  test('AVIF پیش از WebP می‌آید (حجمِ کمتر برای عکسِ غذا)', () => {
    const m = /formats:\s*\[([^\]]+)\]/.exec(cfg);
    assert.ok(m, 'formats باید تعریف شده باشد');
    assert.ok(m[1].indexOf('avif') < m[1].indexOf('webp'));
  });
});

describe('CSS گالری', () => {
  const css = readFileSync(new URL('../app/site.css', import.meta.url), 'utf8');

  // باگِ واقعی: با ارتفاعِ محتوامحور، خانه‌ی بزرگ یک ردیفِ سوم می‌ساخت که
  // خانه‌های دیگر پرش نمی‌کردند و یک ربعِ شبکه خالی می‌ماند.
  test('ارتفاعِ ردیف صریح است تا شبکه حفره نگیرد', () => {
    assert.match(css, /\.gal\s*\{[^}]*grid-auto-rows/);
  });

  test('داخلِ گالری، نسبتِ خودِ عکس بر شبکه غلبه نمی‌کند', () => {
    assert.match(css, /\.gal\s+\.ph\s*\{[^}]*aspect-ratio:\s*auto/);
  });
});
