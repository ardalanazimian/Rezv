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

> **Nothing costs you money or points until you have been shown it.**

This is the one claim that is `REAL` for us and `ABSENT` for four separately-profiled competitors,
including the only live Iranian one:

| Competitor | Matrix cell | What it actually means |
|---|---|---|
| **RSEE / آرسی** (Iran, live) | `ABSENT — structurally the opposite` | The diner buys chair-denominated credits *to be allowed to book*; **50–100% forfeited** on late cancellation⁵⁶ |
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

---

## 2. The three sentences

### To a Gen-Z diner

> **«جاتو رزرو کن. هیچ چیزی از حسابت کم نمی‌شه مگه اینکه قبلش دیده باشیش.»**

No adjectives. No "بهترین", no "هوشمند", no "انقلاب". It states a mechanism the diner can check in
five seconds, and it is the thing the incumbents get wrong.

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
| **Referral rewards** — «۵۰۰ امتیاز برای هر دعوت موفق» | The UI promises it; `completeReferral` has **zero production callers**, so it is never paid. **A1-005.** This promise is live in the product *right now* and is the single clearest thing we would be caught on |
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
