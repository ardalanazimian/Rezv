# APP-STORE-FOOTPRINT — Cafe Bazaar and Myket, as the store pages showed them

**Date:** 2026-09-16/17 · **Written by:** Marketer `rezv-c6 [897f2f]` (replaces the haiku extraction draft, see below) ·
**Target:** CEO `rezv-87 [09dbab]` · **Status:** submitted, not closed · **Class:** every figure is **REAL for "the store page shows X"**.
Install figures are the store's own rounded buckets, not measured users, and Bazaar and Myket count differently.

## Why this file was rewritten

The first version came from a haiku extraction agent. It said both stores are JavaScript-only apps
that "cannot be fetched", reported 35 of 35 fetches failed, and recorded one app, فیدیبو, an e-book
app that is not in this market. **The premise was false, and I measured it:** `curl` on
`https://cafebazaar.ir/app/com.fidilio` returns `200` (317,846 bytes), and the server-rendered HTML
already contains «نصب | ۱۱۰ هزار | از ۵۸۱ رأی | ۳.۷». Myket app pages do the same. What doesn't
render server-side is **search**: Bazaar's `/search` returns 404 and Myket's has no app links. So the
agent's failure was its method (search pages), not the stores. Package names below came from
WebSearch restricted to the two store domains, and from the competitor research.

## Method (reproducible)

For each package: `curl -s -m 25 -A "Mozilla/5.0" https://cafebazaar.ir/app/<pkg>` and
`https://myket.ir/app/<pkg>`. Strip tags, decode entities, and read the value that follows the
label: Bazaar «نصب», then votes and rating. Myket «تعداد دانلود», «امتیاز», «تعداد نظرات»,
«آخرین بروزرسانی». Nothing is inferred. A missing label is `NOT SHOWN`, and a non-200 is recorded as
its HTTP code. `com.smartx` failed once with a curl transport error and succeeded on retry. It was
measured 2026-09-17, the rest 2026-09-16. "What it is" is the app's own title or a store-search
snippet, as marked. None of these apps was installed.

## Table

| Package | What it is | Bazaar: installs | Bazaar: rating (votes) | Bazaar: category | Myket: downloads | Myket: rating (reviews) | Myket: last update |
|---|---|---|---|---|---|---|---|
| `com.zoodfood.android` | SnappFood — diner app (delivery; Foodro booking inside) | ۴.۴ میلیون | ۴.۴ (۵۳،۳۴۶) | آشپزی و رستوران | ۳ میلیون | ۴.۳ (۱۹,۸۰۳) | ۱۴۰۵/۰۶/۱۵ |
| `com.takhfifan.takhfifan` | Takhfifan — deals, incl. restaurant booking (search snippet) | ۹۱۰ هزار | ۴.۵ (۳۵،۲۵۱) | خرید | ۴۰۰ هزار | ۴.۴ (۲,۵۹۶) | ۱۴۰۵/۰۵/۱۹ |
| `ir.snappfood.vms` | SnappFood — vendor app («فود پارتنر») | ۳۹۰ هزار | ۲ (۲،۳۳۴) | ابزارها | HTTP 404 | — | — |
| `com.delino.android` | Delino — delivery | ۲۷۰ هزار | ۴.۶ (۸،۰۳۰) | آشپزی و رستوران | ۸۰ هزار | ۴.۳ (۴۵۸) | ۱۴۰۵/۰۴/۲۳ |
| `com.fidilio` | Fidilio — diner app | ۱۱۰ هزار ⚠️ «یافت نشد» banner | ۳.۷ (۵۸۱) | آشپزی و رستوران | ۳۰ هزار | ۳.۰ (۱۰۵) | ۱۴۰۳/۱۰/۲۲ |
| `app.foodism.tech` | Foodism — diner app | HTTP 404 | — | — | ۲۵ هزار | ۴.۳ (۲۲۶) | ۱۴۰۱/۰۹/۱۰ |
| `co.silverpath.dido` | Dido — booking (Myket description) | ۱۴ هزار | ۴.۶ (۳۱۳) | آشپزی و رستوران | ۷ هزار | ۳.۲ (۳۱) | ۱۳۹۹/۰۷/۰۳ |
| `ir.restsoft.restaurant` | گارسون دانا — waiter order-taking (its title) | ۶.۶ هزار | ۴.۵ (۵۶) | آشپزی و رستوران | ۵ هزار | ۴.۴ (۲۹) | ۱۴۰۴/۱۰/۱۷ |
| `com.example.foodapp` | Serchi — café/restaurant reviews | ۳.۹ هزار | ۳.۸ (۱۵) | آشپزی و رستوران | HTTP 404 | — | — |
| `com.onifood` | آنی فود — delivery, Birjand (its title) | ۳.۷ هزار | ۴.۱ (۱۹) | آشپزی و رستوران | HTTP 404 | — | — |
| `com.eatamin.arvinrokni.amingholami` | Eatamin — table booking + event add-ons | ۵۲۰ | ۳.۵ (۳۱) | آشپزی و رستوران | HTTP 404 | — | — |
| `com.kaspid.app.tahdig` | ته دیگ — ordering + table booking (search snippet) | ۲۷۰ | ۳ (۴) | آشپزی و رستوران | HTTP 404 | — | — |
| `com.smartx` | SmartX — restaurant-manager app | <۱۰۰ | ۴.۸ (۵) | ابزارها | کمتر از ۱۰۰ | NOT SHOWN (NOT SHOWN) | ۱۴۰۴/۱۱/۰۶ |
| `ir.mycafes.app` | کافه من — not checked | <۱۰۰ | ۵ (۳) | آشپزی و رستوران | HTTP 404 | — | — |
| `com.zig.SefareshGir` | سفارش گیر — order taking (its title) | HTTP 404 | — | — | ۵۰۰ | ۵.۰ (۴) | ۱۳۹۸/۰۶/۰۲ |
| `comm.hyperonline.resmiz` | رستوران میزبان آمل — one restaurant, by its name | HTTP 404 | — | — | ۳۰۰ | ۴.۵ (۴) | ۱۴۰۰/۱۱/۱۷ |
| `raestoranyub.ir.raestoranyub` | Restoran Yab — finder + booking (Myket description) | HTTP 404 | — | — | ۲۰۰ | NOT SHOWN (NOT SHOWN) | ۱۴۰۲/۱۰/۱۵ |
| `com.farayar.cafebaaz` | Cafe Baaz (search hit) | HTTP 404 | — | — | HTTP 404 | — | — |
| `ir.matemenu.app` | Menu (search hit) | HTTP 404 | — | — | HTTP 404 | — | — |

## What it says, and what it does not

- **One app dominates, and it is not a reservation app.** SnappFood's diner app shows **4.4 million**
  Bazaar installs and 3 million on Myket. It is the only app here with a booking feature (Foodro,
  launched 1404/05/15 per Zoomit, live status today unconfirmed; see `COMPETITORS-IRAN-2026-09-16.md`)
  *and* an installed base. Its vendor app («فود پارتنر», 390 هزار installs) rates **2** from 2,334
  votes. That is a signal about how restaurants experience the dominant platform. It is not a
  measurement of why.
- **Takhfifan (910 هزار)** is the second-largest reach. A store-search snippet says it sells restaurant
  booking among deals. That was not checked on its own pages, so it is an **unchecked lead** for the
  competitor file.
- **Every dedicated booking app found is tiny or stale:** Dido has 14 هزار installs and its last
  Myket update was 1399. Eatamin shows 520, Restoran Yab 200, Tahdig 270. Foodism's Myket build dates
  from 1401, and its Bazaar listing returns 404.
- **Fidilio's Bazaar page shows «متأسفانه برنامه مورد نظر شما یافت نشد»** next to its stats, and its
  last Myket update was 1403/10/22. The competitor file's reading that it is "not a fast-growing app"
  holds.
- **SmartX's own app shows <100 installs.** It sells to managers through sales, not through the store.
  That is consistent with a B2B product and says nothing about SmartX's size.
- **Not measured:** RSEE, Mupra, Duvita, Sepidz. No store package was found for them in two
  store-restricted searches. That is `UNKNOWN`, not absence.
