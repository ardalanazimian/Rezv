# FIX-051 — `main` حکمِ CI نمی‌گرفت، و jobِ e2e حتی سبز هم در سقفش جا نمی‌شد

- **تاریخ:** ۲۰۲۶-۰۹-۱۳ · **نشست:** Launch Engineer `rezv-48 [a55e94]`
- **مقصد:** CEO · بازبین (نویسنده‌ی ۰۵۱) · مالک
- **وضعیت:** **fix submitted** — و **فقط parse شده، اجرا نشده**. GitHub Actions محلی اجرا نمی‌شود؛ اثباتِ واقعی اولین اجرای CI روی `main` پس از ادغام است.
- **آنچه از خواننده می‌خواهد:** پس از ادغام، اجرای بعدیِ `main` را بخوانید: هر ۱۴ job باید **completed** باشند (سبز یا قرمز)، هیچ‌کدام `cancelled`، و e2e سه job داشته باشد.

---

## ۱. ادعاها

**دستورِ ۰۵۱** (`docs/audit/directives/051-docs-pushes-cancel-code-ci-on-main-and-the-obvious-fix-skips-three-guards.md` §۵):
به ترتیب — اول `timeout-minutes` برای هر job، **بعد** `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`.
مالک: «هر کسی که CEO برای ci.yml تعیین کند» — CEOی زنده نیست؛ ردیفِ بی‌صاحب بود. همین شکاف از
round-16 هم باز مانده بود: **A6-015** «۱۰ از ۱۲ jobِ CI هنوز timeout-minutes ندارند».

**jobِ e2e** (دستورِ ۰۵۰ §۶: «در صفِ Launch Engineer»): در هر اجرای اخیر `cancelled` روی قدمِ «Run E2E tests»
پس از ~۱۴۶۰ ثانیه — یعنی سقفِ ۲۵ دقیقه. هیچ‌وقت حکم نداد.

## ۲. اندازه‌گیری، نه حدس

**مدتِ jobهای موفق** — ۸ اجرای completedِ اخیر، `api.github.com`:

```text
base-freshness 4–5s · boot-path 141–156s · build 55–66s · design-system 10–17s · image-build 58–62s
observability 10–19s · rejects-ratchet 5–9s · schema-drift 194–202s · security 24–29s · seo 28–36s
standalone 6–7s · test 159–258s · landing: هیچ اجرای موفقی در بازه (از f637948 قرمز) · e2e: هرگز تمام نشد
```

**e2e، محلی روی `923a20a`** (ویندوز، `CI=true`، ۲ worker، `--retries=0`، هر سه پروژه):

```text
582 tests · 558 passed · 2 skipped · 22 failed/timedOut · wall 41.8m          PW_EXIT=1
مجموعِ مدتِ تست‌های سبز 2598s  → با ۲ worker ≈ ۲۲ دقیقه — حتی سوئیتِ کاملاً سبز لبه‌ی سقف است
مجموعِ مدتِ ۲۲ شکست     2238s  → ۹ تستِ booking-context هر کدام سقفِ ۱۸۰ ثانیه
با retries: 2 در CI هر شکست ۳ بار ⇒ فقط شکست‌ها ~۵۶ دقیقه
```

پس دو علت، هر دو واقعی: (الف) تست‌های واقعاً قرمز که retry ضربشان را سه برابر می‌کند؛ (ب) نبودنِ ظرفیت حتی در حالتِ سبز.
این رفع (ب) را می‌بندد. (الف) در `FIX-E2E-B01-RUN-CLOCK.md` و بدهیِ DS-007 روی شاخه‌ی طراح است.

## ۳. تغییر (`.github/workflows/ci.yml`)

| | پیش | پس |
|---|---|---|
| jobهای دارای `timeout-minutes` | ۲ از ۱۴ (`test` ۱۵، `e2e` ۲۵) | **۱۴ از ۱۴** — هر کدام ~۳–۵ برابرِ بیشینه‌ی اندازه‌گیری‌شده (کف ۱۰؛ `landing` ۲۰ چون اجرای موفقِ اخیر ندارد) |
| `cancel-in-progress` | `true` همه‌جا | `${{ github.ref != 'refs/heads/main' }}` — شاخه/PR لغو، `main` هرگز |
| e2e | یک job، هر سه پروژه | `strategy.matrix.project: [mobile-safari, mobile-chrome, desktop-chrome]`، `fail-fast: false`، ۲۵ دقیقه **به‌ازای هر پروژه** |
| `measure-home-s1` (DS-007) | در همان job | فقط در `mobile-chrome` — ابزار viewport و مرورگرِ خودش را می‌سازد |
| گزارشِ Playwright | `playwright-report` | `playwright-report-<project>` (سه آرتیفکت با یک نام برخورد می‌کردند) |

⚠️ **شمارشِ ۰۵۱ «۱۶ job» بود؛ فایل ۱۴ دارد.** اسکریپتِ ویرایش مجموعه‌ی jobها را از خودِ فایل شمرد و روی
هر ناهم‌خوانی با فهرستِ سقف‌ها خطا می‌داد. (شمارشِ دستیِ من هم یک بار ۱۳ درآمد — `[a-z-]` نامِ `e2e` را نمی‌گیرد.)

**چرا ماتریس اجازه دارد نامِ check را عوض کند:** `main` محافظت‌نشده است و هیچ required checkی ندارد
(`api.github.com/repos/…/branches/main` → `protected: false`, `contexts: []`؛ rulesets: `[]`).

## ۴. اثبات — آنچه واقعاً هست

```text
node ci-051.mjs                       CI_EDIT_EXIT=0   jobs: 14 · timeouts inserted: 12
js-yaml parse                         PARSE_EXIT=0
  jobs 14 · all have timeout: true
  concurrency: {"group":"ci-${{ github.ref }}","cancel-in-progress":"${{ github.ref != 'refs/heads/main' }}"}
  e2e strategy: {"fail-fast":false,"matrix":{"project":["mobile-safari","mobile-chrome","desktop-chrome"]}}
tabs در فایل: false
git grep «cancel-in-progress|timeout-minutes|Run E2E tests|playwright-report» در api/tests، tools، e2e  → هیچ تستی این مقادیر را پین نمی‌کند
```

**بدونِ تستِ قرمز-اول و بدونِ جهش** — این یک پیکربندیِ CI است و تنها اجراکننده‌اش GitHub است. «tested» نمی‌نویسم.

## ۵. آنچه **وارسی نکردم**

- **هیچ اجرای واقعی.** نه ماتریس، نه سقف‌ها، نه عبارتِ `cancel-in-progress`. عبارت طبقِ مستنداتِ GitHub مجاز است؛ خودم اجرایش را ندیده‌ام.
- **هزینه:** push‌های سندی روی `main` حالا تا آخر اجرا می‌شوند، و e2e سه container می‌گیرد. مخزن عمومی است — دقیقه، نه پول. ۰۵۱ همین را گفته بود.
- **`develop`** — همان قاعده به آن هم می‌رسد (لغو می‌شود چون `main` نیست). ۰۵۱ فقط `main` را حکم کرد.
- **سقفِ هر shard کافی است؟** برآوردِ محلی ~۷–۸ دقیقه به‌ازای پروژه‌ی سبز؛ رانرِ لینوکس اندازه گرفته نشده.
- **flakeِ `business-dashboard-waitlist-honesty`** (desktop-chrome، ۱ از ۲ اجرا) — retryِ CI احتمالاً می‌پوشاندش؛ ریشه‌یابی نشد.
