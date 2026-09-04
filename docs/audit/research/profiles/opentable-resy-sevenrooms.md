# OpenTable / Resy / SevenRooms — Competitor Profiles

_First-pass recon, not full profiles. Written 2026-09-04. Evidence-or-UNKNOWN discipline applied
throughout — see methodology note and "What I did NOT verify" at the end of each section._

## Methodology note (read this before trusting any quote below)

This pass ran entirely on the `WebSearch` tool. `WebFetch` was tested against **every** class of
source needed for this task — Trustpilot, the Apple App Store, Google Play (via aggregator pages),
Capterra, G2, SoftwareAdvice, HotelTechReport, justuseapp, Reddit (both `www.reddit.com` and
`old.reddit.com`), Wikipedia, and even a neutral control domain (`example.com`) — and every single
one returned `EGRESS_BLOCKED` or "Claude Code is unable to fetch," confirming this is a blanket
environment restriction for this session, not a per-site judgment call. Reddit specifically returns
a different error ("unable to fetch") than the rest, suggesting it's blocked at a different layer.

Practical consequence: every verbatim-looking quote in this document was surfaced by `WebSearch`'s
own server-side retrieval/summarization of the source page, inside quotation marks in its output —
I did not independently re-fetch the page and read the quote in context myself. I have only used
text that came back inside quotation marks as "quotes"; everything else is marked as paraphrase.
Treat quotes here as **sourced-but-not-independently-recheckable in this pass**, and re-verify with
working page-fetch access before using any single quote in an external-facing deck.

The "Gen-Z lens — 7 questions" framework used below is **not** an existing Rezervno document — none
was found anywhere in this repo (`grep`ed for "Gen-Z lens", "7 questions", "هفت سوال" — no hits
outside one unrelated mention in `docs/architecture-audit/BENCHMARK_ANALYSIS.md`). I defined a
reasonable 7-question set for this pass and applied it consistently; a later pass should reconcile
it with whatever canonical framework Rezervno intends, if one exists elsewhere.

**The 7 questions (as used in this document):**
1. Zero-friction entry — can a first-time user act (book, browse) without an account/app/call?
2. Mobile-native & fast — does the app feel modern and reliable (store ratings, glitch reports)?
3. Transparent, surprise-free pricing — are fees (no-show, deposit, service charge) clear upfront?
4. Social currency / shareability — is there a built-in "flex" or shareable moment?
5. Personalization that feels earned, not creepy — does data use visibly benefit the user?
6. Fast, fair rewards loop — do points/status pay off quickly and predictably, without breakage?
7. What happens when it breaks — is there real, human recourse when something glitches?

---

## OpenTable — Competitor Profile

### What it is / who it's for / business model & pricing (sourced)

Founded 1998 in San Francisco; acquired by Priceline Group (now Booking Holdings) for $2.6B in
2014 and still operates under Booking Holdings. Covers more than 60,000 restaurants worldwide,
positioned as the largest/broadest reservation marketplace globally, with a stronger footprint in
tourist-friendly and mainstream dining than in the ultra-curated tier Resy targets.
([Restaurant Business Online, 2026](https://www.restaurantbusinessonline.com/technology/opentable-will-require-restaurants-make-it-their-primary-reservations-system))

**Restaurant-side pricing (2026, current):** three subscription tiers — Basic $149/mo, Core
$299/mo, Pro $499/mo — plus per-cover fees on top: $1.50/cover (Basic, network bookings), $1/cover
(Core/Pro, network bookings), and $0.25/cover for bookings made via the restaurant's own website
regardless of plan. In early 2026 OpenTable added a 2% service fee applied to transactions
including no-show penalties, deposits, and prepaid Experiences. A worked example: at 1,000 network
covers/month, Basic costs roughly $19,800/year and Core roughly $15,800/year.
([restaurant.eatapp.co, 2026](https://restaurant.eatapp.co/blog/opentable-pricing);
[restaurantbookingsystem.com, 2026](https://restaurantbookingsystem.com/compare/opentable-pricing/);
[TableLink, 2026](https://tablelink.app/blog/opentable-fees-explained))

**Discrepancy flagged, not resolved:** a separate search pass surfaced an apparently older/legacy
pricing structure — Basic at $29/month + a flat $49 fee + $0.25/reservation + $1.50/network cover —
that conflicts with the $149/mo figure above. Both came back from 2026-dated aggregator pages, so
this may reflect a stale cached price on one aggregator, a legacy plan name being conflated with the
current one, or a genuinely different SKU. **UNKNOWN which is authoritative today** — verify
directly against `opentable.com/restaurant-solutions/plans/basic/` before quoting a number
externally.

**2026 contract change — "system of record":** On April 16, 2026 OpenTable updated its client
agreements to require partner restaurants to designate OpenTable as the primary system of record
for reservations, table, and guest management (front- and back-of-house), and to make all inventory
available on the OpenTable marketplace. OpenTable states this won't block multi-platform use, but
restaurants using multiple platforms would have to manually re-enter reservations made elsewhere to
avoid double-booking. This drew a formal complaint to Washington State's antitrust division.
([Restaurant Dive, 2026](https://www.restaurantdive.com/news/open-table-client-agreement-updates-primary-table-mangement/815706/);
[Washington State Standard, 2026-04-15](https://washingtonstatestandard.com/2026/04/15/opentables-new-rules-have-a-seattle-business-leader-calling-foul/))

**Diner-facing loyalty:** OpenTable relaunched its diner loyalty program as "OpenTable Regulars" in
October 2025 — free to all users, 100 points per completed direct-booked reservation (up to 1,000
for select reservations), redeemable for check credit or (in US/CA/UK/AU/DE) Amazon gift cards.
"Gold" status unlocks at 6 reservations in 12 months and lasts a year; Gold members get earlier
notify-me access to last-minute openings and (in select markets) 6 months of Uber One free as a
launch perk. ([OpenTable/PR Newswire, 2025](https://www.prnewswire.com/news-releases/opentable-unveils-revamped-loyalty-program--opentable-regulars--featuring-new-savings-and-better-benefits-for-diners-302594012.html);
[Restaurant Dive](https://www.restaurantdive.com/news/Opentable-revamps-loyalty-program-reservations/803845/))

**Experiences:** ticketed, non-table-tied events available on all three plans (Ticketed Experiences
restricted to Core/Pro); OpenTable cites experiential dining up 46% YoY. On August 26, 2026 OpenTable
announced its largest-ever feature release — 20+ new/enhanced product features.
([PR Newswire, 2026-08-26](https://www.prnewswire.com/news-releases/opentable-launches-its-largest-suite-of-new-and-updated-product-features-for-restaurants-302860569.html))

### Feature inventory (REAL / CLAIMED / UNKNOWN)

| Feature | Status | Note |
|---|---|---|
| Reservation marketplace, 60k+ restaurants | REAL | Multiple independent sources agree on scale |
| Tiered subscription + per-cover pricing | REAL | Consistent across 2026 pricing breakdowns |
| 2% universal service fee (2026) | REAL | Reported rollout, not independently confirmed on a live invoice |
| "System of record" exclusivity clause | REAL (contract change) | OpenTable's claim it "won't affect" multi-platform use is CLAIMED and disputed |
| OpenTable Regulars (diner loyalty, Gold tier) | REAL | Launched Oct 2025, press-confirmed |
| Ticketed Experiences | REAL | Live feature; "46% YoY growth" stat is OpenTable's own (CLAIMED) |
| Anti-bot / anti-scalper tooling | UNKNOWN | Not found in this pass — most bot-fighting coverage centers on Resy, not OpenTable |
| App reliability at scale (busy-night use) | MIXED | 4.65/5 on Google Play (~190K ratings) but recurring glitch complaints noted below |

### Review synthesis — top complaints & praises

**Complaints (paraphrased where no quotation marks were returned by search):**
1. **Fee burden on thin margins.** One frequently-cited estimate: OpenTable's combined fees cost
   roughly $10.40 per "incremental" 4-top booked, against a ~5% average US restaurant profit
   margin — i.e., the platform's cut can approach 100% of a table's profit.
   ([search synthesis, uncertain primary source — likely Harvard Business School case-study
   commentary reproduced across multiple secondary sites])
2. **No-show/cancellation fee disputes.** Diners report $25–$50/person no-show or cancellation
   charges with what reviewers describe as a slow, adversarial refund process; multiple complaints
   describe reservations confirmed in-app that the restaurant had no record of.
3. **2026 "system of record" backlash** (see contract section above) — restaurant owners in
   Seattle and Los Angeles quoted expressing concern about exclusivity lock-in; Washington State's
   antitrust division responded in writing: *"We take complaints received from the public very
   seriously, and we will review your letter to determine if OpenTable's new terms of service may
   constitute an anticompetitive practice."*
   ([Washington State Standard / Yahoo Finance, 2026-04-15](https://finance.yahoo.com/economy/policy/articles/opentable-rules-seattle-business-leader-110037258.html))
4. Reservation-list glitches and drag-and-drop failures reported on busy nights by restaurant-side
   users (GuestCenter product).

**Praise (quoted, from App Store review aggregation surfaced by search):**
- *"incredibly reliable, user-friendly"*
- *"it recommends great restaurants and makes reservations so simple and stress-free"*
- *"Using Open Table is the easiest way to reserve a table anywhere"*
- *"OpenTable is consistently reliable and easy to use"*
- *"a must-have app for anyone who enjoys dining out"*
  ([App Store aggregation, via WebSearch synthesis — original page not independently re-fetched])
- Google Play rating: 4.65/5 from ~190,000 ratings (2026).
  ([Google Play listing, via search synthesis](https://play.google.com/store/apps/details?id=com.opentable))

### Gen-Z lens — the 7 questions, evidenced

1. **Zero-friction entry** — Free consumer app/site, no purchase required; standard account
   creation for booking (industry norm, not a differentiator). REAL, unremarkable.
2. **Mobile-native & fast** — 4.65/5 on Google Play at large scale (190K ratings) is a strong
   signal, offset by recurring glitch/reliability complaints on the restaurant-facing side. MIXED.
3. **Transparent pricing (diner side)** — no diner-facing subscription, but no-show/deposit fees
   ($25–$50/person) reported as a source of dispute and "adversarial" refunds. WEAK on this axis.
4. **Social / shareable status** — No evidence found positioning OpenTable itself as a status
   symbol; the "reservation as flex" reporting (Timeout, below) centers Resy/Tock/SevenRooms, not
   OpenTable, which reads as the mass-market/utility choice rather than the curated one. UNKNOWN/weak.
5. **Personalization** — Diners' Choice recommendations and Experiences surfacing exist; depth of
   individual-level personalization not independently verified this pass. CLAIMED/UNKNOWN depth.
6. **Fast, fair rewards loop** — OpenTable Regulars: 100 pts/booking, Gold reachable at just 6
   reservations/year — a genuinely low, fast bar to a real status tier. REAL and comparatively
   generous next to Starbucks/Chipotle's much higher thresholds (see recon-notes-global.md).
7. **What happens when it breaks** — evidence points to a slow, adversarial no-show-fee dispute
   process; no evidence found of a fast/human recourse path. WEAK, low-confidence (paraphrase-level
   evidence only).

### Notes on 2024–2026 consolidation and what it means competitively

OpenTable itself hasn't been part of a new M&A move in this window (under Booking Holdings since
2014) — but it is the incumbent facing consolidation moves from **both** major rivals at once
(Amex folding Tock into Resy; DoorDash buying SevenRooms) while simultaneously tightening its own
contractual grip via the "system of record" clause. Read together, this looks like an incumbent
defending share through **lock-in terms** at the exact moment two challengers are buying scale with
M&A capital. For Rezervno: exclusivity fights are a mature-market, high-restaurant-count dynamic;
Iran's market (still substantially WhatsApp/Instagram-DM/phone-call booking) is nowhere near this
stage, so the near-term opportunity looks more like OpenTable's 2005–2015 job (basic digitization)
than a fee/lock-in war — but the fee-opacity and contract-lock-in complaints above are a live
example of what to design *against* as Rezervno's own commercial terms mature.

### Sources
- https://restaurant.eatapp.co/blog/opentable-pricing
- https://restaurantbookingsystem.com/compare/opentable-pricing/
- https://tablelink.app/blog/opentable-fees-explained
- https://www.restaurantdive.com/news/open-table-client-agreement-updates-primary-table-mangement/815706/
- https://www.restaurantdive.com/news/restaurants-respond-opentable-client-agreement-updates-concerns/817594/
- https://washingtonstatestandard.com/2026/04/15/opentables-new-rules-have-a-seattle-business-leader-calling-foul/
- https://www.restaurantbusinessonline.com/technology/opentable-will-require-restaurants-make-it-their-primary-reservations-system
- https://www.prnewswire.com/news-releases/opentable-unveils-revamped-loyalty-program--opentable-regulars--featuring-new-savings-and-better-benefits-for-diners-302594012.html
- https://www.restaurantdive.com/news/Opentable-revamps-loyalty-program-reservations/803845/
- https://www.prnewswire.com/news-releases/opentable-launches-its-largest-suite-of-new-and-updated-product-features-for-restaurants-302860569.html
- https://play.google.com/store/apps/details?id=com.opentable
- https://apps.apple.com/us/app/opentable/id296581815

### What I did NOT verify
- The $29/mo-vs-$149/mo Basic-plan pricing conflict (above).
- Raw App Store/Google Play review text and star histogram (page-fetch blocked; relied on search
  synthesis only).
- Whether the "$10.40 per incremental 4-top" economics claim traces to a credible primary study or
  has just been copy-pasted across secondary blogs for over a decade (it reads like older material
  resurfacing).
- Any r/restaurateur-specific threads — Reddit was unreachable by direct fetch this pass.

---

## Resy — Competitor Profile

### What it is / who it's for / business model & pricing (sourced)

Founded 2014; acquired by American Express in 2019. Positioned as the curated, chef-driven,
independent-restaurant platform, strongest in dense urban dining scenes (NYC especially), versus
OpenTable's broader/more tourist-friendly network.
([restaurantbookingsystem.com](https://restaurantbookingsystem.com/compare/opentable-vs-resy/))

**Restaurant-side pricing (2026):** Basic $249/mo, Pro $399/mo, Enterprise $899/mo — **no per-cover
fees**, flat regardless of reservation volume. This is Resy's headline pricing differentiator
versus OpenTable, and the reason multiple sources frame Resy as the better economic choice for
restaurants doing high reservation volume (the break-even vs. OpenTable's per-cover model is cited
as roughly 175+ reservations/month). ([GetApp/PricingSaaS/TableLink synthesis, 2026](https://tablelink.app/blog/resy-fees-explained))
Resy is free for diners; restaurants bear the platform cost.

**Feb 24, 2026 — Resy/Tock merger:** American Express (which also owns Tock, acquired from
Squarespace for $400M in 2024) merged Tock into Resy under the Resy brand. More than 25,000 Tock
venues fold into Resy's inventory (roughly doubling it), bringing in Tock's tiered/prepaid
"Experience" ticketing model; Tock's own consumer app/site is being retired while its
restaurant-management back-end continues operating standalone.
([Restaurant Business Online](https://www.restaurantbusinessonline.com/technology/reservation-services-resy-tock-are-merging);
[Upgraded Points](https://upgradedpoints.com/news/resy-merges-with-tock-adds-25k-venues/))

**Amex Global Dining Access:** Platinum cardholders get up to $400/year (up to $100/quarter) in
statement credits at US Resy restaurants; Gold cardholders up to $100/year (up to $50 biannually);
enrollment required. Select Tock venues became Amex-credit-eligible starting Sept 15 (year not
specified in source). "Priority Notify" — early access to newly-freed reservation slots — is an
Amex-card-linked enhancement layered on top of the free "Resy Notify" feature available to all
users. ([The Points Guy](https://thepointsguy.com/credit-cards/american-express-global-dining-collection/))

**Bot/scalping fight:** Resy reports no-show rates 4x higher and late-cancellation rates 2x higher
among bots/brokers versus regular users; in 2023 some restaurants saw 20–25% no-show rates tied to
this activity. Resy backed the Restaurant Reservation Anti-Piracy Act, which passed in NY, FL, IL,
and CA in 2024, making unauthorized third-party reservation resale illegal; Resy reports a 90%
reduction in bot/broker-driven no-shows in New York State as of July 2025 (YoY).
([Restaurant Business Online](https://www.restaurantbusinessonline.com/operations/battling-reservation-black-market);
[Resy blog](https://blog.resy.com/newsroom/resy-and-partners-support-the-restaurant-reservation-anti-piracy-act/))

### Feature inventory (REAL / CLAIMED / UNKNOWN)

| Feature | Status | Note |
|---|---|---|
| Flat, no-per-cover restaurant pricing | REAL | Core differentiator, confirmed across independent pricing sites |
| Resy Notify / Priority Notify | REAL | Feature exists; REAL complaint that it frequently loses to bots (below) |
| Curated/selective restaurant onboarding | REAL | Stated philosophy; differentiates from OpenTable's larger, less-curated network |
| Tock merger → tiered/prepaid Experiences on Resy | REAL (announced) | Feature-parity timeline and full UX integration UNKNOWN |
| Native Resy diner loyalty/points program | **NOT FOUND** | Amex card credits exist but are an Amex product, not a Resy-native points system — a real gap vs. OpenTable Regulars |
| Anti-bot legal advocacy | REAL | Verified via Resy's own blog + independent press (Restaurant Business Online, Fox Business) |
| Instagram "Reserve" button integration | REAL | Confirmed via Resy help docs |

### Review synthesis — top complaints & praises

**Complaints (quoted where marked, paraphrased otherwise):**
1. *"Resy notify never works because automated systems beat me to every cancellation the instant it
   appears"* — recurring complaint theme across multiple reviews surfaced by search.
2. No-show fees reaching **$100/person** at some restaurants; one reviewer called this
   *"absolutely obscene for the consumer."*
3. A documented dispute: a restaurant created a new reservation in a diner's name two minutes
   before a cancellation deadline, without effective notice, resulting in a no-show charge the
   diner contested (paraphrase — exact review text not independently confirmed).
4. Login/password-reset failures — reset codes reported as not being accepted by the app.
5. The scalping/reselling ecosystem Resy is fighting (Appointment Trader and similar sites) is
   itself evidence of demand friction: as of April 2023, one such resale platform alone had
   exchanged $2.4M in reservation value over 12 months — money Resy and the restaurant see none of.
   ([SF Chronicle / NBC News, via search synthesis](https://www.nbcnews.com/news/us-news/reservations-top-new-york-city-restaurants-are-selling-hundreds-dollar-rcna151702))

**Praise:**
- Google Play rating: **4.9/5** from ~15.7K reviews (2026, app last updated Aug 27, 2026) — notably
  higher than OpenTable's Play Store rating, though on a much smaller review base.
- Restaurants and diners consistently cite the curated selection, high-quality photos, and local
  review snippets as a positive discovery experience (paraphrase; marketing-adjacent framing, treat
  as a praise *theme* rather than a hard user quote).

### Gen-Z lens — the 7 questions, evidenced

1. **Zero-friction entry** — Free for diners, but the hardest-to-get reservations are effectively
   gated behind Notify-vs-bots timing or an Amex Priority Notify card benefit — a real two-tier
   friction gap that disadvantages non-Amex, non-bot-savvy younger diners. MIXED, leaning weak.
2. **Mobile-native & fast** — 4.9/5 on Google Play (15.7K ratings) is a strong REAL signal for the
   diner-facing app specifically.
3. **Transparent pricing** — no diner subscription, but no-show fees up to $100/person, called
   "obscene" by at least one reviewer. Real friction point.
4. **Social / shareable status — strongest fit of the three platforms.** Timeout's May 2025 piece
   frames reservation apps broadly as turning "restaurant reservations into a lifestyle flex,"
   explicitly citing curated, hard-to-get inventory (the Resy/Tock model) as the mechanism; Resy's
   Instagram "Reserve" button integration lets restaurants take bookings straight from a
   discovery-native surface, which is a genuinely Gen-Z-aligned distribution channel.
   ([Timeout, 2025-05-14](https://www.timeout.com/usa/news/these-apps-are-turning-restaurant-reservations-into-a-lifestyle-flex-051425))
5. **Personalization** — curation exists at the restaurant-selection level; no evidence found of
   deep individual-diner personalization (e.g., a CRM remembering a regular's usual order/table) in
   the way SevenRooms is built to deliver for the *restaurant's* customers.
6. **Fast, fair rewards loop** — **gap.** No native Resy points program was found. The only
   loyalty-like mechanic (Amex Global Dining Access) requires holding a $325–$895/year premium
   credit card — the opposite of a Gen-Z-accessible, fast rewards loop.
7. **What happens when it breaks** — no-show fee disputes and the reservation-reassignment case
   above suggest uneven recourse for individual diners; Resy is comparatively much more visible and
   proactive about the *systemic* bot/scalping problem (backed real legislation) than about
   individual customer-service breakdowns.

### Notes on 2024–2026 consolidation and what it means competitively

The Resy/Tock merger under Amex (effective Feb 2026) roughly doubles Resy's addressable inventory
to compete at OpenTable's 60k+ scale, while preserving Resy's premium/curated brand and absorbing
Tock's prepaid-ticketed-experience model. This reads as Amex vertically integrating a
**diner-acquisition funnel for its own premium card products** (Platinum/Gold dining credits) — the
reservation platform is becoming a card-loyalty distribution channel, not just a booking utility.
For Rezervno: the open question this raises is whether a loyalty layer can "own" the diner
relationship the way Amex is now explicitly doing — without needing a card product, since Iran's
market doesn't have the equivalent global card rails. A Rezervno-native point/credit system that
keeps the diner relationship inside Rezervno (rather than leaking it to WhatsApp/Instagram DM or a
restaurant's own channel) is the structurally comparable move.

### Sources
- https://tablelink.app/blog/resy-fees-explained
- https://restaurantbookingsystem.com/compare/opentable-vs-resy/
- https://www.restaurantbusinessonline.com/technology/reservation-services-resy-tock-are-merging
- https://upgradedpoints.com/news/resy-merges-with-tock-adds-25k-venues/
- https://www.nrn.com/restaurant-technology/american-express-to-acquire-tock-reservations-platform-and-tech-company-rooam
- https://thepointsguy.com/credit-cards/american-express-global-dining-collection/
- https://www.restaurantbusinessonline.com/operations/battling-reservation-black-market
- https://blog.resy.com/newsroom/resy-and-partners-support-the-restaurant-reservation-anti-piracy-act/
- https://www.foxbusiness.com/lifestyle/restaurateur-says-fighting-our-lives-against-reservation-scalping-trend
- https://www.timeout.com/usa/news/these-apps-are-turning-restaurant-reservations-into-a-lifestyle-flex-051425
- https://www.nbcnews.com/news/us-news/reservations-top-new-york-city-restaurants-are-selling-hundreds-dollar-rcna151702
- https://en.wikipedia.org/wiki/Appointment_Trader (via search synthesis)

### What I did NOT verify
- Resy's exact current restaurant count post-Tock-merger — sources ranged from ~16,000 pre-merger
  to 25,000+Tock's 25,000, i.e. total inventory is a moving target through 2026; get a single
  as-of-date number before quoting externally.
- The exact review text behind the "obscene for the consumer" and "notify never works" quotes —
  surfaced via search synthesis, not independently re-read on Trustpilot/App Store directly.
- Whether Resy has any diner-facing loyalty mechanic beyond Amex card credits that this pass missed.
- App Store (iOS) star rating/count specifically — only Google Play numbers were found this pass.

---

## SevenRooms — Competitor Profile

### What it is / who it's for / business model & pricing (sourced)

Founded 2011 in NYC by Joel Montaniel, Allison Page, and Kinesh Patel. **Structurally different
from OpenTable/Resy**: SevenRooms is a B2B CRM + reservations + waitlist + table management +
marketing automation + review-aggregation platform sold to restaurants, hotels, nightlife, and
entertainment venues — it is **not** a consumer discovery marketplace. There is no standalone
"SevenRooms" app for diners to browse restaurants in; guests book through the restaurant's own
branded website widget or through channel integrations (DoorDash Reservations, Deliveroo
Reservations, Google, Instagram, Yelp). ([SevenRooms](https://sevenrooms.com/platform/reservations-waitlist/);
[Hospitality Tech](https://hospitalitytech.com/sevenrooms-launches-white-label-booking-widget))

Scale: sources range from 15,000–16,000+ venues globally (SevenRooms' own site and The World's 50
Best partner page) to "12,000+ clients" per Crunchbase — treat 13,000–16,000 as the working range.
Named enterprise clients: Marriott International, MGM Resorts International, Mandarin Oriental
Hotel Group, spanning 1,000+ cities.

**Pricing:** not publicly published. Third-party customer-reported estimates (2024–2026) put a
single-venue core plan at roughly $499/mo (~$5,988/yr), with full-suite enterprise deployments at
$600–$1,000+/mo; lower-tier setups reported at $300–$500+/mo. Implementation fees of $5K–$25K are
typical, with annual contracts standard. Like Resy, SevenRooms runs on **flat per-location
subscriptions with zero per-cover fees** — an explicit competitive pitch against OpenTable's
marketplace-commission model. ([PricingNow](https://pricingnow.com/question/seven-rooms-pricing/);
[restauranttools.ai](https://restauranttools.ai/tools/sevenrooms))

**Product depth:** 13 pre-built automated marketing emails triggered by guest behavior/visit
frequency/dining history (welcome series through win-back campaigns); review aggregation combines
automated post-visit survey data with public Google/Facebook/Yelp reviews; CRM auto-tags guests for
segmentation and unifies guest profiles across a multi-venue group.

### Feature inventory (REAL / CLAIMED / UNKNOWN)

| Feature | Status | Note |
|---|---|---|
| Reservation/waitlist/table management | REAL | Core product |
| CRM with cross-venue guest profile + auto-tagging | REAL | Central to SevenRooms' pitch |
| Marketing automation (13 pre-built triggered emails) | REAL | Confirmed via SevenRooms product pages |
| Review aggregation (Google/Facebook/Yelp + surveys) | REAL | Confirmed |
| Free white-label booking widget | REAL | Launched per Hospitality Tech coverage |
| Flat, no-per-cover pricing | REAL | Consistent competitive claim across sources |
| Consumer-facing discovery app/marketplace | **DOES NOT EXIST** | Structural difference from OpenTable/Resy — no diner "network effect" of its own |
| "400-500% lift" style personalization ROI claims | UNKNOWN | Not specifically found for SevenRooms this pass (this stat came from Paytronix, not SevenRooms — do not conflate) |

### Review synthesis — top complaints & praises

**Complaints (from G2/Trustpilot via search synthesis):**
1. *"expensive and could be more flexible for smaller establishments"* (quoted G2 con) — smaller,
   budget-sensitive single venues reportedly find it costly relative to simpler booking tools.
2. Steep learning curve: *"SevenRooms is like an Android for me, complex and harder to learn, less
   intuitive"* (quoted G2 review); full proficiency reportedly takes 1–2 months.
3. Customer-service/contract complaints on Trustpilot: reports of poor post-signup support and
   contract terms described as designed to keep businesses locked in via "unreasonable auto
   renewals" (paraphrase); one review described *"unprofessional staff who [repeatedly harass]
   business owners... even after being repeatedly told 'not interested' and 'do not contact'"*
   (nested quotes as surfaced by search).
4. A single unverified Trustpilot allegation that personal guest data appeared on the dark web and
   that email addresses were shared with other restaurants without consent — **flagging this as a
   single-reviewer claim I could not independently verify**, not an established fact.
5. A small-business owner is reported to have called the platform "pointless" for small operators —
   spammy emails, no meaningful bookings, no ROI (paraphrase, not exact quote per source).

**Praise:**
- G2 overall rating: **4.7/5 across 53 reviews** (2026).
- *"puts all the data in the hands of the business"* (quoted G2 praise) — reflects the core B2B
  value proposition: guest-data ownership versus a third-party marketplace.
- Praised for ease of booking/rebooking/table organization and marketing tools for guest attraction
  (paraphrase).

### Gen-Z lens — the 7 questions, evidenced

_Important framing: SevenRooms is B2B infrastructure. The Gen-Z lens applies one remove — via the
guest experience the **restaurant** delivers using SevenRooms, not a SevenRooms-branded touchpoint._

1. **Zero-friction entry** — arguably the most frictionless of the three: a guest never needs to
   know "SevenRooms" exists, and books through the restaurant's own site/Instagram/Google listing.
   REAL structural fact, and a genuinely different answer than OpenTable/Resy give.
2. **Mobile-native & fast** — N/A as a distinct consumer app (none exists). Timeout's framing of
   the "SevenRooms guest" as someone "mysteriously remembered by name or seated at 'your usual'"
   captures the actual payoff: it's delivered white-label through the restaurant, not through an
   app of SevenRooms' own.
3. **Transparent pricing** — N/A to diners (no diner-facing fee); restaurant-side pricing is
   opaque (no public price list) — a real friction point for the *buyer*, not the diner.
4. **Social / shareable status** — indirect at best; SevenRooms enables the restaurant's own
   Instagram/Google booking buttons but has no consumer-facing brand of its own to "flex."
5. **Personalization — this is SevenRooms' central pitch.** REAL: CRM-driven "recognized as a
   regular" personalization, evidenced by both the Timeout framing and G2's "puts all the data in
   the hands of the business" praise quote.
6. **Fast, fair rewards loop** — N/A at the platform level; SevenRooms is infrastructure, not
   itself a loyalty program. Whether any given diner experiences a "rewards loop" depends entirely
   on what the individual restaurant chooses to build with SevenRooms' CRM/marketing tools.
7. **What happens when it breaks** — for SevenRooms' actual customer (the restaurant operator),
   evidence shows real friction: slow support, contract-lock-in complaints, and one unverified but
   concerning data-privacy allegation (above).

### Notes on 2024–2026 consolidation and what it means competitively

DoorDash's ~$1.2B all-cash acquisition of SevenRooms was announced May 7, 2025 and closed June 13,
2025; SevenRooms' CRM/reservations/marketing stack is being folded into DoorDash's "Commerce
Platform," extending DoorDash's reach to 13,000+ dining/hotel/nightlife/entertainment venues per
DoorDash's own announcement, paired with DoorDash's delivery/marketing distribution.
([DoorDash IR, 2025-05-07](https://ir.doordash.com/news/news-details/2025/DoorDash-Announces-Agreement-to-Acquire-SevenRooms-to-Enhance-Commerce-Platform-Offerings/default.aspx);
[DoorDash completion announcement](https://about.doordash.com/en-us/news/doordash-completes-acquisition-of-sevenrooms))
The open competitive question — already flagged in this repo's `WATCH.md` — is whether SevenRooms
customers get pushed toward a DoorDash delivery/marketing bundle over time, and whether
reservation-only (non-delivery) restaurants start shopping for an alternative that isn't tied to a
delivery marketplace. That's a direct positioning opening for any platform, Rezervno included in
its own market, that can offer CRM/reservations without a delivery-marketplace string attached.

### Sources
- https://sevenrooms.com/platform/reservations-waitlist/
- https://sevenrooms.com/platform/crm/
- https://sevenrooms.com/platform/marketing-automation/
- https://hospitalitytech.com/sevenrooms-launches-white-label-booking-widget
- https://pricingnow.com/question/seven-rooms-pricing/
- https://restauranttools.ai/tools/sevenrooms
- https://www.theworlds50best.com/partners/sevenrooms.html
- https://ir.doordash.com/news/news-details/2025/DoorDash-Announces-Agreement-to-Acquire-SevenRooms-to-Enhance-Commerce-Platform-Offerings/default.aspx
- https://www.restaurantdive.com/news/DoorDash-acquires-sevenrooms-1-billion/747226/
- https://about.doordash.com/en-us/news/doordash-completes-acquisition-of-sevenrooms
- https://www.g2.com/products/sevenrooms/reviews (via search synthesis)
- https://www.timeout.com/usa/news/these-apps-are-turning-restaurant-reservations-into-a-lifestyle-flex-051425

### What I did NOT verify
- Exact current venue count (13,000 vs. 15,000 vs. 16,000 — sources disagree by date/methodology).
- The dark-web/data-sold allegation — single unverified secondary-sourced reviewer claim.
- Capterra's specific star rating/review count for SevenRooms (page-fetch blocked; only G2's 4.7/53
  was captured this pass).
- Whether DoorDash has yet changed SevenRooms' pricing or bundling terms post-acquisition — this
  pass found only the acquisition announcement/close, not post-close commercial changes.
