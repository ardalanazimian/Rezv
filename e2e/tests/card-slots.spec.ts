import { test, expect } from '@playwright/test';
import { mockApi, DEMO_RESTAURANTS } from './helpers/mock-api';
import { closeSearchCtxSheet, gotoApp, openImmersiveTile, openSearchCtxSheet } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  چیپِ ساعتِ کارت — از availabilityِ واقعی، نه حدس
//
//  شکافی که این تست قفلش می‌کند (موردِ ۱ از کارهای باقی‌مانده‌ی ممیزیِ
//  ۲۰۲۶-۰۸-۲۴): `mapApiRestaurant` از روزِ اول `available_slots` را می‌خواند،
//  ولی هیچ روتی آن را برنمی‌گرداند — پس کارتِ هر رستورانِ زنده همیشه بی‌ساعت
//  می‌ماند. حالا `GET /restaurants/availability` (گروهی) این حلقه را می‌بندد.
//
//  دو قاعده‌ی صداقت که اینجا اندازه گرفته می‌شوند:
//   ۱) ساعتی که نشان داده می‌شود باید *همانی* باشد که سرور آزاد اعلام کرده.
//   ۲) رستورانی که سانسِ آزاد ندارد هیچ ساعتی نمی‌گیرد — به CTAِ آرام می‌افتد،
//      نه یک ساعتِ اختراعی.
// ═══════════════════════════════════════════════════════════════════════

// ⚠️ [DS-011 · ۲۰۲۶-۰۹-۱۲] چیپ‌های ساعت از کارتِ فید به نمای تمام‌صفحه رفتند:
// تایلِ ۱۲۸pxِ موزاییکِ Explore جای کنترلِ ۴۴px ندارد. ادعاها عوض نشده‌اند —
// فقط جایی که سنجیده می‌شوند. paintSlots همان یک نقاش است و آیتم‌های
// #imFeed را با همان داده می‌کشد، و نما از کلِ فهرستِ فید ساخته می‌شود،
// پس یک‌بار باز کردن برای دیدنِ چیپِ هر رستورانِ فهرست کافی است.
const timeChips = (page: import('@playwright/test').Page, rid: string) =>
  page.locator(`#imFeed .im-item[data-rid="${rid}"] .rc-slot`);

test('کارتِ رستورانِ زنده ساعتِ واقعیِ سرور را نشان می‌دهد', async ({ page }) => {
  await mockApi(page);
  await gotoApp(page);

  await openImmersiveTile(page, 0);
  const chips = timeChips(page, DEMO_RESTAURANTS[0].id);
  await expect(chips.first()).toHaveText('19:00');
  await expect(chips.nth(1)).toHaveText('20:00');
});

test('⚠️ رستورانِ بدونِ سانسِ آزاد ساعتِ اختراعی نمی‌گیرد', async ({ page }) => {
  await mockApi(page);
  await gotoApp(page);

  // mock فقط به رستورانِ اول سانس می‌دهد؛ بقیه باید CTAِ آرام بگیرند.
  await openImmersiveTile(page, 0);
  const chips = timeChips(page, DEMO_RESTAURANTS[1].id);
  await expect(chips).toHaveCount(1);
  await expect(chips.first()).toHaveText('ببین سانس‌ها');
});

test('⚠️ تغییرِ تاریخ/تعدادِ نفر ساعت‌ها را دوباره می‌پرسد و به‌روز می‌کند', async ({ page }) => {
  await mockApi(page);

  // پاسخِ گروهی را وابسته به party کن تا تغییر واقعاً قابلِ اندازه‌گیری باشد.
  // (بعد از mockApi ثبت می‌شود، پس اولویت دارد.)
  const asked: string[] = [];
  await page.route('**/api/v1/restaurants/availability**', (route) => {
    const url = new URL(route.request().url());
    const party = Number(url.searchParams.get('party') || 2);
    asked.push(`${url.searchParams.get('date')}|${party}`);
    const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
    const restaurants: Record<string, unknown> = {};
    for (const id of ids) {
      restaurants[id] = {
        available_slots: party >= 6 ? ['21:00'] : ['19:00', '20:00'],
        has_schedule: true,
      };
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ date: url.searchParams.get('date'), party, restaurants, requested: ids.length, max_per_request: 24 }),
    });
  });

  await gotoApp(page);
  await openImmersiveTile(page, 0);
  const chips = timeChips(page, DEMO_RESTAURANTS[0].id);
  await expect(chips.first()).toHaveText('19:00');

  // تنظیمِ «کِی و چند نفر؟» روی صفحه‌ی کشف است، پس اول از نما بیرون می‌آییم.
  await page.keyboard.press('Escape');
  await expect(page.locator('#page-discover')).toBeVisible();
  await openSearchCtxSheet(page);
  const tomorrow = await page.locator('#ctxWhen option').nth(1).getAttribute('value');
  await page.selectOption('#ctxWhen', tomorrow!);
  await page.selectOption('#ctxParty', '6');
  await closeSearchCtxSheet(page);
  await openImmersiveTile(page, 0);

  // چیپ باید به سانسِ گروهِ ۶نفره برسد — نه ساعتِ انتخابِ قبلی.
  await expect(chips.first()).toHaveText('21:00');
  await expect(chips).toHaveCount(1);

  // و واقعاً برای همان تاریخ/تعداد پرسیده شده باشد (نه اینکه از کش خوانده شود).
  expect(asked.some(a => a === `${tomorrow}|6`)).toBe(true);
});

test('⚠️ شکستِ availability هیچ ساعتی نمی‌سازد', async ({ page }) => {
  await mockApi(page);
  // سرور خطا می‌دهد — کارت باید صادقانه به CTA برگردد، نه ساعتِ حدسی.
  await page.route('**/api/v1/restaurants/availability**', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'خطا' } }) }));

  await gotoApp(page);
  await openImmersiveTile(page, 0);
  const chips = timeChips(page, DEMO_RESTAURANTS[0].id);
  await expect(chips.first()).toHaveText('ببین سانس‌ها');
  // ساعتِ اختراعی حالا در نما ظاهر می‌شد، نه در فید — همان‌جا را می‌سنجیم.
  await expect(page.locator('#imFeed')).not.toContainText('19:00');
});
