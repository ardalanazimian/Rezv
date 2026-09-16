# پیشنهاد — بندهای منشور که `FP-007` (و یکی از آن‌ها `FP-006`) نسخ کرده است

**تاریخ:** ۲۰۲۶-۰۹-۱۶ · **نشست:** `rezv-bf [5d7ef7]` · sessionId `74a7ffab-1b16-40ce-8a22-d59415d8f47b` — **بی‌نقش**؛ این یک کارِ مشخصِ CEO (`rezv-23 [131a4b]`) است، نه انتصابِ نقش
**هدف:** CEO → Founder · **تصمیمِ اعمال با Founder است** (`docs/audit/founder/STATE.md` ردیفِ ۹؛ صاحبِ ردیف: CEO)
**چه می‌خواهد:** برای هر بند یکی از سه حکم — *بپذیر / بازنویسی کن / رد کن*. تا آن حکم، `FP-007` حاکم است و متنِ منشورها عقب می‌ماند.

> ⚠️ **این فایل پیشنهاد است، نه ویرایش.** در این کامیت هیچ بایتی از `docs/audit/prompts/**` تغییر نکرده —
> `git show --stat` روی کامیت همین را نشان می‌دهد. منشورها سندِ نقش‌اند و به دستورِ یک هم‌تیمی ویرایش
> نمی‌شوند؛ همان مرزی که Deputy پیش‌تر درست نگه داشت.

---

## ۰. روشِ اندازه‌گیری، تا هیچ نقلی را مجبور نشوی دوباره بسنجی

- **پایه:** `origin/main @ 1d03717` — با `git ls-remote origin refs/heads/main` سنجیده شد، نه از refِ محلی.
  (checkoutِ `Desktop/rezv/Rezv` روی `session/rezv-b3-design` است و `main`ِ محلی‌اش `923a20a`، یعنی عقب.)
- همه‌ی `file:line`ها از همان درخت‌اند و نقلِ متن‌ها **عیناً** از `git show origin/main:<path>`.
- هر «هیچ نیست» یک **کنترلِ مثبت** کنارش دارد، چون در این مخزن `null`ِ کاذب سابقه دارد.
- کارِ من فقط خواندن بود: هیچ منشوری، `main`، `ROUTING.md`، `.claude/**` و `CLAUDE.md` لمس نشد.

---

## ۱. خلاصه — شش بند، و حکمشان یکی نیست

| # | بند | حکم | چرا |
|---|---|---|---|
| A | `launch-engineer.md` §۴ (`:103`–`:133`) | **تعارضِ واقعی با `FP-007`** | عنوانش مالکیتِ **دائمیِ** لِینِ لندینگ را ادعا می‌کند؛ `FP-007` (۱) نوشتن را به طراح داد و برای LE فقط **سنجش** گذاشت (بند ۴). **و یک نقصِ دومِ مستقل:** مسیرِ `web/` که بند رویش بنا شده، در درخت وجود ندارد |
| B | `designer.md` §۱، ردیفِ جدول `:57` | **تعارضِ واقعی** | «Propose. Do not write.» دقیقاً خلافِ دستورِ ۰۹-۱۲ مالک و `FP-007` (۱) |
| C | `designer.md` §۶٫۴ (`:208`–`:209`) | **تعارضِ واقعی، و اجرایی‌ترینشان** | «Propose; the Launch Engineer writes.» — همان حکمِ نسخ‌شده، این‌بار به‌شکلِ کارِ اولِ طراح |
| D | `deputy.md` §۲ (`:53`) | **تعارضِ واقعی — و بدترین شکلش** | «owns the landing layer»؛ و `designer.md:57` همین خط را **به‌عنوان شاهد** نقل می‌کند. دو منشور هرکدام دیگری را گواهِ یک حکمِ نسخ‌شده می‌گیرند: حلقه‌ی بسته |
| E | `backend-engineer.md` §۳ (`:108`–`:109` و `:114`–`:115`) | **تعارضِ واقعی** | هر پنج اپ را یک‌جا به LE می‌دهد؛ `FP-007` (۱)(۲)(۳) آن مالکیت را سه‌تکه کرده |
| F | `reviewer.md` §۰ (`:19`–`:27`) | **تعارض هست — ولی ناسخش `FP-007` نیست** | ناسخِ واقعی `FP-006` (d)(۲) است: بازبین مستقیم به Founder، تا حلقه بسته نشود. ردیفِ ۹ی میز آن را ذیلِ `FP-007` فهرست کرده؛ متنِ جایگزین از `FP-006` و `founder.md` §۱ می‌آید، نه از `FP-007` |

**یک قیدِ مشترک که اگر نادیده گرفته شود، جاروی بی‌دقت خرابش می‌کند:** `FP-007` فقط **بخشی** از این
جدول‌ها را نسخ کرده و سه چیز را صریحاً **تأیید** کرده؛ این سه باید دست‌نخورده بماند:
`apps/*/js/features/**` و `js/data/**` نزدِ Launch Engineer (بند ۲) · `shared/**` با تنها‌نویسنده‌ی
`ds-token-guardian` (بند ۵) · ردیفِ **Web layer**ِ تابلو نزدِ Launch Engineer (بند ۴).

---

## ۲. بند به بند

### A — `launch-engineer.md` §۴ · `docs/audit/prompts/launch-engineer.md:103`–`:133`

**متنِ فعلی (عیناً — سرِ بند و دو پاراگرافِ حاکمش):**

```md
## 4. The landing layer — you own it, permanently

`web/` is not a one-off task. It is a living surface maintained every batch, the same as the panels:
the landing page, `/r/[slug]` restaurant pages, `/c/[city]/[cuisine]` collections, `/events`,
`/for-restaurants`.

**Every batch, do at least one of:** ship a measurable improvement, refresh content that has drifted
from the database, or fix a crawlability or performance regression. Report which, with evidence.
```

**کجا دقیقاً می‌جنگد:**

1. **«you own it, permanently»** در برابرِ `FP-007` (۱): «طراح **طراحی می‌کند و می‌نویسد**: `apps/landing/**`،
   `apps/seo/**`، و UIِ `apps/customer` — به دستورِ مالک، جدیدترین حرف.» مالکیتِ دائمی با واگذاریِ لِین جمع نمی‌شود.
2. **«ship a measurable improvement … or fix a … regression»** در برابرِ `FP-007` (۴): LE «**سنجش، نه طراحی**»
   و «کدِ لندینگ را فقط به سفارشِ طراح یا CEO می‌نویسد». این جمله LE را **هر بَچ** به نوشتن در لِینِ طراح موظف می‌کند.
3. **نقصِ مستقل از `FP-007`:** `web/` در درخت **نیست**. سنجیده: `git ls-tree --name-only origin/main | grep '^web'`
   → صفر خط؛ کنترلِ مثبت: همان دستور با `'^apps'` → غیرصفر. سطحِ واقعی `apps/landing/**` و `apps/seo/**` است.
   هر نشستِ تازه‌ای که این بند را بخواند، دنبالِ مسیری می‌گردد که وجود ندارد.

**متنِ جایگزینِ پیشنهادی (سرِ بند و دو پاراگرافِ اول؛ بقیه‌ی §۴ عیناً می‌ماند):**

```md
## 4. The landing layer — you verify it, the Designer writes it

`apps/landing/**` and `apps/seo/**` are not a one-off task. They are a living surface maintained
every batch, the same as the panels: the landing page, `/r/[slug]` restaurant pages,
`/c/[city]/[cuisine]` collections, `/events`, `/for-restaurants`.

**The lane is ruled by `FP-007`:** the Designer designs *and writes* this surface, by the owner's
2026-09-12 order. You own the **Web layer** scoreboard row (§6) — crawlability, JSON-LD, sitemap,
freshness, deep-link — which is verification, not design. You write code here only on the Designer's
spec or the CEO's order, and you name which one in the delivery.

**Every batch, do at least one of:** prove a standing requirement below still holds, with fresh raw
evidence; add or tighten a guard that makes one of these regressions impossible to merge silently;
or report a drift, crawlability or performance regression to the Designer with `file:line` and the
measurement that caught it. Report which, with evidence.
```

**چه چیزی عمداً دست نخورده می‌ماند:** هشت بولتِ «Standing requirements» (`:113`–`:130`) و «Freshness gate»
(`:132`–`:135`) عیناً — آن‌ها **سنجه**اند نه طراحی، و `FP-007` (۴) صریحاً نزدِ LE نگهشان داشت. گاردِ
freshness هم زیرِ `tools/**` است که «no single owner» دارد: هرکس گارد می‌گذارد، خودش می‌نویسد و
ابطال‌پذیری‌اش را ثابت می‌کند.

---

### B — `designer.md` §۱، ردیفِ جدول · `docs/audit/prompts/designer.md:57`

**متنِ فعلی (عیناً):**

```md
| `apps/landing/**` | **Launch Engineer** (`launch-engineer.md`, and `deputy.md` §2 confirms it) | Propose. Do not write. |
```

**کجا دقیقاً می‌جنگد:** «Propose. Do not write.» نقطه‌به‌نقطه خلافِ `FP-007` (۱) و خلافِ جمله‌ی خودِ مالک در
۰۹-۱۲ است («UPDATE UI UX AND FRONT END DESIGN IN **LANDING** / CUSTOMER PANNEL»). ارجاعِ داخلِ پرانتز هم
به بندِ D اشاره می‌کند که خودش نسخ شده؛ با اصلاحِ این ردیف باید آن ارجاع برود، وگرنه حلقه‌ی بسته می‌ماند.

**متنِ جایگزینِ پیشنهادی:**

```md
| `apps/landing/**`, `apps/seo/**`, and the UI of `apps/customer` | **you** — `FP-007`, from the owner's 2026-09-12 order | Design **and write**. The Launch Engineer verifies the Web-layer row (`launch-engineer.md` §6) and writes here only on your spec or the CEO's order. |
```

**دو ردیفِ همسایه که نباید دست بخورند، و دلیلش در خودِ `FP-007` است:**

- `:62` — `apps/customer/js/features/**` و `js/data/**` نزدِ Launch Engineer «while it is actively there».
  `FP-007` (۲) این را **تأیید** کرده، نه نسخ. پاراگرافِ توضیحی‌اش (`:72`–`:78`) هم با آن می‌ماند.
- `:58` — ردیفِ `ds-token-guardian` (که `apps/landing/app/globals.css` را هم دربر می‌گیرد).
  `FP-007` (۵) تنها‌نویسنده‌بودنش را تأیید کرده.

**و یک ابهامِ کوچک در همین §۱ که با چند کلمه بسته می‌شود** (`:85`) — «goes to the architect first».
`FP-007` (۵) تعریفش کرده: «the architect» یعنی **CEO**، و Founder در ارجاع. پیشنهاد:

```md
decision that goes to **the architect — the CEO** (`FP-007`, escalation to the Founder) — first,
never a convenience.
```

---

### C — `designer.md` §۶٫۴ · `docs/audit/prompts/designer.md:208`–`:209`

**متنِ فعلی (عیناً):**

```md
4. **The landing page as a Gen-Z visitor meets it.** Decision `D-006`: apex goes to landing, but the
   route to the customer app must be short and obvious. Propose; the Launch Engineer writes.
```

**کجا دقیقاً می‌جنگد:** «Propose; the Launch Engineer writes» همان حکمِ نسخ‌شده است، این‌بار در فهرستِ
**کارِ اولِ** طراح. خطرش از بندِ B بیشتر است چون اجرایی‌تر است: نشستِ تازه‌ی طراح که §۶ را به‌عنوان بَچِ اولش
می‌خواند، دقیقاً همین‌جا از نوشتن منع می‌شود — در حالی که مالک خواسته بنویسد.

**متنِ جایگزینِ پیشنهادی:**

```md
4. **The landing page as a Gen-Z visitor meets it.** Decision `D-006`: apex goes to landing, but the
   route to the customer app must be short and obvious. **You write it** (`FP-007`); the Launch
   Engineer verifies crawlability, JSON-LD, sitemap and freshness after it lands.
```

---

### D — `deputy.md` §۲ · `docs/audit/prompts/deputy.md:53`

**متنِ فعلی (عیناً):**

```md
You are not a second Launch Engineer. It fixes product defects and owns the landing layer. You carry
the CEO's overflow so the CEO can stay on judgment and verification:
```

**کجا دقیقاً می‌جنگد:** «owns the landing layer» تکرارِ همان مالکیتی است که `FP-007` (۱) برداشت. ولی
مشکلِ این بند یک لایه عمیق‌تر از بقیه است: **`designer.md:57` این خط را به‌عنوان تأییدِ مستقل نقل می‌کند**
(«and `deputy.md` §2 confirms it»). یعنی دو منشور، هرکدام دیگری را گواهِ حکمی می‌گیرند که هیچ‌کدام منبعش
نیستند — و اگر فقط یکی اصلاح شود، دیگری همچنان «شاهد» دارد. این دقیقاً همان کلاسِ حلقه‌ی بسته‌ای است که
این تیم یک بار بابتش هزینه داده. **پیشنهاد: B و D در یک ویرایش بروند، نه دو تا.**

**متنِ جایگزینِ پیشنهادی:**

```md
You are not a second Launch Engineer. It fixes product defects and **verifies** the landing layer —
`FP-007` gives writing it to the Designer. You carry the CEO's overflow so the CEO can stay on
judgment and verification:
```

---

### E — `backend-engineer.md` §۳ · `docs/audit/prompts/backend-engineer.md:108`–`:109` و `:114`–`:115`

**متنِ فعلی (عیناً — دو ردیفِ جدول و پاراگرافِ `standalone`):**

```md
| `apps/customer`, `apps/business`, `apps/company` | Launch Engineer |
| `apps/landing`, `apps/seo` | Launch Engineer |
```

```md
**`standalone/*.html` is generated** from `apps/*` by `tools/build-standalone.py`. If a change of
yours requires a frontend change, that is the Launch Engineer's — send a spec, do not edit.
```

**کجا دقیقاً می‌جنگد:** این دو ردیف **هر پنج اپ** را یک‌جا به Launch Engineer می‌دهند، در حالی که
`FP-007` مالکیت را سه‌تکه کرده: (۱) لندینگ/سئو/UIِ مشتری → طراح؛ (۲) `js/features/**` و `js/data/**` →
Launch Engineer تا وقتی کارِ باز دارد؛ (۳) پنل‌های business/company → `panels-ui-engineer` زیرِ هدایتِ طراح،
و نقص‌هایشان با Launch Engineer. پاراگرافِ `standalone` هم اسپکِ فرانت را یک‌طرفه به LE می‌فرستد؛ برای
تغییرِ UI گیرنده‌اش امروز طراح است. **اثرِ عملی‌اش کوچک نیست:** این تنها جدولی است که نشستِ Backend
برای «به چه کسی اسپک بدهم» می‌خواند.

**متنِ جایگزینِ پیشنهادی (دو ردیف با سه ردیف عوض می‌شوند):**

```md
| `apps/landing`, `apps/seo`, and the UI of `apps/customer` | **Designer** (`FP-007`) |
| `apps/customer/js/features/**`, `apps/customer/js/data/**` | Launch Engineer, while it has open work there (`FP-007`) |
| `apps/business`, `apps/company` panels | `panels-ui-engineer` under the Designer's direction; their defects through the Launch Engineer (`FP-007`) |
```

```md
**`standalone/*.html` is generated** from `apps/*` by `tools/build-standalone.py`. If a change of
yours requires a frontend change, send a spec — never edit. It goes to the **Designer** for UI, and
to the **Launch Engineer** for `apps/customer/js/features/**` and `js/data/**` (`FP-007`).
```

**دست‌نخورده:** ردیفِ `shared/css`/توکن‌ها (`ds-token-guardian`)، ردیفِ «Design decisions, specs, flows |
Designer»، و ردیفِ `tools/**`/`ci.yml` («no single owner») — هر سه با `FP-007` هم‌خوان‌اند.

---

### F — `reviewer.md` §۰ · `docs/audit/prompts/reviewer.md:19`–`:27`

**⚠️ تصحیحِ سنجیده، پیش از هر چیز:** ردیفِ ۹ی میز این بند را ذیلِ «منشورهایی که `FP-007` نسخشان کرده»
آورده. **`FP-007` این بند را نسخ نکرده** — موضوعش لِینِ لندینگ است و `reviewer.md` هیچ‌جا از لندینگ حرف
نمی‌زند (سنجیده: `grep -n -iE 'landing|apps/customer|apps/seo'` روی `reviewer.md` → صفر خط؛ کنترلِ مثبت:
همان الگو روی `designer.md` → غیرصفر). ناسخِ واقعی **`FP-006` (d)(۲)** است، و متنِ اصلاح را خودِ
`founder.md` §۱ (ردیفِ Reviewer) از قبل دیکته کرده: «target the Founder, copy the CEO; add
`docs/audit/founder/` and the FP-series to its audit scope». پیشنهادِ زیر همان است، نه چیزِ تازه‌ای از من.

**متنِ فعلی (عیناً):**

```md
## 0. Reporting target — the CEO

Everything you produce is reported to **the CEO**, which **is the CEO session** — an
active Claude Code session, not a commit. It is the hub: it reads what you write, verifies it, and
decides. Nothing stays only in your own session.

Mechanically: **write it to disk, then give the founder the one line he needs to route it.** The file
is the record; chat is not. Your folder is `docs/audit/directives/`. Every artifact carries at the top:
date · session name · target the CEO · what it needs from whoever reads it. End every
batch with one copy-paste line naming exactly what the CEO must do with your output.
```

**کجا دقیقاً می‌جنگد:** `FP-006` (d)(۲) بازبین را **مستقیم** زیرِ Founder برد، «تا حلقه بسته نشود» —
بازبین همان چیزی را می‌سنجد که CEO پذیرفته، پس CEO نمی‌تواند هدفِ گزارشش باشد. متنِ فعلی خلافِ آن است.

**متنِ جایگزینِ پیشنهادی:**

```md
## 0. Reporting target — the Founder, copied to the CEO

Everything you produce is reported to the **Founder session**. `FP-006` (d)(2) puts you there
directly so the loop does not close: you audit what the CEO accepts, so the CEO cannot be your
reporting target. Copy the CEO on everything — it stays the hub for orchestration, mandates and
merges. Both are active Claude Code sessions, not commits, and `docs/audit/prompts/ROUTING.md` says
which session each one is right now. Nothing stays only in your own session.

Your audit scope includes `docs/audit/founder/` and the `FP-` series in `docs/DECISIONS.md`: a
Founder decision package is audited exactly like a CEO one (`founder.md` §4).

Mechanically: **write it to disk, then give the owner the one line he needs to route it.** The file
is the record; chat is not. Your folder is `docs/audit/directives/`. Every artifact carries at the
top: date · session name · target (the Founder, copy the CEO) · what it needs from whoever reads it.
End every batch with one copy-paste line naming exactly what the Founder must do with your output —
and a second line for the CEO when it needs an action there.
```

**یک ابهام که عمداً باز گذاشته‌ام، چون تصمیمش با Founder است:** در خطِ «give **the founder** the one line
he needs to route it»، طبقِ پی‌نوشتِ `FP-006` این یک **خطِ رِله** است و رِله نزدِ **انسان** می‌ماند — پس بالا
«the owner» نوشته‌ام. اگر قرارِ Founder این است که خطوطِ رِله هم به نشستِ Founder برسد، همین یک کلمه عوض می‌شود.

---

## ۳. بندهایی خارج از فهرستِ ردیفِ ۹ که با همان دو حکم ناسازگارند

اینها را **اضافه نکردم که فهرست را بزرگ کنم**؛ اگر شش بندِ بالا اصلاح شوند و اینها نه، متنِ منشورها باز هم
خودش را نقض می‌کند. تصمیمِ هرکدام با Founder است و هیچ‌کدام در این پیشنهاد متنِ جایگزین ندارد مگر اشاره:

| بند | چه می‌گوید | چرا امروز ناسازگار است |
|---|---|---|
| `reviewer.md:42` | «give the founder a short Persian summary» | همان ابهامِ انسان/نشست؛ هم‌کلاسِ `:23` |
| `reviewer.md:78`–`:88` («Escalate to the founder — only these six») | شش موردِ ارجاع | `FP-006` (۳) این شش را دو نیم می‌کند: موردهای ۱ و ۲ (پول، حساب‌ها/کلیدها/هویت) **قابلیت**اند و نزدِ مالک می‌مانند (`founder.md` §۳)؛ موردهای ۳ تا ۶ به **نشستِ Founder** می‌روند — و موردِ ۶ (GO/NO-GO) را طبقِ `FP-006` (۴) خودِ Founder امضا می‌کند |
| `reviewer.md:4`–`:12` | «ask the founder» · «you are not the founder» · «Work in Persian with the founder» | سه کاربردِ متفاوتِ یک واژه در نُه خط؛ قاعده‌ی خواندنِ `founder.md` باید یک بار همین‌جا تصریح شود |
| `launch-engineer.md:10` | «keep the landing layer honest and current» | چارچوبش از §۴ می‌آید؛ با بندِ A هم‌زمان اصلاح شود وگرنه سرِ بند و مقدمه دو چیز می‌گویند |
| `launch-engineer.md:218` | «A FAKE feature becomes real, or **the founder** decides — in writing» | تصمیم است نه رِله، پس زیرِ `FP-006` به نشستِ Founder می‌رسد. `FP-006` (c) خودش همین خط را به‌عنوان نمونه نام برده |
| `designer.md:12` · `deputy.md`/`backend-engineer.md` §۰ | ارجاع‌های «founder» در مقدمه‌ها | همان کلاس؛ یک جاروی واحد بهتر از شش اصلاحِ جدا است |

---

## ۴. آنچه نمی‌دانم، و عمداً حدس نزدم

1. **ترتیب و ظرفِ اعمال.** منشورها متنِ پیستِ نشست‌اند؛ ویرایششان روی `main` نشست‌های **باز** را تغییر
   نمی‌دهد (متن قبلاً در contextشان است). اینکه اصلاح‌ها باید با یک اعلانِ جداگانه به نشست‌های زنده هم
   برسد یا نه، تصمیمِ Founder/CEO است.
2. **`designer.md` §۰ و `DS-011`.** دستورِ ۰۹-۱۲ مالک هنوز روی `main` نیست — `session/rezv-ba-design`
   امروز **۱۱ جلو و ۴۵ عقب** است (سنجیده با `rev-list --count`؛ میز عددِ ۴۳ را دارد، که با دو کامیتِ
   امروزِ `main` شده ۴۵). اگر آن شاخه ادغام شود، `docs/audit/design/DS-011-*` و ردیفِ Designer در
   `ROUTING.md` روی `main` می‌آیند و پرانتزِ «هنوز روی main نیست» در `FP-007` (a) باید برداشته شود.
3. **آیا بندِ F اصلاً باید در ردیفِ ۹ بماند؟** به‌نظرِ من ردیفِ ۹ باید دو ردیف شود — یکی زیرِ `FP-007`
   (بندهای A–E) و یکی زیرِ `FP-006` (بندِ F و فهرستِ §۳ بالا) — چون ناسخشان یکی نیست و بازبین باید
   بتواند هر اصلاح را به تصمیمِ درستش وصل کند. ولی این پیشنهادِ ساختارِ میز است، و میز مالِ Founder است.
4. **گاردها.** این فایل فقط سند است و هیچ گاردی را قرمز/سبز نمی‌کند؛ نه ادعایی درباره‌ی CI دارم و نه
   اندازه‌ای گرفته‌ام. `check-doc-staleness`، `check-agent-charter` و `check-control-bytes` را CEO روی
   درختِ ادغام می‌زند، طبقِ شرطِ خودش در ردیفِ ۱ب.
