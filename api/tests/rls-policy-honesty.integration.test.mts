import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ صداقتِ RLS (P0-021 — دستورِ چهارمِ مالک، ۲۰۲۶-۰۹-۰۴)
//
//  چرا این گارد وجود دارد — یک fake-greenِ سطحِ سند و سطحِ DB:
//
//  روی این دیتابیس RLS روی ۶۱ جدول **فعال** است، ولی **صفر policy** وجود
//  دارد و بک‌اند با نقشِ owner وصل می‌شود (روی همین ماشین:
//  `rezervno super=true bypassrls=true`). یعنی RLS **هیچ** ایزولاسیونی
//  فراهم نمی‌کند: هیچ ردیفی را از هیچ‌کس پنهان نمی‌کند. مرزِ واقعیِ tenant
//  در لایه‌ی اپلیکیشن است (`ctx.restaurant.id` / `auth.tenantId`) و همان
//  است که ماتریسِ ایزولاسیونِ A5 می‌سنجد.
//
//  با این حال چند سند «RLS فعال است» را به‌عنوانِ یک کنترلِ امنیتیِ فعال
//  عرضه می‌کردند (از جمله یک ادعای صریحِ «immutability با RLSِ فقط-درج» در
//  INTELLIGENCE-PLATFORM-ARCHITECTURE.md که policyِ متناظرش اصلاً وجود
//  ندارد). این گارد جلوی برگشتنِ آن برداشت را می‌گیرد.
//
//  این گارد چه چیزی را قرمز می‌کند:
//   ۱. هر جدولِ **تازه**‌ای که RLS بگیرد ولی policy نداشته باشد و در
//      allowlist نباشد → قرمز. (اضافه‌شدن به allowlist یک **افشا**ست، نه
//      یک تأیید: یعنی «اینجا RLS محافظت نمی‌کند».)
//   ۲. هر ردیفِ **کهنه**‌ی allowlist: جدولی که حالا policyِ واقعی گرفته یا
//      RLSش خاموش شده → قرمز، تا فهرست با واقعیت جلو برود.
//   ۳. هر جدولی که policy دارد ولی `FORCE ROW LEVEL SECURITY` ندارد →
//      قرمز، چون نقشِ owner همان policy را دور می‌زند و دوباره همان
//      «سبزِ توخالی» ساخته می‌شود. (امروز صفر جدولِ policy‌دار داریم، پس
//      این بند تا اجرای تیکتِ post-launchِ P0-021 عملاً خالی است — عمداً
//      و با اعلام، نه به‌صورتِ درِ فرارِ خاموش.)
//
//  قاعده‌ی ۵ CLAUDE.md (تستی که با غیبتِ موضوعش سبز می‌ماند تست نیست):
//  اگر DB جدول نداشته باشد، یا هیچ جدولی RLS نداشته باشد (یعنی
//  `apply-sql.sh` اجرا نشده)، این تست **خطا** می‌دهد — سبز نمی‌ماند.
//
//  اثباتِ falsifiable بودن (اجراشده ۲۰۲۶-۰۹-۰۴، ثبت در
//  audit/round-19/rls-honesty-gate-proof.json): یک جدولِ اسکرچ با RLSِ
//  فعال و بدونِ policy ساخته شد → EXIT=1 · حذف شد → EXIT=0.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');

// افشا، نه تأیید: روی این جدول‌ها RLS فعال است و **هیچ policyی ندارند** —
// پس RLS هیچ ایزولاسیونی نمی‌دهد. حذفِ یک نام از این فهرست فقط وقتی درست
// است که آن جدول policyِ واقعی + FORCE گرفته باشد (تیکتِ post-launchِ
// P0-021)، نه برای ساکت‌کردنِ تست.
const RLS_ENABLED_WITHOUT_POLICY_ALLOWLIST: readonly string[] = [
  'audit_logs', 'badge_definitions', 'campaign_logs',
  'cancellation_policies', 'chat_messages', 'chat_threads',
  'club_code_counters', 'club_members', 'coupon_redemptions',
  'coupons', 'customer_economy_profiles', 'customer_insights',
  'economy_ledger_entries', 'gift_cards', 'guest_profiles',
  'idempotency_keys', 'jobs', 'marketing_automations',
  'menu_items', 'mission_progress', 'missions',
  'otp_codes', 'payments', 'phone_reliability_shadows',
  'platform_events', 'platform_settings', 'points_ledger',
  'referrals', 'reservation_events', 'reservation_items',
  'reservations', 'restaurant_assistant_logs', 'restaurant_assistant_vocab',
  'restaurant_closures', 'restaurant_demand_forecasts', 'restaurant_no_show_models',
  'restaurant_photos', 'restaurants', 'reviews',
  'reward_marketplace_items', 'reward_redemptions', 'site_articles',
  'site_banners', 'site_faqs', 'site_inquiries',
  'site_orders', 'site_pages', 'site_plans',
  'site_release_notes', 'site_testimonials', 'sms_transactions',
  'special_events', 'staff', 'staff_notes',
  'staff_permissions', 'tables', 'tenants',
  'user_badges', 'users', 'waitlist_entries',
  'webhooks',
];

// کفِ حضور: اگر تست به یک DBِ بیگانه/نیمه‌ساخته وصل شود، بندهای ۱ و ۲
// می‌توانند توخالی سبز بمانند. این کف جلویش را می‌گیرد.
const MIN_ALLOWLISTED_PRESENT = 55;

type RlsRow = {
  table_name: string;
  rls_enabled: boolean;
  rls_forced: boolean;
  policy_count: number;
};

describe('گاردِ صداقتِ RLS (P0-021)', () => {
  test('RLS بدونِ policy فقط در allowlist؛ allowlist کهنه نباشد؛ policy بدونِ FORCE ممنوع', async () => {
    const rows = await db.$queryRaw<RlsRow[]>`
      SELECT c.relname::text                AS table_name,
             c.relrowsecurity               AS rls_enabled,
             c.relforcerowsecurity          AS rls_forced,
             (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policy_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
       ORDER BY 1
    `;

    // ── قاعده‌ی ۵: نبودِ موضوع باید خطا باشد، نه عبور ────────────────────
    assert.ok(
      rows.length > 0,
      'هیچ جدولی در schemaِ public پیدا نشد — این تست به DBِ اشتباه وصل است یا DB ساخته نشده. ' +
        'سبزماندن در این حالت یعنی گارد توخالی است.',
    );

    const rlsOn = rows.filter((r) => r.rls_enabled);
    assert.ok(
      rlsOn.length > 0,
      `هیچ جدولی RLS فعال ندارد (${rows.length} جدول دیده شد) — یعنی prisma/apply-sql.sh روی این DB ` +
        'اجرا نشده. گاردِ RLS روی DBی که اصلاً RLS ندارد بی‌معنا است.',
    );

    const allow = new Set(RLS_ENABLED_WITHOUT_POLICY_ALLOWLIST);
    const byName = new Map(rows.map((r) => [r.table_name, r]));

    const presentAllowlisted = RLS_ENABLED_WITHOUT_POLICY_ALLOWLIST.filter((t) => byName.has(t));
    assert.ok(
      presentAllowlisted.length >= MIN_ALLOWLISTED_PRESENT,
      `فقط ${presentAllowlisted.length} جدول از ${RLS_ENABLED_WITHOUT_POLICY_ALLOWLIST.length} ردیفِ ` +
        `allowlist در این DB وجود دارد (کف: ${MIN_ALLOWLISTED_PRESENT}). یا DB ناقص است یا جدول‌ها ` +
        'حذف شده‌اند؛ در هر دو حالت بندهای بعدی توخالی می‌شوند.',
    );

    // ── بند ۱: RLSِ تازه‌ی بدونِ policy، خارج از allowlist ───────────────
    const undisclosed = rlsOn
      .filter((r) => r.policy_count === 0 && !allow.has(r.table_name))
      .map((r) => r.table_name);
    assert.deepEqual(
      undisclosed,
      [],
      'این جدول‌ها RLS فعال دارند ولی صفر policy — یعنی RLS رویشان هیچ ایزولاسیونی نمی‌دهد، ' +
        'در حالی که «RLS on» بودنشان خلافش را القا می‌کند: ' +
        `${undisclosed.join(', ')}. یا policyِ واقعی + FORCE ROW LEVEL SECURITY اضافه کن، ` +
        'یا نامشان را با همان توضیح به RLS_ENABLED_WITHOUT_POLICY_ALLOWLIST اضافه کن (افشا، نه تأیید).',
    );

    // ── بند ۲: ردیفِ کهنه‌ی allowlist ──────────────────────────────────
    const stale = presentAllowlisted
      .map((t) => byName.get(t)!)
      .filter((r) => !(r.rls_enabled && r.policy_count === 0))
      .map((r) => `${r.table_name}(rls=${r.rls_enabled},policies=${r.policy_count})`);
    assert.deepEqual(
      stale,
      [],
      'این ردیف‌های allowlist دیگر «RLS فعال و صفر policy» نیستند؛ فهرست باید با واقعیت جلو برود ' +
        `(و سندهای امنیتی هم به‌روز شوند): ${stale.join(', ')}`,
    );

    // ── بند ۳: policy بدونِ FORCE = دورزدنی توسطِ owner ─────────────────
    // امروز صفر جدولِ policy‌دار وجود دارد، پس این بند تا اجرای تیکتِ
    // post-launchِ P0-021 خالی است — با اعلام، نه بی‌صدا.
    const unforced = rows
      .filter((r) => r.policy_count > 0 && !r.rls_forced)
      .map((r) => r.table_name);
    assert.deepEqual(
      unforced,
      [],
      'این جدول‌ها policy دارند ولی FORCE ROW LEVEL SECURITY ندارند — نقشِ owner (که اپ با آن وصل ' +
        `می‌شود) policy را دور می‌زند و محافظت توهمی است: ${unforced.join(', ')}`,
    );
  });
});
