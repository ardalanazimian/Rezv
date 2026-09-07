# Fidilio — Store Reviews at Volume (evidence corpus)
_Date: 2026-09-07 · Researcher: Scout · Competitor: Fidilio (فیدیلیو), key `fidilio`, tier `iran`_
_Mode: STORE REVIEWS AT VOLUME (target: 50+ recent real user reviews)_

## Methodology header — read this before the findings below

**First action taken, per protocol:** `WebFetch` was tested against `https://example.com` (a neutral
control) and immediately after against the primary target URL `https://cafebazaar.ir/app/com.fidilio`.

| URL | Result |
|---|---|
| `https://example.com` | `EGRESS_BLOCKED` |
| `https://cafebazaar.ir/app/com.fidilio` | `EGRESS_BLOCKED` |
| `https://amp.cafebazaar.ir/app/com.fidilio` | `getaddrinfo ENOTFOUND` (DNS failure — not even a proxy block) |
| `https://myket.ir/app/com.fidilio` | `EGRESS_BLOCKED` |
| `https://play.google.com/store/apps/details?id=com.fidilio&hl=fa` | `EGRESS_BLOCKED` |
| `https://apkpure.net/fidilio-cafes-restaurants/com.fidilio` | `EGRESS_BLOCKED` |

**Conclusion: `webfetch_worked = false` for this session.** The example.com control confirms this is a
blanket network-egress policy for this session, not a per-domain block — no direct page read was
possible for any source, in contrast to the **2026-09-05** session documented in
`docs/audit/research/profiles/fidilio.md`'s ADDENDUM, where `WebFetch` worked and produced 3 first-hand
verbatim reviews from Cafe Bazaar. That is the correct prior-art: **read first**, per the task
instructions, and it is treated below as prior evidence, not re-verified by me this session.

Per the task's fallback rule, all further research this session used `WebSearch` only, with many
differently-phrased queries (Persian and English, `site:` operators, exact-phrase searches for review
text), and every item obtained this way is marked **search-synthesis**.

### Queries run this session (28 total, all via WebSearch; none via WebFetch beyond the 6 blocked/failed attempts above)

1. `فیدیلیو نظرات کافه بازار`
2. `site:cafebazaar.ir com.fidilio نظر`
3. `فیدیلیو باگ اپلیکیشن`
4. `"فیدیلیو" کد تایید ورود مشکل`
5. `myket.ir/app/com.fidilio نظرات`
6. `فیدیلیو رزرو میز رستوران تجربه`
7. `فیدیلیو کلاهبرداری شکایت`
8. `فیدیلیو "برنامه بسیار ضعیفه" OR "کد تایید" کافه بازار`
9. `فیدیلیو پشتیبانی افتضاح تجربه کاربری`
10. `"Fidilio" app reviews complaints Iran`
11. `فیدیلیو نصب دانلود تعداد ۱۱۰ هزار`
12. `trustpilot.com/review/fidilio.com`
13. `فیدیلیو ۱۴۰۵ نظر کاربران مشکل`
14. `"فیدیلیو" اپدیت جدید خطا ۴۰۴ پرداخت`
15. `فیدیلیو کافه بازار "امتیاز" "از ۵" نظرات کاربران ۱۴۰۴`
16. `فیدیلیو سفارش نرسید لغو سفارش تجربه بد`
17. `instagram.com/fidilio.official کامنت شکایت`
18. `"فیدیلیو" توییتر شکایت مشتری غذا`
19. `فیدیلیو appreview.ir بررسی`
20. `فیدیلیو charkhoneh بررسی نظر`
21. `apkcombo.com com.fidilio reviews`
22. `uptodown fidilio reviews comentarios`
23. `"cafebazaar.ir/app/com.fidilio" نظرات "ستاره"`
24. `فیدیلیو رستوران کمیسیون صاحب رستوران ثبت نام پنل`
25. `فیدیلیو بررسی رستوران گردی مقایسه اسنپ فود ۱۴۰۵ نقد`
26. `"فیدیلیو" g2.com OR capterra.com OR getapp.com OR sitejabber.com`
27. `فیدیلیو اپ استور آیفون iOS دانلود`
28. `فیدیلیو کیفیت غذا سرد دیر رسید انتقاد`
29. `virgool.io فیدیلیو تجربه کاربری`
30. `digiato.com is-fidilio-the-same-as-snappfood کامنت خواننده`
31. `فیدیلیو کاربران گلایه صف پشتیبانی تلگرام کانال`
32. `"علیرضا" OR "محمد" فیدیلیو کد تایید ۶ رقمی ۴ رقمی نظر کافه بازار`
33. `فیدیلیو نظر کاربر ۱۴۰۴/۰۹ OR ۱۴۰۴/۱۰ OR ۱۴۰۴/۱۱ کافه بازار`
34. `فیدیلیو اسفند ۱۴۰۴ فروردین ۱۴۰۵ آپدیت جدید مشکل`
35. `"فیدیلیو" هک نشتی اطلاعات امنیت`

**Result of all 35 queries: zero new verbatim review quotes surfaced.** `WebSearch`'s synthesis
consistently returned (a) Fidilio's own marketing/magazine copy, (b) general how-to/troubleshooting
pages unrelated to Fidilio, (c) unrelated companies sharing the "Fidilio/Fidelity/Fidibo" string, or
(d) paraphrased restatements of the *same three reviews and the same Snapp Food controversy* already
documented in `profiles/fidilio.md` from the 2026-09-04/09-05 sessions — never new text presented
inside quotation marks, and never a new reviewer handle + date I had not already seen. One query
(#28, food-quality/cold-delivery) returned an unsourced, unattributed paraphrase ("food quality was
very poor... admin quickly deleted [an Instagram complaint]") with **no URL, no handle, no date, no
quotation marks** — this does not meet the evidence bar (verbatim quote + handle + date required) and
is explicitly **not** used as a finding below; it may also describe a *restaurant's* Instagram page
being criticized inside a Fidilio venue review, not Fidilio the company/app, which the search
synthesis did not disambiguate. It is recorded here only so the query is not silently dropped.

**Honest conclusion: `reviews_read = 0` for this session.** I did not personally read a single
review this session — every direct-fetch attempt was blocked, and no `WebSearch` result this
session put review text inside quotation marks that I could respect as verbatim. Per the task's own
rule ("Never invent... 0 is a valid answer" / "Never pad to hit a target"), I am reporting 0 rather
than dressing up paraphrase-of-paraphrase as new evidence, and rather than re-presenting the prior
session's 3 fetched reviews as if I read them myself.

## Prior evidence carried forward (NOT re-verified this session — full citation to source session)

The existing profile (`docs/audit/research/profiles/fidilio.md`, ADDENDUM dated 2026-09-05) documents
that in **that** session `WebFetch` worked and Cafe Bazaar's listing page was read directly. That
session read **3 reviews** (the total rendered on the listing page — it did not reach a paginated full
corpus either). Reproduced here for continuity, labeled by its own original evidence type:

**Source (fetched directly by the 2026-09-05 session, not by me):**
[cafebazaar.ir/app/com.fidilio](https://cafebazaar.ir/app/com.fidilio)

| Field | Value as printed, 2026-09-05 |
|---|---|
| App name | فیدیلیو \| سفارش غذا |
| Developer | فیدیلیو |
| Rating | ۳.۷ از ۵ |
| Ratings count | ۵۸۱ رأی |
| Installs | ۱۱۰,۰۰۰ |
| Category | آشپزی و رستوران |

Three reviews rendered on that page, Persian dates verbatim with the prior session's Gregorian
conversion:

1. **علیرضا — ۱۴۰۴/۰۶/۲۲** (≈2025-09-13)
   > «برنامه بسیار ضعیفه پشتیبانی فاجعه س کد تایید هم 6 رقمی میفرستن ولی برنامه 4 رقمی میخواد»
   "The app is very weak, support is a disaster, and they send a 6-digit verification code but the
   app asks for 4 digits."
2. **محمد — ۱۴۰۴/۰۷/۱۹** (≈2025-10-11)
   > «این دیگه چجورشه کد تایید شش رقمی برای وارد کردن 4 رقم!!»
   "What kind of thing is this — a six-digit verification code to enter into 4 digits!!"
3. **alireza — ۱۴۰۴/۰۷/۳۰** (≈2025-10-22)
   > «واقعا افتضاحه تازه که وارد برنامه میشی یه ارور 404میده بعد موقع پرداخت انلاین»
   "Truly awful — the moment you enter the app it gives a 404 error, then during online payment…"
   (text ends mid-sentence as printed)

Also carried forward from the earlier (pre-fetch, `WebSearch`-synthesis, batch 1) portion of the same
profile, labeled **search-synthesis** there and here — these appear to be paraphrases of reviews near
the same period, star ratings never obtained, exact verbatim wording never confirmed by either
session:

- "Ali", ~2025-09-03: app has "many bugs... particularly with payment functionality showing a 'user
  does not exist' error even after re-logging in" (paraphrase, not verbatim — flagged as such in the
  original profile too)
- "arash", ~2025-09-05: "کماکان مشکل دارد" (still has problems)
- Unnamed, ~2025-09-16: "قابل قبول" (acceptable)

**This session adds no reviews to this list.** The two clusters above (3 fetched + 3
search-synthesized, all dated within roughly Sept–Oct 2025) remain the entire known Fidilio review
corpus across all Scout sessions to date. Total known-and-cited reviews: **6**, against a background
of **581 ratings** (2026-09-05 aggregate) — i.e., under 1.1% of the rated population has any quoted
or paraphrased text attached to it in this research line. That gap is the headline finding of this
corpus pass: **the 50-review volume target could not be met, and could not be meaningfully advanced
beyond the prior session's 3, because this session's tooling could not open a single store page.**

## What this session could NOT do (explicit gap list)

1. Could not open Cafe Bazaar's listing (bare or `?l=en`), so could not read any review beyond the 3
   already known, could not confirm whether the rating/installs/review-count have moved since
   2026-09-05, and could not check for pagination ("نظرات بیشتر") that the prior session also never
   reached.
2. Could not open Myket (`myket.ir/app/com.fidilio`) at all — no session, past or present, has
   surfaced Myket-specific review content for Fidilio. **UNKNOWN whether Fidilio is even listed on
   Myket** — not verified either way.
3. Could not open Google Play (`hl=fa` or `hl=en`) — no session has confirmed a Play Store listing
   exists for `com.fidilio`. Iranian apps are frequently absent from Google Play due to sanctions;
   this is a plausible but **UNKNOWN — not verified** explanation, not a confirmed fact.
4. Could not open apkpure, apkcombo, uptodown, or aptoide comment pages — no session has found
   Fidilio-specific review content on any of these mirrors.
5. Could not open `apps.apple.com` — iOS presence remains **UNKNOWN — not verified** (only a
   third-party Iranian mirror, sibirani.com/appleapps.ir, references an iOS build; Apple's own store
   page was never reached by any session).
6. Trustpilot has **no page for `fidilio.com`** — confirmed by search (result set returned only
   unrelated similarly-named domains: fiido.com, fidellio.io, fidiumfiber.com). This is a genuine
   **ABSENT**, not a gap: a consumer food app with no international payment/support relationship has
   no structural reason to be on Trustpilot, and the search came back clean rather than blocked.
7. G2, Capterra, GetApp, Sitejabber: no Fidilio presence found — expected, since these are B2B
   software-review sites and Fidilio is an Iran-only consumer app, consistent with the prior profile
   finding the same for Foodism (another Iran-only consumer app).
8. Instagram (`fidilio.official`, reported by search as ~77K followers) and Twitter/X comment
   threads: not reachable; no complaint or praise text surfaced from either.
9. No restaurant-owner-side review/complaint (commission %, onboarding, payout) surfaced — same gap
   the prior profile already flagged, still open.
10. No 2026-dated (Persian 1404 H2 / 1405) review or press content surfaced despite explicitly
    date-targeted queries (#33, #34) — the most recent dated evidence in the entire corpus, across
    all sessions, remains **۱۴۰۴/۰۷/۳۰ (≈2025-10-22)**. Whether the OTP length-mismatch bug (SMS
    sends 6 digits, app accepts 4) was ever fixed after that date is **UNKNOWN — not verified**.

## Contradiction check against the existing profile

None found. Every fact this session's searches surfaced (2008 founding date, June 2024/Khordad 1403
food-ordering pivot, Rubika partnership, ZoodFood→SnappFood lineage, the SnappFood address-sync
controversy and the CEO's "technical bug" explanation, the 6,000+/12,500+ restaurant marketing
claims) is consistent with what `profiles/fidilio.md` already states, sourced to the same original
articles (Digiato, Tabnak, Zoomit, Startup360, karangweekly.ir). No new contradiction to report.

## Store facts — status this session

Cannot be independently re-confirmed this session (source unreachable). Carried forward from
2026-09-05 with that date explicit on every figure — **treat as potentially 2+ months stale**, not
re-verified:

| Field | Value | As of | Independent or company-claimed |
|---|---|---|---|
| Rating | 3.7 / 5 | 2026-09-05 (Cafe Bazaar, fetched) | Independent (store aggregate) |
| Review/rating count | 581 | 2026-09-05 (Cafe Bazaar, fetched) | Independent (store aggregate) |
| Installs | 110,000 | 2026-09-05 (Cafe Bazaar, fetched) | Independent (store aggregate) |
| Fidilio's own marketing rating claim | "4.9 stars" | undated, own landing copy (batch 1, search-synthesis) | Company-claimed — **still unreconciled against the 3.7 independent figure** |
| Fidilio's own venue-count claim | "12,500+ restaurants, 10,000+ cafes, 5,000+ bakeries" | undated, own landing copy (search-synthesis) | Company-claimed |

## Complaint themes — honest sample sizes

Given `reviews_read = 0` this session, no new theme can be assigned a sample size drawn from reviews
I personally read. The only themes with any evidentiary basis anywhere in the Scout corpus, and their
**true sample size (6, not 50+)**, are:

| Theme | Count | Sample size | Session that read it |
|---|---|---|---|
| OTP/SMS code length mismatch (6-digit sent, 4-digit field) | 2 of 6 | 6 | 2026-09-05 (fetched, verbatim) |
| Generic "app has bugs / support is bad" | 2 of 6 (علیرضا's review doubles into this bucket too; "arash"/"Ali" from batch 1) | 6 | 2026-09-05 fetched (1) + 2026-09-04 search-synthesis (2, paraphrased) |
| Payment/404 error | 1–2 of 6 (alireza's fetched review; "Ali"'s search-synthesized "user does not exist" may be the same underlying defect class, not confirmed as the same bug) | 6 | 2026-09-05 fetched (1) + 2026-09-04 search-synthesis (1, paraphrased) |
| Mild/neutral ("acceptable") | 1 of 6 | 6 | 2026-09-04 search-synthesis (paraphrased) |

**No praise theme exists anywhere in the corpus.** Zero five-star or positive-leaning verbatim/quoted
review text has been found by any Scout session to date, across 35 queries this session and however
many the 2026-09-04/09-05 sessions ran. This is not evidence that no positive reviews exist among the
575 unread ratings — it is an honest statement that none has been surfaced by any tool available in
any session so far.

## What this means for the audit line

The task's 50-review volume target was **not met** — 6 reviews total are documented across the whole
Scout research line for Fidilio, not 50+. This is a tooling-availability finding, not a
diligence failure: this session ran the full breadth of query variations the task specifies (Persian
+ English, `site:` operators, exact-phrase, per-source targeting for every source named in the task
brief) and confirmed via the `example.com` control that `WebFetch` is blocked platform-wide this
session, not selectively. A future session with working `WebFetch` (as 2026-09-05 had) is the only
way to close this gap — it should paginate past the first-screen review list, which neither fetch
session has done, and it should check Myket and Google Play directly rather than relying on search
synthesis that has never once surfaced content from either.

## Sources (this session)

All accessed 2026-09-07. WebFetch attempts (blocked/failed, listed with error in the table above):
example.com, cafebazaar.ir/app/com.fidilio, amp.cafebazaar.ir/app/com.fidilio, myket.ir/app/com.fidilio,
play.google.com/store/apps/details?id=com.fidilio&hl=fa, apkpure.net/fidilio-cafes-restaurants/com.fidilio.

WebSearch queries: the 35 listed above, reaching only search-engine synthesis of: cafebazaar.ir,
mag.fidilio.com, fidilio.com, digiato.com, tabnak.ir, karangweekly.ir, mopon.ir, gsm.ir, sibirani.com,
appleapps.ir, charkhoneh mag, appreview.ir, instagram.com/fidilio.official (metadata only, no comment
text), trustpilot.com (confirmed no Fidilio page exists), and various unrelated domains sharing the
"Fidilio/Fidelity/Fidibo" string that were correctly excluded as false matches.

## Sources (prior session, cited not re-verified)

`docs/audit/research/profiles/fidilio.md` — full profile and its 2026-09-05 ADDENDUM, which fetched
`https://cafebazaar.ir/app/com.fidilio` directly. See that file for its own full source list.
