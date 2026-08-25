import { Page, Route } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
//  Mock کردنِ API — پاسخ‌های قطعی برای تستِ E2E بدونِ بک‌اندِ زنده
//
//  shapeها دقیقاً همان چیزی است که در ممیزیِ تطابق API تأیید شد:
//    • رزرو → { code, status, table_number, ... }   (code در سطحِ بالا)
//    • availability → { date, party, slots: [{time, status}] }
//    • waitlist → { id, position, estimated_wait_minutes, ... }
//
//  با این، تست‌ها در CI بدونِ دیتابیس/شبکه اجرا می‌شوند و قطعی‌اند.
//  برای تستِ یکپارچه با بک‌اندِ واقعی، این mock را اعمال نکن.
// ═══════════════════════════════════════════════════════════

export interface MockOptions {
  /** آیا اسلات‌ها پر باشند (برای تستِ مسیرِ لیست انتظار)؟ */
  slotsFull?: boolean;
  /** آیا ثبتِ رزرو با خطای SLOT_FULL رد شود (شبیه‌سازیِ پرشدنِ ظرفیت هنگامِ تأیید)؟
   *  اسلات‌ها باز می‌مانند تا کاربر بتواند زمان انتخاب کند و تا مرحله‌ی تأیید پیش برود. */
  reserveFull?: boolean;
  /** آیا کاربر از قبل وارد باشد؟ */
  loggedIn?: boolean;
}

// ⚠️ available_slots روی آیتمِ اول (Part 1 — صداقتِ سانس، ۲۰۲۶-۰۸-۱۴): بک‌اندِ
// واقعی هنوز این فیلد را برنمی‌گرداند (رجوع کن به توضیحِ apps/customer/js/api.js)،
// ولی وقتی اضافه شود همین شکل را خواهد داشت. بدونِ آن، mapApiRestaurant دیگر
// (به‌درستی) از دادهٔ نمونه‌یِ محلی برای پرکردنِ سانسِ کارت استفاده نمی‌کند
// (رفعِ باگِ صداقت) — پس کارتِ اول با CTAِ خالیِ «ببین سانس‌ها» رندر می‌شد،
// نه چیپِ ساعتِ واقعی؛ تستِ دسترس‌پذیریِ چیپِ ساعت را همین‌جا با یک مقدارِ
// واقع‌گرایانه (نه فیک) پوشش می‌دهیم.
// [merge ۰۸-۲۵] اجتماعِ دو خط: idهای UUID (تا mock همان شکلِ تولید باشد — یافته‌ی #67)
// + booking_policyِ خطِ ممیزی (تست‌های صداقتِ بیعانه/لغو رویِ رکوردهای ۱و۲ به آن تکیه دارند؛
// رستورانِ ۳ عمداً بدونِ policy می‌ماند تا حالتِ null هم پوشش داشته باشد).
// ⚠️ idها عمداً UUID هستند (ممیزیِ ۲۰۲۶-۰۸-۲۴): بک‌اندِ واقعی همیشه UUID
// برمی‌گرداند، ولی این mock تا امروز idِ عددیِ ۱..۳ می‌داد — به همین دلیل
// باگِ واقعیِ «UUIDِ بدونِ کوتیشن در onclick که همه‌ی CTAهای کارت را
// می‌شکست» هرگز در CI دیده نشد (کلاسیکِ «CI سبز، تولید خراب»). mock باید
// همان شکلی را تولید کند که تولید واقعاً می‌سازد.
export const DEMO_RESTAURANTS = [
  { id: 'a1b2c3d4-0000-4000-8000-000000000001', slug: 'demo-cafe-golha', name: '[DEMO] کافه گل‌ها', cuisine: 'ایرانی', rating: 4.7, price: '$$', cashback: 10, cover_emoji: '🌸', available_slots: ['19:00', '20:00'], booking_policy: { deposit_required: false, free_cancel_hours: 24, auto_confirm: true } },
  { id: 'a1b2c3d4-0000-4000-8000-000000000002', slug: 'demo-sushi-bar', name: '[DEMO] سوشی بار', cuisine: 'ژاپنی', rating: 4.5, price: '$$$', cashback: 8, cover_emoji: '🍣', booking_policy: { deposit_required: true, free_cancel_hours: 48, auto_confirm: false } },
  { id: 'a1b2c3d4-0000-4000-8000-000000000003', slug: 'demo-burger-lab', name: '[DEMO] برگر لب', cuisine: 'فست‌فود', rating: 4.6, price: '$$', cashback: 12, cover_emoji: '🍔' },
];

function openSlots() {
  return {
    date: '2026-07-10', party: 2,
    slots: [
      { time: '19:00', free_tables: ['T1', 'T2'], status: 'open' },
      { time: '20:00', free_tables: ['T3'], status: 'open' },
      { time: '21:00', free_tables: [], status: 'full' },
    ],
  };
}

function fullSlots() {
  return {
    date: '2026-07-10', party: 2,
    slots: [
      { time: '19:00', free_tables: [], status: 'full' },
      { time: '20:00', free_tables: [], status: 'full' },
      { time: '21:00', free_tables: [], status: 'full' },
    ],
  };
}

/** اعمالِ mock روی همه‌ی درخواست‌های /api/v1/* یک صفحه. */
export async function mockApi(page: Page, opts: MockOptions = {}) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/.*\/api\/v1/, '');
    const method = route.request().method();

    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    // ── لیستِ رستوران‌ها ──
    if (path === '/restaurants' && method === 'GET') {
      return json({ restaurants: DEMO_RESTAURANTS, next_cursor: null });
    }

    // ── availability ──
    if (/^\/restaurants\/[^/]+\/availability/.test(path) && method === 'GET') {
      return json(opts.slotsFull ? fullSlots() : openSlots());
    }

    // ── ساختِ رزرو (مسیرِ حیاتی) — code در سطحِ بالا (طبقِ قرارداد) ──
    if (path === '/reservations' && method === 'POST') {
      if (opts.reserveFull) {
        // ظرفیت هنگامِ تأیید پر شد → فرانت باید پیشنهادِ لیست انتظار بدهد
        return json({ error: { code: 'SLOT_FULL', message: 'ظرفیت این ساعت پر شد' } }, 409);
      }
      return json({
        code: 'RZDEMO12',
        status: 'confirmed',
        table_number: 'T1',
        merged_tables: [],
        slot_start: '2026-07-10T19:00:00',
        slot_end: '2026-07-10T20:30:00',
        hold_expires_at: null,
        club: null,
        checkout: null,
      }, 201);
    }

    // ── لیست انتظار ──
    if (path === '/waitlist' && method === 'POST') {
      return json({ id: 'wl-demo-1', position: 2, estimated_wait_minutes: 25, is_vip: false, status: 'waiting' });
    }
    if (/^\/waitlist\/[^/]+$/.test(path) && method === 'GET') {
      return json({ id: 'wl-demo-1', position: 1, estimated_wait_minutes: 12, is_vip: false, status: 'waiting' });
    }
    if (/^\/waitlist\/[^/]+\/(accept|decline)$/.test(path) && method === 'POST') {
      return json({ ok: true, reservation_code: 'RZWLDEMO' });
    }

    // ── احراز هویت (OTP) ──
    if (path === '/auth/otp/request' && method === 'POST') {
      return json({ ok: true, dev_code: '123456' });   // در dev کد را برمی‌گرداند
    }
    if (path === '/auth/otp/verify' && method === 'POST') {
      return json({
        access_token: 'demo-access-token',
        refresh_token: 'demo-refresh-token',
        user: { id: 'user-demo', phone: '+989123456789', first_name: 'کاربر', last_name: 'دمو' },
      });
    }

    // ── پروفایل / me ──
    if (path === '/me' && method === 'GET') {
      return opts.loggedIn
        ? json({ user: { id: 'user-demo', phone: '+989123456789', first_name: 'کاربر', last_name: 'دمو' } })
        : json({ error: 'unauthorized' }, 401);
    }
    if (path === '/me/points' && method === 'GET') return json({ balance: 340, history: [] });
    // ⚠️ شکلِ واقعیِ قرارداد: `/me/reservations` یک **آرایه‌ی خام** برمی‌گرداند
    // (`NextResponse.json(list)` در api/src/app/api/v1/me/reservations/route.ts)،
    // نه `{reservations:[…]}`. ماکِ اشتباه یک تستِ کاملِ «صداقتِ لغو» را بی‌صدا
    // بی‌اثر کرده بود: کلاینت `Array.isArray` را رد می‌کرد، به دادهٔ seed
    // برمی‌گشت، و تست ناخواسته رویِ رزروِ ساختگی اجرا می‌شد نه رزروِ تزریق‌شده.
    if (path === '/me/reservations' && method === 'GET') return json([]);
    if (path === '/me/profile' && method === 'GET') return json({ profile: {} });
    if (path === '/me/referral' && method === 'GET') return json({ code: 'REFDEMO', invited: 0 });
    if (path === '/events' && method === 'GET') return json({ events: [] });

    // پیش‌فرض: پاسخِ خالیِ موفق (تا تست به‌خاطرِ endpointِ فرعی نشکند)
    return json({ ok: true });
  });
}
