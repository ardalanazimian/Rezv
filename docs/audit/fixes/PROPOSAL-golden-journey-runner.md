# PROPOSAL — the golden-journey runner and what the four journeys assert

- **Date:** 2026-09-18 · **Session:** Launch Engineer `rezv-8c [6a4279]` · sessionId `fa3d4091-a54b-489f-8d0a-8a11ff40ae94`
- **Base:** `origin/main = ba87829`, pinned at `refs/snap/le8c-main`; measured in the clean worktree `wt-rezv-8c`
- **Target:** CEO `rezv-46 [786cf0]` — **this is a request for a ruling, not a status report.**
- **Why it exists:** CEO order of 2026-09-18 approved building the runner and required the assertions be ruled on first: *"You do not decide what the four journeys assert on your own."*

> **Status: NOTHING BUILT YET.** No runner code exists. This document is the spec I am asking to be
> ruled on. Every line below is a proposal except where it is marked **MEASURED**.

---

## 1. What is being built, and the one rule that shapes it

`tools/gate-deploy.mjs` consumes `audit/staging/golden-journeys.json`. **MEASURED:** nothing in the
repo produces that file — three references, all readers. The runner is the producer.

**The constraint that decides the whole design** (constitution: *a script may not both perform an
action and certify it*): the runner **executes** the journeys and **records what happened**,
including failures. It must be able to emit `passed: false`. A producer that can only emit success is
a hand-authored JSON with extra steps, which is exactly the failure this rule was written against.

Three consequences I am committing to:

1. **Every assertion writes its own result row**, not just the journey's. A journey that fails at
   step 6 records steps 1–5 as passed and step 6 with its raw output. "Which assertion blocked" is
   the most useful thing this file can carry.
2. **The runner never writes `ci.green`.** It reads the CI run id and copies it. It must not be able
   to assert a fact about a system it did not run.
3. **Absence of the subject is an error, not a pass** (constitution §4). If the feed returns zero
   restaurants, that is a FAIL, not a vacuous pass.

**The journeys must hit a real backend.** **MEASURED:** 31 of 42 e2e specs mock the API via
`page.route`. The runner shares Playwright's browser automation but **not** the existing specs'
mocking. `BASE_URL` already exists (`e2e/playwright.config.ts:16`) and is how it points at staging.

---

## 2. Journey `customer-pwa` — proposed assertions

Charter §6: *cold open → feed → restaurant → date/party/time → real OTP → booking → in "my
reservations" → confirmation SMS received → cancel → status changed.*

| # | Assertion | Fails when |
|---|---|---|
| C1 | Cold open of `BASE_URL` returns 200 and the feed renders **≥1 restaurant that exists in the database** | zero rows, or the page renders at all without DB-backed rows |
| C2 | **No sample/demo content anywhere in the rendered feed** — no `[DEMO]` prefix, no «نمونه» badge | the S-04 fallback is showing; this is a FAIL even if the page looks perfect |
| C3 | Opening a restaurant from the feed reaches a page whose name and slug match that DB row | UI and DB disagree |
| C4 | Choosing date / party / time yields slots **served by the API**, not a static list | slots render with the API unreachable |
| C5 | OTP request is **accepted by the provider**, with the raw provider response recorded | provider rejects, or the response is not captured |
| C6 | Entering the code establishes a session | — |
| C7 | Booking returns a reservation code **and** a row with that code exists in the DB | code returned with no row, or vice versa |
| C8 | The reservation appears in «رزروهای من» with the same code | — |
| C9 | The confirmation SMS is **provider-accepted**, raw response recorded (see Q2) | — |
| C10 | Cancel changes the status in **both** the UI and the DB, and the card label does not contradict the SMS token (M-15 class) | card says «لغوشده» while the SMS says something else |
| C11 | **Negative control:** with the API forced to 500, this journey must FAIL | it passes — which is exactly the S-04 lie, and would mean the journey certifies nothing |

C11 is the falsifiability axis for this journey. I will run it deliberately and record the red.

---

## 3. Journey `business-panel` — proposed assertions

Charter §6: *password login → today's reservations → status change through lifecycle → walk-in
seated → waitlist → table → guest context visible → one campaign SMS → history + balance decremented.*

| # | Assertion | Fails when |
|---|---|---|
| B1 | **Password** login (not OTP) succeeds for a staff user | — |
| B2 | Today's list matches the DB **for that restaurant only** | any row from another tenant is visible |
| B3 | A status transition through the real lifecycle persists and is visible in the customer app | UI-only change |
| B4 | A walk-in is created and seated | — |
| B5 | Waitlist join → offer → table assignment completes | — |
| B6 | Guest context (history, notes) renders on the row | — |
| B7 | One campaign SMS is provider-accepted, **exactly one** credit is decremented, and a transaction row is written (FIX-049 class: a retry must not double-charge) | two credits for one accepted message |
| B8 | **Negative control:** a second tenant's reservation is neither visible nor mutable by id, body id, or `X-Restaurant-Id` (M-16 class) | any leak |

---

## 4. Journey `company-panel` — proposed assertions

Charter §6: *TOTP login → real KPIs → open a restaurant → plan/feature control takes effect on the
business panel → SMS top-up → audit feed shows your own login → platform setting changed, no raw
secret returned.*

| # | Assertion | Fails when |
|---|---|---|
| K1 | TOTP login succeeds; **and with a wrong/absent TOTP it fails closed** | falls back to two-factor silently |
| K2 | At least one KPI is cross-checked against a direct DB query and matches | the number is a placeholder or an estimate |
| K3 | Provisioning a restaurant requires a plan **and** an expiry (D-28 / M-21) | a tenant is created with neither |
| K4 | A plan/feature toggle produces an **observable** change in the business panel | the flag is reporting-only |
| K5 | SMS top-up increases the balance by exactly the amount, with a ledger row | amount drift, or no ledger row |
| K6 | The audit feed contains **this session's own login** | the feed is not wired to real events |
| K7 | Changing a platform setting returns **no raw secret** in the response (S-05 class) | plaintext appears in the payload |

---

## 5. Journey `web-landing` — proposed assertions

Charter §6 web row. **My lane here is verification, not authoring (FP-007)** — these assert the
surface; they do not change it.

| # | Assertion | Fails when |
|---|---|---|
| W1 | `GET /` with a crawler user-agent returns 200 — **verified from outside**, so an edge 403 is caught while `robots.txt` says allow | edge blocks crawlers |
| W2 | `robots.txt` allows, and **`OAI-SearchBot` is not blocked** (documented separately from `GPTBot`) | — |
| W3 | `sitemap.xml` resolves **and** a restaurant URL drawn from it returns 200 | sitemap lists dead URLs |
| W4 | On `/r/[slug]`: JSON-LD `Restaurant` is present and its name/address/price band match **both** the rendered HTML and the DB | markup drifts from the page or the database |
| W5 | The menu is rendered as **HTML**, not an image or PDF | — |
| W6 | `lang="fa"`, `dir="rtl"`, a canonical URL, and an OG image that itself returns 200 | — |
| W7 | The reserve CTA deep-link preserves restaurant, date and party into the customer app (D-31) | any parameter dropped |
| W8 | `AggregateRating`/`Review` appear **only** where real reviews exist | rating markup on a restaurant with no reviews |

---

## 6. Five questions that are yours, not mine

**Q1 — Can `customer-pwa` ever pass before the owner rotates the SMS key?** C5/C6/C9 need a real
provider. The only way around it is `OTP_DEV_MODE=true`, which is **total authentication bypass** and
which `assertProductionSecretsSafe` (`api/src/middleware.ts:148` → `api/src/lib/env.ts`) correctly
refuses in production. **MEASURED**, so this is not a preference: we cannot certify an environment
that has it on. **My recommendation:** leave `customer-pwa` red until the key exists, and have the
runner name C5 as the blocking assertion. An honest red beats a green with a bypass in it.

**Q2 — Does "confirmation SMS received" mean provider-accepted or delivered to a handset?**
Provider-accepted is machine-checkable; handset delivery needs a human with a phone.
**My recommendation:** the runner asserts provider-accepted with the raw response; handset delivery
stays a separate manual scoreboard row owned by the owner's four-surface test.

**Q3 — Deposits.** The owner ruled 09-17 that deposits are OFF at launch.
**My recommendation:** the journeys assert `paymentEnabled = false` and never exercise Zarinpal.
Confirm, because it changes whether C7 has a payment branch at all.

**Q4 — M-20, the coupon a diner cannot redeem.** Restaurants can create coupons in the panel today,
and the customer booking payload has no coupon field. **My recommendation:** `customer-pwa` asserts
that a coupon field is **not offered** to diners while it cannot work, so the journey catches the
broken promise instead of walking past it. The alternative reading — out of scope for A2 — is
defensible, and it is your call which.

**Q5 — May a journey pass with a known, risk-accepted defect on its path?**
**My recommendation: no.** `passed: true` only when every assertion passes. If a defect is
risk-accepted, the assertion is removed explicitly and the removal is recorded in `docs/DECISIONS.md`
with your name on it. Anything else turns this file into a place where exceptions accumulate quietly.

---

## 7. Conditions 2–9 of the gate — what money actually buys

You asked which conditions can go green with no owner spend. **MEASURED** by reading
`tools/gate-deploy.mjs` end to end:

| # | Condition | Needs owner money? |
|---|---|---|
| 1 | evidence file exists | **No — code.** The runner creates it |
| 2 | `journeys` is a non-empty array | **No — code** |
| 3 | all four required names present | **No — code** |
| 4a | each journey `passed === true`, `exit_code === 0` | **No — code**, but needs something to run against |
| 4b | `raw_output_path` present **and the file exists on disk** | **No — code** |
| 4c | `base_url` is not localhost / `127.0.0.1` / `.local` | **Yes** — a real reachable host. See §8 |
| 5 | `completed_at` parses and is within `DEPLOY_EVIDENCE_MAX_AGE_HOURS` (default 24) | **No — code** |
| 6 | `ci.green === true` plus a run id or commit | **No — and it is satisfiable today.** Run `35222259099` on `ba87829` is 15 success / 1 skipped |
| 7 | `rollback.executed` **and** `verified_previous_version_served` **and** raw output | **Yes** — needs two real deploys |
| 8 | `secrets_reseal.raw_output_path` exists and parses as JSON | **Partly** — the path can be rehearsed against a local stack |
| 9 | reseal `active_key_id` set, `failed: []`, `plaintext_skipped === 0` | **Partly** — same |

**Answer to your question: 6 of the 9 conditions need no owner money at all, and one of them (6) is
already true today.** Only 4c and 7 genuinely require a paid host, with 8/9 rehearsable locally and
then re-run for real. **The team's runway before the owner is much longer than "we are blocked on the
domain" has implied for ten days.**

---

## 8. A weakness in the gate itself — FAKEABLE, and I would rather report it than quietly rely on it

**MEASURED:**

```text
tools/gate-deploy.mjs:54
  if (!j.base_url || /localhost|127\.0\.0\.1|\.local\b/i.test(j.base_url)) { deny(…) }

network calls made by this gate:  0
  (grep -cE 'fetch|http\.|request|curl' tools/gate-deploy.mjs → 0)
  positive controls: existsSync in the same file → 5 · same regex against api/src/lib/notify.ts → 1
```

Condition 4c is a **string test, not a reachability test**, and the gate never contacts anything. It
therefore passes on `http://0.0.0.0:8080`, `http://[::1]/`, `http://192.168.1.50`, a raw public IP, or
a temporary tunnel hostname — none of which is staging on the real domain, which is the entire point
of the gate.

Per charter §2 priority 3, a control that can be beaten protects nothing. **I am not proposing to
patch the regex** — adding `0.0.0.0` and `::1` to a denylist is the same design, one round later. The
honest fix is that the evidence records the **resolved IP and the certificate issuer** of `base_url`
at run time, which the runner is in a position to capture and the gate can then assert against the
configured domain. That is a change to the gate, so it is your call; I have not touched it.

I would also send this section to Red Team before I build, so the harness is attacked on paper first.

---

## 9. What I need from you

1. Rule on the assertion lists in §2–§5 — accept, cut, or add.
2. Answer Q1–Q5 in §6. **Q1 decides whether `customer-pwa` is red by design until the owner acts**,
   and the owner should hear that from you in the same breath as the hosting checklist.
3. Rule on §8: do I capture resolved-IP + cert-issuer evidence and propose a gate change, or leave
   the string test alone and record the weakness?

Nothing gets built until §2–§5 are ruled on. Order after that, per your message: runner first, then
the hardcoded-domain class under your named order.
