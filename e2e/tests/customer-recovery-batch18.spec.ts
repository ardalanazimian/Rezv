import { test, expect, Page } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, login, openFirstRestaurant } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ Batch 18 — پنج یافته‌ی تأییدشده‌ی اپِ مشتری که رفع شدند
//
//  هر تست دقیقاً همان رفتارِ **قبلی** را رد می‌کند، نه صرفاً رفتارِ جدید را
//  تأیید. یعنی اگر کسی رفع را برگرداند، این فایل قرمز می‌شود.
//
//   IS-1  مرکزِ اعلان برایِ مهمانِ ناشناس «یادآورِ رزرو» از دادهٔ seed می‌ساخت
//   F4    بنرِ اعلان تیکِ سبزِ «فعال است» می‌داد در حالی که سرور ready:false است
//   F6    صفحه‌بندیِ رستوران‌ها هیچ صداکننده‌ای نداشت (قابلیتِ دست‌نیافتنی)
//   IS-3  pull-to-refresh هیچ درخواستی نمی‌فرستاد
//   RC-6  هر بوتِ سرد دو بار `GET /events` می‌فرستاد
//   LR-02 کدِ کوپن/کارتِ هدیه‌ی خریداری‌شده دور ریخته می‌شد
// ═══════════════════════════════════════════════════════════════════════

/** شمارشِ درخواست‌هایِ یک مسیر روی کلِ طولِ عمرِ صفحه. */
function countRequests(page: Page, re: RegExp) {
  const hits: string[] = [];
  page.on('request', (r) => { if (re.test(r.url())) hits.push(r.url()); });
  return hits;
}

/** «اجازه‌ی مرورگر داده شده» را جا می‌زند، روی هر موتوری.
 *
 *  ⚠️ WebKit (پروفایلِ mobile-safari = iPhone 13) اصلاً `Notification` ندارد —
 *  دقیقاً مثلِ Safariِ واقعیِ iOS. پس نمی‌شود فقط `permission` را override کرد؛
 *  اگر خودِ سازنده نباشد باید ساخته شود. این کار **رفتارِ محصول را ضعیف
 *  نمی‌کند**: ادعا همان است (بنر باید حقیقتِ سرور را بگوید)، فقط پیش‌شرطِ
 *  «مرورگر اجازه داده» روی هر سه پروفایل یکسان برقرار می‌شود. حالتِ واقعیِ
 *  «مرورگر پشتیبانی نمی‌کند» تستِ جداگانه‌ی خودش را دارد. */
async function stubGrantedNotification(page: Page) {
  await page.addInitScript(() => {
    const N = function () { /* noop */ } as unknown as typeof Notification;
    Object.defineProperty(N, 'permission', { get: () => 'granted', configurable: true });
    Object.defineProperty(N, 'requestPermission', {
      value: () => Promise.resolve('granted'), configurable: true, writable: true,
    });
    Object.defineProperty(window, 'Notification', { value: N, configurable: true, writable: true });
  });
}

test.describe('IS-1 — مرکزِ اعلان رزروِ ناموجود اختراع نمی‌کند (§۱۰)', () => {
  test('مهمانِ واردنشده: نه بِجِ اعلان، نه «یادآورِ رزرو»', async ({ page }) => {
    await mockApi(page);            // loggedIn=false → GET /me = 401
    await gotoApp(page);

    // بوت ۶۰۰ms بعد refreshNotif را صدا می‌زند؛ کمی بیشتر صبر می‌کنیم.
    await page.waitForTimeout(1200);

    await page.evaluate(() => (window as unknown as { openNotif?: () => void }).openNotif?.());
    const panel = page.locator('#notif');
    await expect(panel).toHaveClass(/show/);

    // ادعایِ دقیق: هیچ اعلانِ «رزرو»ی ساخته نمی‌شود و کدِ seed دیده نمی‌شود.
    // (اعلانِ «پیشنهادِ هوشمند» مجاز است — از رستورانِ **واقعیِ سرور** ساخته
    // می‌شود، نه از دادهٔ نمونه؛ تستِ جدا در همین فایل آن را هم می‌بندد.)
    const list = page.locator('#notifList');
    await expect(list).not.toContainText('یادآورِ رزرو');
    await expect(list).not.toContainText('RZ8K2M');
    await expect(page.locator('#notifList .notif-item')).toHaveCount(1);

    // فیلترِ دسته‌ی «رزرو» باید کاملاً خالی باشد.
    await page.locator('.notif-tab[data-k="reservation"]').click();
    await expect(page.locator('#notifList .notif-empty')).toBeVisible();
  });

  test('مهمانِ آفلاین (بک‌اند در دسترس نیست): هیچ اعلانی از دادهٔ نمونه ساخته نمی‌شود', async ({ page }) => {
    // شبکه کاملاً قطع → R به R_SAMPLE برمی‌گردد و /me/reservations شکست می‌خورد.
    await page.route('**/api/v1/**', (route) => route.abort('failed'));
    await gotoApp(page);
    await page.waitForTimeout(1200);

    await page.evaluate(() => (window as unknown as { openNotif?: () => void }).openNotif?.());
    await expect(page.locator('#notif')).toHaveClass(/show/);
    // نه یادآورِ رزروِ ساختگی، نه «پیشنهادِ هوشمند» رویِ رستورانِ نمونه.
    await expect(page.locator('#notifList .notif-empty')).toBeVisible();
    const badge = page.locator('#notifBadge');
    if (await badge.count()) await expect(badge).toBeHidden();
  });

  test('کاربرِ واردشده با رزروِ واقعیِ سرور: همان رزرو نشان داده می‌شود', async ({ page }) => {
    await mockApi(page, { loggedIn: true });
    // پاسخِ /me/reservations را با یک رزروِ واقعی override می‌کنیم.
    await page.route('**/api/v1/me/reservations', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          code: 'RZREAL1', status: 'confirmed', restaurant_id: 1,
          restaurant_name: '[DEMO] کافه گل‌ها',
          slot_start: '2030-01-01T19:00:00.000Z', party_size: 2,
        }]),
      }));
    await gotoApp(page);
    await login(page);
    await page.waitForTimeout(1200);

    await page.evaluate(() => (window as unknown as { openNotif?: () => void }).openNotif?.());
    await expect(page.locator('#notif')).toHaveClass(/show/);
    // قابلیت نشکسته: رزروِ **واقعی** همچنان یادآور می‌سازد.
    await expect(page.locator('#notifList')).toContainText('یادآورِ رزرو');
    // …و هیچ‌وقت رزروِ seed نمی‌آید.
    await expect(page.locator('#notifList')).not.toContainText('RZ8K2M');
  });
});

test.describe('F4 — بنرِ اعلان حقیقتِ سرور را می‌گوید (§۳)', () => {
  test('permission=granted ولی سرور ready:false → ادعایِ «فعال است» نمی‌شود', async ({ page }) => {
    await stubGrantedNotification(page);
    await mockApi(page, { loggedIn: true });
    await page.route('**/api/v1/me/push-subscribe', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ enabled: false, ready: false }) }));
    await gotoApp(page);
    await login(page);

    await page.evaluate(() => (window as unknown as { openNotifPrefs?: () => void }).openNotifPrefs?.());
    const banner = page.locator('#npPerm');
    await expect(banner).toBeVisible();
    // پس از رسیدنِ پاسخِ سرور باید به حالتِ هشدار برود…
    await expect(banner).toHaveClass(/warn/, { timeout: 5000 });
    // …و ادعایِ «اعلان‌ها روی این دستگاه فعاله» **نباید** دیده شود.
    await expect(banner).not.toContainText('اعلان‌ها روی این دستگاه فعاله');
    await expect(banner).toContainText('راه‌اندازی نشده');
  });

  test('وقتی سرور ready:true بدهد، تیکِ سبز برمی‌گردد (بیش‌ازحد سخت‌گیر نیست)', async ({ page }) => {
    await stubGrantedNotification(page);
    await mockApi(page, { loggedIn: true });
    await page.route('**/api/v1/me/push-subscribe', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ enabled: true, ready: true }) }));
    await gotoApp(page);
    await login(page);

    await page.evaluate(() => (window as unknown as { openNotifPrefs?: () => void }).openNotifPrefs?.());
    const banner = page.locator('#npPerm');
    await expect(banner).toHaveClass(/ok/, { timeout: 5000 });
    await expect(banner).toContainText('اعلان‌ها روی این دستگاه فعاله');
  });

  test('مرورگرِ بدونِ Notification (Safariِ iOS): دکمه‌ی «فعال‌سازی»ِ بن‌بست نشان داده نمی‌شود (§۲۷)', async ({ page }) => {
    // Notification را عمداً حذف می‌کنیم تا رفتارِ واقعیِ iOS روی هر سه موتور تست شود.
    // باید `'Notification' in window` واقعاً false شود — تعریفِ آن با
    // value:undefined کافی نیست (خاصیت همچنان «هست» و اپ شاخه‌ی اشتباه را
    // می‌گیرد). پس صرفاً حذفش می‌کنیم؛ در WebKit از اول وجود ندارد.
    await page.addInitScript(() => {
      try { delete (window as unknown as Record<string, unknown>).Notification; } catch { /* noop */ }
    });
    await mockApi(page, { loggedIn: true });
    await gotoApp(page);
    await login(page);

    await page.evaluate(() => (window as unknown as { openNotifPrefs?: () => void }).openNotifPrefs?.());
    const sheet = page.locator('#sheetBody');
    await expect(sheet).toContainText('پشتیبانی نمی‌کند');
    // دکمه‌ای که تنها کارش توستِ «پشتیبانی نمی‌شود» است نباید وجود داشته باشد.
    await expect(sheet.locator('.np-perm-btn')).toHaveCount(0);
  });
});

test.describe('F6 — صفحه‌بندیِ رستوران‌ها قابلِ دسترس است (§۸)', () => {
  test('با next_cursor دکمه‌ی «بیشتر» می‌آید و صفحه‌ی بعد را واقعاً می‌گیرد', async ({ page }) => {
    await mockApi(page);
    // ⚠️ ترتیب مهم است: در Playwright routeِ **دیرتر ثبت‌شده** اولویت دارد، پس این
    // override باید بعد از mockApi بیاید وگرنه هندلرِ عمومیِ آن برنده می‌شود.
    await page.route('**/api/v1/restaurants*', (route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get('cursor');
      if (cursor === 'CUR2') {
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ items: [
            { id: 9, slug: 'demo-page2', name: '[DEMO] رستورانِ صفحه‌ی دو', cuisine: 'ایتالیایی',
              rating: 4.4, price: '$$', cashback: 5, cover_emoji: '🍕' },
          ], next_cursor: null }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ items: [
          { id: 1, slug: 'demo-page1', name: '[DEMO] رستورانِ صفحه‌ی یک', cuisine: 'ایرانی',
            rating: 4.7, price: '$$', cashback: 10, cover_emoji: '🌸' },
        ], next_cursor: 'CUR2' }) });
    });
    await gotoApp(page);

    const more = page.locator('#feedMore');
    await expect(more).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#feed')).not.toContainText('صفحه‌ی دو');

    await more.click();
    // ردیفِ صفحه‌ی دوم واقعاً به فید اضافه می‌شود…
    await expect(page.locator('#feed')).toContainText('صفحه‌ی دو', { timeout: 8000 });
    await expect(page.locator('#feed')).toContainText('صفحه‌ی یک');
    // …و چون سرور cursor بعدی نداد، دکمه دیگر نمی‌ماند (دکمه‌ی بی‌اثر نداریم).
    await expect(page.locator('#feedMore')).toHaveCount(0);
  });

  test('بدونِ next_cursor هیچ دکمه‌ی «بیشتر»ی ساخته نمی‌شود', async ({ page }) => {
    await mockApi(page);        // next_cursor: null
    await gotoApp(page);
    await expect(page.locator('.rc .rc-open').first()).toBeVisible();
    await expect(page.locator('#feedMore')).toHaveCount(0);
  });
});

test.describe('RC-6 — بوتِ سرد `GET /events` را دوبار نمی‌فرستد (§۲۶)', () => {
  test('یک درخواستِ /events در هر لودِ سرد', async ({ page }) => {
    const hits = countRequests(page, /\/api\/v1\/events(\?|$)/);
    await mockApi(page);
    await gotoApp(page);
    // syncRestaurants و رندرِ دومِ بخش‌ها باید تمام شده باشند.
    await expect(page.locator('.rc .rc-open').first()).toBeVisible();
    await page.waitForTimeout(1500);
    expect(hits.length, `انتظار ۱ درخواست، دیده شد ${hits.length}`).toBe(1);
  });
});

test.describe('IS-3 — pull-to-refresh واقعاً از سرور می‌خواند (§۱۰/§۲۷)', () => {
  test('ژستِ تازه‌سازی یک `GET /restaurants` تازه می‌فرستد', async ({ page }) => {
    const hits = countRequests(page, /\/api\/v1\/restaurants(\?|$)/);
    await mockApi(page);
    await gotoApp(page);
    await expect(page.locator('.rc .rc-open').first()).toBeVisible();
    await page.waitForTimeout(600);
    const before = hits.length;

    // ژستِ واقعیِ pull-to-refresh را با رویدادهای لمسی اجرا می‌کنیم — همان
    // مسیری که کاربر طی می‌کند (touchstart در بالای صفحه → touchmove > ۶۴px →
    // touchend). هیچ میان‌بُری به توابعِ داخلی زده نمی‌شود.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      // ⚠️ WebKit `new Touch()`/`new TouchEvent()` را «Illegal constructor»
      // می‌داند (فقط مسیرِ قدیمیِ document.createTouch را دارد)، Chromium فقط
      // مسیرِ مدرن را. برایِ اینکه **همین ژست** روی هر سه پروفایلِ CI اجرا شود،
      // اول مدرن، بعد قدیمی. هیچ assertionی اینجا ضعیف نمی‌شود.
      type LegacyDoc = Document & {
        createTouch?: (v: Window, t: EventTarget, id: number, px: number, py: number, sx: number, sy: number) => Touch;
      };
      const d = document as LegacyDoc;
      const touchAt = (y: number): Touch => {
        try {
          return new Touch({ identifier: 1, target: document.body, clientX: 10, clientY: y });
        } catch {
          return d.createTouch!(window, document.body, 1, 10, y, 10, y);
        }
      };
      const fire = (type: string, y: number) => {
        const list = type === 'touchend' ? [] : [touchAt(y)];
        let e: Event;
        try {
          e = new TouchEvent(type, {
            bubbles: true, cancelable: true,
            touches: list, targetTouches: list, changedTouches: [touchAt(y)],
          });
        } catch {
          // مسیرِ WebKit: رویداد را با createEvent می‌سازیم و لیستِ لمس را
          // مستقیم روی آن می‌نشانیم (initTouchEvent امضایِ ناسازگار دارد).
          e = document.createEvent('Event');
          e.initEvent(type, true, true);
          Object.defineProperty(e, 'touches', { value: list });
          Object.defineProperty(e, 'targetTouches', { value: list });
          Object.defineProperty(e, 'changedTouches', { value: [touchAt(y)] });
        }
        document.dispatchEvent(e);
      };
      fire('touchstart', 10);
      fire('touchmove', 260);
      fire('touchend', 260);
    });

    // ادعا: ژست یک درخواستِ **واقعی** می‌فرستد (قبلاً صفر بود).
    await expect.poll(() => hits.length, { timeout: 8000 }).toBeGreaterThan(before);
  });
});

test.describe('LR-02 — کدِ جایزه‌ی خریداری‌شده به کاربر داده می‌شود (§۱۶)', () => {
  test('خریدِ کارتِ هدیه با سکه، کد را نشان می‌دهد نه فقط «خریداری شد»', async ({ page }) => {
    await mockApi(page, { loggedIn: true });
    await page.route('**/api/v1/me/rewards/*/redeem', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({
          redemption_id: 'r1', coins_spent: 100, kind: 'gift_card_credit',
          result_gift_card_id: 'gc-1', result_gift_card_code: 'RWDGCTEST42',
          result_coupon_id: null, result_coupon_code: null,
        }) }));
    await gotoApp(page);
    await login(page);

    await page.evaluate(() =>
      (window as unknown as { redeemReward?: (id: string) => Promise<void> }).redeemReward?.('item-1'));

    // کد باید در شیت دیده شود — قبلاً کاملاً دور ریخته می‌شد.
    await expect(page.locator('#sheetBody')).toContainText('RWDGCTEST42', { timeout: 5000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  موجِ دوم (۲۰۲۶-۰۸-۲۴) — همان کلاسِ IS-1 در سه جایِ دیگر که «low» طبقه‌بندی
//  شده بودند ولی در واقع همان جعلِ رزرو بودند، فقط آشکارتر.
// ═══════════════════════════════════════════════════════════════════════

test.describe('تبِ سفرها رزروِ ناموجود نمی‌سازد (§۱۰)', () => {
  test('مهمانِ واردنشده: حالتِ خالیِ صادق، نه سه رزروِ seed', async ({ page }) => {
    await mockApi(page);                 // loggedIn=false
    await gotoApp(page);
    await page.evaluate(() => (window as unknown as { go: (p: string) => void }).go('trips'));

    const list = page.locator('#tripsList');
    await expect(list).toContainText('هنوز رزروی نداری');
    // کدهایِ seed نباید هیچ‌جا دیده شوند…
    await expect(list).not.toContainText('RZ8K2M');
    await expect(list).not.toContainText('RZ4A1C');
    // …و هیچ دکمه‌ی «لغو»ی برایِ رزروی که وجود ندارد رندر نشود.
    await expect(list.getByRole('button', { name: 'لغو', exact: true })).toHaveCount(0);
  });

  test('کاربرِ واردشده: رزروِ واقعیِ سرور رندر می‌شود (قابلیت نشکسته)', async ({ page }) => {
    await mockApi(page, { loggedIn: true });
    await page.route('**/api/v1/me/reservations*', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{
          code: 'RZREAL9', status: 'confirmed', partySize: 2,
          slotStart: new Date(Date.now() + 86_400_000).toISOString(),
          restaurantId: 1, restaurant: { name: '[DEMO] کافه گل‌ها', slug: 'demo-cafe-golha' },
        }]),
      }));
    await gotoApp(page);
    await login(page);
    await page.evaluate(() => (window as unknown as { go: (p: string) => void }).go('trips'));

    await expect(page.locator('#tripsList')).toContainText('RZREAL9', { timeout: 8000 });
    await expect(page.locator('#tripsList')).not.toContainText('RZ8K2M');
  });
});

test.describe('کارتِ پروفایل عددِ رزروِ ساختگی نشان نمی‌دهد (§۱۰)', () => {
  test('کاربرِ بدونِ رزرو «۰» می‌بیند، نه «۳»ِ ثابتِ دادهٔ seed', async ({ page }) => {
    await mockApi(page, { loggedIn: true });   // /me/reservations = []
    await gotoApp(page);
    await login(page);
    await page.evaluate(() => (window as unknown as { go: (p: string) => void }).go('profile'));

    const stat = page.locator('#pcTrips');
    await expect(stat).toBeVisible();
    // قبلاً همیشه «۳» بود — چه کاربر رزرو داشت چه نداشت.
    await expect(stat).not.toHaveText('۳', { timeout: 8000 });
    await expect(stat).toHaveText('۰', { timeout: 8000 });
  });

  test('مهمانِ واردنشده «—» می‌بیند (چیزی ادعا نمی‌شود)', async ({ page }) => {
    await mockApi(page);
    await gotoApp(page);
    await page.evaluate(() => (window as unknown as { go: (p: string) => void }).go('profile'));
    const stat = page.locator('#pcTrips');
    if (await stat.count()) await expect(stat).toHaveText('—');
  });
});

test.describe('پالتِ فرمان رزروِ seed را پیشنهاد نمی‌دهد (§۱۰)', () => {
  test('جست‌وجویِ کدِ seed هیچ رزروی برنمی‌گرداند', async ({ page }) => {
    await mockApi(page);
    await gotoApp(page);
    await page.evaluate(() => (window as unknown as { openPalette?: () => void }).openPalette?.());
    const input = page.locator('#cmdkInput');
    await expect(input).toBeVisible();
    await input.fill('RZ8K2M');
    await expect(page.locator('#cmdkList')).not.toContainText('رزرو RZ8K2M');
  });
});

test.describe('تایمرِ آفرِ لیستِ انتظار مهلتِ سرور را نشان می‌دهد (§۱۰)', () => {
  test('آفری که ۲ دقیقه مانده، ۰۲:xx نشان می‌دهد نه ۰۵:۰۰', async ({ page }) => {
    test.slow();
    // جریانِ واقعی: رزرو با SLOT_FULL رد می‌شود → پیشنهادِ لیستِ انتظار →
    // پیوستن → سرور بلافاصله وضعیتِ «offered» با مهلتِ مشخص می‌دهد.
    await mockApi(page, { reserveFull: true });
    const expires = new Date(Date.now() + 125_000).toISOString();   // ۲:۰۵ مانده
    await page.route('**/api/v1/waitlist**', (route) => {
      const m = route.request().method();
      const u = new URL(route.request().url()).pathname;
      const body = {
        id: 'wl-demo-1', position: 1, estimated_wait_minutes: 0, is_vip: false,
        status: 'offered', offer_expires_at: expires, offered_table: 'T3',
      };
      if (m === 'POST' && u.endsWith('/waitlist')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (m === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      return route.fallback();
    });

    await gotoApp(page);
    await login(page);
    await openFirstRestaurant(page);
    await page.getByRole('button', { name: /رزرو میز/ }).click();
    await expect(page.locator('#sheet')).toBeVisible();
    await page.waitForFunction(() => {
      const s = document.getElementById('bwTime') as HTMLSelectElement | null;
      return !!s && [...s.options].some((o) => o.value && o.value !== '');
    }, undefined, { timeout: 8000 });
    await page.getByRole('button', { name: /بررسی میزهای موجود/ }).click();
    await page.getByRole('button', { name: 'ادامه', exact: true }).click();
    await page.getByRole('button', { name: /تأیید رزرو|تایید رزرو/ }).click();
    await expect(page.locator('#sheetBody')).toContainText(/لیست انتظار|ظرفیت.*پر/, { timeout: 10000 });
    await page.getByRole('button', { name: /لیست انتظار|بپیوند/ }).first().click();

    const timer = page.locator('#wlTimer');
    await expect(timer).toBeVisible({ timeout: 10000 });
    // ⚠️ ادعا: مقدار از مهلتِ **سرور** می‌آید. قبلاً همیشه از ۰۵:۰۰ شروع
    // می‌کرد صرف‌نظر از اینکه چقدر از آفر گذشته بود — کاربر خیالش راحت
    // می‌شد و بعد accept با «منقضی شده» رد می‌شد و میزش را از دست می‌داد.
    await expect(timer).not.toHaveText('۰۵:۰۰');
    await expect(timer).toHaveText(/^۰[۰-۲]:/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  ترجیحاتِ اعلان حالا واقعاً پایدار می‌شوند (پروتکل §۱۳ «communication
//  preferences» و §۱۷ «consent»)
//
//  ⚠️ قبلاً `setNotifPref` **فقط** در localStorage می‌نوشت و سمتِ سرور هیچ
//  مفهومی از رضایت وجود نداشت — یعنی کاربری که «تخفیف و کش‌بک ویژه» را خاموش
//  می‌کرد همچنان پیامکِ کمپین می‌گرفت و انتخابش با پاک‌شدنِ حافظه‌ی مرورگر
//  از بین می‌رفت.
// ═══════════════════════════════════════════════════════════════════════
test.describe('ترجیحاتِ اعلان روی سرور ذخیره می‌شوند (§۱۳/§۱۷)', () => {
  test('خاموش‌کردنِ یک دسته یک PATCH واقعی می‌فرستد', async ({ page }) => {
    const sent: Array<Record<string, unknown>> = [];
    await mockApi(page, { loggedIn: true });
    await page.route('**/api/v1/me/notification-prefs', (route) => {
      const m = route.request().method();
      if (m === 'PATCH') sent.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ prefs: m === 'PATCH' ? { offers: false } : {} }),
      });
    });
    await gotoApp(page);
    await login(page);

    await page.evaluate(() => (window as unknown as { openNotifPrefs?: () => void }).openNotifPrefs?.());
    // ⚠️ خودِ input با CSS پنهان است (الگویِ استانداردِ toggle — چیزی که دیده
    // می‌شود `.np-slider` است). پس toBeVisible درست نیست؛ attached + force.
    const box = page.locator('.np-toggle input[data-cat="offers"]');
    await expect(box).toBeAttached();
    // input پنهان و بیرونِ ویوپورت است؛ همان رویدادی که کاربر با لمسِ اسلایدر
    // ایجاد می‌کند را مستقیم می‌زنیم (onchange → setNotifPref).
    await box.evaluate((el: HTMLInputElement) => {
      el.checked = false;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // ادعا: درخواستِ واقعی رفت (قبلاً صفر بود).
    await expect.poll(() => sent.length, { timeout: 8000 }).toBeGreaterThan(0);
    expect(sent[sent.length - 1]).toEqual({ offers: false });
  });

  test('حالتِ کلیدها از سرور می‌آید، نه از localStorageِ کهنه', async ({ page }) => {
    await mockApi(page, { loggedIn: true });
    // localStorage می‌گوید روشن، سرور می‌گوید خاموش → باید سرور برنده شود.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('rz_notif_prefs', JSON.stringify({
          availability: true, offers: true, reminder: true, loyalty: true, dna: true,
        }));
      } catch { /* noop */ }
    });
    await page.route('**/api/v1/me/notification-prefs', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ prefs: { offers: false } }),
      }));
    await gotoApp(page);
    await login(page);

    await page.evaluate(() => (window as unknown as { openNotifPrefs?: () => void }).openNotifPrefs?.());
    const box = page.locator('.np-toggle input[data-cat="offers"]');
    await expect(box).toBeAttached();
    await expect(box).not.toBeChecked({ timeout: 8000 });
    // دسته‌ای که سرور نظری درباره‌اش نداده باید روشن بماند (پیش‌فرضِ دریافت).
    await expect(page.locator('.np-toggle input[data-cat="reminder"]')).toBeChecked();
  });
});
