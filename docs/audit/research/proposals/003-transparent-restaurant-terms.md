# 003 — Public restaurant pricing, no exclusivity clause

_Status: proposed 2026-09-04 by Scout. Tiering scale note: same caveat as proposals 001–002._

## The gap

Three separate competitors this batch show the same restaurant-side commercial pattern, from three
different angles, and all three draw real friction because of it:

1. **OpenTable (global, April 2026):** updated its client agreement to require partner restaurants to
   make OpenTable their "primary system of record" for reservations/tables/guests, with all inventory
   available on its own marketplace. OpenTable claims this "won't block" multi-platform use, but
   restaurants using another platform too would have to manually re-enter reservations to avoid
   double-booking — a soft lock-in. This drew a formal complaint to Washington State's antitrust
   division, which responded: *"We take complaints received from the public very seriously, and we
   will review your letter to determine if OpenTable's new terms of service may constitute an
   anticompetitive practice."* (`docs/audit/research/profiles/opentable-resy-sevenrooms.md` §OpenTable.)
2. **SmartX (Iran):** several of its product-line prices are not published — the pricing page requires
   restaurant owners to submit contact info for a quote on some tiers, and two different sourced
   figures for its "Smart WiFi" pricing tier could not be reconciled in this pass, meaning even the
   figures that *are* published aren't fully trustworthy. (`docs/audit/research/profiles/smartx.md`
   §"Business model & pricing.")
3. **Fidilio (Iran):** the restaurant-side commission percentage is undisclosed anywhere — "detailed in
   the contract agreement" only. Fidilio's own marketing claims ("12,500+ restaurants... 4.9-star
   rating") are also inconsistent with the independently-observable Cafe Bazaar aggregate (3.7/5, 578
   ratings), a second, separate transparency problem on top of the pricing opacity.
   (`docs/audit/research/profiles/fidilio.md` §"Business model & pricing.")

What a restaurant owner loses in all three cases: they cannot compare the real cost of joining a
platform before committing, and in OpenTable's case, they additionally lose the ability to leave
cheaply once they've integrated their operations around it. This is the same "money respect" failure
the Gen-Z lens applies to diners, applied to the *other* customer Rezervno has — the restaurant.

## The mechanism

Not a marketing promise — two concrete, checkable commitments:

1. **A public pricing page with a worked example**, the way Eat App and Servme already do in the
   global set studied this batch (flat tiers, explicit "no per-cover fee," a calculator showing cost
   at a stated monthly reservation volume) — no tier that requires "contact us" to learn the price.
   `apps/landing` already has the CMS/page infrastructure to host this (`apps/landing/lib/cms-page.tsx`
   exists) — whether a pricing page is already live there was **not verified this pass** (see below);
   if one exists but has "contact us" tiers, this proposal is "fix the existing page," not "build a
   new one."
2. **A contract commitment, in plain language on the same page, that Rezervno will never require a
   restaurant to make Rezervno its exclusive or "primary" system of record** as a condition of using
   the product — the direct opposite of OpenTable's April 2026 clause. This costs nothing technically
   and is cheap to state now, before Rezervno has enough market power for the temptation to exist —
   which is exactly when a credible "we won't do that" claim is easiest to make truthfully.

## Why it wins

- The Washington State antitrust division's response is not marketing spin — it is a live, 2026,
  ongoing regulatory concern about the exact clause type this proposal commits Rezervno to avoiding.
  That makes "we don't do that" a claim with a real, currently-newsworthy contrast, not a strawman.
- Fidilio's rating discrepancy (4.9 marketing vs. 3.7 independently observed) is a comparison point:
  Rezervno can win simply by having its stated numbers and its observable numbers match — a low bar,
  but one at least one major domestic competitor currently fails.
- SmartX's and Fidilio's opacity mean a restaurant owner shopping between local options today cannot
  build an apples-to-apples cost comparison at all — being the one Iranian option with a real,
  checkable price list is a distinct, defensible position, not just "cheaper."

## Cost estimate

**T1**, if a pricing page already exists in `apps/landing` and just needs the "contact us" tiers and
the exclusivity-commitment line added. **T2** if the page needs to be built from scratch. No backend
schema work anticipated — this is a landing-page/content change plus (optionally) a real Terms of
Service update, which is a legal/business decision for the CEO/founder, not an engineering one, though
`contracts-consolidation-engineer` or the landing-page owner would implement the page itself.

## Product-bar check

- **Money honesty:** this proposal *is* the money-honesty fix — passes by construction.
- **No dark patterns:** passes.
- **Notification restraint:** N/A.
- **Honest labels:** requires that whatever numbers go on the page are the real, current numbers —
  do not publish a pricing page that itself becomes a second "4.9 stars vs. 3.7 observed" discrepancy.

## What I did NOT verify

- **Whether `apps/landing` already has a live, public pricing page today**, and if so, what it says.
  I confirmed the CMS infrastructure exists (`apps/landing/lib/cms-page.tsx`,
  `apps/landing/lib/site-schema.ts`) but did not check rendered content or search for existing pricing
  copy. **This must be checked before treating this as new work** — if a transparent pricing page
  already exists, this proposal reduces to "add the exclusivity-commitment line."
- Rezervno's actual current commercial terms with any restaurant already onboarded — whether an
  exclusivity clause already exists or was ever discussed is unknown to Scout; this proposal assumes
  none exists today and recommends formalizing that as a stated commitment, not assuming the current
  state.
- OpenTable's own claim that the "system of record" clause "won't affect" multi-platform use in
  practice — reported as disputed by restaurant owners, but Scout did not find a resolved outcome
  (e.g. a court ruling) as of this pass; the Washington State inquiry was still at the "we will review
  your letter" stage.
