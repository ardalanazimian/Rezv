> ## ⛔ AGENCY_STATUS=DISABLED — PLANNED / NOT IMPLEMENTED
>
> **این سند فقط «معماریِ برنامه‌ریزی‌شده» است و هیچ سیستمِ در حالِ اجرایی را توصیف نمی‌کند.**
> در ۲۰۲۶-۰۸-۱۳ با تصمیمِ صریحِ مالکِ محصول، اجرایِ خودکارِ عامل‌ها به‌طورِ کامل
> متوقف شد (دلیل: مصرفِ بیش از حدِ توکن/منابع). رجوع کن به `agency/AGENCY_STATUS`.
>
> هیچ‌چیز در این فایل دستورالعملِ اجرایی نیست. به‌طورِ مشخص ممنوع است:
> ساختِ Routine/trigger/cron، اشتراکِ خودکارِ رویدادِ PR، حلقهٔ خودگردان،
> پایشِ پس‌زمینه، خودآموزی، و هر عملیاتِ خودکارِ گیت‌هاب.
> کلیدهایِ فعال‌سازیِ قدیمی (`REZV`، `REZV FULL`) بی‌اثرند.
>
> فعال‌سازیِ دوباره فقط با تصمیمِ مکتوبِ انسانی و تغییرِ دستیِ `agency/AGENCY_STATUS`.

# Discovery Index

This is an index, not a fresh audit. This repository already contains a
large amount of real, evidence-based discovery work from prior sessions.
Re-deriving it here would risk contradicting verified findings with
guesses. Every item below is classified:

- **FACT** — verified directly in this session (command output, file read).
- **EVIDENCE** — asserted in a prior committed audit doc, cited by path.
- **INFERENCE** — reasoned from the above, not independently re-verified.
- **UNKNOWN** — not established by anything in the repo.

## 1. Repository state (FACT, verified 2026-08-11)

- Default branch: `main`. Working branch for this change:
  `claude/rezv-ai-agency-os-bvk4e8`.
- No pre-existing "agent"/"agency" infrastructure in the repo (`grep -ril
  agent **/*.md` outside this change only matches `docs/adr/0002-*.md` and
  `docs/figma-mcp-rules.md`, neither of which describes an agent system).
- CI (`.github/workflows/ci.yml`, **8 jobs** as of 2026-08-20 — the `schema-drift`
  job was added after this line was written, which said 7; re-read in full after
  an initial partial read missed this — correcting that mistake here
  rather than leaving it) runs on push/PR to `main`/`develop`: `build`
  (Prisma generate → `tsc --noEmit` → lint → `next build`), `test` (real
  Postgres 17 + Redis 7 service containers → `prisma db push` +
  `prisma/apply-sql.sh` → `npm test`), `security` (`npm audit`, blocks on
  `critical`, warns on `high`), `e2e` (Playwright against the customer app
  with the API fully mocked — `npm test` in `e2e/` runs **all** configured
  projects since no `--project` filter is passed, and
  `e2e/playwright.config.ts` defines exactly `mobile-safari`/iPhone 13,
  `mobile-chrome`/Pixel 5, and `desktop-chrome`/Desktop Chrome — i.e. CI
  *does* cover the three profiles `CLAUDE.md` mandates, for the customer
  app at least), `design-system` (`sh tools/sync-design-system.sh
  --check`), `seo` (JSON-LD schema unit tests + `next build`
  typecheck/lint/build for `apps/seo`), `landing` (unit tests + `npm run
  typecheck` + `npm run lint` + `next build` for `apps/landing`). So the
  `CLAUDE.md` pre-push checklist and CI are in fact largely the same set of
  checks for `api/`, `apps/landing/`, `apps/seo/`, and E2E — CI does not
  duplicate business/company-panel E2E coverage specifically, which is the
  one real gap between "CI green" and the full manual checklist.
- `api/src/lib/` contains 58 modules (auth, RBAC, rate limiting, fraud,
  loyalty, no-show ML, forecasting, Zarinpal payments, waitlist, etc.) —
  this is the real surface the "Backend" and "Database" agent roles operate
  on.
- `api/src/app/api/v1/` contains 105 `route.ts` files — the real API
  surface for the "Backend"/"Security"/"QA" agent roles.
- Root `package.json` only declares `playwright`, `@tanstack/react-query`,
  `zod` — confirming `CLAUDE.md`'s note that the repo root has no build of
  its own; real work happens inside `api/`, `apps/landing/`, `apps/seo/`.
- `e2e/tests/` includes `panels-smoke.spec.ts`, whose own header comment
  states `business`/`company` panels had **no** E2E at all until this smoke
  test, and it only verifies each panel loads without a JS error and
  renders its shell (brand/sidebar/landmarks) — not full reservation/staff
  flows, which the same comment flags as a follow-up needing staff/admin
  API mocks. So the customer app has real flow-level E2E (`booking.spec.ts`,
  `waitlist.spec.ts`, `auth.spec.ts`, …) across all three device profiles,
  while business/company have structural smoke coverage only.

## 2. Existing discovery/audit documents (EVIDENCE — already in repo)

Architecture & backend:
- `docs/architecture-audit/` — `ARCHITECTURE_AUDIT_FINAL.md`,
  `ARCHITECTURE_CONSOLIDATION_REPORT.md`, `BACKEND_INVENTORY.md`,
  `FRONTEND_INVENTORY.md`, `API_USAGE_MATRIX.md`, `DEPENDENCY_GRAPH.md`,
  `BROKEN_CONNECTIONS.md`, `UNUSED_BACKEND_REPORT.md`,
  `UNUSED_FRONTEND_REPORT.md`, `FEATURE_COVERAGE_MATRIX.md`,
  `FULLSTACK_INTEGRATION_AUDIT.md`, `BENCHMARK_ANALYSIS.md`,
  `CONSOLIDATION_ROADMAP.md`, `FINAL_VALIDATION_REPORT.md`,
  `PROJECT_ARCHITECTURE_REPORT.md`, `AI_PLATFORM_AUDIT.md`.
- `docs/backend-audit/` — `API_AUDIT_REPORT.md`,
  `BACKEND_ARCHITECTURE_AUDIT.md`, `BACKEND_FINAL_AUDIT.md`,
  `DATABASE_AUDIT.md`, `PERFORMANCE_REPORT.md`,
  `PRODUCTION_READINESS_REPORT.md`, `SECURITY_AUDIT_REPORT.md`,
  `TECHNICAL_DEBT_REPORT.md`.

Root-level audits: `SECURITY-AUDIT.md` (OWASP Top 10 walkthrough with real
fixes, e.g. refresh-token rotation/revocation, `HS256`-pinned JWT verify,
parametrized `$queryRaw` only, global `esc()` for XSS), `ENTERPRISE-AUDIT.md`,
`AUDIT-REPORT-2026-08-07.md` (landing/studio auth flow, browser-verified),
`SEO_AUDIT_REPORT.md`, `LAUNCH-GAPS.md`, `PERFORMANCE.md`, `SCALING.md`.

Product/UX: `docs/CUSTOMER_UI_AUDIT_REPORT.md`,
`docs/CUSTOMER_ACCESSIBILITY_REPORT.md`,
`docs/CUSTOMER_UI_REDESIGN_PLAN.md`/`_REPORT.md`,
`docs/CUSTOMER_UX_IMPROVEMENTS.md`, `docs/CUSTOMER_COMPONENT_LIBRARY.md`.

Domain knowledge: `PROJECT-KNOWLEDGE.md` and `docs/PROJECT_KNOWLEDGE.md`
(architecture, Supabase project ID, auth model, timezone bug history,
multi-branch model, Zarinpal payment flow), `docs/KNOWN_LIMITATIONS.md`
(honest tech-debt inventory, several items explicitly marked
**(uncertain)**/**(follow-up)**), `docs/INTELLIGENCE-PLATFORM-ARCHITECTURE.md`
(explicitly labeled an unbuilt blueprint — "هیچ کدِ اجراییِ این سند هنوز
نوشته نشده").

Anyone (human or agent role) doing new discovery work on this repo should
read the relevant document above **first** and only re-verify if it looks
stale, rather than re-auditing from zero.

## 3. What is genuinely still UNKNOWN

- Whether `main`'s CI is actually green *right now* — not checked in this
  session for `main` itself (only this PR's own run was observed, and only
  while it was still in progress). CI does cover design-system `--check`,
  the three-profile Playwright E2E for the customer app, and
  `api`/`apps/landing`/`apps/seo` typecheck/lint/test/build (see §1), so a
  green run on `main` would be a reasonable proxy for those — this item is
  "not yet checked," not "CI doesn't cover it."
- Current production incident/error state — no telemetry was queried in
  this session (no observability backend credentials in scope here).
- Whether `docs/architecture-audit/` and `docs/backend-audit/` reports are
  still accurate today or have drifted since they were written (no dates
  are visible in their filenames; several other root docs are dated
  2026-07/08).

These gaps are recorded, not resolved, per Section 2's "no modifications
until discovery is complete" instinct — resolving them is real work for the
relevant agent role (QA, DevOps) under `governance/GOVERNANCE.md`'s
evidence rules, not something to assert here.
