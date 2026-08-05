import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  محافظ‌های CSS
//
//  اینجا رفتارِ بصری تست نمی‌شود — آن کارِ مرورگر است. اینجا فقط چند قاعده‌ی
//  حیاتی که یک‌بار واقعاً شکستند و در مرورگر پیدا شدند قفل می‌شوند تا با
//  ویرایشِ بعدی بی‌صدا برنگردند.
// ═══════════════════════════════════════════════════════════════════════

const site = readFileSync(new URL('../app/site.css', import.meta.url), 'utf8');
const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('تیترِ گرادیانیِ متحرک', () => {
  // باگِ واقعی: .text-gradient روی پوسته color:transparent می‌گذارد، ولی
  // .kx-word__in یک transform دارد و لایه‌ی جدا می‌سازد؛ پس‌زمینه‌ی
  // برش‌خورده به آن نمی‌رسد و نیمی از تیترِ هیرو نامرئی می‌شد.
  test('کلمه‌های متحرک باید گرادیانِ خودشان را داشته باشند', () => {
    assert.match(site, /\.text-gradient\s+\.kx-word__in\s*\{[^}]*background:\s*linear-gradient/);
    assert.match(site, /\.text-gradient\s+\.kx-word__in\s*\{[^}]*background-clip:\s*text/);
  });

  test('نسخه‌ی تمِ تاریک هم باید باشد، وگرنه تیتر روی زمینه‌ی تیره کم‌جان است', () => {
    assert.match(site, /\[data-theme='dark'\]\s+\.text-gradient\s+\.kx-word__in/);
  });
});

describe('پرده‌ی ورود', () => {
  // باگِ واقعی: پرده با visibility بسته می‌شد و کروم در حالتِ fill-forwards
  // آن را اعمال نمی‌کرد؛ پرده روی صفحه می‌ماند. opacity قطعی است.
  test('بسته‌شدنِ پرده باید به opacity تکیه کند، نه فقط visibility', () => {
    const kf = /@keyframes intro-off\s*\{([^}]*\{[^}]*\}[^}]*)\}/.exec(globals);
    assert.ok(kf, 'کی‌فریمِ intro-off باید وجود داشته باشد');
    assert.match(kf[1], /opacity:\s*0/);
  });

  test('پرده نباید جلوی کلیک را بگیرد', () => {
    assert.match(globals, /\.intro\s*\{[^}]*pointer-events:\s*none/);
  });

  test('در حالتِ کاهشِ حرکت پرده اصلاً نباید رندر شود', () => {
    assert.match(globals, /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.intro\s*\{\s*display:\s*none/);
  });

  // تیغه‌ها باید پیش از بسته‌شدنِ پرده تمام شده باشند وگرنه وسطِ کار قطع می‌شود.
  test('زمان‌بندی: آخرین تیغه نباید بعد از intro-off تمام شود', () => {
    const bar = /\.intro__bar\s*\{[\s\S]*?animation:\s*intro-bar\s+([\d.]+)s[\s\S]*?animation-delay:\s*calc\(([\d.]+)s\s*\+\s*var\(--i\)\s*\*\s*([\d.]+)s\)/.exec(globals);
    const off = /\.intro\s*\{[\s\S]*?animation:\s*intro-off\s+[\d.]+m?s\s+\w+\s+([\d.]+)s/.exec(globals);
    assert.ok(bar && off, 'زمان‌بندیِ تیغه و پرده باید قابلِ‌خواندن باشد');
    const bars = 6; // با BARS در components/site/Intro.tsx یکی است
    const lastEnds = Number(bar[2]) + (bars - 1) * Number(bar[3]) + Number(bar[1]);
    assert.ok(
      lastEnds <= Number(off[1]) + 0.001,
      `آخرین تیغه در ${lastEnds.toFixed(2)}s تمام می‌شود ولی پرده در ${off[1]}s بسته می‌شود`,
    );
  });
});

describe('نشانگرِ سفارشی', () => {
  // اگر cursor:none بی‌قید اعمال شود و JS اجرا نشود، کاربر نشانگر ندارد.
  test('cursor:none فقط با کلاسی که JS می‌گذارد فعال می‌شود', () => {
    assert.match(globals, /html\.has-cursor[\s\S]{0,60}cursor:\s*none/);
    assert.doesNotMatch(globals, /^\s*body\s*\{[^}]*cursor:\s*none/m);
  });

  test('ورودی‌های متنی باید نشانگرِ متن داشته باشند', () => {
    assert.match(globals, /has-cursor\s*:is\(input, textarea, \[contenteditable\]\)[\s\S]{0,60}cursor:\s*text/);
  });
});

describe('دانه‌ی فیلم', () => {
  test('نباید جلوی کلیک را بگیرد', () => {
    assert.match(globals, /\.grain\s*\{[^}]*pointer-events:\s*none/);
  });
});
