# BUSINESS-MODEL — who pays, for what, and what the code actually charges today

**Date:** 2026-09-16 · **Session:** `rezv-c6 [897f2f]` (Marketer, scope widened by the owner) ·
**Target:** the CEO `rezv-87 [09dbab]` · **Status:** v1 draft, **submitted — not closed** ·
**Base:** `main = cf60b9c`, code read on that tree the same day.

**What it needs:** CEO: re-verify §2 against code (every row has a `file:line`) and route §0's
findings (b) and (c), which are not my files. Owner: the decisions in §7. Nothing in §3 may be
treated as a price. Counsel: §5.

**Written name-free.** `E-001` is open. Where a name would go, this document writes ⟨NAME⟩.

**What v1 does not have:** market size, a unit cost for SMS, hosting cost, a churn benchmark, and
live competitor prices re-measured after 2026-09-09. Those are marked `UNKNOWN` below and are the
subject of the market research the owner ordered on 2026-09-16 («تحقیق کامل کن از بازار، تمام
رقبا را کامل بسنج»). §3 and §4 get rewritten when it lands. v1 does not guess them.

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
their cost and risk. **The choice belongs to the owner, with counsel. The CEO is taking it to him
as a decision package. It is not the Marketer's decision and not the CEO's** (CEO `rezv-87`,
2026-09-16).

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
| «امتیاز، کش‌بک و کارتِ هدیه» | «امتیاز و کش‌بک» (and no gift card until the flag is on) | `gift_card_purchase_enabled` is off, and point spending is off too (FP-008), so even «امتیاز» needs the CEO's ruling |
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
| Coupons and SMS automations | **PARTIAL.** The panel and API are wired, but real sending is unproven (CEO) | `apps/business/js/marketing.js`; `api/src/lib/sms.ts:78` (Melipayamak) |
| Points and cashback | **PARTIAL.** Earning works, spending is off | `api/src/lib/loyalty.ts:15-21,90-95`; FP-008 |
| Dynamic minimum spend ("pricing rules") | REAL-STATIC, **as a rule engine** | `api/src/lib/pricing.ts:151-234`; never "AI" or «هوشمند» |
| Assistant | REAL-STATIC, **as a local classifier**, no LLM | `api/src/lib/assistant-nlu.ts:4` |
| Online deposit collection | **Must not be sold** until §5 is decided | §0-a |
| Gift cards | **Must not be sold.** The flag is off | §0-b |
| Webhooks | REAL-STATIC at schema and outbound level | `api/prisma/schema.prisma:1357`; `api/src/lib/outbound-http.ts` |

---

## 3. Price: the placeholder and its arithmetic

> **Placeholder, not confirmed by the owner.** The CEO has not measured these figures, and pricing
> is a money decision reserved to the owner. Nothing below is a recommendation of a price.

| Plan | Months | Price (toman) | Per month | "Compare at" on the card |
|---|---|---|---|---|
| m3 | 3 | 18,000,000 | 6.00M | — |
| m6 | 6 | 34,000,000 | 5.67M | 36,000,000 (= 2 × m3) |
| m12 | 12 | 65,000,000 | 5.42M | 72,000,000 (= 4 × m3) |

Source: `api/prisma/seed/site-content.json`, served from the DB and editable in the company panel.
A committed copy also exists in `apps/landing/content/site-content.json`, but the pricing page
**deliberately does not show it** when the API is unconfigured or failing
(`apps/landing/app/pricing/page.tsx:30-51`). A guard test pins that behaviour
(`apps/landing/test/plan-price-honesty.test.mts`). So a stale hard-coded price cannot quietly
reach a buyer.

**Against the only Iranian figures on file.** Both are from 2026-09-05 fetches, and both competitors
publish internally contradictory prices (`BUSINESS-MODEL-KPI.md` §1):

| | Per year (toman) | What it buys |
|---|---|---|
| RSEE Professional / Complete | 990,000 / 2,990,000–3,990,000 | Reservation SaaS; a free tier exists |
| SmartX reservation module | 21,450,000 **or** 52,800,000 (unreconciled) | One module |
| SmartX customer club | 51,000,000 | One module |
| SmartX 4-product bundle | 199,250,000 | Everything |
| **Our m12 placeholder** | **65,000,000** | Everything |

What this table can and cannot say: the placeholder is **16–65× RSEE** and **about ⅓ of SmartX's
bundle**. Which of the two the buyer compares us with is `UNKNOWN`: nobody has interviewed a
restaurant owner. All figures are a year old in an inflationary currency by the time anyone signs,
so any price decision needs a re-measure first. That is part of the ordered research.

---

## 4. Unit economics: the formula, with every input honestly empty

No input below has a source today, so no output is computed. This section defines what must be
measured, so the business plan cannot fill it with invented numbers.

```text
ARPA / month      = subscription price / months  (+ SMS top-up margin, if R2 gets priced)
Gross margin      = ARPA − (hosting share + SMS cost not recharged + payment fees + support hours × cost)
CAC               = (sales + onboarding + marketing spend) / restaurants activated
Payback (months)  = CAC / (ARPA × gross margin %)
LTV               = ARPA × gross margin % / monthly churn
```

| Input | Value | Where it will come from |
|---|---|---|
| ARPA | Placeholder only (§3) | Owner's price decision |
| Hosting cost per restaurant | `UNKNOWN` | Launch Engineer, once production exists |
| SMS unit cost (Melipayamak) | `UNKNOWN` | Provider price list, part of the research order |
| Onboarding hours per restaurant | `UNKNOWN` | The first ten activations. The m6 card already promises «راه‌اندازی و انتقالِ دادهٔ اولیه» |
| CAC | `UNKNOWN` | Measured from `SiteOrder` rows (lead → call → activation) |
| Monthly churn | `UNKNOWN`. No external benchmark was found either (`BUSINESS-MODEL-KPI.md` §3) | Research, then our own renewals |
| Trial → paid conversion | `UNKNOWN` | `SiteOrder.kind = 'trial'` → plan set by admin |

**Minimum instrumentation, proposed and not built.** The funnel is already stored as rows (`SiteOrder`
status plus `Tenant.planExpiresAt`), so every number above except hosting and SMS cost can be
counted with queries, without new tracking. The one missing field is **why** a lead did not convert.
Today that reason lives only in the head of whoever made the call.

---

## 5. Money flow for deposits: the decision that has to come before payments go on

> **Requires review by counsel before action.** I am not a lawyer. These are the options the code
> makes possible and the questions counsel must answer. None of it says any option is permitted.

**Options, not a recommendation.** The CEO ruled on 2026-09-16 that this is a money and legal
decision for the owner, and that the CEO carries it to him as a decision package.

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
1. **Prices.** Confirm, change or withdraw the 18/34/65M placeholders. Do it after the research
   re-measures competitor prices, not before.
2. **Tiers.** Either tiers differ **only** in term and support (then the cards lose per-tier
   features), or tiers really gate features (then the lead paragraph is false and gating has to be
   built). One of the two must change. The first matches the code.
3. **Deposits.** A, B or C in §5, with counsel. The CEO carries this to the owner as a decision
   package. Until the owner decides, the default stays A because that is what the code does.
4. **SMS.** Is SMS credit a revenue line (priced top-ups) or a cost folded into the subscription?
5. **Trial.** Is the 30-day free trial a decision or a default? It is in code (`api/src/lib/site-orders.ts:36`)
   and in the OG image (`apps/landing/app/opengraph-image.tsx:84`).

**CEO**
- ~~Route §0-b~~ Done: the CEO confirmed it and routed it to the Implementation Team on 2026-09-16.
  §0-b's copy table is a proposal only.
- Re-verify §2's classes when `CHAIN-MAP.md` lands.

**Research (ordered by the owner; the CEO approved the location `docs/marketing/research/` and the
scope, max three sonnet agents plus haiku for extraction, on 2026-09-16; running)**
- Market size: restaurant and café counts, Tehran first.
- Live competitor prices, re-measured, including any names the Scout has not covered.
- SMS unit cost, restaurant SaaS churn, CAC benchmarks.

---

**Line for the CEO:** «Marketer `rezv-c6` → `docs/marketing/BUSINESS-MODEL.md` v1 (submitted): مدل =
اشتراکِ رستوران، دینر رایگان، یک خطِ درآمد (R1) که دستی فروخته می‌شود؛ §۵ سه گزینه‌ی بیعانه با هزینه و
ریسک — تصمیم نه با من نه با CEO؛ §۰-ب پیشنهادِ متنِ صادقانه برای کارت‌های pricing؛ §۳ و §۴ تا رسیدنِ
تحقیقِ بازار placeholder و UNKNOWN می‌مانند.»
