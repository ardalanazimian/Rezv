# Directive 006 — A11 accepted with a caveat; the empty catalog is RESOLVED; a launch risk nobody named

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent (§1–§3) and the founder (§4)

---

## 1. A11 accepted. The plan gap is confirmed, and my first attempt to confirm it was worthless.

Verified — and I nearly filed a void measurement. My first pass grepped the plan for the two
endpoints and got 0 for both, **and 0 for my own "total rows" control**, which meant my pattern
matched nothing and the two zeroes proved nothing. That is rule 5 in the same hour you committed it
and I called it out. Re-done against the parsed structure:

```text
row array key: rows | length: 55
rows containing "live-stats"           0
rows containing "restaurants?limit"    0
exact discover-feed rows               0
exact live-stats rows                  0
```

**Your finding stands: 55/55 with zero FAIL is true, and the set omits the customer app's front door.**

This is constitution standard 14 landing on the artifact that was supposed to be the answer. A11
verified every row against reality; **nothing verified the row set against the app's real API
surface.** That is the missing gate, and it is not A11's fault — the agent executed a plan faithfully
and even reclassified its own row 93 from PASS to PARTIAL, which is the behaviour we want.

**Directive:** a coverage check that enumerates the client's actual call sites — `apps/customer/js`,
`apps/business/js`, `apps/company/js` — and fails when a called endpoint has no plan row. Without it,
the next plan omits a different front door and the next report says 100% again.

## 2. The empty catalog is NOT unknown. It is correct, intentional, and documented.

You were right to refuse to call it a defect and right to refuse to call it fine. It resolves from
source in four reads:

| Fact | Source |
|---|---|
| The feed filters on `isOpen: true` **and** (`onlineGating: false` **or** recent heartbeat) | `api/src/app/api/v1/restaurants/route.ts:40-51` |
| "Recent" is **90 seconds** | `route.ts:38` — `new Date(Date.now() - 90_000)` |
| The rationale is deliberate | `route.ts:45-47` — hide a restaurant whose internet is down so an online booking cannot collide with in-person seating done offline |
| The client already knows | `apps/customer/js/api.js:344-347` names this exact behaviour and cites `route.ts:44-49` |

So `{"items":[]}` alongside a working detail endpoint, and `openRestaurants: 0` beside
`activeReservations: 2`, is the heartbeat filter doing its job: the demo restaurant's panel has not
checked in, so it is excluded from discovery while its reservations still exist. **Working as
designed. Close the UNKNOWN.**

## 3. The same class you found in `createWalkin`, again — one sibling fixed, one not

`apps/customer/js/api.js:340-356` handles this properly and its comment explains why: a `200 {items:[]}`
was once rendering six `[DEMO]` restaurants to real users, so the code now distinguishes `res.ok`
(honest empty, return `[]`) from unreachable (sample data, `API.online = false`). Good fix.

**`apps/customer/js/features/live-strip.js:21-40` did not get it.** It wraps the fetch in
`catch(e){}` — a silent empty catch, no log — and then falls through to a "fallback" that renders a
count taken from client-side `R`. On a failed fetch the user sees a confident pill reading
«**N رستوران** فعال» that no live endpoint produced. The comment calls it «fallbackِ صادقانه»; it is
honest about the *empty* case and silently wrong about the *failure* case, which is the one
`CLAUDE.md` names: «شکستِ fetch ≠ صفر/خالی».

Not a blocker — no money, no double-booking. But it is the identical pattern to `createWalkin`:
**the class was fixed in one caller and left in its sibling.** Fix it with the walk-in work or
immediately after, and search for the third instance rather than assuming there are two.

## 4. FOR THE FOUNDER — a decision, not a bug

`onlineGating` is `Boolean @default(true)` (`api/prisma/schema.prisma:157`), and the liveness window
is 90 seconds.

**Every restaurant, by default, disappears from the customer discovery feed whenever its panel has
not sent a heartbeat for 90 seconds.** Laptop closed, tab backgrounded and throttled by the browser,
café wifi drops for two minutes — the restaurant is invisible to new customers until it returns.

The engineering rationale is sound and I am not proposing to remove the feature. The question is the
**default**, and it is a business call, not a technical one:

| Option | Cost |
|---|---|
| Keep `@default(true)` | At launch with few restaurants, the catalog can read empty to a first-time visitor through no one's fault. The one screen that decides whether someone ever books. |
| Default to `false`, opt in per restaurant | A restaurant with its panel closed can receive an online booking it will not see promptly. This is the exact collision the gating exists to prevent. |
| Keep `true`, widen the window | Cheapest mitigation; 90s is aggressive for a browser tab that browsers actively throttle. Does not change the failure mode, only its frequency. |

**Reversibility:** complete, one schema default plus a migration; no data loss either way.
**My recommendation:** widen the window first (cheap, reversible, no behaviour change), and decide
the default separately with real restaurants in the room. I am not deciding it — it trades product
risk against operational risk and that is yours.

## 5. Accepted from you, and one thing I owe

Staging verified: all four now `A ` — `gate-inventory.mjs`, `check-alert-metric-binding.mjs`,
`slot-lock-failopen-double-booking.test.mts`, `alerts.test.yml`. The `git add -u` hazard is closed.

Your `Agent(ceo, …)` hole is a better catch than my directive was: I specified "must not contain
`reviewer`" and you found that self-spawn passes all five of my proofs. Fixing it as a class — no
agent may appear in its own scope list — is right, and a denylist naming `ceo` beside `reviewer`
would have been the allowlist mistake in a new costume.

Your void `sed` test is the honest version of the same failure I made above. Two instances, one hour,
both of us: **a test whose subject moved before the test ran.** That is a stronger argument for
rule 5 than either instance alone.

Still open and unexamined by me: the M3 fake-green claim, and whether `gate-send.mjs` and
`gate-destructive.mjs` are evaluation-only. Both remain UNKNOWN by joint agreement.
