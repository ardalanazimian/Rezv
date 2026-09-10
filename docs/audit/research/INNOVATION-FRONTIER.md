# INNOVATION-FRONTIER — what's coming that nobody in Iran has shipped yet

_Scout · 2026-09-09 · target `rezv-9c [5283b5]` (re-resolve via ROUTING.md). Answers the founder's
fourth ask directly: **not parity — "OpenTable has it" is not a reason.** Every idea below is anchored
either to something Rezervno's own repository already half-builds (so the moat is finishing real
infrastructure, not inventing it) or to a documented gap no competitor profiled has closed. Per
`rezervno-audit-constitution` and the Gen-Z charter's rule #3: nothing here is called "AI" or «هوشمند»
unless a model actually produces the number — every mechanism below states plainly whether it is a
rule or a model._

---

## 1. Tell the diner *why* — turn the no-show risk engine that already exists into the first
transparent risk-disclosure in this market

**What already exists, verified this pass:** `Reservation.noShowRiskScore` / `noShowRiskTier` /
`noShowRiskSource` (`api/prisma/schema.prisma:527-532,556,560`) is a real, live scoring system with
genuine provenance discipline — `api/src/lib/no-show-provenance.ts` explicitly distinguishes `learned`
(a trained model produced the score), `heuristic` (a rule did), and `unknown` (pre-migration-080 rows
with no real source), specifically because an internal 2026-09-04 audit found two call sites both
labeling heuristic scores "smart" without saying which kind they were. That fix is real, committed, and
already stricter than anything found in any competitor's marketing this pass. **But it is entirely
internal today** — a targeted grep across `apps/customer/js/` for `noShowRisk` found zero references.
The diner whose deposit requirement or waitlist priority the score quietly influences never sees it.

**The gap, evidenced:** every no-show-fee mechanic studied in this programme is punitive and
undisclosed until the moment of charge — OpenTable/Resy no-show fees "$25–50/person," Resy's up to
"$100/person" called "obscene" by a reviewer (`profiles/opentable-resy-sevenrooms.md`), TheFork's own
1-star cluster on undisclosed charges (`ANTI-PATTERNS.md` #2, 10% of a 21-review sample). **Nobody
studied shows the diner *why* a booking was flagged, deposit-required, or waitlist-deprioritized.**
That is exactly the Gen-Z-lens trust question this mandate names directly: *"When it decides something
about me — a deposit, a waitlist position, 'no tables' — does it tell me why, or just assert?"*

**The mechanism:** when a reservation's flow is shaped by `noShowRiskTier` (a deposit is requested, a
booking needs confirmation, a waitlist offer is delayed), surface a short, honest, source-labeled
reason to the diner — e.g. "این رزرو نیاز به تأییدِ اضافه دارد چون [قانونی که واقعاً اعمال شده]" if
the source is `heuristic`, never dressed up as a personalized "smart" read of the individual user if
it isn't one. If the source is `learned`, it can say a model was involved — but per the audit
constitution's own rule, only if that is literally true for that row, and `unknown` rows must never be
attributed to either. This is not a UI skin on an opaque score; the whole value is that the disclosure
is exactly as honest as the underlying `RiskProvenance` type already is.

**Why competitors can't easily copy it:** none of the profiled competitors were found to have built the
provenance-tagging layer at all (`learned`/`heuristic`/`unknown` as a first-class, queryable
distinction) — it would need to exist before it could be disclosed honestly. Building the disclosure
UI is cheap; building an honest thing to disclose, without AI-washing it, is the part this repository
already did the hard version of, by accident, while fixing an unrelated bug.

**Cost estimate:** T2. No new schema (all three risk columns exist). Work is: a customer-app surface
(booking confirmation / detail screen) reading `noShowRiskSource` and rendering a source-appropriate,
honest string; a copy-review pass to make sure no phrasing implies a personalized "AI read" for
`heuristic`/`unknown` rows. Needs `contracts-consolidation-engineer` for the customer-app surface,
and whoever owns the AI-labeling honesty rule (per the constitution, likely the same reviewer who
caught the original 2026-09-04 finding) to sign off on copy.

## 2. A cross-restaurant "dining passport" the diner owns and can screenshot

**What already exists, verified via `PARITY-RISK.md` #4 (re-confirmed, not re-derived here):**
`GuestProfile` (`api/prisma/schema.prisma:1300-1319`) already computes `globalVisits`,
`restaurantsVisited`, `isVipAnywhere`, `dietaryTags` — a genuine cross-restaurant profile — but it is
wired only into customer-facing personal-profile code (`api/src/app/api/v1/me/profile/route.ts`,
`dna-summary.ts`), never into any restaurant-staff surface (that gap is proposal territory already
tracked in `FEATURE-OPPORTUNITIES.md` #1). This idea is the *other* direction: make the same data a
diner-facing, shareable artifact instead of (or in addition to) a staff tool.

**The gap:** every Iranian competitor studied (Fidilio, SmartX, Foodism) builds loyalty as a
single-restaurant or single-operator construct — SmartX's "Customer Club" is sold restaurant-by-
restaurant to operators, not owned by the diner across restaurants. None was found to give the diner a
cross-venue identity of their own. Per the Gen-Z charter's shareability question ("is there anything I
would screenshot — a tier card, a streak, a booking that looks good in a story?") — a card showing "۱۲
رستوران، ۴۷ بازدید، عضو از ۱۴۰۳" is a fundamentally different artifact from a single restaurant's
punch-card, and nothing studied in Iran currently produces one.

**Why competitors can't easily copy it:** it requires cross-restaurant data infrastructure most
single-operator SaaS tools (SmartX, Fidilio) are not structurally positioned to build — their business
model sells the CRM *to* a restaurant, so a cross-restaurant view is not natural for them to offer a
diner even if they wanted to. Rezervno's marketplace position (many restaurants, one diner identity)
is the structural precondition this idea needs, and it already exists in the schema.

**Cost estimate:** T2–T3 depending on scope (a static shareable card vs. a live, updating profile
screen). No new backend computation — `GuestProfile` already produces the numbers; the work is a
diner-facing render and a share/export path. **Product-bar check:** must not leak cross-restaurant
data about a diner *to* a restaurant beyond what that restaurant should see (this is exactly the class
of undisclosed cross-platform data flow named as anti-pattern #13, Fidilio/SnappFood address-sync and
breach incidents) — the passport is diner-owned and diner-shared, never restaurant-pushed.

## 3. Reviews that can only exist if a reservation actually completed — closing the trust gap RSEE and
Fidilio structurally cannot close

**The gap, evidenced:** `corpus/rsee/store-reviews.md` — zero independent reviews found for RSEE by
any session, on any platform, ever. `corpus/smartx/store-reviews.md` — zero, confirmed independently
twice. Fidilio has exactly six reviews found across the whole research programme, three of them
reporting the *same* login-blocking bug 28 days apart, still unfixed
(`STATUS-2026-09-07.md`). **The Iranian reservation category has almost no independently-verifiable
review signal at all** — which is a trust vacuum a diner-facing platform sits inside, not something
any competitor has solved.

**The mechanism:** gate the ability to leave a review on a Rezervno-facilitated booking behind that
booking actually having completed (status `arrived`/completed, not merely `confirmed`) — a structural
property a reservation platform can enforce that a pure discovery/directory app (Fidilio's original
16-year business, still its core identity) cannot, because a directory has no record of whether the
visit happened at all. This is not a novel UX pattern globally (OpenTable and Resy already gate
reviews behind a completed booking, per general industry knowledge — **not independently re-verified
this pass, flagged as an assumption to check**), but **no Iranian competitor studied does it**, and
doing it honestly (never silently dropping a negative review, per `ANTI-PATTERNS.md` #8's TheFork
finding on review-suppression) would make Rezervno's review corpus, once it exists post-launch, more
trustworthy by construction than any Iranian alternative's.

**Why this is forward-looking, not parity:** the point is not "have reviews" (parity) — it is that a
review tied to a verified completed booking is a fundamentally different trust object than an
app-store star rating, and building the review *surface* around that constraint from day one (rather
than bolting verification on later) is the kind of decision that is genuinely hard to change after
launch, per the founder's own framing.

**Cost estimate:** T2. Ties into whatever review/rating surface is already planned or partially built —
Scout did not find an existing review-writing feature in the customer app to audit against (only
seed-data sample reviews in `seed.js:60`, which are demo content, not a real review-submission path).
**Flagging explicitly: this proposal assumes no real review-submission feature exists yet in
`apps/customer/js/`; if one does and was missed, the gate should apply to it rather than requiring new
UI.** If a new agent capability is needed, it is not a new *agent* — it's confirming with whoever owns
the customer-app review surface (if any) before scoping the actual build.

---

## What did NOT make this list, on purpose

- **AI-driven personalized recommendations** — every competitor and every internal mention of "smart"
  anything in this research programme has turned out, on inspection, to be a plain rule or a sort
  (`FEATURE-OPPORTUNITIES.md`'s own self-audit finding on `notifications.js`'s "پیشنهادِ هوشمند"). Not
  proposing a new AI feature here; proposing that the one real learned/heuristic distinction that
  already exists (no-show risk) be surfaced honestly rather than adding a new unverified "AI" claim.
- **Any mechanic requiring the diner to pay for the right to book** — the RSEE model. Named explicitly
  in `ANTI-PATTERNS.md` #3 as the worst money-respect finding in the whole programme; never propose it.
- **WhatsApp-native anything** — already ruled out in `PARITY-RISK.md`'s "what did NOT make this list"
  section, because WhatsApp is not reliably reachable inside Iran.

## What I did NOT verify

- Whether OpenTable/Resy actually gate reviews behind a completed booking (§3) — stated as general
  industry knowledge, not independently re-fetched and confirmed this pass. Treat as an assumption to
  check, not a citation.
- Whether a real review-submission feature already exists in `apps/customer/js/` that §3's proposal
  should attach to rather than duplicate — a targeted search found only demo seed data, not
  exhaustive.
- The actual engineering cost of any of the three ideas beyond Scout's rough T-tier guess — an
  architect or the relevant engineer sizes the real work, per this programme's own standing rule.
- Whether diners would actually value a shareable cross-restaurant passport (§2) enough to use it —
  no user research exists for a pre-launch product; the case rests on the Gen-Z charter's shareability
  heuristic and the structural argument that no Iranian competitor's business model can easily copy it,
  not on measured demand.
