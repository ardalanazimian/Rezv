# FIX-BE-02 — migration 090: eight "append-only" ledgers and logs made actually append-only (RT-25 · AO-1..3 · D-16)

- **Date:** 2026-09-17 · **Session:** Implementation Team `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`; Red Team `rezv-31` attacks it first (the CEO said they are waiting)
- **What it needs from its reader:** attack 090 (TRUNCATE, replica role, SET NULL, the two retention
  guards), and confirm or overrule the design decision in §SET NULL. **Status: submitted.**
- **Branch:** `impl/rezv-85-090-append-only`, based on `8cdc6e9` (the BE-01 fix on top of candidate `99065a7`)

## The claim fixed

- **RT-25** (CEO P0-2): `reservation_events` had only row-level UPDATE/DELETE triggers
  (`api/prisma/sql/082-reservation-events-ml-substrate.sql:102-110`). A row trigger never fires on
  `TRUNCATE`, so one statement emptied the ML event substrate.
- **AO-2 / AO-3** (Red Team `rezv-31`, `origin/redteam/retest-2026-09-16 @ e32e200`, INTEGRITY.md §1–2):
  `audit_logs`, `economy_ledger_entries`, `sms_transactions`, `campaign_logs`, `platform_events`,
  `coupon_redemptions` and `reward_redemptions` had **no** enforcement at all. Their live probe rewrote
  a `payment.refund_required` audit row to `nothing_happened` and then deleted it; that row is the
  evidence RT-13 relies on.

## Root cause and class

- **Root cause:** "append-only" existed as prose and comments, not as a DB property. Each table was
  protected (or not) by whoever wrote its migration, and only one author ever wrote triggers.
- **Class:** *integrity promised by convention, enforced nowhere, and gated by nothing.* The gate half of
  the class is FIX-BE-03 (schema-drift layer 5 and the static guard). The TRUNCATE half is its own
  sub-class: row triggers look complete and are not.

## Write-path map (measured before writing, `git grep` on `99065a7`)

| Table | UPDATE path in `api/src` | DELETE path in `api/src` | TRUNCATE | FK into it |
|---|---|---|---|---|
| audit_logs | none | `maintenance/retention/route.ts:41` (`created_at < now() - 1 year`) | none | none |
| platform_events | none | `lib/platform-events.ts:209` (`ingested_at < now() - N days`, N from env, 90/180/400) | none | none |
| economy_ledger_entries · campaign_logs · coupon_redemptions · reward_redemptions | none | none | none | RESTRICT / none |
| sms_transactions | none | none | none | `restaurants` **ON DELETE CASCADE** |
| reservation_events | none | cascade from `reservations` only (082 guard) | none | CASCADE |

A haiku sweep first reported "0 test cleanup paths" for these tables. That was **wrong**: `git grep`
found 33 sites, and the per-file run below proves which of them actually break.

## The diff

- `api/prisma/sql/090-append-only-ledgers.sql` (new, idempotent):
  - `BEFORE TRUNCATE … FOR EACH STATEMENT` on all 8 tables.
  - `BEFORE UPDATE` (row) on the 7 without one.
  - Unconditional `BEFORE DELETE` on `economy_ledger_entries`, `campaign_logs`, `coupon_redemptions`,
    `reward_redemptions` and `sms_transactions`.
  - `audit_logs`: DELETE allowed only for `created_at < now() - 1 year`, exactly the retention rule.
  - `platform_events`: DELETE allowed only for `ingested_at < now() - 90 days`, the floor of the
    smallest shipped tier (CEO ruling). The column is `ingested_at` because the table has no
    `created_at` and the pruner filters on `ingested_at`; the CEO accepted that correction.
  - **D-16:** `sms_transactions.restaurant_id` FK → `ON UPDATE CASCADE ON DELETE RESTRICT`.
- `api/prisma/schema.prisma`: `SmsTransaction.restaurant` `onDelete: Cascade` → `Restrict`, so both
  schema paths build the same FK.
- `tools/schema-drift-fk-baseline.txt`: removed `sms_transactions(restaurant_id) -> restaurants upd=c del=c`.
  After 090 both paths are identical, so that recorded drift no longer exists.
- `api/tests/append-only-ledgers.integration.test.mts` (new, 32 tests), imported in `_all.runner.mts`.
  Every destructive probe runs inside an always-rolled-back transaction, so a missing guard fails the
  test instead of wiping a table for the rest of the suite. 089's test lacked this.
- Test cleanups rewritten FP-009 §4-style, meaning the rules are not loosened for tests (14 files):
  fraud, lifecycle-cron, ml-substrate-m0, telemetry-retention, audit-write-durability, coupons,
  sms-balance, business-panel-contract, admin-panel-contract, admin-branches, staff-invite-flow,
  provision-slug-validation, table-qr-regenerate, feature-flags.

## §SET NULL — a decision taken, with the alternative rejected

Four FKs into these tables are `ON DELETE SET NULL` (measured on the production-shape DB):
`economy_ledger_entries(reservation_id)`, `economy_ledger_entries(restaurant_id)`,
`reward_redemptions(result_coupon_id)` and `reward_redemptions(result_gift_card_id)`. SET NULL is an
**UPDATE** on the child row, so after 090, deleting a reservation or restaurant that has economy rows,
or a coupon or gift card that was a reward result, is **rejected**.

- **Production impact: none measured.** `api/src` contains **zero** deletes of those parents
  (positive control: `.coupon.update|create` → 3 matches).
- **Rejected alternative:** allowing the UPDATE when it only nulls those FK columns. It would let any
  code null `economy_ledger_entries.reservation_id`, which is half of `@@unique([reservationId, kind])`,
  the key that stops a second credit for the same reservation. That reopens a double-credit.
- Pinned by a new test in `ml-substrate-m0`: a user's no_show reservation with ledger rows cannot be
  deleted.

## Proofs — tested

Environment: own Postgres 17 containers. The `tmpl_*` templates are `CREATE DATABASE … TEMPLATE`
snapshots taken immediately after a from-zero build with CI's three commands. Every run below started
from a fresh restore.

| Step | Result |
|---|---|
| **RED**: new test on a DB **without** 090 (`tmpl_99065a7`, 5 triggers) | tests 32 · pass 5 · fail 27 · **exit 1**. Every red is «انجام شد (و فقط به‌خاطرِ rollbackِ پروب برگشت)» or the missing-trigger class; the 5 passes are controls plus 082's existing UPDATE guard |
| Apply 090 to that DB, then **apply it again** | both `Script executed successfully`, exit 0 (idempotent); triggers 5 → 27 |
| **GREEN** on that DB | tests 32 · pass 32 · fail 0 · **exit 0** |
| From-zero build with the new `schema.prisma` + all SQL incl. 090 (`FRESHDB_OK`, then snapshot `tmpl_090`) | exit 0 |
| First full suite on it | **cascade failure**: 1829 tests red from `fraud.integration.test.mts:84`, a module-level `beforeEach` that runs before *every* test in the one-process runner and deleted `coupon_redemptions`. Stopped and triaged; not a result |
| Per-file run of all 109 candidate test files, each alone on a fresh clone | 96 pass · **13 fail** (after fraud's rewrite), each failing line named |
| The 13 + fraud + new test, rewritten, each alone on a fresh clone | **15/15 files exit 0** (e.g. lifecycle-cron 17/17, ml-substrate-m0 13/13, fraud 20/20, append-only-ledgers 32/32) |
| `npx tsc --noEmit` · `npm run lint` | exit 0 · exit 0 (one unused variable from a rewrite fixed first) |
| **Full api suite** on a fresh `tmpl_090` clone (`npm test`, runner-completeness pretest included) | tests 1891 · suites 451 · pass 1891 · fail 0 · cancelled 0 · **SUITE_EXIT=0** (611 s). 1858 on the candidate + 32 (new file) + 1 (new ml-substrate test) = 1891 |
| The 18 node guards `ci.yml` calls, plus the new §6 guard from FIX-BE-03, on the staged tree | all **exit 0** |

Mutation proofs for the **gate** that watches these triggers are in FIX-BE-03.md: 6 DB-state
mutations, each exit 1.

## What I did not verify

- **Linux / CI.** Windows only. CI does not run on `impl/*`.
- A **production** database: whether 086–089 are applied anywhere is still UNKNOWN (U-1). 090 has
  only been applied to test databases.
- The SUPERUSER door: `session_replication_role = replica` disables every trigger. The app connects
  as owner (P0-022). 090 does not close that door and does not claim to.
- Concurrency: triggers are per-row/statement and not timing-dependent, but no concurrent writer test
  was run against them.
- The module-level hook class (15 files with `beforeEach`/`afterEach` at file scope) was **not** fixed
  beyond the two that 090 broke. It is its own backlog row.
