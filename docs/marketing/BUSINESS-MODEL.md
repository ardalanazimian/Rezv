# BUSINESS-MODEL — who pays, for what, and what the code actually charges today

**Date:** 2026-09-16, **v2 2026-09-17** · **Session:** `rezv-c6 [897f2f]` (Marketer, scope widened by the owner) ·
**Target:** the CEO `rezv-87 [09dbab]` · **Status:** v2 draft, **submitted — not closed** ·
**Base:** `main = cf60b9c`, code read on that tree the same day.

**What it needs:** CEO: re-verify §2 against code (every row has a `file:line`) and route §0's
findings (b) and (c), which are not my files. Owner: the decisions still open in §7 (prices and
deposits are decided; VAT and price lock are in `PRICING.md` §4). Counsel: §5, if deposits are re-opened.

**Written name-free.** `E-001` is open. Where a name would go, this document writes ⟨NAME⟩.

**What v2 changed (2026-09-17):** §3 and §4 are rewritten from the market research the owner
ordered («تحقیق کامل کن از بازار، تمام رقبا را کامل بسنج»), which is now in `research/` and was
reviewed by me before use. §8 is new: competitive risks to the model, with SnappFood's Foodro
recorded **as a risk, not a fact**, per the CEO. **Still `UNKNOWN`:** market size (there is no
official count, see §8), hosting cost, CAC and our own churn. v2 does not guess them.

---

## 0. The recommendation first

**Keep the model the code already has: the restaurant pays a flat subscription, and the diner
pays nothing to book.** No commission, no per-cover fee, no diner-side credit. This matches how
every live Iranian competitor except one charges (the restaurant pays, `BUSINESS-MODEL-KPI.md` §1).
It is also the only model that doesn't contradict our strongest positioning line, "nothing is
taken from you unless we told you first" (`POSITIONING.md` §1–2). The one competitor that charges
the diner up front, RSEE, forfeits 50–100% of that credit on late cancellation, and the Scout
filed that as the worst money-respect mechanic in the whole programme (`ANTI-PATTERNS.md` #3).

Three things matter more than the price level, and all three were measured today:

**(a) The deposit path would make us hold restaurants' money, with no way to pay it out.**
Every deposit goes to **one platform-wide Zarinpal merchant** (`api/src/lib/platform-settings.ts:32-38`).
There is **no settlement or payout code** in `api/src`: `git grep -iE "settlement|payout|تسویه"`
returns nothing. Refunds exist only as a `REFUND_REQUIRED` alert for a human
(`api/src/app/api/v1/payments/callback/route.ts:130,153-164`). Today this is dormant because
`Restaurant.paymentEnabled` defaults to `false` (`api/prisma/schema.prisma:184`). It stops being
dormant for any restaurant where someone turns it on. See §5, which lays out three options with
their cost and risk. **Decided 2026-09-17 by the owner: option A, deposits OFF at launch.** Owner's words, relayed by CEO `rezv-87`: «بیعانه فعلاً خاموش می‌مونه». Verified: `Restaurant.paymentEnabled` defaults to `false` (`api/prisma/schema.prisma:184`). **Consequence for every marketing surface:** no copy, pricing card or plan may promise online deposits or prepayment until the owner re-decides.

**(b) The public pricing page contradicts itself and the code.** Its lead paragraph says
«تفاوتِ پلن‌ها در مدت و سطحِ پشتیبانی است، نه در قفل‌بودنِ قابلیت‌ها. هر پلنی که بگیرید، محصولِ
کامل را دارید» (`apps/landing/app/pricing/page.tsx:134-137`). The plan cards list features that
are added tier by tier (`api/prisma/seed/site-content.json`, m6 and m12). The code gates nothing by
plan: all three plans set `tenantPlan: "pro"`. The cards also promise:
- «کارتِ هدیه» on the 6-month card, while `gift_card_purchase_enabled` is **off** by default
  (`api/src/lib/feature-flags.ts:70-73`).
- «قواعدِ قیمتِ **هوشمند**» on the 12-month card, while the code describes itself as a rule
  engine, not AI (`api/src/lib/pricing.ts:1-10`). The charter forbids describing a heuristic as AI.
- «بازبینیِ فصلی با تیمِ رزرونو», which uses a name `E-001` has not settled and promises a human
  service nobody has been staffed for.

This is an honesty finding on a live page, not a pricing opinion. **The CEO confirmed all three
points on 2026-09-16 and routed the fix to the Implementation Team.** The landing and the seed file
are not mine to edit. Proposed honest copy, if the tiers differ only in term and support (the
version the code already matches):

| Now | Proposed | Why |
|---|---|---|
| Features added tier by tier on the cards | Every card: «همه‌ی قابلیت‌های پنل». Cards differ only in **term, support level, onboarding** | Matches the lead paragraph and the code (`tenantPlan: "pro"` for all) |
| «قواعدِ قیمتِ هوشمند و حداقلِ خریدِ پویا» | «حداقلِ خرید بر اساسِ روز و ساعت، با پیشنهاد از روی رزروهای خودتان» | States the mechanism (`api/src/lib/pricing.ts:151-234`) without calling it intelligence |
| «امتیاز، کش‌بک و کارتِ هدیه» | «کسبِ امتیاز و کش‌بک» (no gift card and no "spend points" until their flags are on) | CEO's ruling (STATE M-12, `session/rezv-87-ceo @ 76a431e`): earning is real, spending is off (FP-008), and the copy must say which |
| «بازبینیِ فصلیِ عملکرد با تیمِ رزرونو» | «بازبینیِ فصلیِ عملکرد با تیمِ ما» | `E-001` is open, and the service needs an owner before it's sold |

**(c) Billing is manual, and expiry is reported but not enforced.** A purchase is a lead: the
dialog posts to `/api/v1/site/orders` and takes no payment (`apps/landing/components/pricing/PurchaseDialog.tsx:106-121`).
Then a person calls, an invoice is issued and an admin activates the plan
(`apps/landing/app/pricing/page.tsx:92-97`; `api/src/app/api/v1/admin/restaurants/[id]/control/route.ts:44-96`).
`computeSubscriptionStatus()` states in its own comment that «هیچ گاردی به این وضعیت تکیه نمی‌کند»
(`api/src/lib/subscription.ts:30`), so an expired restaurant keeps working. **That is acceptable for
the first ten restaurants and a revenue leak at fifty.** No code change is proposed here. It is
recorded so the business plan does not assume renewals collect themselves.

---

## 1. Revenue lines: what exists and what earns

| # | Line | Who pays | State in code | Platform revenue? |
|---|---|---|---|---|
| R0 | **Free listing** (owner, 2026-09-17) | Nobody | **Not built.** There is no gating by plan, so every listed restaurant can take bookings today (`PRICING.md` §1) | **No.** It is catalogue depth for diners and an upgrade path |
| R1 | **Subscription** (3 / 6 / 12 months) | Restaurant | Exists. Prices are seeded in the DB and editable from the company panel. Collection is manual (§0-c). New sign-ups get a 30-day trial on plan `free` (`api/src/lib/site-orders.ts:36,300`) | **Yes, the only one today** |
| R2 | **SMS credit** | Restaurant | Each restaurant has `smsBalance` (starter 50, `api/src/lib/sms-balance.ts:8`), debited per send and topped up manually by an admin (`api/src/app/api/v1/admin/restaurants/[id]/sms/route.ts`). **No price for a top-up exists anywhere in the code** | **Possible, not priced.** The unit cost from Melipayamak is `UNKNOWN` |
| R3 | **Deposits** (بیعانه) | Diner → restaurant | Collection works end-to-end when `paymentEnabled` is on. Forfeiture and refund on cancel are config only (`api/src/lib/cancellation-policy.ts:28,73`) and nothing executes them | **No. It is pass-through money,** and today it would sit with us (§0-a) |
| R4 | **Gift cards** | Diner → restaurant | Purchase is flagged **off**: it would mint spendable balance with no payment step (`api/src/lib/feature-flags.ts:36-45`) | No, and it is pass-through if ever turned on |
| R5 | **Points and cashback** | Restaurant (funds it) | Earn works. The cashback rate is set by the restaurant (`cbBasePct` default 5, `api/prisma/schema.prisma:175`). **Redemption is off** (`points_redemption_enabled`, FP-008) | **No. It is a cost the restaurant carries,** not our revenue |
| R6 | **Commission / take rate / per-cover** | — | **Does not exist.** `git grep -i "commission\|take.rate\|platform.fee\|per.cover"` finds no code | No, and §6 recommends keeping it that way |
| R7 | **Diner fees** | — | None | No |

**The plain reading:** the company has **one** revenue line (R1), sold by hand, plus one line that
could earn (R2) but has no price. Everything else that moves money is either the restaurant's own
money passing through or a cost the restaurant funds.

---

## 2. Product truth behind the subscription, stated at its real strength

Until the Full-Stack Auditor's `docs/audit/fullstack/CHAIN-MAP.md` lands (پیشنهادی — the CEO says it is being written; it does not exist on `cf60b9c`), the CEO's rule is that
every claim carries a `file:line` and is at most **REAL-STATIC**. Code is wired, but a working
production has not been shown. The CEO also recorded three facts on 2026-09-16: CI on `main` has not
been fully green since 09-08, real SMS delivery is unproven, and point spending is off.

| What a restaurant is sold | Strongest honest class today | Evidence |
|---|---|---|
| Online booking, waitlist, tables | REAL-STATIC | `reservations_enabled`, `waitlist_enabled` on (`api/src/lib/feature-flags.ts:14-22`); `apps/business/js/waitlist.js:22-23` calls the real queue API |
| Customer club / CRM / RFM | REAL-STATIC | `apps/business/js/crm.js:631,1162` → `/restaurant/crm/*`; `api/src/app/api/v1/admin/business-intelligence/route.ts:17-75` |
| Coupons and SMS automations | **PARTIAL.** The panel and API are wired, but real sending is unproven (CEO). **Coupons have no diner-side path (measured 2026-09-17):** the API accepts `coupon_code` on `POST /reservations` (`api/src/app/api/v1/reservations/route.ts:42`) and redeems only there (`api/src/lib/reservations.ts:619`), but **no UI sends it**. The customer booking payload has no coupon field (`apps/customer/js/data/booking.js:494-501`), and a repo-wide `git grep -l "coupon_code|couponCode"` over `apps standalone shared e2e` hits only reward-result display (`result_coupon_code`); positive control `party_size` → 5 files. A restaurant can create a coupon that no diner can use (`PRICING.md` §3) | `apps/business/js/marketing.js`; `api/src/lib/sms.ts:78` (Melipayamak) |
| Points and cashback | **PARTIAL.** Earning works, spending is off | `api/src/lib/loyalty.ts:15-21,90-95`; FP-008 |
| Dynamic minimum spend ("pricing rules") | REAL-STATIC, **as a rule engine** | `api/src/lib/pricing.ts:151-234`; never "AI" or «هوشمند» |
| Assistant | REAL-STATIC, **as a local classifier**, no LLM | `api/src/lib/assistant-nlu.ts:4` |
| Online deposit collection | **Must not be sold** until §5 is decided | §0-a |
| Gift cards | **Must not be sold.** The flag is off | §0-b |
| Webhooks | REAL-STATIC at schema and outbound level | `api/prisma/schema.prisma:1357`; `api/src/lib/outbound-http.ts` |

---

## 3. Price: the owner's decision, and the market around it

> **Decided by the owner on 2026-09-17** (`PRICING.md` v2 §0): **18M / 33M / 60M** for 3 / 6 / 12
> months, «کمی زیرِ SmartX، هم‌تراز». **Plus a free tier:** a restaurant listing in the customer app,
> **display only, with no online booking**. The business panel and the club are paid. The old
> 18/34/65M were placeholders, and the owner ruled they were not real prices. VAT and price-lock
> terms are still open with him (`PRICING.md` §4).

| Plan | Months | Price (toman) | Per month | "Compare at" on the card |
|---|---|---|---|---|
| Free listing | — | 0 | — | — |
| m3 | 3 | 18,000,000 | 6.00M | — |
| m6 | 6 | 33,000,000 | 5.50M | 36,000,000 (= 2 × m3) |
| m12 | 12 | 60,000,000 | 5.00M | 72,000,000 (= 4 × m3) |

**⚠️ The free/paid boundary does not exist in code yet.** There is no gating by plan, expiry is not
enforced, and there is no public contact field (`PRICING.md` §1, six requirements). Until the gating
ships, the free tier must not be marketed as "listing without booking".

Where prices live: `api/prisma/seed/site-content.json` (today still the old numbers, until the Implementation Team applies `PRICING.md`), served from the DB and editable in the company panel.
A committed copy also exists in `apps/landing/content/site-content.json`, but the pricing page
**deliberately does not show it** when the API is unconfigured or failing
(`apps/landing/app/pricing/page.tsx:30-51`). A guard test pins that behaviour
(`apps/landing/test/plan-price-honesty.test.mts`). So a stale hard-coded price cannot quietly
reach a buyer.

**Against the market, re-measured 2026-09-16** (`research/COMPETITORS-IRAN-2026-09-16.md`, reviewed;
`research/BENCHMARKS-GLOBAL-2026-09-16.md`, reviewed). Only published prices are listed, with classes
as in those files. VAT (+10%) is shown where the page states it.

| Player | Per year (toman) | What it buys | Class |
|---|---|---|---|
| RSEE Professional / Complete | 990,000 / 2,990,000 (6 mo) – 3,990,000 (12 mo) | A dedicated reservation product. The diner also pays prepaid credit | REAL (re-fetched, unchanged since 09-05) |
| Softmenu | 4,900,000 – 25,000,000 | Digital menu + a birthday-SMS "club" | REAL (price) / CLAIMED ("club") |
| Mupra Base → Pro+ | 19,900,000 → 160,650,000, **+10% VAT** | POS suite. **The reservation module is priced only on request** | REAL |
| SmartX reservation module | 21,450,000 **or** 52,800,000 | One module. Two live pages still contradict each other | REAL (both pages) |
| SmartX customer club / bundle | 51,000,000 / 199,250,000 | One module / all four | REAL |
| Duvita Basic → Unlimited | 36,000,000 → 84,000,000 (3M–7M/mo), **+10% VAT** | POS suite, tiered by orders/day. No reservation feature found | REAL |
| SnappFood (delivery) | Commission, reported 15–22% of sales | Delivery marketplace. Foodro booking terms `UNKNOWN` (§8) | SECONDARY |
| **Ours (owner, 2026-09-17)** | **72M (m3×4) / 66M (m6×2) / 60M (m12)**, plus a free display-only listing | Everything paid is identical. VAT still open | Owner's decision |

**What this can and cannot say:**
- **We would sit in the "full platform" band (36–90M/yr)** next to Duvita and Mupra's middle tiers.
  We are not in the "reservation tool" band, where RSEE is at 1/15 to 1/61 of our m12 price.
  Against SmartX's matching pair (reservation + club), 60M is ≈17% below 72.45M and ≈42% below 103.8M.
  That comparison is for sales conversations only, never public copy (`PRICING.md` §2).
- **We are the only reservation-first product with a published all-inclusive price** among the ten
  checked. Every POS suite hides its reservation module behind a sales call. That is a positioning
  asset *only if the owner keeps prices public*.
- **Two pricing axes exist besides tiering by feature, and both are REAL elsewhere:** tiers by
  booking volume (Tablein, resOS) and a free entry tier (Eat App ≤100 covers/mo, resOS ≤25
  bookings/mo). Volume tiers would let tiers differ **honestly** without building feature gating (§7.2).
- **Not answerable from desk research:** whether an owner compares us with RSEE (cheap tool) or with
  a POS suite (full platform). Only restaurant interviews answer that, and none have happened.
- **Inflation:** food-group point-to-point inflation is 127.5% (Mordad 1405, SECONDARY). A 12-month
  price fixed today loses real value monthly. The price-review cadence is part of the owner's price
  decision (§7.1).

---

## 4. Unit economics: the formula, with every input honestly empty

v2: one input now has a primary source (SMS cost). Churn has a cross-industry benchmark but no
restaurant-software one. Everything else is still `UNKNOWN`, so **no LTV or payback is computed
here.** The business plan uses the scenarios below, labelled as assumptions.

```text
ARPA / month      = subscription price / months  (+ SMS top-up margin, if R2 gets priced)
Gross margin      = ARPA − (hosting share + SMS cost not recharged + payment fees + support hours × cost)
CAC               = (sales + onboarding + marketing spend) / restaurants activated
Payback (months)  = CAC / (ARPA × gross margin %)
LTV               = ARPA × gross margin % / monthly churn
```

| Input | Value | Where it will come from |
|---|---|---|
| ARPA | 5.0–6.0M toman/month by term (owner's prices, §3), before VAT | Decided 2026-09-17. The mix of terms is `UNKNOWN` until restaurants pay |
| Hosting cost per restaurant | `UNKNOWN` | Launch Engineer, once production exists |
| SMS unit cost (Melipayamak) | **10.6–17.9 toman per Persian SMS page** (by operator and line type), plus a 40-rial surcharge and 10% VAT. So ≈ **16–24 toman all-in**. REAL for "the provider states", as of Tir 1405 | `melipayamak.com/blog/posts/sms-pricing/`, fetched 2026-09-17 |
| Onboarding hours per restaurant | `UNKNOWN` | The first ten activations. The m6 card already promises «راه‌اندازی و انتقالِ دادهٔ اولیه» |
| CAC | `UNKNOWN` | Measured from `SiteOrder` rows (lead → call → activation) |
| Monthly churn | `UNKNOWN` for us. **No restaurant-software company in the research set publishes a churn %** (Toast, PAR, Booking/OpenTable: confirmed non-disclosure, SECONDARY). Cross-industry SaaS: top quartile 1–2%/mo, median 3–4%/mo (ChartMogul, 2023 data, REAL for "the survey says") | Our own renewals |
| Trial → paid conversion | `UNKNOWN` | `SiteOrder.kind = 'trial'` → plan set by admin |

**What the SMS number already tells us.** At ≈24 toman all-in, 1,000 messages a month cost ≈24,000
toman. That is **<0.5%** of the 5.0–6.0M toman monthly equivalent of the owner's prices. SMS is
not a margin risk at plausible restaurant volumes, and it is not a meaningful revenue line either
unless top-ups carry a markup (§7.4). Arithmetic on a REAL input.

**Churn scenarios, labelled as assumptions, for the business plan.** Expected lifetime in months = 1 / monthly churn.

| Scenario | Monthly churn (assumption) | Expected lifetime | Basis |
|---|---|---|---|
| Good | 2% | 50 months | ChartMogul top quartile, cross-industry |
| Middle | 4% | 25 months | ChartMogul median, cross-industry |
| Stressed | 8% | 12.5 months | **No source.** Chosen because the sector is contracting (−45% customers at Tehran food vendors, CLAIMED; café closures 30–40%, CLAIMED) and small businesses that close stop paying |

**Minimum instrumentation, proposed and not built.** The funnel is already stored as rows (`SiteOrder`
status plus `Tenant.planExpiresAt`), so every number above except hosting and SMS cost can be
counted with queries, without new tracking. **Corrected 2026-09-17:** v1 said the reason a lead did
not convert is stored nowhere. That was wrong. `SiteOrder` has `rejectedReason`, `adminNote`, `city`
and `utmSource/utmMedium/utmCampaign` (`api/prisma/schema.prisma`, model `SiteOrder`), so channel
attribution and rejection reasons exist. What is missing is a *required* reason on `cancelled`
rows, which only have the optional `adminNote`.

---

## 5. Money flow for deposits: the decision that has to come before payments go on

> **Requires review by counsel before action.** I am not a lawyer. These are the options the code
> makes possible and the questions counsel must answer. None of it says any option is permitted.

**Decided 2026-09-17 by the owner: option A, deposits OFF at launch.** Owner's words, relayed by CEO `rezv-87`: «بیعانه فعلاً خاموش می‌مونه». Verified: `Restaurant.paymentEnabled` defaults to `false` (`api/prisma/schema.prisma:184`). **Consequence for every marketing surface:** no copy, pricing card or plan may promise online deposits or prepayment until the owner re-decides. Options B and C below stay on file for when it is re-opened, and both still need counsel.

| Option | How money moves | Cost to build and run | Risk |
|---|---|---|---|
| **A. Deposits off** (today's default, `paymentEnabled = false`) | No deposit is collected online | None | **Commercial.** The strongest no-show tool is missing from the restaurant pitch. Deposits can only be taken offline, by the restaurant's own means. No money or legal exposure for the platform |
| **B. A merchant per restaurant** | Diner → **the restaurant's own** Zarinpal merchant. The platform never holds the money | **Code:** the merchant id moves from platform settings (`api/src/lib/platform-settings.ts:32-38`) to the restaurant, and the callback and verify steps become per-restaurant. **Onboarding:** each restaurant must hold its own gateway account, which adds a step and possibly a fee on the restaurant's side (`UNKNOWN`). **Refunds:** carried out by the restaurant | **Onboarding friction.** A restaurant without a gateway account can't use deposits. **Support:** refund disputes land on the restaurant, while the diner may still blame the platform. Legal exposure for the platform is presumably lower, but counsel must confirm that |
| **C. A platform merchant with settlement** | Diner → the platform's merchant → the platform pays the restaurant | **Code that doesn't exist today:** settlement and payout, reconciliation, refund execution, ledgering. **Ops:** daily reconciliation, a finance role. **Licensing:** counsel must say whether holding and settling third-party funds requires a payment-facilitator (پرداخت‌یار) licence under Shaparak rules | **Highest.** The platform holds other businesses' money (float, liability if a payout fails, fraud exposure). It is possibly a regulated activity. It also creates the option of a platform fee, which is currently excluded by §6 |

Whichever option is chosen, counsel must also answer two questions: who is the merchant of record
for a forfeited deposit, and what consumer-protection rules apply to a forfeiture the diner was
told about in advance.

---

## 6. What the model deliberately does not include, with a recommendation on each

| Not included | Why | Recommendation |
|---|---|---|
| Commission on bookings or bills | It puts the fee on volume, which is the model restaurants resent in delivery apps. Nothing in the code measures bill value reliably enough to charge on it | **Keep excluded** |
| Per-cover network fee (OpenTable-style) | Aggregator figures show cover fees at 5–10× the subscription (`BUSINESS-MODEL-KPI.md` §1, SECONDARY). SevenRooms sells *not* having it | **Keep excluded**, and it is usable as a pitch line once verified |
| Diner-side fees or prepaid credit | Contradicts `POSITIONING.md` §1. RSEE is the cautionary case | **Keep excluded** |
| Paid placement / ads in discovery | Changes who the ranking serves. Nothing to rank yet anyway | **Revisit after launch,** with an explicit label if ever done |
| Selling or sharing guest data | «باشگاه مشتریانت مالِ خودته» is the one restaurant claim that is REAL at architecture level (`POSITIONING.md` §2) | **Never.** Write it into the terms |

---

## 7. Decisions needed

**Owner**
1. ~~**Prices.**~~ **Decided 2026-09-17, owner: 18 / 33 / 60M, plus a free display-only listing** (§3,
   `PRICING.md` v2). Still open with him: VAT and price lock (`PRICING.md` §4).
2. **Tiers.** Either tiers differ **only** in term and support (then the cards lose per-tier
   features), or tiers really gate features (then the lead paragraph is false and gating has to be
   built). One of the two must change. The first matches the code. A third, honest option exists
   elsewhere: tiers by booking volume (§3).
3. ~~**Deposits.**~~ **Decided 2026-09-17, owner: A, off at launch** (§5). Re-opening it means B or C,
   and both need counsel.
4. **SMS.** Is SMS credit a revenue line (priced top-ups) or a cost folded into the subscription?
5. **Trial.** Is the 30-day free trial a decision or a default? It is in code (`api/src/lib/site-orders.ts:36`)
   and in the OG image (`apps/landing/app/opengraph-image.tsx:84`).

**CEO**
- ~~Route §0-b~~ Done: the CEO confirmed it and routed it to the Implementation Team on 2026-09-16.
  §0-b's copy table is a proposal only.
- Re-verify §2's classes when `CHAIN-MAP.md` lands.

**Research: done 2026-09-16 and reviewed, `session/rezv-c6-marketing @ 8e5d2ce`.** Still open:
- An official restaurant/café count (none exists at any class; §8).
- Foodro's live status and restaurant terms (§8).
- **Restaurant-owner interviews.** Desk research cannot tell which price band the buyer compares us
  with (§3). This is the highest-value next input, and it needs people, not agents.

## 8. Competitive risks to the model (new in v2)

| Risk | What we know | Class | What it would do to the model |
|---|---|---|---|
| **SnappFood's Foodro bundles table booking into the app restaurants already pay** | Launched 1404/05/15 (≈ 2025-08-06) in Tehran, Karaj, Mashhad, Isfahan, Shiraz and Qom («رزرو میز»), re-fetched from Zoomit. **Whether it is live today is `UNKNOWN`:** `food.snapp.ir/foodro/` redirects to itself. Restaurant terms are `UNKNOWN`. SnappFood's diner app shows 4.4M Bazaar installs, and it claims >35,000 standard restaurant contracts | Launch: REAL (press). Status and terms: `UNKNOWN`. Contracts: CLAIMED | **If** live and funded from the existing commission, a restaurant already on SnappFood gets booking at no extra price. Our subscription would then have to justify itself against "free inside what I already pay". The strongest counter we own is value ۲ in `BRAND.md` (the club is yours): Foodro's guests are SnappFood's guests. **This is a risk until it is checked first-hand** |
| **POS suites sell the same budget line** | SmartX, Sepidz, Mupra and Duvita bundle club, SMS and menu with POS at 20–200M/yr. Every one of them sells reservation behind a sales call | REAL (prices) | The owner may already pay one of them. Our pitch has to work *alongside* a POS, not replace it, since we have none (`research/COMPETITORS-IRAN-2026-09-16.md` C.1) |
| **The status quo costs zero** | Instagram DM + phone booking is the default | Described, not measured | The pitch has to beat free: recovered no-shows and a club the restaurant owns, in toman terms. That needs our own numbers, which pre-launch we don't have |
| **Demand is contracting** | −45% customers at Tehran food vendors YoY (CLAIMED, re-fetched). Cafés −50% revenue and 30–40% of juice/ice-cream/coffee units closed (CLAIMED, not re-fetched) | CLAIMED | A growth pitch ("fill more tables") meets owners who are cutting costs. The retention pitch (money kept) fits better. Churn from closures belongs in the stressed scenario (§4) |
| **Market size is unknowable today** | No official count. Private databases say 14,432–19,935 restaurants, while SnappFood's own «<2%» framing implies >150,000 | SECONDARY / CLAIMED, contradicting each other by ~10× | No TAM figure may leave the company. The plan sizes the first year bottom-up (restaurants we can actually reach), not top-down |

**The first-hand check the Foodro risk needs, and who can do it:** someone opens the SnappFood app on
a real phone in Tehran and records whether «فودرو» or table booking appears. Our research programme
never installs apps. The owner's own phone test is one of the six things reserved to him, so this is
**offered to the owner as an optional two-minute check, not assigned.**

---

**Line for the CEO:** «Marketer `rezv-c6` → `docs/marketing/BUSINESS-MODEL.md` v2 (submitted): §۳ با قیمتِ
رقبا از تحقیق — ما در باندِ «پلتفرمِ کامل» ۳۶–۹۰ میلیون، تنها رزرومحورِ با قیمتِ منتشرشده؛ §۴ هزینه‌ی
پیامک از منبعِ دست‌اول (≈۱۶–۲۴ تومان، <۰.۵٪ قیمت) و سه سناریوی churn برچسب‌خورده؛ §۸ تازه: فودرو
به‌عنوانِ ریسک نه واقعیت، رقابتِ POSها، وضعِ موجودِ رایگان، انقباضِ تقاضا، و اینکه هیچ TAMی بیرون نمی‌رود.»
