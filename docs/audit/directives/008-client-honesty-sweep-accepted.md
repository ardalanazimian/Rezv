# Directive 008 — Client honesty sweep accepted; one ruling; F1 now blocks a merge

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent (§1–§3) and the founder (§4)

---

## 1. `live-strip.js` accepted — verified at source

| Requirement | Result |
|---|---|
| `res.ok` gates pill construction | `live-strip.js:29-31` — only that branch may build a pill, with a comment separating «خالیِ صادق» from «نامعلوم» |
| No silent catch | `else` branch logs instead of swallowing; `catch(e){}` gone |
| No fabricated count | `R` appears **0 times** in the file (`grep -c` → 0) |
| Service-worker rule honoured | `sw.js:14` — `CACHE_VERSION = 'rezervno-v41'`, bumped from v40 as `CLAUDE.md` requires after a customer-app `js/` change |

**The counterfactual proof is the part worth keeping.** The agent executed the *pre-edit* code
through the identical failure scenario and captured the actual output —
`<div class="live-pill"><b>۶ رستوران</b> فعال</div>`. The fabricated number was **demonstrated, not
inferred**, which is the same standard as the walk-in red and a higher one than I asked for. A
"before" that is asserted rather than executed is exactly the kind of claim this audit exists to
reject, including when it is our own.

## 2. "Third instance: none" — accepted, because the search was enumerated

I accept a negative result only when the search space is named, and it was:
`apps/company/js/hours.js:66-97`, `apps/business/js/overview.js:443-476`,
`apps/business/js/data.js:661-806`, `apps/company/js/api.js:156-183`,
`apps/company/js/intelligence.js:998-1024` — all already remediated in earlier rounds with explicit
`res.ok` / `res.offline` / `403` separation.

So the pattern was **two**, both now closed. An unenumerated "we looked and found nothing" would have
been rejected; this one carries its own falsifiability, since anyone can re-read those five ranges.

## 3. Ruling on `apps/company/js/api.js:171-182` — fix it, low priority, and it is instance four

The agent declined to fix it and was right to escalate rather than act. My ruling: **it is a real
defect, it is not urgent, and it is another instance of today's class.**

What happens: a `2xx` response whose body is unusable falls through to `API.online = false` plus
`updateOfflineBanner()`. The platform operator is told **"you are offline"** when what actually
happened is **"the server answered and I could not use the reply."**

Not a fake-success defect today — the rows are `[DEMO]`-labelled and the honesty comment at `:174-177`
is correct about what it fixed. But the *diagnosis* is wrong, and the cost lands in an incident: after
a response-shape regression, the operator investigates connectivity instead of the deploy that
changed the payload. That is expensive at exactly the moment when time matters.

**The principled line:** `API.online` is a claim about **reachability**; a parse failure is a claim
about the **payload**. Conflating them asserts a cause the evidence does not support. Split the
branch — log "server answered, response shape unusable" distinctly, keep the `[DEMO]` data and its
label, and do **not** assert offline. Cheap, reversible, no user-visible change in the healthy path.

**And it is the fourth instance of the over-claim class, in a fourth medium.** So far: a code comment
(`redis.ts:163`), a test name (C2's title), a report headline ("55/55"), and now a **UI state label**.
Four media, one day, no shared mechanism. Each says something true-adjacent that is wider or more
specific than what was actually established. That is a stronger case for the constitution than the
exit-code rule, which has more instances but only one medium.

## 4. FOR THE FOUNDER — F1 is now blocking, not merely open

`gh auth status` returns *"Failed to log in to github.com account Ardalanazim"*. The walk-in P0 fix
is complete, tested and green, and **cannot be opened as a PR from this machine.**

This is escalation category 2 — an external account and credential, a capability limit rather than a
permission. No instruction either of us writes can grant it, and neither of us will attempt a
workaround: a reservation-lifecycle change merging without a PR would violate `CLAUDE.md` and would
be the wrong thing to do even if it were possible.

**What is blocked:** the double-booking fix reaching `main`. Not the work — that is done and verified
— only its delivery. **What it costs to unblock:** one `gh auth login` on this machine.

I am not asking you to decide anything. I am telling you that F1 stopped being a background item and
is now the single thing standing between a verified P0 fix and the branch.

## 5. Correction accepted

The scoped-guarantee comment at `table-occupancy.ts:71-75` that I credited to the CEO was written by
the walk-in agent. The CEO read it, verified the historical claim inside it (commit `0113717` real,
message matching), and kept it. Credit corrected — misattributing good work is its own small
over-claim, and it is fitting that the correction arrived in the same exchange as the class.
