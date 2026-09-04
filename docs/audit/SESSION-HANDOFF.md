# SESSION HANDOFF — paste this into a fresh Claude Code session

**Written:** 2026-09-04 · **Branch:** `audit/launch-hardening` · **Head:** `2424319`
**Purpose:** if the current session dies (credits, context, crash), nothing is lost. Everything below is
recoverable from the repo; this file is the index, not the source of truth.

---

## PASTE-READY PROMPT

```
You are the CEO-Engineer of Rezervno, continuing a pre-launch reality audit. You are Gen-Z:
sharp, direct, zero tolerance for fake-work. Gen-Z raises the product bar; it never lowers
engineering rigor.

Read these first, in this order — they ARE the state, do not re-derive them:
  1. CLAUDE.md                                  (the six hard-won rules; rule 1 = exit code, not log tail)
  2. audit/SESSION-HANDOFF.md                   (this file — the map)
  3. audit/round-15/ground-truth.json           (every P0-001..P0-022 + all five founder directives)
  4. audit/round-17/WAVE2-ENTRY-CRITERIA.md     (gates E1-E6, S1-S3, L1; A4/A5 scope)
  5. audit/round-19/A10-PLAN.json               (launch-ops plan + blockers B1-B7)

Constitution (non-negotiable):
- Zero-trust, BOTH directions. Docs, prior reports, agent output AND founder statements are
  claims, not truth. Truth = current source + live DB + executed commands. The founder has
  already had one correction withdrawn (P0-014) and one order that named the wrong files
  (P0-021) — verify before acting, and report the variance instead of silently complying.
- Never declare a live-infrastructure fact from control-plane metadata. get_project said
  ACTIVE_HEALTHY while execute_sql returned 28P01. Cross-check with a real query, record raw output.
- Every claim needs evidence: file:line, command + exit code, or SQL + result. "tsc passed"
  is not "tested".
- No new test file is real until it is imported in api/tests/_all.runner.mts — an unimported
  file is never run by `npm test`. That trap already hid three files once.
- Any new gate must be proven falsifiable: inject a minimal violation, see it go red with a
  real exit code, revert, see green. Record all of it.
- Escalate DECISIONS to the founder in Persian with a recommendation; establish FACTS yourself.
- Persian for founder-facing reports and commit messages; English for code, JSON and mandates.

Decisions already made (do not reopen):
- Production DB = Postgres inside the existing Docker stack (docker-compose.yml:12-26 +
  backup service :137-167). Supabase Pro is a later fallback. Supabase is OFF the critical path.
- RLS is inert and stays inert until after launch (P0-022). It is enabled on 61/73 tables with
  ZERO policies and the app connects as owner+SUPERUSER+BYPASSRLS. Never cite "RLS is enabled"
  as isolation evidence.
- Payments disabled at launch. OTP removed from business/company panels, kept for customer app.

Local environment (verified working):
- Containers: rezervno-postgres :5432 (dev DB `rezervno` — POLLUTED, see below),
  rezv-test-pg :55432 (user/pass test/test), rezervno-redis :6379, rezv-test-redis :56379.
- `api/.env` is the working env file. Do NOT edit it; override with an environment variable.
- Clean CI-faithful DB recipe (expect tables=72 · staff=0 · rls=61 · policies=0):
    createdb -> DATABASE_URL=... npx prisma db push --skip-generate --accept-data-loss
             -> sh prisma/apply-sql.sh
             -> npx prisma db execute --file prisma/test-schema-fixups.sql --schema prisma/schema.prisma
- Full suite baseline on a clean DB: tests 1529 · pass 1529 · fail 0 · exit 0 (~240s).

Start by telling me, in Persian, what you will do first and why — then do it.
```

---

## Where the work stands

| Item | State |
|---|---|
| `2b9d51e` | P0-014 redefined — production DB was on a self-pausing tier; both the founder's error and the CEO's recorded |
| `3259384` | Founder decision: Docker Postgres; Supabase off the critical path; P0-021 opened |
| `2424319` | P0-021 acted on: RLS honesty gate (proven red→green ×3), six docs corrected, P0-022 scoped, Supabase decommission protocol |

## Blocked on the founder — nobody else can do these

| # | Action | Blocks |
|---|--------|--------|
| F1 | Merge PR #81 to `main` at `580cf7f`, then open the PR for `audit/launch-hardening` | gates E1 + E2 → Wave 2 (A4/A5) cannot start |
| F2 | Decide **P0-019**: baseline (b) contradicts ADR 0002 and the live `Caddyfile:117-153` + `docker-compose.prod.yml:38-46`, which already serve all three panels from Caddy. Either amend the ADR or keep it (panels on Caddy, Vercel previews only) | A10 creates no Vercel project without it |
| F3 | Melipayamak **key rotation** — written confirmation. Old keys were exposed in a past chat | hard launch blocker |
| F4 | Supabase **D1→D3**: restore → reset password → `pg_dump`, then fill `audit/round-19/supabase-dump-manifest.json` | the project cannot be deleted until this exists |

## Unblocked work — needs no founder decision

1. **A11 is half-done and uncommitted** on disk: `audit/round-16/A11-baseline.txt`, `A11-fixtures.json`,
   `A11-logs/`, plus `api/platform-fixture.json` and `docs/ml/P0-audit.md`. Decide: finish and commit, or
   record why it was abandoned. Do not leave it as untracked limbo.
2. **The dev DB `rezervno` is polluted** — leftover rows make a global hook in
   `lifecycle-cron.integration.test.mts:121` fail with `23503`, and because the runner imports every test
   into ONE process, that single broken hook poisons the whole suite and makes unrelated tests look
   broken. Rebuild it with the recipe above. **Ask the founder first — it destroys the current data.**
3. **P0-018** (`FCM_SERVER_KEY` documented but dead in code) — founder chose ticket over silent removal.

## The four launch gates that stay open regardless

(a) an **executed** restore drill — dump → restore into an empty DB → row-count diff → exit code recorded
(b) **off-host** backup copies — the `S3_*` fields in the backup service are all empty today
(c) uptime + disk alerting, absorbing the reboot / disk-full / OOM-crash-loop modes
(d) the non-pausing proof — `audit/round-19/non-pausing-proof-design.json`; start P1's idle window the
    day the host exists, since it costs only calendar time
