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
- CI (`.github/workflows/ci.yml`) runs two jobs on push/PR to `main`/
  `develop`: `build` (Prisma generate → `tsc --noEmit` → lint → `next
  build`) and `test` (real Postgres 17 + Redis 7 service containers →
  `prisma db push` + `prisma/apply-sql.sh` → test suite). There is no
  workflow that runs Playwright E2E or `sync-design-system.sh --check` in
  CI today — `CLAUDE.md` requires both before a human pushes, but nothing
  enforces them automatically in `.github/workflows/`. **Gap, not a
  contradiction**: the human-run pre-push checklist and CI are not the same
  set of checks.
- `api/src/lib/` contains 58 modules (auth, RBAC, rate limiting, fraud,
  loyalty, no-show ML, forecasting, Zarinpal payments, waitlist, etc.) —
  this is the real surface the "Backend" and "Database" agent roles operate
  on.
- `api/src/app/api/v1/` contains 105 `route.ts` files — the real API
  surface for the "Backend"/"Security"/"QA" agent roles.
- Root `package.json` only declares `playwright`, `@tanstack/react-query`,
  `zod` — confirming `CLAUDE.md`'s note that the repo root has no build of
  its own; real work happens inside `api/`, `apps/landing/`, `apps/seo/`.

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

- Whether the checks `CLAUDE.md` mandates before push (design-system sync
  `--check`, Playwright E2E on iPhone 13/Pixel 5/Desktop Chrome) are green
  *right now* on `main` — not verified in this session, and CI does not run
  them, so "green in CI" cannot be used as a proxy.
  `apps/landing/`/`apps/seo/` typecheck/lint/test status independently —
  not verified in this session.
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
