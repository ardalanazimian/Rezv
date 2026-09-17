# RESTAURANTS — the playbook for winning the first ten, and the funnel they walk through

**Date:** 2026-09-17 · **Session:** `rezv-c6 [897f2f]` (Marketer) · **Target:** the CEO `rezv-87 [09dbab]` ·
**Status:** v1 draft, **submitted — not closed** · **Base:** `main = cf60b9c` (code read there;
`origin/main` has since moved to `aa3d1bf`).

**What it needs:**
- **Owner:** §7. The district and who sells both block §5.
- **CEO:** the four code questions in §7.

**Charter:** Workstream 3 (`docs/audit/prompts/marketer.md`). Pitch, onboarding funnel, channel plan,
and the first ten by category, never by named business.

**Built on:** `BUSINESS-PLAN.md` §4.1 and §5, `PRICING.md` v2 (the owner's prices and free tier),
`BRAND.md` («روراست»), and the Scout's `docs/audit/research/ANTI-PATTERNS.md`.

**Nothing here is sent, posted or promised.** Every pitch line has a class, and the gated ones say
what they wait for.

---

## 0. The recommendation first

1. **Sell in person, in one district, on a phone.** The owner sees the working panel, not a page. It
   is the only channel that works before we have a single reference.
2. **Lead with money kept, not growth.** Tehran food vendors report −45% customers (CLAIMED,
   re-fetched). An owner cutting costs listens to "stop losing booked tables", not to "more guests".
3. **Sell alongside what they already have** (SnappFood for delivery, a POS suite at the till),
   never instead of it. We have no delivery and no POS.
4. **Make the terms the pitch.** The research shows restaurants burned by commission tied to
   exclusivity, by opaque "call us" prices and by billing that continues after cancellation (§1). We
   can truthfully offer the opposite of all three today.
5. **Every trial is a measurement.** The trial restaurant learns its own no-show count, and so do we.
   That number replaces every adjective in the pitch after the first month.

---

## 1. What restaurants have been burned by, and what we can truthfully offer instead

| What restaurants dislike | Evidence | Class | Our answer, only where true today |
|---|---|---|---|
| **Commission discounts tied to exclusivity, and exit penalties** | Competition Council decision No. 740 against SnappFood's restaurant contracts (`docs/audit/research/ANTI-PATTERNS.md` #4) | REAL (regulator) | **A flat price and no commission** (`BUSINESS-MODEL.md` §1 R6, no commission code exists). **No exclusivity clause** is a proposal (`docs/audit/research/proposals/003-transparent-restaurant-terms.md`) that the owner must confirm in the actual contract terms before it is said (§7) |
| **Opaque, contradictory or "call us" prices** | SmartX publishes two prices for one module. Mupra and Sepidz gate their reservation modules (`research/COMPETITORS-IRAN-2026-09-16.md`) | REAL | **A published price:** 18 / 33 / 60M (`PRICING.md` v2), once it ships to the pricing page |
| **Billing that continues after cancelling** | A restaurant's review of TheFork describing debt collectors after termination (`ANTI-PATTERNS.md` #9) | REAL (a review exists) | **No automatic payment exists.** Nothing is charged to a card and nothing renews on its own: purchase is a request, then a call, then an invoice (`apps/landing/components/pricing/PurchaseDialog.tsx:106-121`, `apps/landing/app/pricing/page.tsx:92-97`) |
| **Discounts funded from the restaurant's own margin** | SnappFood promotions are restaurant-funded, per a secondary source and SnappFood's own vendor-academy content (`profiles/snappfood-loyalty.md`) | CLAIMED / circumstantial | **We run no discount marketplace.** Coupons in the panel are the restaurant's own tool, aimed at its own guests |
| **The platform owns the guest** | The dominant platform holds the diner relationship. Its vendor app shows a rating of **2** from 2,334 votes (`research/APP-STORE-FOOTPRINT-2026-09-16.md`) | REAL for the store figure; the *why* is `UNKNOWN` | **«مالِ خودت»:** tenant data comes only from the auth context (`CLAUDE.md`) and is never sold (`BUSINESS-MODEL.md` §6). **Not claimable yet:** a guest-data *export*. No export route was found in the restaurant API (§7) |

---

## 2. The pitch

### The 60-second version (spoken, Persian, «شما»)

> «رزروی که ثبت می‌شه و مهمان نمیاد، میزِ خالیه. ما یه پنل می‌دیم که رزرو، لیستِ انتظار و باشگاهِ
> مشتری‌هاتون یه‌جا باشه — و مشتری‌ها مالِ خودتون می‌مونن، نه ما.
> کمیسیون نمی‌گیریم. قیمت ثابته و روی سایت نوشته. کارت نمی‌گیریم و چیزی خودکار تمدید نمی‌شه.
> سی روز کاملش رو رایگان امتحان کنید؛ آخرِ ماه خودتون می‌بینید چند تا رزروِ بی‌حضور داشتید.»

**Line by line, with class and gate:**

| Line | Class | Gate / evidence |
|---|---|---|
| «پنل… رزرو، لیستِ انتظار و باشگاه یه‌جا» | REAL-STATIC | `PRICING.md` §3 (paid list) |
| «مشتری‌ها مالِ خودتون می‌مونن» | REAL-STATIC as architecture | `BRAND.md` value ۲. Must never be stretched to "you can export them" (§1) |
| «کمیسیون نمی‌گیریم. قیمت ثابته» | REAL-STATIC | No commission code (`BUSINESS-MODEL.md` §1 R6) |
| «روی سایت نوشته» | **Gated** | True once the Implementation commit ships 18/33/60 to the pricing page (`PRICING.md` §7) |
| «کارت نمی‌گیریم و چیزی خودکار تمدید نمی‌شه» | REAL-STATIC | No automatic payment (§1) |
| «سی روز کاملش رو رایگان» | REAL-STATIC | `api/src/lib/site-orders.ts:36` |
| «آخرِ ماه می‌بینید چند تا رزروِ بی‌حضور داشتید» | REAL-STATIC as a count | `Reservation.status = no_show` exists (`api/prisma/schema.prisma`, `ReservationStatus`). It counts only if staff mark it, as Resos also warns |

**Not in the pitch until gated:**
- «ما قبل از رزرو به مهمان یادآوری می‌کنیم» waits for the CEO's SMS-delivery proof.
- «بیعانه» is off by the owner's decision.
- «امتیاز خرج می‌شه» is off (FP-008).
- Any number about results waits for our own rows.

### Objections — answer with facts about us, never about them

**Rule:** we never bring up a competitor. If the owner names one, we state facts about ourselves. The
only comparative line allowed in a sales conversation is the published-price fact the CEO approved
(`PRICING.md` §2). Nothing about competitors goes into anything written.

| Owner says | Answer | Class |
|---|---|---|
| «اسنپ‌فود دارم» | «ما سفارش و ارسال نداریم؛ کنارِ اون کار می‌کنیم. رزرو و مشتری‌های حضوری‌تون اینجا ثبت می‌شن و مالِ خودتونه.» | REAL-STATIC |
| «صندوق/نرم‌افزار دارم» | «جاش رو نمی‌گیریم. اتصالِ آماده به صندوقِ خاصی نداریم؛ Webhook داریم که تیمِ فنیِ صندوق‌تون می‌تونه ازش استفاده کنه.» | REAL-STATIC for webhooks (`api/prisma/schema.prisma:1357`). **No POS-specific integration exists, so we say so** |
| «گرونه / کار کساده» | «سی روز رایگان امتحان کنید و تعدادِ بی‌حضورهای خودتون رو ببینید؛ بعد تصمیم بگیرید.» We never quote a saving we haven't measured | REAL-STATIC (trial) |
| «مشتری‌هام تو دایرکت رزرو می‌کنن» | «دایرکت بمونه. لینکِ رزرو رو هم بذارید؛ لیستِ انتظار و سابقه‌ی مهمان دیگه به حافظه‌ی یه نفر بند نیست.» | REAL-STATIC |
| «اگه بخوام قطع کنم؟» | «چیزی خودکار تمدید نمی‌شه. تمدید فقط با درخواستِ خودتون.» We do **not** promise data export (§1) | REAL-STATIC |
| «هوشمنده؟ هوش مصنوعی داره؟» | «نه. قاعده‌هاش مشخصه و می‌گیم چطور کار می‌کنه.» | Truth (`api/src/lib/pricing.ts:1-10`) |

---

## 3. The onboarding funnel — as the code runs it today

| # | Step | What the owner does or sees | Evidence in code | How it's counted | Likely drop (hypothesis) |
|---|---|---|---|---|---|
| 1 | Hears | A visit, Instagram, a referral | — | `SiteOrder.utmSource / utmMedium / utmCampaign` | — |
| 2 | Lands | `/demo`: «همان لحظه فعال», «بدونِ کارتِ بانکی», «محصولِ کامل», «داده‌ها می‌مانند» | `apps/landing/app/demo/page.tsx:28-31` | Landing telemetry, not counted here | The form feels like a sales trap |
| 3 | Signs up for the trial | Business name, contact, phone, email, city, branches, note | `apps/landing/components/forms/TrialForm.tsx` | `SiteOrder.kind = trial` | ⚠️ **This step will change:** the CEO routes phone-ownership proof (P1-4 Option A, consent/OTP) here |
| 4 | Account created instantly | Tenant, restaurant, owner staff and starter tables, plus a tracking code at `/order/{code}` | `api/src/lib/site-orders.ts:1-20`, `api/src/lib/provisioning.ts:31` | `SiteOrder` + `Tenant.trialEndsAt` | — |
| 5 | Logs into the panel | OTP to the same phone | `apps/landing/app/demo/page.tsx:35` | `Restaurant.lastSeenAt` (panel heartbeat, `api/prisma/schema.prisma:156`) | **SMS doesn't arrive.** Delivery is unproven, so this is the highest-risk step |
| 6 | Sets up | Tables, hours, menu | demo page, "after" list | Counts of tables and menu items per restaurant | Menu entry is tedious. Who helps? (§7, onboarding) |
| 7 | Turns on booking | The restaurant page goes live in the customer app | demo page, "after" list; `api/src/app/api/v1/restaurants/route.ts:41` | — | — |
| 8 | **First booking** | A real diner books | `Reservation` rows | **Time to first booking** = first `Reservation.createdAt` − `SiteOrder.createdAt` | Nobody sends diners (the at-venue QR needs `E-001`'s domain, `BUSINESS-PLAN.md` §4.2) |
| 9 | Decides to pay | Purchase request, call, invoice, activation | `apps/landing/components/pricing/PurchaseDialog.tsx`, `SiteOrderStatus` pending → contacted → activated | `SiteOrder.kind = purchase` status flow. `rejectedReason` on rejections | Nobody calls on day 25 because no one is assigned (§7) |
| 10 | Trial ends | **Today, nothing happens:** expiry is not enforced | `api/src/lib/subscription.ts:30` | — | Once gating ships (`PRICING.md` §1), this falls back to the free listing |

**Minimum instrumentation.** Almost all of it already exists as rows. Only two things are missing:
1. A **reason on `cancelled`** site orders (only `rejectedReason` is structured).
2. A **weekly view** of steps 3→5→8→9 per trial, which is a query, not a feature. Asking for it is the
   CEO's call.

---

## 4. Channels, with the effort each costs

| Channel | Hypothesis | Weekly effort (proposal) | Measured by | Stop if |
|---|---|---|---|---|
| **In-person visits, one district** | An owner who sees the panel on a phone starts a trial on the spot | 15–20 visits a week at quiet hours (15:00–18:00) | Visits logged by hand → trials (`SiteOrder`) | After 30 visits, fewer than 3 trials: the pitch is wrong, so fix it before continuing |
| **Instagram DM to venues that already take DM bookings** | They feel the DM-booking pain today | 20 messages a week, hand-written, no templates blasted. **Never scraped lists** (charter) | `utmSource=instagram` on the trial link | No replies after 40: stop, not escalate |
| **Referral from trial restaurants** | Owners trust owners | One ask per restaurant that reaches its first booking | `utmSource=ref-⟨id⟩` | — |
| **Free listing → paid** (owner's model) | A listed venue sees demand it can't take online | — | **Not usable until the gating ships** (`PRICING.md` §1) | — |
| **Guild channels** | Unions are publicly describing the squeeze | **None** without the owner's approval | — | — |

**Not a channel:** paid ads (until positioning copy is approved), bought lists, fake reviews, or
anything in `docs/audit/prompts/marketer.md` §"What you never do".

---

## 5. The first ten — categories, not businesses

**The owner picks the district** (`BUSINESS-PLAN.md` §9.3). What makes a good one: a walkable cluster
of sit-down venues, visible evening and weekend peaks, and venues whose Instagram bio already says
something like «رزرو: دایرکت» or a phone number.

| Slots | Category | Why it tests something | Pass looks like |
|---|---|---|---|
| 4 | **Sit-down restaurants with evening peaks** | The core no-show case | Bookings every week, and no-shows being marked |
| 3 | **Cafés with weekend queues** | The waitlist use case | The waitlist used on weekends |
| 2 | **Venues that take group or event bookings** | Larger no-show cost per table | At least one group booking recorded |
| 1 | **A venue already on a POS suite** | Tests "alongside, not instead" | Uses us next to its POS without asking us to replace it |

**Selection score** (0–2 each, visit the top-scoring first):
- Already takes bookings by DM or phone.
- The owner or manager is on site (not a chain HQ decision).
- Visible peak crowding.
- Within the walking cluster.
- Has an Instagram presence to announce booking.

**A ten-week sprint** (weeks from the owner's go, not from a date):

| Weeks | Work | Output |
|---|---|---|
| 1–2 | Walk the district, list reachable venues, score them | **The reachable count**, the plan's first real market number (`BUSINESS-PLAN.md` §2) |
| 3–6 | Visits and trials, top scores first | Trials started, and step 5 success (logged in) |
| 5–8 | Setup help and chasing the first booking | Time to first booking, per trial |
| 8–10 | Day-25 conversations: price, objections, pay or not | `activated`, plus the reason for every no |

**The gate** is the one in `BUSINESS-PLAN.md` §5, Phase 1, reviewed by the owner.

---

## 6. What we never do in restaurant sales

- **Exclusivity, exit penalties or "make us primary" clauses** (`ANTI-PATTERNS.md` #4), once the owner confirms it in the terms (§7).
- **Anything that bills without the owner asking again** (`ANTI-PATTERNS.md` #9).
- **A feature behind a flag that's off**, or deposits, while the owner's ruling stands.
- **A number we haven't measured on their own rows or ours.**
- **"Only this week" pricing or fake scarcity.**
- **Discounts that come out of the restaurant's margin while looking like our generosity.**
- **Bringing up a competitor.**

---

## 7. What this needs

**Owner**
1. **The district** (it blocks §5).
2. **Who visits and sells** (it blocks §4, and `BUSINESS-PLAN.md` §9.2).
3. **No exclusivity clause in the restaurant terms:** confirm it, so §1's answer can be said
   (`docs/audit/research/proposals/003-transparent-restaurant-terms.md` is only a proposal).
4. **Who helps a trial restaurant with setup** (menu entry, step 6), and whether it's free.
5. **The founding offer** (`PRICING.md` §4.3), since it changes the day-25 conversation.

**CEO** (code questions; I read, I don't edit)
1. **Is there a guest-data export** for restaurants? I found no CSV or export route under
   `api/src/app/api/v1/restaurant`. Until one exists, "your guests are yours" stops at architecture.
2. **When P1-4 Option A lands on the trial form** (step 3), what does the owner see? The funnel and
   pitch change with it.
3. **SMS delivery proof:** steps 5 and 8 and the reminder line all wait on it.
4. **`Reservation.source` values in use:** `'app'` by default and `'walkin'` (`api/src/lib/reservations.ts:991`).
   There is no value per acquisition channel. Should diner channels get one (for the diners playbook),
   or is that out of scope for launch?

---

**Line for the CEO:** «Marketer `rezv-c6` → `docs/marketing/restaurants/PLAYBOOK.md` v1: فروشِ حضوری در یک
محله روی گوشی؛ «پولی که می‌ماند» نه رشد؛ کنارِ اسنپ‌فود و POS نه به‌جایش؛ شرایط خودشان پیچ‌اند (بدونِ
کمیسیون، قیمتِ منتشرشده، هیچ تمدیدِ خودکار — همه REAL-STATIC؛ «بدونِ انحصار» منتظرِ تأییدِ مالک)؛ قیفِ ۱۰
مرحله‌ای از روی کد با شمارنده‌ی هر مرحله؛ ده رستوران در چهار دسته + اسپرینتِ ده‌هفته‌ای. چهار سؤالِ کد
برای تو: export داده‌ی مهمان، اثرِ P1-4 روی فرمِ trial، اثباتِ پیامک، و `Reservation.source`.»
