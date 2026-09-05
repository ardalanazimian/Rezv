# Foodism — Competitor Profile
_Last updated: 2026-09-05 by Scout_

> **Methodology note (read first):** `WebFetch` was tested this pass against a neutral control
> domain (`example.com`) and a real target domain (`cafebazaar.ir`) before any other work began.
> Both returned `EGRESS_BLOCKED` — consistent with every prior batch (`profiles/fidilio.md`,
> `profiles/smartx.md`, `profiles/opentable-resy-sevenrooms.md`). I did not re-test every
> individual URL below one by one after that (would have wasted budget re-confirming a
> session-wide block), but I have no reason to think any specific domain was treated
> differently. As a result, **everything below comes from the `WebSearch` tool's own synthesis**
> of what it read at these URLs, not from a direct fetch/read by me. Treat every "quote" as
> search-engine-mediated unless stated otherwise, and treat every figure (user counts, venue
> counts, review counts/ratings) as "repeated consistently across queries" rather than
> "independently confirmed verbatim from the raw page." I flag this again at each specific claim
> where it matters most.

## Identity check — is this the right "Foodism"?

The task brief was right to flag this: **"Foodism" is a heavily overloaded, generic-sounding
name**, and search turned up at least four distinct, unrelated products/brands sharing it before
I could confirm the right one — a materially worse collision problem than Fidilio (no collisions
found) and comparable to SmartX (six false matches).

**Confirmed target:** `foodism.app` / Android package `app.foodism.tech` — "فودیسم" (Foodism), a
Persian-language restaurant/cafe discovery-and-review social network, consistently
cross-referenced across:
- Its own site (`foodism.app`) and magazine/blog (`mag.foodism.app`, parallel to Fidilio's
  `mag.fidilio.com` pattern)
- Cafe Bazaar (`cafebazaar.ir/app/app.foodism.tech`) and Myket
  (`myket.ir/app/app.foodism.tech`) — both live Android listings for the same package name
- Instagram `@foodism.iran` and Facebook `Foodism.iran`
- Independent-ish Persian app-intro blogs (`webna.ir/35889/foodism-app-intro`,
  `appetan.ir/review/application/...فودیسم`, `appreview.ir/...`, `charkhoneh.com/content/930727370`)
  — all describing the same product: an 8,000–9,000-venue Iranian restaurant/cafe/bakery/juice
  directory with user reviews, ratings, and a social "follow/like" layer.

This is a strong, multi-source, cross-store convergence — I'm confident this is the real,
Iranian, restaurant-discovery Foodism the brief intends.

**Naming collisions ruled out** (found while searching, explicitly not profiled):

1. **Foodism (UK)** — `foodism.co.uk`. London's largest free food-and-drink magazine (ABC-verified
   circulation 108,950, bi-monthly print + web + newsletter), Instagram `@foodism` at ~72K
   followers. Completely different product (print/media, not an app), different country,
   different industry model. **Ruled out.**
2. **Foodism.xyz / Foodism Connect (India)** — `food.foodism.xyz`, `connect.foodism.xyz`,
   `foodismconnect.com`. A recipe-sharing/home-chef networking platform ("Foodism Loyalty Coins,"
   5,000+ recipes) plus a separate food-industry job/networking app, both India-focused,
   Instagram `@foodism.xyz` at ~49K followers. The Google Play **developer account** listing
   ("Android Apps by Foodism") surfaced both of these India apps together — I could not resolve
   whether that developer account is also linked in any way to Iran's `app.foodism.tech` (different
   package-name domain: `.xyz` vs `.tech`), but every content signal (language, city list, currency,
   India-specific branding) points to this being an unrelated company. **Ruled out**, with the
   developer-account adjacency flagged as an unresolved loose end — see "What I did NOT verify."
3. **"Local Foodism App"** (`apps.apple.com/us/app/local-foodism/id1598976914`) — surfaced once in
   search, not deep-dived; naming and US App Store region both point away from Iran. **Ruled out**
   on name/region grounds only, not independently confirmed unrelated.
4. **Foodium** (`com.foodium.ab`, "Private Reviews") — a different name entirely (Foodium, not
   Foodism) that Google Play's search adjacency surfaced alongside Foodism queries. **Ruled out**
   trivially by name.

Given the consistent cross-referencing of `foodism.app`, `app.foodism.tech` (identical package
name on both Cafe Bazaar and Myket), `@foodism.iran`, and multiple independent Persian app-intro
articles all describing the same Iranian restaurant/cafe-discovery product, I'm treating
`app.foodism.tech` as the correct subject and did not profile any of the collisions above.

## What it is

Foodism (فودیسم) markets itself — per its own Play Store listing and site, as rendered through
WebSearch — as **"the largest social network for restaurant-going and food ordering across
Iran"** (بزرگترین شبکه اجتماعی رستوران‌گردی و سفارش غذا در ایران): a directory-plus-review app
covering restaurants, cafes, fast food, bakeries, juice/ice-cream shops, protein shops, and food
courts. Venue-count claims vary by source between **8,000+** (webna.ir, appetan.ir,
charkhoneh.com) and **9,000+** (an earlier, differently-worded search synthesis) — I'm flagging
this as an internal inconsistency rather than picking one, the same way `profiles/fidilio.md`
flagged Fidilio's 4.9-star marketing claim against its 3.7 Cafe Bazaar reality. Coverage is
claimed across ~29 Iranian cities/provinces (Tehran, Karaj, Kish, Mashhad, Shiraz, Isfahan, Ahvaz,
Tabriz, Urmia, Zanjan, Qazvin, Ardabil, Sarein, Kashan, Qom, Yazd, Arak, Qeshm, Bushehr, Bojnord,
Bandar Abbas, Yasuj, Shahrekord, Kermanshah, Abadan, Kerman, Hamadan, Gorgan, plus Lorestan/
Kurdistan/Gilan(Rasht)/Mazandaran).

**A load-bearing nuance the app's own subtitle obscures:** despite "و سفارش غذا" ("...and food
ordering") in its name, WebSearch's own synthesis states plainly that **Foodism does not offer
in-app online ordering or in-app payment** — you discover/review a place, then order "به صورت
حضوری یا تلفنی" (in person or by phone, via a call button in the app). This is a materially
different product shape than SnappFood/Tapsi Food (true delivery marketplaces with in-app
checkout) or even than Fidilio's 2024 pivot into real in-app ordering — Foodism reads as a
Yelp-for-Iran discovery/review layer that borrows delivery-adjacent language in its own branding.
I could not independently open the app to confirm this myself (WebFetch blocked), so I'm reporting
it as WebSearch's synthesis of the product description, not a hands-on-verified fact — but it was
consistent and specific enough (a direct statement that ordering is phone/in-person, not
"online with payment") that I'm not filing it as a pure guess either.

I found **no table-reservation feature** ("رزرو میز") anywhere for Foodism — unlike Fidilio, which
at least has CLAIMED reservation copy on its own marketing site, targeted searches for
"فودیسم رزرو میز رستوران" returned zero Foodism-specific results, only unrelated competitor
products (Sepidz, Baran Systems, Mupra). I'm marking this **ABSENT — not found**, not merely
UNKNOWN, given how directly the search was aimed at it.

**History:** thin and single-sourced. One blog post (dated 1402/2023 in its own byline) states the
app/site were launched by "آراد," described only as the person who had been running the
`@foodism.iran` Instagram page and decided to turn it into a full app/website, "roughly three
years" before that article — implying a launch around **1399 (2020/2021)**. I found no surname,
no company-registration name, no funding history, and no independent (non-Foodism-adjacent)
profile of this founder anywhere. **UNKNOWN — not verified** beyond this one thin source.

**Award claim (CLAIMED, not independently confirmed):** Foodism's own Play Store description and
a cluster of near-identical "best food-ordering app in Iran" listicle articles (rajanews.com,
namehnews.com, ilna.ir) all state, in nearly verbatim phrasing, that Foodism was chosen **"بهترین
اپلیکیشن سفارش غذا ایران"** at the Iran Web & Mobile Festival (IWMF) in **1399 (2020/2021)**. The
same claim, in nearly the same words, appearing simultaneously across otherwise-unrelated outlets
(one of them, ILNA, a real labor-news wire) is the exact pattern `profiles/smartx.md` flagged as a
likely syndicated/paid placement (رپورتاژ) rather than independent editorial verification — I
found no mention of Foodism on `iwmf.ir` itself or in genuine Zoomit/Digiato editorial coverage
(site-restricted searches on both domains returned nothing Foodism-related). **CLAIMED**, treat
with the same skepticism SmartX's "media hit" got.

## Who it's for

- **Consumers (diners)**, primarily — the entire visible product surface (discovery feed,
  reviews/ratings, follow/like/photo-upload, a per-city "شکموهای حرفه‌ای" — "professional foodies"
  — leaderboard of the most-active local reviewers) is diner-facing. Basic browsing works without
  an account; a phone-number + SMS-OTP sign-up is required to rate, favorite, follow, or upload
  photos (per appreview.ir's description, via WebSearch synthesis).
- **Restaurant/cafe/business owners**, as the paying side: basic directory listing is free
  ("ثبت‌نام در اپلیکیشن‌های رستوران‌یاب رایگان است" — registration is free), with paid
  "advertising packages" (پکیج‌های تبلیغاتی) offered for more visibility — contact-only, no public
  price list found (see below).

I found **no restaurant-owner-side complaint or commentary** (fees, onboarding friction, ad-package
value) despite targeted searches — same gap `profiles/fidilio.md` reported for Fidilio's
restaurant side. Absence of evidence, not evidence of absence.

## Business model & pricing

- **Consumer side:** free to browse and use. No in-app payment exists at all (no ordering, no
  reservation, no checkout — see "What it is"), so there is no diner-facing fee or pricing
  structure of any kind to evaluate — this is a structural fact, not a gap in my research.
- **Restaurant side:** free basic listing; paid advertising packages "با بازدهی خوب" ("with good
  returns," per the sourced content) are the implied revenue model, contactable via phone/
  Instagram/website. **No published price figures were found anywhere** despite multiple targeted
  searches — CLAIMED that packages exist and are effective, exact terms **UNKNOWN — not
  verified**. This mirrors Fidilio's undisclosed commission rate and SmartX's several
  "contact us"-gated tiers.
- **Scale claims are internally inconsistent across sources:** "70,000+" registered members
  (site+app combined, per one 1399/2020-dated syndicated article) vs. "100,000+ users" (per a
  separate search synthesis, no date attached) vs. "500,000+ monthly website visits" (same source
  as the 100,000 figure). I'm flagging this discrepancy rather than reconciling it — same
  discipline as the Fidilio 4.9-vs-3.7 rating flag.
- **No discount/coupon-code presence found on Mopon** (Iran's coupon aggregator, which does list
  Fidilio and SnappFood codes) despite a direct search — a genuine, if soft, negative finding:
  either Foodism doesn't run discount codes the way Fidilio does, or my search simply missed it.
- **No funding/investment history found anywhere.** Combined with the single-founder,
  Instagram-page-turned-app origin story above, this reads consistent with a small, likely
  bootstrapped operation rather than a VC-backed one — but this is an inference from absence, not
  a confirmed fact. **UNKNOWN — not verified.**

## Feature inventory

| Feature | Status (REAL/CLAIMED/ABSENT/UNKNOWN) | Evidence |
|---|---|---|
| Restaurant/cafe/bakery discovery directory & search | REAL | Live, cross-confirmed Cafe Bazaar + Myket listings, own site, multiple independent app-intro blogs, all describing the same 8,000–9,000-venue product. |
| User reviews/ratings per venue | REAL | Consistently described across `appreview.ir`, `webna.ir`, `charkhoneh.com`, `appetan.ir` — a live Myket rating of 4/5 across 216 reviews corroborates the feature is genuinely in use, not just described. |
| Social layer: follow other users, "like," per-city "professional foodies" leaderboard | CLAIMED | Sourced only from third-party app-intro blog descriptions (`appreview.ir`, `charkhoneh.com`); not independently tested by me, mechanism (server-verified vs. client-side) unconfirmed. |
| Photo upload per venue | CLAIMED | Same third-party sources as above. |
| Phone-number + SMS-OTP sign-up gate for full features (browsing itself is free) | REAL | Independently and consistently described (`appreview.ir`) as: browse without account, but rate/follow/favorite/upload requires phone+OTP signup. |
| In-app online food ordering with in-app payment | **ABSENT** | WebSearch's own synthesis states plainly that ordering happens by phone call or in person, not online/in-app, despite "سفارش غذا" in the app's own name — see "What it is" for full discussion of this discrepancy. |
| Online table reservation ("رزرو میز") | **ABSENT — not found** | Targeted search returned zero Foodism-specific results; unlike Fidilio (which at least has CLAIMED reservation marketing copy), I found nothing here at all. |
| Restaurant-side advertising packages (paid visibility) | CLAIMED | Described in generic terms ("packages with good returns"), no price list, no feature breakdown found. |
| Restaurant CRM / loyalty-club feature for restaurant owners | UNKNOWN — not found | Targeted search for "فودیسم باشگاه مشتریان" surfaced only unrelated competitor content (SmartX, Sepidz, Hami POS), nothing Foodism-specific. |
| Native diner-facing points/tier loyalty program | **ABSENT — not found** | Targeted search found no Foodism-native points/tier system; the only "discount" mechanic found is generic, restaurant-run offers surfaced inside the app, not a Foodism ledger/points system. |
| Android app (Cafe Bazaar + Myket) | REAL | Live listings on both stores under identical package name `app.foodism.tech`; Myket shows 216 reviews at 4/5 stars. |
| iOS app | UNKNOWN — not verified | No Iran-region Apple App Store listing found in any search; could not confirm existence or absence with confidence. |
| Iran Web & Mobile Festival "best food app" award (1399/2020–21) | CLAIMED | See "What it is" — sourced only from Foodism's own Play Store copy and syndicated listicles with near-identical phrasing across otherwise-unrelated outlets; not found on `iwmf.ir` or in independent Zoomit/Digiato coverage. |
| Independent Persian tech-press coverage (Zoomit/Digiato editorial, not listicle/syndication) | ABSENT — none found | Site-restricted searches on both domains returned nothing Foodism-specific; the only "coverage" found reads as syndicated best-of listicle content, not editorial reporting. |
| Data breach / security-incident history | UNKNOWN — none found | Searched specifically (mirroring the SnappFood/Fidilio precedent in this repo's own research); found nothing either way. Could mean it hasn't happened, hasn't been reported, or the product is too small to be a disclosed target. |

## Review synthesis

**Honesty check up front, same as the Fidilio and SmartX profiles:** I could not surface a single
verbatim-quoted individual user review (positive or negative) for Foodism anywhere, despite
multiple differently-worded Persian searches targeting complaint language ("افتضاح," "باگ,"
"کند," "هک," "شکایت," "اطلاعات اشتباه"). Every one of those searches returned either generic,
off-topic content or nothing Foodism-specific at all. I am **not** fabricating quotes or counts to
fill a "top 5 complaints / top 5 praises" template — per the task's own rule, that structure stays
honestly under-filled below.

### What I could verify (the full list, not a curated "top 5")

- **Myket:** 216 reviews, aggregate rating **4/5 stars** (via WebSearch synthesis of the Myket
  listing page, accessed 2026-09-05). This is the single most concrete quantitative data point in
  this profile.
- **Cafe Bazaar:** the listing (`cafebazaar.ir/app/app.foodism.tech`) is confirmed to exist and to
  be live, but I could not surface its specific rating or review count in any search — **UNKNOWN**,
  despite several attempts.
- **Third-party "review" blogs** (`webna.ir`, `appetan.ir`, `appreview.ir`, `charkhoneh.com`) all
  read as descriptive app-intro/marketing-adjacent content rather than independent critique — none
  of them contain a negative observation, a bug report, or anything reading like arm's-length
  journalism. `appetan.ir`'s piece is the most visually specific: it describes a white-background,
  red-accent UI across four tabs (Discover / Discounts / Content / Profile) and praises image
  quality — useful as a design-language data point, but sourced from what reads like promotional
  content, not a user review.

### Top complaints
UNKNOWN — not verified. No independent review, forum post, or social-media complaint was found
anywhere after genuine, repeated, differently-worded searching. This is a materially thinner
result than even Fidilio's (which surfaced two real complaint snippets) — I'm reporting that
honestly rather than padding it.

### Top praises
UNKNOWN — not verified, beyond the Myket 4/5-over-216-reviews aggregate above, which is a real
number but not an attributable quote. No individual five-star review text was found.

## Gen-Z lens scorecard

Reusing the same 7 questions defined in `profiles/opentable-resy-sevenrooms.md`'s methodology
note (not inventing a new framework), applied to Foodism specifically:

1. **Zero-friction entry** — REAL/partial: browsing the directory and reading reviews works
   without an account, per the independently-consistent app-intro descriptions; only rating,
   following, favoriting, or uploading photos requires phone+OTP sign-up. That's a genuinely
   low-friction discovery layer, though I could not test it hands-on to confirm actual load
   time/first-session smoothness.
2. **Money respect** — N/A in the strict sense: there is no diner-facing payment flow of any kind
   to evaluate (no ordering, no reservation, no fee) — a structural non-issue rather than a
   demonstrated strength. On the restaurant-owner side (the actual paying customer), pricing is
   opaque ("contact us for advertising packages"), same pattern flagged as a weakness in both
   Fidilio and SmartX.
3. **Does it feel like now** — UNKNOWN — not verified. No screenshots, demo video, or hands-on
   session were reachable this pass (WebFetch blocked); `appetan.ir`'s description of a clean
   white/red four-tab UI is the only design-language signal found, and it is marketing-adjacent
   content, not an independent design review.
4. **Shareability** — the **strongest, most distinctive finding in this profile.** Follow/like
   mechanics, per-venue photo uploads, and an explicit per-city "professional foodies" leaderboard
   are a genuinely more social, Instagram/Yelp-shaped design than either Fidilio or SmartX show —
   this is CLAIMED (third-party descriptive sources, not independently tested), but it's a real
   structural design choice, not just marketing copy, and it's the one place Foodism looks
   meaningfully more "Gen-Z-shaped" than the other two Iranian profiles in this batch.
5. **Trust** — UNKNOWN, genuinely — unlike Fidilio (a real, multi-outlet-reported data-sharing
   controversy) or SmartX (a self-admitted reliability incident), I found **zero** dated trust
   signal of any kind for Foodism, positive or negative. That absence could mean "nothing bad has
   happened," "nothing bad has been reported because the product is too small to attract
   scrutiny," or "my search simply missed it" — I cannot distinguish between these from here.
6. **Notification behavior** — UNKNOWN — not verified. No review or article discussed
   push-notification frequency, SMS marketing volume, or opt-in/opt-out mechanics.
7. **What to steal / what to never copy** —
   - *Steal:* the explicit social/reputation layer (follow, like, per-city top-reviewer
     leaderboard) as a distinct design primitive from a pure ratings/directory feature — it gives
     users a reason to keep contributing beyond a one-off review, which none of Fidilio's or
     SmartX's documented feature sets clearly offer.
   - *Never copy:* marketing a product's name/subtitle ("...و سفارش غذا" / "...and food ordering")
     around a capability (in-app ordering with payment) that, per what I could find, doesn't
     actually exist yet — a mismatch between what the app-store listing promises and what the
     product delivers is exactly the kind of "successful-sounding but not actually shipped" gap
     this repo's own verification rules (`CLAUDE.md`'s "no fake success" rule) are built to
     prevent internally.

## Where it beats Rezervno today
UNKNOWN — not verified (out of scope for this research pass; requires repo-side verification by
the CEO).

## Where Rezervno beats it
UNKNOWN — not verified (out of scope for this research pass; requires repo-side verification by
the CEO).

## Sources
All accessed 2026-09-05, via the `WebSearch` tool's synthesis only — `WebFetch` was confirmed
blocked against both a control domain (`example.com`) and a live target domain (`cafebazaar.ir`)
at the start of this pass; every URL below is a page WebSearch cited as its source, not one I
opened and read directly myself.

- https://foodism.app/ — main site
- https://mag.foodism.app/ — magazine/blog (articles: "چگونه رستوران خود را تبلیغ کنیم؟...",
  "تاریخچه مک دونالد در ایران و جهان...")
- https://cafebazaar.ir/app/app.foodism.tech (and `?l=en`) — Android listing, Cafe Bazaar
- https://myket.ir/app/app.foodism.tech — Android listing, Myket (216 reviews, 4/5 stars)
- https://play.google.com/store/apps/details?id=app.foodism.tech — Google Play listing
- https://www.instagram.com/foodism.iran/ — official Instagram (existence only; follower count
  not obtainable this pass)
- https://www.facebook.com/Foodism.iran/ — official Facebook page
- https://webna.ir/35889/foodism-app-intro — app-intro article
- https://appetan.ir/review/application/... (فودیسم) — app-intro/review article (UI description)
- https://appreview.ir/فودیسم-شبکه-اجتماعی-شکموهای-ایران — app-intro article (sign-up flow,
  social features)
- https://www.charkhoneh.com/content/930727370 — app-intro article
- https://tahlilgar.com/business/Food-Beverage-Services/Foodism-فودیسم — B2B company-profile
  aggregator listing (no founding/employee detail extractable)
- https://www.rajanews.com/news/349348/... , https://www.namehnews.com/.../620738-...,
  https://www.ilna.ir/.../1101176-... — near-identical "best food-ordering app in Iran"
  listicles naming Foodism's IWMF 1399 award claim (flagged as likely syndicated content, see
  "What it is")
- https://iwmf.ir/ — Iran Web & Mobile Festival's own site (searched for independent
  confirmation of the award claim; none found)

**Naming-collision sources** (profiled and ruled out, see "Identity check"):
- https://foodism.co.uk/ , https://www.facebook.com/FoodismUK/ , https://uk.linkedin.com/company/foodism-uk
  — Foodism UK, London food & drink magazine
- https://food.foodism.xyz/ , https://foodismconnect.com/ ,
  https://play.google.com/store/apps/details?id=food.foodism.xyz ,
  https://play.google.com/store/apps/details?id=connect.foodism.xyz ,
  https://www.instagram.com/foodism.xyz/ — Foodism.xyz / Foodism Connect, India
- https://apps.apple.com/us/app/local-foodism/id1598976914 — "Local Foodism App" (US App Store,
  not deep-dived)

## What I did NOT verify

1. **No page was opened directly this session.** `WebFetch` was confirmed blocked at the start of
   this pass (control domain + a live target both returned `EGRESS_BLOCKED`); everything above is
   WebSearch's own synthesis, not a first-hand read. Treat every figure and paraphrase accordingly.
2. **Cafe Bazaar's specific rating/review count** for Foodism — the listing's existence is
   confirmed, its numbers are not.
3. **iOS app existence** — no Iran-region Apple App Store listing found in any search; I cannot
   say with confidence it doesn't exist, only that I didn't find one.
4. **Exact advertising-package pricing** for restaurant owners — confirmed to exist as a concept,
   no figures found anywhere.
5. **The founder's full identity** ("آراد," no surname found) and any company-registration name,
   legal entity, employee count, or office location — none found.
6. **Whether the Google Play "Foodism" developer account** that surfaces both `food.foodism.xyz`
   and `connect.foodism.xyz` (India) has any actual corporate relationship to `app.foodism.tech`
   (Iran) — almost certainly not, given the completely different market/content/domain, but not
   independently disproven either.
7. **The IWMF 1399 "best food app" award claim** — sourced only to Foodism's own marketing copy
   and syndicated listicles with near-identical phrasing; not found on `iwmf.ir` itself or in
   independent Zoomit/Digiato editorial coverage. Treat as CLAIMED, not REAL.
8. **Restaurant-owner-side complaints** (ad-package value, onboarding friction, payment terms) —
   none found after multiple targeted searches. Absence of evidence, not evidence of absence.
9. **Any individual, verbatim, dated user review** (Cafe Bazaar or Myket) — despite several
   differently-worded attempts in Persian targeting both complaint and praise language, none
   surfaced. Only the Myket aggregate (4/5, 216 reviews) was obtainable.
10. **Whether the "no in-app ordering" finding is still current** — WebSearch's synthesis stated
    this plainly and consistently, but I have no way to confirm the app hasn't shipped in-app
    ordering very recently (this is exactly the kind of claim a hands-on app session with working
    `WebFetch`/store access would resolve quickly, and should be re-checked before quoting
    externally).
11. **Funding/investment history** — none found; treated as likely-bootstrapped by inference from
    absence, not confirmed.
12. **Notification behavior, redemption mechanics, and actual first-session UX speed** — no
    evidence found either way; would require hands-on app testing, outside what this session's
    tooling allowed.
