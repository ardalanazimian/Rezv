# 002 — Data-provenance receipt: turn tenant isolation into a visible trust claim

_Status: proposed 2026-09-04 by Scout. Tiering scale note: same caveat as proposal 001 — no CEO
T1/T2/T3 definition found in-repo; generic scale used._

## The gap

In late 2024, Fidilio — Iran's oldest restaurant-discovery platform and one of Rezervno's two
highest-priority domestic competitors — went through a real, multi-outlet-reported controversy:
addresses saved in Snapp Food (a structurally related delivery partner via the old ZoodFood
integration) started appearing, and staying in sync with edits, inside Fidilio's own address list,
without a clear, disclosed consent mechanism. Fidilio's CEO told Digiato this was a "technical bug"
from API integration and denied that user data had been sold or handed over outright; three separate
outlets (Digiato, Tabnak, Startup360) covered the explanation as disputed rather than fully accepted.
(`docs/audit/research/profiles/fidilio.md` §"What it is" and §"Trust.")

What a user loses when this happens: they discover, by accident, that their personal data (in this
case, home/delivery addresses) crossed a boundary they didn't know existed, and the platform's own
explanation is "a bug," which is the least reassuring possible answer to "who else can see this."

Rezervno's own architecture already has the discipline this incident violates: `restaurantId`/
`tenantId` must come only from the authenticated context (`ctx.restaurant.id`, `auth.tenantId`),
never from request body or query — enforced in `api/src/lib/with-restaurant-auth.ts:43,180` and
mandated project-wide in `CLAUDE.md` as an explicit anti-cross-tenant rule. **That discipline is
currently invisible to users.** It protects against exactly Fidilio's failure mode, but nobody outside
the engineering team benefits from knowing it exists.

## The mechanism

Not a blockchain, not a "verified by AI" badge — a plain, auditable receipt:

1. On a diner's reservation-detail screen (already a four-state view per `CLAUDE.md`'s UI contract),
   add a small, always-visible line: **"این رزرو فقط برای [نام رستوران] قابل مشاهده است"** ("this
   reservation is visible only to [restaurant name]") with a tappable "چرا؟" (why?) that opens one
   short screen explaining, in plain language, that reservation data is scoped per restaurant by the
   backend and never shared across restaurants or partners without the user's own action (e.g.
   sharing a reservation link themselves).
2. For restaurant owners/staff (the `apps/business` panel), add a one-line audit trail per
   reservation record: who (which staff account, which restaurant) last read or modified it, sourced
   from the existing `audit(...)` calls `CLAUDE.md` already mandates for sensitive reservation
   operations — this proposal doesn't add new audit logging, it **surfaces logging that should already
   exist** into a screen a restaurant owner can actually see, turning an internal safeguard into a
   product feature they'd tell other owners about.
3. This is a claim Rezervno can only make honestly once the CEO/`backend-integrity-engineer` confirms
   the isolation guarantee actually holds end-to-end (not just in the one wrapper function) — see
   "What I did NOT verify" below. Do not ship the UI copy before that confirmation.

## Why it wins

- This is a claim that is genuinely hard for Fidilio to copy quickly: it would require either fixing
  the underlying architecture that caused the 2024 incident, or making a similar disclosure claim
  while the incident is still recent enough to look defensive rather than confident.
- It costs Rezervno very little marginal engineering if the CEO confirms the isolation already holds
  — this is UI/copy work surfacing an existing architectural fact, not a new subsystem.
- It's evidence-backed on the competitor side (three independent outlets, on-record CEO quote) rather
  than a generic "we take privacy seriously" claim with no comparison point.

## Cost estimate

**T1–T2.** The diner-facing "چرا؟" screen is a small UI addition (`apps/customer`, one new view,
four-state compliant). The staff-facing audit-trail surface in `apps/business` is a bit larger if
`audit(...)` call coverage isn't already complete for reservation read/write paths — that part needs
`backend-integrity-engineer` to confirm coverage before `panels-ui-engineer` builds the screen showing
it. No schema changes anticipated if audit logging already exists; if it doesn't for some reservation
paths, closing that gap is itself T2–T3 work and should be scoped separately.

## Product-bar check

- **Money honesty:** N/A (not a pricing feature).
- **No dark patterns:** passes — this is disclosure, not persuasion.
- **Notification restraint:** N/A — no new notifications proposed.
- **Honest labels:** this is the whole point of the proposal — do not ship it if the underlying claim
  isn't true. If `backend-integrity-engineer` finds a real cross-tenant leak path during verification,
  **fix that first**, and this proposal becomes the announcement of the fix, not a claim made before
  it's earned.

## What I did NOT verify

- **Whether Rezervno's tenant isolation actually holds end-to-end.** I confirmed the *pattern* exists
  in one file (`with-restaurant-auth.ts`) and is *documented* as a project-wide rule in `CLAUDE.md` —
  I did not audit every route handler for a bypass, did not run a penetration test, and did not check
  whether `apps/business`/`apps/company` (classic-JS, shared scope) have any code path that reads a
  restaurant/tenant ID from a query string or form field instead of the authenticated context. This
  is exactly the kind of claim `backend-integrity-engineer` or a dedicated security pass should verify
  before any user-facing copy ships — **never assume our own feature works.**
- Whether `audit(...)` logging actually covers reservation read access today (viewing, not just
  mutating) — `CLAUDE.md` mandates it for "sensitive admin/reservation-cycle operations," which may or
  may not include plain reads. Unconfirmed this pass.
- Whether Fidilio has changed its data-handling practice since the 2024 controversy — this proposal is
  based on 2024–2025 reporting; if Fidilio has since fixed and disclosed a remediation, the competitive
  contrast is weaker than stated here. Worth a WATCH.md check before using this externally.
