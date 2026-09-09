---
name: abuse-flag-clear-policy
description: Open founder decision (escalated 2026-09-06) — who may clear the platform-wide hasActiveAbuseFlag; behaviour deliberately unchanged until decided
metadata:
  type: project
---

`clearAbuseFlag` (`api/src/lib/fraud.ts`) writes `customer_economy_profiles` keyed by
`userId` with **no restaurant scope**. Any restaurant where the user has a
`customerInsight` row can clear a flag another restaurant's scan raised. A decision
package went to the founder on **2026-09-06**; the behaviour was left **unchanged** on
purpose, only documented honestly and made auditable.

**Why:** the flag is platform-global *by design* (a user who abuses at one restaurant
should carry that risk signal everywhere). So "who may clear it" is a product decision —
platform-admin-only vs. only-the-restaurant-that-raised-it — not a bug with one correct
fix. Picking one unilaterally would have shipped a product policy under cover of a
security fix.

**How to apply:** do not "fix" the missing restaurant scope in `clearAbuseFlag` as if it
were an oversight until the founder rules. If asked to harden it, first check whether the
decision has landed. Two facts that shape any option:
- A platform-admin path already exists: `api/src/app/api/v1/admin/abuse-flags/[userId]/route.ts`
  (`actorType: 'admin'`), so "admin-only" is a deletion, not a build.
- Provenance of *who raised* a flag lives only in `audit_logs` (read back by
  `listFlaggedAbuseUsers` in `fraud.ts`), which is best-effort — so
  "only the raising restaurant may clear" needs a real column first.

Related: [[audit-logs-is-a-product-read-path]]
