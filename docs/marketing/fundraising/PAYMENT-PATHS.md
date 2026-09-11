# PAYMENT-PATHS — lawful ways money could come from outside Iran, and what each costs

**Date:** 2026-09-11 · **Session:** `rezv-3c [8ab843]` (Marketer) · **Target:** the CEO (`rezv-0c
[6a8557]`) · **What it needs:** **counsel**, on every row except A and B. The document makes no
product claims, so there is nothing for the CEO to verify as REAL. The founder decides sequence.

> **Requires review by counsel before action.** This applies to the whole document. I am not a
> lawyer. Everything below is research into what the rules say, with sources. None of it is advice
> that anything is permitted for us.

---

## 0. The recommendation, first

**Earn in rial and raise at home for at least the next stage. Treat foreign revenue and foreign
capital as a later-stage question, and plan as if it stays closed.**

The charter asked me to include this option if it was the strongest. It is, and the environment
got **worse** during the last year, not better:

- **UN sanctions came back.** The E3 triggered snapback on 2025-08-28, and every UN sanction lifted
  under the JCPOA was reinstated on 2025-09-27/28²⁰.
- **The EU followed within two days.** From 2025-09-29/30 it restored asset freezes and sectoral
  measures and put tiered authorisation on fund transfers. EU banks may not open **new** accounts or
  correspondent relationships with Iran-related institutions²¹.
- **US rules were never relaxed.** Any new investment in Iran by a United States person is
  prohibited¹⁰.

**The unpleasant part:** much of the diaspora capital that founders picture when they say "raise
abroad" belongs to people in exactly the jurisdictions above. For them, investing in us is either
prohibited (US persons) or runs through banking channels that are now largely closed (EU). The door
is not locked by our paperwork. It is locked on the investor's side, and nothing we file in Tehran
opens it.

---

## 1. The rules that bind each side

### Our side: Iran

| Rule | What it says | Source |
|---|---|---|
| **Rial is the only lawful payment instrument** | A Central Bank deputy for payment systems and new financial technologies: using crypto, gold or other precious metals **as a means of payment is prohibited**, and substituting them for the national currency is a violation | CBI statement, reported 1404/09/17¹ |
| **Crypto trading only through licensed brokers** | CBI's policy framework for crypto was approved Aban 1403; the rules for founding and running crypto brokers were approved 5 Mehr 1404 | ¹ ² |
| **Crypto in cross-border settlement is narrow** | Per a cabinet resolution, only crypto **mined inside Iran** under the rules may be used, within the import-payment framework | ³ |
| **Foreign capital enters under FIPPA** | *Law on the Encouragement and Protection of Foreign Investment*, 1381. Foreign capital means cash or non-cash capital brought in by a foreign investor (Art. 1). The Organisation for Investment, Economic and Technical Assistance is **the only official body** (Art. 5). A licence is issued after the Foreign Investment Board approves, confirmed and signed by the Minister of Economy (Art. 6). Compensation is at real value immediately before expropriation (Art. 9). Capital and profits may be transferred out only after obligations, taxes and legal reserves are settled and the Board approves (Arts. 13–14), at the day's free-market rate (Art. 12) | ⁴ |
| **Returning export earnings (service exporters)** | The Tax Administration head: service exporters **have no obligation to repatriate foreign exchange for 1402 and 1403**. This came as a tax directive dated 12 Mehr 1403 | ⁵ |
| ⚠️ **The same obligation for 1404 onward** | **UNKNOWN.** I found nothing covering 1404 or later. The 1402–1403 exemption must not be assumed to still apply | — |

### The investor's or customer's side

| Jurisdiction | What binds them | Source |
|---|---|---|
| **United States** | *"any new investment by a United States person in Iran or in property (including entities) owned or controlled by the Government of Iran is prohibited"* (31 CFR §560.207). ITSR also prohibits importing **Iranian-origin services** (§560.206), and a US person **facilitating** a foreign person's transaction that would be prohibited if the US person did it themselves (§560.208) | ¹⁰ ¹¹ |
| ⚠️ **Who is a "United States person"** | **Not read in this pass.** §560.207 applies to "United States persons", and the definition decides which members of the diaspora are covered. **Counsel must confirm it before any conversation with a US-based investor**, and I am not paraphrasing it from memory | — |
| **European Union** | Reimposed 2025-09-29/30 (Council Regulations 2025/1975, 2025/1980, 2025/1982). Fund transfers are tiered: **personal remittances ≥ €40,000 need prior authorisation**; other transfers to Iranian persons **below €10,000 are unrestricted** and **≥ €40,000 need prior authorisation**. **What applies between €10,000 and €40,000 was not stated in the summary I read**, so it is not an unrestricted band by default; transfers for food, health or humanitarian purposes through Iran-related banks need notification at €10,000 and authorisation at €100,000. EU banks may not open new accounts or correspondent relationships with Iran-related institutions, or new branches in Iran | ²¹ |
| **United Nations** | All pre-JCPOA UN Security Council resolutions reapplied from 2025-09-27 | ²⁰ |
| **United Kingdom** | Also reimposed after snapback²². **Details not read in this pass.** Counsel must confirm | ²² |

---

## 2. The options, each with a verdict

| | Path | Status on the Iranian side | Status on the counterparty's side | Verdict |
|---|---|---|---|---|
| **A** | **Rial revenue from Iranian restaurants and diners**, through a licensed domestic payment provider | Lawful. This is the existing plan; `paymentEnabled` stays off at launch by decision | Not applicable | ✅ **Recommended** once payments are switched on |
| **B** | **Domestic capital**: VC, accelerators, licensed crowdfunding (see `INVESTORS.md`) | Lawful. Crowdfunding is licensed under Fara Bourse | Not applicable | ✅ **Recommended**, after launch |
| **C** | **Foreign equity from a non-US, non-designated investor, registered under FIPPA** | Lawful **with a licence** (Arts. 5–6). Capital and profit may leave only after Board approval (Arts. 13–14) | Depends entirely on where the investor sits. For an EU investor, investment is **not banned outright**, but the bank channel is: no new correspondent relationships, and transfers ≥ €40,000 need authorisation. Using a designated bank anywhere in the chain means asset-freeze exposure | 🟡 **Possible later, not now.** Slow, costly, and needs counsel in **both** jurisdictions. Worth revisiting only with traction to show |
| **D** | **Investment from US persons**, including diaspora investors who are US persons | FIPPA would treat it as foreign capital | **Prohibited** under §560.207 unless OFAC grants a licence | ❌ **Rejected**, unless OFAC licenses it. It would expose the **investor**, and asking them anyway would be us creating that exposure |
| **E** | **Selling the product to restaurants abroad** (exporting services) | Lawful as a service export. The repatriation obligation was waived for 1402–1403; **1404 onward UNKNOWN** | US customers: importing Iranian-origin services is prohibited (§560.206). EU customers: not banned outright, but payment channels restricted as in C | 🟡 **Later, and low priority.** Our market is local restaurants; export is not the business |
| **F** | **Crypto** as a payment rail, a revenue currency, or a fundraising vehicle | Using it **as payment: prohibited** (CBI). Trading only via licensed brokers | Whether international exchanges accept Iranian residents: **not measured in this pass**, so I am not asserting it | ❌ **Rejected** as a payment or revenue path. Also rejected for fundraising: a future institutional investor's diligence would treat a crypto-funded cap table as a red flag that no memo can explain away. **Not verified; this is my reasoning** |
| **G** | **A company in a third country that receives foreign money for the Iranian business**, or a nominee or intermediary, **so the investor or bank does not see the Iranian connection** | — | Hides who is paying whom. For a US person, §560.208 prohibits even facilitating it | ⛔ **Rejected: red line.** It works only because it hides the counterparty, and the charter forbids exactly that. A foreign company is not itself the problem. **Using it to hide the connection is.** If one is ever proposed, the test is whether every bank and investor involved would sign off knowing the full picture |
| **H** | **Bringing money in through an unregistered channel** (informal transfers, personal couriers, off-book exchange) | Money that doesn't enter through FIPPA's registered channel **gets no FIPPA guarantees**: no protected right to take capital back out (Arts. 13–14), no compensation if expropriated (Art. 9) | Blocks the investor from proving where their money went. If the purpose is to hide origin, it is the same as G | ⛔ **Rejected.** Even setting legality aside, it hands the investor an unprotected, unprovable stake, and that is not something to offer anyone |

---

## 3. What counsel must confirm before anyone acts on C, D or E

1. **Who counts as a "United States person"** under ITSR, applied to each specific person named as a possible investor.
2. **FIPPA for a startup:** the current licence process through the Organisation, timelines, minimum amounts if any, and whether a software company qualifies without restriction.
3. **The EU authorisation regime in practice:** which member-state authority, how long, and whether any EU bank will currently process the transfer at all. A lawful transfer no bank will carry is not a path.
4. **The 1404+ repatriation obligation for service exporters.**
5. **UK rules after snapback.**
6. **Designation screening:** every bank, exchange and counterparty in any proposed chain, checked against the UN, EU, UK and OFAC lists **at the time of the transaction**, not once.

---

## 4. What this means for the founder

- **No row here unlocks money in the next stage.** Rows A and B are the plan. C and E are for after
  there is a business with rows behind it. D, F, G and H are closed, and three of the four for our
  own reasons, not just the law's.
- **The most valuable thing to say no to early is G.** It is the option most likely to be pitched to
  a founder by someone helpful, and the one most likely to follow the founder's name for years.
- **This changes `THE-ASK.md`.** An ask sized for foreign capital would be sized for money that
  cannot reach us. The ask should be denominated in toman, sized for domestic instruments, and framed
  as project participation first, because that is 61.75% of how this market's money moves (see
  `INVESTORS.md` §1).

---

## Sources

1. [rokna.net — بانک مرکزی: استفاده از رمزارز و طلا به‌جای ریال ممنوع است](https://www.rokna.net/%D8%A8%D8%AE%D8%B4-%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1-%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF%DB%8C-65/1188044-%D8%A8%D8%A7%D9%86%DA%A9-%D9%85%D8%B1%DA%A9%D8%B2%DB%8C-%D8%A7%D8%B3%D8%AA%D9%81%D8%A7%D8%AF%D9%87-%D8%A7%D8%B2-%D8%B1%D9%85%D8%B2%D8%A7%D8%B1%D8%B2-%D8%B7%D9%84%D8%A7-%D8%A8%D9%87-%D8%AC%D8%A7%DB%8C-%D8%B1%DB%8C%D8%A7%D9%84-%D9%85%D9%85%D9%86%D9%88%D8%B9-%D8%A7%D8%B3%D8%AA) [fetched] — same statement as [tasnimnews.com, 1404/09/17](https://www.tasnimnews.com/fa/news/1404/09/17/3466605/) (Tasnim did not resolve from here). The date is taken from the Tasnim URL. The fetch summary's own calendar conversion and its rendering of the speaker's name were **wrong or unclear**, so neither is repeated here
2. [didbaniran.ir — استفاده از رمزارز و طلا به‌جای ریال ممنوع شد؛ اختیارات بانک مرکزی برای تنظیم‌گری رمزپول‌ها](https://www.didbaniran.ir/%D8%A8%D8%AE%D8%B4-%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF%DB%8C-4/255171-%D8%A7%D8%B3%D8%AA%D9%81%D8%A7%D8%AF%D9%87-%D8%A7%D8%B2-%D8%B1%D9%85%D8%B2%D8%A7%D8%B1%D8%B2-%D8%B7%D9%84%D8%A7-%D8%A8%D9%87-%D8%AC%D8%A7%DB%8C-%D8%B1%DB%8C%D8%A7%D9%84-%D9%85%D9%85%D9%86%D9%88%D8%B9-%D8%B4%D8%AF-%D8%A7%D8%AE%D8%AA%DB%8C%D8%A7%D8%B1%D8%A7%D8%AA-%D8%A8%D8%A7%D9%86%DA%A9-%D9%85%D8%B1%DA%A9%D8%B2%DB%8C-%D8%A8%D8%A7-%D9%87%D8%AF%D9%81-%D8%AA%D9%86%D8%B8%DB%8C%D9%85-%DA%AF%D8%B1%DB%8C-%D8%B1%D9%85%D8%B2%D9%BE%D9%88%D9%84-%D9%87%D8%A7) (search)
3. [arzdigital.com — تنها ارز دیجیتال استخراج‌شده داخل کشور در پرداخت‌های ارزی](https://arzdigital.com/blog/iran-central-bank-crypto-not-allowed/) (search)
4. [ekhtebar.ir — متن قانون تشویق و حمایت سرمایه‌گذاری خارجی](https://www.ekhtebar.ir/%D9%82%D8%A7%D9%86%D9%88%D9%86-%D8%AA%D8%B4%D9%88%DB%8C%D9%82-%D9%88-%D8%AD%D9%85%D8%A7%DB%8C%D8%AA-%D8%B3%D8%B1%D9%85%D8%A7%DB%8C%D9%87%E2%80%8C%DA%AF%D8%B0%D8%A7%D8%B1%DB%8C-%D8%AE%D8%A7%D8%B1%D8%AC/) [fetched]. The official copies at `rc.majlis.ir` and `investiniran.ir` did not render for the fetch tool; **counsel should work from the official text**
5. [mehrnews.com — صادرکنندگان خدمات معاف از رفع تعهدات ارزی شدند](https://www.mehrnews.com/news/6245430/) [fetched], 12 Mehr 1403
10. [law.cornell.edu — 31 CFR §560.207](https://www.law.cornell.edu/cfr/text/31/560.207) [fetched, verbatim]. `ecfr.gov` redirected to a bot check
11. [ecfr.gov — 31 CFR Part 560 Subpart B](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V/part-560/subpart-B) (search result naming §§560.206 and 560.208; **the text of those two sections was not read**)
20. [House of Commons Library — The E3 triggers snapback](https://commonslibrary.parliament.uk/research-briefings/cbp-10330/) · [Herbert Smith Freehills Kramer](https://www.hsfkramer.com/notes/fsrandcorpcrime/2025-posts/the-snapback-of-sanctions-on-iran) (search)
21. [Mayer Brown — EU Reintroduces Sanctions Against Iran Following UN Snapback](https://www.mayerbrown.com/en/insights/publications/2025/10/eu-reintroduces-sanctions-against-iran-following-un-snapback) [fetched]. The Council's own press release returned HTTP 403: [consilium.europa.eu, 2025-09-29](https://www.consilium.europa.eu/en/press/press-releases/2025/09/29/iran-sanctions-snapback-council-reimposes-restrictive-measures/)
22. [Covington — Reimposition of UN-Mandated Sanctions and Additional EU and UK Sanctions](https://www.cov.com/en/news-and-insights/insights/2025/10/reimposition-of-un-mandated-sanctions-against-iran-and-additional-eu-and-uk-sanctions) (search, **not read**)

**Method note.** All sources were reached in session `rezv-3c [8ab843]` on 2026-09-11. `[fetched]`
means WebFetch read the page, but **WebFetch returns a small model's summary, not the page itself**:
quoted text may be paraphrased, and in source 1 the summary visibly got a date conversion wrong.
Only source 10 was checked as verbatim regulation text. Every figure a decision would rest on (the
€ thresholds, the article numbers, the 1402–1403 exemption) must be re-read from the primary
instrument by counsel. Sources marked "search" are weaker still: they rest on search-result
synthesis, not on a page I read.
