# BUSINESS-PLAN — the first twelve months after launch, built bottom-up

**Date:** 2026-09-17 · **Session:** `rezv-c6 [897f2f]` (Marketer) · **Target:** the CEO `rezv-87 [09dbab]` ·
**Status:** v1 draft, **submitted — not closed** · **Base:** `main = cf60b9c`.

**What it needs:**
- **Owner:** the decisions in §9. Two of them block the plan (runway, and who sells).
- **CEO:** the launch gates in §5, Phase 0, which are the CEO's to certify.
- **Counsel:** only what `BUSINESS-MODEL.md` §5 and `fundraising/PAYMENT-PATHS.md` already route there.

**What this plan is built from, and does not repeat:**

| Question | Answered in |
|---|---|
| Who pays, for what | `BUSINESS-MODEL.md` v2 · prices: `PRICING.md` v2 (owner's decision) |
| Who we are for, and the one true claim | `POSITIONING.md` |
| Brand idea, values, tone, identity | `BRAND.md` |
| Market, competitors, benchmarks, app-store footprint | `research/*-2026-09-16.md` (all four reviewed) |
| Capital: whether, when, from whom | `fundraising/INVESTORS.md`, `fundraising/PAYMENT-PATHS.md` |

**Rules this plan keeps:**
- No number without a class.
- No TAM outside the company (`BUSINESS-MODEL.md` §8).
- Prices are the owner's decision of 2026-09-17: **18 / 33 / 60M**, plus a **free display-only listing** in the customer app (`PRICING.md` v2). VAT is still open.
- Every target in §5 is a **proposed gate for the owner to accept or change**, not a forecast.
- No date is promised, because launch has no date. Everything is counted from launch day **L**.

---

## 0. The plan in five lines

1. **Launch is the first milestone, not fundraising.** This follows `INVESTORS.md` §6: raise after
   launch and let the launch be the pitch.
2. **Win ten restaurants in one Tehran district before anything else.** The reach is small and
   dense, so it can be served by hand. Billing is manual anyway (`BUSINESS-MODEL.md` §0-c).
3. **Sell money kept, not growth.** Demand is contracting (−45% customers at Tehran food vendors,
   CLAIMED, re-fetched), so the pitch is recovered no-shows plus a club the restaurant owns, not
   "fill more tables".
4. **Get our own numbers.** A no-show rate before and after, 30-day retention, and a conversation→purchase
   rate. They replace every `UNKNOWN` in the business model, and they are the only thing an
   investor will believe.
5. **Decide the second city and the raise at L+6 months, on those numbers, not before.**

---

## 1. The problem and what we sell, at the strength we can prove

| Problem | Evidence | Class |
|---|---|---|
| Restaurants lose covers to no-shows | Resos index: 2.33% of 3.77M reservations recorded as no-show; Resos itself says the true rate is higher. Independents without reminders are reported at 15–20% | 2.33%: REAL (re-fetched) · 15–20%: SECONDARY |
| Booking in Iran runs on DMs, calls, and one app where the diner pays up front | Status quo described in `research/COMPETITORS-IRAN-2026-09-16.md`. RSEE's forfeiture ladder is re-fetched there | Described / REAL |
| Restaurants don't own their guest relationship on the dominant platform | SnappFood holds the diner. Its vendor app rates **2** from 2,334 votes on Bazaar (`research/APP-STORE-FOOTPRINT-2026-09-16.md`) | REAL for what the store shows. It does not tell us why |
| Demand is contracting and costs are rising | −45% customers (Tehran food vendors, CLAIMED). Food-group inflation 127.5% (SECONDARY) | CLAIMED / SECONDARY |

**What we sell**, from `BUSINESS-MODEL.md` §2, never stronger:
- Booking, waitlist, tables: REAL-STATIC.
- Customer club / CRM: REAL-STATIC.
- SMS automations: **PARTIAL** (real SMS delivery unproven). Coupons: creatable in the panel, but **no diner can redeem one**, because no UI sends the code (`PRICING.md` §3).
- Earning points and cashback: **PARTIAL** (spending is off, FP-008).
- Minimum-spend rules: REAL-STATIC, **as a rule engine**.

We don't sell deposits, gift cards or anything «هوشمند».

---

## 2. Market — what can be said, and how we size year one instead

**Top-down sizing is not possible today.** No official restaurant count exists at any evidence
class. Private databases say 14,432–19,935 restaurants nationally, while SnappFood's own «<2%»
framing implies more than 150,000 (`research/MARKET-SIZE-IRAN-2026-09-16.md`, review block). A
tenfold contradiction makes a TAM number decorative, so this plan does not use one.

**Bottom-up instead: year one needs a reachable number, not a market number.**

| Layer | Definition | How it gets counted | Today |
|---|---|---|---|
| **Reachable** | Sit-down restaurants and cafés in the chosen district that take bookings today (DM, phone or an app) | Walking the district and checking each venue's Instagram. People, not agents | `UNKNOWN` until the owner picks the district (§9) |
| **Qualified** | Reachable venues with a no-show or queue problem, confirmed by the owner in conversation | The first interviews (§4) | `UNKNOWN` |
| **Won** | Activated `SiteOrder` rows | `SiteOrder.status = activated` (`api/prisma/schema.prisma`, `SiteOrderStatus`) | 0, pre-launch |

For the first ten, the plan needs roughly **30–50 qualified conversations**. That is an assumption:
there is no conversion benchmark for Iranian restaurant SaaS, and it gets replaced by our own
`SiteOrder` counts after the first month.

---

## 3. Competition, in one table

Detail and sources: `research/COMPETITORS-IRAN-2026-09-16.md` and `BUSINESS-MODEL.md` §8.

| Who | What the restaurant sees | Our answer, only where it is REAL-STATIC or better |
|---|---|---|
| **Status quo** (DM + phone) | Free, and a staff member checks messages | A waitlist and a booking record that don't depend on someone watching Instagram |
| **SnappFood / Foodro** | Booking inside the app they may already pay commission to. **Live status and terms UNKNOWN** | «مالِ خودت», said only as «در پنلِ خودتان می‌بینید» (no export exists for launch; CEO ruling 2026-09-17) (`BRAND.md` value ۲) |
| **POS suites** (SmartX, Sepidz, Mupra, Duvita) | Everything in one box, reservation priced "on request", 20–200M/yr | A published, all-inclusive price, *if the owner keeps it public*. We work alongside a POS, not instead of one |
| **RSEE** | A cheap reservation tool (0.99–3.99M/yr), and the diner pays prepaid credit | The diner pays nothing to book. Deposits are off at launch by the owner's decision, so this holds for the launch |

---

## 4. Go-to-market

The detailed playbooks are the charter's next deliverables (`docs/marketing/restaurants/` and
`docs/marketing/diners/`, both empty today). This section sets their direction and the one
measurement each channel must carry.

### 4.1 Restaurants — the paying side, first

| Channel | Hypothesis | Cost | Measured by |
|---|---|---|---|
| **Direct visits in one district** | Owners buy from a person who shows the working panel on a phone, not from a page | People-hours, `UNKNOWN` until §9 says who sells | Visits → `SiteOrder` (trial) → `activated`, counted weekly |
| **Instagram, where restaurants already live** | Owners see real screens (not renders) from venues they know | Content time. **No paid ads** until positioning copy is approved | `SiteOrder.utmSource / utmMedium / utmCampaign`, which already exist in the schema |
| **Referral from the first restaurants** | An owner trusts another owner more than us | A referral benefit, **to be decided by the owner**. It must be real and paid, because we have already once removed a referral promise the code never paid (`POSITIONING.md` §3) | A `utmSource` per referring restaurant |
| **Free listing → paid** (owner's model, 2026-09-17; **moved to after launch** the same day) | A restaurant listed free sees diners who can't book it online, and upgrades | Zero to us per listing, plus the listing-proof work (`PRICING.md` §1, req. 5) | Free listings → trials → `activated`. **Not usable until the gating ships** |
| **Guild channels (اتحادیه‌ها)** | The unions are publicly describing the demand squeeze (CLAIMED), which is an opening for a "money kept" talk | Low | **Hypothesis only.** Nobody has contacted a union, and nobody will without the owner's approval |

**The pitch, in order:** money kept (no-shows recovered, stated as a mechanism until we have our own
numbers), then a club the restaurant owns, then the published price. The copy follows `BRAND.md` §2
and needs SMS delivery proven before any "we remind your guests" line (Phase 0).

**Interviews come before scale.** The first ten conversations have to answer the question desk
research could not: does the owner compare us with RSEE (a cheap tool) or with a POS suite (a full
platform)? The answer decides the price (§9).

### 4.2 Diners — through the restaurants, not around them

| Channel | Hypothesis | Measured by |
|---|---|---|
| **At the venue** (table tent, QR on the bill) | The cheapest diner acquisition is the table the diner is already sitting at | Reservations by channel via `Reservation.source` (a free-text field, default `"app"`; the values in use must be checked before counting) |
| **The restaurant's own Instagram and Telegram** | The restaurant's followers book when the restaurant tells them to | Same |
| **Our own Instagram** | Screens and the «روراست» voice, no giveaways | Bookings, not followers |

**`E-001` moved:** the owner said on 2026-09-17 that the domain has been bought. **Whether it resolves
has not been checked**, and the domain name is not recorded here; the CEO is asking the owner. Printed
QR codes still need it to resolve (directive 036). Digital channels don't.

---

## 5. Milestones — gates, not dates

Each gate is a **proposal for the owner.** A gate is passed when the owner has looked at the listed
numbers and said go, whatever the numbers are. Targets are marked as hypotheses.

### Phase 0 — before L (now)

| Must be true | Owner of it | Status today |
|---|---|---|
| The public pricing page no longer contradicts itself (M-12) | CEO → Implementation | Routed 2026-09-16 |
| Real SMS delivery proven end-to-end | CEO / Launch Engineer | Unproven (CEO, 2026-09-16) |
| CI green on `main` | CEO | Not fully green since 09-08 (CEO) |
| Deposits off, and no surface promises them | Owner | **Decided 2026-09-17: off at launch** (`BUSINESS-MODEL.md` §5). Checked in every Marketer artifact, including `PRICING.md` |
| Who sells and activates (§9) | Owner | Open |

### Phase 1 — L to L+3 months: ten restaurants, one district

| Outcome | Proposed gate (hypothesis) | Source |
|---|---|---|
| Restaurants activated | 10 | `SiteOrder.status = activated` |
| Still active at day 30 | Hypothesis: 7 of 10 | Bookings in the last 7 days per restaurant |
| Our own no-show rate, before and after | Measured, whatever it is. Resos' 2.33% is the reference, not the target | `Reservation.status = no_show` ÷ bookings |
| Conversation → purchase | Measured (no self-serve trial at launch, owner 09-17) | Hand-logged visits → `SiteOrder.kind = purchase` → `activated` |
| Why leads did not convert | Every `rejected` row carries `rejectedReason`. `cancelled` rows have only `adminNote`, so it must be filled | `api/prisma/schema.prisma`, `SiteOrder` |

**Gate:** the owner reviews these five numbers. Pass → Phase 2. Fail → fix the product or the pitch
in the same district, not a new district.

### Phase 2 — L+3 to L+6: thirty restaurants, same city

| Outcome | Proposed gate (hypothesis) |
|---|---|
| Restaurants active | 30 |
| Monthly churn, measured | Compared against the scenarios in `BUSINESS-MODEL.md` §4 (2% / 4% / 8%) |
| Restaurants from referral | At least some. A zero means the referral benefit or the product is wrong |
| Diners who booked twice | Measured. This is the diner-side retention number |
| The owner's price tested in real conversations | What owners say about 18/33/60 and the free listing, recorded per conversation |

### Phase 3 — L+6 to L+12: the two decisions

1. **Second city or deeper in Tehran.** Foodro launched in Tehran, Karaj, Mashhad, Isfahan, Shiraz
   and Qom (live status `UNKNOWN`). The second-city choice should re-check it first-hand.
2. **Raise or not, and how.** Follow `INVESTORS.md` §6: accelerator or صندوق نوآوری و شکوفایی first,
   then licensed crowdfunding, then VC, and project participation before equity unless a fund asks
   otherwise. The ask (`THE-ASK.md`) is still blocked on the owner's runway answer (§9).

---

## 6. Operations and team

| Need | Why | Today |
|---|---|---|
| **A person who sells and activates** | Billing is lead → call → invoice → admin activation (`BUSINESS-MODEL.md` §0-c) | `UNKNOWN`: owner decision (§9) |
| **Onboarding** (menu, tables, staff) | The m6 card promises «راه‌اندازی و انتقالِ دادهٔ اولیه» | Hours per restaurant `UNKNOWN`. Counted from the first ten |
| **Account creation** | Owner, 09-17: our team creates the account after purchase; the restaurant keeps its own info up to date | `provisionBusiness` exists (`api/src/lib/provisioning.ts:94`). Who on the team does it is `UNKNOWN` (§9.2) |
| **Renewals** | Owner, 09-17: a notice in the restaurant's panel 15 days before expiry. Expiry itself is reported and not enforced (`api/src/lib/subscription.ts:30`) | **The notice is not built** (`PRICING.md` §1a L2). Until it is, a human checks the admin list weekly |
| **Support** | The cards promise weekday, priority and dedicated support by tier | Nobody is named. The promise should match whoever exists |
| **SMS top-ups** | Admin tops up by hand (`BUSINESS-MODEL.md` §1 R2) | Pricing a top-up is an owner decision (`BUSINESS-MODEL.md` §7.4) |

---

## 7. Financials — arithmetic on the owner's prices, and nothing invented

**No P&L, burn or break-even date is given**, because the cost base (people, hosting, office) is
`UNKNOWN` and inventing it would make every number below it fiction. What can be computed honestly:

**Revenue per paying restaurant count, at the owner's prices** (m12 = 60M/yr; m3 would be 72M/yr, m6
66M/yr). **Before VAT: the owner decided +10% is added on top**, and it is not our revenue. Free accounts pay nothing:

| Paying restaurants | Annual subscription revenue (m12) |
|---|---|
| 10 | 600,000,000 toman |
| 30 | 1,800,000,000 toman |
| 100 | 6,000,000,000 toman |

**Restaurants needed per 100M toman of monthly cost base:** 100M ÷ (60M ÷ 12) = **20 restaurants**,
before margin. Whatever the owner's real monthly cost turns out to be, divide by 100M and multiply.
The formula doesn't need us to guess the cost.

**What churn costs in sales effort**, as new restaurants needed per month just to stand still. This
is arithmetic on the assumptions in `BUSINESS-MODEL.md` §4:

| Active restaurants | 2% churn | 4% churn | 8% churn |
|---|---|---|---|
| 30 | 0.6 | 1.2 | 2.4 |
| 100 | 2 | 4 | 8 |

**SMS is not the cost to watch:** ≈24 toman all-in per message (REAL, provider's own tariff), so
<0.5% of the m12 monthly price at 1,000 messages a month (`BUSINESS-MODEL.md` §4).

**Inflation is:** a 12-month price fixed in toman while food-group inflation is 127.5% (SECONDARY)
loses real value every month. The price-review cadence belongs in the owner's price decision.

---

## 8. Risks — pointers, not repetition

- **Competitive:** Foodro, POS suites, the free status quo, contracting demand (`BUSINESS-MODEL.md` §8).
- **Money and legal:** deposits are off at launch by the owner's decision (2026-09-17). The
  platform-merchant flow with no settlement code only matters if that is re-opened
  (`BUSINESS-MODEL.md` §5, counsel). Every non-domestic capital path needs counsel (`PAYMENT-PATHS.md`).
- **Honesty:** one caught exaggeration breaks the brand (`BRAND.md` §0). The live pricing page is
  the current exposure, and it has been routed.
- **Execution:** manual billing and unenforced expiry hold at ten restaurants and leak at fifty (§6).
- **Name:** physical materials wait on `E-001` (§4.2). The measured rename cost grows with every
  screen (`BRAND.md` §4).

---

## 9. Decisions needed

**Owner — two of these block the plan:**
1. **Runway: is raising money a constraint or a preference?** (open since `BRIEF-2026-09-11.md`). It
   decides whether Phase 3 raises or the plan stretches. **Blocks `THE-ASK.md`.**
2. **Who makes the sales calls in Phase 1?** Without a named person, the §5 gates have no one to hit
   them. **Blocks Phase 1.** Accounts are created from the company panel (owner, 09-17). The caller is
   still `UNKNOWN` and in the owner's queue.
3. **Which Tehran district, and which venue categories.** The charter says named categories, not named
   businesses, and that the owner chooses. My proposed categories: sit-down restaurants with evening
   peaks that already take DM bookings, and cafés with weekend queues (the waitlist use case).
4. ~~**Price**~~ **Decided 2026-09-17: 18 / 33 / 60M plus a free display-only listing** (`PRICING.md` v2).
   Since then, all decided (09-17): +10% VAT, a sold subscription keeps its price until its term ends,
   no founding offer, the free demo removed for the paid launch, and the free listing after launch
   (`PRICING.md` decisions 6–13). The first ten conversations (§4.1) test the price.
5. **A referral benefit** for restaurant-to-restaurant referrals, real and paid, or none.
6. **The Foodro phone check**, optional and two minutes (`BUSINESS-MODEL.md` §8).

**CEO**
- Certify the Phase 0 gates it owns: M-12 shipped, SMS delivery proven, CI green.
- Confirm the values in use for `Reservation.source` before §4.2 counts by channel.

**Marketer (me), next, in this order unless the CEO reorders:**
1. `restaurants/` playbook: pitch, onboarding funnel, the first-ten plan by category.
2. `diners/` playbook: the at-venue mechanic and a four-week content calendar, **described not
   written**, until positioning copy is approved.
3. `THE-ASK.md`: only after decision 1.

---

**Line for the CEO:** «Marketer `rezv-c6` → `docs/marketing/BUSINESS-PLAN.md` v1 (submitted): برنامه‌ی
۱۲ماهه از روزِ لانچ (L)، پایین‌به‌بالا، بدونِ TAM؛ اول ده رستوران در یک محله‌ی تهران با فروشِ «پولی که
می‌ماند» نه رشد؛ دروازه‌های پیشنهادی برای مالک در L+3 و L+6؛ مالی فقط حساب روی قیمت‌های مالک (۱۸/۳۳/۶۰M؛ ۲۰
رستوران برای هر ۱۰۰ میلیون هزینه‌ی ماهانه)؛ فاز ۰ سه دروازه‌ی تو را لازم دارد: M-12، اثباتِ پیامک، CI
سبز؛ دو تصمیمِ مسدودکننده‌ی مالک: runway و اینکه چه کسی می‌فروشد.»
