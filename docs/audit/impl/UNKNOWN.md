# Implementation Team — UNKNOWN

- **Date:** 2026-09-17 · **Session:** `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`
- **What it needs from its reader:** treat every row here as **not passing**. Take any row whose owner
  should be someone other than this session.

Nothing below is a finding and nothing below is green. Each row says what was not measured, and why.

## Ground truth I could not establish

| # | Unknown | Why |
|---|---|---|
| U-1 | Whether migrations 086–089 are applied on **any** real database | No staging or production access exists in this session. No DSN, and none should be read into a report |
| U-2 | Any Linux verdict for my branches | CI triggers only on push/PR to `main`/`develop` (`.github/workflows/ci.yml`). `impl/*` pushes run nothing, and `gh` is not installed, so I cannot open a PR from here |
| U-3 | `main`'s own api-suite numbers on a fresh DB | My baseline run was **invalidated by me**. I rewrote the DB setup script while `sh` was still reading it, the schema fixups never applied (`line 23: h: command not found`, exit 127), and the result is discarded. The candidate's numbers (1858/1858) are valid; main's are not measured |
| U-4 | `tools/check-schema-drift.sh` on any of my trees | Needs `psql` on PATH plus an admin Postgres. Neither is present on this host (psql exists only inside containers) |
| U-5 | A staging environment | None found in the repo or the handoffs |

## Backend

| # | Unknown | Why |
|---|---|---|
| U-6 | N-parallel double-booking proof on a fresh DB: primary table (EXCLUDE) and merged secondary tables, Redis up and down | Not run yet (BE-11). The concurrency tests already in the suite passed as part of 1858/1858, but I did not audit what they cover |
| U-7 | Whether a DB trigger writes `economy_ledger_entries` on reward redemption | BE-07 is measured at file level only |
| U-8 | Tenant isolation route by route | The CEO reports it ACCEPTED at handler level (Red Team 48/218 rows, 0 leaks). I did not re-measure it; that is a claim to me |
| U-9 | Fail-open paths enumerated for boot-time security config | Not started |
| U-10 | Shared validation primitives mutated by `.optional()` | Not started |

## Frontend

| # | Unknown | Why |
|---|---|---|
| U-11 | The four states (loading/empty/error/success) per screen, for all three apps | Only the customer discover feed and events were measured (FE-06) |
| U-12 | Each of the 41 `unsafe` + 18 `review` XSS sinks — does user text reach it? | Counted, not reviewed (FE-04) |
| U-13 | `restoreSession` → refresh-on-401 → failed refresh | Not driven |
| U-14 | Business panel walked by hand | Not done. It does have 17 e2e specs, which all passed except 2 flaky on the candidate |
| U-15 | 3 flaky mobile-safari specs on the FE-06 tree: `booking.spec.ts:29`, `waitlist.spec.ts:33`, `:43` | Passed on retry and in one isolated no-retry rerun; cause not chased |

## Design

| # | Unknown | Why |
|---|---|---|
| U-16 | Booking in < 30 s from the feed on a mid-range Android profile; tap count | Not measured |
| U-17 | Persian digits in every dynamic string | The haiku sweep reported ~5–10 unwrapped numeric interpolations (e.g. `bk.party` in `bookStep3`). **Not re-measured by me**, so these are data, not rows |
| U-18 | Dark/light parity per screen; skeleton → data layout shift | Not measured. The sweep found inline hex colours in `apps/customer/js` (economy, loyalty, food-dna, waitlist) |
| U-19 | «چرا؟» explanations for platform decisions (deposit, waitlist position, no tables) | The sweep found 28 «چرا» matches, all code comments, none user-facing. Not re-measured |
| U-20 | Notification restraint (frequency caps, quiet hours, transactional/marketing separation) | The sweep found only category opt-outs (`notification-prefs`), no caps or quiet hours. Not re-measured |
| U-21 | Real restaurant photos in the feed; shareability; a11y focus trap in bottom sheets | Not measured |

## SEO

| # | Unknown | Why |
|---|---|---|
| U-22 | Crawler UA vs edge (403?), OAI-SearchBot, rich-results test, sitemap from outside | No domain (`E-001`, owner). SEO-B1 |
| U-23 | Core Web Vitals on a mid-range Android over an Iranian mobile connection | No device, no deployed page |

## Added 2026-09-17 ~00:45 UTC (batch 2)

| # | Unknown | Why |
|---|---|---|
| U-24 | Whether FE-06 raises the rate of the pre-existing `cancel-window-disclosure:84` flake (1/48 on the candidate, 8/78 on the fix tree, confounded by a concurrent DB build) | Handed to rezv-75 by the CEO for a de-confounded measurement; also to be audited as a possible real mis-tap during page transitions |
| U-25 | Migration 090 on any real database | Test databases only. No production or staging DB in reach (see U-1) |
| U-26 | The real partition-retention procedure | `011-reservations-partitioning.sql` is not runnable as written (elided columns, undefined `block_end`). Only a shape emulation was measured (FIX-BE-02 §partition) |
| U-27 | The FP-009 gates on Linux CI | `impl/*` pushes do not trigger CI. The end-to-end drift run used a `psql` shim into the Postgres 17 container on Windows |
| U-28 | 13 remaining files with module-level `beforeEach`/`afterEach` | Class logged as BE-14; not audited one by one |
