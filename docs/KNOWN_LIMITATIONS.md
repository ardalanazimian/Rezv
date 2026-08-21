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

- **JSON-LD published every menu price at one-tenth its real value — fixed
  2026-08-19.** `apps/seo/lib/schema.ts` emitted `price_toman` directly with
  `priceCurrency: 'IRR'`. Toman is not an ISO 4217 currency; IRR is the rial,
  and 1 toman = 10 rials — so a 185,000-toman dish was declared to Google as
  185,000 rials (≈18,500 toman). Wrong structured data is the worst kind of
  wrong: it presents itself as authoritative. Fixed with an explicit
  `tomanToRial()` conversion, locked by a test that also asserts the raw toman
  value is *not* what gets published, and proven by mutation test.
- **Menu item photos accepted an arbitrary client-supplied URL — replaced with
  a real upload pipeline (2026-08-19, migration 053).** Migration 052 had added
  `image_url` as a free-text field the panel wrote directly. Three problems:
  nothing guaranteed the URL pointed at an image, the menu on the table depended
  on a third-party host that would show a broken image the day it went down, and
  no size/dimension/format validation or moderation was possible. The project
  already had the right pipeline — `lib/media.ts` + `lib/media-store.ts`, used by
  the restaurant gallery: magic-byte format sniffing (never the browser's claimed
  content-type), size and dimension caps, storage keys, and serving from
  `/api/v1/media/<key>`. `POST|DELETE /restaurant/menu/{id}/photo` now uses it, and
  `image_url` became server-written. Verified end-to-end: a real 240×240 PNG
  uploaded through the panel, stored, served byte-identical, and decoded in a real
  browser at 240×240.
  **Deliberate difference from gallery photos:** gallery uploads sit `pending`
  until the platform approves; menu photos publish immediately, because the
  authority model makes the menu the restaurant's own and a restaurant adding a
  dish at 8pm cannot wait for tomorrow's review. The platform can still remove
  abusive content — it just does not gate the normal update path.
- **Menu page personalization — foundation shipped, not a full theme system
  (2026-08-19, migration 053).** Until now the public menu page every restaurant
  printed a QR for looked identical. Restaurants now control four things:
  accent colour (`#RRGGBB`), light/dark/auto, a tagline, and list/grid layout.
  Each is `NULL` by default, meaning "not chosen" — the page falls back to the
  platform default rather than to a fabricated value. Validation is three-layer:
  the API schema, `CHECK` constraints in Postgres (so a hand-run script cannot
  seat a nonsense value either), and `safeAccent`/`safeTheme`/`safeLayout` in the
  SEO app, because the accent lands inside an inline `style`.
  What is **not** shipped and must not be claimed: custom fonts, per-section
  theming, background images, multiple menu groups, AR/3D, seasonal engines, or
  multi-language menus. This is a usable foundation, not menew parity.
- **The branded CTA rendered invisible text — caught by browser test, fixed
  same day.** The new rule `.menu-root a { color: var(--brand) }` (specificity
  0,1,1) outranked `.cta { color: var(--brand-ink) }` (0,1,0), so the button's
  text took the brand colour on a brand-coloured background: `color` and
  `background-color` both `rgb(225,29,72)`. Found by asserting computed styles in
  a real browser, not by looking at a screenshot. Fixed with `a:not(.cta)`, and
  the ink colour is now derived from the accent's WCAG relative luminance
  (`inkFor`) rather than a fixed white — a fixed white was unreadable on light
  brand colours like yellow. Locked by tests and proven by mutation test.
- **Public QR menu — deliberate scope (2026-08-19).** The QR on the table
  points at `https://rezervno.ir/r/{slug}/menu`, a server-rendered page with no
  client JavaScript. What it is **not**: no POS, no bill payment, no ordering
  from the table, no inventory, no delivery. Pre-ordering still exists only in
  the customer app's reservation flow and was not touched. The page reads the
  same `MenuItem` rows the business panel edits — there is no second menu store.
  Two consequences worth knowing: a menu edit takes up to the 300s ISR window to
  appear publicly (no on-demand revalidation hook is wired for menu changes
  yet — `apps/landing` has that pattern if it becomes necessary), and a
  restaurant with no active items gets an honest empty page marked
  `noindex, follow` rather than a sample menu.
- **`apps/seo` had no CSS at all, so its font never loaded — fixed 2026-08-19.**
  `layout.tsx` set `fontFamily: 'Vazirmatn'` from the start, but the app
  shipped no stylesheet, so no `@font-face` ever bound that name to a file and
  the Persian UI silently fell back to a system sans-serif. Same class of bug as
  the panels' Google-Fonts failure fixed the same day, except here there was not
  even a broken link to notice. Now `app/globals.css` declares the self-hosted
  `public/fonts/vazirmatn-var.woff2`; verified in a real browser with
  `document.fonts.check('700 16px Vazirmatn') === true` and zero external requests.

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

- **`apps/business/src-v2/` — DELETED 2026-08-21.** (Was: dead code, status certain.)
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
- **Menu has no CRUD — ~~structurally dead~~ SHIPPED 2026-08-19, entry kept for
  history.** The original finding was correct when written: `MenuItem` was read
  (public `restaurants/[slug]` returned `menu[]`) and consumed (preorder,
  `restaurant/reports` top-items, spend in `customer-insights.ts`) but **no route
  anywhere** could create, edit, or delete one, so every real restaurant had a
  permanently empty menu. That gap is now closed — verified by listing the
  routes, not by trusting this file:
  `restaurant/menu/route.ts` (list + create), `restaurant/menu/[id]/route.ts`
  (update + delete/archive), `restaurant/menu/[id]/photo/route.ts` (upload +
  delete), `restaurant/menu/branding/route.ts`, `restaurant/menu/qr/route.ts`,
  plus the public `restaurants/[slug]/menu` reader and a real panel screen
  (`apps/business/js/menu.js`). Locked by `tests/menu-crud.integration.test.mts`
  and `tests/public-menu.integration.test.mts`.
  **What is still true:** the spend/CLV chain remains preorder-only, so a
  restaurant that fills its menu but takes no preorders still produces
  `totalSpend = 0 → avgSpend = 0 → predictedClv = 0`. Menu CRUD unblocked the
  chain; it did not make Rezervno POS-aware. See the next bullet.
  **(resolved — chain still preorder-gated)**
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

## 2d. Second audit pass — 2026-08-19 (the areas the first pass explicitly skipped)

The first pass (§2c) listed what it had *not* audited. This section closes that
list. Same discipline: live infrastructure, database-verified, positive controls.

- **Redis outage made public endpoints unusable — fixed.** The fail-open design
  is correct, but nobody had measured *time*. With Postgres healthy and Redis
  stopped: `/v1/restaurants` 0.02s → **8.5s**, `/v1/events` 0.02s → **22.0s**,
  `/v1/restaurants/live-stats` 0.25s → **timed out entirely**. ioredis has no
  default `commandTimeout`, so every command waited out the retries. Under load
  this converts a Redis blip into a full outage via connection-pool exhaustion.
  Fixed with explicit `commandTimeout` (250ms) / `connectTimeout` (1000ms),
  both env-tunable; measured again at **0.92s / 1.03s / 0.86s**, and recovery is
  automatic once Redis returns. `enableOfflineQueue` deliberately left on —
  with `lazyConnect` the first command is what opens the connection.
- **24 exactly-duplicate indexes across 12 tables — dropped (migration 054).**
  Root cause is this repo's two-source pattern: hand-written SQL migrations
  create `idx_*` while `@@index` in `schema.prisma` creates Prisma's auto-named
  twin. A duplicate index speeds up nothing and doubles write cost.
- **`customer_insights.user_id` and `club_members.user_id` had no leading index
  — added (migration 054).** Every index on those tables starts with
  `restaurant_id`, but `lib/guest-profile.ts` filters by `userId` alone.
  Measured on 100k rows: **Seq Scan 14.26 ms → Bitmap Index Scan 0.18 ms**
  (~80×), buffers 1540 → 27.
- **RBAC is enforced at runtime, not just declared — verified.** 40 of 45
  `/v1/restaurant` route groups declare a `permission`; the 5 that don't are
  day-to-day operations `SAFE_DEFAULTS` grants anyway. Live probe with a real
  `role='staff'` token (no `StaffPermission` row): 403 on reports, analytics,
  coupons, menu, profile, rfm, customers; 200 on reservations, tables,
  waitlist — with an owner token returning 200 everywhere as positive control.
  **10/10 as designed.**
- **Company-panel tenant isolation is fail-closed — verified.** A normal
  restaurant owner's token gets **403** on `/v1/admin/restaurants`; the platform
  admin gets **200**.
- **Telemetry cannot be forged — verified.** An attacker's own token, with a
  body claiming a victim's `userId` and a fake `device`: the stored row carries
  the **attacker's** id (from the token) and the **real** UA header. `source`
  outside the three client values is rejected 422, and an unknown `restaurantId`
  is stored as `null` rather than fabricated.
  **Residual:** a client may attribute events to any *existing* restaurant, so
  behavioural analytics can be polluted by a determined actor. Not a data leak
  (no read access), but an integrity caveat. **(open)**
- **All three panels run clean against the live API.** customer → 4 endpoints,
  business (owner token) → 10 endpoints incl. the menu screen, company
  (platform-admin token) → 5 endpoints and 4 sections opened. Zero JS errors,
  zero failed requests, no horizontal scroll at 390px in any of them.
- **CORS is the single switch that decides real-vs-sample data.** With
  `ALLOWED_ORIGINS` unset, the customer app's calls are blocked and it falls
  back to sample restaurants — *honestly*, badging every card «نمونه» and
  logging it. With the origin allowed, the badges disappear and real data
  renders. So a CORS misconfiguration at launch is not a crash; it is a silent
  demotion to sample content. **Set `ALLOWED_ORIGINS` before launch.**
- **Menu categories are still free text, not an entity.** `category` is
  `String?` (max 60), with no per-restaurant catalogue, no normalization and no
  explicit ordering: «نوشیدنی» and «نوشیدنی‌ها» silently become two sections.
  Section order on the public QR menu follows the `sortOrder` of the first item
  in each category (Map insertion order), so a restaurant can only control it
  indirectly. **(open, product decision)**
- **`prisma migrate diff` is not a usable drift alarm here.** It reports 239
  lines against the real database, but the content is cosmetic: 41 timestamp
  type differences, 29 default differences, 23 index renames, and FK
  re-declarations. Zero tables or columns are genuinely missing — the one
  "added" column is `reservations.block_end`, a generated column Prisma cannot
  model. Every index it flags was verified present under a different name. The
  practical consequence: real drift would be invisible in that noise. **(open)**
- **Documentation is in good shape.** An automated claim-check over all 113
  Markdown files found exactly one factual error (`LAUNCH-GAPS.md` cited
  migration `046` for the SMS starter balance; the real file is `048` — the
  behaviour itself is correct, verified live: inserting a restaurant without
  `sms_balance` yields 50). Fixed. The remaining flagged paths are legitimate
  history in dated audit reports, or text that already corrects itself.

## 2c. Live P0 verification — 2026-08-19 (real Postgres + Redis + running API)

Everything below was run against a live stack (Postgres 16.13, Redis 7.0.15,
the API serving on `:3000`), not reasoned about from source. Every verdict is
confirmed by querying the database directly, because an HTTP status code only
tells you what the API *said*, not what it *wrote*.

- **30 concurrent users, same restaurant / date / time / one table — PASS.**
  A purpose-built isolated restaurant with **exactly one** table and 30 distinct
  real users, all fired with `Promise.all` (no queue, no artificial delay — the
  standing trap here is that serialising the requests makes the test pass
  without ever creating a race). Result: `success: 1`, `rejected: 29`,
  `other: 0`. Database evidence: exactly **1** reservation row, and an
  independent self-join over `tsrange(slot_start, block_end) &&` returned
  **0 overlapping pairs**. Correctness of the booking engine is not in question.
- **Idempotency — PASS.** 5 concurrent `POST /reservations` with one identical
  `Idempotency-Key`: `{201: 1, 409: 4}` with `IDEMPOTENCY_CONFLICT`, and exactly
  **1** row in the database.
- **Tenant isolation, tested at the API layer — PASS, with positive control.**
  Two fully independent tenants; tenant **B** was given a real reservation and a
  real menu item first, because a test that only asserts "A cannot see B's data"
  passes vacuously when B has no data. With a staff token for **A** plus an
  `X-Restaurant-Id: <B>` override header: `/restaurant/reservations`,
  `?date=today`, `/restaurant/customers`, `/restaurant/analytics` all returned
  **0** matches for B's secret guest, while B's own token returned **1** (the
  control). `PATCH /restaurant/menu/branding` with the override header wrote to
  **A**, not B. IDOR `PATCH`/`DELETE`/photo-upload against B's menu item id all
  returned 404. `GET /restaurant/menu/qr` with the override returned **A's** own
  slug. Now locked as an automated regression test
  (`tests/tenant-isolation.integration.test.mts`) whose negative assertions are
  each paired with a positive control, and which was mutation-tested: dropping
  the `restaurantId` constraint from the IDOR query makes it fail.

- **Finding, fixed in the same pass: the booking engine told 26 of 29 rejected
  users to "try again" for a slot that was permanently full.**
  The concurrency run above is what exposed it — reading the code would not
  have. Original codes: `{201: 1, 409: 3, 423: 26}`; the 26 were
  `SLOT_LOCK_TIMEOUT` («این بازه در حال رزرو توسط کاربر دیگری است؛ دوباره تلاش
  کنید»). Correctness was never affected — the Redis lock did its job and only
  one row was written — but the *message* was false: those users were told to
  retry something that could never succeed, which is both bad UX and a
  self-inflicted retry storm on an already-full slot. It also had a concrete
  downstream cost: `apps/customer/js/data/booking.js` only offers the waitlist
  when the error is `SLOT_FULL`/`NO_TABLE_FOR_PARTY`, so those 26 users were
  denied the one action that would have helped them.
  **Fix** (`api/src/lib/reservations.ts`): the lock is unchanged and the DB
  remains the source of truth; on `SLOT_LOCK_TIMEOUT` the engine re-reads real
  occupancy once, and only when it can *prove* every candidate table is taken
  does it return the honest `SLOT_FULL` / `TABLE_CONFLICT`. Deliberately
  conservative — in the merge path (no single-table candidate) or if that
  re-read fails, the original 423 still stands.
  **Re-run after the fix, same 30-user setup:** `{201: 1, 409: 29}`, all 29
  `SLOT_FULL`, still exactly 1 row and 0 overlapping pairs in the database.
  Locked by two tests in `tests/table-merge-occupancy-concurrency.test.mts`,
  including a positive control proving the engine does *not* simply always
  answer `SLOT_FULL` (which would be a new lie in the opposite direction), and
  mutation-tested.

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
- **The `beforeExit` deadlock above is confirmed, not hypothetical
  (2026-08-19).** Running a single connection-opening test file directly
  (`npx tsx --test tests/table-merge-occupancy-concurrency.test.mts`) prints a
  full green TAP report and then **never exits** — it had to be killed by
  `timeout`. This is exactly the latent risk the previous bullet describes:
  the fix lives only in `_all.runner.mts`'s `after()` hook, so `npm test` is
  fine while any standalone run of such a file hangs. Harmless for CI, a real
  trap for local debugging and for any future worker script. **(follow-up)**
- **Suite size after the 2026-08-19 audit: 486 tests, 119 suites, 0 failures.**
  - **Updated 2026-08-21: 729 tests, 181 suites, 0 failures** (real Postgres + Redis).
    The last additions were the untested-module pass: availability, coupons, SMS
    balance, idempotency, pricing (§2h), the automatic lifecycle crons (§2j),
    the customer-economy ledger (§2k), the waitlist writer core (§2l), the
    reward marketplace (§2m), the tenant-isolation gate (§2n), the abuse-detection scan (§2o), the
    waitlist offer-acceptance path (§2p), the three closed-out findings (§2q),
    and the metrics-endpoint guard (§2r). Earlier that same day the count was
    564; the growth is
    phases 5–8 of the intelligence work: prediction/outcome ledger, model registry,
    drift detection, train/serve feature parity, the outreach ledger, and the CRM
    feedback loop. CI now runs **8 jobs**, including a new `schema-drift` gate.
  The pass added `tests/tenant-isolation.integration.test.mts` (5) and two
  lock-honesty tests in `table-merge-occupancy-concurrency.test.mts`. Both
  additions were **mutation-tested** — the isolation lock fails when the
  `restaurantId` constraint is removed from its IDOR query, and the
  lock-honesty test fails when the `SLOT_LOCK_TIMEOUT` re-check is disabled —
  so neither is a test that would pass with the bug reintroduced. The
  registration check documented in `_all.runner.mts` was re-run: every
  `tests/*.test.mts` file is imported.
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

### ۲e) `import()`ِ پویایِ نسبی زیرِ tsx/Node ۲۰ — **رفع شد** (۲۰۲۶-۰۸-۲۰)

**یافته‌ی واقعی، از لاگِ CI نه از خواندنِ کد.** زیرِ `tsx` (که فقط `npm test` و
`db:seed` از آن استفاده می‌کنند — نه سرورِ تولید که با Next.js/Turbopack اجرا
می‌شود) ماژول به یک `data:` URL تبدیل می‌شود و **Node ۲۰** نمی‌تواند specifierِ
نسبی را از داخلِ آن حل کند:

```
TypeError [ERR_UNSUPPORTED_RESOLVE_REQUEST]:
  Failed to resolve module specifier "./prediction-ledger.ts"
  from "data:text/javascript,..."
```

Node ۲۲ می‌تواند — برای همین محلی سبز بود و CI (که Node ۲۰ است) قرمز.

**دورِ اول** دو موردِ مسیرِ ML رفع شد و در همین‌جا نوشتم «هشت موردِ دیگر باقی
مانده که چندتاشان چرخه‌ی واقعی‌اند». ⚠️ **آن جمله یک حدس بود و غلط از آب
درآمد.** در دورِ دوم گرافِ کاملِ importهای `src/lib` ساخته و به‌صورتِ
ترانزیتیو بررسی شد: **هیچ‌کدام از آن هشت مورد چرخه نمی‌ساختند.** هر هشت‌تا
static شدند:

| فایل | importِ پویا | وضعیت |
|---|---|---|
| `db.ts` | `./metrics` | ✅ static شد |
| `notify.ts` (×۲) | `./queue` | ✅ static شد |
| `redis.ts` | `./errors` | ✅ static شد |
| `reservations.ts` | `./hours` | ✅ static شد |
| `sms.ts` | `./queue` | ✅ static شد |
| `tables.ts` | `./lifecycle` | ✅ static شد |
| `waitlist.ts` | `./reservations` | ✅ static شد |

علتِ ریشه‌ایِ اصلی (چرخه‌ی `customer-insights ↔ no-show-model`) با انتقالِ
`RawFeatureInput` و `computeStaticScoreFromFeatures` به `ml-core.ts` (که هیچ
importی ندارد) شکسته شده بود.

**قفلِ رگرسیون:** `tests/no-dynamic-import-in-hot-path.test.mts` — دامنه‌اش از
۵ فایلِ مسیرِ ML به **کلِ `src/lib`** گسترش یافت، با کنترلِ مثبت (اثبات اینکه
خودِ الگو واقعاً چنین چیزی را می‌گیرد) و تستِ «اسکنر واقعاً فایل پیدا می‌کند»
تا قفل بی‌صدا توخالی نشود.

**تأییدِ زنده:** سرور با importهای static بالا آمد، `GET /restaurants` ۲۰۰،
`GET /restaurants/{slug}/availability` ۲۰۰ با دادهٔ واقعی (مسیری که از
`hours` عبور می‌کند)، `model-health` بدونِ توکن ۴۰۱ — و صفر خطای بارگذاریِ
ماژول در لاگ.


### ۲f) انحرافِ اسکیما بین CI و تولید — **ممیزی شد و دروازه گذاشته شد** (۲۰۲۶-۰۸-۲۰)

دو مسیرِ متفاوت اسکیما می‌سازند:

| | چطور ساخته می‌شود |
|---|---|
| CI | `prisma db push` از رویِ `schema.prisma` |
| تولید | `prisma migrate deploy` (0_init) + `prisma/apply-sql.sh` |

یعنی اگر کسی فیلدی به `schema.prisma` اضافه کند و مهاجرتِ SQL ننویسد،
`db push` آن را در CI می‌سازد و همه‌ی تست‌ها سبز می‌شوند — ولی تولید آن ستون
را ندارد و در زمانِ اجرا می‌شکند.

**نتیجه‌ی ممیزیِ وضعیتِ فعلی: صفر انحرافِ شکننده.** هر ۷۴۴ ستونی که Prisma
لازم دارد در شکلِ تولید موجود است.

پنجاه تفاوتِ *امضایی* دیده شد که تک‌تک بررسی و **بی‌خطر** تشخیص داده شدند:

- **~۳۵ ستونِ زمانی** — تولید `timestamptz` است، `db push` آن‌ها را `timestamp`
  می‌سازد. با آزمونِ round-tripِ واقعی (نوشتن و خواندنِ یک لحظه‌ی معلوم با
  Prisma روی هر دو شکل) ثابت شد نتیجه دقیقاً یکسان است.
- **~۱۵ ستونِ آرایه‌ای** — تولید `NOT NULL` است و `db push` nullable می‌سازد.
  تولید سخت‌گیرتر است و Prisma هرگز برای scalar list مقدارِ `NULL` نمی‌فرستد.

**دروازه:** `tools/check-schema-drift.sh` + jobِ `schema-drift` در CI. عمداً
فقط ستونِ *گم‌شده* را چک می‌کند (صفر مثبتِ کاذب)، نه امضای کامل.

⚠️ **`prisma migrate diff` برای این کار بی‌فایده است** — روی همین ریپو ۶۱۷ خط
خروجی می‌دهد که تقریباً همه‌اش آرایشی است (drop/recreate کردنِ FKها) و همیشه
`exit=2` برمی‌گرداند. دروازه‌ای که همیشه قرمز است، همیشه نادیده گرفته می‌شود.

⚠️ **آنچه هنوز قابلِ تأیید نیست:** خودِ دیتابیسِ *واقعیِ* تولید در دسترس نیست،
پس این بررسی «شکلِ تولید طبقِ مهاجرت‌ها» را می‌سنجد، نه آنچه واقعاً روی سرور
است. اگر کسی دستی روی دیتابیسِ تولید تغییری داده باشد، این دروازه نمی‌بیندش.

---

### ۲g) سانس‌های پس از نیمه‌شب رزروِ آنلاین ندارند — **باگ رفع شد، محدودیت باقی است** (۲۰۲۶-۰۸-۲۰)

**باگی که رفع شد.** `generateTimesFromHours` برای شیفتِ شبانه (مثلاً
`["20:00","01:00"]`) حلقه را تا `t = 1470` می‌برد و `fromMin` با `% 24` آن را
به `"00:00"`/`"00:30"` تا می‌کرد — بدونِ هیچ نشانه‌ای از اینکه به **روزِ بعد**
تعلق دارند.

چرا این فاجعه بود و نه یک ناهماهنگیِ کوچک: کلِ قراردادِ availability و رزرو
**date-keyed** است؛ مصرف‌کننده `zonedTimeToUtc(date, time)` صدا می‌زند. پس
`"00:00"` به نیمه‌شبِ *ابتدای* همان روز ترجمه می‌شد — حدودِ ۲۰ ساعت **پیش از**
بازشدنِ رستوران. و چون خروجی با `.sort()` رشته‌ای مرتب می‌شود، `"00:00"`
**اولین چیزی بود که مشتری می‌دید**.

نتیجه‌ی واقعی برای کاربر:
- رزرو برای امروز → خطای «زمانِ گذشته» روی سانسی که خودِ اپ پیشنهاد داده بود
- رزرو برای تاریخِ آینده → رزروی **۲۴ ساعت زودتر** از آنچه مهمان فکر می‌کرد

قابلِ‌دسترس بودن در تولید تأیید شد: `validateHours` در
`restaurant/hours/route.ts` فقط فرمتِ `HH:mm` را چک می‌کند و `close <= open` را
**رد نمی‌کند** — یعنی صاحبِ رستوران می‌تواند از پنل ساعتِ ۲۰:۰۰–۰۱:۰۰ ثبت کند.

**رفع:** سانسی که به روزِ تقویمیِ دیگری می‌افتد دیگر پیشنهاد نمی‌شود.
پیشنهادنکردنِ یک سانس بهتر از پیشنهادِ سانسی است که زمانِ اشتباه رزرو می‌کند.

**محدودیتِ باقی‌مانده (باز):** سانس‌های پس از نیمه‌شبِ رستوران‌های شبانه
**اصلاً آنلاین رزرو نمی‌شوند**. پشتیبانیِ درستشان یعنی حملِ «روز» در خودِ
قراردادِ سانس — `"HH:mm"` به‌تنهایی نمی‌تواند بینِ «۰۰:۳۰ِ امشب» و
«۰۰:۳۰ِ فردا شب» تفاوت بگذارد. این تغییری cross-cutting است (اپِ مشتری،
پنلِ بیزنس، بандلِ standalone، e2e) و عمداً به این PR اضافه نشد.

**پوششِ تست.** `lib/availability.ts` تا این تاریخ **هیچ تستی نداشت** — نه
مستقیم نه غیرمستقیم. حالا `tests/availability.integration.test.mts` (۱۲ تستِ
زنده روی Postgresِ واقعی) دارد. جهش‌آزمایی:

| جهش | چه شکست |
|---|---|
| بازگرداندنِ خودِ باگِ نیمه‌شب | ۲ تستِ شیفتِ شبانه |
| حذفِ چکِ میزهای ترکیبی | تستِ میزِ ثانویه |
| صفرکردنِ بافرِ سمتِ کاندید | تستِ «سانسی که وقتِ شروعِ رزروِ بعدی تمام می‌شود» |
| حذفِ فیلترِ رستوران در کوئریِ busy | ۳ تست |

⚠️ جهشِ سوم اول **گرفته نشد** — یعنی تستِ بافرِ اولیه‌ام توخالی بود (بلاک از
`blockBufferMinutes`ِ خودِ رزروِ موجود می‌آمد، نه از بافرِ سمتِ کاندید). تستِ
جداگانه‌ای اضافه شد تا نیمه‌ی پوشش‌نداشته را هم بگیرد.

### ۲h) موتورِ پیشنهادِ قیمت اعدادی گزارش می‌کرد که اندازه نگرفته بود — **رفع شد** (۲۰۲۶-۰۸-۲۰)

`lib/pricing.ts` هیچ تستی نداشت، در حالی که خروجی‌اش مستقیم به رستوران‌دار
نمایش داده می‌شود و او رویش تصمیمِ **قیمت** می‌گیرد. با اجرای زنده‌ی خودِ تابع
(اسکریپتِ probe، نه خواندنِ کد) چهار موردِ هم‌خانواده پیدا شد — همه از جنسِ
«ادعایی که از `heat` قابلِ اشتقاق نبود»، یعنی همان چیزی که
`docs/ML_CONTRACT.md` منع می‌کند:

| # | باگ | خروجیِ واقعیِ پیش از رفع |
|---|---|---|
| ۱ | `peakHours` محاسبه و **دور ریخته** می‌شد؛ بازه همیشه هاردکدِ ۱۹:۰۰–۲۳:۰۰ بود | کافه‌ای با اوجِ ساعتِ ۱۳ و *صفر* رزروِ شبانه: «پنجشنبه و جمعه **شب‌ها** شلوغ‌ترین زمانِ شماست» + قاعده‌ی قیمت روی ۱۹:۰۰–۲۳:۰۰ |
| ۲ | `occupancy_pct` اندازه‌گیری نبود: قاعده‌ی وسطِ هفته عددِ ثابتِ **۵۵**، قاعده‌ی آخرِ هفته `min(99, max(60, occ ǀǀ 85))` + یک تقسیمِ اضافه | رستورانی که *هر* خانه‌ی آخرِ هفته‌اش برابرِ بیشینه بود (۱۰۰٪) عددِ **۶۰** می‌گرفت؛ چون UI برچسبِ «شلوغ‌ترین» را از ۷۰ می‌زند، شلوغ‌ترین حالتِ ممکن بدونِ برچسب دیده می‌شد در حالی که متنِ کنارش می‌گفت «شلوغ‌ترین زمانِ شماست» |
| ۳ | قاعده‌ی ناهار وقتی **هیچ** داده‌ی ناهاری نبود هم شلیک می‌کرد (`0 < maxCount*0.4` همیشه درست) | رستورانِ فقط-شام: «این بازه خلوت است» با «۰٪» + پیشنهادِ نصف‌کردنِ حداقلِ مبلغ |
| ۴ | با **یک** رزرو در ۹۰ روز، `maxCount=1` و همان رزرو ≥ ۰٫۶ | «جمعه شب‌ها شلوغ‌ترین زمانِ شماست» با ۹۹٪ — الگو از n=۱ |

**رفع:** بازه از ساعت‌های داغِ *واقعی* مشتق می‌شود؛ درصد یک اندازه‌گیریِ
بی‌کف‌وسقف است (خانه‌های خالیِ بازه در مخرج می‌آیند تا تورمِ کاذب ندهد)؛
زیرِ `MIN_OBSERVATIONS = 20` مشاهده هیچ پیشنهادی ساخته نمی‌شود؛ و قاعده‌ی
ناهار دستِ‌کم یک رزروِ ناهارِ مشاهده‌شده می‌خواهد.

**محدودیتِ باقی‌مانده (باز، آگاهانه):** رستورانی که ناهار سرو می‌کند و در ۹۰
روز *صفر* رزروِ ناهار دارد، بهترین نامزدِ آن تخفیف است و حالا پیشنهاد
نمی‌گیرد. از دیدِ `heat` این حالت با «اصلاً ناهار سرو نمی‌کند» عیناً یکسان
است؛ تفکیکشان به ساعاتِ کاریِ رستوران (`hours.ts`) نیاز دارد که به این مسیر
وصل نیست. ادعا نکردن را به ادعای غلط ترجیح دادیم.

**نامِ فیلد:** `occupancy_pct` عمداً دست‌نخورده ماند (قراردادِ API + بسته‌ی
آفلاینِ `demo-mvp/`)، ولی «اشغال» نیست — ظرفیت/صندلی هیچ‌جا در محاسبه نیست.
برچسبِ UI به «شلوغیِ نسبی» اصلاح شد تا آنچه کاربر می‌خواند با آنچه اندازه
گرفته‌ایم یکی باشد.

**پوششِ تست.** `tests/pricing.test.mts` — ۱۴ تستِ واحد (تابع خالص است).
جهش‌آزمایی، با تأییدِ اعمالِ هر جهش پیش از اجرا:

| جهش | چه شکست |
|---|---|
| بازگرداندنِ کلِ منطقِ اصلی | ۱۱ از ۱۴ |
| حذفِ دروازه‌ی `MIN_OBSERVATIONS` | ۱ |
| حذفِ سقفِ ۲۳:۵۹ (تولیدِ «24:00»ِ نامعتبر) | ۱ |
| مخرجِ درصد فقط روی خانه‌های موجود | ۱ |
| حذفِ شرطِ «ناهار واقعاً مشاهده شده» | ۱ |
| بازگرداندنِ بازه‌ی هاردکدِ ۱۹:۰۰–۲۳:۰۰ | ۲ |

⚠️ سه تستی که با بازگرداندنِ منطقِ اصلی هم سبز ماندند عمداً نگه داشته شدند —
آن‌ها ناوردا (invariant) هستند نه قفلِ باگ: «همه‌ی مبالغ مضربِ ۵۰هزارند»،
«ناهارِ شلوغ تخفیف نمی‌گیرد»، «ناهارِ سرو‌شده‌ی خلوت تخفیف می‌گیرد».

### ۲i) شماره‌ی تلفنِ فیکسچرها زمان‌محور بود — **flake رفع شد** (۲۰۲۶-۰۸-۲۰)

**چطور پیدا شد:** CIِ PR #49 قرمز شد در حالی که دو اجرای کاملِ محلی ۶۱۷/۶۱۷
سبز بودند. لاگِ job 96516341521:

```
duplicate key value violates unique constraint "users_phone_key"
DETAIL: Key (phone)=(09386548246) already exists.
```

**ریشه:** `feature-parity.integration.test.mts` و
`temporal-leakage.integration.test.mts` هر دو شماره را با عبارتِ
**بایت‌به‌بایت یکسانِ** `` `0938${String(Date.now()).slice(-7)}` `` می‌ساختند.
رانرِ ما همه‌ی فایل‌ها را در یک process اجرا می‌کند، پس دو `before` می‌توانند
در یک میلی‌ثانیه بیفتند. آن‌وقت hook می‌افتد و `node:test` **کلِ سوئیت** را
cancel می‌کند — ۶۱۷ تست از یک برخوردِ تصادفی، بدونِ هیچ ربطی به کدِ تولید.

این تستِ ضعیف نبود؛ یک بمبِ ساعتیِ احتمالاتی بود که هر PRی را تصادفی قرمز
می‌کرد و هر بار به «دوباره اجرا کن» ختم می‌شد.

**رفع:** `tests/_phone.helper.mts` — یک تولیدکننده‌ی مشترک با `randomInt`
به‌جای زمان، و پیشوندِ اجباریِ متفاوت برای هر فایل (۰۹۳۸ برایِ feature-parity،
۰۹۳۶ برایِ temporal-leakage، ۰۹۳۷ برایِ prediction-ledger). چون تولیدکننده
یکی است، دیگر نمی‌شود یک نسخه را عوض کرد و بقیه عقب بمانند.

**اثباتِ رفع** (اجرای واقعی، نه استدلال):

```
فرمولِ قدیمی، دو صدا در یک لحظه: 09386793648 09386793648 → برخورد؟ true
فرمولِ جدید (0938 vs 0936):      09389785293 09361055557 → برخورد؟ false
```

**باقی‌مانده (بررسی شد، خطرِ فعلی ندارد):** سه فایلِ دیگر هنوز
`Date.now().toString(36)` را برایِ شماره به‌کار می‌برند —
`guest-profile-rollup` (`+98916`/`+98917`)، `menu-crud` (`+98912`) و
`customer-insight-spend-semantics` (`+9891`+…). این‌ها **نمی‌توانند** با هم
برخورد کنند چون پیشوند و حتی طولِ نهایی‌شان فرق دارد (۱۳ در برابرِ ۱۲
کاراکتر) — بررسی شد، عوض نشد تا دیفِ PR بی‌دلیل بزرگ نشود. ولی هر فایلِ
تستِ **جدید** باید از `fixturePhone` استفاده کند، نه از کپیِ این الگو.

### ۲j) چهار cronِ چرخه‌ی حیات هیچ پوششی نداشتند + یک تابعِ تله — **رفع شد** (۲۰۲۶-۰۸-۲۰)

`tests/lifecycle.test.mts` فقط جدولِ **خالصِ** `canTransition` را می‌سنجید.
چهار تابعی که واقعاً رزروها را به وضعیتِ پایانی می‌برند — و همگی از
`POST /api/v1/maintenance/lifecycle` هر چند دقیقه اجرا می‌شوند — **صفر
پوشش** داشتند:

| تابع | اگر بی‌صدا بشکند |
|---|---|
| `expireStaleHolds` | هولدِ منقضی، میز را در آن سانس برای همیشه اشغال نگه می‌دارد |
| `autoMarkRunningLate` | مهمانِ دیرکرده هرگز وارد مسیرِ عدمِ حضور نمی‌شود |
| `autoMarkNoShow` | no_show ثبت نمی‌شود → مدلِ no-show و آمارِ CRM روی دادهٔ ناقص کار می‌کنند |
| `autoComplete` | مهمانِ نشسته completed نمی‌شود → اقتصاد/وفاداری هرگز شلیک نمی‌کند |

**تله‌ی کشف‌شده — `markLateNoShows` حذف شد.** صفر صداکننده داشت (grep در
کلِ ریپو: فقط تعریفِ خودش، یک re-export، و بандлـهای build). ولی کدِ مرده‌ی
بی‌ضرر نبود: همان کار را **متفاوت** انجام می‌داد. `autoMarkNoShow` (مسیرِ
واقعی) فقط `running_late` را no_show می‌کند، ولی این یکی `confirmed` و
`auto_confirmed` را هم مستقیم no_show می‌کرد. هر دو انتقال طبقِ `TRANSITIONS`
مجازند، پس اگر کسی روزی این را — به‌گمانِ هم‌ارزی — به cron وصل می‌کرد،
مهمان **بدونِ عبور از `running_late`** غایب ثبت می‌شد: بدونِ هیچ اعلانِ «شما
دیر کرده‌اید» و با دور زدنِ طراحیِ دومرحله‌ایِ مهلتِ تأخیر. همان الگویِ
`redeemCouponAtomic`/`redeemCoupon` در PR #46.

**پوششِ تست.** `tests/lifecycle-cron.integration.test.mts` — ۱۵ تستِ زنده
روی Postgresِ واقعی. جهش‌آزمایی، با تأییدِ اعمالِ هر جهش پیش از اجرا:

| جهش | چه شکست |
|---|---|
| `autoMarkNoShow` مستقیم از `confirmed` (همان تله) | ۱ |
| هاردکدکردنِ مهلتِ تأخیر روی ۱۵ (نادیده‌گرفتنِ `lateGraceMinutes`) | ۱ |
| معیارِ `autoComplete` از `slotEnd` به `slotStart` | ۱ |
| جاافتادنِ `preparing` از `autoMarkRunningLate` | ۱ |
| نادیده‌گرفتنِ `holdExpiresAt` در `expireStaleHolds` | ۱ |
| حذفِ باطل‌سازیِ کش — فقط از یکی از دو سایت | **۰ (زنده ماند)** |
| حذفِ باطل‌سازیِ کش — از **هر دو** سایت هم‌زمان | ۱ |

⚠️ **جهش‌آزمایی ادعای اولِ من را اصلاح کرد.** وقتی حذفِ باطل‌سازی از
`expireStaleHolds` هیچ تستی را نینداخت، برداشتِ اولم این بود که تستِ کش
پوچ است. نبود: این تضمین را **دو لایه‌ی افزونه** می‌دهند (یکی در
`transitionReservation`، یکی در خودِ `expireStaleHolds` — و افزونگی در
کامنتِ همان‌جا از قبل توضیح داده شده بود). هر جهشِ تکی را لایه‌ی دیگر جبران
می‌کند؛ حذفِ هم‌زمانِ هر دو تست را می‌اندازد. درس: وقتی یک جهش زنده می‌ماند،
اول باید پرسید «آیا مسیرِ دومی هست؟» — نه اینکه فوراً تست را ضعیف اعلام کرد
یا برای گرفتنِ آن یک خط، تست را به خطِ خاصی گره زد. تست عمداً *نتیجه* را
قفل می‌کند، نه پیاده‌سازی را.

### ۲k) نیمه‌ی دیتابیسیِ اقتصادِ مشتری پوشش نداشت — **رفع شد** (۲۰۲۶-۰۸-۲۰)

`tests/economy.test.mts` چهار تابعِ **خالص** را کامل می‌سنجید (`applyTimeDecayedScore`،
`applyStrikeDecay`، `computeReputationTier`، `computeEventScore`) — ولی نیمه‌ای که
واقعاً می‌نویسد هیچ پوششی نداشت: `processReservationEconomyEvent` (از **هر**
تغییرِ وضعیتِ رزرو شلیک می‌شود)، `applyReliabilityEventToUserTx`،
`applyReliabilityEventToShadowTx`، `grantEconomyRewardTx` و
`getCustomerEconomyProfile`.

پایِ ارزِ داخلیِ مشتری وسط است: اگر idempotency بشکند، یک retry ساده XP و
سکه را دوباره واریز می‌کند.

**سه ادعای صریحِ خودِ فایل که تا امروز قفل نشده بودند** و حالا تست دارند:

1. «idempotency با `UNIQUE(reservation_id, kind)` در خودِ DB تضمین می‌شه» —
   با پنج فراخوانیِ **موازی** سنجیده شد، نه فقط دو فراخوانیِ سریالی (که یک
   `SELECT`-then-`INSERT`ِ معیوب هم از آن رد می‌شد).
2. «منبعِ حقیقت ledgerه، فیلدهایِ پروفایل فقط cacheاند» — حالا تست تأیید
   می‌کند `xpTotal` دقیقاً با مبلغِ ردیفِ دفتر می‌خواند.
3. لنگرِ زمانیِ `2000-01-01` — کامنتِ کد می‌گفت «زنده تست شد: بدونِ این فیکس،
   اولین completed یه کاربرِ تازه امتیازش رو عوض نمی‌کرد». آن ادعا درست بود
   ولی هیچ‌جا قفل نشده بود؛ حالا هست.

**پوششِ تست.** `tests/economy-ledger.integration.test.mts` — ۱۵ تستِ زنده.
جهش‌آزمایی، با تأییدِ اعمالِ هر جهش پیش از اجرا — **۷ از ۷ گرفته شد**:

| جهش | چه شکست |
|---|---|
| حذفِ `ON CONFLICT` از دفترِ سیگنالِ اعتبار | ۱ |
| لنگرِ زمانی به «الان» (اولین رویداد بی‌اثر می‌شود) | ۲ |
| نادیده‌گرفتنِ `CancellationPolicy` رستوران (همیشه ۲۴ ساعت) | ۱ |
| امتیازدادن به لغوِ رستوران/staff انگار لغوِ مشتری بوده | ۱ |
| حذفِ `ON CONFLICT` از واریزِ XP | ۱ |
| دادنِ XP به `no_show` (حذفِ شرطِ `label`) | ۴ |
| ثبت‌نکردنِ strike | ۲ |

**رفتاری که عمداً *ثبت* شد، نه اصلاح:** `grantEconomyRewardTx` با
`reservationId = NULL` (پاداشِ referral/mission) idempotent **نیست** — چون
`NULL`ها در Postgres در قیدِ یکتایی با هم برخورد نمی‌کنند. کامنتِ خودِ تابع
این را می‌گوید و مسئولیت را به caller می‌دهد. تست همان را تثبیت می‌کند تا
اگر روزی عوض شد عمدی باشد نه تصادفی، و تا صداکننده‌ی بعدی بداند خودش باید
گارد بگذارد.

**فرضیه‌ای که رد شد:** تایپِ `Actor` در `lifecycle.ts` مقدارها را
`'system' | 'customer' | 'staff:{id}' | 'cron'` مستند می‌کند — یعنی
`'customer'` بدونِ کولون — در حالی که `computeEventScore` روی
`actor.startsWith('customer:')` چک می‌کند. اگر مسیرِ واقعی رشته‌ی بدونِ کولون
می‌فرستاد، **کلِ جریمه‌ی لغوِ دیرهنگام مرده بود**. بررسی شد: مسیرِ واقعی
(`reservations/[code]/cancel/route.ts`) `` `customer:${auth.sub}` `` می‌فرستد.
پس باگ نیست — فقط کامنتِ تایپ کهنه است.

### ۲l) `expireOffers` گاردِ همزمانی نداشت — **باگ رفع شد** (۲۰۲۶-۰۸-۲۰)

`declineOffer` و `leaveWaitlist` هر دو عمداً `updateMany` با گاردِ
`status: 'offered'` دارند و کامنتشان دقیقاً همین رقابت را نام می‌برد:
«گارد status را داخل updateMany می‌گذاریم (نه فقط چک بیرونی) تا اگر همزمان
cron همین آفر را expire کند … فقط یکی واقعاً اعمال شود». اما **خودِ cron
(`expireOffers`) آن گارد را نداشت** — `update`ِ بی‌قیدوشرط رویِ id. یعنی
نیمه‌ی دومِ همان رقابت باز مانده بود.

**اثبات با اجرای زنده** (نه استدلال). `expireOffers` فهرست را یک‌جا می‌خواند و
بینِ هر تکرارِ حلقه `notifyEntry` و `promoteNext` را await می‌کند — پنجره‌ای
چندده‌میلی‌ثانیه‌ای و کاملاً واقعی. سناریو: مشتری وسطِ حلقه آفرش را رد می‌کند.

| پیامد | پیش از رفع | پس از رفع |
|---|---|---|
| وضعیتِ نهاییِ ورودی | `no_response` (تصمیمِ مشتری بازنویسی شد) | `declined` |
| میزِ آفرشده به نفرِ بعدی | در ۱ از ۶ دور `state='free'` شد | ۰ از ۶ |

پیامدِ دوم جدی‌تر است: یک ورودی با **آفرِ زنده** که میزش `free` علامت خورده،
یعنی `promoteNext` بعدی می‌تواند همان میزِ فیزیکی را به نفرِ دوم هم آفر
بدهد — دقیقاً همان کلاسِ باگِ H8 که چند خط بالاتر، در `promoteNext`، با
ادعایِ اتمیکِ میز بسته شده بود.

**رفع:** همان الگویِ `updateMany` + گاردِ status، و شمردن/اعلان/ارتقا فقط
وقتی `count === 1`.

**چرا گاردِ status کافی است** (و چکِ جداگانه‌ی مالکیتِ میز لازم نیست): میز فقط
وقتی `free` می‌شود که همین ورودی decline/leave/expire شود، و هر سه وضعیتش را
عوض می‌کنند. پس «هنوز offered است» ⟹ «میز هنوز مالِ همین ورودی است».

**پوششِ تست.** `tests/waitlist-flow.integration.test.mts` — ۱۸ تستِ زنده روی
هسته‌ی نویسنده (`joinWaitlist`، `promoteNext`، `declineOffer`،
`leaveWaitlist`، `expireOffers`)، که تا امروز هیچ‌کدام پوشش نداشتند؛
`tests/waitlist.test.mts` فقط کمکی‌هایِ خالص را می‌سنجید.

جهش‌آزمایی، با تأییدِ اعمالِ هر جهش پیش از اجرا — **۶ از ۶**:

| جهش | چه شکست |
|---|---|
| بازگرداندنِ دقیقِ خودِ باگ (`update`ِ بی‌قیدوشرط) | ۱ |
| حذفِ ادعایِ اتمیکِ میز در `promoteNext` (باگِ H8) | ۱ |
| حذفِ `priority` از ترتیبِ `promoteNext` | ۱ |
| حذفِ گاردِ ظرفیتِ میز | ۱ |
| آزادنکردنِ میز در `declineOffer` | ۱ |
| ذخیره‌ی توکنِ خامِ مهمان به‌جای hash | ۱ |

⚠️ **جهشِ سوم اول زنده ماند و گپی در خودِ تستِ من را لو داد:** تستِ اولویتم
فقط `getPosition` را می‌سنجید، نه انتخابِ نفرِ بعدی در `promoteNext`. یعنی
`promoteNext` می‌توانست VIP را نادیده بگیرد و هیچ تستی نمی‌گرفتش — در حالی
که کلِ ارزشِ `tierToPriority` همان‌جاست. تستِ جداگانه اضافه شد و حالا گرفته
می‌شود.

**یافته‌ی ثبت‌شده‌ی رفع‌نشده — پنجره‌ی مشابه در `acceptOffer`:** آن هم پس از
`createReservation` (که کند است) وضعیت را بی‌گارد می‌نویسد. اگر آفر دقیقاً
در همان فاصله منقضی شود، cron ورودی را `no_response` می‌کند و میز را آزاد،
و بعد `acceptOffer` آن را `accepted` می‌نویسد. عمداً در این PR رفع نشد چون
برخلافِ `expireOffers` یک رفعِ مکانیکی نیست: در آن نقطه رزرو **از قبل ساخته
شده**، پس «گارد بگذار و رد شو» یعنی رزروی بی‌صاحب می‌ماند — این یک تصمیمِ
محصولی می‌خواهد. آسیبش هم محدودتر است: قیدِ `EXCLUDE` دیتابیس جلویِ رزروِ
هم‌پوشانِ واقعی را می‌گیرد.

### ۲m) دو باگ در فروشگاهِ جایزه (مسیرِ پولِ مشتری) — **رفع شد** (۲۰۲۶-۰۸-۲۰)

`lib/rewards.ts` هیچ تستی نداشت، در حالی که سرآیندِ `redeemRewardItem` —
دقیقاً مثلِ `coupons.ts` و `sms-balance.ts` — ادعا می‌کند «زنده تست‌شده …
TOCTOU-safe». باز هم ادعای عملکردی بدونِ قفل. و این مسیرِ پولِ واقعی است:
سکه‌ی کاربر خرج و کوپن/گیفت‌کارتِ قابلِ‌خرج تولید می‌شود.

**باگ ۱ — کاربر پول می‌داد و چیزی نمی‌گرفت.** شرط `item.kind ===
'coupon_grant' && item.restaurantId` بود: آیتمِ `coupon_grant`ِ بدونِ رستوران
بی‌صدا از کنارِ ساختِ کوپن رد می‌شد، در حالی که سکه **قبلاً کسر شده بود**.
مشاهده‌ی زنده: ۵۰ سکه رفت، `result_coupon_id` برابرِ `null`، **بدونِ هیچ
خطایی**. برخلافِ `priority_boost`/`free_item`/`event_access` که عمداً فقط ردِ
redemption ثبت می‌کنند (و این در کد مستند است)، `coupon_grant` طبقِ تعریفش
باید کوپن بسازد — پس نبودِ رستوران دیتای خراب است، نه حالتِ مجاز. حالا صریح
رد می‌شود تا تراکنش برگردد و سکه دست‌نخورده بماند.

**باگ ۲ — برخوردِ کدِ کوپن زیرِ بار.** کد از `Date.now().toString(36)` ساخته
می‌شد؛ دو ردیم در یک میلی‌ثانیه کدِ یکسان می‌ساختند و
`@@unique([restaurantId, code])` یکی را می‌شکست. اثباتِ زنده: از **۵ ردیمِ
موازیِ یک آیتم، ۱ تا** با خطای `tx.coupon.create()` افتاد. پولِ کاربر
برنمی‌گشت (تراکنش rollback می‌شد) ولی به‌جای جایزه یک خطای نامفهوم می‌گرفت.
پس از رفع (آنتروپی از `randomUUID`): **۵ از ۵ موفق**. کدِ گیفت‌کارت هم که
`@unique` است و فقط ۴ کاراکترِ تصادفی داشت (≈۱٫۷ میلیون حالت) به همان روش
تقویت شد.

**پوششِ تست.** `tests/rewards.integration.test.mts` — ۱۶ تستِ زنده.
جهش‌آزمایی، با تأییدِ اعمالِ هر جهش پیش از اجرا — **۷ از ۷**:

| جهش | چه شکست |
|---|---|
| بازگرداندنِ باگِ «coupon_grant بدونِ رستوران» | ۱ |
| بازگرداندنِ کدِ زمان‌محورِ کوپن | ۱ |
| حذفِ گاردِ موجودیِ انبار | ۱ |
| حذفِ گاردِ موجودیِ سکه (TOCTOU) | ۲ |
| حذفِ قفلِ سطحِ اعتبار در ردیم | ۱ |
| اجازه‌ی ردیمِ آیتمِ غیرفعال | ۱ |
| `unlocked: true`ِ همیشگی در فهرست | ۱ |

**فرضیه‌ای که رد شد — هزینه‌ی منفی.** `costCoins` منفی باعث می‌شد
`wallet_balance - (-n)` موجودی را *زیاد* کند و گاردِ `>= -n` هم همیشه درست
باشد — همان الگویی که در `consumeSms` (PR #47) بستیم. ولی اینجا **قابلِ‌دسترس
نیست**: هیچ مسیرِ کدی آیتمِ فروشگاه نمی‌سازد (نه routeِ ادمین، نه seed)؛
ردیف‌ها فقط با SQLِ دستی وارد می‌شوند. پس گاردِ تدافعی اضافه **نشد** تا با
باگِ واقعی اشتباه گرفته نشود. اگر روزی CRUDِ ادمین برایِ فروشگاه اضافه شد،
اعتبارسنجیِ `costCoins > 0` باید همان‌جا بیاید.

**بررسی‌شده و سالم:** `claimMission` گاردِ اتمیکِ درست دارد
(`UPDATE … WHERE completed_at IS NOT NULL AND claimed_at IS NULL`) — دقیقاً
همان چیزی که کامنتِ `grantEconomyRewardTx` در `economy.ts` از صداکننده
انتظار داشت (§2k). این ادعا راستی‌آزمایی شد، نه فرض.

### ۲n) دروازه‌ی جداسازیِ تنانت تست نداشت + یک باگِ ۵۰۰ — **رفع شد** (۲۰۲۶-۰۸-۲۰)

**گپِ اصلی.** `tests/tenant-isolation.integration.test.mts` فقط کوئری‌هایِ
**خامِ Prisma** را می‌سنجید — یعنی «اگر درست با `restaurantId` مقید کنی، چیزی
نشت نمی‌کند». ولی خودِ تصمیمِ **«کدام `restaurantId` به تو تعلق دارد»** —
`resolveStaffRestaurant` — هیچ تستی نداشت.

این تفکیک مهم است: اگر آن تابع به کارمندِ تنانتِ A رستورانِ تنانتِ B را بدهد،
**همه‌ی** کوئری‌هایِ کاملاً درستِ زیرش هم نشت می‌کنند — و تستِ موجود همچنان
سبز می‌ماند، چون خودش `restaurantId` را دستی می‌دهد. این تابع دروازه‌ی هر
endpointِ رستوران است (`withRestaurantAuth` مستقیم صدایش می‌زند)، و طبقِ
CLAUDE.md جداسازیِ تنانت غیرقابلِ‌مذاکره است.

**باگی که تست در همان اولین اجرا گرفت.** هدرِ `X-Restaurant-Id` کاملاً
کلاینت‌کنترل است و مستقیم به یک ستونِ `uuid` داده می‌شد. مقدارِ **غیرUUID**
(یک slug، یا مقدارِ کهنه‌ی `localStorage`) باعثِ
`PrismaClientKnownRequestError: Error creating UUID` می‌شد؛ آن خطای خام
`instanceof ApiError` نیست، پس `errorResponse` آن را به **۵۰۰** تبدیل می‌کرد —
یعنی *همه‌ی* endpointهایِ رستوران برای آن کلاینت می‌مردند تا وقتی هدر را پاک
کند. نشتِ داده نیست، ولی اختلالِ کاملِ سرویس با ماشه‌ای بی‌اهمیت.

این دقیقاً **خلافِ نیتِ صریحِ خودِ کد** بود (کامنتِ سه خط پایین‌تر: «هدر
نامعتبر … → به fallback زیر می‌افتیم به‌جای خطا») — آن نیت فقط برایِ UUIDِ
*ناموجود* کار می‌کرد، نه برایِ رشته‌ی بدشکل. حالا شکلِ ورودی پیش از کوئری چک
می‌شود و هر دو حالت یکسان رفتار می‌کنند.

**پوششِ تست.** `tests/tenant-gate.integration.test.mts` — ۱۶ تستِ زنده.
جهش‌آزمایی، با تأییدِ اعمالِ هر جهش — **۶ از ۶**:

| جهش | چه شکست |
|---|---|
| بازگرداندنِ باگِ هدرِ بدشکل | ۱ |
| حذفِ چکِ تنانت در مسیرِ هدر (IDORِ متقاطع) | ۲ |
| حذفِ چکِ تنانت در مسیرِ کارمندِ قفل‌شده | ۱ |
| اجازه‌ی تعویضِ شعبه به کارمندِ قفل‌شده | ۳ |
| حذفِ `orderBy` شعبه‌ی پیش‌فرض | ۱ |
| حذفِ گاردِ `auth.kind !== 'staff'` | ۱ |

⚠️ **دو جهشِ آخر اول زنده ماندند و دو گپ در خودِ تست‌های من را لو دادند** —
سومین بارِ متوالی که جهش‌آزمایی تست‌های خودم را اصلاح می‌کند، نه کد را:

- *`orderBy`*: تستِ «۵ بار یک نتیجه» نمی‌توانست نبودش را ببیند، چون ترتیبِ
  درج با ترتیبِ `createdAt` یکی بود و Postgres اتفاقی همان ردیفِ درست را
  می‌داد. تستِ جدید عمداً شعبه‌ی قدیمی‌تر را **آخر** درج می‌کند.
- *گاردِ `kind`*: تستِ «مشتری رد می‌شود» یک `sub`ِ تصادفی می‌داد، پس بدونِ گارد
  هم `staff.findUnique` چیزی پیدا نمی‌کرد و باز `forbidden` می‌شد — سبز به
  دلیلِ اشتباه. تستِ جدید `sub`ِ یک کارمندِ **واقعی** را با `kind='customer'`
  می‌دهد: بدونِ گارد، `defaultRestaurantForTenant(undefined)` یک رستورانِ
  دلخواه برمی‌گرداند و یک مشتری دیتای پنلِ رستوران را می‌گیرد.

**رفتاری که عمداً *ثبت* شد، نه اصلاح.** `tenantId` مستقیم از توکن خوانده
می‌شود و هیچ‌جا چک نمی‌شود که این `staff` واقعاً عضوِ آن تنانت است. یعنی تنها
چیزی که مانعِ جعلِ تنانت می‌شود **امضایِ JWT** است، نه یک لایه‌ی دوم. امروز
کافی است (توکن امضاشده است)، ولی تک‌لایه بودنش باید آگاهانه باشد؛ تست همین
رفتار را تثبیت می‌کند تا اگر روزی عوض شد عمدی باشد.

**رفتارِ عمدیِ دیگری که تست ثبت کرد:** هدرِ متعلق به تنانتِ دیگر یا شناسه‌ی
ناموجود، بی‌صدا به شعبه‌ی پیش‌فرضِ خودِ تنانت برمی‌گردد (نه خطا) — انتخابِ
مستندِ خودِ کد برایِ «شعبه‌ی حذف‌شده یا انتخابِ کهنه‌ی کلاینت».

### ۲o) اسکنِ تقلب ساعتِ ریکاوریِ مشتری را ریست می‌کرد — **باگ رفع شد** (۲۰۲۶-۰۸-۲۰)

`lib/fraud.ts` هیچ تستی نداشت، در حالی که سرآیندش ادعا می‌کند «همه‌ی کوئری‌ها
روی PostgreSQL واقعی تست شده‌اند». پیامدش مستقیم رویِ مشتریِ واقعی است: خطای
مثبت یعنی سخت‌ترشدنِ قوانینِ کنسلیِ یک مشتریِ بی‌گناه در **کلِ پلتفرم**
(`CustomerEconomyProfile` سراسری/per-User است، نه per-restaurant).

**باگِ متقاطع‌ماژولی.** `flagUserForAbuse` علاوه بر `hasActiveAbuseFlag`،
فیلدِ `lastViolationAt` را هم به «الان» می‌برد. ولی آن فیلد مالِ این ماژول
نیست — `economy.ts` با آن `applyStrikeDecay` را حساب می‌کند، با معنایِ
مستندِ: «هر ۹۰ روزِ **بدونِ نقضِ جدید**، یک strike کم می‌شود».

این اسکن نقضِ جدیدی نمی‌بیند؛ همان رزروهای قدیمی را دوباره می‌بیند (پنجره‌ی
`detectHighNoShow` ۹۰ روزه است). پس هر اجرای cron مهرِ زمانی را جلو می‌برد.

**بازتولیدِ زنده:**

| | پیش از رفع | پس از رفع |
|---|---|---|
| آخرین نقض (ورودی: ۱۰۰ روز پیش) | به **امروز** پرید | ۱۰۰ روز پیش ✅ |
| strike پس از decay (ورودی: ۲) | برگشت به **۲** | ۱ ✅ |

چون رزروهای قدیمی تا ۹۰ روز در پنجره می‌مانند، دوره‌ی ریکاوری عملاً تا **دو
برابر (۱۸۰ روز)** کش می‌آمد. و چون `computeReputationTier` برایِ `platinum`
شرطِ `strikeCount === 0` دارد، مشتری بی‌صدا از بالاترین سطح محروم می‌ماند.

**رفع:** این ماژول دیگر به `lastViolationAt` دست نمی‌زند. فلگِ سوءاستفاده
مکانیزمِ ماندگاریِ خودش را دارد (`hasActiveAbuseFlag`، که عمداً هرگز خودکار
پاک نمی‌شود — فقط با `clearAbuseFlag`).

**پوششِ تست.** `tests/fraud.integration.test.mts` — ۱۴ تستِ زنده، با تمرکز بر
**خطای مثبت** (چون هزینه‌اش را مشتریِ بی‌گناه می‌دهد). جهش‌آزمایی — **۷ از ۷**:

| جهش | چه شکست |
|---|---|
| بازگرداندنِ ریستِ ساعتِ ریکاوری | ۱ |
| حذفِ حدِ نصابِ نمونه (`minReservations`) | ۱ |
| حذفِ آستانه‌ی نرخِ no-show | ۲ |
| فلگ‌زدنِ سیگنال‌های `medium` | ۱ |
| جابه‌جاییِ مرزِ `high` از ۸۰٪ به ۶۰٪ | ۲ |
| حذفِ قیدِ رستوران (نشتِ بین‌شعبه‌ای) | ۱ |
| واردکردنِ مهمانِ بی‌حساب به محاسبه | ۱ |

**یافته‌ی ثبت‌شده‌ی رفع‌نشده.** `redemption_velocity` در `USER_SCOPED_KINDS`
هست ولی `severity` آن **همیشه** `'medium'` است، و `applyAbuseFlags` فقط
`high` را فلگ می‌کند — یعنی آن شاخه هرگز اجرا نمی‌شود. دست نزدم چون تشخیصِ
اینکه «باید high شود» یا «باید از فهرست حذف شود» یک تصمیمِ محصولی است، نه
رفعِ مکانیکی؛ و سخت‌گیرترکردنِ خودکارِ یک تشخیص بدونِ داده‌ی واقعی دقیقاً
همان چیزی است که خطای مثبت می‌سازد.

### ۲p) `acceptOffer` — دو باگ، یکی از آن‌ها قابلیت را کاملاً از کار انداخته بود (۲۰۲۶-۰۸-۲۰)

در §2l این تابع را به‌عنوان «یافته‌ی ثبت‌شده‌ی رفع‌نشده» کنار گذاشته بودم با
استدلالِ «تصمیمِ محصولی می‌خواهد». آن ارزیابی **ناقص بود**: وقتی برایش تست
نوشتم، معلوم شد دو باگ دارد که یکی‌شان اصلاً تصمیمِ محصولی نمی‌خواست.

**باگ ۱ — تایم‌زون: این قابلیت در تولید کار نمی‌کرد.**

```ts
const dateStr = now.toISOString().slice(0, 10);   // تاریخِ UTC
const timeStr = now.toTimeString().slice(0, 5);   // ساعتِ محلیِ *سرور*
```

و `createReservation` هر دو را ساعتِ دیواریِ **تایم‌زونِ رستوران** تفسیر
می‌کند (`computeRanges` → `zonedTimeToUtc`). سه تایم‌زونِ متفاوت در یک جفت.

روی سرورِ UTC با رستورانِ تهران (UTC+03:30)، اسلات **۳٫۵ ساعت عقب‌تر** از
«الان» ساخته می‌شد و گاردِ `+start < now - 60_000` همیشه شلیک می‌کرد → **هر
پذیرشِ آفرِ لیستِ انتظار با «زمان رزرو در گذشته است» شکست می‌خورد**. یعنی کلِ
مسیرِ «مهمان آفر را قبول می‌کند» مرده بود. هیچ تستی این تابع را صدا نمی‌زد،
پس هیچ‌وقت دیده نشد.

رفع: `timeKeyInTz` (جفتِ `dateKeyInTz`) به `hours.ts` اضافه شد و هر دو از
تایم‌زونِ خودِ رستوران گرفته می‌شوند.

**باگ ۲ — ترتیبِ عملیات.** رزرو *اول* ساخته می‌شد و وضعیت *بعد* با
`update`ِ بی‌قیدوشرط نوشته می‌شد؛ و مسیرِ خطا میز را آزاد می‌کرد در حالی که
ورودی هنوز `offered` بود — همان نشتِ §2l. حالا **اول** ادعای اتمیک (گاردِ
`status`)، بعد ساختِ رزرو، و در صورتِ شکست بازگردانی به دقیقاً حالتِ قبل
(ورودی `offered`، میز `reserved`).

**پوششِ تست.** ۴ تستِ جدید در `waitlist-flow.integration.test.mts` (مجموع ۲۲).
جهش‌آزمایی **۵ از ۵**.

⚠️ **دو تصحیحِ صادقانه در ادعاهای خودم:**

۱. *شرطِ انقضا در ادعای اتمیک محافظِ مستقل نیست.* جهش‌آزمایی نشان داد حذفش
   هیچ تستی را نمی‌اندازد — چون چکِ بیرونیِ بالای تابع همان لحظه را می‌سنجد.
   چیزی که واقعاً رقابت با cron را می‌بندد گاردِ `status` است. کامنتِ کد
   اصلاح شد تا این را دقیق بگوید.

۲. *تستِ بازگردانی را جهش‌آزمایی لازم کرد.* جهشِ «حذفِ مسیرِ بازگردانی» اول
   زنده ماند چون هیچ تستی `createReservation` را پس از ادعای موفق به شکست
   نمی‌کشاند. با گروهِ بزرگ‌تر از `MAX_PARTY_ONLINE` اهرمِ قطعی ساخته شد.
   این چهارمین بارِ متوالی در این جلسه است که جهش‌آزمایی **تست‌های من** را
   اصلاح می‌کند، نه کد را.

### ۲q) بستنِ سه یافته‌ی «ثبت‌شده ولی رفع‌نشده» (۲۰۲۶-۰۸-۲۰)

سه موردی که در §2l/§2n/§2o به‌عنوان «تصمیمِ محصولی» یا «رفتارِ ثبت‌شده» کنار
گذاشته بودم، به‌درخواستِ صریحِ مالکِ محصول بازبینی و رفع شدند. بازبینی نشان
داد **هیچ‌کدام واقعاً تصمیمِ محصولی نبودند**:

**۱) `acceptOffer`** → §2p (PR جدا). دو باگ، یکی‌شان کلِ قابلیت را از کار
انداخته بود.

**۲) `redemption_velocity` — ناسازگاری بود، نه طراحی.** این تنها detectorی
بود که `severity` را **هاردکد** روی `'medium'` می‌گذاشت. چون
`applyAbuseFlags` فقط `'high'` را فلگ می‌کند، حضورش در `USER_SCOPED_KINDS`
یک **شاخه‌ی مرده** بود.

هر چهار detectorِ دیگرِ همان فایل قاعده‌ی یکسانی دارند:

| detector | قاعده‌ی `high` |
|---|---|
| `coupon_multi_account` | `>= minAccounts * 2` |
| `rapid_book_cancel` | `>= minRapidCancels * 2` |
| `referral_farming` | `>= minCompleted * 2` |
| `high_no_show` | `pct >= 80` |
| ~~`redemption_velocity`~~ | ~~هاردکدِ `medium`~~ → `>= maxPerDay * 2` |

با پیش‌فرضِ `maxPerDay = 5`، آستانه‌ی تشخیص «بیش از ۵» است و `high` از «۱۰ یا
بیشتر» شروع می‌شود — دقیقاً همان نسبتِ خواهرهایش. **آستانه از قاعده‌ی موجودِ
خودِ فایل آمد، نه از حدسِ من** — این تفاوتِ مهمی است، چون سخت‌گیرترکردنِ
خودخوانده‌ی یک تشخیصِ سوءاستفاده همان چیزی است که خطای مثبت می‌سازد.

**۳) `tenantId` — دو وابستگیِ تک‌لایه‌ای بسته شد.**

- `auth.tenantId` مستقیم از توکن پذیرفته می‌شد و هیچ‌جا چک نمی‌شد که این
  کارمند واقعاً عضوِ همان تنانت است. تنها مانعِ جعل، امضایِ JWT بود. حالا
  عضویت با ردیفِ واقعیِ `staff` تطبیق داده می‌شود — **همان کوئری**، فقط دو
  ستونِ بیشتر در `select`، بدونِ رفت‌وبرگشتِ اضافه به دیتابیس.
- **کارمندِ غیرفعال (اخراج‌شده):** مدلِ `Staff` می‌گوید «توکنِ refreshش رد
  می‌شود»، ولی یک `access`ِ منقضی‌نشده (تا ۱۵ دقیقه) هنوز کار می‌کرد. حالا
  اخراج بلافاصله اثر می‌کند.

⚠️ **تستِ §2n که رفتارِ قدیمی را ثبت می‌کرد، عمداً معکوس شد.** آن تست
می‌گفت «tenantIdِ توکن بدونِ چک اعتماد می‌شود». حالا خلافش را می‌سنجد. ثبتِ
یک رفتار به‌معنایِ درست‌بودنش نیست — فقط یعنی آگاهانه است؛ و وقتی مالکِ
محصول تصمیم گرفت که نباید باشد، تست هم باید همراهش عوض شود.

**جهش‌آزمایی:** `redemption_velocity` ۳ از ۳، گاردهای تنانت ۲ از ۲.

### ۲r) `/api/metrics` بدونِ `METRICS_TOKEN` عمومی بود — **رفع شد** (۲۰۲۶-۰۸-۲۱)

در جمع‌بندی‌های قبلی این را در کنارِ `ALLOWED_ORIGINS` به‌عنوان «پیکربندیِ
لانچ، نه کد» گذاشته بودم. بررسیِ دقیق‌تر نشان داد این دو **هم‌رفتار نیستند**:

| متغیر | وقتی ست نشده | |
|---|---|---|
| `ALLOWED_ORIGINS` | در production **fail-fast** (throw در `middleware.ts`) | ✅ درست |
| `METRICS_TOKEN` | گارد کاملاً **skip** می‌شد → endpoint عمومی | ❌ fail-open |

گارد شرطی بود: `if (process.env.METRICS_TOKEN) { …چک… }`. نبودِ متغیر یعنی
هیچ چکی. و middleware هم جلویش را نمی‌گیرد — چکِ Origin فقط روی متدهای
تغییردهنده اجرا می‌شود و این یک `GET` است.

**چه چیزی لو می‌رفت:** خروجیِ Prometheus نامِ همه‌ی routeها، تعداد و نرخِ خطای
هرکدام، طولِ صف‌ها، شمارِ رستوران‌ها و متریک‌های مدل را دارد — نقشه‌ی نسبتاً
کاملی از ساختار و بارِ داخلیِ سامانه.

**رفع:**
- در production، نبودِ توکن یعنی endpoint **۵۰۳** می‌دهد با پیامی که به
  اپراتور می‌گوید چه چیزی کم است و کجا بگذاردش. در توسعه/تست باز می‌ماند.
- مقایسه‌ی توکن **constant-time** شد (`timingSafeEqual`) — `!==` رشته‌ای
  زودهنگام خارج می‌شود و طولِ پیشوندِ درست را لو می‌دهد. همان قاعده‌ای که
  برای توکنِ مهمانِ لیستِ انتظار (`tokensEqual`) رعایت شده بود.
- `.trim()` روی مقدار، تا یک مقدارِ فقط-فاصله در `.env` به‌عنوانِ «توکنِ
  معتبر» تفسیر نشود و همه چیز را با توکنِ خالی باز نکند.

**چرا ۵۰۳ و نه throwِ سراسری مثلِ `ALLOWED_ORIGINS`:** نبودِ آن متغیر کلِ
ترافیکِ کاربر را بی‌صدا می‌شکند، پس متوقف‌کردنِ برنامه بجاست. ولی
`METRICS_TOKEN` فقط به مانیتورینگ مربوط است — قطع‌کردنِ کلِ API به‌خاطرِ یک
متغیرِ مانیتورینگ از خودِ نشتی بدتر است.

**پوششِ تست.** `tests/metrics-endpoint.test.mts` — ۹ تستِ خالص (بدونِ DB).
جهش‌آزمایی **۴ از ۴**: بازگرداندنِ خودِ باگ، حذفِ `trim`، تبدیلِ مقایسه به
`startsWith`، و خرابیِ گاردِ طول در `safeEqual`.

**آنچه همچنان کارِ اپراتور است (و کدی نیست):** خودِ *مقدارِ* دو متغیر باید در
`.env`ِ تولید ست شود. هر دو از قبل در `.env.example` و `LAUNCH-GUIDE.md`
مستندند. تفاوت این است که حالا اگر فراموش شوند، هیچ‌کدام **بی‌صدا** رد
نمی‌شوند: یکی برنامه را بالا نمی‌آورد، دیگری endpoint را نمی‌بندد.

---

### ۲s) دو باگ در ماژولِ میز + یک قابلیتِ نیمه‌ساخته — **رفع شد** (۲۰۲۶-۰۸-۲۱)

`src/lib/tables.ts` و روت‌هایِ میز تا این تاریخ **صفر تست** داشتند، با اینکه
رویِ مسیرِ بحرانیِ رزرو نشسته‌اند. ممیزیِ هدفمندِ همان ماژول سه چیز پیدا کرد.

#### باگِ ۱ — حذفِ میز رزروِ زنده را بی‌صدا یتیم می‌کرد 🔴

گاردِ `DELETE /restaurant/tables/:id` لیستِ وضعیت‌ها را **دستی هاردکد** کرده بود:

```
['pending','confirmed','auto_confirmed','checked_in','seated','dining']   ← ۶ تا
```

ولی منبعِ یگانه (`ACTIVE_RESERVATION_STATUSES`) **نُه** وضعیت دارد. سه‌تا جا
افتاده بود: **`preparing`، `running_late`، `arrived`**.

چرا بی‌صدا: FKِ `reservations.table_id` روی `ON DELETE SET NULL` است
(`0_init/migration.sql` خطِ ۵۱۹). پس حذف حتی خطا هم نمی‌داد — فقط
`table_id` رزرو `NULL` می‌شد. یعنی مهمانی که **همین حالا دمِ در ایستاده**
(`arrived`) یا غذایش در حالِ آماده‌سازی است (`preparing`) میزش را از دست
می‌داد و هیچ‌کس خبردار نمی‌شد. بدتر: EXCLUDE constraintِ ضدِ double-booking
رویِ `table_id` است، پس رزروِ یتیم‌شده از حفاظتِ تداخل هم بیرون می‌افتاد.

**نکته‌ی تلخِ این یافته:** خودِ `reservation-status.ts` در توضیحِ بالایش
«گاردِ حذفِ میز» را صریحاً یکی از جاهایی نام می‌برد که لیستِ تکراری داشت —
یعنی رفع اعلام شده بود ولی همین یک مصرف‌کننده هرگز وصل نشد. درسش عمومی است:
**یک لیستِ مشترک که دستی کپی شده، همیشه همان‌جایی می‌ماند که یادت می‌رود.**

#### باگِ ۲ — `qrCheckIn` ماشینِ وضعیتِ خودش را دور می‌زد 🟠

`qrCheckIn` مستقیم `db.table.update({ state: 'occupied' })` می‌نوشت.
`ALLOWED_TRANSITIONS` در همان فایل انتقالِ `maintenance → occupied` را ممنوع
کرده و کامنتش **دقیقاً همین مثال** را می‌زند. نتیجه: میزی که کارکنان «خارج از
سرویس» علامت زده بودند، با یک اسکنِ QR بی‌صدا «اشغال» می‌شد و نشانه‌ی خرابی
بدونِ هیچ ردِ حسابرسی پاک می‌شد. حالا از `setTableState` عبور می‌کند؛ اگر
انتقال نامعتبر باشد وضعیتِ میز دست‌نخورده می‌ماند ولی خودِ رزرو همچنان
`seated` می‌شود — مهمان واقعاً نشسته و وضعیتِ فیزیکیِ میز نباید جلوی ثبتش را
بگیرد.

#### یافته‌ی ۳ — check-inِ QR برای رستورانِ واقعی هرگز کار نکرده ✅ (**رفع شد** — §2t)

> **به‌روزرسانی ۲۰۲۶-۰۸-۲۱:** این یافته دیگر باز نیست. کلِ زنجیره وصل شد؛
> شرحِ کامل در §2t پایین. متنِ زیر به‌عنوانِ ثبتِ تاریخیِ خودِ باگ می‌ماند.

**رفع نشد؛ اینجا ثبت می‌شود چون تصمیمِ محصولی است، نه باگِ سرراست.**

- `assignQrCode()` در `lib/tables.ts` وجود دارد ولی **صفر فراخوان** دارد —
  در کلِ ریپو هیچ‌جا صدا زده نمی‌شود.
- `POST /restaurant/tables` هنگامِ ساختِ میز `qrCode` ست نمی‌کند.
- `PATCH /restaurant/tables/:id` هم راهی برای ست‌کردنش ندارد.
- تنها جایی که در کلِ پروژه `qrCode` نوشته می‌شود `prisma/seed.ts` است —
  دیتایِ `[DEMO]` با الگویِ `T-DEMO…`.
- `GET /restaurant/tables` فیلدِ `qr_code` را برمی‌گرداند که برای هر
  رستورانِ واقعی همیشه `null` است.
- هیچ‌کدام از سه اپِ فرانت‌اند اصلاً از `qr_code` استفاده نمی‌کنند.

یعنی `POST /api/v1/checkin` — که عمومی و بدونِ احراز هویت سرو می‌شود —
برای هر رستورانی جز دمو **هیچ‌وقت نمی‌تواند موفق شود**. قابلیت شیپ شده ولی
نیمه‌ساخته است. برای کامل‌شدنش یا باید `assignQrCode` به ساختِ میز وصل شود،
یا اگر قرار نیست کامل شود، هم آن تابع و هم روتِ `checkin` باید حذف شوند.
**تصمیمش با صاحبِ محصول است** — عمداً یک‌طرفه انتخاب نشد.

#### پوششِ تست

`tests/tables.integration.test.mts` — تستِ integrationِ زنده رویِ Postgresِ
واقعی، با فراخوانیِ روتِ واقعی (`Request` واقعی، پس سیمِ auth/RBAC/مالکیت هم
آزموده می‌شود).

هر دو باگ **پیش از رفع، زنده اثبات شدند**: تست‌ها روی کدِ رفع‌نشده اجرا شدند و
دقیقاً همان‌ها قرمز شدند، در حالی که کنترل‌های مثبت سبز ماندند — یعنی تست‌ها
باگ را می‌گیرند، نه اینکه صرفاً سخت‌گیر باشند.

دو تستِ ضدِ-تکرار هم دارد:
- یکی خودِ **کد** را می‌خواند و مطمئن می‌شود روت از `activeStatusList()`
  استفاده می‌کند و لیست را دوباره هاردکد نکرده — چون ریشه‌ی باگ «کپیِ دستیِ
  لیست» بود، نه یک وضعیتِ خاص.
- دیگری روی **خودِ منبعِ یگانه حلقه می‌زند** (نه یک کپی از لیست)، پس اگر فردا
  وضعیتِ فعالِ دهمی اضافه شود، پوششش خودبه‌خود می‌آید.

---

### ۲t) check-inِ QR وصل شد — قابلیتی که شیپ شده بود ولی هرگز کار نمی‌کرد ✅ (۲۰۲۶-۰۸-۲۱)

§2s این را به‌عنوانِ «تصمیمِ محصولی، عمداً رفع‌نشده» ثبت کرده بود. صاحبِ
محصول تصمیم گرفت **وصل شود**، نه حذف. این بخش کارِ انجام‌شده را ثبت می‌کند.

#### چه چیزی شکسته بود

| حلقه‌ی زنجیره | وضعیت پیش از رفع |
|---|---|
| ساختِ کدِ QR برایِ میز | `assignQrCode()` وجود داشت، **صفر فراخوان** |
| ست‌شدنِ کد هنگامِ ساختِ میز | هیچ روتی این کار را نمی‌کرد |
| میزهایِ موجود | `qr_code` همیشه `NULL` (جز `[DEMO]`ِ seed) |
| نمایش/چاپِ QR در پنل | وجود نداشت |
| خواندنِ لینکِ QR در اپِ مشتری | هیچ اپی پارامتر را نمی‌خواند |
| `POST /api/v1/checkin` | عمومی سرو می‌شد و همیشه «میز پیدا نشد» می‌داد |

هر شش حلقه لازم بودند؛ نبودِ هرکدام کلِ قابلیت را می‌کشت.

#### یافته‌ی همراه: QRِ جعلی در اپِ مشتری 🔴

`qrSVG` در `apps/customer/js/features/trips.js` **QR نبود** — یک الگویِ
شبه‌تصادفی از hashِ متن با سه مربعِ گوشه که شبیهِ finder pattern دیده می‌شد.
کامنتِ خودش هم می‌گفت «الگوی شبه‌تصادفی قطعی از hash متن (نمایشی)» و
«برای دمو؛ در تولید از کتابخانه‌ی QR».

یعنی دکمه‌ی «QR ورود» و کارتِ کیفِ پول تصویری نشان می‌دادند که **هیچ اسکنری
نمی‌خواند**. مهمان آن را جلویِ میزبان می‌گرفت و هیچ اتفاقی نمی‌افتاد. این
دقیقاً همان «دادهٔ جعلی که باید واقعی باشد» است که CLAUDE.md ثبتش را الزامی
می‌کند.

حالا از `GET /reservations/:code/qr` می‌آید — QRِ واقعی با کتابخانه‌ی
جاافتاده، با همان قواعدِ مالکیتِ روتِ خواهرش (۴۰۴ نه ۴۰۳ تا وجودِ کد لو
نرود) و rate-limit برایِ جلوگیری از enumerationِ کدِ ۸ نویسه‌ای.

#### تصمیم‌های طراحی که ممکن است بعداً سؤال‌برانگیز باشند

- **آدرسِ داخلِ QR رویِ `app.<domain>` است، نه `<domain>`.** طبقِ
  `deploy/caddy/Caddyfile` دامنه‌ی اصلی وب‌سایتِ مارکتینگ روی Vercel است.
  اگر QR آنجا می‌رفت، مهمان صفحه‌ای می‌دید که کدِ ورود را نمی‌شناسد.
- **کد در query string است، نه در مسیر.** اپِ مشتری یک HTMLِ تک‌فایلی
  بدونِ routingِ سمتِ سرور است؛ `/checkin/CODE` روی سرورِ استاتیک ۴۰۴ می‌دهد.
- **ورود لازم نیست.** مهمانِ بدونِ حساب هم باید بتواند بنشیند. خودِ کدِ QR
  اعتبارنامه است — کسی که پشتِ میز نیست آن را ندارد.
- **شکستِ ساختِ QR ساختِ میز را برنمی‌گرداند.** میز موجودیتِ اصلی است و QR
  یک افزوده؛ اگر throw می‌کرد، یک خطایِ گذرا میزِ ساخته‌شده را پشتِ ۵۰۰
  پنهان می‌کرد.
- **کدِ موجود بازتولید نمی‌شود.** `assignQrCode` بدونِ `regenerate` همان
  کدِ قبلی را برمی‌گرداند، چون کدِ تازه یعنی باطل‌شدنِ استیکرِ چاپ‌شده‌ی
  رویِ میز.
- **مهاجرتِ ۰۵۸ فقط `qr_code IS NULL` را دست می‌زند** — به همان دلیلِ بالا.

#### باگِ جانبی که در همین مسیر رفع شد

`assignQrCode` در حلقه‌ی retryش **هر** خطایی را می‌بلعید و دوباره تلاش
می‌کرد. یعنی اگر میز حذف شده بود یا دیتابیس قطع بود، پنج بار بی‌فایده تلاش
می‌کرد و بعد خطایی می‌داد که ربطی به علتِ واقعی نداشت. حالا فقط رویِ نقضِ
یکتایی (`P2002`/`23505`) retry می‌کند.

#### پوششِ تست

`tests/table-qr-checkin.integration.test.mts` — ۱۵ تست روی Postgresِ زنده
با فراخوانیِ روت‌هایِ واقعی: از ساختِ میز تا نشستنِ مهمان و اشغالِ میز،
به‌علاوه‌ی جداسازیِ تنانت (رستورانِ B نباید بتواند QRِ میزِ A را بگیرد —
یعنی توانِ چاپِ استیکرِ جعلی برایِ رستورانِ دیگر).

مهاجرتِ ۰۵۸ روی ۲۵ میزِ واقعی امتحان شد: ۲۵ کدِ یکتا با شکلِ درست، و اجرایِ
دوباره هیچ کدی را عوض نکرد (با مقایسه‌ی md5 تأیید شد).
