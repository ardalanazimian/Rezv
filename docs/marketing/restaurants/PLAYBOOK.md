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
5. **Every first month is a measurement.** The restaurant learns its own no-show count, and so do we.
   That number replaces every adjective in the pitch.
6. **Launch is paid (owner, 09-17).** There is no self-serve trial: contact → purchase → our team
   creates the account. A few free accounts are given at our discretion, and **the pitch never
   offers one**.

---

## 1. What restaurants have been burned by, and what we can truthfully offer instead

| What restaurants dislike | Evidence | Class | Our answer, only where true today |
|---|---|---|---|
| **Commission discounts tied to exclusivity, and exit penalties** | Competition Council decision No. 740 against SnappFood's restaurant contracts (`docs/audit/research/ANTI-PATTERNS.md` #4) | REAL (regulator) | **A flat price and no commission** (`BUSINESS-MODEL.md` §1 R6, no commission code exists). **No exclusivity clause** is a proposal (`docs/audit/research/proposals/003-transparent-restaurant-terms.md`) that the owner must confirm in the actual contract terms before it is said (§7) |
| **Opaque, contradictory or "call us" prices** | SmartX publishes two prices for one module. Mupra and Sepidz gate their reservation modules (`research/COMPETITORS-IRAN-2026-09-16.md`) | REAL | **A published price:** 18 / 33 / 60M (`PRICING.md` v2), once it ships to the pricing page |
| **Billing that continues after cancelling** | A restaurant's review of TheFork describing debt collectors after termination (`ANTI-PATTERNS.md` #9) | REAL (a review exists) | **No automatic payment exists.** Nothing is charged to a card and nothing renews on its own: purchase is a request, then a call, then an invoice (`apps/landing/components/pricing/PurchaseDialog.tsx:106-121`, `apps/landing/app/pricing/page.tsx:92-97`) |
| **Discounts funded from the restaurant's own margin** | SnappFood promotions are restaurant-funded, per a secondary source and SnappFood's own vendor-academy content (`profiles/snappfood-loyalty.md`) | CLAIMED / circumstantial | **We run no discount marketplace.** Do **not** pitch coupons: a restaurant can create them in the panel, but no diner can redeem one today, because no UI sends the code (`PRICING.md` §3) |
| **The platform owns the guest** | The dominant platform holds the diner relationship. Its vendor app shows a rating of **2** from 2,334 votes (`research/APP-STORE-FOOTPRINT-2026-09-16.md`) | REAL for the store figure; the *why* is `UNKNOWN` | **«مالِ خودت»:** tenant data comes only from the auth context (`CLAUDE.md`) and is never sold (`BUSINESS-MODEL.md` §6). **Not claimable:** a guest-data *export*. CEO ruling 2026-09-17: no guest-data export exists (confirmed with a positive control) and none is built for launch; bulk export of phone numbers is a PII surface that needs privacy design (backlog, P3). So ownership is said **only** as «در پنلِ خودتان می‌بینید» |

---

## 2. The pitch

### The 60-second version (spoken, Persian, «شما»)

> «رزروی که ثبت می‌شه و مهمان نمیاد، میزِ خالیه. ما یه پنل می‌دیم که رزرو، لیستِ انتظار و باشگاهِ
> مشتری‌هاتون یه‌جا باشه — و مشتری‌هاتون رو توی پنلِ خودتون می‌بینید، نه توی اپِ کسِ دیگه.
> کمیسیون نمی‌گیریم. قیمت ثابته — به‌علاوه‌ی ۱۰٪ مالیات — و روی سایت نوشته. کارت نمی‌گیریم و چیزی خودکار تمدید نمی‌شه.
> حسابتون رو تیمِ ما می‌سازه؛ آخرِ ماهِ اول خودتون می‌بینید چند تا رزروِ بی‌حضور داشتید.»

**Line by line, with class and gate:**

| Line | Class | Gate / evidence |
|---|---|---|
| «پنل… رزرو، لیستِ انتظار و باشگاه یه‌جا» | REAL-STATIC | `PRICING.md` §3 (paid list) |
| «مشتری‌هاتون رو توی پنلِ خودتون می‌بینید» | REAL-STATIC | `BRAND.md` value ۲, in the only form the CEO allows (§1). Never "you can export them" or "take them with you": no export exists or is planned for launch |
| «کمیسیون نمی‌گیریم. قیمت ثابته» | REAL-STATIC | No commission code (`BUSINESS-MODEL.md` §1 R6) |
| «روی سایت نوشته» | **Gated** | True once the Implementation commit ships 18/33/60 to the pricing page (`PRICING.md` §7) |
| «کارت نمی‌گیریم و چیزی خودکار تمدید نمی‌شه» | REAL-STATIC | No automatic payment (§1) |
| «قیمتی که الان می‌خرید تا آخرِ دوره‌ی اشتراک‌تون ثابت می‌مونه» | Owner decision 10, REAL-STATIC support | The purchase stores a price snapshot (`amountToman`, `model SiteOrder`). **Never** «قیمت هیچ‌وقت عوض نمی‌شه»: new prices may change |
| «حسابتون رو تیمِ ما می‌سازه» | REAL-STATIC | `provisionBusiness` (`api/src/lib/provisioning.ts:94`). Owner decision 09-17 |
| «به‌علاوه‌ی ۱۰٪ مالیات» | Owner decision | `PRICING.md` decision 6 |
| ~~«سی روز کاملش رو رایگان»~~ | **Removed** | Owner 09-17: launch is paid, and free accounts are at our discretion only, never pitched |
| «آخرِ ماه می‌بینید چند تا رزروِ بی‌حضور داشتید» | REAL-STATIC as a count | `Reservation.status = no_show` exists (`api/prisma/schema.prisma`, `ReservationStatus`). It counts only if staff mark it, as Resos also warns |

**Not in the pitch until gated:**
- «ما قبل از رزرو به مهمان یادآوری می‌کنیم» waits for the CEO's SMS-delivery proof.
- «بیعانه» is off by the owner's decision.
- «امتیاز خرج می‌شه» is off (FP-008).
- Any number about results waits for our own rows.

### Objections — answer with facts about us, never about them

**Rule:** we never bring up a competitor. If the owner names one, we state facts about ourselves. The
only comparative line allowed in a sales conversation is the one the CEO approved, and it is kept
in the private repository (`PRICING.md` §2), not here. Nothing about competitors goes into anything
written.

| Owner says | Answer | Class |
|---|---|---|
| «اسنپ‌فود دارم» | «ما سفارش و ارسال نداریم؛ کنارِ اون کار می‌کنیم. رزرو و مشتری‌های حضوری‌تون اینجا ثبت می‌شن و توی پنلِ خودتون می‌بینیدشون.» | REAL-STATIC |
| «صندوق/نرم‌افزار دارم» | «جاش رو نمی‌گیریم. اتصالِ آماده به صندوقِ خاصی نداریم؛ Webhook داریم که تیمِ فنیِ صندوق‌تون می‌تونه ازش استفاده کنه.» | REAL-STATIC for webhooks (`api/prisma/schema.prisma:1357`). **No POS-specific integration exists, so we say so** |
| «گرونه / کار کساده» | «قبل از خرید، پنلِ واقعی رو همین‌جا روی گوشی ببینید؛ ماهِ اول تعدادِ بی‌حضورهای خودتون رو می‌بینید.» We never quote a saving we haven't measured, and we never offer a free account in the pitch | REAL-STATIC (panel demo mode with labelled `[DEMO]` data, `CLAUDE.md`) |
| «مشتری‌هام تو دایرکت رزرو می‌کنن» | «دایرکت بمونه. لینکِ رزرو رو هم بذارید؛ لیستِ انتظار و سابقه‌ی مهمان دیگه به حافظه‌ی یه نفر بند نیست.» | REAL-STATIC |
| «اگه بخوام قطع کنم؟» | «چیزی خودکار تمدید نمی‌شه. تمدید فقط با درخواستِ خودتون.» We do **not** promise data export (§1). **Once M-21 ships** (not before), the seller may add: «اگه تمدید نکنید رزروِ تازه بسته می‌شه، ولی رزروهای قبلی رو می‌تونید مدیریت کنید و هیچ داده‌ای پاک نمی‌شه.» | REAL-STATIC (renewal). The day-0 line is decided, not built |
| «هوشمنده؟ هوش مصنوعی داره؟» | «نه. قاعده‌هاش مشخصه و می‌گیم چطور کار می‌کنه.» | Truth (`api/src/lib/pricing.ts:1-10`) |

---

## 3. The onboarding funnel — contact → purchase → our team creates the account (owner, 09-17)

The self-serve trial path is **not** the launch funnel. It still exists in code (`/demo`,
`TrialForm.tsx`, `api/src/lib/site-orders.ts:36`), and `PRICING.md` §6 row 9 routes its copy.

| # | Step | What happens | Evidence in code | How it's counted | Likely drop (hypothesis) |
|---|---|---|---|---|---|
| 1 | Hears | A visit, Instagram, a referral | — | Visits in a hand log. Web leads carry `SiteOrder.utmSource / utmMedium / utmCampaign` | — |
| 2 | Sees the panel | The seller shows the business panel on a phone | Demo mode with labelled `[DEMO]` data when there is no token (`CLAUDE.md`, demo/OTP section) | Hand log | The demo looks fake. Show real screens, labelled |
| 3 | Asks to buy | In person, or the purchase dialog on `/pricing` | `apps/landing/components/pricing/PurchaseDialog.tsx` → `SiteOrder.kind = purchase`, `pending` | `SiteOrder` | The price with VAT surprises them. Say «+ ۱۰٪» up front |
| 4 | Call and invoice | Our team calls and issues an invoice with +10% VAT | `apps/landing/app/pricing/page.tsx:92-97`; `SiteOrderStatus.contacted` | Status | Nobody calls fast enough. Who calls is `UNKNOWN` (§7) |
| 5 | Pays | Outside the product, no online subscription payment | «پرداختِ آنلاینِ خودکار نداریم» (`apps/landing/app/pricing/page.tsx:235`) | `UNKNOWN`: there is no paid-date field. Record it in `adminNote` until one exists | — |
| 6 | **Our team creates the account** | Tenant, restaurant and owner staff; plan and expiry set | `provisionBusiness` (`api/src/lib/provisioning.ts:94`) via `api/src/app/api/v1/admin/restaurants/route.ts`; activation at `api/src/app/api/v1/admin/restaurants/[id]/control/route.ts:44-96` | `SiteOrder.activated`, `Tenant.planExpiresAt` | ⚠️ Phone-ownership proof (P1-4 Option A) applies at the owner's first login; the CEO sends the final flow |
| 7 | Owner logs in | OTP to the owner's phone | — | `Restaurant.lastSeenAt` (`api/prisma/schema.prisma:156`) | 🔴 **BLOCKED until real SMS delivery is proven** (S-07) |
| 8 | Restaurant enters its info | Tables, hours, menu, photos. **The restaurant's own job while subscribed** (owner, 09-17) | — | Counts of tables and menu items | Menu entry is tedious. Whether our team helps is `UNKNOWN` (§7) |
| 9 | **First booking** | A real diner books | `Reservation` rows | Time to first booking = first `Reservation.createdAt` − activation | Nobody sends diners (the at-venue QR needs `E-001`) |
| 10 | 15 days before expiry | The panel shows days left and a renewal notice (owner, 09-17) | **Routed, not built:** M-21, `rezv-1b` (`PRICING.md` §1a L2) | — | Until it ships, a human checks the admin list weekly |
| 10b | Day 0 without renewal | Editing locks, new bookings close, the restaurant is hidden from the customer app, existing bookings stay manageable, nothing is deleted | **Decided, not built** (`PRICING.md` §1a L4) | — | — |
| 11 | Renews, or not | A renewal is a new purchase, steps 3–6 | Same | `activated` again, or `rejectedReason` / `adminNote` for why not | — |

**Minimum instrumentation.** Almost all of it already exists as rows. Only three things are missing:
1. A **reason on `cancelled`** site orders (only `rejectedReason` is structured).
2. A **paid date** (step 5): until a field exists, `adminNote`.
3. A **weekly view** of steps 2→3→6→7→9 per restaurant, which is a query, not a feature. Asking for it
   is the CEO's call.

---

## 4. Channels, with the effort each costs

| Channel | Hypothesis | Weekly effort (proposal) | Measured by | Stop if |
|---|---|---|---|---|
| **In-person visits, one district** | An owner who sees the panel on a phone asks to buy, or books a follow-up call | 15–20 visits a week at quiet hours (15:00–18:00) | Visits logged by hand → purchase requests (`SiteOrder.kind = purchase`) | After 30 visits, fewer than 3 purchase requests: the pitch or the price is wrong, so fix it before continuing |
| **Instagram DM to venues that already take DM bookings** | They feel the DM-booking pain today | 20 messages a week, hand-written, no templates blasted. **Never scraped lists** (charter) | `utmSource=instagram` on the purchase-request link | No replies after 40: stop, not escalate |
| **Referral from paying restaurants** | Owners trust owners | One ask per restaurant that reaches its first booking | `utmSource=ref-⟨id⟩` | — |
| **Free listing → paid** (owner's model) | A listed venue sees demand it can't take online | — | **After launch** (owner, 09-17), and only once the gating ships (`PRICING.md` §1) | — |
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
| 3–6 | Visits, panel demos and purchase requests, top scores first | Purchase requests (step 3), and accounts created (step 6) |
| 5–8 | Restaurants entering their info, and chasing the first booking | Time to first booking, per restaurant |
| 8–10 | Follow-up on every open request: price, VAT, objections | `activated`, plus the reason for every no |

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
2. **Who visits and makes the sales calls** (it blocks §4, and `BUSINESS-PLAN.md` §9.2). Still `UNKNOWN`, in the owner's queue (CEO, 09-17).
3. **No exclusivity clause in the restaurant terms:** confirm it, so §1's answer can be said
   (`docs/audit/research/proposals/003-transparent-restaurant-terms.md` is only a proposal).
4. ~~Who creates accounts~~ **Decided 09-17:** our team creates the account and the restaurant enters its own info. **Decided 09-17: accounts are created from the company panel** (`apps/company/js/overview.js:206`, «ساختِ رستورانِ جدید»). Still open: who makes the calls (item 2), and whether we help with menu entry (step 8).
5. ~~Founding offer and price lock~~ **Decided 09-17:** no founding offer. A sold subscription keeps its price until its term ends, and new prices may change (`PRICING.md` decisions 10–11).
6. ~~Discretionary free accounts~~ **Decided 09-17: the company decides who gets one.** They are never offered in a pitch.

**CEO** (code questions; I read, I don't edit)
1. ~~Guest-data export?~~ **Answered 2026-09-17:** none exists (positive control: `content-disposition` found in `media/[...key]/route.ts`), none for launch, PII design first (P3 backlog). Pitch wording changed accordingly (§1, §2).
2. ~~P1-4 on the trial form?~~ **Answered:** not built yet (`rezv-85`). With team-created accounts it applies at the owner's first login (step 6). The CEO sends the final flow.
3. ~~SMS?~~ **Answered:** the owner's blocker S-07. Step 5 is marked BLOCKED.
4. ~~Channel in `Reservation.source`?~~ **Answered:** out of scope for launch, no migration. Diner channels are measured with a coupon code per channel instead (`restaurant/coupons`, `coupon_redemptions`), and **that coupon path must be verified at runtime first**, since it is REAL-STATIC only (`docs/marketing/diners/PLAYBOOK.md`).

---

**Line for the CEO:** «Marketer `rezv-c6` → `docs/marketing/restaurants/PLAYBOOK.md` v1: فروشِ حضوری در یک
محله روی گوشی؛ «پولی که می‌ماند» نه رشد؛ کنارِ اسنپ‌فود و POS نه به‌جایش؛ شرایط خودشان پیچ‌اند (بدونِ
کمیسیون، قیمتِ منتشرشده، هیچ تمدیدِ خودکار — همه REAL-STATIC؛ «بدونِ انحصار» منتظرِ تأییدِ مالک)؛ قیفِ ۱۰
مرحله‌ای از روی کد با شمارنده‌ی هر مرحله؛ ده رستوران در چهار دسته + اسپرینتِ ده‌هفته‌ای. چهار سؤالِ کد
برای تو: export داده‌ی مهمان، اثرِ P1-4 روی فرمِ trial، اثباتِ پیامک، و `Reservation.source`.»
