# Global Recon Notes — Scratch File

_Raw material for later deep profiles. NOT a polished doc. Written 2026-09-04. Every platform below
was touched lightly — pricing page + whatever App Store/Trustpilot/Reddit content `WebSearch`
could surface. `WebFetch` was blocked for every external domain tested this session (Trustpilot,
App Store, Google Play, Capterra, G2, SoftwareAdvice, HotelTechReport, Reddit, even Wikipedia and a
neutral control domain) — see the methodology note in `profiles/opentable-resy-sevenrooms.md` for
the full explanation. Everything below therefore rests on `WebSearch`'s own synthesis of those
pages, not an independent re-fetch. Anything not reached at all is marked UNKNOWN — not fabricated._

---

## Reservation / guest platforms (lighter recon)

### TheFork (formerly LaFourchette)
- What it is: European reservation + dining-deals marketplace, strong in France and 11 European
  countries; ~50,000 restaurants, ~20M active diners claimed (TripAdvisor-era figures).
- Ownership churn: TripAdvisor acquired it in May 2014 (~$140M); TripAdvisor agreed to **divest it
  to American Express for $700M** in June 2026, deal expected to close by end of 2026 — i.e.
  TheFork is about to become an Amex property alongside Resy and Tock.
  ([Yahoo Finance](https://finance.yahoo.com/markets/stocks/articles/tripadvisor-divest-restaurant-booking-platform-150615103.html); [restaurantonline.co.uk](https://www.restaurantonline.co.uk/Article/2026/06/16/amex-buys-restaurant-reservations-platform-thefork/))
- Pricing: commission model, roughly €2–4/cover (TheFork Manager product line). Has its own diner
  loyalty program, "YUMS," for repeat bookings.
- Complaint pattern (paraphrase, from Trustpilot search synthesis, not independently re-read):
  reservations silently cancelled without notice; restaurant-side no-shows disputed unfairly
  against diners; slow customer-service follow-through; at least one report of TheFork having "no
  actual connection" confirmed with the restaurant despite a confirmation email being sent.
- UNKNOWN: exact review counts/star rating; exact commission %; integration plan with
  Resy/Tock post-acquisition (three Amex-owned reservation brands would then coexist).

### Eat App
- What it is: global reservation/table-management SaaS explicitly positioned against per-cover fee
  models (flat pricing, "the guest you seat on a Saturday night costs exactly the same as the one
  you seat on a slow Tuesday"). Claims Ritz-Carlton and Four Seasons as clients (CLAIMED, marketing).
- Pricing: free tier up to 100 covers/month; paid tiers roughly $99–$389/mo depending on source, no
  per-cover charges. ~5,000+ restaurants worldwide (claimed).
- UNKNOWN: independent review-site rating/count not captured; no complaint quotes gathered.

### Servme
- What it is: Dubai-based (founded 2017) guest-experience/CRM + reservation platform for MENA
  hospitality; 3,000+ venues claimed across the region.
- Pricing: starts at $129/mo, flat, no commission/cover fees; free onboarding/setup/migration
  claimed, no setup costs.
- UNKNOWN: no review/complaint data reached this pass.
- **Flag for later:** closest MENA-regional comparable to Rezervno's own market context found in
  this whole recon — worth a genuinely deep pass (not light-touch) next time, specifically on how
  it prices and markets to Gulf-region independents vs. how Rezervno should in Iran.

### TableCheck
- What it is: Japan-headquartered, #1 market share reservation platform in Japan; 8,000–10,000+
  clients across 25–35 countries; 18-language support (broadest language coverage found in this
  recon); claims 1B+ diners seated cumulatively.
- Monetization: no diner booking fees by default, but sells "FastPass" — a fee-based priority
  booking service (launched Feb 2024) — plus standard B2B subscription revenue.
- 2026: "Dine with Visa in Japan 2026" campaign with Visa, targeting inbound tourists.
- UNKNOWN: subscription price tiers; no negative-review data gathered.

### Chope
- What it is: Singapore-founded (2011) reservation + dining-deals marketplace; largest consumer
  reservation marketplace in Southeast Asia (~13,000 listed eateries across Singapore, Thailand,
  Indonesia, plus reach into Hong Kong/Jakarta/Bali/Bangkok/Phuket). Now inside Grab's super-app
  ecosystem. Free for diners; earns rewards for diners on the platform (unspecified mechanic).
- Pricing: commission-based per booking; exact % UNKNOWN.
- UNKNOWN: Trustpilot review volume looked very low in one search result ("only 1 person has
  reviewed Chope" per that snippet) — **unconfirmed**, could reflect low awareness of Trustpilot in
  that market rather than actual low usage. No verified complaint quotes gathered.

### Catchtable
- What it is: Korea's #1 dining-discovery/reservation app; 3.5M Korean users + 1M+ international
  users claimed; 2,000+ verified restaurants including Michelin-starred Seoul/Busan venues.
- Pricing model is structurally distinct from every other platform in this recon: the app itself is
  free, but diners pay a **restaurant-set deposit at time of booking** (accepts foreign Visa/MC/Amex
  for international users) — a deposit-based no-show deterrent, not a post-visit no-show fee the
  way OpenTable/Resy work.
- UNKNOWN: B2B/restaurant-side pricing; review/complaint data.

### Quandoo
- **Headline finding: Quandoo is shutting down.** Wind-down announced March 24, 2026 following a
  "strategic portfolio review"; stopped accepting/managing new bookings September 30, 2026; full
  shutdown December 31, 2026. All restaurant services were made free during the wind-down period.
  ([search synthesis of multiple 2026 alternative-migration blog posts](https://reserve.skiper.io/en/quandoo-alternative-restaurant-booking))
- Historical pricing/model: commission-based, ~£3.90/cover (i.e. 100 covers/month ≈ £390/month) —
  a pure per-cover marketplace model, same family as OpenTable's.
- **Why this matters for Rezervno:** this is a live 2026 case study of a commission-per-cover
  reservation marketplace failing in a market that had shifted toward flat-fee competitors (Eat
  App, Zenchef, Servme all explicitly market "no per-cover fee" positioning against
  Quandoo/OpenTable-style pricing) — a cautionary data point, not proof of causation, but worth
  citing if Rezervno ever debates a pure per-cover commission model.

### Zenchef
- What it is: Paris-based, commission-free European reservation + guest-CRM platform; strong in
  France/Benelux; 7,000+ customers across 15 countries.
- Pricing (France, 2026, monthly billing): Reserve €129/mo, Manage €169/mo, Grow €249/mo (annual
  billing: €1,548 / €2,028 / €2,988 respectively). À la carte add-ons: Website, Marketing Suite, and
  Multi-Venue each €29/mo; Automatic SMS €49/mo; AI Call €99/mo; Meta Reserve €19/mo.
- **Source discrepancy flagged:** a separate, non-France-specific source cited Zenchef pricing as
  €69–119/mo for "Europe" broadly — inconsistent with the France figures above. Possibly reflects
  regional/promotional pricing differences, or a stale figure. UNKNOWN which is current outside
  France.
- UNKNOWN: review/complaint data not gathered this pass.

### Tabit
- What it is: Israel-founded (2014) **mobile-first restaurant operating system** (POS + kitchen
  management + guest management + online ordering) — closer to a Toast-style full-stack restaurant
  OS than to a reservation/discovery marketplace like OpenTable/Resy. Claims 45%+ market share in
  Israel; expanding into Miami/US.
- Pricing: not public, quote-based.
- Claimed (marketing, **CLAIMED not independently verified**) operational impact: 8–15% increase in
  spend per customer, up to 20% staff reduction, up to 80% fewer order mistakes, 10–15 minutes
  faster table turnaround.
- UNKNOWN: reviews/complaints not gathered.

### Toast Tables
- What it is: a reservation/waitlist **module bundled into the broader Toast POS ecosystem**, not
  sold standalone — for restaurants already on Toast POS. Reservation data (visit notes, occasion
  flags like birthdays/anniversaries) integrates directly into the Toast POS screen; tables seated
  via Toast Tables are color-coded purple on the POS.
- Pricing: not found as a separate published line item this pass — bundled within Toast's overall
  (famously complex, hardware+software+processing-fee) pricing structure. One source mentioned a
  25-reservation/month allowance on some tier, but this wasn't independently confirmed.
- **Why this matters for Rezervno:** represents a fourth reservation business-model archetype
  (POS-native bundling) distinct from marketplace-commission (OpenTable/Quandoo/TheFork/Chope),
  flat-SaaS (Resy/SevenRooms/Eat App/Zenchef/Servme), and deposit-based (Catchtable) — worth naming
  explicitly if Rezervno ever maps its own reservation+POS bundling strategy against competitors.
- UNKNOWN: standalone Tables pricing; review/complaint data.

### Yelp Guest Manager
- What it is: Yelp's unified front-of-house suite (reservations + waitlist + kiosk + takeout +
  table management), relaunched under this name in 2026, folding together previously separate Yelp
  Waitlist/Reservations products. Structural advantage worth noting: Yelp already owns diner
  discovery *traffic* pre-reservation, unlike OpenTable/Resy which compete for that traffic from
  zero.
- Pricing: starts at $99/mo, **no free tier**; one source characterized this as "68% higher than
  similar services" (comparison basis unclear — treat as a possibly-biased claim, not a verified
  benchmark). Promo found: 12-month purchase gets up to 6 months free plus up to $300/mo of ad
  budget for up to 6 months.
- UNKNOWN: review/complaint data; actual market share versus the other platforms in this list.

---

## Loyalty benchmarks — B2B platforms (what they sell, and to whom)

### Punchh (a PAR Technology brand)
- What it sells: enterprise loyalty/offers/engagement platform — points, personalized offers,
  campaign management — now owned by PAR Technology (itself a POS company, so this is a
  POS-vendor-owned loyalty stack, the same shape as Toast bundling reservations).
- Who buys it: large restaurant/grocery/retail/convenience chains. Named clients: Yum! Brands,
  TGI Friday's, Casey's General Stores. Claims 280+ global enterprises across 20 countries and
  powering loyalty for 30%+ of top restaurant brands (**CLAIMED**, PAR's own marketing — not
  independently verified).
- Product line: "Punchh Loyalty" (core points/offers/campaigns) + "Punchh Wallet" (loyalty-linked
  digital wallet/payments product).
- Notable: rolled out "Advanced Authentication" (one-time codes/magic links) in July 2025 — a named
  security feature whose existence implies a fraud/account-takeover concern serious enough to
  warrant it (inference; not confirmed as reactive to a specific incident).
- Pricing: not public. UNKNOWN.
- UNKNOWN: independent review/complaint data not gathered.

### Thanx
- What it sells: restaurant CRM + loyalty built around **card-linked loyalty** — purchases are
  tracked automatically via tokenized credit-card linking, with no app-scan or check-in required at
  the point of sale.
- Who buys it: mid-sized multi-location restaurant brands and emerging chains — explicitly
  positioned as the lighter-weight alternative to enterprise players (Punchh, Paytronix).
- Mechanic worth flagging for Rezervno: Thanx's stated philosophy is to avoid "blanket discounts"
  and instead reward guests with "access, exclusivity, and personalized perks" specifically to
  protect restaurant margins — i.e. loyalty-as-status rather than loyalty-as-markdown. Directly
  relevant to how Rezervno should think about its own reward currency.
- Pricing: custom-quoted, no public pricing, multi-year contracts typical, separate fees reported
  for technical support and customer success.
- UNKNOWN: independent review/complaint data not gathered.

### Paytronix
- What it sells: 20+ year incumbent guest-engagement platform — loyalty + online ordering + CRM +
  AI-driven marketing — for restaurants and convenience stores.
- Who buys it: claims 1,800+ brands across 50,000+ locations globally; 30+ native POS integrations
  (Aloha, Brink, Oracle Simphony, etc.), 450+ total integrations.
- Mechanic: supports points/visit/tiered loyalty structures combined with stored-value/gift-card
  reload in a single wallet. Claims AI-personalized messaging lifts effectiveness "400 to 500%"
  (**CLAIMED, Paytronix's own marketing stat — treat with real skepticism, no independent
  verification found anywhere in this pass**).
- Pricing: custom-quoted by location count/module/contract term; "several hundred to several
  thousand dollars per month" for growing multi-unit brands (wide, non-specific range).
- UNKNOWN: independent review/complaint data not gathered.

### Como (ComoSense)
- What it sells: white-label customer-engagement/loyalty platform — branded mobile app + POS
  integration — for multi-location service chains. **Not restaurant-exclusive**: also sells into
  retail, health & beauty, entertainment, and fitness verticals, making it more horizontal than
  Punchh/Thanx/Paytronix's restaurant-first focus.
- Who buys it: named clients found include Burger King, Conway, Quiznos, Fox Racing — spanning
  multiple verticals as noted above.
- Pricing: starts at ~$59/mo — the lowest published entry price of the four B2B loyalty platforms
  in this recon. No free tier, but a free trial is offered.
- UNKNOWN: review/complaint data; G2/Capterra rating not captured (searches returned only listing
  pages, no readable content this pass).

---

## Loyalty benchmarks — Starbucks Rewards & Chipotle Rewards (deeper, per task priority)

These two got materially more research time than the B2B platforms above, per the task's explicit
instruction to focus on streak/tier/mission/expiry mechanics and what users say when they break.

### Starbucks Rewards
- **Relaunch:** March 10, 2026, into a three-tier system — **Green** (base), **Gold** (500 Stars in
  a rolling 12-month window), **Reserve** (2,500 Stars in a rolling 12-month window).
- **Earn multipliers by tier:** Green 1x Star/$1, Gold 1.2x, Reserve 1.7x — replacing the old flat
  system where anyone could hit 2x by paying with a pre-loaded Starbucks Card.
- **Double Star Days:** Gold gets at least 4/year, Reserve at least 6/year, described as
  "personalized" to each member's habits — but require an explicit in-app **activation** step to
  count, an opt-in friction point flagged directly by sourcing ("most offers will not apply unless
  you activate them in the Starbucks app").
- **Star expiry — the key tier-asymmetry finding:** Green-tier Stars expire **6 months** after being
  earned (oldest-first, silently removed at midnight on the expiry date), extendable only by taking
  a qualifying action a month before expiry. **Gold and Reserve Stars do not expire** while status
  is held. This is the clearest example found in this whole recon of an expiry penalty applied
  *only* to the base/casual tier — structurally the group least likely to notice and most likely to
  just churn rather than complain.
- **New at relaunch:** a 60-Star redemption tier ($2 off any purchase); "Free Mod Monday" for all
  members regardless of tier.
- **Missions/gamification:** personalized "Bonus Star" challenges (buy item X / visit Y times in a
  window); "Starbucks for Life" is the flagship gamified promotion (in-app challenges + grand-prize
  entries); bring-a-reusable-cup earns 2x Stars; card-reload bonuses (10 bonus Stars at $30 reload,
  25 at $50).
- **Breakage / what users said (the core ask):**
  - After a **2023** rewards revamp (a separate, earlier repricing), the number of Stars required
    for rewards rose sharply; one commenter said accumulated Stars "had lost 25 percent of their
    value" — a devaluation complaint with the same emotional shape as a tier reset, even without a
    literal reset.
  - **2026 relaunch backlash:** longtime members reported the new tiered structure "feels like a
    devaluation, especially for customers who previously maximized 2 Stars per dollar through app
    reloads" — because the old flat system let anyone reach 2x via reload, while the new system
    gates the top 1.7x multiplier behind a 2,500-Star/year Reserve threshold most casual members
    can't reach. A verbatim Reddit-sourced quote (via secondary reporting): *"Customers just want
    to earn a free drink every once in a while. It's not that complicated. They don't want early
    access to stupid games and online experiences."*
  - **App reliability:** a partial outage on September 18, 2025 looped users into an endless in-app
    survey before they could place an order; a quoted X/Twitter post read: *"Hey Starbucks your app
    is stuck in a never ending survey loop."*
  - Sources: [about.starbucks.com press release, 2026](https://about.starbucks.com/press/2026/reimagined-starbucks-rewards-loyalty-program-launches-with-new-member-benefits/); [Fast Company](https://www.fastcompany.com/91506011/starbucks-rewards-changes-start-today-app-new-tiers-system-explained); [Newsweek](https://www.newsweek.com/starbucks-revamps-rewards-program-2026-11659352); [The Takeout](https://www.thetakeout.com/2121799/starbucks-new-rewards-program-customer-hate/); [Inc.com](https://www.inc.com/jason-aten/starbucks-botched-the-rollout-of-its-rewards-program-and-made-everyone-mad/91315130); [Axios, 2026-01-29](https://www.axios.com/2026/01/29/starbucks-rewards-program-changes-2026).
- **Lessons flagged for Rezervno's own tier/streak design:**
  1. Never let a rate/multiplier "upgrade" for one segment read as a "downgrade" for the segment
     that was previously maximizing the old system — over-communicate any earn-rate repricing in
     advance, not just as a footnote in a bigger relaunch announcement.
  2. Never apply expiry asymmetrically by tier without explaining why — it reads as punishing the
     casual/lower-spend user, who is exactly the population most likely to quietly churn.
  3. An opt-in "activation" step layered on top of an already-personalized bonus (Double Star Days)
     is a silent breakage vector: users who don't activate get nothing and may never learn why.

### Chipotle Rewards
- **Relaunch:** April 13, 2026, branded "Rewards on Repeat." Earn rate: 10 points per $1 spent
  (in-restaurant, in-app, or on chipotle.com).
- **OLD expiry policy (pre-relaunch):** points expired after **180 days of account inactivity**
  (use-it-or-lose-it tied to account activity, not per-point aging). This was contentious enough to
  reach **federal litigation**: in **December 2025**, a federal court ruled Chipotle Rewards points
  are not "gift cards" or "gift certificates" under California or New York law, so the 180-day
  expiry policy was legally upheld — plaintiffs had tried to use anti-gift-card-expiry consumer
  protection statutes and lost. This is the single strongest "point-expiry-trap" evidentiary anchor
  found in this entire recon, precisely because it was serious enough to be litigated, not just
  grumbled about on social media.
  ([ConsumerAffairs, 2025-12-29](https://www.consumeraffairs.com/news/chipotle-can-legally-expire-your-rewards-points-heres-what-that-means-for-you-122925.html))
- **NEW policy (post-relaunch, April 2026):** points now remain active as long as the member makes
  **at least one qualifying purchase per year** — loosened from 180 days to a full year, a direct
  response to the expiry-trap complaint pattern above.
- **A second, separate expiry clock:** rewards already **redeemed** into a member's account expire
  **60 days** from the date of issue unless the specific reward states otherwise — layered on top
  of the points-expiry clock. A third, even shorter clock exists on the selectable birthday reward
  (chips/guac/queso/drink), which carries a **30-day** redemption window.
- **Missions/streaks/gamification — "Chipotle IQ" relaunched August 11, 2026:** "Daily Streaks"
  reward 2–3 consecutive days of play with bonus points and exclusive badges; "Side Quests" are
  one-off challenges (e.g., try a specific menu item) layered on top; a "Summer of Extras" seasonal
  promo (June–August) added monthly streak challenges with free entrées, bonus points, and badges; a
  collectible-card-game mechanic was also introduced in the August 2026 relaunch, with Chipotle's
  own PR claiming over $1M in free food given away through that promotion.
  ([Chipotle Newsroom, 2026-08-11](https://newsroom.chipotle.com/2026-08-11-CHIPOTLE-IQ-RETURNS-WITH-MORE-THAN-1-MILLION-IN-FREE-CHIPOTLE,-PLUS-NEW-DAILY-STREAKS,-SILVER-TICKETS-AND-A-COLLECTIBLE-CARD-GAME))
- **Breakage / what users said (the core ask):**
  - App bug in version **v11.18.1** (released on or around **July 8, 2026**): rewards would show as
    applied to the cart in the app but fail to redeem at checkout. A verbatim 1-star review quoted
    by a secondary source: *"The app showed my queso reward and even applied it to my cart, but it
    wouldn't redeem at checkout."* That same secondary source reported the app's average rating
    dropped from **2.89 to 2.03 stars** following the update, and characterized the underlying
    redemption-failure pattern as recurring since 2024, not new. **I could not independently
    re-fetch this source (mwm.ai) to confirm those exact before/after numbers — treat the specific
    2.89→2.03 figures as reported-but-unverified**, while the general "redemption fails at
    checkout" complaint pattern is corroborated by the app-store-review framing in multiple search
    results.
- **Lessons flagged for Rezervno's own reward design:**
  1. A **redemption-time** failure (reward shows as applied, then fails at checkout) is arguably
     worse than an accrual-side bug, because the user has already mentally "spent" the reward and
     experiences the failure publicly, in a checkout line, rather than as a quiet balance
     discrepancy discovered later. Redemption-path reliability deserves disproportionate testing
     attention relative to accrual-path reliability.
  2. Stacking multiple, differently-timed expiry clocks (points expire on 180-day/annual inactivity,
     redeemed rewards expire in 60 days, a birthday reward expires in 30 days) multiplies the number
     of ways a user can lose value with no clearly "bad" action on their part. Count how many
     distinct expiry clocks any Rezervno mechanic has; more than one should be treated as a design
     smell to justify, not a default.
  3. When an expiry policy is genuinely loosened (Chipotle's 180-days → annual-purchase change), the
     correct comms move is to lead with it as a headline relaunch benefit ("Rewards on Repeat...
     more value without trade-offs") — contrast with Starbucks, which bundled a real improvement
     (no expiry at Gold/Reserve) inside a change that *also* felt like a cut to the previously-
     maximizing segment, and got read as bad-faith specifically because those two things were
     bundled together without being distinguished for the user.

---

## What I did NOT verify (applies to this whole file)
- No platform above had its raw App Store/Google Play/Trustpilot review page independently
  re-fetched by me — `WebFetch` was blocked for every external domain tested this session. All
  quotes and stats came through `WebSearch`'s own retrieval/summarization.
- No Reddit thread (r/restaurateur, r/KitchenConfidential, or any city subreddit) was reached
  directly — both `www.reddit.com` and `old.reddit.com` returned "Claude Code is unable to fetch."
  Any Reddit-attributed quote above came via a secondary article that itself quoted Reddit.
- Servme, Eat App, TableCheck, Chope, Catchtable, Tabit, Toast Tables, and Yelp Guest Manager all
  have **zero** independently-sourced complaint quotes in this pass — pricing-page and
  company-description facts only. A follow-up pass should specifically go hunting for App
  Store/Trustpilot text on these before writing a deep profile.
- Punchh, Thanx, Paytronix, and Como likewise have zero independent review/complaint data — this
  was intentional given the task's "lighter touch" instruction for these four, but flagging it
  explicitly so a later pass doesn't mistake the absence of complaints for evidence of a clean
  reputation.
- The Zenchef France-vs-Europe pricing discrepancy (€129–249 vs €69–119) is unresolved.
- The exact MWM.ai Chipotle app-rating-drop numbers (2.89→2.03) are reported-but-unverified.
