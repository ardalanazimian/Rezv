# PRICING — a proposal to replace the 18 / 34 / 65M placeholders, built from the research

**Date:** 2026-09-17 · **Session:** `rezv-c6 [897f2f]` (Marketer) · **Target:** the CEO `rezv-87 [09dbab]` ·
**Status:** v1 proposal, **submitted — not closed** · **Base:** `main = cf60b9c`.

**Why this exists — the owner's ruling, relayed by the CEO on 2026-09-17:** the 18/34/65M toman prices
(`api/prisma/seed/site-content.json:10,29,49`) are **not real prices**, and they must change based on
the market research («نه، نسبت به جواب تحقیق مارکتینگ تغییر بده»). The CEO asked for three things:
- per plan, a proposed price, its evidence, and what it includes that is REAL in code today;
- an explicit `UNKNOWN` wherever the market gives no anchor;
- the honesty fixes for the pricing page.

**Chain of approval:** I propose. The CEO verifies. The Implementation Team applies it to the seed
and the landing. **The owner sees the final numbers before anything reaches `main`**, and he does the
push. This file edits nothing.

**Standing constraint:** deposits are **off at launch, by the owner's decision on 2026-09-17**
(`BUSINESS-MODEL.md` §5). No plan below includes or implies online deposits or prepayment.

---

## 0. The proposal in one table

| Plan (seed key) | Proposed price (toman, excl. VAT — see §4) | Per month | Old placeholder |
|---|---|---|---|
| سه‌ماهه (`m3`) | **6,000,000** | 2.00M | 18,000,000 |
| شش‌ماهه (`m6`) | **11,000,000** | 1.83M | 34,000,000 |
| یک‌ساله (`m12`) | **20,000,000** | 1.67M | 65,000,000 |

**All three plans include the same product.** They differ only in term and price per month, which is
what the code already does (`tenantPlan: "pro"` on every plan). The 30-day free trial stays as it is
in code (`api/src/lib/site-orders.ts:36`).

**The one-line logic:** our whole product costs **less per year than the lowest price a POS-suite
competitor publishes for a reservation module alone** (SmartX, 21,450,000, REAL). We are also
pre-launch, without a POS, with SMS delivery unproven and point spending off, selling into a
contracting market. So we price as the add-on a restaurant can say yes to next to the POS bill it
already pays, not as a suite.

**What it costs, said plainly:** at 20M/yr instead of 65M, the business needs **about 3.25× more
restaurants** for the same revenue. Per 100M toman of monthly cost base, that is about **60
restaurants on m12 instead of about 18.5** (§5). That trade is the owner's to accept.

---

## 1. The evidence, and what each anchor can and cannot justify

All from `research/COMPETITORS-IRAN-2026-09-16.md` and `research/BENCHMARKS-GLOBAL-2026-09-16.md`,
both reviewed by me before use. Classes are as in those files.

| Anchor | Price per year (toman) | What it buys | Class | What it tells our price |
|---|---|---|---|---|
| SmartX reservation module | **21,450,000** (service page) or 52,800,000 (pricing page) — two live pages contradicting each other | Reservation only | REAL (both pages, re-fetched 09-16) | **The ceiling for "less than one module".** Taking the lower of the two keeps the line true against both pages |
| SmartX customer club module | 51,000,000 | Club only | REAL | Reservation + club together from the POS-suite leader costs 72–104M/yr. We are nowhere near that and shouldn't pretend to be |
| Mupra Base | 19,900,000 + 10% VAT | POS + menu + basic customer management. **No reservation** | REAL | The entry ticket of a POS suite. At 20M we sit at the same number without being a POS |
| Mupra Advanced | 49,500,000 + VAT | Adds loyalty. **Reservation priced on request** | REAL | Loyalty inside a suite costs ~50M |
| Duvita Basic | 36,000,000 + VAT (3M/mo) | POS + club + SMS. **No reservation found** | REAL | A small operation already pays ~40M incl. VAT for its suite. We have to fit **next to** that |
| RSEE Complete / Professional | 3,990,000 (12 mo) / 990,000 | A reservation tool. **The diner also pays** prepaid credit | REAL | The floor of the "tool" band. RSEE earns on the diner; we don't, so the restaurant carries our whole cost. That justifies being above RSEE, not how far above |
| Softmenu | 4,900,000 – 25,000,000 | Digital menu + a birthday-SMS "club" | REAL / CLAIMED | Cheap products already bundle a light club |
| MENA reservation players | Eat App, resOS, Tablein: flat monthly, **no commission**. Free entry tiers exist | Reservation SaaS | REAL (fetched) | Supports **flat, no commission, a free way in**. **Not converted to toman**, because no exchange rate was sourced |
| SMS cost | ≈16–24 toman per message, all-in | — | REAL (provider's own tariff, 1405/04) | 1,000 SMS/month ≈ 24,000 toman ≈ **1.4% of the m12 monthly price**. Not a pricing driver |
| Food-group inflation | 127.5% point-to-point (Mordad 1405) | — | SECONDARY | Short terms need price reviews. Annual prices should be locked for their term (§4) |

**Where the market gives no anchor: `UNKNOWN`**
- **Willingness to pay.** Nobody has interviewed a restaurant owner. This is the biggest unknown in
  the proposal, and the first ten conversations (`BUSINESS-PLAN.md` §4.1) test it directly.
- **Our cost base** (people, hosting). So no margin or break-even is claimed (§5).
- **Which band the buyer puts us in:** a cheap tool (RSEE) or a suite module (SmartX / Mupra).
- **Foodro's price to restaurants** (live status unknown too, `BUSINESS-MODEL.md` §8). If it turns
  out to be free inside SnappFood's commission, every number here comes under pressure.
- **Whether the company charges VAT** (§4).

---

## 2. Why these numbers and not others — the alternatives, honestly

| Option | m3 / m6 / m12 (toman) | For | Against |
|---|---|---|---|
| **A — recommended** | **6M / 11M / 20M** | True line: "the whole product for less than a competitor's reservation module". Fits next to a POS bill. Suits a pre-launch product with PARTIAL features and a contracting market | ~60 restaurants per 100M monthly cost. It may read as "cheap tool" to an owner used to suite prices |
| B — higher | 9M / 16.5M / 30M | ~40 restaurants per 100M monthly cost. Still below Duvita Basic incl. VAT (39.6M) | Above SmartX's lower reservation price, so the "less than one module" line dies. A harder yes pre-launch |
| C — keep the old | 18M / 34M / 65M | Fewest restaurants needed (~18.5 per 100M) | The owner has ruled these are not real prices. Priced like a suite with no POS, no references and PARTIAL features |
| D — volume tiers | — | Tiers that differ honestly by booking volume (Tablein, resOS, REAL) | **Not buildable today:** no metering or enforcement in code, and expiry itself isn't enforced (`api/src/lib/subscription.ts:30`). Revisit after launch |

**Why the term ladder is 2.00 → 1.83 → 1.67 M/month:** a longer commitment gets a lower monthly
price (≈8% off at 6 months, ≈17% at 12), and the gap is simple enough to verify by hand. The
card's "compare at" line stays honest because it is the real m3 price multiplied out: m6 against
12M, m12 against 24M.

**Why not a 1-month plan:** the trial already gives a free month, and billing is manual (lead →
call → invoice → admin activation, `BUSINESS-MODEL.md` §0-c). Monthly invoicing by hand multiplies
the operations cost. Revisit when payment of the subscription itself is automated.

---

## 3. What every plan includes — REAL in code today, and nothing else

Every row carries its code evidence and is at most REAL-STATIC until `CHAIN-MAP.md` lands (the CEO's
rule). The card copy is proposed Persian in the «روراست» voice (`BRAND.md` §2).

| Proposed card line | Class | Evidence |
|---|---|---|
| «رزروِ آنلاین و مدیریتِ میزها» | REAL-STATIC | `reservations_enabled` default on (`api/src/lib/feature-flags.ts:14-22`) |
| «لیستِ انتظار» | REAL-STATIC | `waitlist_enabled` on. The panel calls the real queue API (`apps/business/js/waitlist.js:22-23`) |
| «باشگاهِ مشتریان و پروفایلِ مهمان» | REAL-STATIC | `apps/business/js/crm.js:631` → `/restaurant/crm/*` |
| «بخش‌بندیِ مشتریان (RFM) و گزارشِ عملکرد» | REAL-STATIC | `apps/business/js/crm.js:631` (RFM via the restaurant API) |
| «کسبِ امتیاز و کش‌بک برای مهمانان» | **PARTIAL.** Earning is wired | The CEO's M-12 rule: earning is real, spending is off (FP-008). **The card must not imply spending**, see §6 |
| «حداقلِ خرید بر اساسِ روز و ساعت، با پیشنهاد از روی رزروهای خودتان» | REAL-STATIC, as a rule engine | `api/src/lib/pricing.ts:151-234`. Never «هوشمند» (`api/src/lib/pricing.ts:1-10`) |
| «کوپن و پیامکِ خودکار» | **PARTIAL.** Panel and API wired, real delivery unproven | `apps/business/js/marketing.js`, `api/src/lib/sms.ts:78`. **Gate:** on the card only after the CEO certifies SMS delivery (`BUSINESS-PLAN.md` §5, Phase 0). If it isn't certified at launch, the line comes off |
| «چند شعبه با یک حساب» | REAL-STATIC | `api/src/app/api/v1/restaurant/branches/route.ts` |
| «کارکنان با سطحِ دسترسی، بدونِ سقفِ تعداد» | REAL-STATIC for the roles. **"No cap" is an absence claim** | Permissions via `withRestaurantAuth` (`CLAUDE.md`, backend conventions). `git grep -iE "max_?staff\|staffLimit\|maxUsers"` over `api/src` returned nothing, with no positive control. **CEO to confirm before "بدونِ سقف" ships** |
| «اتصال به سیستم‌های دیگر (Webhook)» | REAL-STATIC at schema and outbound level | `api/prisma/schema.prisma:1357`, `api/src/lib/outbound-http.ts` |
| «۳۰ روز رایگان برای شروع» | REAL-STATIC | `api/src/lib/site-orders.ts:36` |

**Deliberately not on any card:**

| Left out | Why |
|---|---|
| Online deposits / prepayment (بیعانه، پیش‌پرداخت) | **Owner's decision 2026-09-17: off at launch** |
| Gift cards | `gift_card_purchase_enabled` off (`api/src/lib/feature-flags.ts:70-73`) |
| Spending points | `points_redemption_enabled` off (FP-008) |
| «هوشمند», "AI", «دستیارِ هوشمند» | Nothing in the code is a model (`api/src/lib/pricing.ts:1-10`, `api/src/lib/assistant-nlu.ts:4`) |
| «پشتیبانیِ اولویت‌دار / اختصاصی», «بازبینیِ فصلی با تیم» | Human services nobody is staffed for (`BUSINESS-PLAN.md` §6). Support should be one line, the same on every plan, naming a real channel once the owner names who answers |
| «راه‌اندازی و انتقالِ دادهٔ اولیه» | Same reason. It goes back on **every** card once a person is named, not as a tier perk |

---

## 4. Terms the owner has to set (no anchor, so no recommendation pretends to be one)

1. **VAT.** Mupra and Duvita publish "+10% VAT" (REAL). Whether ⟨NAME⟩'s legal entity charges VAT is
   `UNKNOWN` to me. The card must say either «+ ۱۰٪ مالیات بر ارزش افزوده» or «با احتساب مالیات». An
   accountant answers this, not marketing.
2. **Price lock.** Proposed: a paid term keeps its price until it ends. The m3 and m6 prices for *new*
   sign-ups are reviewed every quarter, because food-group inflation is 127.5% (SECONDARY). That is a
   promise, so it needs the owner's yes.
3. **Founding restaurants (the first ten).** Optional: in exchange for feedback and permission to
   show their real results, the m12 price is honoured for a second year. Also a promise, and also
   the owner's call.
4. **SMS beyond the starter 50** (`api/src/lib/sms-balance.ts:8`): top-ups at cost, at a markup, or
   an allowance inside the plan. The cost is ≈24 toman per message (§1). The decision is
   `BUSINESS-MODEL.md` §7.4.

---

## 5. What the new prices do to the plan's arithmetic

| | Old placeholder (m12 = 65M) | Proposal A (m12 = 20M) | Proposal B (m12 = 30M) |
|---|---|---|---|
| Monthly equivalent per restaurant | 5.42M | 1.67M | 2.50M |
| Restaurants per 100M toman of monthly cost base (before margin) | ≈ 18.5 | **≈ 60** | ≈ 40 |
| Annual subscription revenue, 30 restaurants on m12 | 1.95B | **600M** | 900M |
| Annual subscription revenue, 100 restaurants on m12 | 6.5B | **2.0B** | 3.0B |

Arithmetic only. The cost base is `UNKNOWN`, so none of this is a margin or a break-even. What it
shows: **proposal A needs volume**. It makes Phase 2's thirty restaurants a validation milestone,
not a business, and the owner should accept that knowingly. `BUSINESS-PLAN.md` §7 is updated to
these numbers once the owner chooses.

---

## 6. The pricing-page honesty fixes (M-12), as proposed copy

The landing and the seed are not mine to edit. The CEO routes these to the Implementation Team.

| # | Live now | Problem | Proposed |
|---|---|---|---|
| 1 | Lead: «تفاوتِ پلن‌ها در مدت و سطحِ پشتیبانی است، نه در قفل‌بودنِ قابلیت‌ها…» (`apps/landing/app/pricing/page.tsx:134-137`), next to cards whose features differ by tier | The page contradicts itself | Lead: «همه‌ی پلن‌ها همه‌ی قابلیت‌ها را دارند. تفاوت فقط در مدت و قیمتِ ماهانه است.» Cards: the §3 list, identical on all three |
| 2 | «امتیاز، کش‌بک و کارتِ هدیه» (m6) · «کمپین، امتیاز و کش‌بک» (`apps/landing/app/pricing/page.tsx:86`) | The gift card flag is off, and point spending is off | «کسبِ امتیاز و کش‌بک برای مهمانان». No gift card |
| 3 | «قواعدِ قیمتِ هوشمند و حداقلِ خریدِ پویا» (m12) | Sells a rule engine as intelligence | «حداقلِ خرید بر اساسِ روز و ساعت، با پیشنهاد از روی رزروهای خودتان» |
| 4 | Badge «محبوب‌ترین» on m6 (`api/prisma/seed/site-content.json:31`) | **New finding:** pre-launch, with no sales, "most popular" cannot be true | No badge. Or, only if the arithmetic stays true: «کمترین قیمتِ ماهانه» on m12 in place of «بهترین ارزش» (`site-content.json:51`) |
| 5 | «بازبینیِ فصلیِ عملکرد با تیمِ رزرونو» · «پشتیبانیِ اولویت‌دار / اختصاصی» | A name that `E-001` hasn't settled, and unstaffed services | Removed (§3), and one real support line on every card |
| 6 | FAQ: «…اتصالِ درگاهِ پرداخت در برنامه‌ی بعد از انتشار است.» (`api/prisma/seed/site-content.json:217`, mirrored in `apps/landing/content/` and `shared/content/`) | **New finding:** a roadmap promise for online payment. The owner ruled deposits off for now, with no date to re-decide | Keep the first two sentences, which are true today. Drop the last one |

---

## 7. What happens next

1. **CEO:** verify §3's evidence column, and confirm or strike "بدونِ سقف" (the absence claim).
   Route §6 with M-12.
2. **Owner:** choose A, B, or a different number with a reason. Answer §4.1–4.3. He sees the final
   numbers before `main`.
3. **Implementation Team** (after 1 and 2): the seed prices and cards, the landing lead, the FAQ
   sentence.
4. **Marketer:** once the owner chooses, update `BUSINESS-MODEL.md` §3 and `BUSINESS-PLAN.md` §7 to
   the chosen numbers. The first ten restaurant conversations then test it, and the result comes
   back here as v2.

---

**Line for the CEO:** «Marketer `rezv-c6` → `docs/marketing/PRICING.md` v1 (proposal): پیشنهادِ A = ۶ / ۱۱ /
۲۰ میلیون تومان (سه/شش/دوازده‌ماهه)، همه‌ی پلن‌ها همه‌ی قابلیت‌ها؛ منطق: کلِ محصول کمتر از قیمتِ
منتشرشده‌ی فقط ماژولِ رزروِ SmartX (۲۱.۴۵M، REAL)؛ هزینه‌اش: ~۶۰ رستوران برای هر ۱۰۰M هزینه‌ی ماهانه
به‌جای ~۱۸.۵؛ گزینه‌ی B = ۹ / ۱۶.۵ / ۳۰؛ هیچ بیعانه، کارتِ هدیه، خرجِ امتیاز یا «هوشمند»؛ دو یافته‌ی
تازه برای M-12: نشانِ «محبوب‌ترین» پیش از لانچ و وعده‌ی درگاهِ پرداخت در FAQ؛ «بدونِ سقفِ کارکنان»
ادعای عدم است و تأییدِ تو را می‌خواهد.»
