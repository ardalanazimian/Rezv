# MARKET-SIZE-IRAN — how many restaurants and cafés, and who eats out
**Date:** 2026-09-16 · **Written by:** research agent for Marketer `rezv-c6 [897f2f]` · **Target:** CEO `rezv-87 [09dbab]` · **Status:** reviewed by the Marketer — **submitted, not closed** (review block below)


> ## Marketer review — `rezv-c6`, 2026-09-16
>
> **What I checked, not just read.** I re-fetched two of the sources myself. **Tabnak** (the 45% line): the
> quote and the date `۳۰ تیر ۱۴۰۵` matched, but the speaker's name did not, so the name is no longer
> asserted. **Aftab News** (the 2,413,000 line): the figures matched, but **both dates were wrong**
> (see §1). I also checked every Persian→Gregorian conversion by arithmetic and fixed two more in §2 and
> §5. So this agent's dates are unreliable. **Before any date in this file is used outside it, it has to
> be re-checked.**
>
> **The finding that matters most, and the agent did not draw it:** SnappFood's legal director called
> ~3,000 exclusive-contract restaurants «<2% of all restaurants in the country» (§2, CLAIMED). Taken
> literally, that puts the national count **above 150,000**. That is 7–10× the private-database
> figures (14,432–19,935) used as the TAM bound below. One of the two is wrong by an order of magnitude,
> and the TAM range is only as good as whichever it is. **So the TAM line below is not usable in any
> document that leaves the company. Internal only, until one official count is found.**
>
> **What can be used today, internally:**
> - The sector is under real demand stress in 2026: −45% customers for Tehran food vendors
>   (CLAIMED, re-fetched).
> - Food-group inflation runs far above the headline rate: 127.5% (SECONDARY).
> - SnappFood claims >35,000 standard-contract restaurants (CLAIMED).
>
> **The business-plan read** is that a subscription priced in toman gets sold to restaurants whose
> real volume is falling. That argues for a pitch built on **retention and no-show recovery (money
> kept)**, not on growth. That is an argument, not a measurement.
>
> **Still UNKNOWN:** an official restaurant/café count (national or for any city), the 15–29
> population, and the eating-out share with a confirmed issuing agency.

## Method note (read first)

All web access this session went through `WebSearch` and `WebFetch`. `WebFetch` returns a **model-generated summary of the page**, not raw HTML — every quote below that came through `WebFetch` is reproduced as the tool returned it, but I could not independently re-verify the underlying HTML/PDF byte-for-byte. Several `WebFetch` calls also returned an internally-inconsistent Persian→Gregorian date conversion (e.g. "۱۳۹۲" mapped to "February 3, 2014," which is not how the Persian calendar converts) or, in one case, a publish date identical to today's fetch date — a likely tool artifact rather than a real publish date. Where that happened I flag it explicitly rather than presenting the date as solid. No REAL-class figure was reachable for the core question (official nationwide restaurant/café count) — I never found a working, fetchable amar.org.ir table with that number; every count in this file is CLAIMED or SECONDARY, and several CLAIMED/SECONDARY numbers directly contradict each other. Budget used: 34 WebSearch/WebFetch calls out of the ~40 allowed.

---

## 1. Count of food-service units — Tehran, Iran, other cities

**Nothing here is REAL.** I could not reach a usable amar.org.ir establishment-census (سرشماری کارگاهی) table specific to restaurants/cafés despite three attempts (direct search, portal search, age-group census tables) — every attempt returned the portal's landing/navigation pages, not a data table. Marked UNKNOWN below where that's the case.

### Tehran (city)
| Number | Class | Who / where | Date |
|---|---|---|---|
| **1,200** restaurant + catering units in Tehran city (excl. Shemiranat); 900 of those licensed, 96 catering-only | CLAIMED | Ali Asghar Mir Ebrahimi (علی‌اصغر میرابراهیمی), head of Tehran Restaurant Owners' Union, quoted in Donya-e-Eqtesad | Statement dated "۱۳۹۲" per the article's own text (≈2013); `WebFetch` separately rendered this as "February 3, 2014" — **date conversion unreliable, treat as ~2013–14, over a decade old** |
| "Over 10,000" restaurants, fast-food and catering units in Tehran | SECONDARY | Surfaced only inside a `WebSearch` synthesis (query: تعداد واحد صنفی رستوران ایران آمار اصناف); I could not trace this back to one specific named article/date | UNKNOWN |
| ~6,000 active cafés in Tehran (city) | SECONDARY | fararu.com, attributed only to unnamed "برخی برآوردهای صنفی" (some guild estimates), no named union or official | Article date returned by `WebFetch` as "September 16, 2026" — **this is today's date; almost certainly a tool artifact, true publish date UNKNOWN** |
| "Over 2,000" cafés in Tehran | SECONDARY | Appeared only as an unattributed aside inside a `WebSearch` synthesis | UNKNOWN |
| ~6,000 cafés active in **Tehran province**; ~2,300 warned for violations | SECONDARY | rokna.net headline surfaced by search; the article itself returned HTTP 404 on both fetch attempts, so I could not confirm the speaker or date | UNKNOWN (source unreachable — 2 tries, marked per instructions) |

These Tehran numbers **do not reconcile**: 1,200 (2013-ish, restaurants+catering only, one sub-district excluded) vs. "over 10,000" (undated, unsourced) is an 8x spread; 2,000 vs. 6,000 vs. 6,000-province for cafés is internally inconsistent on geography (city vs. province) even before questioning the estimates themselves. Shown as-is per the evidence rules — not reconciled.

### Iran (national)
| Number | Class | Who / where | Date |
|---|---|---|---|
| 2,413,000+ total active trade-licensed units (all sectors) in Iran; of which ~375,000 (15.4%) fall in the "services" (خدمات) category — **this is broader than restaurants/cafés alone and should not be read as a restaurant count** | CLAIMED | Ministry of Industry, Mine and Trade (SMIT) data, reported by Aftab News — **re-fetched by the Marketer:** «تا پایان بهمن ۱۴۰۰ در مجموع بیش از دو میلیون و ۴۱۳ هزار واحد صنفی در کشور فعال است» and «۳۷۵ هزار، یعنی ۱۵.۴ در بخش خدمات» | **Corrected by the Marketer:** published 1401/03/15 (≈ 2022-06-05); count as of end of **Bahman** 1400 (≈ Feb 2022). The agent's "1401/12/24 / Esfand" was wrong |
| 14,432 restaurants listed nationally in a private restaurant database, of which only 5,299 flagged "99%+ accuracy" | SECONDARY | iran-asnaf.ir, "بانک اطلاعات رستوران‌های کشور" — a commercial listings product, not a government census | Site states last updated 25 Farvardin 1404 (≈ April 14, 2025) |
| 19,935 restaurants — a second, larger figure attached to what appears to be the same or a related private database product (bankyab.com listing) | SECONDARY | Surfaced in the same search synthesis as the 14,432 figure; could not confirm if same underlying dataset or a different one | UNKNOWN |
| ~20,000 cafés nationally | CLAIMED | Vice-chairman of Tehran's coffee-shop union (name not confirmed in what the search tool returned — do not over-attribute), cited for year 1403 | 1403 (≈2024) |

**Read this section skeptically.** No two of these national numbers were produced by the same method, and none is an official census figure. The 375,000 "services" trade-license figure is the closest thing to an official number but is not restaurant-specific — it also covers salons, repair shops, clinics, etc., so using it as a restaurant proxy would materially overstate the market.

### Mashhad, Isfahan, Shiraz, Tabriz, Karaj
| City | Number | Class | Notes |
|---|---|---|---|
| Shiraz | Restaurant union has 1,250 members, 800 of them license-holders | CLAIMED/SECONDARY (source and date not confirmed — appeared only in a `WebSearch` synthesis without a named article) | No date recovered |
| Mashhad | UNKNOWN | — | Searched: «تعداد رستوران‌های مشهد», union directory searches — found only union contact-info directories, no counts |
| Isfahan | UNKNOWN | — | Same — found union directories (rst.ir style), no counts |
| Tabriz | UNKNOWN | — | Same |
| Karaj | UNKNOWN | — | Same |

---

## 2. Platform-side counts (proxy for "how many restaurants operate digitally")

| Number | Class | Who / where | Date |
|---|---|---|---|
| SnappFood (اسنپ‌فود): "40,000 active stores and restaurants," over 500,000 daily orders "last year" | SECONDARY | Surfaced in a `WebSearch` synthesis, exact article not isolated | Referenced as "1404" (≈2025/26) |
| SnappFood: over 35,000 restaurants on standard ("عادی") contracts; ~3,000 restaurants (<2% of all restaurants in the country, per the speaker's own framing) on exclusive/investment contracts | CLAIMED | SnappFood's legal director, quoted in the context of the Competition Council's antitrust ruling against SnappFood's exclusive contracts | Ruling reported ≈1404/12/16 (**≈ 2026-03-07** — the agent wrote 2025; 1404/12 falls in Feb–Mar 2026). ⚠️ **Conflict:** `COMPETITORS-IRAN-2026-09-16.md` dates the Competition Council ruling No. 740 to ۱۶ اردیبهشت ۱۴۰۴ (≈ 2025-05-06). Either there are two rulings or one date is wrong; neither Persian date was re-fetched by the Marketer |
| Fidilio (فیدیلیو): restaurant-count not found; company claims "over one million users" and "15+ years" of restaurant reviews/guide content, but no restaurant/partner count | UNKNOWN (searched: «فیدیلیو تعداد رستوران همکار») | mag.fidilio.com, gsm.ir | — |
| Foodism | UNKNOWN | Not searched separately after budget triage — treat as a gap, not a negative finding | — |

Note the SnappFood "35,000 standard-contract restaurants" figure (CLAIMED, company's own legal director) sits inside the same 14,000–40,000 range as the conflicting national restaurant-count figures in Section 1, which is the only rough cross-check available — it does not resolve which is right.

---

## 3. Eating-out spending (household income & expenditure)

| Number | Class | Who / where | Date |
|---|---|---|---|
| "Hotel and restaurant" (هتل و رستوران) = **2.4%** of total gross urban household expenditure; up 71.8% vs. year 1401 in nominal terms | SECONDARY (news report of the household budget survey; the `WebFetch` summary itself was inconsistent about whether the source is مرکز آمار ایران or بانک مرکزی — **agency attribution unconfirmed, flagged rather than guessed**) | donya-e-eqtesad.com | Data year 1402 (2023/24); article dated ~1403/10/23 (≈ Jan 13, 2025) |
| Food & beverages (خوراکی‌ها و آشامیدنی‌ها) = 29.9% of total urban household expenditure; Housing/water/electricity/gas = 34.7% | SECONDARY | Same article | Same |
| "Hotel and restaurant costs up 600%" (a separate price-level claim, not a spending-share claim) | SECONDARY | kojaro.com / tinn.ir / entekhab.ir — three outlets repeating the same figure, still SECONDARY per the evidence rule that repetition doesn't upgrade class | Comparison period not confirmed in what I retrieved |

**This is the weakest-sourced section relative to how central it is to demand sizing.** I did not manage to open an amar.org.ir page that itself states the "غذای آماده / رستوران / هتل" household-survey line item with a clear agency stamp and year — everything here is a news article's characterization of that survey.

---

## 4. Demand context

### Population 15–29
| Number | Class | Who / where | Date |
|---|---|---|---|
| "25% of the country's population" is aged 15–29 | SECONDARY | Surfaced in a `WebSearch` synthesis without a specific traceable article | UNKNOWN |
| "Over 30 million" people aged 15–29 in year 1400 | SECONDARY | Same synthesis, different clause | Year 1400 (≈2021/22) |
| Population aged 15–34 was ~28 million in 1396, fell to ~24 million by 1404 | SECONDARY | Same synthesis | 1396→1404 |

These three numbers use **different age bands** (15–29 vs. 15–34) and don't reconcile into one series. I could not reach an amar.org.ir census age-pyramid table directly (one fetch attempt to amarbook.ir failed with a connection error; the direct amar.org.ir searches returned only the 1395 census landing pages, not 1400 tables). **Treat the true 15–29 count as UNKNOWN** despite the SECONDARY numbers above existing — none of them is precise or dated well enough to anchor a demand estimate.

### Mobile / smartphone penetration
| Number | Class | Who / where | Date |
|---|---|---|---|
| Mobile internet (broadband) penetration: 144.39%, up from 139.71% the prior year; 124,985,473 mobile-internet subscribers | SECONDARY (this is CRA/سازمان تنظیم مقررات's own regulatory report, but I read it via zoomit.ir's write-up, not cra.ir directly, so classing as SECONDARY rather than REAL/CLAIMED) | Reported by zoomit.ir, sourcing سازمان تنظیم مقررات و ارتباطات رادیویی (CRA) | Winter 1404 (≈ Dec 2025–Feb 2026) |
| Mobile phone penetration: 197.68%, up from 189.60%; 171,113,802 total mobile subscribers | SECONDARY | Same source | Same period |

Penetration rates over 100% reflect multi-SIM ownership, not unique-user reach — worth remembering when using this as a "smartphone-ready diners" proxy.

### Point-to-point inflation
| Number | Class | Who / where | Date |
|---|---|---|---|
| Point-to-point inflation (household basket, تورم نقطه به نقطه): **89%** for Mordad 1405 | SECONDARY (I reached this via a `WebSearch` synthesis of multiple news outlets, not a direct fetch of مرکز آمار ایران's own release — two direct-fetch attempts at specific articles 404'd) | مرکز آمار ایران, reported by multiple outlets (fararu.com, iranjib.ir, eghtesadonline.com, sharghdaily.com) | Mordad 1405 (≈ Aug 2026) |
| Annual inflation: 69.9%; CPI index: 700.1 | SECONDARY | Same | Same |
| Point-to-point inflation, food & beverage group specifically: **127.5%** | SECONDARY | Same | Same — directly relevant since Rezervno's subscription and diners' spend are both toman-denominated and food-group inflation is running well above headline |

---

## 5. Sector stress 2025–2026

| Finding | Class | Who / where | Date |
|---|---|---|---|
| Fast-food/sandwich-shop (اغذیه‌فروشان) customer count in Tehran down **~45%** year-on-year | CLAIMED Head of Tehran's Food-Vendors' Union — **name unconfirmed:** the agent's fetch returned «مجید محبی», the Marketer's re-fetch returned "Majid Mohammadi"; both are WebFetch summaries, so neither is asserted. Quote and date **re-fetched and matched** by the Marketer (اتحادیه صنف اغذیه‌فروشان و مواد غذایی تهران), confirmed via direct quote fetch: *"بر اساس بررسی‌های ما، نسبت به سال گذشته حدود ۴۵ درصد کاهش مشتری داشته‌ایم"* | Article dated 30 Tir 1405 (July 21, 2026) — **recent and well-sourced relative to the rest of this file** |
| Cafés: ~50% revenue decline, ~100% cost increase reported | CLAIMED | Head of Tehran Coffee Shop Union, surfaced via `WebSearch` synthesis — not independently re-fetched, exact quote/date not captured | Reported as "recent," undated in what I retrieved |
| Juice/ice-cream/coffee-shop union: 30–40% of businesses closed in recent months, with more closures expected | CLAIMED | Head of that union, same synthesis, same caveat | UNKNOWN exact date |
| Aggregate café/restaurant market: across 75M+ orders analyzed, nominal revenue +~33% but order volume **−9%** year-on-year (1404) — read as falling real demand under nominal-revenue cover from inflation | SECONDARY | Source of the "75 million orders" analysis not identified by name (reads like a platform's own annual trends report, but I could not confirm which platform or publisher) | Year 1404 |
| Internet shutdowns / conflict period: SnappFood transactions down 40–60%; SnappMarket orders down >60% on day one (recovered to ~95% of normal activity by week two); SnappShop orders down >60% | CLAIMED | Snapp Group's own operational data, reported by startup360.ir | Article dated 27 Ordibehesht 1405 (**≈ 2026-05-17** — the agent wrote June 2025; corrected by arithmetic) |

---

## TAM / SAM / SOM

**Formula-only. P = placeholder annual subscription price (no number inserted). Every input's class is shown; the result carries the weakest class among its inputs, per instruction.**

### TAM (Total Addressable Market)
TAM = (food-service units in Iran) × P

No REAL input exists. The least-bad available input is the private-aggregator restaurant count, which itself is internally inconsistent:

- Low bound: TAM ≈ 14,432 × P — **class: SECONDARY** (iran-asnaf.ir database, updated April 2025; explicitly only 5,299 of these are flagged "99%+ accurate," so even this number is soft)
- High bound: TAM ≈ 19,935 × P — **class: SECONDARY** (related aggregator figure, provenance not fully confirmed as the same dataset)

So: **TAM ≈ [14,432 – 19,935] × P, class SECONDARY, range is ±38% wide and both ends are private-database counts, not a census.**

A much larger, but definition-mismatched, alternative: if "services sector" trade licenses (375,000, CLAIMED, SMIT/Aftab News, 2022) were used as an upper-bound proxy, TAM ≤ 375,000 × P — but this materially overstates the market because "services" includes many non-food-service trades (repair shops, salons, clinics, etc.). **Not recommended as the headline TAM** — included only to show the size of the definitional gap between "restaurants" and "licensed service businesses."

Cafés are excluded from the above (counted separately, same problem): national café count is CLAIMED at ~20,000 (2024, union vice-chair), so a combined restaurant+café TAM upper estimate would be roughly (20,000 SECONDARY/CLAIMED-restaurant-range + 20,000 CLAIMED-café) × P — shown only to illustrate order of magnitude, not to be treated as reliable.

### SAM (Serviceable Addressable Market)
SAM = food-service units in the six largest cities (Tehran, Mashhad, Isfahan, Shiraz, Tabriz, Karaj) that plausibly take reservations.

**Filter definition (my proposal, not sourced):** sit-down restaurants and cafés with table service and some existing digital presence (listed on a delivery/reservation platform, or with an active social-media page taking booking DMs) — excludes pure takeaway/اغذیه‌فروشی stalls, bakeries, and teahouses with no table-booking behavior today.

**Cannot be computed.** Per-city counts are UNKNOWN for 4 of the 6 target cities (Mashhad, Isfahan, Tabriz, Karaj — no count found by any class). Tehran has multiple conflicting SECONDARY/CLAIMED numbers (Section 1) spanning roughly 1,200–10,000+ for restaurants and 2,000–6,000+ for cafés, none dated later than ~2025 and none applying the reservation-readiness filter above. Shiraz has a partial, undated CLAIMED number (1,250 union members / 800 licensed) that is restaurant-only, not filtered for digital presence. **SAM is UNKNOWN as a number; the filter above is offered so the Marketer/CEO can apply it once a real per-city count exists.**

### SOM (Serviceable Obtainable Market)
**Cannot be computed pre-launch.** Rezervno has no signed restaurants, no pilot data, and no conversion/CAC evidence yet (consistent with `docs/audit/research/BUSINESS-MODEL-KPI.md`'s finding of no market-size data in the business plan). SOM requires a go-to-market motion and early traction numbers that don't exist yet.

---

## What I did not verify

- No direct fetch of any amar.org.ir table with a restaurant/café unit count, national or by city (establishment census / سرشماری کارگاهی). Every attempt reached only portal landing/navigation pages.
- No direct fetch of iranianasnaf.ir / سامانه ایرانیان اصناف licence-count data — the domain now redirects to a unified "پنجره واحد خدمات اصناف" portal with no public aggregate counts found.
- No direct primary-source confirmation of the Mordad 1405 inflation figures (89% point-to-point, 69.9% annual) — relied on a `WebSearch` synthesis of multiple news outlets after two direct article fetches 404'd.
- Household expenditure survey's exact issuing agency (مرکز آمار ایران vs. بانک مرکزی) for the "2.4% hotel/restaurant" figure is unconfirmed — `WebFetch`'s own summary was internally inconsistent on this point.
- No restaurant/café counts found for Mashhad, Isfahan, Tabriz, or Karaj by any method tried.
- Fidilio and Foodism partner-restaurant counts not found (Foodism not deeply searched due to budget).
- rokna.net article on "6,000 cafés in Tehran province" could not be opened (404 on retry) — its speaker and exact date are unconfirmed; kept only as a SECONDARY headline-level data point.
- otaghasnaftehran.ir (Tehran Chamber of Guilds) could not be reached directly (DNS failure, 2 attempts) — its content was accessed only via cached/mirrored quotes on tabnak.ir.
- No official census table for population aged specifically 15–29 was reached; the SECONDARY figures found use inconsistent age bands (15–29 vs. 15–34) across different years and don't reconcile.
- Did not attempt Tehran Municipality data sources (not reached within budget).
- Several dates in this file rely on `WebFetch`'s own Persian-to-Gregorian conversions, which were shown to be unreliable at least twice in this session (see Method note) — where I could not sanity-check a date, I flagged it rather than presenting it as solid.

---

## Sources

- Donya-e-Eqtesad — "رستوران‌ها روزانه غذای ۲۵ درصد پایتخت را تهیه می‌کنند" — https://donya-e-eqtesad.com/بخش-ویژه-نامه-63/3292054 — fetched 2026-09-16
- Fararu — "شش هزار کافه در تهران؛ بازار این همه کافه کجاست؟" — https://fararu.com/fa/news/1000146/ — fetched 2026-09-16 (article's own publish date unreliable, see Method note)
- Aftab News — "چند واحد صنفی فعال داریم؟" — https://aftabnews.ir/fa/news/774918/ — fetched 2026-09-16
- Iran Asnaf — "بانک اطلاعات رستوران‌های کشور" — https://iran-asnaf.ir/Product/96/ — fetched 2026-09-16
- Bankyab — "اطلاعات رستوران های کشور" — https://bankyab.com/product/اطلاعات-رستوران-های-کشور/ — surfaced via search, not directly fetched
- WebSearch synthesis — «تعداد رستوران‌های فعال اسنپ‌فود ۱۴۰۴» (SnappFood counts) — 2026-09-16
- WebSearch synthesis — «فیدیلیو تعداد رستوران همکار» (Fidilio — not found) — 2026-09-16
- ECC News — "مرکز آمار گزارش داد: متوسط درآمد و هزینه خانوارهای کشور در سال ۱۴۰۲" — https://www.ecc.news/fa/news/226666/ — fetched 2026-09-16 (did not contain the hotel/restaurant line item)
- Donya-e-Eqtesad — "وزن مسکن و خوراکی از هزینه های کل چه مقدار است؟" — https://donya-e-eqtesad.com/بخش-بانک-بیمه-16/4143629 — fetched 2026-09-16
- Zoomit — "گزارش زمستان ۱۴۰۴ رگولاتوری؛ ضریب نفوذ موبایل به مرز ۲۰۰ درصد رسید" — https://www.zoomit.ir/report/460714-regulatory-report-iran-ict-winter-1405/ — fetched 2026-09-16
- WebSearch synthesis — point-to-point inflation, Mordad 1405, multiple outlets (fararu.com, iranjib.ir, eghtesadonline.com, jamaran.news, sharghdaily.com) — 2026-09-16
- WebSearch synthesis — «جمعیت جوانان ۱۵ تا ۲۹ سال ایران مرکز آمار سرشماری ۱۴۰۰» — 2026-09-16
- WebSearch synthesis — «تعطیلی رستوران کافه ۱۴۰۴ کاهش مشتری اتحادیه» (closures, Tehran Coffee Shop Union, Juice/Ice-cream/Coffee Union) — 2026-09-16
- Tabnak — "ساندویچی‌ها پناهگاه لیسانسه‌های بیکار شدند" (45% customer decline, اغذیه‌فروشان) — https://www.tabnak.ir/fa/news/1385838/ — fetched 2026-09-16
- Startup360 — "گزارش عملکرد اسنپ در جنگ ۳۹ روزه" — https://startup360.ir/snapp-performance-war-report-39days/ — fetched 2026-09-16
- WebSearch synthesis — «تعداد واحد صنفی رستوران مشهد اصفهان شیراز تبریز کرج اتحادیه» (city-level, mostly not found) — 2026-09-16
- WebSearch synthesis — «سامانه ایرانیان اصناف تعداد پروانه کسب رستوران کشور» (not found) — 2026-09-16
- WebSearch synthesis — «نایب رئیس اتحادیه کافه داران ۲۰ هزار کافه ایران ۱۴۰۳» and rokna.net "6 هزار کافه در استان تهران" headline — 2026-09-16 (rokna.net article itself unreachable, 404 x2)
- Internal, for context only, not cited as a source of numbers — `docs/audit/research/BUSINESS-MODEL-KPI.md`
