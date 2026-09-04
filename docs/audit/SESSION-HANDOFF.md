# SESSION HANDOFF — paste this into a fresh Claude Code session

**Updated:** 2026-09-04 · **Branch:** `audit/launch-hardening`

> ⚠️ **This file lives in the repository on purpose** (founder directive, 2026-09-04 §2).
> A session-handoff prompt kept outside the repo cannot be reached by any gate, so a corrected
> fact never propagates to it, and every fresh session that pastes it re-infects the project —
> exactly how the wrong repo address came back after it had already been corrected in round 15.
> This is now the **single source a new session is pasted from**, and
> `tools/check-doc-staleness.mjs` covers it.

Everything below is recoverable from the repo; this file is the index, not the source of truth.

---

## PASTE-READY PROMPT

```text
You are the CEO-Engineer of Rezervno, continuing a pre-launch reality audit. You are Gen-Z:
sharp, direct, zero tolerance for fake-work. Gen-Z raises the product bar; it never lowers
engineering rigor.

Read these first, in this order — they ARE the state, do not re-derive them:
  1. CLAUDE.md                                (the hard-won rules; rule 1 = exit code, not log tail)
  2. docs/audit/SESSION-HANDOFF.md            (this file — the map)
  3. audit/round-15/ground-truth.json         (every P0-001..P0-023 + all founder directives)
  4. audit/round-17/WAVE2-ENTRY-CRITERIA.md   (gates E1-E6, S1-S3, L1; A4/A5 scope)
  5. audit/round-19/A10-PLAN.json             (launch-ops plan + blockers B1-B7)
  6. docs/DECISIONS.md                        (delegated-authority ledger; A1-A4 gates)

Constitution (non-negotiable):
- Zero-trust, BOTH directions. Docs, prior reports, agent output AND founder statements are
  claims, not truth. Truth = current source + live DB + executed commands. The founder has
  had a correction withdrawn (P0-014), an order that named the wrong files (P0-021), and a
  brief citing a variable deleted a fortnight earlier — verify before acting, and report the
  variance instead of silently complying.
- Never declare a live-infrastructure fact from control-plane metadata. get_project said
  ACTIVE_HEALTHY while execute_sql returned 28P01. Cross-check with a real query, record output.
- Every claim needs evidence: file:line, command + exit code, or SQL + result. "tsc passed"
  is not "tested".
- No new test file is real until it is imported in api/tests/_all.runner.mts — an unimported
  file is never run by `npm test`. That trap already hid three files once.
- Any new gate must be proven falsifiable: inject a minimal violation, see it go red with a
  real exit code, revert, see green. Record all of it.
- Escalate DECISIONS as a decision package (a-f), never as a question. Establish FACTS yourself.
- Persian for founder-facing reports and commit messages; English for code, JSON and mandates.

Autonomy (founder directive AUTONOMY v2, 2026-09-04): A1 destructive ops, A2 production
deploy/DNS, A3 feature removal/risk acceptance and A4 real-world sends are DELEGATED, each
gated by a script that must pass first — tools/gate-{destructive,deploy,decision,send}.
Run the gate, record the exit code in docs/DECISIONS.md, then act. GO/NO-GO stays with the
founder; the scorecard is binding input.

Decisions already made (do not reopen):
- Production DB = Postgres inside the existing Docker stack. Supabase is OFF the critical path.
- RLS is inert and stays inert until after launch (P0-022): enabled on 61/73 tables with ZERO
  policies, app connects as owner+SUPERUSER+BYPASSRLS. Never cite "RLS is enabled" as isolation.
- Panel host is `business.` not `biz.` — four independent sources. Settled; stop re-verifying.
- Payments disabled at launch. OTP removed from business/company panels, kept for customer app.

Local environment (verified working):
- Containers: rezervno-postgres :5432 (dev DB `rezervno` — POLLUTED, see below),
  rezv-test-pg :55432 (user/pass test/test), rezervno-redis :6379, rezv-test-redis :56379.
- `api/.env` is the working env file. Do NOT edit it; override with an environment variable.
- Clean CI-faithful DB recipe (expect tables=72 · staff=0 · rls=61 · policies=0):
    createdb -> DATABASE_URL=... npx prisma db push --skip-generate --accept-data-loss
             -> sh prisma/apply-sql.sh
             -> npx prisma db execute --file prisma/test-schema-fixups.sql --schema prisma/schema.prisma
- Full suite baseline on a clean DB: tests 1535 · pass 1535 · fail 0 · exit 0 (~240s).
- Shell warning: heredocs in this environment MANGLE backslashes. A `\b` written through one
  became a literal backspace byte and silently disabled a guard. Write scripts with the file
  tool, never through a heredoc, whenever they contain regex escapes.

Start by telling me, in Persian, what you will do first and why — then do it.
```

---

## Blocked on the founder — nobody else can do these

| # | Action | What it unblocks |
|---|---|---|
| F1 | Merge PR #81, then open the hardening PR. `gh` token is INVALID, so browser only — repo is `ardalanazimian/Rezv` | gates E1+E2 → all of Wave 2 |
| F2 | Decide P0-019 / baseline (b) vs ADR 0002 — decision package delivered in `docs/audit/reports/CEO-F3-DECISION-PACKAGE-2026-09-04.md` | A10 creates no Vercel project |
| F3 | Decide P0-023 — settled by evidence, needs only the word: keep `business.` | acceptance criterion of surface B |
| F4 | **Melipayamak key rotation** (5 min, the key is live and leaked) | **gate A4 can never go green** |
| F5 | Supabase D1→D3: restore → reset password → `pg_dump` → fill the manifest | the project cannot be deleted |
| F6 | **IRNIC/HODA → `rezervno.ir` → ArvanCloud staging** | **gate A2 can never go green** + all four golden journeys |

## Unblocked work — needs no founder decision

1. **The three hunts** — `audit/round-20/BUG-HUNT-PROMPTS.md`: the 33 `/me/*` per-user routes
   (never examined), the 95 tenant rows (listed, zero executed), and mutation on money paths.
   Needs four separate databases so parallel agents do not poison each other.
2. **M0 event substrate** — audited in round 20; this entry was **partly wrong** and is corrected
   here. Full evidence: `audit/round-20/M0-EVENT-SUBSTRATE.{md,json}`.
   - CONFIRMED: `lib/events.ts` `emit()` is a WEBHOOK dispatcher, not a log (`events.ts:35-67`),
     and exactly one of its domain events is ever called (`reservations.ts:420`).
   - CORRECTED: it declares **8** domain events, not 7 (`events.ts:20-23`).
   - CORRECTED: `recordEvent()` has 4 call sites, all in `site-orders.ts` — but the claim omitted
     the **second** writer, `recordEventsDetailed()`, called from `telemetry/route.ts:276`, which
     is the actual client-facing ingest path.
   - **REFUTED — do not repeat this one.** "Zero reservation-lifecycle events are logged" is true
     only of `platform_events`. Every reservation status transition IS durably and append-only
     logged to the `reservation_events` table by the single writer `transitionReservation()`
     (`lib/lifecycle.ts:79-136`, the write at `:125` inside the transaction), and that table is
     the real feature source the working no-show model reads (`no-show-model.ts:432-509`).
   - The genuine hole is elsewhere: **7 of 7 waitlist transitions have no durable event** (M0-009),
     and reservation *creation* itself has none (mitigated by `reservations.createdAt`).
   - Open major (M0-007): `telemetry/route.ts` takes `restaurantId` from the request body on an
     unauthenticated route. It is **not** a tenant-isolation breach — `tenantId` is derived from a
     server-side lookup at `:252` and an unknown id is stored as `null` — but it lets a client
     misattribute events, so it must be closed **before** `platform_events` gains a real ML consumer.
3. ~~**A11 is half-done and uncommitted**~~ — **DONE 2026-09-04.** Committed. `api/platform-fixture.json`
   was deleted (dead, unreferenced) and is now gitignored; before committing, 16 raw JWTs found
   embedded in `A11-RESULTS.json` had their signature segment redacted. Scope was measured, not
   assumed: they are signed with the throwaway `a11_test_*` secret from `start-api.sh:29-31`, which
   a programmatic comparison confirmed differs from both `JWT_SECRET` and `JWT_REFRESH_SECRET` in
   `api/.env` — so no production credential was exposed.
4. ~~**The dev DB `rezervno` is polluted** … Build a fresh DB instead.~~
   **This diagnosis was WRONG and is corrected here — a fresh DB would not have fixed it.**
   FIXED 2026-09-04, commit `ba29d2c`. The real cause was an incomplete cleanup hook, not dirty data:
   `lifecycle-cron.integration.test.mts`'s `beforeEach` deleted reservations but never
   `economy_ledger_entries`, and **the code under test creates that row itself**
   (`lifecycle.ts` → `processReservationEconomyEvent()` → INSERT at `economy.ts:212`). That FK is
   `NO ACTION`, so the delete failed with `23503`; because the runner imports every test into ONE
   process, that single hook produced 1424 failures. Proof it was not pollution: both blocking rows
   belonged to this file's own restaurant (`[DEMO] رستورانِ چرخه‌ی حیات`) and one was created
   **during the run itself**, at 13:49:57 that day. `after()` swallowed the error with `.catch()`,
   so rows leaked and yesterday's residue merely *looked* like pollution.
   `payments` carries the same `NO ACTION` constraint and was fixed in the same pass rather than
   waiting to become the next whack-a-mole. Result: `npm test` went from 1753 failure markers
   (1424 × `23503`) to 3, with zero `23503`.
   **The suite is still red**, but for an unrelated reason that was *hidden behind that cascade*:
   2 failures in `schema-drift.integration.test.mts` (`TIMESTAMP(3)` drift between `schema.prisma`
   and the applied DB). Not caused by that commit — its diff touches neither `schema.prisma` nor
   `prisma/sql/`. This is the next thing to triage.

## The four launch gates that stay open regardless

(a) an **executed** restore drill — `tools/restore-drill.sh` does this; one has run against
    `local/rezervno_verify` (72 tables, zero row diff). Production still needs its own.
(b) **off-host** backup copies — the `S3_*` fields in the backup service are all empty
(c) uptime + disk alerting, absorbing the reboot / disk-full / OOM-crash-loop modes.
    Round 20 moved this forward but did **not** close it: `observability/alerts.yml` now has 16
    rules (was 13) — the three fail-open security counters were wired and each proven able to
    fire with `promtool test rules`, and a new CI job `observability` validates the file, which
    nothing did before. **The gate is still open for the reason that matters: nobody is paged.**
    `docker-compose.observability.yml` runs only `prometheus` + `grafana`; there is no
    Alertmanager and no notification receiver anywhere in the repo, so all 16 rules — not just
    the new ones — fire into a UI nobody is watching. Closing this needs a founder decision on
    the channel and its credentials. Evidence: `audit/round-20/ALERTS-GAP.md`.
    Still unwired: `rezervno_slot_lock_fallback_total` (`lib/redis.ts:166`), a fourth sibling
    fail-open counter on the reservation-lock path — under investigation in round 20.
(d) the non-pausing proof — `audit/round-19/non-pausing-proof-design.json`; start P1's idle
    window the day the host exists, since it costs only calendar time
