# تیمِ بازیابیِ فاز ۲ — رزرونو

> معمار: **Fable 5** (نشستِ اصلی). اعضا: ۷ نقشِ زیر، همه `model: opus`.
> این فایل ایجنت نیست (frontmatter ندارد) — فقط نقشه‌ی تیم است.
> منبع: منشورِ طراحی‌شده توسطِ معمار، مشتق از `MASTER ENGINEERING RECOVERY PROTOCOL — PHASE 2`
> و `docs/audit/BASELINE.md` (ممیزیِ فاز ۱) و `CLAUDE.md`.

## اعضا

| نقش | مسئولیت | حلقه‌ی RECOVERY ORDER (بند ۱) |
|---|---|---|
| `phase2-verifier` | راستی‌آزماییِ مستقل، اجرای گیت‌ها. **فقط-خواندنی** | فرا-حلقه |
| `backend-integrity-engineer` | P0 بک‌اند، چرخه‌ی عمرِ رزرو، availability، tenant/RBAC/RLS، پروفایل/آلرژی/تولد، DB | حلقه‌های ۱–۵، ۷ |
| `contracts-consolidation-engineer` | قراردادِ فرانت↔بک، حذفِ fake-success کلاینت، تحکیمِ تکراری‌ها، کدِ مرده | حلقه‌های ۴، ۶، ۷ |
| `ds-token-guardian` | تنها نویسنده‌ی هر دو منبعِ توکن + توزیعِ sync | حلقه‌ی ۹ |
| `panels-ui-engineer` | UX/UI سه پنلِ وانیلا (dead buttons، حالت‌ها، RTL، a11y) | حلقه‌های ۹، ۱۰ |
| `e2e-regression-engineer` | بستنِ عدمِ‌تقارنِ E2E + تستِ رگرسیون روی هر سه پروفایل | فرا-حلقه |
| `data-trust-engineer` 🚧 | badges، ledgerِ loyalty، سخت‌سازیِ تله‌متری، مرزِ اعتمادِ AI، simulation (بندهای ۱۲–۱۹) | حلقه‌های ۱۱–۱۲ (`BUSINESS OS`, `AI DATA FOUNDATION`) |

🚧 **`data-trust-engineer` دروازه‌دار است:** تا معمار حلقه‌های ۱–۷ را پایدار اعلام نکند
spawn نمی‌شود (بند ۱: «Do NOT jump to AI features while foundational integrity is broken»).
هزینه‌اش به تعویق می‌افتد، نه اینکه اضافه شود.

## چرا تیم عمداً کوچک است

`agency/AGENCY_STATUS` = **DISABLED** از ۲۰۲۶-۰۸-۱۳؛ دلیلِ ثبت‌شده: «مصرفِ بیش از حدِ
توکن/منابع» برای یک لایه‌ی ~۲۳ عاملی. `docs/audit/BASELINE.md` §۰ هشدار می‌دهد این
پروتکل «نسخه‌ی بزرگ‌ترِ همان درخواستی است که agency/ را تولید کرد».

مکانیزم‌های کنترلِ هزینه (در بدنه‌ی هر ۶ تعریف تکرار شده‌اند):

1. سقفِ سختِ ۶ نقش؛ هر نقش به یک حلقه‌ی بند ۱ نگاشت دارد.
2. **هیچ اجرایِ خودگردان/پس‌زمینه‌ای نیست** — بدونِ cron/Routine/trigger/حلقه‌ی پایش.
3. **هیچ ایجنتی ایجنتِ دیگر spawn نمی‌کند** — ساختار تخت است، نه درختِ بازگشتی.
4. **ممیزیِ ششم ممنوع** — کارِ ارزشمند رفعِ یافته‌های *بازِ* BASELINE §۵ است.
5. **قانونِ دو-شکست** — دو شکستِ پیاپیِ یک گیت = توقف و ارجاع، نه تلاشِ سوم.
6. **گزارش‌فایل‌سازی ممنوع** — تنها اسنادِ مجاز: `docs/recovery/PHASE-2-PLAN.md`،
   `docs/recovery/BASELINE-TEST-STATUS.md`، `docs/architecture/DECISIONS.md`.

`agency/` احیا نمی‌شود. هیچ ایجنتی `agency/AGENCY_STATUS` را تغییر نمی‌دهد.

## مالکیتِ فایل

| مسیر | مالکِ نویسنده | یادداشت |
|---|---|---|
| `api/src/**`, `api/tests/**` | backend-integrity-engineer | middleware/auth/lifecycle = تأییدِ معمار |
| `api/prisma/sql/NNN-*.sql` (فقط فایلِ **جدید**) | backend-integrity-engineer | هر schema change = escalation قبل از کد |
| `apps/*/js/**` (منطق/قرارداد/داده) | contracts-consolidation-engineer | به‌جز فایل‌های تولیدیِ sync |
| `apps/*/css/{app,panel,theme}.css` + markup | panels-ui-engineer | مرزِ مشترک با نقش ۳: رندر/استایل مالِ ۵، داده/قرارداد مالِ ۳ |
| کپی‌های sync‌شده (`apps/*/css/{tokens,foundation,ds-bridge}.css`, `apps/*/js/{icons,api-core,format,analytics}.js`) | **هیچ‌کس مستقیم** | خروجیِ `tools/sync-design-system.sh` |
| `shared/css/**`, `shared/js/icons.js` | ds-token-guardian | بعد از هر تغییر: sync اجباری |
| `shared/js/{api-core,format,analytics.panel}.js` | contracts-consolidation-engineer | منطقِ transport، نه دیزاین |
| `apps/landing/**` | ds-token-guardian | دنیای B |
| `apps/seo/**` | **هیچ‌کس** | خارج از دامنه‌ی فاز ۲ |
| `e2e/**` | e2e-regression-engineer | config پروفایل‌ها = escalation |
| `tools/sync-design-system.sh` | **فقط معمار** | — |
| `docs/audit/BASELINE.md` | **هیچ‌کس** | سندِ تاریخیِ فاز ۱ |
| `agency/`, `demo-mvp/`, `standalone/`, `design-preview/` | **هیچ‌کس** | DISABLED / DEMO / GENERATED / PROTOTYPE |
| `node_modules/`, `.next/` | **هیچ‌کس** | — |

## شکاف‌های باز (قبل از اولین batch باید حل شوند)

1. **بندهای ۱۲–۱۹ پروتکل نرسیده‌اند.** حوزه‌هایشان (RBAC تفصیلی، telemetry، AI trust
   boundaries، badge/loyalty) UNKNOWN‌اند و کار در آن‌ها شروع نمی‌شود. **فاز ۲ با
   پروتکلِ ناقص قابلِ «تکمیل» اعلام‌شدن نیست** (بند ۳۴ چند شرطش تعریف‌ناپذیر است).
2. **صفر کامیت.** ریپو remote دارد (`origin` → `github.com/ardalanazimian/Rezv.git`) ولی
   **هیچ کامیتی ندارد**؛ همه‌چیز untracked. یعنی هیچ نقطه‌ی بازگشتی وجود ندارد، در حالی
   که بندهای ۰/۲۴ «rollback strategy» را الزام کرده‌اند و CLAUDE.md برای همین دامنه‌ها
   PR + CI سبز می‌خواهد. **قبل از اولین تغییرِ کد باید کامیتِ baseline زده شود.**
   هیچ ایجنتی خودش git init/commit/push نمی‌کند.
