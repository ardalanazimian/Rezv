# BACKEND_INVENTORY — رزرونو

> موجودیِ کاملِ بک‌اند (`api/`). مبتنی بر استخراجِ واقعیِ فایل‌ها. تاریخ: ۲۰۲۶-۰۷-۳۰.

## Endpoints (۸۳ فایلِ route.ts)
- **auth (۶):** `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`, `/auth/staff/request`, `/auth/staff/verify`
- **customer/me (۹):** `GET/PATCH /me`, `GET /me/profile`, `/me/points`, `/me/reservations`, `GET/POST /me/referral`, `GET/POST /me/push-subscribe`, `GET /me/chats`, `GET/POST /me/chats/[id]`
- **reservations (۵):** `POST /reservations`, `GET /reservations/[code]`, `POST /reservations/[code]/{arrive,cancel,pay}`
- **restaurants public (۵):** `GET /restaurants`, `GET /restaurants/[slug]/availability`, `POST /restaurants/[slug]/chat`, `GET /restaurants/live-stats`, `GET /events`
- **restaurant panel (۳۳):** ai, analytics, automations, branches, campaigns, cashback, chats(+[id]), coupons, customers(+[userId]), events, fraud-signals, heartbeat, hours, members, notes, photos, pricing, reports, reservations(+[code]/events,status), reviews, rfm, sms, staff, tables(+[id],[id]/state), waitlist(+analytics), walkin
- **admin/company (۸):** business-intelligence, overview, restaurants(+[id]/control,[id]/sms), security, settings, system-health
- **waitlist (۴):** `POST /waitlist`, `GET/DELETE /waitlist/[id]`, `POST /waitlist/[id]/{accept,decline}`
- **maintenance/cron (۸):** jobs-drain, waitlist, expire, lifecycle, customer-insights, retention, rewards, ensure-partitions
- **misc:** `POST /checkin`, `GET /payments/callback`, `POST /telemetry`, `GET/POST /gift-cards`
- **ops:** `GET /api/health`, `GET /api/metrics`

## Middleware
`middleware.ts` — CORS allowlist، CSRF(Origin)، هدرهای امنیتی (CSP/HSTS/…)، rate-limit سراسری + fallback in-memory، IP-ban، trace-id.

## Services / Domain (`src/lib/*` — ۴۸ ماژول)
- **Auth/Authz:** jwt, permissions, admin-auth, maintenance-auth, with-restaurant-auth, staff-helpers, security, otp, audit
- **Reservation domain:** reservations, availability(+cache), reservation-helpers, reservation-status, reservation-lifecycle-ops, lifecycle, tables, hours
- **Waitlist:** waitlist
- **Customer/CRM:** guest-profile, rfm, customer-insights
- **Loyalty/Payment:** loyalty, coupons, pricing, subscription, zarinpal, gift (in loyalty), sms-balance
- **Marketing/Notification:** automation, notify, sms
- **AI/Fraud (heuristic):** customer-insights, fraud
- **Infra:** db (primary+replica), redis, cache, queue, worker, idempotency, events, metrics, logger, validate, schemas, errors, platform-settings, platform-events

## Repositories / Models / DTOs
- **Repository layer:** Prisma Client (`db`/`dbRead`) — بدونِ لایه‌ی repository جدا (الگوی active-record با Prisma).
- **Models:** ۳۸ مدلِ Prisma (`schema.prisma`) — به `docs/backend-audit/DATABASE_AUDIT.md`.
- **DTOs/Validation:** `schemas.ts` + `validate.ts` (z-shim) — اعتبارسنجیِ ورودی/خروجی.

## Queues / Workers / Cron / Events
- **Queue:** `lib/queue.ts` (Postgres + FOR UPDATE SKIP LOCKED). **Worker:** `lib/worker.ts`. **Drain:** `maintenance/jobs-drain` (cron هر دقیقه).
- **Cron (۹):** طبقِ `cron/crontab` — **تنها منبعِ حقیقتِ زمان‌بندی**، سرویسِ Compose در
  `docker-compose.yml:169` با `restart: unless-stopped`. jobها: `waitlist` (هر ۲د)،
  `jobs-drain` (هر ۱د)، `lifecycle` (هر ۵د)، `expire` (هر ۵د)، `reminders` (هر ۱۵د)،
  `rewards` (۹:۰۰)، `customer-insights` (۳:۰۰)، `retention` (۴:۰۰)، `ensure-partitions`
  (اولِ هر ماه).
  <!-- ⚠️ تصحیحِ ۲۰۲۶-۰۹-۰۹: این خط می‌گفت «**Cron (۸):** طبقِ `api/vercel.json`
       (Vercel Cron)». هر دو جزء غلط بودند — شمار (۸ در برابر ۹) و منبع.
       `api/vercel.json` در ۲۰۲۶-۰۸-۲۸ **عمداً حذف شد** چون بک‌اند روی Vercel
       مستقر نیست (`deploy/caddy/Caddyfile` دامنه‌ی api را به داکر پروکسی می‌کند).
       هزینه‌ی این کهنگی فرضی نیست: در همین روز نشستِ CEO دنبالِ `vercel.json`
       گشت، نیافت، و در `audit/ESCALATIONS.md` نوشت «هیچ زمان‌بندی‌ای در مخزن
       وجود ندارد» — یک ادعای غلط در سندی که مالک می‌خواند. -->
- **Events:** `lib/events.ts` (`emit`) + `platform-events.ts` (تله‌متری).
- **WebSockets:** یافت نشد (چت مبتنی بر polling/REST است، نه WS).

## Integrations
- **Payment:** Zarinpal (`zarinpal.ts` + `payments/callback`).
- **SMS:** Kavenegar (`sms.ts` + ۱۴ قالب).
- **Notification/Push:** `notify.ts`, `me/push-subscribe` (FCM طبقِ env).
- **Location:** سرویسِ اختصاصیِ Location یافت نشد (کشفِ «نزدیک تو» در فرانت heuristic/محلی است — به BROKEN_CONNECTIONS/FEATURE_COVERAGE).
