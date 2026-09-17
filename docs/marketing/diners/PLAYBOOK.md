# DINERS — how the first guests arrive, and what we may and may not say to them

**Date:** 2026-09-17 · **Session:** `rezv-c6 [897f2f]` (Marketer) · **Target:** the CEO `rezv-87 [09dbab]` ·
**Status:** v1 draft, **submitted — not closed** · **Base:** `main = cf60b9c`.

**What it needs:**
- **CEO:** rulings on the two code findings in §5, and on coupon redemption (§6).
- **Owner:** nothing new. The diner side waits on decisions already open (`E-001`, S-07).

**Charter:** Workstream 4 (`docs/audit/prompts/marketer.md`): channels that reach Gen-Z in Iran, the
launch mechanic, a four-week content calendar **described, not written**, and email/SMS rules.

**Built on:** `BUSINESS-PLAN.md` §4.2, `BRAND.md`, `restaurants/PLAYBOOK.md`, `PRICING.md` §3.

---

## 0. The recommendation first

1. **At launch, diners arrive through restaurants, not around them.** The restaurant's own table,
   receipt and Instagram are the channel. We have no budget line, no attribution and no proven
   reason for a diner to come to us first.
2. **No paid acquisition and no marketing SMS at launch.** Paid ads wait on approved positioning.
   Marketing SMS waits on two code findings (§5): consent is opt-out today, and there are no quiet
   hours or caps.
3. **The mechanic we can honestly offer is small, so say it small:**
   - booking is free for the diner;
   - no phone call needed;
   - a waitlist on your phone;
   - you earn points and cashback (earning only).

   No referral, no coupons, no point spending, no gift cards (§2).
4. **Measure diners per restaurant, not per channel.** Per-channel attribution doesn't exist and
   won't for launch (§6).

---

## 1. Channels that reach Gen-Z in Iran — what is known and what is not

| Channel | What we know | Class | Use at launch |
|---|---|---|---|
| **At the venue** (table tent, QR on the bill, the host saying it) | The diner is already at the restaurant, and it costs nothing but print | Reasoning, not measured | **Yes, first.** Printed QR codes need a domain that resolves (directive 036). **The owner says the domain was bought (2026-09-17); resolution not checked** |
| **The restaurant's own Instagram** | Iranian restaurants already take bookings by DM (`restaurants/PLAYBOOK.md` §5 criteria) | Described | **Yes**, a booking link in the bio or a story, posted by the restaurant with its consent |
| **Our own Instagram** | Instagram is filtered in Iran and used through VPNs | SECONDARY (widely reported, not fetched in this programme) | **Yes, small:** real screens, no giveaways (`BRAND.md` §5) |
| **Telegram** | Also filtered and reached through VPNs | SECONDARY | A channel for restaurant partners at most. Not a diner growth bet |
| **Persian X / Twitter** | Reach among Gen-Z diners `UNKNOWN` | `UNKNOWN` | No |
| **Domestic messengers** (Bale, Eitaa, Rubika) | Gen-Z reach `UNKNOWN`, no data found | `UNKNOWN` | No, until there is data |
| **App stores** (Bazaar, Myket) | Where Iranian Android users install apps. Competitors' footprints are measured (`research/APP-STORE-FOOTPRINT-2026-09-16.md`) | REAL for competitors | **A listing, only if the customer app ships as an installable app.** Today it is a PWA. That is a launch decision, not a marketing one |
| **Campus and neighbourhood presence** | Offline | — | After the first district has ten live restaurants |
| **Global ad platforms** (Google, Meta) | Not planned around. Buying ads there from Iran runs into sanctions and payment barriers (`fundraising/PAYMENT-PATHS.md`) | Requires counsel | **No** |

---

## 2. The launch mechanic — what a first diner gets, at its real strength

| What the diner gets | Class | Evidence / gate |
|---|---|---|
| Booking is free, and nothing is charged | REAL-STATIC | No diner fee (`BUSINESS-MODEL.md` §1 R7). Deposits are off by the owner's decision |
| Book without calling, and see your booking | REAL-STATIC | `apps/customer/js/data/booking.js:494` → `POST /reservations` |
| Join a waitlist from the phone | REAL-STATIC | `waitlist_enabled` on (`api/src/lib/feature-flags.ts:14-22`) |
| **Earn** points and cashback at the restaurant | **PARTIAL**, earning only | FP-008 turns spending off. Copy must say «کسب» and never imply spending (the CEO's M-12 rule) |
| "Nothing is taken from you unless you were told first" | **INTERNAL ONLY** | Until the CI guard pins it (`POSITIONING.md` §1). **Not usable in any post** |
| A booking reminder | **BLOCKED** | Real SMS delivery is unproven (S-07) |

**Not a mechanic, and why:**

| Tempting | Why not |
|---|---|
| "Invite a friend, get points" | `completeReferral` has zero production callers, and the promise was already removed once (`POSITIONING.md` §3) |
| A discount code for new diners | No UI sends a coupon code, so no diner can redeem one (`PRICING.md` §3, M-20). The fix is ruled for before launch. Even then, a code is the restaurant's discount, not ours, and it stays out of our copy until the live proof exists |
| Spend your points / reward marketplace | Point spending is off (FP-008). `reward_marketplace_enabled` and `missions_claim_enabled` are on, but whether they work end to end with spending off is **for the CEO to rule** before any copy mentions them |
| Gift cards | `gift_card_purchase_enabled` is off |

**The honest read:** the mechanic is thin. At launch, the reason a diner uses ⟨NAME⟩ is that *their
restaurant asked them to*. Word of mouth is a hypothesis to measure (§6), not a plan to count on.

---

## 3. The at-venue kit — described, not designed

Everything here waits on a domain that **resolves**, and on the Designer's visual identity decision
(`BRAND.md` §3). The owner says the domain was bought on 2026-09-17, but resolution has not been
checked and the name isn't recorded here. The identity option is still the owner's.

| Piece | Content (described) | Rules |
|---|---|---|
| **Table tent** | «دفعه‌ی بعد بدونِ تماس رزرو کن» · QR · the restaurant's name first, ⟨NAME⟩ second | No promises beyond §2. No discount |
| **Receipt QR line** | One line and the QR | The same line as the tent |
| **Host script** (one sentence) | «اگه خواستید دفعه‌ی بعد از این‌جا رزرو کنید، بدونِ زنگ.» | Said only if the restaurant wants it |
| **Instagram story template for the restaurant** | A screenshot of *its own* booking page and the link | The restaurant posts it, not us. Only with its consent |

---

## 4. The first four weeks of content — described, not written

Per the charter, no post is written until positioning copy is approved. Each week has one job and
one outcome.

| Week | Theme | Format | Outcome it should move | Gate |
|---|---|---|---|---|
| 1 | **How booking works:** three real screens | Carousel | Diners who complete a first booking at a partner restaurant | Real screenshots of a REAL-STATIC flow. No render |
| 2 | **The waitlist on your phone** | Short screen recording | Waitlist joins at partner cafés | Only if the café uses the waitlist (restaurant playbook §5) |
| 3 | **The partner restaurants:** who is on ⟨NAME⟩ in the district | One post per restaurant, **with its written consent** | Bookings at the featured restaurant, before/after | No ranking and no "best". Facts only |
| 4 | **What we don't do:** no fee to book, no card needed | Text post in the «روراست» voice | Hypothesis: trust. Measured as first bookings | Nothing from §2's INTERNAL ONLY row |

**Never in any week:** giveaways, "only today", follower-count goals, reposts of reviews we didn't
verify, or anything naming a competitor.

---

## 5. SMS and email — the rules, and two code findings that block marketing messages

The charter's rule: **opt-in only, frequency-capped, quiet hours respected — "the same rules the
product enforces in code".** Measured on `cf60b9c`, the code enforces a different rule:

| Rule in the charter | What the code does | Evidence |
|---|---|---|
| **Opt-in only** | **Opt-out by default, marketing included.** `allowsCategory` returns true unless the user explicitly set `false`: «فقط `false`ِ صریح مانع می‌شود». The marketing categories are `offers` and `dna` | `api/src/lib/notification-prefs.ts` (`allowsCategory`, `MARKETING_CATEGORIES`) |
| **Frequency-capped** | **No cap found** | `git grep -iE "quiet_?hours\|quietHours\|frequency_?cap\|maxPerDay\|max_per_day"` over `api/src/lib` and the schema. The only hit is `maxPerDay` in `api/src/lib/fraud.ts:90`, the redemption-velocity detector, which doubles as the positive control |
| **Quiet hours** | **None found** | Same search |

The opt-out default was a deliberate choice for **transactional** messages: the file explains that
treating silence as opt-out would stop booking reminders for every existing user. That reasoning is
sound for reminders. Nothing in it argues for marketing, and the charter says opt-in.

**So, for the diner side:**
1. **Zero marketing SMS at launch** (`offers`, `dna`) until the CEO rules on consent.
2. **Transactional only:** booking confirmation, cancellation and waitlist receipts
   (`UNGATED_SMS_TEMPLATES`). Reminders are blocked on S-07.
3. **Restaurant-sent campaigns** (the panel's automations, `api/src/lib/automation.ts`) go to the
   restaurant's own guests. They inherit the same opt-out default, so the restaurant pitch does not
   sell SMS campaigns either (`PRICING.md` §3 already gates «پیامکِ خودکار»).
4. **Counsel:** Iranian rules for advertising SMS (sender lines, consent, the opt-out keyword) are not
   researched here. *Requires review by counsel before any marketing SMS is sent.* This is in the
   owner's queue (CEO, D-25), and it is part of gate A4.

**Email:** no diner email programme exists or is proposed.

---

## 6. Measurement — per restaurant, because per channel is not possible at launch

**Why there is no per-channel attribution:**
- `Reservation.source` carries only `'app'` (the default) and `'walkin'`
  (`api/src/lib/reservations.ts:991`). The CEO ruled a channel value out of scope for launch.
- The CEO's alternative, a coupon code per channel, **cannot work today:** no UI sends
  `coupon_code` on a booking, so no redemption can happen (`PRICING.md` §3). The CEO recorded this
  as **M-20**. **CEO ruling 2026-09-17:** the code field comes to the booking flow **before launch
  (P2, `rezv-1b` after F001)**. It needs a live end-to-end proof (REAL-STATIC → REAL) and a Red Team
  attack on concurrent redemption of one coupon before merge. **Until it lands:** the weak before/after
  measure below, labelled weak. **After launch:** a separate coupon per channel replaces it. Note
  that a coupon's value must be > 0 unless it is a free item
  (`api/src/app/api/v1/restaurant/coupons/route.ts:41`). So channel attribution by coupon is a
  discount the restaurant funds, and the restaurant chooses it knowingly, never as our generosity.

**What can be measured honestly from existing rows:**

| Outcome (charter: no vanity metrics) | Definition | Source |
|---|---|---|
| **Diners who completed a booking** | Distinct `userId` with a reservation in `completed` or `checked_in` | `Reservation.status` (`ReservationStatus`) |
| **Diners who booked twice** | Distinct `userId` with ≥2 such reservations | Same |
| **No-show rate, per restaurant** | `no_show` ÷ bookings, counted only where staff mark it | Same |
| **Effect of a channel action** | Bookings at that restaurant in the 14 days after an action (a tent placed, a story posted) against the 14 days before. **Weak:** there is no control and demand is seasonal. Labelled as such wherever it is reported | Reservation rows, plus a hand log of dates |

**Not measured:** followers, impressions, reach.

---

## 7. What this needs

**CEO (rulings; I don't edit code)**
1. ~~Marketing consent?~~ **Ruled 2026-09-17 (D-25):** `offers` and `dna` become **opt-in**, so a
   missing value means "no". Reminders and transactional messages are untouched. Builder: `rezv-1b` (P2).
2. ~~Quiet hours and a cap?~~ **Ruled (D-25):** the launch state is **no marketing SMS**, locked
   server-side, not only in copy. A default-off flag blocks enqueueing marketing campaigns and
   automations, so a restaurant cannot SMS everyone once real delivery is switched on. It turns on
   only past gate A4: opt-in, quiet hours, a frequency cap, a 500-recipient cap and legal review.
   Builder: `rezv-1b`.
3. ~~Coupon redemption in the booking flow?~~ **Ruled 2026-09-17:** before launch (P2, `rezv-1b`
   after F001), with a live end-to-end proof and a Red Team attack on concurrent redemption. M-20.
   Per-channel coupons come after launch.
4. ~~Reward marketplace and missions?~~ **Ruled (D-25):** `UNKNOWN`. End-to-end measurement goes to
   `rezv-75` (P3). **Diner copy does not mention them until measured.**

**Owner (no new decisions, only the existing ones this depends on):** `E-001` (the at-venue kit), and
the visual identity option (`BRAND.md` §3).

---

**Line for the CEO:** «Marketer `rezv-c6` → `docs/marketing/diners/PLAYBOOK.md` v1: دینرها در لانچ از طریقِ خودِ
رستوران می‌آیند (میز، فاکتور، اینستاگرامِ رستوران)؛ بدونِ تبلیغِ پولی و بدونِ پیامکِ تبلیغاتی؛ مکانیکِ
صادقانه کوچک است (رزروِ رایگان، بی‌تماس، لیستِ انتظار، فقط کسبِ امتیاز). دو یافته‌ی کد: رضایتِ پیامکِ
تبلیغاتی opt-out است نه opt-in (`notification-prefs.ts` → `allowsCategory`) و هیچ quiet hours/سقفِ
تعداد نیست (کنترلِ مثبت: `maxPerDay` در fraud.ts). سنجش فقط به‌ازای رستوران؛ کوپنِ کانال بدونِ مسیرِ
redemption کار نمی‌کند. چهار حکم از تو.»
