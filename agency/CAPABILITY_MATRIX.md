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
| Zarinpal payments | UNKNOWN | cited | cited (`zarinpal.ts`) | cited (`payments` table) | Zarinpal (cited) | UNKNOWN | — | IMPLEMENTED | `PROJECT-KNOWLEDGE.md` §6 |
| Row-Level Security on Postgres | n/a | n/a | n/a | cited: 35/35 tables RLS-enabled, **0 policies** | n/a | UNKNOWN | — | PARTIAL — RLS is deny-by-default at the DB layer, but access control is actually enforced in application code (Prisma with owner role bypasses RLS), so RLS is not doing active authorization work | `PROJECT-KNOWLEDGE.md` §2 |
| SQLi/XSS defenses (`$queryRaw` params, `esc()`) | cited | cited | cited | cited | — | UNKNOWN | — | IMPLEMENTED | `SECURITY-AUDIT.md` A03 |
| Design-system single source (`shared/` → `apps/*`) | FACT (`tools/sync-design-system.sh` exists) | n/a | n/a | n/a | n/a | drift-checked by script, **not wired into `.github/workflows/ci.yml`** (FACT) | — | PARTIAL — the sync mechanism is real, but its `--check` gate is a human pre-push step per `CLAUDE.md`, not a CI-enforced gate | `PROJECT-KNOWLEDGE.md` §1, `.github/workflows/ci.yml` (FACT, read this session) |
| SEO discovery pages (`/city`, `/cuisine`, `/r/{slug}`) | cited | cited | cited | cited | — | cited (JSON-LD schema unit tests, per commit history) | — | IMPLEMENTED | Commit history (`SEO P4`–`P10`, FACT from `git log`), `SEO_AUDIT_REPORT.md` |
| Playwright E2E across iPhone 13 / Pixel 5 / Desktop Chrome | n/a | n/a | n/a | n/a | n/a | required by `CLAUDE.md`, **not run in `.github/workflows/ci.yml`** (FACT) | — | PARTIAL — exists as a mandated human-run gate (`e2e/`), not a CI-enforced one | `CLAUDE.md`, `.github/workflows/ci.yml` (FACT) |
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
