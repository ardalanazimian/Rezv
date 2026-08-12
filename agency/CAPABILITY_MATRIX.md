# Capability Matrix

Per the original request's Section 8 template. Status values follow Section
2's classification: `IMPLEMENTED`, `PARTIAL`, `MOCKED`, `DOCUMENTED_ONLY`,
`BROKEN`, `MISSING`, `UNKNOWN`.

**Evidence basis**: this matrix is built from citations to the audit
documents indexed in `DISCOVERY.md`, plus the direct file checks made in
this session (marked `FACT` in the Evidence column). It is **not** a fresh
end-to-end re-verification of every row (Frontend → API → DB → Response →
UI → Tests → Observability) — that would require running the full stack,
which was out of scope for this change. Columns marked `cited` mean "an
existing audit asserts this," not "re-confirmed live in this session."
Treat this matrix as a starting index for the QA/Review agent roles to
verify, not as a substitute for verification.

| Capability | Frontend | API | Backend | DB | External | Tests | Observability | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| OTP auth (SMS, hashed, rotation) | cited | cited | cited | cited | Kavenegar (cited) | cited | — | IMPLEMENTED | `PROJECT-KNOWLEDGE.md` §3, `SECURITY-AUDIT.md` A01/A02 |
| Offline demo OTP fallback (`1234`) | FACT (per `CLAUDE.md`, client-side only) | n/a (bypasses backend) | n/a | n/a | n/a | UNKNOWN | — | IMPLEMENTED (as a deliberate offline-only fallback, not a server behavior) | `CLAUDE.md` OTP section |
| JWT access/refresh + revocation | — | cited | cited | cited (Redis blacklist) | — | cited | — | IMPLEMENTED | `SECURITY-AUDIT.md` A01 |
| Multi-tenant isolation (tenantId) | — | cited | cited | cited | — | cited | — | IMPLEMENTED | `SECURITY-AUDIT.md` A01, `PROJECT-KNOWLEDGE.md` §1 |
| Multi-branch (`Staff.restaurant_id`, `X-Restaurant-Id`) | UNKNOWN | cited | cited (`staff-helpers.ts`) | cited | — | UNKNOWN | — | IMPLEMENTED (backend); frontend coverage not re-verified | `PROJECT-KNOWLEDGE.md` §5 |
| Timezone-correct reservation times | — | cited | cited (`hours.ts`, `zonedTimeToUtc`) | cited | — | cited (Tehran/Dubai/NY) | — | IMPLEMENTED — but flagged as a regression-prone hotspot | `PROJECT-KNOWLEDGE.md` §4 (explicit "never hardcode +03:30 again" warning) |
| Zarinpal payments | **MISSING (verified 2026-08-12)** — zero references to `pay`/`zarinpal`/`deposit` in `apps/customer/js`, `apps/business/js`, `apps/company/js` | FACT (route exists, `POST /reservations/[code]/pay`) | cited (`zarinpal.ts`) | cited (`payments` table) | Zarinpal (cited) | UNKNOWN | — | PARTIAL — backend is real and wired to a Zarinpal REST client, but no frontend calls it, so the flow is not reachable by a real user. Was previously listed here as IMPLEMENTED on the strength of backend-only citations; corrected after actually grepping the frontends | `PROJECT-KNOWLEDGE.md` §6 (corrected 2026-08-12), FACT grep this session, contradicts `docs/architecture-audit/FEATURE_COVERAGE_MATRIX.md`'s "Complete" claim |
| Row-Level Security on Postgres | n/a | n/a | n/a | FACT (live-tested 2026-08-12, fixed same day with explicit human authorization): migration `037-rls-core-tables.sql` added; a fresh DB now gets RLS on 49/49 tables (was 15/49), re-run confirmed idempotent, full backend test suite (266 tests) still 0 failures, **0 policies** (deny-by-default only) | n/a | UNKNOWN | — | IMPLEMENTED — RLS is deny-by-default at the DB layer and now fully reproducible from migrations on every table; access control is still actually enforced in application code (Prisma owner role bypasses RLS), so RLS remains a defense-in-depth backstop, not the primary authorization mechanism | `PROJECT-KNOWLEDGE.md` §2, `agency/knowledge/KNOWLEDGE_SYSTEM.md` §SECURITY_MEMORY, `api/prisma/sql/037-rls-core-tables.sql` |
| SQLi/XSS defenses (`$queryRaw` params, `esc()`) | cited | cited | cited | cited | — | UNKNOWN | — | IMPLEMENTED | `SECURITY-AUDIT.md` A03 |
| Design-system single source (`shared/` → `apps/*`) | FACT (`tools/sync-design-system.sh` exists) | n/a | n/a | n/a | n/a | drift-checked by script, **CI-enforced** via the `design-system` job (`sh tools/sync-design-system.sh --check`, FACT) | — | IMPLEMENTED — both a human pre-push step per `CLAUDE.md` and a CI-enforced gate | `PROJECT-KNOWLEDGE.md` §1, `.github/workflows/ci.yml` (FACT, read in full this session) |
| SEO discovery pages (`/city`, `/cuisine`, `/r/{slug}`) | cited | cited | cited | cited | — | cited (JSON-LD schema unit tests, per commit history) | — | IMPLEMENTED | Commit history (`SEO P4`–`P10`, FACT from `git log`), `SEO_AUDIT_REPORT.md` |
| Playwright E2E across iPhone 13 / Pixel 5 / Desktop Chrome (customer app) | n/a | n/a | n/a | n/a | n/a | CI-enforced via the `e2e` job (`npm test` = all three `playwright.config.ts` projects, FACT) | — | IMPLEMENTED for `apps/customer` (flow-level: booking, waitlist, auth). `apps/business`/`apps/company` have structural smoke coverage only (`panels-smoke.spec.ts`) — PARTIAL for those two apps | `CLAUDE.md`, `.github/workflows/ci.yml`, `e2e/playwright.config.ts`, `e2e/tests/panels-smoke.spec.ts` (all FACT, read this session) |
| No-show prediction / demand forecast (ML) | UNKNOWN | cited (`no-show-model.ts`, `demand-forecast.ts` exist — FACT, files present) | cited | UNKNOWN | — | UNKNOWN | — | UNKNOWN — files exist (`api/src/lib/no-show-model.ts`, `demand-forecast.ts`, confirmed present this session) but whether they are rule-based or trained models, and whether frontend surfaces their output, was not verified | file listing (FACT), no further audit read |
| Unified `platform_events` event bus / AI Gateway | — | — | — | — | — | — | — | DOCUMENTED_ONLY — explicitly described as an unbuilt blueprint | `docs/INTELLIGENCE-PLATFORM-ARCHITECTURE.md` line 3: "هیچ کدِ اجراییِ این سند هنوز نوشته نشده" |
| Rezv AI Agency OS (this request, in full) | — | — | — | — | — | — | — | DOCUMENTED_ONLY (this change) | this directory |

## Rows this matrix deliberately does not fill in

Dozens of other capabilities exist and are already covered by the audits in
`DISCOVERY.md` §2 (loyalty, waitlist, coupons, fraud scoring, admin
business-intelligence, chat, photo moderation, subscription billing, cron
jobs, backups). They are not duplicated here to avoid a second,
independently-drifting copy of the same facts — consult the cited documents
directly. This matrix's job is to demonstrate the *format* the CEO/
Orchestrator agent roles should keep updated, seeded with real rows, not to
be an exhaustive re-statement of every existing audit.
