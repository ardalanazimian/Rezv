# Fidilio — Competitor Profile
_Last updated: 2026-09-04 by Scout_

> **Methodology note (read first):** In this research session the `WebFetch` tool was blocked outright by network egress policy for **every** domain tried — `fidilio.com`, `mag.fidilio.com`, `cafebazaar.ir`, `myket.ir`, `apkpure.net`, `play.google.com`, `instagram.com`, `crunchbase.com`, `zoomit.ir`, `digiato.com`, `tabnak.ir`, `shanbemag.com`, `mopon.ir`, `tracxn.com`, and even `example.com` (all returned `EGRESS_BLOCKED`). I could not open a single source page directly. Everything below comes from the `WebSearch` tool's own synthesis of what it read at those URLs — it appears to genuinely read page content (it returned specific, internally-consistent, dated review text across repeated identical queries), but I have no way to confirm exact verbatim wording or surrounding context myself. I have flagged every claim with how it was obtained, and I refused to pad the review tables with invented quotes to hit a target count. See "What I did NOT verify" for the full list of gaps this caused.

## What it is
Fidilio (فیدیلیو) is one of Iran's oldest online restaurant/cafe discovery platforms, founded in **1387 (2008)** by **Meysam Mashayekhi** — per the founder's own account (quoted via Shanbe Magazine through WebSearch synthesis), it predates the word "startup" entering Iran's business vocabulary by about a year. [WebSearch synthesis of shanbemag.com and digiato.com, accessed 2026-09-04]

For roughly 16 years (2008–2024) its core product was a restaurant/cafe/bakery **directory and review site**, not a delivery or reservation app. In **June 2024 (Khordad 1403)** it formally entered the online food-ordering/delivery market, and about a month later began a distribution partnership with **Rubika** (an Iranian messenger/super-app). [WebSearch synthesis of a query returning zoomit.ir and digiato.com results, accessed 2026-09-04 — "روبیکا در تیرماه ۱۴۰۳ اعلام کرد که از طریق فیدیلیو وارد بازار سفارش آنلاین غذا شده است"]

Its delivery fulfillment has historically run through a partner rather than its own fleet: it partnered with **ZoodFood** (itself founded ~1387/2008) for online ordering/payment as far back as its own founding era; ZoodFood was rebranded **Snapp Food** in **1396 (2017)** after joining the Snapp Group. [WebSearch synthesis of zoomit.ir "زودفود و فیدیلیو... همکاری" press release and a follow-up query, accessed 2026-09-04] This long-standing technical relationship is the likely backstory to a late-2024 controversy (see Trust, below): a Twitter user found Fidilio displaying Snapp Food's logo/branding due to a bug, and follow-up reporting found that **addresses saved in Snapp Food were automatically appearing in Fidilio's address list, staying in sync with later edits**. Fidilio's CEO, Mohammad Bagheri, told Digiato this was a "technical bug" arising from API integration between the two platforms and denied that Snapp Food user data had been sold or handed over outright; multiple outlets (Digiato, Tabnak, Startup360) reported this explanation while noting the similarity appeared to go beyond an isolated bug. [WebSearch synthesis of digiato.com "آیا فیدیلیو همان اسنپ‌فود است؟", tabnak.ir, and startup360.ir "اسنپ‌فود: فیدیلیو هیچ داده‌ای از اسنپ‌فود در اختیار ندارد" and "شباهت تعجب‌برانگیز «اسنپ‌فود» و «فیدیلیو»", accessed 2026-09-04]

Fidilio's own marketing (via its magazine mag.fidilio.com and landing copy, surfaced through search) claims a directory of several thousand restaurants/cafes/bakeries in Tehran and other major Iranian cities, and describes an online table-reservation feature ("رزرو میز") as well as a loyalty layer called **Fidilio Club** and a merchant-CRM feature called **FidiOffer**. These are marketing claims I could not independently confirm working — see Feature inventory.

## Who it's for
- **Consumers**, primarily in Tehran, looking to discover and compare restaurants/cafes/bakeries by reading reviews, menus, and photos, and — since June 2024 — to order food for delivery through the app.
- **Restaurant/cafe owners** who list on the directory and, for delivery orders, pay Fidilio a commission per its (unpublished) contract terms.

I found **no restaurant-owner-side commentary** (complaints about fees, onboarding, or commission) despite multiple targeted searches in Persian (e.g., "فیدیلیو شکایت صاحبان رستوران کمیسیون", "فیدیلیو پنل رستوران دار ثبت نام"). This is a gap in what I could surface, not evidence that no such complaints exist — see "What I did NOT verify."

## Business model & pricing
- **Consumer side:** the app itself is free to browse and use; food-ordering payment happens in-app. Discount/coupon codes exist — a third-party coupon aggregator (Mopon) lists Fidilio codes, including a Ramadan-period promo of up to 10% off capped at 100,000 Toman. [WebSearch synthesis of mopon.ir "بیشترین کد تخفیف فیدیلیو تا 100%", accessed 2026-09-04 — **CLAIMED**, sourced from a coupon-aggregator page, not Fidilio's own pricing page, and I could not open the page directly to confirm the exact terms or its date]
- **Restaurant side:** Fidilio takes a **percentage-of-sales commission on orders**, with "the commission calculation detailed in the contract agreement" — i.e., not publicly posted. I could not find the actual percentage anywhere in Persian or English search results after several attempts. **UNKNOWN — not verified** (exact rate).
- **Fidilio Club** (loyalty program): described in an old, undated Facebook post as a points scheme — "به ازای هر ۲۰۰۰ تومان خرید ۳ امتیاز" (3 points per 2,000 Toman spent) at a partner restaurant (Morano) alongside a 25% discount. [WebSearch synthesis of facebook.com/FidilioClub, accessed 2026-09-04] No year is visible on the post and I could not verify it reflects current terms. Whether membership itself is free or paid is **UNKNOWN — not verified**.
- **Funding:** Fidilio raised investment from **Shenasa** (a VC vehicle associated with Bank Pasargad's financial group) around its 10th year of operation, per a Digiato headline dated **2019-01-14**: "استارت آپ فیدیلیو در ۱۰ سالگی از «شناسا» سرمایه جذب کرد." [WebSearch synthesis of digiato.com, accessed 2026-09-04] Tracxn's own summary (surfaced via WebSearch, not fetched) states Fidilio "has raised funding from 1 investor" — consistent with a single Shenasa round, but the **amount is UNKNOWN — not verified** in anything I could surface.
- Fidilio's own marketing (per WebSearch synthesis of its landing page) claims coverage of "12,500+ restaurants, 10,000+ cafes, 5,000+ bakeries" and a "4.9-star" rating — this is **CLAIMED** marketing copy from Fidilio itself, and is inconsistent with the independently-observable Cafe Bazaar aggregate of **3.7/5 across 578 ratings** (see Review synthesis) — I am flagging the discrepancy rather than reconciling it, since I could not open either page directly.

## Feature inventory
| Feature | Status (REAL/CLAIMED/UNKNOWN) | Evidence |
|---|---|---|
| Restaurant/cafe/bakery directory & search | REAL | Long, independently-documented operating history since 2008; still the subject of active tech-press coverage through 2024–2025 (Digiato, Zoomit, Tabnak, Startup360, GSM.ir). [Multiple WebSearch syntheses, accessed 2026-09-04] |
| User reviews/ratings shown per venue | CLAIMED | Described in Fidilio's own marketing/help copy ("مشاهده نقدها و نظرات کاربران"); I did not operate the app myself to confirm it currently works. |
| Online table reservation ("رزرو میز") | CLAIMED | Only sourced from Fidilio's own magazine (mag.fidilio.com) articles, e.g. "رزرو میز در شب یلدا با فیدیلیو" and "سیستم رزرو رستوران چه تاثیری روی فروش شما می‌گذارد؟". No independent, dated review confirms this is actually used or functioning in 2025/2026. |
| Online food ordering / delivery (via Snapp Food / Rubika integration) | REAL | Independently confirmed by Zoomit, Digiato and Tabnak as launched June 2024 and still operating as of the late-2024/early-2025 controversy coverage. |
| Fidilio Club (loyalty points, partner-restaurant discounts) | CLAIMED | Sourced only from Fidilio's own Facebook page and magazine content; undated Facebook example given above. No recent (last ~12 months) independent confirmation. |
| FidiOffer (merchant CRM: gamified offers, automated birthday/anniversary messages) | CLAIMED | Sourced only from Fidilio's own magazine ("فیدی‌آفر تحولی در ارتباط با مشتریان"). |
| Check-in / venue-visit rewards | UNKNOWN — not verified | Mentioned once in an English-language WebSearch synthesis paragraph with no Persian-source corroboration found; may be a stale/older feature. Could not confirm it exists today. |
| Android app | REAL | Live Cafe Bazaar listing (`cafebazaar.ir/app/com.fidilio`) with an aggregate rating of 3.7/5 from 578 ratings, observed via WebSearch synthesis, accessed 2026-09-04. |
| iOS app | UNKNOWN — not verified | Only found referenced via a third-party mirror listing (appstor.io); could not confirm via Apple's own App Store. |
| Address data shared/synced with Snapp Food | REAL | Independently reported by three separate outlets (Digiato, Tabnak, Startup360) with the CEO's on-record response; see "What it is" above for detail and sourcing. |

## Review synthesis
**Honesty check up front:** I was only able to surface **two named, dated, quoted** Cafe Bazaar reviews and one unnamed/undated one via WebSearch synthesis — nowhere near enough to responsibly fill five complaint rows and five praise rows with real, distinct evidence. Per the task's own rule against padding, I am reporting what I actually found rather than inventing four more of each to hit the template's shape. The aggregate signal (3.7/5 across 578 ratings on Cafe Bazaar, observed 2026-09-04) is the most defensible quantitative data point I have.

### What I could verify (not a "top 5" — this is the full list)
| Reviewer | Date | Rating shown | Content (as reported by WebSearch synthesis, in Persian where given) | Theme |
|---|---|---|---|---|
| "Ali" | 2025-09-03 | Not specified | App has "many bugs, causing numerous errors, particularly with payment functionality showing a 'user does not exist' error even after re-logging in" (paraphrase reported by the search synthesis, not confirmed verbatim) | Payment/auth failure |
| "arash" | 2025-09-05 | Not specified | App "still has problems" (کماکان مشکل دارد) | Vague ongoing bugginess |
| Unnamed | ~2025-09-16 | Not specified | App is "acceptable" (قابل قبول) | Mild/neutral |

I explicitly could **not** get the underlying star rating attached to each of these three, could not get more than these three, could not access Myket's review page at all (searches returned no Fidilio-specific Myket content), and could not independently confirm the exact wording is verbatim rather than paraphrased by the search tool's summarizer.

### Top complaints — UNKNOWN — not verified (insufficient sample)
Beyond the single payment/auth complaint above, I do not have enough independently-sourced review volume to state a ranked "top 5" complaints list without fabricating counts or quotes. The one complaint theme I can state with any confidence, repeated by two different reviewers within a 2-day window in September 2025, is: **app instability / bugs, with at least one specific report of a payment-flow authentication error ("user does not exist" after re-login).**

### Top praises — UNKNOWN — not verified (insufficient sample)
The only positive-leaning signal I found is the single "acceptable" (قابل قبول) comment above, which is lukewarm at best and not really a "praise." I found no verified five-star review text. **I am not fabricating praise quotes to fill this section.**

## Gen-Z lens scorecard
1. **Time to first value** — UNKNOWN — not verified. I did not operate the app myself (out of reach in this session — see methodology note), and no review or article I found discussed onboarding speed or first-session friction specifically.
2. **Money respect** — Partial evidence only. A third-party coupon aggregator (Mopon) lists Fidilio promo codes (e.g., a capped Ramadan discount), suggesting some price-sensitivity marketing exists, but I could not confirm current terms, and the restaurant-side commission rate is entirely undisclosed (UNKNOWN — not verified) — I cannot assess whether restaurants' margins (and therefore consumer prices) are respected.
3. **Does it feel like now** — Mixed, CLAIMED-leaning. The 2024 pivot into delivery and the Rubika distribution partnership are a real, press-confirmed attempt to modernize (REAL), but the only recent user-facing signal I found (Sept 2025 Cafe Bazaar reviews) describes ongoing bugs and a payment/login failure, which cuts against "feels like now."
4. **Shareability** — UNKNOWN — not verified. I could not open Fidilio's Instagram (`instagram.com/fidilio.official`) or Facebook pages directly (both EGRESS_BLOCKED), so I have no confirmed follower counts, content cadence, or referral/sharing mechanics. Its own content arm (mag.fidilio.com, a blog/magazine) exists but a magazine is not the same as in-app shareability.
5. **Trust** — This is the most concrete, multi-sourced finding in this profile, and it is a **negative** one: the September 2025 review reporting a payment authentication failure, combined with the independently-confirmed (three separate outlets: Digiato, Tabnak, Startup360) 2024 controversy over Snapp Food address data appearing inside Fidilio without a clear, disclosed consent mechanism. The CEO's public explanation ("technical bug" from API integration, no data "handed over") was reported by the same outlets as disputed/questioned rather than fully accepted. This is REAL (multiple independent sources corroborate the underlying facts), even though the *interpretation* (bug vs. deliberate data-sharing arrangement) remains contested.
6. **Notification behavior** — UNKNOWN — not verified. No review or article surfaced discussed push-notification frequency, opt-in flows, or spam complaints.
7. **What to steal / what to never copy** —
   - *Steal:* 16+ years of accumulated restaurant/cafe/bakery listing density across multiple venue categories (restaurant, cafe, bakery, juice/ice-cream, protein stores) is a genuine content moat that is slow to replicate — this is REAL, evidenced by consistent independent references to Fidilio as one of Iran's oldest players in this space since 2008.
   - *Never copy:* an undisclosed/ambiguous data-sharing relationship with a dominant, structurally-related delivery partner that becomes a public controversy when discovered by users rather than disclosed upfront. This is exactly the failure mode the project's own cross-tenant isolation rules (restaurantId/tenantId only from auth context, never from body/query) are designed to prevent architecturally — Fidilio's problem was more of a business/disclosure failure than a pure code bug, but the lesson (make data provenance and sharing explicit and auditable, not something a user discovers via a UI glitch) applies directly.

## Where it beats Rezervno today
UNKNOWN — not verified (out of scope for this research pass; requires repo-side verification by the CEO)

## Where Rezervno beats it
UNKNOWN — not verified (out of scope for this research pass; requires repo-side verification by the CEO)

## Sources
All accessed 2026-09-04. **Every one of these was reached only via the `WebSearch` tool's synthesized summary — direct `WebFetch` of every single URL below was attempted and blocked (`EGRESS_BLOCKED`) by this session's network egress policy.** URLs are listed because they are what WebSearch cited as its source, not because I opened them myself.

- https://fidilio.com/ — main site
- https://fidilio.com/go/help/how-to-use-fidilio — help/how-to page
- https://mag.fidilio.com/ (articles: "سیستم رزرو رستوران چه تاثیری روی فروش شما می گذارد؟", "رزرو میز در شب یلدا با فیدیلیو!", "فیدیآفر تحولی در ارتباط با مشتریان", "مبانی مدیریت رستوران و کافه...") — Fidilio's own magazine/marketing content
- https://cafebazaar.ir/app/com.fidilio — Android app store listing (rating, review snippets)
- https://myket.ir/app/com.fidilio — attempted, no Fidilio-specific content surfaced
- https://apkpure.net/fidilio-cafes-restaurants/com.fidilio — third-party APK mirror
- http://fidilio.appstor.io/ — third-party iOS listing mirror (unverified)
- https://www.crunchbase.com/organization/fidilio — company profile
- https://tracxn.com/d/companies/fidilio/ — company/funding profile ("raised funding from 1 investor")
- https://www.linkedin.com/company/fidilio — company page
- https://www.instagram.com/fidilio.official/ — Instagram account (could not read bio/follower count)
- https://www.facebook.com/FidilioClub/ and an associated undated photo post — Fidilio Club loyalty program example
- https://digiato.com/iran-technology-news/is-fidilio-the-same-as-snappfood — "آیا فیدیلیو همان اسنپ‌فود است؟" (CEO Mohammad Bagheri's statement)
- https://digiato.com/iran-technology-news/zoodex-press-conference-snappfood-monopolistic-behaviors — Zoodex press conference re: Snapp Food monopolistic behavior (market context)
- https://digiato.com/article/2019/01/14/۱۰-سالگی-فیدیلیو — "استارت آپ فیدیلیو در ۱۰ سالگی از «شناسا» سرمایه جذب کرد" (2019-01-14)
- https://www.tabnak.ir/fa/news/1283338/... — "پشت پرده شباهت فیدیلیو و اسنپ‌فود چیست؟ رقیب فرضی برای انحصار؟!"
- https://startup360.ir/snappfood-fidilio-does-not-have-any-data-from-snappfood/ — Snapp Food's denial statement
- https://startup360.ir/surprising-similarity-between-snappfood-and-fidilio/ — "شباهت تعجب‌برانگیز «اسنپ‌فود» و «فیدیلیو»"
- https://www.zoomit.ir/pr/130707-zoodfood-fidilio-online-order-food/ — original ZoodFood × Fidilio partnership announcement
- https://shanbemag.com/جذب-سرمایه-فیدیلیو/ — founder Meysam Mashayekhi's account of Fidilio's founding and Shenasa funding
- https://karangweekly.ir/فیدیلیو؛-از-تولید-محتوا-درباره-غذا-تا-س/ — "فیدیلیو؛ از تولید محتوا درباره غذا تا سفارش آنلاین غذا" (~1M users over 15 years claim)
- https://www.mopon.ir/کد-تخفیف-فیدیلیو/سفارش-غذا/کوپن — coupon aggregator, Fidilio discount codes
- https://mobilekomak.com/howto/معرفی-برنامه-فیدیلیو-fidilio-رستوران-گردی/ — app introduction article
- https://www.gsm.ir/mag/news/33938/... — "فیدیلیو، راهنمایی برای انتخاب رستوران خوب"
- https://play.google.com/store/apps/details?id=com.fidilio — Google Play listing (attempted)

## What I did NOT verify
Being explicit, as required:

1. **No direct page access at all this session.** `WebFetch` returned `EGRESS_BLOCKED` for literally every domain I tried, including a neutral test (`example.com`). I could not personally read a single Fidilio page, app-store listing, review, or news article in full — everything above is secondhand through `WebSearch`'s own summarization, which I could not cross-check against the raw HTML. Treat every "verbatim" quote above with that caveat; I labeled the review-table quotes as "as reported by WebSearch synthesis... not confirmed verbatim" for this reason.
2. **Restaurant commission/fee percentage** — never found, despite several targeted Persian queries. Only that it exists and is "per contract."
3. **Fidilio Club membership cost** (free vs. paid) and whether table reservation carries any consumer-side fee — UNKNOWN.
4. **iOS app existence/quality** — only a third-party mirror referenced it; not confirmed via Apple's own store.
5. **Myket page and reviews** — could not surface any Fidilio-specific content on Myket at all, despite multiple attempts. It may not be listed there, or my searches simply failed to surface it.
6. **Total downloads/install count** — Cafe Bazaar normally shows an install-count band; I could not read this field.
7. **Restaurant-owner-side complaints** (fees, onboarding friction, payout delays) — none found after multiple targeted searches. This is a gap in what I could surface, not proof such complaints don't exist.
8. **Notification behavior, referral/sharing mechanics, and actual first-session UX speed** — no evidence found either way; would require hands-on app testing, which was outside what this session's tooling allowed.
9. **Exact Shenasa investment amount** — only that a round happened (~2019, "10th year"), not disclosed size.
10. **Only 3 real reviews total were verifiable** (2 named/dated complaints, 1 unnamed neutral comment) against a background aggregate of 3.7/5 over 578 Cafe Bazaar ratings. I deliberately did not invent additional reviews, star ratings, or quotes to fill out the "top 5 complaints / top 5 praises" template structure the task requested — that structure is under-filled here on purpose, not by oversight.
11. **Discrepancy between Fidilio's own marketing rating claim ("4.9 stars") and the independently-observed Cafe Bazaar aggregate (3.7/5, 578 ratings)** is noted but not reconciled — I don't know if the 4.9 figure is stale, from a different store, or simply promotional copy not grounded in a real aggregate.
