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

// ⚠️ به‌روزشده (۲۰۲۶-۰۸-۲۵): پیش از این، `available_slots` روی آیتمِ *اولِ*
// همین آرایه گذاشته می‌شد تا کارتِ اول چیپِ ساعت داشته باشد — با این توضیح که
// «بک‌اندِ واقعی هنوز این فیلد را برنمی‌گرداند، ولی وقتی اضافه شود همین شکل را
// خواهد داشت». آن پیش‌بینی درست از آب درنیامد و نگه‌داشتنش خطرناک بود:
// `GET /restaurants` این فیلد را **نمی‌دهد و نخواهد داد** (لیست ۶۰ ثانیه کش
// می‌شود و به تاریخ/تعدادِ نفر وابسته نیست). سانس‌ها حالا از روتِ گروهیِ
// `GET /restaurants/availability` می‌آیند که پایین mock شده است.
//
// چرا این اصلاح مهم است: mockی که فیلدی را می‌سازد که تولید نمی‌سازد، دقیقاً
// همان «CI سبز، تولید خراب» است که کامنتِ زیر درباره‌ی idهای عددی هشدار
// می‌دهد. حالا تست‌ها همان مسیری را می‌پیمایند که کاربرِ واقعی می‌پیماید:
// لیست بدونِ سانس → واکشیِ گروهی → نشستنِ چیپ‌ها.
//
// ⚠️ idها عمداً UUID هستند (ممیزیِ ۲۰۲۶-۰۸-۲۴): بک‌اندِ واقعی همیشه UUID
// برمی‌گرداند، ولی این mock تا آن روز idِ عددیِ ۱..۳ می‌داد — به همین دلیل
// باگِ واقعیِ «UUIDِ بدونِ کوتیشن در onclick که همه‌ی CTAهای کارت را
// می‌شکست» هرگز در CI دیده نشد. mock باید همان شکلی را تولید کند که تولید
// واقعاً می‌سازد.
export const DEMO_RESTAURANTS = [
  { id: 'a1b2c3d4-0000-4000-8000-000000000001', slug: 'demo-cafe-golha', name: '[DEMO] کافه گل‌ها', cuisine: 'ایرانی', rating: 4.7, price: '$$', cashback: 10, cover_emoji: '🌸' },
  { id: 'a1b2c3d4-0000-4000-8000-000000000002', slug: 'demo-sushi-bar', name: '[DEMO] سوشی بار', cuisine: 'ژاپنی', rating: 4.5, price: '$$$', cashback: 8, cover_emoji: '🍣' },
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

    // ── availabilityِ گروهی (چیپِ ساعتِ کارت‌ها) ──
    // باید *پیش از* الگویِ تکی چک شود: `/restaurants/availability` با
    // `/restaurants/{slug}/availability` هم‌شکل نیست، ولی ترتیب را صریح
    // نگه می‌داریم تا اضافه‌شدنِ الگویِ بازتری در آینده این را ندزدد.
    if (path === '/restaurants/availability' && method === 'GET') {
      const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
      const open = opts.slotsFull ? [] : ['19:00', '20:00'];
      const restaurants: Record<string, { available_slots: string[]; has_schedule: boolean }> = {};
      // فقط رستورانِ اول سانس می‌گیرد — تا تستِ «کارتِ بدونِ سانس به CTAِ آرام
      // می‌افتد» هم پوشش واقعی داشته باشد، نه فرض.
      for (const id of ids) {
        restaurants[id] = id === DEMO_RESTAURANTS[0].id
          ? { available_slots: open, has_schedule: true }
          : { available_slots: [], has_schedule: !opts.slotsFull };
      }
      return json({
        date: url.searchParams.get('date'),
        party: Number(url.searchParams.get('party') || 2),
        restaurants,
        requested: ids.length,
        max_per_request: 24,
      });
    }

    // ── availabilityِ یک رستوران (شیتِ رزرو) ──
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
    if (path === '/me/reservations' && method === 'GET') return json({ reservations: [] });
    if (path === '/me/profile' && method === 'GET') return json({ profile: {} });
    if (path === '/me/referral' && method === 'GET') return json({ code: 'REFDEMO', invited: 0 });
    if (path === '/events' && method === 'GET') return json({ events: [] });

    // پیش‌فرض: پاسخِ خالیِ موفق (تا تست به‌خاطرِ endpointِ فرعی نشکند)
    return json({ ok: true });
  });
}
