# BRAND — what we stand for, how we sound, and what our identity looks like today

**Date:** 2026-09-17 · **Session:** `rezv-c6 [897f2f]` (Marketer) · **Target:** the CEO `rezv-87 [09dbab]` ·
**Status:** v1 draft, **submitted — not closed** · **Base:** `main = cf60b9c` (the Designer's branch
`session/rezv-ba-design @ 08e1491` was checked too: same tokens, same icons).

**What it needs:**
- **CEO:** verify that every "proof" in §1 still holds in code.
- **Owner:** the identity choice in §3. It does not need the name.
- **Designer:** nothing yet. §3 records the Designer's tokens and does not change them.

**Name-free, deliberately.** `E-001` is open, and the ledger says it is no longer to be asked every
round (`audit/ESCALATIONS.md:134`), so this document does not ask. Where the name would go it writes
⟨NAME⟩. §4 gives the owner criteria, not candidates, plus one measured cost.

**Builds on, does not repeat:** `POSITIONING.md` (the one true thing, the three sentences, the voice
rules). This file turns those into a brand platform, a tone guide with before/after examples taken
from our own live copy, and the visual-identity facts.

---

## 0. The recommendation first

**Brand idea: «روراست».** In English: *we tell you before it costs you.*

It is the only brand idea we can prove in code today, and it is the one the market lacks:
- RSEE takes a paid credit from the diner and keeps up to all of it on a late cancellation
  (`docs/audit/research/ANTI-PATTERNS.md` #3).
- Every POS suite hides its reservation price behind «تماس بگیرید»
  (`research/COMPETITORS-IRAN-2026-09-16.md` C.3).
- The dominant app sells on discounts (`research/COMPETITORS-IRAN-2026-09-16.md`, Foodro).

«روراست» is a word a 22-year-old in Tehran actually uses about a person. It is not a word a company
uses about itself, which is the point.

**The price of choosing it:** a straight-dealing brand is destroyed by one caught exaggeration. Our
own public pricing page already has three (`BUSINESS-MODEL.md` §0-b: «هوشمند» on a rule engine, a
gift card whose flag is off, "every plan is the full product" next to tiered cards). The CEO has routed
the fix. **Nothing public should carry this brand idea until that fix ships.** Otherwise the first
reader who checks becomes our first counter-example.

---

## 1. Brand platform

| | |
|---|---|
| **Why we exist** | Booking a table in Iran runs on DMs, phone calls, and one app that makes the diner pay up front. Restaurants lose covers to no-shows, and diners lose money to rules they were never shown. |
| **What we do** | A booking, waitlist and customer-club platform. The restaurant pays a flat subscription, and the diner pays nothing to book (`BUSINESS-MODEL.md` §0). |
| **Brand idea** | **«روراست»**: we tell you before it costs you |
| **Personality** | Plain-spoken, exact, warm, a little dry. A friend who works in the industry, not a salesperson |
| **Not** | Hype, «هوشمند», "revolution", discounts as identity, urgency tricks |

### Three values, each with its proof and its line we never cross

A value with no proof in the product is a slogan. Every proof below cites code or a decision, and the
CEO re-verifies it (REAL-STATIC at most, per the CEO's 2026-09-16 rule).

| Value | What it means in practice | Proof today | Never |
|---|---|---|---|
| **۱. روراست** (say it before it costs) | Any cost, forfeiture or reliability mark is shown **before** the diner commits | The disclosed-before-charged path (`POSITIONING.md` §1). **INTERNAL ONLY** until the CI guard pins it (`POSITIONING.md` §1, BE-004) | A fee, penalty or points deduction the diner saw only afterwards |
| **۲. مالِ خودت** (your club is yours) | The restaurant's guests and data belong to the restaurant. We don't sell or share them, and we don't market to them for anyone else. **Public wording, CEO ruling 2026-09-17:** only «مشتری‌هاتون رو در پنلِ خودتون می‌بینید». No export exists or is planned for launch, so never «با خودتون ببرید» | `restaurantId`/`tenantId` come only from the auth context, never from the request (`CLAUDE.md`, backend conventions; `POSITIONING.md` §2). Never selling guest data is a stated model choice (`BUSINESS-MODEL.md` §6) | Selling or sharing guest data. Using one restaurant's guests to promote another |
| **۳. سازوکار، نه صفت** (mechanism, not adjective) | We name what the thing does, not how great it is | The code itself refuses the word "AI" for its rule engines (`api/src/lib/pricing.ts:1-10`, `api/src/lib/assistant-nlu.ts:4`) | «هوشمند», "AI", «بهترین», «اولین», «بی‌نظیر» without a model or a source |

---

## 2. Voice and tone

The rules live in `POSITIONING.md` §4 (mechanism not adjective, real Persian, short sentences, no
exclamation marks, no emoji in owned copy, never name a competitor). This section adds **tone by
context** and **before/after examples from our own live copy**.

### Tone by context

| Context | Tone | Example direction |
|---|---|---|
| Diner app, normal flow | Brief, friendly, informal («تو») | «میزت رزرو شد. تا ⟨مهلتِ همین رستوران⟩ قبلش لغو کنی، چیزی کم نمی‌شه.» (the deadline comes from the restaurant's policy and is never hard-coded) |
| Diner app, money or rules | Slower, exact, numbers first | The amount, the deadline, what happens after. Never a soft word in place of a number |
| Restaurant panel | Colleague to colleague, formal-light («شما»), no marketing | Error vocabulary already exists (`docs/audit/design/DS-003-panel-error-vocabulary.md`), so follow it |
| Restaurant pitch | Money first, then proof, then price | «مهمانِ رزروکرده‌ای که نیاد، میزِ خالیه. ما قبل از اینکه بیاد یادش می‌ندازیم.» (the claim needs SMS delivery proven first) |
| Investor | Mechanism and evidence tier on every number | `research/*` classes (REAL / CLAIMED / SECONDARY / UNKNOWN) go into the document itself |

### Before → after, from copy that is live today

| Live now | «روراست» version | Why |
|---|---|---|
| «قواعدِ قیمتِ هوشمند و حداقلِ خریدِ پویا» (`api/prisma/seed/site-content.json`, m12) | «حداقلِ خرید بر اساسِ روز و ساعت، با پیشنهاد از روی رزروهای خودتان» | Value ۳: it names the mechanism |
| «امتیاز، کش‌بک و کارتِ هدیه» (m6) | «کسبِ امتیاز و کش‌بک» (spending points and gift cards come back when their flags are on) | Value ۱: we don't sell what's switched off. The CEO's rule (STATE row M-12, `session/rezv-87-ceo @ 76a431e`): earning is real, spending is off (FP-008), and the copy must say which |
| «تفاوتِ پلن‌ها در مدت و سطحِ پشتیبانی است…» next to tiered cards (`apps/landing/app/pricing/page.tsx:134-137`) | One of the two has to change (`BUSINESS-MODEL.md` §7.2) | A brand built on straight dealing can't contradict itself on its price page |
| «بازبینیِ فصلیِ عملکرد با تیمِ رزرونو» | «بازبینیِ فصلیِ عملکرد با تیمِ ما» | Name-free, and the service needs an owner |

The first three rows repeat `BUSINESS-MODEL.md` §0-b on purpose. There they are an honesty finding;
here they are the tone guide's reference examples. The CEO has already routed the fix, so this table
proposes copy and edits nothing.

### Word list

| Don't | Unless | Instead |
|---|---|---|
| هوشمند · AI · هوش مصنوعی | A trained model does the work, and the CEO confirms it | Name the rule: «بر اساسِ رزروهای ۹۰ روزِ گذشته» |
| بهترین · اولین · بی‌نظیر · انقلاب | Never. We have no source for a superlative | Say the fact |
| رایگان | It's true with no condition, or the condition sits in the same sentence | «رزرو برای مهمان رایگانه» ✔. True in code while deposits are off (`BUSINESS-MODEL.md` §1 R7, §5). The day a restaurant can require a deposit, the sentence has to name that condition |
| فقط امروز · آخرین فرصت | Never. Urgency is the discount apps' voice, not ours | — |
| Any number | It has a source class and a date | «UNKNOWN» internally; outside, leave the number out |

---

## 3. Visual identity — the measured state, and the one decision it needs

**Nothing here is a new design.** The Designer owns `shared/css` and the direction document
(`docs/audit/design/DS-010-direction-apple-tiktok.md`, "Apple + TikTok/Instagram"). This section
records what exists and names the decision that belongs to the owner.

| Surface | What it shows today (`cf60b9c`, same on `session/rezv-ba-design @ 08e1491`) |
|---|---|
| Design tokens (`shared/css/tokens.css:84-86`) | `--brand-500: #4F46E5`, `--brand-600: #4338CA`, `--brand-400: #6A4BFF`, all indigo |
| Customer app icon (`apps/customer/favicon.svg`; `icon-192.png` / `icon-512.png` now exist) | A «ر» glyph on an indigo gradient that matches the tokens |
| Landing icon (`apps/landing/public/icon.svg`) | `#6366F1 → #7C3AED → #E8925A`, a third palette that matches neither |
| Landing site palette (most frequent hex literals in `apps/landing/app` CSS; counts are small, so the Designer's DS-009 is the fuller source) | Warm: `#ddb457` gold, `#f07f4d` / `#e2612c` orange, `#17120f` near-black |
| Type | Vazirmatn, self-hosted (`shared/fonts/`). Google Fonts is banned because it isn't reachable in Iran (`CLAUDE.md`) |

**So today the product has two visual identities** (indigo app, warm landing) **and three marks.**
Directive 025 §2 raised this on 2026-09-07 and left it to the owner. The PWA icons it asked for have
since shipped. The identity question has not moved.

**Why it matters to the brand:** a restaurant owner sees the warm landing, signs up, and gets an
indigo panel. A diner installs an indigo app and then meets the warm site. For a brand whose whole
idea is "no surprises", the first surprise is visual.

**Options for the owner. The Designer carries out whichever is chosen:**

| Option | What changes | Cost | Marketer's view |
|---|---|---|---|
| **A. Indigo everywhere** | The landing moves to the tokens, and one «ر» mark everywhere | Landing restyle, the largest diff (the Designer can size it) | Cleanest. It matches what users hold in their hand |
| **B. Warm everywhere** | The tokens and both apps move to the warm palette | Touches every app and the design system. Highest risk in launch week | Not now |
| **C. A deliberate split with one mark** | The palettes stay, one mark is shared, and the rule becomes "product indigo, marketing warm" | Smallest: replace `apps/landing/public/icon.svg` with the «ر» mark | **Leaning C for launch, A after**: it removes the three-mark problem for the price of one file |

---

## 4. The name — criteria, and one measured cost (no question asked)

**Criteria any name should pass** (for whenever the owner decides):
1. Said the same way in Persian and Latin script, with no ambiguous vowel.
2. A `.ir` domain that can actually be registered.
3. Not confusable with RSEE / آرسی, Snapp / اسنپ, or any name in `research/COMPETITORS-IRAN-2026-09-16.md`.
4. No «هوشمند» or "smart" in it (value ۳).
5. It survives the «روراست» test: it promises nothing the product doesn't do.

**Measured cost of waiting.** The working name «رزرونو» appears on **344 lines in 149 files** under
`apps/` and `shared/` (`git grep -c -F "رزرونو" cf60b9c -- apps shared`, 2026-09-17), plus 49 lines
of `rezervno`. This is not a reason to decide faster. It is recorded so that whoever decides knows the
rename cost grows with every screen shipped. A rename pass should replace the string with one config
value rather than edit 149 files, and that is a question for the Implementation Team whenever the
time comes.

---

## 5. Guardrails for owned channels (Instagram, Telegram, SMS)

The charter already bans dark growth, competitor disparagement and unverified claims
(`docs/audit/prompts/marketer.md`). Brand-specific additions:

- **Show the screen, not the adjective.** Every product post carries a real screenshot of a
  REAL-STATIC-or-better feature. No renders of screens that don't exist.
- **Every post that mentions money shows the rule next to it:** the amount, the deadline, what
  happens if you cancel.
- **Our SMS sounds like the product, not like an SMS panel:** opt-in only, frequency-capped, quiet
  hours, the same rules the product enforces in code (charter, Workstream 4).
- **A post is in brand only if we could defend it line by line in front of someone with repo access.**

---

## 6. What this document needs

1. **Owner:** §3 option A, B or C. My lean is C now, A later. Also: confirm or replace the brand idea
   «روراست».
2. **CEO:** re-verify §1's proof column. Keep value ۱ INTERNAL ONLY until the §1 guard from
   `POSITIONING.md` exists.
3. **Implementation Team (routed by the CEO, already in motion):** the pricing-card copy. §2's
   examples depend on it.
4. **Designer:** only if the owner picks A or C, to replace the landing icon or restyle.

---

**Line for the CEO:** «Marketer `rezv-c6` → `docs/marketing/BRAND.md` v1 (submitted): ایده‌ی برند
«روراست» — قبل از اینکه هزینه‌ای داشته باشد می‌گوییم؛ سه ارزش با proof در کد؛ راهنمای لحن با
قبل/بعد از متنِ زنده؛ هویتِ بصری: دو پالت و سه نشان (توکن‌های indigo، آیکونِ لندینگ پالتِ سوم) —
سه گزینه برای مالک، تمایلِ من C؛ نام بی‌سؤال، فقط معیار و هزینه‌ی سنجیده (۳۴۴ خط در ۱۴۹ فایل).»
