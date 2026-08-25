import { test, expect, type Page } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  ممیزیِ responsive — اندازه‌گیریِ واقعی، نه بازرسیِ چشمی
//
//  این فایل در همه‌ی عرض‌هایِ خواسته‌شده (۳۲۰ تا ۲۵۶۰) هر سه اپ را باز می‌کند و
//  دو چیزِ عینی را می‌سنجد:
//
//   ۱. **سرریزِ افقی** — `documentElement.scrollWidth > clientWidth`.
//      این تنها تعریفِ غیرقابلِ‌بحثِ «صفحه به‌طورِ افقی اسکرول می‌شود» است.
//      وقتی رخ می‌دهد، تستْ **عنصرِ مقصر** را هم گزارش می‌کند تا رفع ممکن باشد
//      (بدونِ آن، «سرریز دارد» یک گزارشِ بی‌مصرف است).
//
//   ۲. **هدفِ لمسیِ کوچک** — هر کنترلِ تعاملیِ دیده‌شده که از ۲۴×۲۴px کمتر
//      باشد. آستانه عمداً ۲۴ است (WCAG 2.2 §2.5.8 Target Size Minimum)، نه
//      ۴۴ که توصیه‌ی iOS HIG است — تا تست «شکستِ استاندارد» را بگیرد نه
//      «سلیقه‌ی طراحی».
//
//  چرا E2E و نه بازرسیِ CSS: سرریز از **ترکیب** می‌آید (متنِ بلندِ فارسی +
//  flex + padding + عرضِ ثابت)، نه از یک قاعده‌ی CSS. فقط رندرِ واقعی نشانش
//  می‌دهد.
// ═══════════════════════════════════════════════════════════════════════

const WIDTHS = [320, 360, 375, 390, 393, 412, 430, 480, 768, 820, 834, 1024, 1180,
                1280, 1366, 1440, 1536, 1728, 1920, 2560];
// عرض‌هایِ «غیرمتعارف» — پروتکل صریح می‌گوید فقط رویِ breakpointهایِ رایج تکیه نکن.
const ODD = [361, 599, 601, 767, 769, 1023, 1025, 1439];

const APPS: Array<{ name: string; url: string }> = [
  { name: 'customer', url: 'http://localhost:8080/' },
  { name: 'business', url: 'http://localhost:8081/' },
  { name: 'company', url: 'http://localhost:8082/' },
];

/** عنصرهایی که واقعاً از قابِ صفحه بیرون می‌زنند (برایِ گزارشِ قابلِ‌اقدام). */
async function overflowCulprits(page: Page) {
  return page.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const out: Array<{ sel: string; right: number; w: number }> = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') continue;
      // فقط عنصری که خودش لبه را رد می‌کند، نه والدی که فرزندش رد کرده
      if (r.right > docW + 1 || r.left < -1) {
        const sel = el.tagName.toLowerCase()
          + (el.id ? '#' + el.id : '')
          + (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        out.push({ sel, right: Math.round(r.right), w: Math.round(r.width) });
      }
    }
    return out.slice(0, 8);
  });
}

async function tinyTargets(page: Page) {
  return page.evaluate(() => {
    const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
    const out: Array<{ sel: string; w: number; h: number }> = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(SEL))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;      // پنهان
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.pointerEvents === 'none') continue;
      if (r.width < 24 || r.height < 24) {
        const sel = el.tagName.toLowerCase()
          + (el.id ? '#' + el.id : '')
          + (el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        out.push({ sel, w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    return out.slice(0, 10);
  });
}

test.describe('ممیزیِ سرریزِ افقی در همه‌ی عرض‌ها', () => {
  test.slow();
  for (const app of APPS) {
    test(`${app.name}: هیچ عرضی سرریزِ افقی ندارد`, async ({ page }) => {
      await mockApi(page);
      const failures: string[] = [];
      for (const w of [...WIDTHS, ...ODD]) {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(app.url);
        await page.waitForTimeout(450);          // رندرِ فیدِ تأخیردار
        const res = await page.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        if (res.scrollW > res.clientW + 1) {
          const who = await overflowCulprits(page);
          failures.push(`${w}px: scrollWidth=${res.scrollW} > ${res.clientW} — ` +
            who.map((c) => `${c.sel}(w=${c.w},right=${c.right})`).join(' · '));
        }
      }
      expect(failures, 'سرریزِ افقی:\n' + failures.join('\n')).toEqual([]);
    });
  }
});

test.describe('هدف‌هایِ لمسیِ زیرِ حدِ WCAG 2.2 (۲۴×۲۴)', () => {
  test.slow();
  for (const app of APPS) {
    test(`${app.name}: کنترلِ خیلی کوچک ندارد (۳۹۰px)`, async ({ page }) => {
      await mockApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(app.url);
      await page.waitForTimeout(600);
      const tiny = await tinyTargets(page);
      expect(tiny, 'کنترل‌هایِ کوچک:\n' +
        tiny.map((t) => `${t.sel} → ${t.w}×${t.h}`).join('\n')).toEqual([]);
    });
  }
});
