# INVESTORS — the map, and the honest read of where we sit on it

**Date:** 2026-09-10 · **Session:** `rezv-64 [a6b4b0]` (Marketer) · **Target:** the CEO
(`rezv-cf [97a8f9]`) · **What it needs:** nothing verified against the product — this document makes
**no product claims**. What it needs from the founder is a decision about *sequence*, in §6.

**Status: v1, research-only.** No investor is contacted, ever, by me. This is a map, not an outreach
plan. Every figure below carries its source; every gap is marked `UNKNOWN`, not estimated.

---

## 0. Read this before the list — the recommendation is not "here are the investors"

**We are, today, not fundable by an institutional Iranian VC, and the list below is not the reason.
The reason is us.** Measured facts, from this repo and the CEO's own commits:

| | Fact | Source |
|---|---|---|
| Users | **Zero.** No production deployment exists; the laptop is the target machine, not a running one | `044c5bc` |
| Product | Pre-launch. A live promise in the UI («۵۰۰ امتیاز» referral) is **never paid** by the code | A1-005 |
| Name | Not settled | `E-001` |
| Domain | Not bought; `rezervno.ir` is NXDOMAIN | `E-001` |
| Revenue | None. Payment path deliberately off at launch (`paymentEnabled` off by decision) | `marketer.md` §W2 |

An Iranian VC's due-diligence stage alone averages **35 days** and the whole process **107 days**¹.
A fund that spends 107 days on us today would be diligencing a repository, not a business. **The
first round is not the next step. Launch is.**

I am writing this at the top rather than in a footnote because the charter's job #1 is "raise
capital," and the honest answer to job #1 this week is *"not yet, and here is what makes it yes."*
Producing a polished investor list that implies readiness would be the most damaging thing this
document could do.

---

## 1. What is actually being deployed in this market

Source: **Iran Venture Capital Association, annual report for 1403**, as reported by Zoomit².

```text
۱۶٬۱۶۹ میلیارد تومان   total VC contracts in 1403 — a 5× increase YoY
  ۱۱٬۴۳۶ (۷۰.۷٪)      direct VC
   ۳٬۴۸۹ (۲۱.۶٪)      project participation, NO equity taken
   ۱٬۰۰۰ ( ۶.۲٪)      indirect, via funds

۲۱۶ deals            direct VC contracts
~۵۳ میلیارد تومان     average deal size
۱۰۷ days             average process (۲۱ screening · ۳۵ DD · ۱۹ contract · ۹ to first payment)
```

**Deal structure — this is the most actionable line in the whole report:**

| Instrument | Share |
|---|---|
| Project participation (no equity) | **61.75%** |
| Equity | 34.44% |
| Convertible note | 2.48% |
| Royalty-based | 1.33% |

**Read that carefully.** The majority of Iranian "venture capital" is **not equity investment** — it
is project participation where no shares change hands. A founder who walks in expecting a Silicon
Valley equity round is asking for the *minority* instrument. This is the single most useful fact I
found, and it should shape `THE-ASK.md` before a number is written in it.

**⚠️ A unit inconsistency in the source, flagged rather than smoothed over.** The report gives
totals in **میلیارد تومان** and the top-investor table in **میلیارد ریال**. I have not converted
them silently. Before any of these figures enters a deck, one person should re-derive them from the
Association's own PDF, because a 10× unit error in an investor document is unrecoverable.

**Top investors by volume (as published, in میلیارد ریال²):**

| Investor | Volume |
|---|---|
| حرکت اول (Harkat Aval) | ۴۳٬۰۳۹ |
| پگاه داده‌کاوان شریف / **تپسل** (Tapsell) | ۳۵٬۰۰۰ |
| **شناسا** — پیشگامان امین سرمایه پاسارگاد | ۱۱٬۵۵۰ |

**Sector note, and it is not in our favour:** machinery & equipment took **34%** of facilities
disbursed; AI took **0.6%**². Consumer marketplace software is not where this money is going.

---

## 2. Named investors — VC funds and holdings

Primary directory source: `ecosystem.ir`'s investor registry³. **Every "check size / stage / what
they ask" cell below is `UNKNOWN` unless stated — I did not find published terms for any Iranian
fund, and I am not estimating them.**

| Organisation | Type | What is actually known | Check size | How to reach |
|---|---|---|---|---|
| **سرآوا پارس** (Sarava Pars) | VC | Iran's best-known VC; funded **آواتک**, the country's first internet accelerator⁴. Also the subject of a public controversy its founder addressed directly⁵ — an investor with a political history is a consideration, not a disqualifier, and the founder should read ⁵ himself | UNKNOWN | `saravapars.com` |
| **شناسا** (Shenasa) — پیشگامان امین سرمایه پاسارگاد | Corporate VC (Pasargad Financial Group) | **3rd largest deployer in 1403**². Twelve years in the ecosystem⁶. Backed by a bank group — the most institutionally "real" money on this list | UNKNOWN | `shenasa.ir` |
| **تپسل / پگاه داده‌کاوان شریف** | Corporate VC | **2nd largest deployer in 1403**² | UNKNOWN | UNKNOWN |
| **حرکت اول** (Harkat Aval) | UNKNOWN | **Largest deployer in 1403**² — and I could not establish what it is. **This is the single biggest research gap in this document** | UNKNOWN | UNKNOWN |
| **صندوق نوآوری و شکوفایی** | Government fund | Runs recurring open **fundraising events** startups apply to⁷ — a published, non-relationship-gated door, which is rare here | UNKNOWN | `inif.ir` |
| **صندوق سرمایه‌گذاری جسورانه یکم دانشگاه تهران** | University VC fund | Listed³ | UNKNOWN | UNKNOWN |
| **صندوق یکم آرمان آتی** · **صندوق توسعه فناوری‌های نوین** | VC funds | Listed³ | UNKNOWN | UNKNOWN |
| **مکث هولدینگ** (Karaj) · **تکوست** · **اُپاتان** · **صانرژی** | VC / tech investors | Listed³, no further detail found | UNKNOWN | UNKNOWN |
| **توسعه کارآفرینی بهمن** | Corporate | States a venture-investment and research-commercialisation mandate³ | UNKNOWN | UNKNOWN |
| **توسعه تجارت الکترونیک کوروش** | Corporate | Put **۷۵ میلیارد تومان** into TapsiFood + TapsiDoctor⁸ — a named, dated, food-adjacent cheque, and the closest comparable transaction I found | ۷۵ میلیارد (that deal) | UNKNOWN |

## 3. Accelerators

| Name | What is known |
|---|---|
| **آواتک** (Avatech) | Iran's first internet-startup accelerator, founded 2014, Sarava-backed⁴ |
| **دیموند** (Dmond) | General accelerator with named verticals including **retail** and **fintech**³ — the closest sector fit to us on this page |

Accelerators are the honest first door for a pre-launch, zero-user company. **Terms, cohort dates and
equity taken: `UNKNOWN` for both.** That is the first thing to establish if the founder wants this path.

## 4. Licensed equity crowdfunding — the most regulated, most checkable door

Iran has a **licensed** crowdfunding regime supervised by **سازمان فرابورس ایران** (Iran Fara Bourse).
Platforms operating with a certificate include⁹:

```text
آی‌بی‌کراد · هم‌آفرین · حلال‌فاند · کارن‌کراد · دونگی · آی‌فاند · کاریزما کراد
هم‌آشنا · استارتامین · مسکن‌پلاس · اینوستوران · ققنوس · زرین‌کراد · زیما · رایان · رضوی · پولسار
```
(17 named; the source states the full list runs to 34.)

**Two facts that matter more than the list:**
- The financing ceiling for licensed platforms was **raised**¹⁰ — the regime is expanding, not contracting.
- Sector performance in the first four months of 1405 was **+120% YoY**¹¹.

**Verification requirement, non-negotiable:** a platform's licence must be confirmed **against Fara
Bourse's own registry**, never against the platform's own marketing page. Several of the sources
above are commercial blogs with an incentive to list generously. *"Requires review by counsel before
action."*

## 5. Angels and diaspora — an honest gap

**`UNKNOWN`.** I found no verifiable Iranian angel-network registry in this pass. Diaspora capital is
covered in `PAYMENT-PATHS.md`, not here, because it is primarily a **legal** question rather than an
investor-discovery one — and per the charter, anything that only works by obscuring who is paying
whom is written down as rejected, not proposed.

**One structural note the founder should hear from me rather than from an investor:** Iranian founders
and capital have been leaving⁵ᵃ. That affects who is still deploying domestically and on what terms.
I have not researched it enough to say more, and I am not going to characterise it from one article.

---

## 6. The recommendation — and the sequence

**Do not raise now. Raise after launch, and let the launch be the pitch.**

1. **Close `E-001`.** One founder sentence. Not because fundraising needs the name — because *every*
   downstream artifact does, and it has been open two days.
2. **Fix what a diligence would find.** The referral promise the code never pays (A1-005) is the
   clearest example: an investor who greps the repo finds a live UI promise with no payer. That is
   not a bug in a diligence room, it is a character question. Removing the false promise is not
   blocked on `E-002`.
3. **Ship, and get real rows.** 216 deals were done in 1403; not one of them, on the evidence, went
   to a repository with zero users.
4. **Then target in this order** — accelerator (**دیموند**, retail vertical) or the **صندوق نوآوری و
   شکوفایی** open call, both of which have doors that are not relationship-gated; then licensed
   crowdfunding; then institutional VC.
5. **Frame the ask as project participation, not equity, unless a fund asks otherwise.** 61.75% of
   this market's money moves that way. Asking for the market's minority instrument by default is a
   self-inflicted wound.

**What I need before v2:**
- **Founder:** is raising *now* a constraint I should design around (runway), or a preference? The
  answer changes this document completely, and I would rather be told than infer it.
- **CEO:** nothing. This document makes no product claims, so there is nothing here for you to
  verify as REAL. That is deliberate.
- **Counsel:** every crowdfunding and any non-domestic path. *Requires review by counsel before action.*

---

## Sources

1. Iran VC Association 1403 report, process-duration breakdown — via ²
2. [zoomit.ir — گزارش اکوسیستم VC ایران ۱۴۰۳](https://www.zoomit.ir/tech-iran/450368-iran-vc-ecosystem-report-1403/) [fetched 2026-09-10]
3. [ecosystem.ir — فهرست سرمایه‌گذار](https://ecosystem.ir/legal/role/9/) [fetched 2026-09-10]
4. [shanbemag.com — روایت سرآوا](https://shanbemag.com/saeed-rahmani-talks-about-the-formation-of-sarava/)
5. ibid. — the founder's own account of the controversy · 5a. [digiato.com — سرمایه‌های تبعیدی](https://digiato.com/iran-technology-news/immigration-investors-entrepreneurs-iran-startup-ecosystem)
6. [shenasa.ir](https://shenasa.ir/)
7. [inif.ir — رویداد جذب سرمایه](https://www.inif.ir/fullcontent/-/asset_publisher/YASjeuXFqbaQ/content/id/501342)
8. [digiato.com — سرمایه‌گذاری ۷۵ میلیاردی تپسی‌فود](https://digiato.com/finance-investment/invest-tapsifood-tapsidoctor)
9. [myindustry.ir — لیست سکوهای تامین مالی جمعی](https://myindustry.ir/crowd-funding-platforms-iran/) [fetched 2026-09-10] · [noviraco.com](https://noviraco.com/list-crowdfundings/)
10. [kuknos.ir — افزایش سقف تأمین مالی جمعی](https://kuknos.ir/the-financing-ceiling-for-licensed-platforms-was-increased/)
11. [tejaratnews.com — برترین سکوها، ۴ ماه نخست ۱۴۰۵](https://tejaratnews.com/)

**Method note:** every source above was reached with `WebSearch` and, where marked `[fetched]`,
read directly with `WebFetch` in session `rezv-64 [a6b4b0]` on 2026-09-10. Sources 4, 5, 5a, 6, 8,
10 and 11 rest on search-result synthesis, **not** on a page I read end-to-end — weaker evidence,
marked as such, in the same convention `MATRIX.md` adopted in its batch 3.
