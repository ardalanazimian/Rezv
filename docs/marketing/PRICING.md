# PRICING — the owner's prices, the free tier, and what code they need

**Date:** 2026-09-17 (v1 proposal → **v2 owner decisions**, same day) · **Session:** `rezv-c6 [897f2f]`
(Marketer) · **Target:** the CEO `rezv-87 [09dbab]` · **Status:** v2, **submitted — not closed** ·
**Base:** `main = cf60b9c`.

**This file edits nothing.** The Implementation Team applies it after the CEO verifies, and the owner
does the push to `main`.

---

## 0. The owner's decisions (2026-09-17)

| # | Decision | Owner's words | Recorded |
|---|---|---|---|
| 1 | The old 18/34/65M prices were not real and must follow the research | «نه، نسبت به جواب تحقیق مارکتینگ تغییر بده» (relayed by the CEO) | v1 |
| 2 | **The paid prices: 18M / 33M / 60M** | The owner chose them from three priced options in this session. **Final**, recorded as final by CEO `rezv-87`. His words and the competitive rationale are in the private repository `ardalanazimian/Rezv-security`, `business/pricing/PRICING.internal.md` (commit `97bdc4f`) (owner ruling 09-17: investment and competitive-positioning content leaves the public repo) | v2 |
| 3 | **Listing a restaurant in the customer app is free. The business panel and customer club are paid** | «ثبت نام رستوران تو پنل کاستومر رایگان هست ولی پنل بیزنس و باشگاه مشتریان نه» | v2 |
| 4 | **The free listing is display only, with no online booking** | He chose «فقط نمایش، بدونِ رزرو» from three options | v2 |
| 5 | Deposits are off at launch | «بیعانه فعلاً خاموش می‌مونه» (relayed by the CEO) | `BUSINESS-MODEL.md` §5 |
| 6 | **All published prices exclude VAT; +10% is added.** Every card and price surface shows «+ ۱۰٪ مالیات بر ارزش افزوده» | Relayed by the CEO, 09-17 | v2.2, closes §4.1 |
| 7 | **Our team creates the restaurant's panel account after the subscription is bought.** While subscribed, the restaurant enters and updates its own information. **15 days before the subscription ends, the panel shows the days left and a renewal notice** | Relayed by the CEO, 09-17 | v2.2 (§1a) |
| 8 | **The first launch is paid.** We give free accounts to a few venues at our own discretion, and everyone else buys. **The free display-only listing (decisions 3–4) moves to after launch**, so no free plan is advertised in launch copy | Relayed by the CEO, 09-17 | v2.2 |

### The price list

| Tier | Price (toman) **+ ۱۰٪ مالیات بر ارزش افزوده** | Per month (excl. VAT) | Includes |
|---|---|---|---|
| ~~Free listing~~ **after launch** (decision 8) | 0 | — | Display only, no booking. **Not in launch copy.** A few free accounts at our discretion are not a plan and are never advertised |
| سه‌ماهه (`m3`) | **18,000,000** | 6.0M | Everything in §3's paid list |
| شش‌ماهه (`m6`) | **33,000,000** | 5.5M | Same |
| یک‌ساله (`m12`) | **60,000,000** | 5.0M | Same |

The three paid plans include the same product and differ only in term. **VAT is decided: +10% on top
(decision 6).** Price lock and the founding-restaurants offer are still open with the owner (§4); the
CEO has recommended "yes" to both. **There is no self-serve trial at launch:** the team creates the
account after purchase (decision 7). The code's 30-day trial path (`api/src/lib/site-orders.ts:36`)
and the landing's trial copy are therefore not part of the launch (§6, row 9).

---

## 1a. What decision 7 needs from code, for launch

| # | Requirement | State in code |
|---|---|---|
| L1 | The team creates the account after purchase | **Exists:** `provisionBusiness` (`api/src/lib/provisioning.ts:94`), used by the admin restaurants route (`api/src/app/api/v1/admin/restaurants/route.ts`). Plan and expiry are set by admin activation (`api/src/app/api/v1/admin/restaurants/[id]/control/route.ts:44-96`). REAL-STATIC |
| L2 | **The restaurant's panel shows days left and a renewal notice at 15 days** | **Routed:** part of the approved subscription-lifecycle design (M-21, D-27/D-28, `rezv-1b`, `feat/rezv-1b-subscription`), including the ≤14 → 15 change in `subscription.ts`. At 2026-09-17 on `cf60b9c` it was **not built:** `git grep` for `planExpiresAt|plan_expires_at|تمدید|روز باقی` over `apps/business/js` and `api/src/app/api/v1/restaurant` finds only token-refresh code, and nothing about plan expiry. Positive control: `planExpiresAt` hits `api/src/app/api/v1/admin/restaurants/route.ts` (3) and `api/src/lib/subscription.ts` (3). The admin status marks «رو به اتمام» at ≤14 days (`api/src/lib/subscription.ts` comment); the owner's rule is 15 days, shown in the restaurant's own panel |
| L3 | The self-serve trial is not reachable at launch | The trial form and `/demo` page are live in the landing (`apps/landing/app/demo/page.tsx`, `apps/landing/components/forms/TrialForm.tsx`). The CEO's proposal "remove for the paid launch" is **with the owner, unanswered** |
| L4 | Expiry has a consequence | **Decided (CEO, 09-17; D-27/D-28, M-21, `rezv-1b`, branch `feat/rezv-1b-subscription`), not yet built:** on day 0, profile, menu and campaign editing lock; new online bookings close; the expired restaurant is hidden from the customer app list; existing bookings stay manageable; **no data is deleted**. Today it is still reported only (`api/src/lib/subscription.ts:30`) |

## 1. ⚠️ What the free tier needs from code — **after launch** (decision 8)

**Today the code has no boundary between free and paid.** Measured on `cf60b9c`:
- **No gating by plan anywhere.** `git grep` for plan comparisons over `api/src` and `apps` finds
  only the default `plan: 'free'` at creation (`api/src/lib/provisioning.ts:169`). The CEO
  independently found no gating by plan on 2026-09-17.
- **Every restaurant with `isOpen: true` is listed to diners and can take bookings**
  (`api/src/app/api/v1/restaurants/route.ts:41`).
- **Plan expiry is reported, never enforced**: «هیچ گاردی به این وضعیت تکیه نمی‌کند»
  (`api/src/lib/subscription.ts:30`).
- **There is no "listing only" concept** in the schema: no listed, claimed or listing-only field
  on `Restaurant`.
- **A restaurant has no public phone field.** Nothing on `model Restaurant` matches
  phone/tel/contact, and the customer app has no `tel:` link. So "display only, the diner calls"
  has no number to call yet.
- Negative greps here carry **no positive control of their own**, except the no-gating finding,
  which the CEO controlled.

**What the owner's model needs built** (proposed for the CEO to route; the Implementation Team sizes it):

| # | Requirement | Why it is needed for decisions 2–4 |
|---|---|---|
| 1 | **Online booking only for restaurants with an active paid plan or trial.** Otherwise the customer app shows the profile without a booking button | Decision 4. Without this, "free = no booking" is false |
| 2 | **Business panel and club only with an active paid plan or trial** | Decision 3 |
| 3 | **Expiry enforced**: when a trial or paid term ends, the restaurant falls back to the free listing. It is not deleted, and its data is kept | Today this boundary *is* the business model, and `subscription.ts:30` doesn't enforce it |
| 4 | **A public contact field on the restaurant** (phone, and/or Instagram) shown on the free listing | A display-only listing is useless to a diner without a way to reach the restaurant |
| 5 | **Proof that whoever creates or claims a listing controls the restaurant's phone** | A free, self-serve listing invites people to list restaurants that aren't theirs. The CEO's 09-16 handoff already has an open item on staff registration without phone proof (`docs/audit/HANDOFF-2026-09-16-ceo.md`, item 6). This tier would put that path in front of the public |
| 6 | **How a free listing is created.** Self-serve, or by our team | Decides whether requirement 5 is needed at launch |

**The honesty gate that follows:** until requirements 1–3 ship, **no pricing page, pitch or post may
offer the free tier as "listing without booking"**, because in code a "free" restaurant can still
take bookings and use the whole panel. The paid prices can be published before that, since they are
commercial terms. The free card waits for the gating.

---

## 2. The evidence behind 18 / 33 / 60 — moved

**Moved on 2026-09-17** to the private repository `ardalanazimian/Rezv-security`, `business/pricing/PRICING.internal.md` (commit `97bdc4f`), by the owner's ruling relayed by the CEO: competitive price comparisons and the internal sales line
leave this public repository. The public market research that fed it remains in `research/COMPETITORS-IRAN-2026-09-16.md` and
`research/BENCHMARKS-GLOBAL-2026-09-16.md`. Everything pushed before this commit still exists in this repository's git history.

---

## 3. What each tier includes — REAL in code today, and nothing else

At most REAL-STATIC until `CHAIN-MAP.md` lands (the CEO's rule). Card copy is proposed Persian in the
«روراست» voice (`BRAND.md` §2).

### Free listing — **after launch** (decision 8), kept for that release

| Proposed card line | Class | Evidence / gap |
|---|---|---|
| «صفحه‌ی رستوران در اپِ مشتری: عکس، منو، آدرس» | REAL-STATIC for photos, menu and address | `RestaurantPhoto`, `MenuItem`/`MenuCategory` and `address` on `model Restaurant` (`api/prisma/schema.prisma`) |
| «راهِ تماس برای مهمان» | **Does not exist** | Requirement 4 (§1). The line waits for it |
| «رایگان، بدونِ تاریخِ انقضا» | Commercial term | True only once requirements 1–3 exist (§1 honesty gate) |

### Paid plans (all three identical)

| Proposed card line | Class | Evidence |
|---|---|---|
| «رزروِ آنلاین از اپِ مشتری و مدیریتِ میزها» | REAL-STATIC | `reservations_enabled` default on (`api/src/lib/feature-flags.ts:14-22`) |
| «لیستِ انتظار» | REAL-STATIC | `waitlist_enabled` on, and the panel calls the real queue API (`apps/business/js/waitlist.js:22-23`) |
| «پنلِ کسب‌وکار» | REAL-STATIC | `apps/business/` |
| «باشگاهِ مشتریان و پروفایلِ مهمان» | REAL-STATIC | `apps/business/js/crm.js:631` → `/restaurant/crm/*` |
| «بخش‌بندیِ مشتریان (RFM) و گزارشِ عملکرد» | REAL-STATIC | `apps/business/js/crm.js:631` |
| «کسبِ امتیاز و کش‌بک برای مهمانان» | **PARTIAL**, earning only | The CEO's M-12 rule: earning real, spending off (FP-008). The card must not imply spending |
| «حداقلِ خرید بر اساسِ روز و ساعت، با پیشنهاد از روی رزروهای خودتان» | REAL-STATIC, as a rule engine | `api/src/lib/pricing.ts:151-234`. Never «هوشمند» (`api/src/lib/pricing.ts:1-10`) |
| «پیامکِ خودکار» (**«کوپن» removed from the line, v2.1**) | **PARTIAL**: wired, real delivery unproven | `apps/business/js/marketing.js`, `api/src/lib/sms.ts:78`. **Gate:** on the card only after the CEO certifies SMS delivery. **Coupons have no diner-side path (measured 2026-09-17):** the API accepts `coupon_code` on `POST /reservations` (`api/src/app/api/v1/reservations/route.ts:42`) and redeems only there (`api/src/lib/reservations.ts:619`), but **no UI sends it**. The customer booking payload has no coupon field (`apps/customer/js/data/booking.js:494-501`), and a repo-wide `git grep -l "coupon_code|couponCode"` over `apps standalone shared e2e` hits only reward-result display (`result_coupon_code`); positive control `party_size` → 5 files. A restaurant can create a coupon that no diner can use. So «کوپن» stays off every card until a booking flow sends the code |
| «چند شعبه با یک حساب» | REAL-STATIC | `api/src/app/api/v1/restaurant/branches/route.ts` |
| «کارکنان با سطحِ دسترسی، بدونِ سقفِ تعداد» | REAL-STATIC, including "no cap". **Confirmed by the CEO on 2026-09-17 with a positive control** | Permissions via `withRestaurantAuth` (`CLAUDE.md`). The CEO's measurement on `origin/main`: `max_?staff\|staffLimit\|maxUsers\|staff_?limit\|max_?seats\|seatLimit` over `api/src` → 0 files; positive control `maxPartySize\|max_party` → 2 files; `db.staff.count` on no request path; no gating by plan. Re-run if staff or plan code changes |
| «اتصال به سیستم‌های دیگر (Webhook)» | REAL-STATIC at schema and outbound level | `api/prisma/schema.prisma:1357`, `api/src/lib/outbound-http.ts` |
| ~~«۳۰ روز رایگانِ کامل برای شروع»~~ | **Removed for launch** | Decision 7: the team creates the account after purchase; decision 8: free accounts only at our discretion, never advertised |

### Not on any card

| Left out | Why |
|---|---|
| Online deposits / prepayment (بیعانه، پیش‌پرداخت) | Owner, 2026-09-17: off at launch |
| Gift cards | `gift_card_purchase_enabled` off (`api/src/lib/feature-flags.ts:70-73`) |
| Spending points | `points_redemption_enabled` off (FP-008) |
| «هوشمند», "AI", «دستیارِ هوشمند» | Nothing in the code is a model (`api/src/lib/pricing.ts:1-10`, `api/src/lib/assistant-nlu.ts:4`) |
| «پشتیبانیِ اولویت‌دار / اختصاصی», «بازبینیِ فصلی با تیم», «راه‌اندازی و انتقالِ داده» | Human services nobody is staffed for (`BUSINESS-PLAN.md` §6). They return on every paid card once a person is named |

---

## 4. Open — the owner's (money and tax), sent to the CEO as one package

1. ~~**VAT.**~~ **Decided 2026-09-17 (decision 6):** prices exclude VAT, and every card shows
   «+ ۱۰٪ مالیات بر ارزش افزوده», as Mupra and Duvita do (REAL).
2. **Price lock.** Proposed: a paid term keeps its price until it ends, and prices for *new*
   sign-ups are reviewed each quarter (food-group inflation 127.5%, SECONDARY).
3. **Founding restaurants (optional).** For the first ten, in exchange for feedback and permission
   to show real results, the m12 price is honoured for a second year.

Not in the package, because `BUSINESS-MODEL.md` §7.4 already holds it: SMS top-ups beyond the
starter 50 (≈24 toman per message, REAL).

---

## 5. The arithmetic at the owner's prices

| | m3 18M | m6 33M | m12 60M |
|---|---|---|---|
| Per month | 6.00M | 5.50M | 5.00M |
| Off the m3 monthly price | — | ≈8.3% | ≈16.7% |
| Honest "compare at" (m3 multiplied out) | — | 36M | 72M |

The seed's current `compareAtToman` values are 36,000,000 and 72,000,000, **and they stay correct**
with the new m3 price.

| Restaurants on m12 | Annual subscription revenue |
|---|---|
| 10 | 600,000,000 |
| 30 | 1,800,000,000 |
| 100 | 6,000,000,000 |

**Restaurants needed per 100M toman of monthly cost base:** 100M ÷ 5.0M = **20**, before margin and
VAT. Free listings add **zero** revenue: their value is catalogue depth for diners and an upgrade
path, and their conversion is `UNKNOWN`. SMS at ≈24 toman per message is <0.5% of 5.0M at 1,000
messages a month.

---

## 6. The pricing-page honesty fixes (M-12), as proposed copy

Unchanged from v1 except rows 1 and 7. The CEO added rows 4 and 6 to M-12 on 2026-09-17.

| # | Live now | Problem | Proposed |
|---|---|---|---|
| 1 | Lead: «تفاوتِ پلن‌ها در مدت و سطحِ پشتیبانی است…» (`apps/landing/app/pricing/page.tsx:134-137`), next to tiered cards | The page contradicts itself | «همه‌ی پلن‌های پولی همه‌ی قابلیت‌ها را دارند. تفاوت فقط در مدت و قیمتِ ماهانه است.» Cards: §3's paid list, identical on all three |
| 2 | «امتیاز، کش‌بک و کارتِ هدیه» (m6) · «کمپین، امتیاز و کش‌بک» (`apps/landing/app/pricing/page.tsx:86`) | The gift card flag is off, and point spending is off | «کسبِ امتیاز و کش‌بک برای مهمانان». No gift card |
| 3 | «قواعدِ قیمتِ هوشمند و حداقلِ خریدِ پویا» (m12) | Sells a rule engine as intelligence | «حداقلِ خرید بر اساسِ روز و ساعت، با پیشنهاد از روی رزروهای خودتان» |
| 4 | Badge «محبوب‌ترین» on m6 (`api/prisma/seed/site-content.json:31`) | No sales exist pre-launch, so "most popular" cannot be true | No badge. «بهترین ارزش» (`:51`) may become «کمترین قیمتِ ماهانه», which is arithmetic and true |
| 5 | «بازبینیِ فصلیِ عملکرد با تیمِ رزرونو» · «پشتیبانیِ اولویت‌دار / اختصاصی» | A name `E-001` hasn't settled, and unstaffed services | Removed. One real support line on every card |
| 6 | FAQ «…اتصالِ درگاهِ پرداخت در برنامه‌ی بعد از انتشار است.» (`api/prisma/seed/site-content.json:217`, mirrored in `apps/landing/content/` and `shared/content/`) | Promises online payment; the owner ruled it off for now | Keep the first two sentences, drop the last |
| 7 | *(new)* A free-listing card | Would be false until §1 requirements 1–3 ship, **and the owner moved the free tier to after launch** (decision 8) | **No free card at launch** |
| 8 | *(new, decision 6)* Prices shown with no VAT line | The owner decided prices exclude VAT | «+ ۱۰٪ مالیات بر ارزش افزوده» on every card and price surface |
| 9 | *(new, decisions 7–8)* The trial offer: the `/demo` page title «دموی رایگان ۳۰ روزه» (`apps/landing/app/demo/page.tsx:20`), the OG image «دموی ۳۰ روزه‌ی رایگان» (`apps/landing/app/opengraph-image.tsx:84`), and the trial form | Launch has no self-serve trial: the team creates accounts after purchase | Remove from launch copy, or re-point to «درخواستِ خرید / تماس». The CEO routes whether the page is hidden or rewritten |

---

## 7. What happens next

1. **CEO:** put §4 in front of the owner. Route §1's six requirements to the Implementation Team for
   sizing, with requirement 5 linked to the existing handoff item 6. Verify §3.
2. **Implementation Team** (after §4 is answered): prices 18/33/60 at `api/prisma/seed/site-content.json:10,29,49`
   plus M-12 rows 1–6 in a single commit, which the CEO verifies before `main`. **The free tier ships
   separately**, with the gating (§1), and not before.
3. **Marketer:** `BUSINESS-MODEL.md` §3 and `BUSINESS-PLAN.md` §7 are updated to 18/33/60 and the free
   tier in the same commit as this v2. Then the restaurant playbook, where the pitch now has two
   doors: free listing → paid, and trial → paid.

---

**Line for the CEO:** «Marketer `rezv-c6` → `docs/marketing/PRICING.md` v2.3: قیمت‌های مالک ۱۸ / ۳۳ / ۶۰M + ۱۰٪ مالیات؛
لانچ پولی، حساب را تیم می‌سازد، لیستینگِ رایگان بعد از لانچ؛ منطقِ رقابتیِ قیمت و خطِ داخلیِ فروش به ریپوی خصوصی رفت
(`business/pricing/PRICING.internal.md`، `97bdc4f`).»
