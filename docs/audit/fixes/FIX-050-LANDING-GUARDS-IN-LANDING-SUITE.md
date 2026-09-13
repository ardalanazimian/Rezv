# FIX-050 — jobِ `landing` قرمز بود، و گاردهای لندینگ در سوئیتی بودند که jobِ لندینگ اجرا نمی‌کند

- **تاریخ:** ۲۰۲۶-۰۹-۱۳ · **نشست:** Launch Engineer `rezv-48 [a55e94]` (sessionId `2bffd0d9-…`؛ نشستِ تازه، نه ادامه‌ی `rezv-d8`)
- **مقصد:** CEO (امروز هیچ نشستِ CEOی زنده نیست — اندازه‌گیری در §۷) · بازبین · Red Team (`rezv-25 [2f4e5c]`)
- **وضعیت:** **fix submitted** — بسته نشده. من نمی‌بندم.
- **آنچه از خواننده می‌خواهد:** اجرای CIِ لینوکس روی کامیتِ همین رفع را بخوانید (نه اجرای ویندوزِ من را) و اگر `landing → Unit tests` سبز بود، ردیفِ ۰۵۰ را ببندید.

---

## ۱. ادعایی که رفع شد

دستورِ ۰۵۰ §۳ و §۵ (`docs/audit/directives/050-ci-has-two-red-jobs-not-one-and-f637948-turned-the-second-red.md`):

- `apps/landing/test/css.test.mts:48-58` زمان‌بندیِ پرده را با regexِ shorthandِ ثانیه‌ای می‌خواند؛ `f637948` CSS را به longhand + `--intro-t` برد؛ regex هیچ نمی‌یافت و تست روی **parse** می‌افتاد. آخرین حکمِ واقعیِ CI: run `34635388552` (`923a20a`) → `landing / Unit tests = failure`؛ و همان روی PR #86 (run `34676427310`).
- حکم: «یک تست، در سوئیتِ لندینگ، که شکلِ تازه را بخواند» و زمان‌بندی از `api/tests/landing-mobile-doors-and-intro.test.mts` بیرون برود.

## ۲. ریشه و کلاس

**ریشه:** یک واقعیت (زمان‌بندیِ پرده) دو نسخه‌ی تست داشت در دو سوئیت؛ نویسنده فقط سوئیتِ `api` را اجرا کرد و نسخه‌ای که قرمز شد در سوئیتی بود که اجرا نشد.

**کلاس:** گاردِ منبعِ `apps/landing` که در jobِ `api` اجرا می‌شود. کسی که روی لندینگ کار می‌کند و `npm test`ِ لندینگ را می‌زند، آن را هرگز نمی‌بیند — و طراح همین حالا (`rezv-ba`) روی همان CSS کار می‌کند.

**sweepِ هم‌خانواده‌ها** (با کنترلِ مثبت — فایلِ معلوم پیدا شد):

```text
git grep -l -E "apps/(landing|seo)/" -- 'api/tests/*.mts'
api/tests/landing-mobile-doors-and-intro.test.mts        ← تنها فایل
git grep -l "api/" -- 'apps/landing/test/*.mts'          ← هیچ
```

یعنی کلاس یک عضو دارد، ولی آن عضو **سه** ادعا دارد: L1 (درهای موبایل)، L3 (`--vel`)، L4 (پرده). حکمِ ۰۵۰ فقط L4 را نام برد؛ L1 و L3 دقیقاً همان نقص‌اند، پس هر سه با هم جابه‌جا شدند.

## ۳. تغییر

| فایل | چه |
|---|---|
| `apps/landing/test/css.test.mts` | تستِ زمان‌بندی شکلِ `--intro-t` را می‌خواند. **بایت‌به‌بایت همان blobِ طراح** در `de1bd72` روی `session/rezv-b3-design` (`5e49943`) — عمداً، تا ادغامِ آن شاخه تعارض نسازد. اعتبارِ این hunk با طراح است |
| `apps/landing/test/ds009-source-invariants.test.mts` | **تازه** — L1 + L3 + L4 از فایلِ api، با دو اصلاح در L4 (§۴) |
| `api/tests/landing-mobile-doors-and-intro.test.mts` | **حذف** |
| `api/tests/_all.runner.mts` | یک خطِ import حذف |

**دو ادعا عمداً منتقل نشدند** چون از قبل در `css.test.mts` هستند: «آخرین تیغه پیش از پرده» و «reduced-motion پرده را حذف می‌کند». یک ادعا، یک تست — همان حکمِ ۰۵۰.

~~⚠️ **یک تضعیفِ آگاهانه:** نسخه‌ی api می‌گفت آخرین تیغه **دقیقاً** در ۱×`--intro-t` تمام می‌شود؛ نسخه‌ی باقی‌مانده فقط **نه دیرتر**.~~
✅ **تصحیح، همان روز (`5e2110e`):** این تضعیف اشتباه بود و برگشت. دو نویسنده‌ی مستقل «دقیقاً» را پین کرده بودند
(`f637948` و رفعِ کامیت‌نشده‌ی §۸)، و کامنتِ `globals.css` همان قصد را می‌نویسد. حالا «نه دیرتر» در `css.test.mts`
و «دقیقاً — نه زودتر» در `ds009-source-invariants.test.mts` است؛ دو ادعای متفاوت، هر کدام یک تست. جهشِ M8
(مدت ۱۱/۲۴ → ۱۰/۲۴) فقط دومی را قرمز می‌کند — یعنی واقعاً ادعای دیگری است.

## ۴. دو سوراخ در گاردِ L4 که پیش از جابه‌جایی بسته شد

1. **«هیچ زمانِ ثابت» هر اعلانی را که `var(--intro-t)` داشت کلاً معاف می‌کرد.** پس `calc(var(--intro-t) * 3 / 10 + 0.1s)` — خودِ «تأخیرِ جفت‌شده»ای که تست برایش هست — سبز می‌شد. حالا دستگیره از متن برداشته می‌شود و هر عددِ زمانیِ باقی‌مانده شکست است؛ تنها استثنا دقیقاً `animation-duration: 10ms`ِ خودِ پرده.
2. **روی رشته‌ی خالی سبز می‌شد.** اگر `.intro {` پیدا نمی‌شد، `slice(-1, …)` چیزی نمی‌داد و «هیچ زمانِ ثابتی نیست» درست بود. حالا نبودنِ بلوک خودش شکست است (قاعده‌ی ۵ی CLAUDE.md)، و اسکن باید دستِ‌کم سه اعلانِ بند به دستگیره ببیند.

## ۵. اثبات (ویندوز، Node 20.20.2 — CIِ لینوکس نیست؛ §۶)

**قرمز پیش از رفع** (روی `923a20a`، worktreeِ تمیز):

```text
cd apps/landing && npx tsx --test --test-force-exit test/*.test.mts
# tests 106 · # pass 105 · # fail 1                       LANDING_TEST_EXIT_BEFORE=1
not ok 4 - زمان‌بندی: آخرین تیغه نباید بعد از intro-off تمام شود
error: 'زمان‌بندیِ تیغه و پرده باید قابلِ‌خواندن باشد'
```

⚠️ `npm test` روی ویندوز **هم** exit 1 داد — ولی به دلیلِ دیگر: cmd.exe گلابِ `test/*.test.mts` را باز نمی‌کند (`Could not find '…\test\*.test.mts'`). آن قرمزِ دروغین کنار گذاشته شد؛ عدد بالا از گلابِ bash است.

**سبز پس از رفع:**

```text
# tests 113 · # pass 113 · # fail 0                        LANDING_TEST_EXIT_AFTER=0
npx tsc --noEmit                                           LANDING_TSC_EXIT=0
npx eslint . --ext .ts,.tsx --max-warnings 0               LANDING_LINT_EXIT=0
```

۱۱۳ = ۱۰۶ + ۷ تستِ منتقل‌شده. سوئیتِ api هشت تست کم کرد (۲ L1 + ۲ L3 + ۴ L4)؛ لندینگ هفت گرفت (دو تکراری نیامد، یک کنترلِ مثبت اضافه شد).

**جهش** — هر کدام یک replace روی منبع، اجرای `css.test.mts` + `ds009-source-invariants.test.mts`، بازگردانیِ بایت‌به‌بایت:

```text
M1 L4 تیغه بعد از پرده تمام شود   (11/24 → 13/24)             exit=1 caught
M2 L4 تأخیرِ جفت‌شده داخلِ calc   (+ 0.1s)                      exit=1 caught   ← regexِ قبلیِ api: نمی‌گرفت
M3 L4 دستگیره ≠ 0.4s              (0.6s)                         exit=1 caught
M4 L4 بلوکِ پرده پیدا نشود        (.intro{)                      exit=1 caught   ← نسخه‌ی قبلی روی رشته‌ی خالی سبز بود
M5 L4 مدتِ ثابتِ ساده              (0.35s)                        exit=1 caught   ← regexِ قبلی هم می‌گرفت
M6 L1 درِ موبایل با پایه‌ی صفر    (flex: 1 1 0; flex-grow: 1)    exit=1 caught
M7 L3 --vel روی <html>             (documentElement.style…)       exit=1 caught
restored byte-identical: true                              MUTATION_EXIT=0
```

**گاردهای مخزن:** `check-runner-completeness` 0 (۱۹۲ فایل، پیش‌تر ۱۹۳) · `check-doc-path-refs` 0 · `check-doc-staleness` 0 · `check-control-bytes` 0 · `check-run-clock-date-keys` 0.

**روی شاخه‌های دیگر** (منابعِ آن شاخه + فایلِ تازه‌ی من):

```text
session/rezv-b3-design (طراح)        pass 20 · fail 0    PROBE_EXIT=0
fix/verified-findings-2026-09 (#86)  pass 19 · fail 1    ← همان css.test.mtsِ کهنه‌ای که روی main قرمز است؛ با ادغامِ main رفع می‌شود
```

## ۶. آنچه **وارسی نکردم**

- **CIِ لینوکس.** همه‌ی بالا ویندوز است. علت regex روی محتوای فایل است، نه مسیر یا حروف، پس انتظارِ همان نتیجه را دارم — ولی انتظار شاهد نیست. حکم با اجرای CI روی کامیتِ همین رفع است.
- **رفتارِ مرورگر.** هر سه ادعا ناوردای منبع‌اند؛ `tools/measure-landing-*.mjs` در CI اجرا نمی‌شوند و من اجرایشان نکردم.
- **سوئیتِ کاملِ api** را اجرا نکردم (فقط همان فایل پیش از حذف: ۴/۴). تغییرِ api فقط حذفِ یک فایلِ بی‌وابستگی و importش است؛ `check-runner-completeness` سبز است.
- **`e2e`** — jobِ قرمزِ دوم — در این رفع نیست؛ جدا در دست است.

## ۷. مسیریابی، اندازه‌گیری‌شده نه حدسی

`ListAgents` در ۲۰۲۶-۰۹-۱۳: دو نشستِ interactive جز من. رجیستریِ harness و پیستِ اولِ مالک در transcriptِ خودشان:

```text
rezv-25 [2f4e5c]  sessionId c07123f9-…   «ACT AS A RED TEAM»
rezv-ba [244468]  sessionId 6c9efba5-…   «WORK ON WEBSITE … APPLE DESIGN + TIK TOK LIVE SCROLL + INSTAHRAM EXOKORE»
```

هیچ‌کدام sessionIdِ CEO (`60c7681b`) نیست. پس امروز **CEOی زنده برای بستن نیست**؛ این فایل تحویل است.

## ۸. همین رفع یک بار پیش‌تر نوشته شده بود — و هرگز کامیت نشد

پس از کامیتِ `a310ddc`، بندِ FP-004 در `docs/DECISIONS.md`ِ شاخه‌ی #86 نشان داد که Launch Engineerِ پیشین
(`rezv-d8`، sessionId `c78bdecd`) همین رفع را در `wt-rezv-a0` **staged** گذاشته بود — ۲۰۲۶-۰۹-۱۱ ۲۲:۴۳ — و نشستش
دیگر زنده نیست:

```text
wt-rezv-a0 @ 923a20a (git status --short)
M  api/tests/_all.runner.mts
D  api/tests/landing-mobile-doors-and-intro.test.mts
M  apps/landing/test/css.test.mts
A  apps/landing/test/doors-and-motion.test.mts
```

**یعنی من کارِ یتیم را دوباره انجام دادم، بدونِ آنکه پیش از شروع بدانم.** کامیتش نکردم (کارِ نشستِ دیگر زیرِ نامِ
من نمی‌رود) و آن worktree را دست نزدم. مقایسه‌ی ادعاها:

| ادعا | نسخه‌ی یتیم | این رفع |
|---|---|---|
| L1 و L3 در سوئیتِ لندینگ | ✅ | ✅ |
| «نه دیرتر» | ✅ | ✅ (blobِ طراح) |
| «دقیقاً — نه زودتر» | ✅ | ✅ از `5e2110e` — از همان‌جا برگشت |
| «هیچ زمانِ ثابت» | همان سوراخِ `var(--intro-t)` معاف | بسته (جهشِ M2) |
| کنترلِ مثبتِ بلوکِ خالی | ❌ | ✅ (جهشِ M4) |

**درسِ روش، برای نشستِ بعدی:** پیش از شروعِ یک رفع، `git status` در worktreeهای دیگرِ همان نقش را بخوان — staged
هرگز در `git log` یا `git grep` دیده نمی‌شود.
