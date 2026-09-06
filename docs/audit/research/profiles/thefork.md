# TheFork (LaFourchette) — deep profile

_Written 2026-09-05 by Scout (batch 3). Flagged as the next Tier-2→Tier-1 promotion in
`BRIEF-2026-09-05.md` because TheFork is mid-acquisition by American Express, which would make it the
**third** Amex-owned reservation brand alongside Resy and Tock._

> **Methodology note — this profile is different from batches 1–2.** `WebFetch` was blocked for every
> external domain in batches 1 and 2; every quote in `profiles/opentable-resy-sevenrooms.md`,
> `profiles/servme.md` and `recon-notes-global.md` therefore came through `WebSearch`'s own
> server-side synthesis. **In this session `WebFetch` works.** Everything below marked `[fetched]`
> was retrieved by me directly from the named URL on 2026-09-05 and is a first-hand read of the page,
> not a search engine's summary of it. Items marked `[search]` are still search-synthesis only and
> carry the old weaker warrant. See "What I did NOT verify" for the one real limitation that remains.

---

## What it is

European restaurant-booking marketplace, founded as LaFourchette, operating in 11 European countries.
Two products in one: a **consumer discovery/booking app with discounts** (the diner-facing side, where
the YUMS loyalty currency lives) and **TheFork Manager**, the restaurant-side table-management SaaS.

- **Scale (company/acquirer figures, `[search]`):** 50,000+ restaurants; revenue $232M for the year to
  31 March 2026, +25% YoY, with $28M adjusted EBITDA.
  ([Tripadvisor IR press release](https://ir.tripadvisor.com/news-releases/news-release-details/tripadvisor-enters-agreement-sell-thefork-american-express-700))
- **Independent review footprint (`[fetched]`, 2026-09-05):** Trustpilot TrustScore **4.4/5 across
  21,638 reviews**; distribution 5★ 65% · 4★ 16% · 3★ 5% · 2★ 2% · **1★ 12%**.
  ([trustpilot.com/review/www.thefork.com](https://www.trustpilot.com/review/www.thefork.com))
  This is by a wide margin the **largest independently-reviewable complaint corpus of any platform in
  this research programme** — bigger than OpenTable's, SevenRooms', Servme's, Fidilio's or SnappFood's.
  It is the single best available window into what actually breaks in a mature reservation marketplace.

## Ownership — the move that makes it matter

- **2026-06-15:** Tripadvisor agreed to sell TheFork to **American Express for $700M**, all cash.
  `[search]` ([Tripadvisor IR](https://ir.tripadvisor.com/news-releases/news-release-details/tripadvisor-enters-agreement-sell-thefork-american-express-700);
  [Qz](https://qz.com/american-express-thefork-tripadvisor-acquisition-700-million-061526))
- **Status as of 2026-09-05: NOT closed.** Completion is expected before end of 2026 and is gated on
  (a) the French Works Council consultation for LaFourchette SAS, and (b) regulatory approvals. `[search]`
- Amex says the deal would take its dining ecosystem to roughly **75,000 bookable venues**. `[search]`

**Read this next to `WATCH.md`.** Amex already owns Resy and Tock (merging under the Resy name, Feb
2026) and Rooam. If TheFork closes, **one card issuer will own three of the reservation brands in this
research set** and 75k venues. Meanwhile DoorDash owns SevenRooms, and Quandoo — the one pure
per-cover-commission player — is winding down. The global reservation layer is being absorbed into
payments and delivery balance sheets. Rezervno's structural position, "a reservation platform not
owned by a card network or a delivery marketplace," is becoming rarer, not more crowded.

## Business model & pricing

**Restaurant side.** A **mixed model: monthly subscription + per-cover commission** on covers the
platform sends. TheFork does **not publish restaurant pricing**; its own `/restaurant` and
`/restaurants` paths returned HTTP 404 to a direct fetch on 2026-09-05 `[fetched — negative result]`,
and every pricing figure below is third-party. Reported figures, all `[search]`, and mutually
inconsistent — which is itself the finding:

| Source | Figure |
|---|---|
| UK-focused review | ~£1.70/cover + £25–£85/month subscription |
| Spain-focused | €2 per **diner who arrives** via the platform (per cover, not per booking) |
| France-focused | ~€139 base + €2/cover, **rising to €4/cover at dinner** |

I did not resolve the discrepancy and am not picking one. What is consistent across all three: **the
price of a booking is not knowable from TheFork's own site**, and it is **higher at peak** in at least
one market. Sources: [heep.ai](https://www.heep.ai/en/blogs/thefork-manager-honest-review-restaurant-blind-spots-2026),
[deru.es](https://deru.es/en/blog/software-restaurantes-reservas/),
[restoboard.fr](https://www.restoboard.fr/blog/combien-coute-thefork-restaurant-2026),
[twintable.io](https://twintable.io/blog/couts-caches-thefork).

**Diner side.** Free to book. Monetised through discounts and the YUMS loyalty currency.

## YUMS — the loyalty program, mechanic by mechanic

All `[fetched]` from [thefork.co.uk/yums](https://www.thefork.co.uk/yums), 2026-09-05:

| Mechanic | Value |
|---|---|
| Earn per booking | "100 Yums" per booking made on the app/website |
| Bonus earn | 200 Yums at restaurants tagged "Yums x2" |
| Referral | "500 Yums" when a friend makes their first booking |
| Crediting delay | "Three days after your meal, if you honour your booking" |
| Redemption tier 1 | "1000 Yums = £20 off" — requires a **£30 minimum bill** |
| Redemption tier 2 | "2000 Yums = £50 off" — requires a **£60 minimum bill** |
| Cap | Maximum 2000 Yums spend per booking |
| Expiry | "Yums are valid for one year. They can be exchanged until the last day of the month in which they expire." |
| Tiers | **None.** Variable earn by restaurant/referral, not by member spend level. |
| Self-exclusion | **"You do not earn Yums when you book with a loyalty discount."** |

Three observations that matter for Rezervno's own design:

1. **No tiers.** TheFork — the largest European reservation loyalty program in this set — deliberately
   has no membership tiers. Combined with SnappFood's flat, non-tiered pool
   (`profiles/snappfood-loyalty.md`), that is now **two** large incumbents whose loyalty currency is
   flat, versus Starbucks (tiered, 2026 backlash) and Chipotle (tiered clocks, litigated). The
   evidence base for `proposals/001` continues to accumulate on the flat side.
2. **A clean single expiry clock, stated in plain language, rounded generously** (to the end of the
   month). This is the *good* version of what `proposals/001` argues for, and it is worth naming as
   such rather than only citing competitors' failures.
3. **The self-exclusion rule is the money-honesty flaw.** You cannot earn while redeeming, and you
   cannot redeem below a minimum bill. Both are disclosed — so this is not a dark pattern — but they
   are the two mechanics most likely to produce the "I did the thing and got nothing" feeling. See
   the Antony Shaw complaint below.

## Review synthesis

**Source and counts.** Trustpilot, `[fetched]` 2026-09-05. The corpus is 21,638 reviews at 4.4/5. I
read the **21 most recent 1-star reviews** (filtered listing) and the **5 most recent 5-star reviews**.
Quotes below are **verbatim fragments as printed on the listing page** — the fetch layer truncated at
~125 characters, so these are exact opening sentences, not full reviews. That truncation is disclosed,
not hidden; nothing below is paraphrased into quotation marks.

### Top complaints (n = 21 most recent 1★, 2026-07-06 → 2026-09-02)

**1. Accrued value confiscated on account suspension — 4 of 21 (19%), all within 4 weeks.** The single
largest cluster, and the most important finding in this profile.

- **Yvonne (GB, 2026-07-20):** *"My account was suspended suddenly!"* … *"I have earned 20000 Yums in
  my account and it cannot be used now."*
- **Francesco Pagliano (IT, 2026-08-02):** *"My account was blocked with more than 450 euro in gift
  cards i paid."*
- **Harry Rose (FR, 2026-07-21):** account suspended after using promo codes the platform itself sent.
- **lestamunda (GB, 2026-07-20):** long-time user, sudden suspension, no explanation given.

20,000 Yums is £500 of redemption value at the published 2000 = £50 rate. Whatever the anti-fraud
justification, **the diner-visible behaviour is: a balance you earned disappears, and nobody tells you
why.** No tier design, no expiry policy and no "we never expire points" promise protects against this
failure mode — it is a *governance* gap, not a *clock* gap. This is new information relative to
`proposals/001`, which only addressed expiry.

**2. Money charged without the charge having been shown — 2 of 21 (10%).**

- **Clive Fathers (GB, 2026-07-21):** *"The App did not alert me to the charge, otherwise I wouldn't
  have cancelled."* — a £100 cancellation fee.
- **AJK (GB, ~2026-08-29):** *"Charged £40 even though attended the booking."*

**3. Phantom reservations — the booking that didn't reach the restaurant — 4 of 21 (19%).**
Anthony Moody (GB, 2026-08-28, reservation shown as cancelled by the restaurant when it had not been);
Gérard Alain Tranquille (FR, 2026-07-19, two reservations never registered with the restaurants);
David walker (GB, 2026-07-11, booking cancelled 45 minutes before, restaurant takes no bookings at
all); paloma irving (GB, 2026-08-06, booked two restaurants that were closed).

**4. Negative reviews rejected / moderation as reputation management — 3 of 21 (14%).**
paloma irving and Ken (GB, 2026-07-28) both report their negative reviews being **rejected** by the
platform; Alexander Smith (GB, 2026-07-12) reports over-restrictive moderation of review photos. On a
platform whose consumer value proposition *is* trustworthy restaurant reviews, a rejected negative
review is a direct hit to the thing being sold.

**5. Restaurant-side billing and sales conduct — 3 of 21 (14%).**
- **Fuji Fusionuk (GB, 2026-08-26):** *"Avoid TheFork at all costs."* … *"they've sent debt collectors
  threatening High Court liquidation."* — over billing that continued after contract termination.
- **giulia (IT, 2026-07-22):** *"SO EXPENSIVE"* — subscription plus per-person booking charges.
- **Thirumalai Dhayalan (GB, 2026-08-09):** misleading sales promises, poor support during free trial.

**6. Loyalty mechanics that don't pay out — 2 of 21 (10%).** Antony Shaw (GB, 2026-08-11, difficulty
using Yums and promo codes); Ellen Hrant (GB, 2026-07-09, bonus points not awarded).

### Top praises (n = 5 most recent 5★, 2026-08-28 → 2026-09-02)

Three consistent themes, in order of frequency: **discovery** ("It's made finding restaurants and
unknown gems real easy" — Chris, US), **discounts and rewards** ("Fabulous website for foodies that
love a new find and great discounts!" — Myra, GB; "So easy to book restaurants & with good rewards" —
Steven Caines, GB), and **trust when it works** ("I have used TheFork several times and found it to be
very trustworthy." — Maria, GB, 2026-08-28).

**The honest read of the 4.4 average:** 65% of 21,638 people are happy, and the product's core loop —
find a place, book it, get a discount — clearly works at scale. The 12% at one star are not
complaining about the loop. They are complaining about what happens when the platform makes a
*decision about them*: suspend the account, charge the card, reject the review, keep billing after
cancellation. **The failure mode of a mature reservation marketplace is not the booking flow. It is
unexplained platform authority over the user's money and reputation.**

## Gen-Z scorecard

| Lens | Verdict | Evidence |
|---|---|---|
| **Time to first value** | UNKNOWN — not tested live | No hands-on session run; no app-store listing successfully fetched this pass |
| **Money respect** | **Mixed, trending bad.** Free to book and a genuinely clear one-year expiry rule — but a £30/£60 minimum bill to redeem, no earning while redeeming, opaque restaurant pricing, and four dated reports of accrued balances vanishing on suspension | YUMS page `[fetched]`; Trustpilot 1★ cluster `[fetched]` |
| **Does it feel like now** | UNKNOWN | Not tested live |
| **Shareability** | Partial — "500 Yums" referral is a real, quantified share incentive, the strongest in this research set | YUMS page `[fetched]` |
| **Trust — does it explain decisions?** | **Fails on the evidence available.** Four suspension complaints, all specifically citing the *absence of an explanation*; three rejected-negative-review complaints | Trustpilot 1★ `[fetched]` |
| **Notification behaviour** | UNKNOWN — no data gathered | — |
| **What to steal** | The **one-year clock rounded up to end-of-month**, stated in one sentence, no tiers. That is the cleanest expiry communication found anywhere in this programme, including Starbucks and Chipotle | YUMS page `[fetched]` |
| **What never to copy** | Confiscating accrued balance on suspension without a stated reason; rejecting negative reviews; charging a cancellation fee the app never displayed | Trustpilot 1★ `[fetched]` |

## Where it beats us

- **Corpus of independent evidence.** 21,638 Trustpilot reviews versus Rezervno's zero (pre-launch).
  We cannot yet be judged; that is not an advantage, it is an absence.
- **Distribution.** 50,000 restaurants across 11 countries, about to be plugged into Amex's card base.
  Rezervno has no comparable demand-side channel and should not pretend otherwise.
- **A loyalty currency with a published, unambiguous expiry sentence.** Rezervno has no published
  loyalty policy at all — see below. TheFork's one sentence beats our silence.

## Where we beat it — repo-verified only

All citations verified on ref **`audit/launch-hardening` @ `35fff27`** on 2026-09-05. Line numbers on
`main` differ; where they do, both are given.

1. **A cancellation charge cannot be levied without having been shown.** Clive Fathers' complaint
   (*"The App did not alert me to the charge"*) is structurally impossible in Rezervno today, and by
   deliberate design rather than luck: `apps/customer/js/data/booking.js:66-68` (`depositLabel`) and
   `:80-83` (`cancelPolicyLabel`) implement an explicit **"unknown value → say nothing, never guess"**
   rule, and the label is rendered inside the booking flow at `:261`. The file's own header comment
   (`:47-64`) records that a prior regression showed *"رزرو رایگان"* to a diner at a restaurant whose
   `depositRequired` was true, and that it was fixed. Separately,
   `docs/audit/CANCELLATION-POLICY.md` §1 documents — with a self-correction of an earlier wrong claim
   — that `partial_penalty_pct` is **owner-only, never sent to the diner, and never enforced**, because
   enforcement would require money capture. So Rezervno neither charges nor advertises a penalty it
   cannot charge. That is the exact discipline TheFork's £100 complaint shows the absence of.
2. **Points cannot silently expire, because there is no expiry mechanism at all.**
   `api/prisma/schema.prisma:672-686` (`main`: `:664`) — the `PointsLedger` model's complete field list
   is `id, userId, user, restaurantId, delta, reason, note, createdAt`. **There is no `expiresAt`
   column and no expiry index.** (Grepping `expiresAt` across the schema returns hits only on
   `Restaurant.planExpiresAt`, `Reservation.holdExpiresAt`, an offer timer, `GiftCard`, `OtpCode`,
   `StaffInvite`, `IdempotencyKey` and a second plan field — none on `PointsLedger`.) See
   `proposals/005` for why this is a *finding*, not a victory lap.
3. **Tenant isolation is architectural.** `api/src/lib/with-restaurant-auth.ts:176-182` — staff
   `tenantId` is read from the database record and compared against the authenticated `auth.tenantId`,
   throwing `Err.forbidden()` on mismatch; the documented contract (`:43`) scopes queries by
   `ctx.restaurant.id`. Architecture-level evidence; **no live penetration test was run this pass**,
   same caveat as batch 1.

## What I did NOT verify

- **No live hands-on session on TheFork's app or web booking flow.** Time-to-first-value, notification
  behaviour, and the actual look-and-feel are all UNKNOWN. Neither the Google Play listing
  (`connect ECONNREFUSED` on `play.google.com`) nor an Apple App Store listing could be fetched this
  pass.
- **Restaurant-side pricing is third-party only.** The three figures cited contradict each other and I
  did not resolve them. TheFork's own restaurant pages 404'd.
- **The 21 one-star reviews are the most recent 21, not a random sample of the ~2,600 that 12% of
  21,638 implies.** Recency-weighted by design (the brief asks for it), but that means the percentages
  I quote describe *this window*, 2026-07-06 → 2026-09-02, not the lifetime corpus. I did not read the
  2-star band beyond the single most recent entry, nor sample historical years.
- **I did not verify the suspension complaints against TheFork's side of the story.** Four users say
  their balances vanished without explanation; TheFork may well have anti-fraud reasons it does not
  discuss publicly. What is verified is *what four diners publicly reported and when*, not that
  TheFork acted wrongly.
- **The Amex deal is not closed.** Any claim that "Amex owns TheFork" is wrong as of 2026-09-05.
