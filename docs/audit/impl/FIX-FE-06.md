# FIX-FE-06 — a server error showed six `[DEMO]` restaurants as real (Full-Stack B-1, CEO P0-0)

- **Date:** 2026-09-17 · **Session:** Implementation Team `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`; Red Team `rezv-31` attacks it first
- **What it needs from its reader:** attack the three gates below, then close or reopen. Also decide
  whether the pre-existing flake in §What I did not verify becomes its own backlog item.
  **Status: submitted.**
- **Branch:** `impl/rezv-85-p0-0-demo-trap`, based on the merge candidate `99065a7`

## The claim fixed

Full-Stack audit B-1 (`origin/audit/fullstack-2026-09-16 @ cb0d67e`, `docs/audit/fullstack/FRONTEND.md` §1),
runtime-proven by `rezv-75`. `apps/customer/js/api.js` `loadRestaurants()` returned `R_SAMPLE` for
**any** non-OK response. But `apps/customer/js/api-core.js` returns an HTTP error (500/503/429/403)
**without** `offline`, so a live server that returned 500 put six `[DEMO]` cards under «۶ رستوران
فعال» on the customer feed, with no console message.

## Root cause and class

- **Root cause:** the fallback condition was "the request did not succeed" instead of "this is the
  explicit offline demo". Its own comment claimed the second.
- **Class:** *sample data selected by a request result instead of by the demo contract.* The app
  already has that contract, `isOfflineDemo()` (`file://`), and uses it in
  `features/notifications.js:40`, `reservation.js:121` and three places in `auth.js`.
- **Siblings found before fixing** (haiku sweep of every `*DEMO*` / `*SAMPLE*` identifier in the
  three apps, each re-read by me):

| Site | Condition | In this fix? |
|---|---|---|
| `apps/customer/js/api.js` `loadRestaurants` | `!res.ok` → `R_SAMPLE` | **yes**, the reported instance |
| `apps/customer/js/init.js:12` + `boot()` | `R = R_SAMPLE` initially, painted before the API answered | **yes**. On a mobile link slower than the 280 ms skeleton, every real user saw six `[DEMO]` cards on every cold load |
| `apps/customer/js/data/discover.js` `renderEvents` | `res.offline` → `SAMPLE_EVENTS` | **yes**. A real user on https with no network saw three fake events |
| `apps/customer/js/data/booking.js:160` `FALLBACK_TIMES` | `!r.slug \|\| !API.online` | no. It is labelled «(نمونه)» with a banner, and after this fix `API.online=false` only occurs with an empty `R` outside `file://` |
| `apps/company/js/api.js:199` `loadAdminRestaurants` | `!res.ok` → `RESTAURANTS_SAMPLE` (`[DEMO]`-prefixed, offline banner) | **no**, different app. Logged as a new backlog row for its own commit |
| `apps/business/js` `RES_DEMO`, `GUESTS_DEMO`, `STAFF_DEMO`, `NOTIFS_DEMO`, `WL_DEMO_*` initial values; `overview.js:483` `dashboardUsingDemoData()` | initial value / not-loaded | **no**, backlog FE-03 (business panel), its own commit |
| `apps/company/js/hours.js:78`, `photos.js:88` | `res.offline` | **no**, company panel, same row as company `api.js` |

Also fixed in passing, because it is the same class inside the test that guards this bug:
`e2e/tests/customer-empty-not-fake.spec.ts` hard-coded six sample names, and **five no longer
existed** in `seed.js` («باغِ ایرانی», «کافه نورا», «سنتوری», «لاویا», «ترمه»), so five of its six
"not shown" assertions could never fail. Names are now read from `seed.js` by
`e2e/tests/helpers/sample-names.ts`, with a count ≥ 6 positive control.

## The diff

- `api.js`: sample data only under `isOfflineDemo()`. Otherwise an exported `LIST_ERROR` carries
  a user-facing reason, and it distinguishes offline («اتصال به سرور برقرار نشد») from a server error
  («سرور الان جوابِ درستی نداد (خطای ۵۰۰) — مشکل از سمتِ ماست، نه تو», Persian digits).
- `init.js`: `R` starts empty outside `file://`, and `boot()` paints a skeleton (`renderFeedLoading`),
  not samples.
- `discover.js`: `renderFeed` renders `.feed-error` (`role="alert"`, «تلاشِ دوباره») when the list
  is empty **because it failed**. That keeps the honest empty state for a successful empty response.
  `doSearch` no longer says «چیزی پیدا نشد» when the list never arrived. `renderEvents` gates samples
  on `isOfflineDemo()`, and its error text is escaped with Persian digits.
- `sw.js`: `CACHE_VERSION` v48 → **v49**.
- Regenerated artifacts: `standalone/customer.html`, `tools/xss-sink-audit-report.json`,
  `docs/XSS_SINK_AUDIT.md`.

**Scope note, a contradiction stated:** the CEO's outcome was "samples only when the backend is
genuinely unreachable". This fix is stricter: samples only in the explicit `file://` demo. A
production user whose network is down is a broken production path, and the founder's charter says
demo data must never mask one. It is the same gate five other call sites already use.
Relaxing it back to `res.offline` is a one-line change.

## Proofs — tested

Server identity was asserted before every run. The static server on port 38580 returned byte-identical
sha1 for `js/api.js`, `js/init.js`, `js/data/discover.js` and `sw.js` versus the worktree files.

| Step | Result |
|---|---|
| **RED**: new spec on unfixed `99065a7`, 3 projects, `--retries=0` | 15 failed · 9 passed · **exit 1**. Every red test failed on «[DEMO] دیده شد» (500, 503, abort, slow network, search), 3× each |
| **GREEN**: new spec + `customer-empty-not-fake`, 3 projects | 33 passed · **exit 0** |
| **Mutation M1**: `api.js` gate back to `!res.ok` | 5 failed · 4 passed · **exit 1** (desktop-chrome) |
| **Mutation M2**: `init.js` back to `R = R_SAMPLE` | 3 failed · 6 passed · **exit 1** |
| **Mutation M3**: `renderEvents` back to `res.offline` | 1 failed · 8 passed · **exit 1** (the full-abort events test, added after M3 showed the first draft could not catch it) |
| Reverts | sha1 of all three files back to the fixed version, served == disk |
| **Full e2e**, `CI=1`, ports 38580–2, 3 projects | **603 passed · 0 failed · 4 flaky · 2 skipped · exit 0** (25.6 min) |
| api tests that read the changed files | `deposit-label-honesty` 5/5 · `discover-above-fold` 6/6 · `preorder-step-availability` 9/9 · `sample-menu-shape` 4/4 · on fresh DB clones `availability-bulk` 13/13 · `telemetry-pipeline` 20/20 · all exit 0 |
| `node tools/xss-sink-audit.mjs --check` | exit 0 · unsafe 41 (baseline 42) · review 18 |
| `node tools/xss-escaping-regression.mjs` | exit 0 |
| `python tools/build-standalone.py --check` | exit 0 |
| `node --input-type=module --check` on the three modules | parse OK |

"Fresh DB clone" means a `CREATE DATABASE … TEMPLATE` of a database snapshotted immediately after a
from-zero build with CI's three commands (`FRESHDB_OK 2026-09-16T21:53Z`), restored before each file.

## What I did not verify

- **A flake whose rate may be raised by this change.** In the full run, 4 tests were flaky, all
  `[mobile-safari]` customer flows passing on retry 1. The one I chased,
  `cancel-window-disclosure.spec.ts:84`, has the same failure signature on **both** trees
  (`aria-label` still «جزئیات رزرو» because the cancel dialog never opened):

  | Tree | Attempts | Failed |
  |---|---|---|
  | candidate `99065a7` (unchanged) | 2 isolated + 15 + 30 + 1 (full run) = 48 | **1** |
  | this fix | 2 + 15 + 30 + 1 + 30 (traced) = 78 | **8** |

  Two traces show the mechanism, and it is outside this diff. The click on «لغو» happens during the
  trips page transition. Actionability retries report "element is not stable" and pointer
  interception by `#page-chat`, `nav.nav` and `nav.botnav`, and the final click is performed but
  never reaches the button. It pre-exists (1/48 on the candidate). Part of the fix-tree runs
  overlapped a DB build on the same machine, and I **cannot** rule out that the lighter boot paint
  changes its rate. Not fixed here. It needs its own row (a test clicking mid-transition, or a hidden
  page intercepting taps, which would be a real mobile bug).
- **Linux.** Windows only. CI does not run on `impl/*` pushes.
- The other 3 flaky tests (`booking.spec.ts:29`, `waitlist.spec.ts:33`, `:43`, all mobile-safari)
  were not investigated beyond retry-pass and one isolated no-retry rerun in which they passed.
- A real device on a slow Iranian mobile network. The slow-network case is simulated by a 2.5 s mock
  delay.
- The full api suite was not re-run. Only the six api tests that read the changed files were.
