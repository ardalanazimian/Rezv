# PARITY-RISK — what competitors have that users value, and we don't yet

_Maintained by Scout. Last updated: 2026-09-07. Synthesized from the nine profiles and the matrix on
file as of this date — `profiles/fidilio.md`, `profiles/smartx.md`, `profiles/foodism.md`,
`profiles/opentable-resy-sevenrooms.md`, `profiles/servme.md`, `profiles/snappfood-loyalty.md`,
`profiles/thefork.md`, `profiles/iran-reservation-longtail.md`, `recon-notes-global.md`, and
`MATRIX.md`. No new competitor research was performed to write this file — see
`§0 reporting target` below for why this batch's effort went here instead._

> **§0 — reporting target.** This batch's brief named `rezervnofullsource-d9 [8dde6c]` as the
> reporting target. `ListAgents` shows no reachable session by that name in this environment as of
> 2026-09-07 — **UNKNOWN — not verified**, per this file's own instruction not to guess. Routed to
> `docs/audit/research/` regardless, as instructed.

> **Methodology and its limit.** "Ranked by how often users mention it" is only honest where an
> actual count exists behind the ranking. Where a gap is grounded in counted mentions (a review
> corpus, a complaint frequency), that count is given and the rank reflects it. Where a gap is
> grounded in a competitor's own stated mechanic or a Gen-Z-lens judgment call rather than a counted
> volume of user praise, it is marked **[structural]** and placed by severity of consequence, not by
> a mention count that does not exist — inventing a count would be exactly the fabrication this
> programme exists to avoid. Every Rezervno-side cell is either a direct code/schema citation or
> `UNKNOWN — not verified`; none is assumed from a doc's claim.

---

## Ranked

### 1. A public, self-serve restaurant price list with no "contact us" wall — [structural, but now the confirmed market norm on both sides]

**Who has it:** OpenTable, Resy, Servme (all three tiers, $129–299/mo), RSEE (۹۹۰,۰۰۰–۳,۹۹۰,۰۰۰
تومان/year, no sales call), and — corrected this batch — **SmartX**, which does publish a full
Toman price list at `smartx.ir/pricing` (only intermediate volume bands route to a sales line).
**Who doesn't:** SevenRooms (no public pricing at all), TheFork (`/restaurant` and `/restaurants`
paths 404, three contradictory third-party figures), Fidilio (commission undisclosed), Foodism
(contact-only ad packages), Sepidz (price-list-on-request).

**Why it's #1, not just present:** this is no longer "OpenTable does it, so what" — it is now the
**Iranian norm**, not a Western import. RSEE and SmartX both publish real Toman figures on public
pages. A restaurant owner in Tehran comparing options today can already see two competitors' numbers
without a phone call. `proposals/003-transparent-restaurant-terms.md` already targets this; this
batch's finding **raises its priority** from "differentiator" to "table stakes we may already be
behind on."

**Rezervno:** `MATRIX.md` — `UNKNOWN — not checked this pass`. Whether `apps/landing` already has a
public pricing page was flagged as unverified in proposal 003 and remains unverified here. **This is
the single fastest gap to close or confirm already closed** — it needs one repo check, not new
research.

### 2. A published, single-sentence, generous loyalty expiry policy — grounded in counted complaint volume, inverted

**Who has it:** TheFork's YUMS: *"Yums are valid for one year. They can be exchanged until the last
day of the month in which they expire."* One sentence, no tiers, no asterisk. SnappFood's Snapp Club:
a flat pool, fixed biannual reset (end of spring/fall), no per-tier divergence.

**Why it ranks by an inverted count:** the count behind this isn't praise for the policy — TheFork's
own 21,638-review Trustpilot corpus, read 21-deep on the 1-star band, contains **zero** complaints
about the expiry clock itself. The clock is not what breaks. What breaks (4/21, 19%, see
`ANTI-PATTERNS.md` #1) is a *different, unpublished* mechanic — silent balance confiscation on
suspension. That absence-of-complaint is itself the evidence: a clearly stated policy removes an
entire complaint category that shows up elsewhere in this research set (Starbucks' 2026 tier-expiry
backlash, Chipotle's litigated 180-day policy).

**Rezervno:** `PointsLedger` has **no expiry column at all**
(`api/prisma/schema.prisma:672-686` on `audit/launch-hardening@35fff27`; `:664` on `main` —
per `profiles/thefork.md` and `proposals/005-no-silent-taking-points-ledger.md`). That is generous by
accident, not by policy — nothing publishes it, nothing commits to keeping it true, and
`proposals/005` names exactly why an unpublished absence is not the same protection as a stated
promise. **The gap is not the mechanic. It's that nobody has been told.**

### 3. A native, free, low-barrier top loyalty tier — [structural — Gen-Z lens finding, not a counted complaint]

**Who has it:** OpenTable Regulars — Gold status at just 6 reservations in 12 months, free, unlocks
earlier notify-me access. **Who conspicuously doesn't:** Resy (best perks require a $325–895/yr Amex
card — the opposite of low-barrier); TheFork (deliberately has **no tiers at all**, which is a
different, arguably better answer — see `ANTI-PATTERNS.md` for why tiers themselves are not the
enemy, asymmetric ones are).

**Rezervno:** `MATRIX.md` — `UNKNOWN — no tier-threshold policy found this pass`. `BadgeDefinition`/
`UserBadge` models exist at the schema level (`api/prisma/schema.prisma:2087,2101`), so the mechanism
to build this is already there; whether any threshold has been designed or shipped is unverified.

### 4. Cross-visit CRM personalization ("remembered by name") — [structural — repeated across three unrelated competitor categories]

**Who has it:** SevenRooms (its central pitch — G2-quoted: *"puts all the data in the hands of the
business"*), Servme (corroborated by a **named, checkable customer** — Hyatt Regency Dubai, 88,000
guest profiles over 3 years), SmartX (Customer Club — CLAIMED depth, undisclosed real usage). Three
structurally different companies (global B2B infrastructure, MENA regional SaaS, Iranian B2B) converge
on the same pitch, which is itself signal that restaurant owners want this regardless of geography.

**Rezervno:** `MATRIX.md` — `UNKNOWN — not verified this pass`, across every row of the Reservation &
commercial-terms table. `CLAUDE.md`'s protocol §§3–11 describes a customer-profile/allergy/birthday
data foundation as an existing requirement — **whether it is actually built and whether it does
cross-visit recognition the way SevenRooms/Servme do is unverified by Scout and needs a repo check**,
not assumed from the protocol document existing.

### 5. A quantified referral mechanic — [structural — single strongest shareability finding in the whole programme]

**Who has it:** TheFork — "500 Yums when a friend makes their first booking," identified in
`profiles/thefork.md`'s Gen-Z scorecard as *"the strongest [share incentive] in this research set."*
No other competitor profiled has a comparably concrete, quantified referral reward.

**Rezervno:** No referral mechanic found or verified in any profile or matrix row. `UNKNOWN — not
verified`.

### 6. An independent, third-party-reviewable footprint — [structural — pre-launch, not closeable now]

**Who has it, at scale:** TheFork (21,638 Trustpilot reviews, 4.4/5), OpenTable (~190K Google Play),
Resy (~15.7K), Fidilio (581 votes, 110,000 installs, read first-hand this batch), SnappFood (Myket
4.3/5 across 19,209 comments).

**Rezervno:** pre-launch — `UNKNOWN` by construction, not by gap. **Listed for completeness and to
name what "no reviews yet" costs us relative to every competitor studied, not as a near-term action
item.** The honest framing: this becomes a real parity risk the day a competitor with a review corpus
launches in the same city before we do, not before.

---

## What did NOT make this list, on purpose

- **WhatsApp-native messaging (Servme).** `profiles/servme.md` names this as Servme's core MENA
  differentiator, but its own text is explicit that WhatsApp is not reliably available inside Iran the
  way it is in the Gulf. Copying the *channel* would be the wrong lesson; `proposals/004` already
  extracts the right one (build the regional constraint into the product, not the specific app).
  Including WhatsApp here as a literal parity gap would be exactly the "propose parity for its own
  sake" mistake this programme is built to avoid.
- **RSEE's table-level selection and public pricing.** Its pricing already appears at #1. Its
  table-level slot picker is real (`profiles/iran-reservation-longtail.md` "What to steal") but is a
  UX mechanic, not something users are on record valuing by name — no complaint or praise corpus
  exists for RSEE at all (the single largest gap flagged in batch 3). Listing it here would rank a
  feature nobody has actually said they want, which is marketing-reasoning, not user evidence.

## What I did NOT verify

- Whether `apps/landing` has a live pricing page today (item #1) — flagged as the fastest-to-resolve
  unknown in this file and in `proposals/003`.
- Whether Rezervno's customer-profile system does cross-visit CRM recognition today (item #4) — the
  schema/protocol exists per `CLAUDE.md`; whether it's wired end-to-end is unconfirmed by Scout.
- Whether a tier-threshold or referral mechanic exists anywhere in `apps/customer` outside what prior
  batches grepped (`apps/customer/js/features/loyalty.js`) — not re-checked this pass.
- This file ranks by the best available proxy for "how often users mention it," not a uniform count
  across all six items — three are grounded in actual review volume, three are grounded in structural/
  Gen-Z-lens judgment and marked as such. Do not present the ranking as more precise than it is.
