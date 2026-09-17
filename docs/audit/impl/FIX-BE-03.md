# FIX-BE-03 — FP-009 §5/§6 gates, adopted from the rescue, reviewed, widened to all nine ledgers

- **Date:** 2026-09-17 · **Session:** Implementation Team `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`; Red Team `rezv-31` attacks it first
- **What it needs from its reader:** try to beat both gates without them going red. **Status: submitted.**
- **Branch:** `impl/rezv-85-090-append-only` (second commit, on top of FIX-BE-02)

## The claim fixed

CEO P0-3 / Red Team (`rezv-31` BRIEF §Gates): the FP-009 §5 gate "must (a) exist, (b) cover **every**
table the mandate calls append-only, (c) assert `BEFORE TRUNCATE FOR EACH STATEMENT` too, and (d) be
falsifiable". Measured on `99065a7`: no gate existed. `grep -ic trigger` over the schema-drift script and
both baselines was 0, and no test asserted trigger existence. The dead Backend session's §5/§6 work
existed only as an unreviewed rescue (`backup/rescue-0916/fp009-guards-wt-rezv-c9 @ 5ae45a2`), covering
`points_ledger` alone.

## Review of the rescue — what I kept, what I changed, one wrong suspicion retracted

- **Kept:** the design of layer 5 (behavioural trigger classes by `tgtype` bits plus `tgenabled = 'O'`,
  FK by relation and column rather than name, an "empty answer = broken check" rule), and the §6 static
  guard with its self-test and exit-2 "gate did not run".
- **Widened (§5):** 1 table → **9** (points_ledger + the 8 of migration 090), and 1 FK → **2**
  (`points_ledger.user_id` per FP-009, `sms_transactions.restaurant_id` per D-16). A missing table now
  fails by name instead of reading as zero triggers.
- **Widened (§6):** `session_replication_role` is not the only way app code can switch a trigger off.
  `ALTER TABLE … DISABLE TRIGGER`, `ENABLE REPLICA TRIGGER` and `DROP TRIGGER` do the same, and the
  rescue's pattern missed all three. They are added, with self-test samples for each.
- **Wired into CI:** the rescued `.mjs` was untracked and **not** in `ci.yml`, so it would never have
  run. It is now a step in the `design-system` job. Layer 5 rides the existing `schema-drift` job.
- **Retracted before claiming:** I first suspected the rescued layer would be permanently red on the
  Prisma-side DB (`db push` only, no triggers). Reading on showed the script runs `apply-sql.sh` on that
  DB just before the CHECK layer, and layer 5 sits after it, so the rescue's comment was right.
  Recorded because it nearly became a false finding.
- **Caught by the self-test during this work:** my first widened pattern was written through a shell,
  and `\b` landed in the file as a **backspace byte** (`^H`). The guard's own self-test refused to run
  (exit 2) instead of passing. It was rewritten with a file tool; `check-control-bytes` exits 0.

## Proofs — tested

### Layer 5 (`tools/check-schema-drift.sh`)

The layer's bytes (lines 330–391) are extracted verbatim by a harness and run against named databases,
because a full script run builds two schemas from zero (~30 min each run). `psql` is not on this host, so
a shim forwards to `psql` inside the Postgres 17 container. Both are in the session scratchpad, not the repo.

| Case | DB state | Result |
|---|---|---|
| Control | 090 applied (both DBs) | falls through · **exit 0** |
| Pre-090 | candidate schema without 090 | **exit 1**: names `reservation_events` TRUNCATE, `audit_logs` UPDATE/DELETE/TRUNCATE, … |
| M1 | `DROP TRIGGER coupon_redemptions_no_truncate` (prod DB) | **exit 1**: `coupon_redemptions: … BEFORE TRUNCATE (statement) نیست` |
| M2 | `DISABLE TRIGGER campaign_logs_no_update` (CI DB) | **exit 1**: `campaign_logs: … BEFORE UPDATE (ردیفی) نیست` |
| M3 | `sms_transactions` FK → ON DELETE CASCADE (prod DB) | **exit 1**: `… باید RESTRICT ('r') باشد، هست: 'c'` |
| M4 | `points_ledger` FK → ON DELETE CASCADE (CI DB) | **exit 1**: same message for `points_ledger.user_id` |
| M5 | `ENABLE REPLICA TRIGGER audit_logs_guard_delete` (prod DB) | **exit 1**: `audit_logs: … BEFORE DELETE (ردیفی) نیست` (tgenabled = R) |
| M6 | `DROP TRIGGER platform_events_guard_delete` (CI DB) | **exit 1** |

**End-to-end run of the whole script** on the committed tree (both schema paths built from zero; `ADMIN_URL` on this session's Postgres 17; `psql` via the shim), 00:10–00:34 UTC: `✓ بدونِ انحراف + دفترهای فقط-افزودنی برقرار (۹ جدول با هر سه کلاسِ تریگرِ فعال، ۲ FKِ RESTRICT) — … 827 ستون، 77 کلیدِ خارجی، 211 ایندکس، 14 قیدِ CHECK · baseline: 43 FK + 1 ایندکس` · **DRIFT_EXIT=0**. No «baseline کهنه شده» notice, so removing the `sms_transactions` baseline line in FIX-BE-02 was exact. The temporary `_drift_*` databases were cleaned up by the script's trap (0 left, measured).

### §6 (`tools/check-session-replication-role.mjs`)

| Case | Result |
|---|---|
| Clean `api/src` (269 files) | **exit 0**; self-test matches all 8 samples |
| Inject `ALTER TABLE audit_logs DISABLE TRIGGER ALL` into a temp file under `api/src` | **exit 1**, file:line printed |
| Inject `SET LOCAL session_replication_role = 'replica'` | **exit 1** |
| Inject `enable replica trigger` (lower case) | **exit 1** |
| Temp file removed | **exit 0**; `git status api/src` clean |
| Broken pattern (the backspace-byte accident above) | **exit 2**, "gate did not run" |

## What I did not verify

- The gate on **Linux CI**: the `schema-drift` job needs its Postgres service; not run here.
- A regex cannot see a string built by concatenation (`'DISABLE ' + 'TRIGGER'`). Stated in the
  guard header; not covered.
- `api/tests`, migrations and manual `psql` are out of §6's scope by design (the same scope the rescue declared).
- The SUPERUSER door (P0-022) stays open; neither gate claims otherwise.
