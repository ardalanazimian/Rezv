# Round 15 — CEO Pre-Launch Reality Audit — PLAN (2026-09-03)

Program: `CEO_LAUNCH_AUDIT_PROMPT.md` (founder, 2026-09-03). Rounds 3–14 are closed (`docs/audit/*ROUND*.md`). Numbering continues at 15.
Machine-readable outputs live in `audit/round-<N>/`; human reports next to them as `*-REPORT.md`.

## Deviations from the prompt — facts override claims (prompt §2.1)

| Prompt says | Repo truth (verified) | Action |
|---|---|---|
| repo `ardalanaz/RezervnoOS`, Next.js 14 | remote `ardalanazimian/Rezv`, Next 16 (`api/package.json`) | use repo truth |
| migrations in `prisma/migrations/manual/`, `db push` + psql loop, P3015 | `api/prisma/sql/NNN-*.sql` applied by `prisma/apply-sql.sh` (`prisma db execute`); CLAUDE.md: `manual/` does not exist | follow CLAUDE.md; never create `manual/` |
| PR #79 = 12/12 green | 13 checks incl. Sourcery (skipped); PR #81 (`feat/admin-totp-login`) in flight | record as-is |
| fix branch `audit/launch-hardening` | does not exist yet | create when the first fix PR is cut |
| Supabase `zmyuvtpbchytqvtgyewt` reachable | MCP `list_projects` sees it (only ACTIVE_HEALTHY); pg auth failed ×2, then "hibernated"; auto-mode classifier denied retry | founder: wake project / allow the query, or run the two SQLs in `ground-truth.json` yourself |

## Phase map

| Phase | Owner | Round dir | Gate | Status |
|---|---|---|---|---|
| 0 Ground truth | CEO | round-15 | `ground-truth.json` written; drift zero or reconciled | **done** (drift + CI-final marked *blocked*, see file) |
| 1 Feature census | A1 ‖ A2 ‖ A3 | round-16 | 100 % interactive elements classified with evidence | mandates written, launching |
| 2 Test integrity | A6 | round-16 | zero non-falsifiable tests; contract suite red-able | mandate written, launching |
| 3 Backend deep | A4 ‖ A5 | round-17 | isolation matrix 100 %; blockers fixed via PR | pending Wave 2 |
| 4 UI/UX bar | A7 | round-18 | state table 100 % | pending |
| 5 Loyalty | A8 | round-18 | Gap Matrix; launch-minimum REAL | pending |
| 6 ML honesty | A9 | round-18 | holdout metrics recorded | pending |
| 7 Launch ops | A10 | round-19 | every item green | can start now (independent of code) |
| 8 GO/NO-GO | CEO | round-20 | `scorecard.json` | — |

## Phase 0 result (summary — full detail and evidence in `ground-truth.json`)

- **CI:** PR #81 last seen 11/13 green, `test` running; GitHub public API rate-limited → re-poll after 06:40.
- **Local gates on the worktree (14 uncommitted files + 3 test fixes):** tsc 0 · lint 0 · design-system 0 · standalone 0 · xss-regression 0 · xss-sink-audit 0 (baseline 65 unchanged) · full suite: rerunning on a from-scratch DB after two aborted runs poisoned fixtures (`Unique constraint failed` on `code`/`authority`/`phone`).
- **Live drift / RLS:** blocked (see table above). Local side prepared (`scratchpad/local_cols.txt`, 72 tables). Local guard `schema-drift.integration.test.mts` 3/3 green.
- **Vercel:** team `team_gLTPq1IJB0ayoC3NsDE4yoXg`, **0 projects** (confirmed). **Sentry:** org `rezvno`, **0 projects** → no DSN possible.
- **Carried-over blockers:** S2 **fixed** (`sms.ts:101-106,296`) · P2002→409 **fixed and proven red-able today** · credentials-at-rest **open — plaintext** (`platform-settings.ts:23-24`) · key rotation **unverifiable from repo** (ops action).
- **New Phase-0 findings:** P0-001 OTP-bypass fix uncommitted (blocker) · P0-005 `npm test` hang (17 min silent, §8.5) · P0-007 plaintext settings · P0-008 no deploy/monitoring targets · three test defects fixed in worktree (P0-002/003/004) · P0-006 stale local Prisma client · P0-010 duplicate work across parallel sessions.

## Sequencing recommendation (fix waves)

1. **Wave 0 — today.** Commit the 14-file OTP-flag work + 3 test fixes on `feat/admin-totp-login`; push → CI; merge #81 on green. Founder decision needed: include in #81 (one more CI cycle) vs. follow-up PR.
2. **Wave 1 — parallel.** A6 test-integrity (hang root-cause, runner watchdog, prisma-generate guard, falsifiability sweep) ‖ A1–A3 census (read-only) ‖ A10 env/Vercel/Sentry wiring (independent of code).
3. **Wave 2.** A5 security (encrypt `platform_settings`, RBAC map, refresh-principal) ‖ A4 backend (concurrency proof, lifecycle, isolation matrix).
4. **Wave 3.** A10 remainder (SMS pattern proof, key-rotation confirmation, backups drill, load test).
5. **Wave 4.** A7 / A8 / A9 → **Wave 5** scorecard.

## Tooling used in Phase 0

Supabase MCP (`list_projects` ✓; `execute_sql`/`list_tables`/`get_advisors` ✗ auth → hibernated → classifier), Vercel MCP ✓, Sentry MCP ✓, graphify (repo `ardalanazimian/Rezv` indexed, 3 597 nodes — available for census impact queries), GitHub public API (rate-limited; `gh` token invalid), local Docker Postgres 55432 + Redis 56500 (alt port; 56379 sits in a Hyper-V excluded range), Prisma CLI.

## Coordination rule for parallel sessions (P0-010)

Before editing any shared doc (`docs/recovery/*`, `docs/audit/*`, `audit/*`): `git fetch && git log --all --oneline -3 -- <file>`. If another branch touched it in the last 24 h, read that version first and extend it — do not re-create a section.
