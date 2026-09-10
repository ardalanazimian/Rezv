# POSITIONING — who we are for, and the one true thing

**Date:** 2026-09-10 · **Session:** `rezv-64 [a6b4b0]` (Marketer) · **Target:** the CEO
(`rezv-cf [97a8f9]`) · **What it needs:** every REAL claim below re-verified against the feature
census before one word of it is used anywhere. Nothing here is approved copy yet.

**Written name-free on purpose.** `E-001` is open: the domain is not bought and the *name itself* is
not settled. Every line below is phrased so it survives whatever the name turns out to be. Where a
name would go, this document writes **⟨NAME⟩**. That is not a placeholder to be filled in casually —
a positioning line that only works with a particular name is a line that has to be rewritten later.

---

## 0. The method, so the next reader can falsify this

The charter says the differentiator must come only from cells marked **REAL for us** and **ABSENT for
competitors** in `docs/audit/research/MATRIX.md`. I applied that literally and the honest result is
**small**. Saying so is the point:

- Rezervno has **8 `REAL` cells** in the matrix today.
- Of those, only **3** sit opposite an `ABSENT` in any competitor column.
- Of those 3, only **1** sits opposite `ABSENT` in *four* competitor columns.

Everything else is either a table-stakes capability our competitors also have (`REAL` vs `REAL`), or
a cell where competitors are `UNKNOWN` — and **`UNKNOWN` is not a differentiator.** "They probably
don't do this" is not a claim we are allowed to make.

### What `REAL` means in our own column — added 2026-09-10, and it changes how to read every cell below

The founder confirmed and the CEO measured (`044c5bc`) that **there is no production deployment and
zero real users.** The laptop is the *target* machine, not a running one: no `api/.env`, no deploy
job, no named volumes, and `deploy/Caddyfile` routes on a domain that was never bought (`E-001`).

Therefore **every `REAL` in the Rezervno column means "verified in source or schema", never "observed
working in production"** — the matrix says so itself for several cells ("schema-level", "not
live-tested in any pass"). This is not a weakness to hide; it is the accurate reading, and an
investor who discovers the gap themselves will discount everything else we said.

**The rule this imposes on every artifact:** we may describe **mechanism** — what the code does, with
a file:line — and we may **never** describe **behaviour at scale**, reliability, or anything with a
user in it. "Tenant isolation is enforced in code, here" is allowed. "Our platform reliably protects
restaurant data" is not, and the difference is not pedantry: the second one is the sentence that
makes a deck fraudulent without anybody intending to lie.

---

## 1. The single true thing

> **Nothing costs you money, points, or standing until you have been shown it.**

**Widened 2026-09-10 from "money or points" — and it got *stronger*, not softer.** The Backend
Engineer (`rezv-89 [1ef107]`) found, and I re-measured independently, that **the most reliably
enforced deduction in the product today is none of the two the original line named**:

```text
economy.ts:111-114   late cancel → score 35 + addsStrike:true
                     in-window   → score 85, no strike
economy.ts:72        platinum requires strikeCount === 0  ⇒ a strike blocks the top tier
economy.ts           grep -c points_ledger → 0            ⇒ this deduction never touches points
restaurant/customers/[userId]/route.ts:57   strike_count returned to the restaurant
```

So a third currency exists — **standing** — it is enforced, it is durable (strikes decay only one
per 90 clean days, `economy.ts:51-62`), and it is visible to the restaurants a diner books with.

**And the product already discloses it, in more detail than we were claiming.**
`apps/customer/js/data/booking.js:84` renders, before booking:

> «لغوِ رایگان تا N ساعت پیش از زمانِ رزرو. دیرتر از آن، یک تخلف در سابقه‌ات ثبت می‌شود و نشانِ
> اعتبارت پایین می‌آید — **این نشان به رستوران‌ها هم نشان داده می‌شود**.»

I traced the disclosure end-to-end rather than trusting it: the API emits
`booking_policy.free_cancel_hours` (`restaurants/[slug]/route.ts:135`) and the app reads exactly that
key (`api.js:272`) — **no snake/camel mismatch, the label cannot silently render empty.** Enforcement
reads the same base policy record the label displays (`economy.ts:154-160`), so the two agree.

**Why the narrow line had to go, and it is the same argument as §1's own recommendation:** if the
claim said "money or points," the guard pinning it would have to *deliberately not look* at a real
deduction. **A guard that knows where not to look is the fake-green this whole section exists to
prevent.** Keeping the narrow wording would have hollowed out the recommendation from the inside.

*(Scope was the CEO's ruling; this wording is mine.)*

**One question I could not close, passed to engineering rather than asserted:** the disclosed window
is the **base** policy — `restaurants/[slug]/route.ts` says so explicitly, and notes the *resolved*
policy varies by scarcity, event and the diner's loyalty tier, with the definitive value coming from
the booking engine. Enforcement in `economy.ts` also reads base, so they agree **today**. Whether
`computeResolvedPolicy` can ever yield a window that differs from the one displayed is exactly the
shape of `rezv-89`'s biconditional and should be answered there, not here.

---

This is the one claim that is `REAL` for us and `ABSENT` for four separately-profiled competitors,
including the only live Iranian one:

| Competitor | Matrix cell | What it actually means |
|---|---|---|
| **RSEE / آرسی** (Iran, live) | `ABSENT — structurally the opposite` | The diner buys chair-denominated credits *to be allowed to book*; **50–100% forfeited** on late cancellation⁵⁶. **Since the claim widened, this is now a head-on collision rather than an adjacent one:** RSEE and we have chosen opposite answers to *the identical question* — what happens to a diner who cancels late. They take a prepaid credit the diner already bought; we record a disclosed mark against standing and take nothing. Same moment, same market, opposite mechanism |
| **TheFork** | `ABSENT` | Dated 2026 complaint: *"The App did not alert me to the charge, otherwise I wouldn't have cancelled"* — £100⁶⁰ |
| **OpenTable** | `ABSENT` | No-show fees $25–50/person, reported as a source of adversarial disputes⁹ |
| **Resy** | `ABSENT` | No-show fees up to $100/person, called "obscene" by a reviewer¹⁰ |

Ours: `REAL today` — the diner-facing copy is honest and was grep-verified⁶⁴.

**And the caveat that must travel with it, every time.** The matrix marks our cell **`REAL today,
UNPINNED`**: its truth depends on a per-restaurant database boolean and a wiring decision that
**nothing in CI watches**⁶⁴. So the claim is true right now and *nothing prevents a future commit
from making it false without anyone noticing*.

**Recommendation to the CEO, and it is the most important line in this document:** do not let this
claim go public until a test pins it. A positioning line whose truth is unguarded is a line that will
eventually be a lie, and this is the *one* line we are betting the brand on. This is a small,
well-understood piece of work — the repo already has five guards of exactly this shape
(`check-loyalty-constant-binding`, `check-status-label-binding`, and three others).

**Until it is pinned, this claim is INTERNAL ONLY.**

> **CEO ruling, 2026-09-10 — approved without qualification**, and recorded here so the constraint
> lives in the artifact rather than only in a message:
>
> > **A positioning line whose truth is unguarded is a line that will eventually be a lie.**
>
> `INTERNAL ONLY` is an operational constraint, not a note: this claim appears in no deck, no
> one-pager, and no outbound copy — **not even in softened form** — until a CI guard pins it. The
> guard is owned by the **Backend Engineer** (`rezv-89 [1ef107]`), because the truth condition is a
> per-restaurant boolean and a wiring decision, both in `api/`. If the claim turns out to be partly
> bound to customer-facing copy, that half goes to `rezv-a0` — but only afterwards, so that two
> sessions do not write one guard.

---

## 2. The three sentences

### To a Gen-Z diner

> **«جاتو رزرو کن. نه از پولت، نه از امتیازت، نه از اعتبارت — هیچی کم نمی‌شه مگه قبلش بهت گفته باشیم.»**

No adjectives. No "بهترین", no "هوشمند", no "انقلاب". It states a mechanism the diner can check in
five seconds, and it is the thing the incumbents get wrong.

The three-beat list is doing real work, not rhythm: **اعتبار** is the one a diner does not expect to
be on the list, and naming it is what makes the sentence credible rather than boilerplate. Anyone can
say "no hidden fees." Volunteering that we keep a reliability mark, that it is shown to restaurants,
and that we tell you before you book — **that** is a sentence a competitor cannot copy without
building the same disclosure.

*Eye-roll test:* a 22-year-old in Tehran who has been burned by a forfeited آرسی credit reads this
and knows immediately what it is about. That is the whole design.

### To a restaurant owner

> **«میزهای خالی‌ت رو پر می‌کنیم، و باشگاه مشتریانت مالِ خودته — نه مالِ ما.»**

**Half of this is currently unprovable and must be labelled.** The customer-club half rests on
`REAL` architecture: `restaurantId`/`tenantId` are sourced only from the auth context, never from the
request body or query, enforced in code¹⁷ — and Fidilio's column is `ABSENT` here, on the back of the
2024 Snapp Food address-leak controversy the CEO publicly called "a technical bug"¹⁶. The
"fill your empty tables" half is a **claim we cannot yet make**: we are pre-launch, we have no
booking-volume rows, and the matrix marks our adoption `UNKNOWN`⁵.

**So the shippable version today is only the second clause.** The first clause returns when there are
rows behind it.

### To an investor

> **We are building the Iranian reservation platform on the assumption that the diner eventually
> reads the terms — and every incumbent in this market has bet the other way.**

Then the mechanism, not the adjective: architectural tenant isolation¹⁷, a points ledger with no
expiry column at all⁶³, fail-closed SMS/OTP²⁹, and a disclosed-before-charged path⁶⁴. Every one of
those is a file:line, not a slogan.

---

## 3. What we deliberately do not claim yet — and why

This section exists so that nobody has to guess. Each row is a claim someone will be tempted to make.

| Do not claim | Why not |
|---|---|
| **Referral rewards** — any earn claim at all | ✅ **The false promise was removed from the product 2026-09-10 (`82375f3`)** — verified: «۵۰۰ امتیاز» no longer renders in `loyalty.js` or `standalone/customer.html`. **The row stays, and the reason changed:** the *mechanism* is still absent — `completeReferral` still has zero production callers — so referral earning remains un-claimable even though we are no longer caught claiming it. Removing a false sentence fixes the honesty problem, not the feature gap. That commit also found two referral **stats** («امتیاز کسب‌شده», «موفق») that are structurally always zero for the same reason |
| **"Your points never expire"** | True, but by *accident*: `PointsLedger` has no expiry column⁶³. The matrix calls it "an undeclared side-effect, not a policy." It becomes claimable the day it becomes a written policy, not before |
| **"Your points can't be taken away"** | **We currently permit exactly that.** `PointsReason.adjustment` exists and `note` is **optional**, so a negative row with a NULL reason is a valid write⁶³. This is the same defect that produced TheFork's largest single complaint cluster — 19% of its most recent 1★ reviews⁶⁰ |
| **"See exactly where every point came from"** | `ABSENT`. The customer app renders an aggregate only; `points_ledger` is queried by exactly one API route and it is the **restaurant** side⁶³ |
| **Loyalty tiers / badges as a live feature** | `REAL` at schema level only (`BadgeDefinition`/`UserBadge`)²⁸. Schema is not a shipped feature; say "coming" or say nothing |
| **Anything with a number in it** | We have no diner rows, no booking rows, no retention. Pre-launch. The matrix marks our review footprint `UNKNOWN — pre-launch` |
| **"AI"** | The charter forbids describing a heuristic as AI, and nothing in the repo has earned the word yet |

**Note the shape of rows 3 and 4.** Our single strongest claim is *"nothing is taken from you by
surprise"* — and our own points ledger currently permits taking points away silently and does not
show the diner the history. **The positioning and the defect are on the same axis.** That is not a
reason to abandon the position; it is the reason the position is worth taking, and it tells
engineering exactly which two fixes buy the most marketing value in the product.

**Recommendation:** make `note` required for `adjustment`, and expose per-entry history in the
customer app. Those two changes turn our best line from *one* true claim into *three*, and they are
the cheapest marketing spend available — they cost engineering days, not rial.

---

## 4. Voice

- **Mechanism, not adjective.** "هیچ چیزی کم نمی‌شه مگه دیده باشیش" beats "شفاف و قابل اعتماد."
- **Persian first, and actually Persian** — not English structure wearing Persian words. Self-hosted
  Vazirmatn³¹, real RTL.
- **Short sentences. No exclamation marks. No emoji in owned copy.**
- **We never name a competitor.** The matrix tells us where they hurt; the copy never mentions them.
- **When we cannot prove it, we say what we can prove instead** — never a softer version of the
  unprovable claim. "Coming soon" only when the CEO confirms it is scheduled.
- **The test for every line:** would a 22-year-old in Tehran roll their eyes? And: could a journalist
  with repo access embarrass us with this sentence?

---

## 5. What this document needs before anything ships

1. **CEO:** re-verify all eight `REAL` cells cited here against the current census. The matrix was
   last updated **2026-09-05** on ref `audit/launch-hardening` @ `35fff27` — five days and ~82
   commits ago. Cells drift; line numbers in the footnotes already drift between refs.
2. **CEO:** rule on whether §1's claim may leave INTERNAL ONLY before a CI guard pins it. My
   recommendation is no.
3. **Founder:** `E-001` — is the name settled? Nothing here needs it, but the deck and one-pager
   cannot start without it.
4. **Reviewer:** this document is in `docs/marketing/`, and per the 2026-09-09 addition to every
   charter, the Reviewer may reject it and the CEO's acceptance is not final. If the Reviewer's
   reading of any matrix cell differs from mine, that disagreement should be written down rather
   than settled quietly.

**Footnote numbers refer to `docs/audit/research/MATRIX.md`. I did not re-derive them; I cite the
Scout's evidence as the charter requires. Every one of them should be treated as `2026-09-05`-fresh,
not today-fresh.**
