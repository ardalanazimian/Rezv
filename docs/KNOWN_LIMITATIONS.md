# KNOWN_LIMITATIONS.md — RezervoNo

> Honest inventory of technical debt, known issues, and scalability concerns
> derived from the code and merge history. Items marked **(uncertain)** need
> confirmation against the running environment.

---

## 1. Deployment / Build

- **Front-end Vercel wiring is not in the repo.** After the design-system
  refactor, `apps/*` use absolute asset paths and there is no root `vercel.json`
  wiring the three front-ends. Each app must be configured as its own Vercel
  project with its own **Root Directory** (`apps/customer`, `apps/business`,
  `apps/company`). This is a dashboard task, not code. **(follow-up)**
- **`prisma migrate deploy` P3015 — resolved.** The hand-written SQL scripts used
  to live under `prisma/migrations/manual/`, a folder inside `migrations/` with
  no `migration.sql`, so `migrate deploy` failed with **P3015** — which also
  meant `docker-entrypoint.sh` (it runs `migrate deploy` with `exit 1` on
  failure) never booted the container. They were moved to `prisma/sql/` (outside
  `migrations/`) and are now applied by `prisma/apply-sql.sh` (`prisma db
  execute`, no `psql`). The entrypoint runs `migrate deploy` (baselining a
  pre-existing DB via `migrate resolve --applied 0_init`) then `apply-sql.sh`;
  CI uses the same script.
- **Manual migrations are forward-only** and must be committed the instant they
  are applied (past DB↔schema drift required the `022` reconciliation).

## 2. Frontend

- **Customer app invented three events for every real user (fixed 2026-08-19,
  PR #30).** `renderEvents()` in `apps/customer/js/data/discover.js` fell back to
  `SAMPLE_EVENTS` whenever the server's list came back empty. `special_events` is
  empty in *every* fresh deployment — verified on this database, where
  `GET /api/v1/events` returns exactly `{"events":[]}` — so in practice the
  fallback was the *normal* path, not the exceptional one: essentially all real
  users saw three invented events ("شب موسیقی جاز زنده", "شب طعم و شراب‌نمایی",
  "میز سرآشپز") attributed by name to listed restaurants, with specific dates and
  prices. A "نمونه" chip was shown, so it was not an outright lie, but it
  contradicts the project's own rule — `e2e/tests/social-proof.spec.ts` locks
  "no claim without real data". Now three cases are distinguished, matching the
  discipline `booking.js` already had: server answered with an empty list → honest
  empty state; server unreachable (`res.offline`) → samples with the "نمونه" chip;
  real server error → the error plus its status code, not samples hiding it.
  Locked by a new test in `social-proof.spec.ts`, proven by mutation test.
- **Chat page told logged-out users "اتصال برقرار نشد" (fixed 2026-08-19,
  PR #30).** `apps/customer/js/features/chat.js` treated every non-`ok` response
  identically, so a **401** rendered as a connection error — sending the user to
  debug their internet when they simply needed to log in. Every other gated page
  (`loyalty`/`economy`/`food-dna`) already said "هنوز وارد نشدی" correctly. Chat
  now follows the same contract: logged out → login invitation with no pointless
  request; `offline` → connection message; `401` → "نشستت منقضی شده"; anything
  else → the error with its status code.
- **Company panel platform metrics were silently all-zero (fixed 2026-08-19).**
  Migration 046 made `customer_insights` money columns nullable, but the
  cross-restaurant rollup (`lib/guest-profile.ts`) still wrote into
  `guest_profiles`, whose money columns were `NOT NULL DEFAULT 0`. SQL `sum()`
  returns NULL when every row in a group is NULL, so **one** guest whose only
  restaurant has no priced menu made the whole `INSERT ... SELECT` fail — and
  because it is a single statement, *no* profiles were written at all
  (observed: 39 users in `customer_insights`, 0 rows in `guest_profiles`).
  The company panel reads all its platform-wide figures from that table, so it
  displayed 0 guests / 0 VIPs / 0 CLV — a total failure wearing the costume of
  real "zero" data. Compounding it, the nightly job wrapped the call in
  `.catch(() => ({ profiles: 0 }))` and still returned `ok: true`, so the
  failure never surfaced. Fixed by migration 051 (money columns nullable,
  matching `customer_insights`), removing the swallowing catch (the job now
  reports `ok:false` + `guest_profiles_error`), and dropping `COALESCE(...,0)`
  from the platform aggregate so "unmeasurable" stays `null` instead of being
  reported as a zero value. Locked by
  `tests/guest-profile-rollup.integration.test.mts`.
- **Fonts: Vazirmatn is self-hosted (fixed 2026-08-19).** Previously all three
  panels loaded the font *only* from `fonts.googleapis.com`, with no local copy
  anywhere in the repo. Google Fonts is commonly unreachable in Iran — the
  product's actual market — so for a large share of real users the font request
  failed and the Persian UI silently fell back to a system sans-serif with wrong
  metrics and shaping. This was never a caught failure: nothing errors, the page
  just renders in the wrong typeface.
  Now `shared/fonts/vazirmatn-var.woff2` (112KB variable, weights 100–900) is
  distributed to each app by `tools/sync-design-system.sh`, declared via
  `@font-face` in `shared/css/tokens.css`, and `<link rel="preload">` in each
  panel. Verified in a real browser with **all** non-localhost requests blocked:
  0 external requests, `document.fonts.check('700 16px Vazirmatn') === true` in
  customer/business/company. The `standalone/*.html` bundles embed the font as a
  base64 `data:` URI, so they are now genuinely offline (they previously still
  needed the network for the font, despite being the "offline" artifact).
- **Design system: single-source with a sync script (drift eliminated for `apps/*`).**
  `shared/` is the canonical source; `tools/sync-design-system.sh` copies the shared
  base (`tokens.css`, `foundation.css`, `ds-bridge.css`, `icons.js`) into each app,
  and a CI job (`design-system`) fails on any drift. No bundler/build step is
  introduced (each app is still a standalone static site). Per-app **intentional**
  deltas stay app-owned: `apps/*/css/theme.css` (the app's theme, loaded right after
  `tokens.css`) and the ESM-vs-global form of `icons.js` (customer imports it as a
  module; the panels load it via a classic `<script>`, so the sync strips `export`).
  **(still open)** `demo-mvp/*` and `standalone/*` are not yet covered by the sync.
- **`standalone/` and `demo-mvp/` are generated/duplicate frontends.** They can
  fall out of sync with `apps/*`. `standalone/` should be regenerated via
  `tools/build-standalone.py` after front-end changes. **(the standalone bundle
  works because module state is merged into one scope; the ES-module apps use
  setter functions instead — keep both patterns consistent.)**
- **No client-side test coverage beyond E2E.** Only Playwright E2E covers the
  customer app; business/company panels have **no automated tests**. **(uncertain)**
- **`apps/business/src-v2/*.jsx`** (a React dashboard) appears to be a
  preview/experiment not wired into the shipping vanilla-JS panel. Clarify its
  status or remove to avoid confusion. **(uncertain)**
- **Service-worker cache discipline is manual.** Forgetting to bump
  `CACHE_VERSION` ships stale assets to returning users.
- **Customer "Desire" design audit — real bugs fixed, scope deliberately narrowed
  (۲۰۲۶-۰۸-۱۴).** A design mission asked for an Apple/TikTok/Instagram-grade visual
  overhaul of the customer app. The existing foundation (dark-first theme, glass
  material, mesh gradients, spring easing, an already-photo-first `.rc` desire
  card with scrim/heart-corner/social-proof/slot-preview) was already much closer
  to that target than a ground-up rebuild would assume, so the actual diff is
  targeted fixes + additive tokens, not a rewrite:
  - **Real bug, shared across all three apps:** `shared/css/tokens.css`'s `:root`
    closed early — elevation/shadow, grid, breakpoint, and z-index tokens sat
    *outside* any selector and were silently inert (`.modal`/`.sheet`/
    `.switch-thumb` shadows, every `z-index: var(--z-modal)`-style rule) since
    the day they were added. Fixed by closing `:root` around them; no values
    changed, they just actually apply now.
  - **Real bug:** `.nav` (desktop header) and `.botnav` (mobile tab bar) had a
    hardcoded `rgba(255,255,255,..)` background regardless of
    `[data-theme="dark"]` — the default theme. Fixed to `var(--glass-2)`.
  - **Real honesty bug:** the restaurant-detail share button called
    `toast('','لینک کپی شد')` without ever copying anything — a fabricated
    success claim. Fixed with `navigator.share`/real clipboard copy of the
    current URL. **Residual, left out of scope:** this app has no per-restaurant
    deep-link (no URL routing), so the copied link opens the app, not the
    specific restaurant — the toast copy says "لینکِ رزرونو" (Rezervno's link),
    not "لینکِ این رستوران", to stay honest about what was actually copied.
    Building real deep-linking is a separate, larger change.
  - **Real gap:** a discover-feed card with zero preview slots (`r.slots`
    empty) rendered no call-to-action at all. Fixed with a calm "ببین سانس‌ها"
    fallback that opens the real availability sheet — never an invented time.
  - **New:** a canonical named-haptics layer (`haptic(name)` in
    `theme-pwa.js`: light/medium/heavy/success/warning/error/select/like) plus
    an `rz_haptics=0` off-switch that both `haptic()` and the pre-existing
    `buzz(ms)` respect. `buzz()` itself is unchanged in signature/behavior.
    Wired at the two sites explicitly flagged as gaps (slot select, copy-code)
    plus the fav/like toggle and the success-booking path — `success` fires
    **only** on a real `res.ok`; the offline/demo path fires `light`, never
    `success`. The ~15 pre-existing generic `buzz&&buzz()` call sites elsewhere
    (share/message/chat/waitlist buttons, loyalty action cards) were
    deliberately **not** migrated to named patterns — out of scope, still
    functional as-is.
  - **Additive-only token layer:** typography role tokens
    (`--type-display-*`/`--type-title-*`/`--type-body-*`/`--type-meta-*`/
    `--type-numeric-*`) and `--motion-instant` were added to
    `shared/css/tokens.css`. `apps/customer/css/app.css`'s own long-standing,
    already-tuned local scale (`--r-*`, `--sh-*`, `--t1`/`--t2`/`--t3`, etc.)
    was **not** force-migrated onto the new tokens — the literal sizes don't
    line up 1:1, and a blind swap would have been a visual regression, not a
    polish. A real migration is a separate, measured follow-up.
  - **Explicitly deferred (documented, not attempted):** the botnav IA
    restructure suggested by the mission (merge "اعتبار" under "باشگاه", add a
    "من" tab, cap at 4 tabs) — the panel already has 5 tabs and no "من" tab.
    Doing this safely needs new routing/rendering work across `go()`/`economy`/
    `loyalty`, which is real product surgery, not safe polish; left as a
    residual per the mission's own "implement if low-risk, otherwise document"
    instruction. Full hero/sheet/mood-rail rebuilds were similarly out of
    scope — those surfaces were already close to the target and audited for
    correctness rather than restyled.
- **2026-08-14 — customer-app product-risk sweep (R1–R8 mission).** Verified
  against the running `main` at the time (not assumed from a prior audit):
  - **R1 — Fixed.** `mapApiRestaurant` (`apps/customer/js/api.js`) let `menu`,
    `rating_breakdown`, `reviews`, `description`, `features`, `good`, `bad`,
    and `ai` fall back to an *unrelated* sample restaurant's content for any
    live (slug-bearing) restaurant the API didn't fully populate — the same
    class of bug already fixed for `slots` in an earlier pass, just never
    applied to the rest of the rich fields. All eight now stay empty/null for
    live restaurants instead of borrowing another business's menu or reviews.
    `data/detail.js` and `data/booking.js` (pre-order) now show an honest
    "not provided yet" empty state instead of blank sections or (worse) a
    full row of misleading all-zero rating bars. Also fixed the root cause
    that made `sampleFallback` always resolve to `R_SAMPLE[0]`:
    `loadRestaurants`/`loadMoreRestaurants` matched a real restaurant's UUID
    against `R_SAMPLE`'s small-integer `id`, which can never match.
    `pickSampleFallback()` now tries a `slug` match first and otherwise picks
    a **varied**, deterministic sample by hashing the real id, so purely
    cosmetic fields (emoji/cuisine/price/vibes/badge) at least stop collapsing
    onto the exact same sample restaurant for every card. **Residual:**
    `R_SAMPLE` entries still have no `slug` field, so the slug-match branch is
    inert until one is added.
  - **R2 — Fixed.** `parseTripDateTime` (`features/trips.js`) always did
    `setDate(+1)` regardless of a reservation's actual date — every calendar
    (.ics) export said "tomorrow" no matter when the reservation really was.
    `mapApiTrip` now threads the server's raw `slotStart` ISO timestamp
    through as `slotStartIso`; `addToCalendar` uses it directly and, if it's
    missing/invalid, shows an honest toast and generates **no file** — the
    always-wrong guesser was deleted rather than kept as a fallback.
  - **R3 — Fixed.** `mapTripStatus` recognized only 4 of the ~17 backend
    reservation statuses (`api/src/lib/lifecycle.ts`); everything else —
    notably the two most common terminal states, `completed` and the
    *current* `cancelled` (it only checked the legacy
    `cancelled_by_user`/`cancelled_by_restaurant`) — silently defaulted to
    "پیش‌رو" (upcoming). A finished or genuinely cancelled reservation could
    sit in the customer's upcoming list forever. Replaced with an explicit
    map covering every literal in the backend's status type; a truly unknown
    future status still safely defaults to "up" (documented, not a silent
    gap). Restaurant matching in `mapApiTrip` moved from fragile name-string
    comparison to `restaurantId` (already returned by `GET /me/reservations`
    — no backend change needed), falling back to `slug`.
  - **R4 — Fixed.** The "کِی"/"چند نفر" search selects wrote `bookingCtx` but
    nothing read it back — `doSearch()` was a pure text filter, so picking
    "فردا، ۴ نفر" changed nothing visible. The discover feed's subtitle now
    always appends the selected date + party size, refreshed on
    `syncSearchCtx()` (not just after pressing search) and on initial load.
    Per-card live-availability annotation (marked optional in the mission)
    was **not** attempted — would need a bulk availability endpoint that
    doesn't exist yet, and inventing per-card slot data would violate the
    same honesty rule R1 fixes.
  - **R5 — Fixed (customer app, as scoped).** Added explicit `color-scheme:
    dark`/`light` to `app.css`'s theme blocks — without it, native `<select>`
    dropdown popups follow the OS color scheme instead of the page's
    `data-theme`, so a dark-mode user on a light-OS could get a native white
    dropdown list. Added explicit `::placeholder` colors instead of relying
    on each browser's own default opacity. `apps/business`/`apps/company`
    still have **no dark-mode infrastructure at all** (documented in a prior
    pass) — unchanged, out of scope here.
  - **R6 — N/A, already correct.** `availability.ts` already prefers
    `generateTimesFromHours` and only falls back to `SERVICE_TIMES` when the
    weekday is undefined (fixed in a prior PR; re-verified against current
    `main`). The discover-card `.slice(0,3)` is a deliberate card-preview cap
    — the booking sheet itself lists every real open slot uncapped. No
    changes made.
  - **R7 — N/A, already correct.** The Business hours form already sends a
    pending proposal ("ارسالِ پیشنهاد برای تأیید", never "ذخیره شد" on a
    pending change) and `apps/company/js/hours.js` already exists as the
    approval queue (fixed in a prior PR; re-verified). No changes made.
  - **R8 — Fixed.** `confirmBook`'s name/mobile confirm-step inputs
    (`#bkName`/`#bkPhone`) were never read — a user could clear them and
    "تأیید رزرو" still succeeded, because the POST body never included them
    (a logged-in customer's identity comes from the JWT, not this form).
    Added real validation (non-empty name, `09xxxxxxxxx` phone) before
    submission. **Residual, explicitly not fixed:** editing these fields
    still has *no effect* on the created reservation — the backend's
    `reservationSchema` only honors a `guest` override for `staff`-kind auth,
    not `customer`-kind. Wiring a customer-supplied override into the
    reservation is a backend schema change with its own security questions
    (should a customer be able to book "as" a different phone number?) and
    was judged out of scope for a targeted risk-reduction pass — flagged
    here rather than left unmentioned. Idempotency-Key, "success only on a
    real `res.ok`", and explicit offline labeling were already correct and
    are unchanged.

## 2b. System audit — 2026-08-19 (read-only pass, verified against code not docs)

- **`apps/business/src-v2/` is dead code — status now certain, was "(uncertain)".**
  It holds exactly one file (`RestaurantIntelligenceDashboard.jsx`, 20 KB). Verified:
  it is referenced by **nothing** outside itself; `apps/business` has **no
  `package.json` and no bundler config**; `apps/business/index.html` loads only
  classic `js/*.js` scripts. So the JSX cannot even be transpiled, let alone
  mounted — it is unreachable *and* unbuildable. Its content is pure fabrication
  (`MOCK_CUSTOMERS` with invented names/CLV/churn, `MOCK_CARDS` with invented
  insights like "۱۲ مشتری در آستانه‌ی ریزش"), zero network calls, and it
  duplicates capabilities that are **genuinely implemented** in the shipping
  panel (`js/crm.js` really calls `API.rfm()`/`API.aiRecommendations()`/
  `API.customers()` against real routes backed by `lib/rfm.ts`,
  `lib/customer-insights.ts`, `lib/crm-recommendations.ts`).
  **Classification:** Mock + Disconnected + Duplicated + Deprecated.
  **Recommendation: delete it.** It ships no value and is a live trap — wiring it
  up would instantly put fabricated CLV/churn numbers in front of a real
  restaurant. Not deleted in this pass because removal is the owner's call.
  **(decision needed)**
- **Menu has no CRUD — the whole spend/CLV chain is structurally dead for real
  restaurants.** `MenuItem` exists in Prisma and is *read* (public
  `restaurants/[slug]` returns `menu[]`) and *consumed* (preorder on
  `POST /reservations`, `restaurant/reports` top-items, spend in
  `customer-insights.ts`). But there is **no route anywhere** to create, edit, or
  delete a menu item — grep of all 134 API routes finds no menu endpoint — and no
  menu screen in the business panel. The only code that ever inserts a `menu_items`
  row is `prisma/seed.ts` (dev seed). Neither trial signup (`site-orders.ts`) nor
  branch creation inserts any. Consequences, each verified in code:
  1. every real restaurant has a permanently empty menu, with no way to fix it;
  2. the customer preorder block is gated on `r.menu.length`, so preorder can
     never render → no `reservation_items` rows are ever created;
  3. therefore `customer-insights.ts` computes `totalSpend = 0` → `avgSpend = 0`
     → `predictedClv = Math.round(visitsPerYear * 0) = 0` for **every** real
     customer of **every** real restaurant, and writes those zeros to
     `customer_insights` as if measured.
  Building menu CRUD is a real feature, deliberately not attempted in this
  audit pass. **(P1, open)**
- **Customer-intelligence money fields cannot express "no data".**
  `CustomerInsight.totalSpendToman` / `avgSpendToman` / `predictedClvToman` are
  `Int @default(0)` — **not nullable** — so "we have no spend data" and "they
  spent zero" are stored identically. Compounding this, Rezervno is deliberately
  POS-agnostic (it never sees a bill), so the only spend source is preorders —
  exactly what the schema comment on `total_spend_toman` says: «جمعِ
  پیش‌سفارش‌ها». Labelling that column "کل خرج" (total spend) in the panel
  overstated what it measures even when non-zero.
  **Mitigated at the presentation layer in this pass** (`js/crm.js`): the tile is
  relabelled «پیش‌سفارش», zero renders as «—» rather than «۰», and an explicit
  note states that a zero is not a measurement. **Residual:** the DB still cannot
  distinguish the two cases; a proper fix makes those columns nullable (schema +
  migration, high-risk per repo convention) or adds a `spend_source` marker.
  **(residual, open)**
- **Verified healthy, no change made (checked rather than assumed):**
  *Integrations* — there is no connector/adapter code at all and, importantly,
  **no UI anywhere claiming a false "connected" state**; absent-and-honest beats
  faked (matches the "integration-ready ≠ integrated" rule).
  *Revenue widget* (`js/overview.js`) — it does estimate revenue from hardcoded
  coefficients (`REVENUE_CONFIG.avgPerGuest`) because no POS is connected, but it
  renders an explicit note that the figures are estimates, so it is a labelled
  inference, not a fabricated KPI.
  *`POST /v1/telemetry`* — a real behavioural-event ingest with
  server-authoritative `userId`/`source`/`device` (client cannot spoof them).
  *Live-app mock sweep* — no `MOCK_`/`FAKE_`/`SAMPLE_` constants remain in
  `apps/{customer,business,company}/js` or `shared/js`.

- **Push notifications: storage only, no real delivery.**
  `POST/GET /api/v1/me/push-subscribe` really persists a per-user row
  (`push_subscriptions`, migration `049`) instead of being a no-op — verified
  live against real Postgres. But the response's `ready` field is hard-coded
  `false` on purpose: there is still no FCM/APNs integration, so
  `enabled:true` only means "the client's subscribe request was stored", not
  "this device will actually receive a push". `sendPush()`
  (`api/src/lib/notify.ts`) still only logs. Building real delivery needs a
  provider key plus reading `token`/`endpoint` from this table inside
  `sendPush()`. `sendEmail()` is in the same honest "log only, no provider
  key" state and was left unchanged — no code gap there, just missing
  production infrastructure. **(follow-up)**

## 3. Backend / Domain

- **No repository layer.** Services call Prisma (and raw SQL) directly. This is
  pragmatic but couples domain logic to the ORM and complicates unit testing
  (mitigated in the reservation engine via a DI port).
- **Reservation status enum carries legacy values** (`arrived`,
  `cancelled_by_user`, `cancelled_by_restaurant`) kept for backward compat with
  existing rows — a source of subtle bugs if new code forgets them. The
  "active-status set" (`reservation-status.ts`) must stay complete.
- **Queue is Postgres-based.** Great for consistency/idempotency, but every
  drain is a DB write burst; at very high job volume a dedicated broker
  (Redis/SQS) may be warranted.
- **Cron fan-out endpoints do bounded-concurrency loops** over all restaurants
  (e.g. waitlist maintenance). At large tenant counts these need pagination /
  work-sharding to stay within request timeouts. **(scalability)**

## 4. Security (open recommendations)

- **Token revocation — verified, ۲۰۲۶-۰۸-۱۴.** `POST /auth/logout` revokes the
  refresh token's `jti` (`revokeRefreshToken`); `POST /auth/refresh` checks
  `isRefreshRevoked` on every call and re-reads `Staff.isActive`/user ban
  status live from the DB (not from the stale refresh payload), revoking and
  rejecting immediately if the account is now disabled or banned. **Residual
  risk (accepted, not a bug):** an already-issued **access** token stays valid
  for its own TTL (`signAccess` → `expiresIn: '15m'`) — a deactivated
  staff/banned user can still use a *not-yet-expired* access token for up to
  15 minutes after logout/ban. No access-token denylist exists (would need a
  cache lookup on every request); the 15-minute window was judged an
  acceptable trade-off. Revisit only if a specific incident needs a shorter
  window.
- **Waitlist guest tokens are hashed at rest — fixed, PR #16 (۲۰۲۶-۰۸-۱۴).**
  The guest-access token issued at `joinWaitlist` (migration `041`) used to be
  stored as plaintext in `waitlist_entries.guest_access_token`. It's now
  stored only as `guest_access_token_hash` (`sha256(token + JWT_SECRET)`, the
  same pattern as `otp_codes.code_hash`) via migration `044`, which also
  drops the old plaintext column. A DB leak (backup, SQLi, insider access)
  can no longer be used to directly extract and replay an active guest's
  token. The client-facing shape is unchanged — `guest_token` is still
  returned once, raw, at join time.
- **Booking-domain P0s (lifecycle bypass, merge double-booking, cross-tenant
  preorder, waitlist IDOR, ban coverage gaps, walk-in/maintenance guards) —
  closed, PR #13.** See [SECURITY.md](./SECURITY.md) §11 for what's
  implemented and how it's verified.
- **`localStorage` tokens** are XSS-exposed; every front-end `innerHTML` sink
  must escape user data (`esc()` — unit-tested, `api/tests/esc.test.mts`,
  PR #16).
- **RLS is partial** (started in `manual/023`); not all tenant tables have it.
- **Rate-limit fail-open — now observable, residual-hardening PR
  (۲۰۲۶-۰۸-۱۴).** When Redis is down, the fallback to a per-process
  in-memory floor (`max × instances` under multi-instance deployment) is
  **unchanged as policy** — that trade-off is still accepted — but it now
  emits `rezervno_rate_limit_fallback_total` (labels: `prefix`, `scope`) and
  a structured `rate_limit: Redis در دسترس نیست...` warn log on every
  fallback, plus `rezervno_rate_limit_auto_ban_total` /
  `rezervno_ban_check_fail_open_total` for the auto-ban and ban-check
  fail-open paths. **A real bug was fixed alongside this**: route-level
  `enforceRateLimit` (used by ~59 route handlers via
  `withRestaurantAuth`/`withStaffAuth`) had **no fallback at all** — a Redis
  outage turned into an uncaught throw → a generic error response, not the
  documented fail-open floor. Only the global `middleware.ts` path had the
  in-memory fallback. Both paths now share one implementation
  (`rateLimitWithFallback` in `ratelimit.ts`). Operators must still wire an
  alert on these metrics themselves — none exists yet.
- **Full `innerHTML`/`insertAdjacentHTML`/`document.write`/`eval` sink audit
  — done, residual-hardening PR (۲۰۲۶-۰۸-۱۴).** `tools/xss-sink-audit.mjs`
  automatically scans `apps/customer|business|company` + `shared/js`,
  classifies every sink, and fails (non-zero exit) on any `unsafe` one. As
  of this pass: **zero unsafe sinks** — 8 real gaps were found and fixed
  (unescaped restaurant name in 3 places, an AI-generated dashboard insight,
  a mission title/description, a badge name, 3 photo-URL `src=` attributes,
  a pricing-rule label), the rest were either already safe or reclassified
  with a written justification (`MANUAL_REVIEW_OVERRIDES` in the script; see
  `docs/XSS_SINK_AUDIT.md`). The scanner is heuristic (regex, not real
  dataflow) and is **not wired into CI** — it must be re-run by hand;
  wiring it into the `security` CI job is a natural follow-up.
- **Merge-occupancy concurrency race (P0-3) — proven live, residual-hardening
  PR (۲۰۲۶-۰۸-۱۴).** Two genuinely simultaneous
  (`Promise.all`, real Postgres, not sequential/mocked) `createReservation`
  calls contending for the same secondary merge table were run repeatedly;
  Postgres's existing `Serializable` isolation + the in-transaction
  `getOccupiedTableNumbers` re-check (already present before this PR)
  correctly allow exactly one to succeed every time, with the loser getting
  a structured `409`-family error, never a double-booking. This is now a
  permanent test (`api/tests/table-merge-occupancy-concurrency.test.mts`),
  not a one-off script. **No production code changed for this** — the
  existing design was already correct; only the live proof was missing.
  A narrow TOCTOU window remains *theoretically* possible outside what was
  tested (documented in `table-occupancy.ts`) but is no longer an untested
  claim for the scenario that matters most.
- **Time-range contract + Redis slot-lock fail-open — audited and hardened,
  Time-Range/EXCLUDE/Redis-evidence PR (۲۰۲۶-۰۸-۱۴).** Three real, minimal
  fixes came out of this audit (not a rewrite of the booking engine — that was
  explicitly out of scope):
  1. `createWalkin` never set `block_buffer_minutes` (defaulted to `0`), so a
     walk-in's `block_end` = its `slot_end` exactly — no cleaning/buffer time,
     unlike every online/manual booking. Fixed to apply the same
     `cleaningMinutes + bufferMinutes` formula `computeRanges` uses.
  2. `withSlotLock` (the Redis lock `createReservation` takes before writing)
     had no fallback for Redis being *unreachable* — only for the lock being
     genuinely held. A Redis outage threw an uncaught error out of
     `createReservation` → a generic `500`, contradicting the documented
     "Redis lock is only an optimization" architecture. Now fails open on a
     connection-level error (metric: `rezervno_slot_lock_fallback_total`), and
     a failed unlock no longer masks an already-successful reservation behind
     a `500`.
  3. Proving fix (2) live (via the same `Promise.all` dual-concurrent
     methodology as the merge-occupancy test, with the lock forced fail-open
     through dependency injection — not a real downed Redis) surfaced a second
     bug: under genuine simultaneous contention, Postgres sometimes reports
     the exclusion conflict as a `PrismaClientUnknownRequestError` (SQLSTATE
     only in the message text, not `.code`/`.meta`) rather than the
     `PrismaClientKnownRequestError` shape `isConflictError`/
     `isSerializationError` recognized — so a *real* conflict, correctly
     prevented by the DB, was leaking out as an unhandled `500` instead of the
     intended `409`. Fixed in `reservation-helpers.ts`.
  Also verified (no drift, no code change needed): the EXCLUDE constraint's
  active-status `WHERE` list (`prisma/sql/026`) still matches
  `ACTIVE_RESERVATION_STATUSES` exactly — now enforced by a test that parses
  `026`'s SQL text directly, so a future one-sided edit fails CI instead of
  silently reopening the double-booking hole `016` originally fixed.
  `computeRanges` itself was not changed (kept pure/O(1) per the audit's
  explicit constraint) — only its test coverage was extended (a real
  Asia/Tehran UTC-day-boundary case, an explicit non-default-timezone case,
  and a determinism/purity check).
- **Payment idempotency (P0-9) is still code-reviewed/unit-tested only, not
  exercised live** — needs a real Zarinpal `merchant_id`, not available in
  this environment.

See [SECURITY.md](./SECURITY.md) §12 for the full recommendations list.

## 5. Data / Migrations

- **`schema.prisma` had real drift from the live DB** (fields/FKs that existed
  only in Postgres) — reconciled in `022`, but the pattern (raw-SQL tables added
  without Prisma models) can recur. Keep every table represented in the schema.
- **Partitioning is not enabled** (`reservations`, guide `011`). `011` is a
  `-- @manual-only` scaffold — its data-copy and table-rename steps are commented
  out and it guards itself with a `RAISE EXCEPTION` unless
  `rezervno.allow_partitioning` is set. It has never been applied: on production
  `reservations` is a plain table (`relkind='r'`), and `POST /v1/maintenance/
  ensure-partitions` is a no-op that returns `{ok:false, reason:'partitioning not
  enabled'}` because the `ensure_reservation_partition` function does not exist.
  A missed cron run therefore **cannot** break inserts. If partitioning is ever
  adopted, note that `011`'s partition constraint was aligned to the canonical
  `no_table_overlap` (`tsrange(slot_start, block_end)` + active-status filter).
  **(future)**

## 6. Observability

- **Some fail-open paths are log-only** (rate-limit degradation, auto-bans).
  Add alerting so silent Redis outages are noticed.
- Metrics endpoint is public unless `METRICS_TOKEN` is set — set it in prod.

## 7. Testing / CI

- ~~`test` job depends on `--test-force-exit`~~ **Fixed (2026-08-13).** That flag
  was itself the cause of flaky `# tests`/`# suites` counts between identical
  runs (fail always 0, but totals varied — e.g. 314 vs 332): `tsx --test`
  isolates each of the 23 `tests/*.test.mts` files (at the time) in its own
  child process, and force-exit killed each child right as its own tests
  finished, racing its stdout pipe still flushing TAP output to the parent.
  First attempt used `--experimental-test-isolation=none` (Node 22+) — worked
  locally but broke CI outright (`bad option`, CI pins Node 20). Final fix is
  version-agnostic: `npm test` now runs a single wrapper file
  (`tests/_all.runner.mts`) that imports every test file for its side
  effects, so `tsx --test` only ever sees one file — no subprocess-per-file,
  no race, no experimental flag, no Node-version dependency. `redis.ts` also
  gained `lazyConnect: true` so importing it no longer opens a live socket
  for typing-only imports.
- **3 test files existed but were silently never run — fixed, PR #16
  (۲۰۲۶-۰۸-۱۴).** `ban.test.mts`, `crm-recommendations.test.mts`, and
  `customer-intelligence.test.mts` were never `import`ed into
  `tests/_all.runner.mts` — the single wrapper file above only runs what it
  explicitly imports. `npm test` had silently never executed them; a PR body
  had claimed "375/375 passing" when the real count (without those 3 files)
  was 352. All `tests/*.test.mts` files (28 as of PR #16) are now imported;
  `npm test` reports 392/392, stable across consecutive runs.
- **`npm test` could hang indefinitely after a test opened a real DB/Redis
  connection — fixed, PR #16 (۲۰۲۶-۰۸-۱۴).** `db.ts`/`redis.ts` close their
  connections on `process.once('beforeExit', ...)`, but an open Redis socket
  is itself a pending handle that keeps Node's event loop from ever reaching
  the empty state `beforeExit` requires — a deadlock no test file had
  triggered until the first real-Postgres integration test
  (`table-merge-occupancy.test.mts`) was added; all prior test files were
  pure-logic and never opened a live connection. Fixed with an explicit,
  unconditional `db.$disconnect()`/`redis.quit()` in `_all.runner.mts`'s
  top-level `after()` hook. The underlying `beforeExit` reliance inside
  `db.ts`/`redis.ts` themselves is **unchanged** — the same deadlock remains
  a latent risk for any other standalone script/worker that opens a live
  Redis connection and doesn't call `process.exit()` itself. **(follow-up)**
- **E2E fully mocks the API** — it validates the customer UI/flows but not the
  real API contract end-to-end. Consider a small contract/integration suite
  against a real backend.
- ~~No `e2e/package-lock.json` committed yet — E2E installs are unpinned.~~
  **This was already false when written.** All four lockfiles are tracked:
  `api/` since 2026-07-29, `apps/seo/` since 2026-07-30, and `e2e/` +
  `apps/landing/` since 2026-08-06. The note survived long after the fact and
  also cost the e2e job its npm cache, because `ci.yml` carried matching stale
  comments and left `cache:` unset there. Both are corrected.
- **The e2e job runs inside the official Playwright image (2026-08-19).**
  `ci.yml` used to `npx playwright install --with-deps`, which made every run
  depend on two external services, and both failed in the same day: the
  Playwright CDN hung repeatedly (one run sat 45+ minutes on a ~150MB browser
  download), and once that was cached the bottleneck moved to
  `install-deps`, which is `apt-get` underneath and hung in turn. An attempt to
  make the system libraries best-effort was measured and **rejected**: without
  them Chromium passed 86 tests while WebKit failed all 43, down to
  "is `lang=fa`?" — so they are genuinely required, not optional. Running the
  job in `container: mcr.microsoft.com/playwright:v1.62.1-noble` removes both
  steps entirely (browsers and their OS libraries ship in the image), costing
  ~27s of container startup against a download that had hung for 45+ minutes.
  ⚠️ **Maintenance:** the image tag must stay in lockstep with
  `@playwright/test` in `e2e/package.json` — bump both together.
- **Local development still needs `npx playwright install`.** Only CI changed;
  the setup instructions in `README.md`, `e2e/README.md`, and
  `PROJECT_KNOWLEDGE.md` remain correct for a local machine.

## 8. Scalability Concerns (summary)

| Area | Concern | Mitigation present | Further work |
|---|---|---|---|
| DB connections | Pool exhaustion under load | Pooled URL + `DB_CONNECTION_LIMIT`; optional read replica | Tune per traffic; add PgBouncer if not on Supabase pooler |
| Reservations | Double-booking under concurrency | Redis slot lock + exclusion constraint + serialization retry | Load-test hot restaurants; watch `CONCURRENCY_RETRY` rate |
| Job queue | DB write pressure | SKIP LOCKED, priority, backoff, DLQ | Broker if volume grows |
| Cron fan-out | Per-tenant loops | Bounded concurrency | Shard by tenant / paginate |
| Redis outage | Rate-limit weakens | In-memory floor | Alert + HA Redis / cluster |
| Front-end DS | Copy drift | — | Package/sync the design system |

## 9. Product / Feature Gaps (as observed)

- Chat is **polling-based** (no websockets) — fine for MVP, higher latency/load
  at scale.
- Payments are Zarinpal-only; refund flow exists as a `DepositStatus.refunded`
  state but the automated refund path is **(uncertain)**.
- Several restaurant-panel RBAC permission mappings are inferred; confirm the
  exact `permission` key per route against the handlers.
