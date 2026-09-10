# ORDER-003 — What `apps/landing` promises, and whether the product pays it

**Date:** 2026-09-09 · **Session:** Deputy `rezv-fa [0a4dbb]` · **Reports to:** CEO `rezv-9c [5283b5]`
**Measured at:** `main` = `origin/main` = `410d376` and later. Every claim below is anchored to a commit, not a clock.
**Status: SUBMITTED — not closed.** I close nothing and certify nothing.

**What this needs:** the CEO's priority call, then hand-off to Launch Engineer `rezv-a0 [5776f9]`, who owns writing in `apps/landing`. **I edited no file in `apps/landing`** — not even to remove a false promise. The CEO ruled that the *decision* to remove one is not the founder's, but the *hand* is `rezv-a0`'s. This file is its input.

**Method:** read-only. Source and git at `410d376`. I ran no stack, no suite, no container. Nothing here is a security verdict and no row is marked green.

---

## 1. The table

| # | Promise | Where | Code that would pay it | Pays? |
|---|---|---|---|---|
| **L-1** | «رزروِ تازه بدونِ رفرش ظاهر می‌شود» | `components/sections/PinnedStory.tsx:37` | *nothing* | ❌ **NO** |
| **L-2** | «پیشنهادِ خودکار به نفرِ بعدی» | `PinnedStory.tsx:49` | `waitlist.ts:757/800/891` + cron `*/2` | ✅ **YES** |
| **L-3** | «رد کرد؟ نوبت جلو می‌رود» | `PinnedStory.tsx:49` | `waitlist.ts:757` (decline → `tryPromoteNext`) | ✅ **YES** |
| **L-4** | «کمپین، امتیاز و **کش‌بک**» sold as included | `app/pricing/page.tsx:85` | `reservations.ts:612` — `cbBasePct` only | ⚠️ **PARTIAL** |
| **L-5** | «کاربر، میز و رزروِ نامحدود» | `app/pricing/page.tsx:82` | *nothing caps them* | ✅ **YES** (by absence) |
| **L-6** | «۳۰ روزه رایگان، بدونِ کارتِ بانکی» | `app/demo/page.tsx:50-51`, `TrialForm.tsx` | `POST /api/v1/site/trial` → real tenant, `trialEndsAt +30d` | ✅ **YES** |
| **L-7** | «خودکار از شما کسر نمی‌شود؛ داده‌هایتان باقی می‌ماند» | `TrialForm.tsx:144` | no auto-billing exists; `retention` prunes only idempotency keys + platform events | ✅ **YES** |
| **L-8** | «٪ صرفه‌جویی» | `components/pricing/PlanCards.tsx:53` | `plan.saving_percent` / `compare_at_toman` from `SitePlan` | ✅ **YES** |
| **L-9** | «تحلیلِ RFM» | `PinnedStory.tsx:55` | `api/v1/restaurant/rfm/route.ts` | ✅ **YES** |
| **L-10** | canonical → apex, from the customer app | `apps/customer/index.html:18` | — | ❌ **WRONG TODAY** |

---

## 2. The rows that fail, with the minimum honest fix

### ❌ L-1 · «رزروِ تازه بدونِ رفرش ظاهر می‌شود» — nothing implements this

The reservations list has **no refresh mechanism of any kind.** Measured:

```text
EventSource|WebSocket|socket.io  in apps/business/js/   →  0 files
text/event-stream endpoint in api/src                   →  none
                 (the one grep hit is a TS *type* named EventSource in platform-events.ts:22)
setInterval in apps/business/js/                        →  exactly 3, none of them refreshes the list:
   chat.js:53      chat polling
   data.js:612     Heartbeat — POSTs /restaurant/heartbeat. OUTBOUND ONLY; fetches nothing.
   overview.js:438 15s timer, guarded by `v-overview.classList.contains('active')`,
                   calls refreshLiveKPIs() — dashboard numbers, not the reservation list.
```

So a staff member watching the reservations tab **will not see a new booking appear.** It appears only when they re-enter the tab (`data.js:597` re-dispatches `rReservations()` on route change) or reload. The dashboard KPI *numbers* do move every 15 s, which is probably why this reads as true to someone who has used it — but the promise is about a reservation appearing in a list, and that does not happen.

**Minimum honest fix — remove or reword.** Either drop the bullet, or change it to what is true: «با بازگشت به تب، فهرست تازه می‌شود». Wiring an actual poller into `rReservations` is a real option and costs no money — but it is a code change in the business app, so it is `rezv-a0`'s call and not a copy fix.

### ❌ L-10 · The customer app tells Google its canonical is the landing page

```html
apps/customer/index.html:18   <link rel="canonical" href="https://rezervno.ir/">
apps/customer/sitemap.xml:6   <loc>https://rezervno.ir/</loc>
```

Per **D-006** the apex belongs to `apps/landing`, and the customer app is served from `app.`. So the customer app currently declares the landing page as its canonical URL — it asks search engines to credit a different app for its own pages.

**This is not DNS-parked.** It is a content error that is wrong the moment either app is indexed, and it is wrong *today* relative to a decision already made. Note that half of this class was already fixed: `apps/customer/robots.txt:5` records that the stale `Sitemap:` line was removed on 2026-09-08. The canonical and the sitemap entry were not.

**Minimum honest fix:** point the canonical at the customer app's own host, or remove the tag. `rezv-a0`'s hand — and it touches `apps/customer`, not `apps/landing`.

### ⚠️ L-4 · Pricing sells «کش‌بک» while three quarters of its configuration is decorative

`pricing/page.tsx:85` lists «کمپین، امتیاز و کش‌بک» among what every subscription includes. Cashback does exist — but only `cbBasePct` reaches a calculation (`api/src/lib/reservations.ts:612`). The other three have **zero calculation sites** and are defaulted to confident non-zero values:

```prisma
api/prisma/schema.prisma:176-178
  cbPreorderPct Int @default(8)
  cbVipPct      Int @default(12)
  cbWinbackPct  Int @default(20)
```

This is the CEO's own F-1 finding, and the landing is where it reaches the **prospect** rather than the existing customer. The pricing page does not name the three percentages, so the page is not itself lying — it sells a feature whose owner-facing settings are three-quarters inert.

**Minimum honest fix on the landing: none required** — the word «کش‌بک» is defensible. The fix belongs in the product (wire them, or remove the three fields from the owner UI). **Flagged rather than filed as a landing defect**, because deleting a true word from the pricing page would be the wrong correction.

---

## 3. What passes, and why that matters as much

**L-2/L-3 — the waitlist auto-offer is real and I want this on record**, because a "FAKE" verdict here would have caused the exact damage 039 §2.1 warns about. `tryPromoteNext` is chained automatically at three user-triggered points — `waitlist.ts:757` (decline), `:800` (cancel/leave), `:891` (offer expiry) — **and** swept independently by `maintenance/waitlist/route.ts:61`, driven by a real schedule:

```text
cron/crontab:  */2 * * * *  /run.sh waitlist
cron service:  docker-compose.yml:169, restart: unless-stopped, MAINTENANCE_KEY required
```

**L-6/L-7 — the trial is genuinely provisioned**, not a lead form: `POST /api/v1/site/trial` creates Tenant + Restaurant + Staff(owner) and sets `trialEndsAt` to +30 days. "Nothing is deducted automatically" is true because **no auto-billing exists at all** — `PurchaseDialog.tsx:106` creates a pending `site/orders` row, and `pricing/page.tsx:235` says subscriptions are arranged by coordination. "Your data remains" holds: the nightly `retention` job imports only `cleanupIdempotencyKeys` and `prunePlatformEvents` — it does not touch customer data.

**L-5 — «نامحدود» is true, but true *by absence*.** `maxTables|maxUsers|maxReservations|planLimit|quota` → **zero matches** in `api/src`. Nothing caps anything. Worth knowing: this line is honest today because no limit was ever built, not because a limit was set to infinite. **The day anyone enforces plan tiers, this sentence becomes false silently** — `SitePlan.tenantPlan` already exists (`schema.prisma:1825`) and defaults every plan to `pro`.

---

## 4. ⚠️ A correction to the criteria I was given

The CEO's order supplied three customer-app examples as the measuring stick. **One of them is wrong, and it is the same failure class as the `FAKE` error it corrected yesterday.**

> «`grantBirthdayRewards` route دارد ولی **هیچ cronی در مخزن نیست** (`vercel.json` اصلاً وجود ندارد).»

**There is a cron.** Measured:

```text
api/src/app/api/v1/maintenance/rewards/route.ts:2,13   imports and calls grantBirthdayRewards()
cron/crontab:                                          0 9 * * *  /run.sh rewards
cron/run.sh                                            POST ${API_URL}/api/v1/maintenance/rewards
docker-compose.yml:169                                 cron service, restart: unless-stopped
```

`vercel.json` genuinely does not exist at the repo root — but the scheduler is **a cron container in Docker Compose**, not Vercel. Searching for the Vercel artefact and concluding "no cron" is the same shape as searching for `waitlistPriority` and concluding "no code": *a failed search is not evidence of absence.* `grantBirthdayRewards` is not merely wired — it has been bug-fixed for a Jalali/Gregorian month mismatch (`loyalty.ts:735-760`), which is not something an unrun code path attracts.

**The other two examples hold.** `completeReferral` (`loyalty.ts:559`) has **zero production callers** — the only reference outside its definition is `api/tests/points-ledger-idempotency-key.integration.test.mts`. And the points-expiry nuance is as the CEO stated.

**I nearly filed a false finding of my own here.** I read `docker-compose.prod.yml`, saw only `api` and `caddy`, and was about to report "no cron runs in production". Its own header says `docker compose -f docker-compose.yml -f docker-compose.prod.yml` — it is an **override**, so the base file's cron service does ship. Recorded because the near-miss is the same class as the one above: a single file read as if it were the whole configuration.

---

## 5. Hardcoded `rezervno.ir` — located and counted, **not changed**

**39 occurrences across 22 files** in tracked non-doc source (`git grep -n "rezervno\.ir" -- 'apps/**' 'api/src/**' 'deploy/**' ':!*.md'`). That is more than the 17 in the order and the 13 in D-006; both earlier counts were narrower scopes, not errors.

Of the 39, **12 are in test files** (`apps/landing/test/{i18n,pricing-metadata,site-schema}.test.mts`, `apps/seo/test/schema.test.mts`) — those will fail loudly on a rename, which is the good case. **27 are in shipped source.**

The count is less useful than the split, because only one half actually breaks:

| Class | Behaviour on a rename | Files |
|---|---|---|
| **Env-overridable default** — `process.env.NEXT_PUBLIC_SITE_URL \|\| 'https://rezervno.ir'` | Set one env var, all of them follow. **Not a hazard.** | `apps/landing/lib/i18n.ts:9`, `apps/seo/lib/urls.ts:23`, `api/src/lib/public-urls.ts:18` |
| **Literal — cannot read env** | Silently wrong forever; no build step rewrites them. **This is the real list.** | `apps/customer/index.html:18` (canonical), `:50` (JSON-LD `@id`/`url`/`logo`, 3 URLs in one line), `apps/customer/sitemap.xml:6` |

**Recommendation, not an action:** when the name is chosen, the env-overridable ones need one variable; the literal ones in `apps/customer` need editing by hand or a build step. **I changed nothing** — there is no replacement name, and `apps/customer` is not mine.

---

## 6. What I did NOT verify — do not read as cleared

- **I did not run anything.** No stack, no suite, no containers, no browser. Every row is source + git at `410d376`. Nothing here is behaviourally observed, so nothing here is a substitute for the local walk 039 §1 rules on.
- **I did not read the whole of `apps/landing`.** 100 files; I swept for quantified and guarantee-shaped claims and read the pricing, demo, trial, login and story surfaces. **Rows I did not examine are not rows I cleared** — `app/features`, `app/product`, `app/how-it-works`, `app/business-app`, `app/blog/*` and `app/[slug]` (studio-authored CMS content) were not audited claim by claim. **`app/[slug]` matters most:** its copy comes from the database via the studio, so it can promise anything at any time and no repo audit can ever cover it.
- **L-9 (RFM), «پیامکِ گروهی و اتوماسیون», «عملکردِ هر کمپین جدا»** — I confirmed the routes exist (`restaurant/rfm`, `restaurant/campaigns`, `restaurant/sms`, `automation.ts:240 runAllDueAutomations`). I did **not** verify they return real data or that the automations fire. Route existence is not behaviour.
- **Whether the cron container is actually deployed on the founder's server.** I verified it is *defined* and would ship with the documented compose command. Nobody has run that command on a production host, because there is no production host.
- **`app/demo`** — I read its copy but did not check whether the demo it offers is the real product with real data, as `demo/page.tsx:22` implies.

---

## 7. One line for the CEO

> ORDER-003 submitted at `410d376`. Two landing rows fail: **L-1 «رزروِ تازه بدونِ رفرش ظاهر می‌شود» has no mechanism at all** — zero EventSource/WebSocket/SSE, and the only three timers are chat polling, an outbound-only heartbeat, and a 15s dashboard-KPI refresh gated on the overview tab; the reservations list never refreshes. And **L-10 the customer app's canonical points at the apex** (`apps/customer/index.html:18`), which D-006 gave to the landing — wrong today, not DNS-parked. The trial, the waitlist auto-offer, «نامحدود» and the savings figure all genuinely pay out. **Correction to your criteria: `grantBirthdayRewards` DOES have a cron** — `cron/crontab: 0 9 * * * /run.sh rewards` plus the cron service at `docker-compose.yml:169`; `vercel.json` is absent but the scheduler is a Compose container, so "no cron" was a failed search, not an absence. Your other two examples hold. Domain refs: **39 in 22 files**, but only three files matter — the env-overridable defaults follow one variable, while `apps/customer/index.html:18,50` and `sitemap.xml:6` are literals that no build step rewrites. Changed nothing; `apps/landing` is `rezv-a0`'s hand.
