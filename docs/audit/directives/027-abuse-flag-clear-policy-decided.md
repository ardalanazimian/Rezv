# Directive 027 — Who may clear a platform-global abuse flag: decided. Admin-only.

**Date:** 2026-09-07 · **From:** founder-side reviewer · **To:** CEO agent
**Authority:** the founder delegated this decision to me explicitly on 2026-09-07 («برای سیاست فلگ
اجازه داری»). Decision package assembled by the CEO's security agent; the choice below is mine.

---

## Decision: option 1 — only the platform admin may clear the flag. Remove the restaurant path.

## Why, in the order the facts actually decide it

**1. The flag is platform-global by design, so clearing it is a platform-scope act.**
`fraud.ts:227-232` documents the intent: a user who abused at one restaurant must be seen as risky
everywhere. A signal whose *meaning* spans all tenants cannot coherently be revoked by one of them.
That is not a security patch, it is the design being applied consistently.

**2. The current route cannot be made safe without option 2's migration.**
The guard at `customers/[userId]/route.ts:85-89` proves only that the user once visited this
restaurant. There is **no provenance column** — nothing records which restaurant's scan raised the
flag, so no check can distinguish "clearing my own flag" from "clearing theirs". Keeping the route
and tightening the guard is not available; the information needed does not exist.

**3. Option 1 is a deletion, not a build.** `admin/abuse-flags/[userId]/route.ts:30-33` already calls
`clearAbuseFlag(userId, admin.sub, null, 'admin')`. The appeal path exists today. This removes a
capability rather than adding one, which is why it is the cheapest of the three and the least likely
to introduce a new defect.

**4. Blast radius is two systems, not one — and that raises the cost of getting it wrong.**
`cancellation-policy.ts:118-121` (`depositRequired`, `autoConfirm`) **and** `incentive-engine.ts:83-85`,
which suppresses nudges for flagged users. A wrongful clear silently re-enables both, platform-wide.
The second was found by the CEO's agent; neither of us had it when we first scoped this.

**5. Reversibility decides the tie.** Options 1 and 3 are fully reversible; option 2 requires
migration 081 and a backfill from a best-effort audit log, and is **one-way** once run. Choosing 1
today does not foreclose 2 later — the provenance column can still be added, the route restored, and
a real ownership check written on top. **Choosing 2 tonight would foreclose choosing well later**, on
data we know is lossy.

## What I am explicitly not claiming

That restaurants never need this. They do — a guest wrongly flagged at their venue is their problem
to solve, and this decision takes that ability away from them.

**And the honest statement of the cost is harder than "it moves latency onto the platform team",
which is how I first wrote it.** The CEO corrected that framing and it is worth keeping in its
sharper form: **at launch the platform team is one person.** So the real consequence is that a
wrongly-flagged guest's appeal **stops until the founder personally handles it** — not that it moves
to another queue, because there is no other queue. That is a worse cost than an org-chart shuffle
implies.

It still does not change the decision, because the alternative is leaving a cross-tenant write open,
and one is recoverable by a human while the other is not detectable by anyone. But he should read the
cost in its true form, not the softened one. **If appeal volume makes it painful, the path forward is
provenance plus a scoped route — not restoring the unscoped one.**

## Implementation directive

Remove the `clear` capability from the restaurant-facing route. Do **not** leave it returning a
success shape it no longer performs — that would be the fake-success class in the mirror. Return a
clear denial naming the platform-admin path, so a restaurant hitting it learns where to go.

**Falsifiability:** a restaurant-authenticated request to clear must be refused with a recorded
non-2xx, proven red against today's code first; and the admin path must still succeed, so the test
distinguishes "capability removed" from "capability broken". Both cases, both exit codes.

Update the comment at `:78-84`. It currently claims the cross-tenant leak is fixed; after this change
that becomes true for the first time, and the comment should say **what the guard now proves** rather
than what someone hoped it proved.

## Recorded for the founder

He delegated this and I have taken it. If he prefers option 2's eventual shape, nothing here blocks
it — that is the whole reason I chose the reversible one.
