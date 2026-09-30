# LOYALTY-ECONOMICS-IRAN — what the Iranian market actually pays per point, and how it pays

_Scout · written 2026-09-10 · `ORDER-SCOUT-001` (`docs/audit/orders/ORDER-SCOUT-001-loyalty-economics.md`,
from CEO `rezv-cf [97a8f9]`, 2026-09-10) · status **submitted**, not closed._

> **Tool check, run before any cell below was written, per the order's own instruction.** Control
> query `WebSearch("اسنپ فود کلاب امتیاز چقدر می‌ارزد")` returned real, sourced results — **WebSearch
> works this session.** Control fetch `WebFetch("https://example.com")` and a real target
> (`snapp.ir/club/`) both returned `EGRESS_BLOCKED` — **WebFetch is fully blocked, not
> domain-specific.** Consequence: every cell below is `[search-synthesis]`, not `[fetched]`, unless it
> quotes a prior session's own fetched citation (marked as such, with its original source). This is a
> weaker evidence tier than `[fetched]` by the order's own convention — stated once here, not repeated
> per cell, but the discipline is real: no cell below claims a strength it doesn't have.

> **Built on, not repeating:** `LOYALTY-ECONOMY-DESIGN.md` (loyalty-economy designer, 2026-09-09 —
> the definitive audit of Rezervno's own code: no spend path exists for امتیاز today, `TOMAN_PER_POINT
> = 2` is the sole rate constant, and §7 already fetched DigiClub's earn rate and expiry). This file
> does not re-derive Rezervno's own code; it extends the Iranian-market anchor that document's §7
> started with two data points into four, per the order.

---

## Part 1 — the six numbers, four Iranian apps

**Reading note before the table, because it changes what the numbers mean:** none of the four apps
below redeem points at a flat toman-per-point rate. All four redeem into **capped discount codes**
(a percentage off, up to a toman ceiling) or, for two of them, **lottery/raffle entries**. This is
the single most load-bearing finding in this section — see the recommendation at the end.

| # | App | Earn rate | Redeem rate & mechanism | Expiry | Redemption cap | Fixed rewards |
|---|---|---|---|---|---|---|
| 1 | **SnappFood / Snapp Club** (اسنپ‌کلاب — one club across all Snapp services, not food-specific) | **10 points / 1,000 toman** on internet/SIM recharge, explicitly (`[search-synthesis]`, two independent queries agree on this figure — one specifically asked about SnappFood and returned it, the other asked generally and returned the same number for "internet/recharge"; **not independently confirmed as the *food-order* rate specifically** — flagged, not assumed). Other verticals have distinct rates: domestic flight 600 pts/txn, international flight 1,200 pts/txn, train 150 pts/txn, bus 100 pts/txn (`[search-synthesis]`) | **No flat toman value.** Points redeem into discount *codes* with a percentage and a toman cap — example cited: 25% off up to 15,000 toman (`[search-synthesis]`) | Twice yearly, end of spring and end of autumn (`profiles/snappfood-loyalty.md`, Scout, `[search-synthesis]`, 2026-09-04 — carried forward, not re-verified this pass) | Yes, per-code (example: 15,000 toman ceiling on a 25% code) — no single platform-wide cap found | Signup: 500 points ("پاس همراهی"). Referral: **inviter and invitee each get 7,000 toman Snapp credit**, triggered on the invitee's first completed ride (`[search-synthesis]`). No birthday reward found — UNKNOWN, not absent |
| 2 | **Digikala / DigiClub** | **1 point / 10,000 toman spent** — `[fetched]`, carried from `LOYALTY-ECONOMY-DESIGN.md` §7, original source `digikala.com/mag/digiclub-introduction`, fetched 2026-09-09. Independently corroborated this pass by `[search-synthesis]` (same figure, different query) | **No flat toman value on Digikala's own core purchases.** Points redeem into discount codes for *third-party* services bundled under Digikala's ecosystem — GapFilm, Shuttle mobile recharge, Namava, DigiPlus subscription, Jabama lodging, Maktab Khooneh courses (`[search-synthesis]`). **No formula found converting points to a discount percentage on an ordinary Digikala purchase itself** — this is a real gap in DigiClub's own public documentation, not a search failure; flagged as such rather than guessed | Points earned in a calendar year are valid until the end of the **following** calendar year — `[fetched]`, carried from `LOYALTY-ECONOMY-DESIGN.md` §7, same source, fetched 2026-09-09 | UNKNOWN — no cap found for the vertical-specific codes; the redemption is by voucher SKU, not a percentage-with-ceiling like Snapp's | UNKNOWN — no signup, referral, or birthday bonus was surfaced this pass (not searched exhaustively; see gaps) |
| 3 | **Tapsi (سفینه‌ی تپسی — Tapsi Spaceship club)** | **Tiered, and the tier is set by the *previous season's* ride volume, not real-time balance:** زمین (Earth) 4 "ستاره"/1,000 toman · ماه (Moon) 8 · خورشید (Sun) 12 · کهکشانِ تپسی (Galaxy) 16 — a **4× spread between the lowest and highest tier for the identical transaction** (`[search-synthesis]`). Signup: 300 stars plus carryover from the prior season | Spends in **"کارشا"** (a separate currency from "ستاره"/stars — the two names were not resolved to the same or different pools this pass, flagged below) into capped discount codes: 200 کارشا → 40% Tapsi Food discount up to 110,000 toman, first-order-only; 100 کارشا → 10% discount, cap not captured in this pass (`[search-synthesis]`) | **UNKNOWN — searched twice, specifically, not found.** Per the order's own rule, this is reported as UNKNOWN, not as "no expiry" | 110,000 toman confirmed on the 200-کارشا/40% code; the 100-کارشا/10% code's cap was cut off in the source snippet — UNKNOWN | Signup: 300 stars. No referral or birthday figure found this pass — UNKNOWN |
| 4 | **Bank Mellat customer club** (representative of the bank/chain category) | UNKNOWN — no per-toman or per-transaction earn rate was found; sources describe "an interaction level" without a stated formula (`[search-synthesis]`) | Points ("کارشو") redeem as: (a) direct cash-equivalent prizes above an unstated threshold, (b) discount codes at partner brands in a "کارشو mall," or (c) **lottery-draw entries — and at the end of each season, *all remaining karsho convert to lottery entries* rather than expiring silently** (`[search-synthesis]`) | **Seasonal — karsho reset at season boundary**, with 500 free karsho granted on first login of the new season (`[search-synthesis]`). This is a *reset*, not a rolling per-grant clock — structurally closer to Snapp's calendar-boundary expiry than to a per-point timer | UNKNOWN | Signup/season-start: 500 karsho. No referral or birthday figure found — UNKNOWN |

**Column 6, effective cashback %, is deliberately not filled in as a single number per row — here is
why, stated once instead of four "N/A"s.** The order asks for `redeem rate ÷ earn rate` specifically
because that ratio is what makes the owner's 125% conflict comparable. **None of the four apps expose
that ratio, because none of them sell a point at a fixed toman price.** A SnappFood point is worth
"up to 25% of a bill, capped at 15,000 toman, if you have enough points and redeem before a discount
code expires" — that is not divisible by an earn rate to produce one percentage. This absence, across
four independently-run apps spanning e-commerce, ride-hailing, and banking, is itself the answer to
the order's implicit question of whether a flat toman/point rate is even what the market expects —
see the recommendation.

---

## Part 2 — club mechanics: what four apps do, and what none of them do

**Tiering exists in exactly one of four.** Tapsi is alone in running a visible, named multi-level
ladder (Earth/Moon/Sun/Galaxy) with a rate *multiplier* attached to each level — and its tier is
**retrospective** (last season's volume decides this season's rate), not a live cumulative threshold
the way Rezervno's `tierFromPoints()` works (`api/src/lib/loyalty.ts:48-51`, cited from
`LOYALTY-ECONOMY-DESIGN.md`). SnappFood/Snapp Club, DigiClub, and Bank Mellat all read as flat
accumulation pools with no named tier ladder found this pass — **absent in three of four, not just
unconfirmed**, since Snapp's own blog content (the primary source type these searches surfaced
repeatedly) describes the club as a single point pool with vertical-specific earn rates, not a tier
system.

**Membership start:** all four are opt-out-none / automatic-on-signup as far as this pass found —
none required a separate "join the club" action distinct from creating an account. UNKNOWN whether
any requires an explicit first activation click (DigiClub's own help article title,
`digikala.com/mag/digi-club-rewards-button`, literally references a "receive-rewards button," which
may mean an activation step exists — not confirmed, flagged for a future pass).

**Where the user sees their balance/history:** not established for any of the four this pass —
every source found was third-party discount-code-aggregator content (`offch.com`, `mopon.ir`) or a
company blog post, not a screenshot or description of the in-app ledger screen itself. **UNKNOWN
across the board — a genuine gap, not a finding.**

**What brings the user back — the dominant, and concerning, pattern:** *lottery/raffle mechanics
appear in three of the four apps studied* — Snapp Club runs monthly raffles for phones and consoles
funded by club points (`[search-synthesis]`); Bank Mellat converts unspent karsho to lottery entries
at every season boundary (`[search-synthesis]`); DigiClub's own redemption menu includes "شرکت در
قرعه‌کشی‌های مختلف" (already flagged in `LOYALTY-ECONOMY-DESIGN.md` §7, fetched 2026-09-09). **This
is the single strongest comparative finding in this document.** The Iranian market's three
best-known consumer loyalty programs studied here default to a lottery as a core retention mechanic —
and Rezervno's own governing document already forbids exactly this
(`.claude/skills/rezervno-audit-constitution`-bound `docs/prompts/PROMPT-customer-club-ml-fa.md` rule
9, "no lottery, no spin-wheel," cited in `LOYALTY-ECONOMY-DESIGN.md`'s own binding-documents header).
**Rezervno's no-lottery rule is not a conservative default relative to this market — it is a
deliberate break from what three of the four largest programs studied actually do.** That should be
treated as a stated differentiator in any external-facing copy, not a quiet omission.

**Streaks, missions, multiplier days, birthday rewards:** **not found for any of the four apps**, in
this pass. This is reported as UNKNOWN for each, not as "absent" — none of these mechanics were the
subject of a targeted search this round (the searches run were earn/redeem/expiry/referral-focused,
per the order's five-question Part 1 priority). A dedicated follow-up pass should search these by
name in Persian (e.g., «چالش هفتگی اسنپ», «مأموریت دیجی کلاب») before this gap is treated as a real
absence rather than an unsearched question.

**What this means for Rezervno's own design (cross-reference, not new research):**
`LOYALTY-ECONOMY-DESIGN.md` §4.2 already proposes a weekly streak and §4.3 a missions table for
Rezervno — this pass found **no Iranian competitor precedent for either mechanic**, which cuts both
ways: it could mean genuine differentiation, or it could mean the market has tested and rejected
them and simply doesn't talk about it publicly. Neither is established here; flagged for whoever
owns that design decision, not resolved by this file.

---

## Part 3 — «شرکتِ حامی» ("the sponsoring/backing company")

**UNKNOWN — and the reason is structural, not a research failure: the order does not name it.**

The order's own text (`ORDER-SCOUT-001-loyalty-economics.md` §3) says *"مالک این را با نام خواست"*
("the owner asked for this by name") but does not quote the name itself in the file I received. A
repo-wide `grep -rn "شرکتِ حامی\|شرکت حامی\|شرکت‌حامی"` across every `.md` file in this working tree
returns exactly one hit: the order document itself, at the line describing this section — **the
name the owner used was never committed to disk anywhere Scout can read it.**

Per the order's own instruction ("اگر نتوانستی قطعی کنی، UNKNOWN بنویس و بگو چه چیزی را چک کردی"),
this section is UNKNOWN, checked as follows:

- Full-text grep for the Persian phrase across `docs/`, `audit/`, `.claude/` — one hit, the order
  itself.
- Read the order's own §3 in full (quoted above in this file's git history via the order file) —
  it describes *what kind* of entity to identify (a B2B loyalty-club provider vs. a retail loyalty
  program vs. something else) but never supplies a proper noun.
- Did not guess. The order itself warns explicitly against this: *"نامِ نزدیک به یک برندِ دیگر
  بدترین جای حدس‌زدن است"* ("a name close to another brand is the worst place to guess") — so no
  candidate name is proposed here.

**This needs the actual name from the owner, relayed through the CEO, before this section can be
written.** Flagged prominently rather than left silent, per the order's own three-question status
check.

---

## Final recommendation — what Rezervno's earn/redeem rates should be, and why

**The market anchor is not a number — it is a redemption *shape*, and all four apps studied agree on
it.** Every one of SnappFood/Snapp Club, DigiClub, Tapsi, and Bank Mellat redeems its loyalty
currency as a **capped discount code or a lottery entry, never as a flat toman-per-point cash value.**
The owner's own three statements ("۱ امتیاز = ۲ تومان" · "هر ۱۰۰۰ تومان = ۲۵ امتیاز" · "۲۰۰ امتیاز =
۱۰٬۰۰۰ تومان") are three attempts to pin down a single flat exchange rate — the exact shape the
Iranian market being studied here does not use anywhere.

**Recommendation: stop trying to reconcile the three numbers into one توماني/امتیاز rate. Adopt the
capped-discount-code shape instead — the same shape Rezervno's own `RewardRedemption`/سکه marketplace
already uses** (`rewards.ts:158-163`, cited from `LOYALTY-ECONOMY-DESIGN.md` §4.6 — coins spend
against a priced reward catalog, not a per-coin cash rate). Concretely:

- **Earn rate — anchor on DigiClub's `[fetched]` figure (1 point / 10,000 toman), not SnappFood's
  weaker `[search-synthesis]` figure.** DigiClub is the closer structural match to Rezervno: both are
  a single toman-denominated purchase (a preorder bill, per `LOYALTY-ECONOMY-DESIGN.md` §1) earning
  points on the *transaction total*, not a per-ride or per-package rate the way Snapp's and Tapsi's
  vertical-specific numbers are. **Why not Snapp's 10/1,000:** that figure is confirmed for
  internet/SIM recharge, not confirmed for food specifically, and recharge is a fundamentally
  different transaction shape (small, frequent, low-variance) than a restaurant preorder bill.
- **Redeem rate — do not set one.** Replace `TOMAN_PER_POINT = 2` (`loyalty.ts:50`) as a load-bearing
  constant with a **catalog of capped discount rewards priced individually**, the way all four
  studied apps and Rezervno's own سکه system already work. This directly resolves E-002's 125%
  arithmetic conflict — there is no longer a single rate for three owner statements to disagree
  about, because no single rate is being set.
- **Why this doesn't just dodge the owner's question:** the owner's underlying concern, per E-002's
  own text, is *"if bots or people do fake reservation = we have to pay them free money."* A
  capped-discount-code catalog bounds the platform's maximum per-redemption liability by design (a
  25%-up-to-15,000-toman code costs at most 15,000 toman, ever, regardless of how many points a bot
  accumulates) — which is a **stronger** answer to that concern than any flat per-point rate, because
  a flat rate's liability scales with the exact quantity (fake or real) a bot can accumulate, and a
  capped code's does not.

**This recommendation is input to the owner's decision, not the decision itself** — per the order's
own framing, E-002 stays open until the owner rules. What this file adds is a market-anchored reason
to widen the choice beyond "which of the three toman/point numbers do we pick" to "should we be
picking a toman/point number at all, when zero of the four largest Iranian consumer-loyalty programs
studied do."

---

## What I did NOT verify

- **Part 3 is unresolved** — the owner's actual name for «شرکتِ حامی» was never relayed to this
  session; see Part 3 for the full account of what was checked.
- **SnappFood's food-order-specific earn rate** is not independently confirmed distinct from the
  general Snapp-services rate cited — both searches returned "10 points/1,000 toman" but neither
  query definitively isolated a Snapp-*Food*-only rate from Snapp's platform-wide recharge rate.
- **Tapsi's "ستاره" (stars) vs. "کارشا" (karsha) — whether these are the same currency under two
  names, or two separate balances**, was not resolved. The tier table cites stars/1,000 toman; the
  redemption table cites karsha spent on discount codes. Both terms appeared in independent search
  results without a source connecting them explicitly. Treated as **possibly the same pool, not
  confirmed** — flagged rather than assumed either way.
- **No card/bank-transfer-based loyalty program (e.g., a retail chain's own card, as opposed to a
  bank's app club) was researched** — Bank Mellat was chosen as the sole bank/chain representative
  per the order's four-app scope; «فروشگاه‌های زنجیره‌ای» (retail chains specifically, e.g., Hyperstar,
  Refah, Ofogh Kourosh) were not researched this pass and remain a gap if a second data point in this
  category is wanted.
- **DigiClub's redemption cap and fixed-reward figures (signup/referral/birthday)** were not found —
  reported as UNKNOWN in Part 1, not zero.
- **No app's ledger-history screen, membership-activation flow, or streak/mission/multiplier-day
  mechanic was directly observed** — everything above is `WebSearch` synthesis of third-party
  discount-aggregator sites and company blog posts, not a fetched primary page or an actual
  screenshot/walkthrough of any app. `WebFetch` was confirmed blocked before this pass began (see the
  tool-check note at the top); nothing here should be read as a first-hand app-usage account.
- **This file does not re-verify any claim already `[fetched]` and cited from
  `LOYALTY-ECONOMY-DESIGN.md`** — those two citations (DigiClub earn rate, DigiClub expiry) are
  reused with their original sourcing intact, not re-fetched this pass.
