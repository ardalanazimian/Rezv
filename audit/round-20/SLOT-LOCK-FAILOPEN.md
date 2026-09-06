# Slot-lock fail-open: is "the DB is the source of truth against double-booking" true?

**VERDICT: TRUE — but it was an unguarded truth, and it is protected by two
independent mechanisms, only one of which the comment's own history credits.
Proven live, concurrently, on a real Postgres. A Redis outage costs throughput
and error-message quality; it does not permit double-booking.**

The qualification that matters: before this pass, **deleting the property that
makes half of it true left every existing gate green.** Downgrading the
reservation transaction from `Serializable` to `ReadCommitted` kept all 11
pre-existing concurrency/lock tests passing with exit code 0 (§6, M3). The
sentence was true on 2026-09-04 and one line away from becoming false silently.

---

## 1. What the claim is, verbatim

`api/src/lib/redis.ts:156-168`:

```ts
  try {
    for (const d of delays) {
      if (d) await new Promise(r => setTimeout(r, d));
      ok = await client.set(lockKey, token, 'PX', ttlMs, 'NX');
      if (ok) break;
    }
  } catch (e) {
    log.warn('slot-lock: Redis در دسترس نیست، بدونِ قفل ادامه می‌دهیم (DB منبعِ حقیقتِ ضدِ double-booking است)', {
      key, error: (e as Error).message,
    });
    metrics.slotLockFallback.inc();
    return fn();
  }
```

Note the shape: only a **throw** from `client.set` (Redis unreachable) takes
this branch. A lock genuinely held by someone else returns `null`, falls out of
the loop, and raises `Err.lockTimeout()` at `redis.ts:169`. That distinction is
correct and is already covered by `api/tests/redis.test.mts`.

## 2. Every caller of the slot lock, and the critical section each protects

`withSlotLock` has exactly **one** production caller.

| Caller | file:line | Critical section |
|---|---|---|
| `createReservation` | `api/src/lib/reservations.ts:103` (`deps.acquireSlotLock ?? withSlotLock`), invoked at `:243` with key `resv:{restaurantId}:{slotStartISO}` (`:240`) | The `TX_MAX_RETRIES` retry loop around `placeReservation` → `db.$transaction(..., { isolationLevel: Serializable, timeout: 10_000 })` at `reservations.ts:396`, which does an in-transaction `getOccupiedTableNumbers` re-check (`:373`) and then `insertReservation`. |

Everything else that can create or move a reservation reaches it, or does not
use the lock at all:

- **Waitlist seating** — `api/src/lib/waitlist.ts:405` `acceptOffer` calls
  `createReservation` (`:467`) with `guest.tableNumber = offeredTableNumber`.
  Same lock, same transaction, **same protections**. No separate hole.
- **QR check-in** — `api/src/app/api/v1/checkin/route.ts:91` → `qrCheckIn`
  (`api/src/lib/tables.ts:190`). It takes **no lock**, assigns **no table**, and
  only transitions an *existing* reservation `confirmed → checked_in → seated`.
  Every source and target status is already inside the EXCLUDE predicate's
  status set, so the transition cannot change constraint membership and cannot
  create a new overlap. **The fail-open hole does not extend to QR check-in.**
- **Walk-in** — `createWalkin` (`api/src/lib/reservations.ts:~745`) takes **no
  lock** and uses a **default-isolation** transaction. It is protected against
  primary-table collisions by the EXCLUDE constraint only. See §8: this is where
  a real, separate defect lives.

## 3. What in the database would actually reject a second booking

### 3a. `schema.prisma` — the constraint is **not** there, and that is correct

```
$ grep -cn "block_end\|blockEnd\|EXCLUDE\|no_table_overlap" api/prisma/schema.prisma
0
```

Prisma cannot express an exclusion constraint or a generated column. `block_end`
and `no_table_overlap` are SQL-only by necessity, not by drift. (This is also
why `prisma db push` must never be run on a migrated DB — it would try to drop
`block_end`, which the constraint depends on.)

### 3b. `api/prisma/sql/` — canonical definition

`api/prisma/sql/026-consolidate-exclusion-constraint.sql:70-79`:

```sql
    ALTER TABLE reservations ADD CONSTRAINT no_table_overlap
      EXCLUDE USING gist (
        table_id WITH =,
        tsrange(slot_start, block_end) WITH &&
      )
      WHERE (
        status IN ('pending','confirmed','auto_confirmed','preparing','checked_in',
                   'running_late','arrived','seated','dining')
        AND table_id IS NOT NULL
      );
```

026 supersedes 016 and is idempotent — it only rebuilds when the live constraint
is absent or divergent.

### 3c. Live databases — the fact, not the file

Scratch DB `rezervno_slotlock` (CI-faithful recipe; `tables=72 · staff=0 ·
rls=61 · policies=0`, exit 0):

```
$ docker exec rezv-test-pg psql -U test -d rezervno_slotlock -c \
  "SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='reservations'::regclass;"
 no_table_overlap | x | EXCLUDE USING gist (table_id WITH =, tsrange(slot_start, block_end) WITH &&)
   WHERE (((status = ANY (ARRAY['pending'::reservation_status, 'confirmed'::reservation_status,
   'auto_confirmed'::reservation_status, 'preparing'::reservation_status, 'checked_in'::reservation_status,
   'running_late'::reservation_status, 'arrived'::reservation_status, 'seated'::reservation_status,
   'dining'::reservation_status])) AND (table_id IS NOT NULL)))
EXIT=0
```

Dev DB `rezervno` on `rezervno-postgres` (read-only query, polluted DB left
untouched) returned a **byte-identical** definition, exit 0. `block_end` is a
real `GENERATED ALWAYS AS (slot_end + make_interval(mins => block_buffer_minutes)) STORED`
column; `reservations.relkind = 'r'` (not partitioned, so the constraint is
global, not per-partition).

The 9 statuses in the live constraint are exactly
`ACTIVE_RESERVATION_STATUSES` in `api/src/lib/reservation-status.ts:24-34`. That
equality is now asserted as a set, not as a substring (§5).

### 3d. What the EXCLUDE constraint structurally **cannot** see

It keys on `reservations.table_id` — the *primary* table. A merged reservation
records its secondary tables only in the `merged_table_numbers` array, with no
row of their own (`api/src/lib/table-occupancy.ts:5-19` documents this). So two
rows — one with `table_id = 802`, one with `table_id = 801` and
`merged_table_numbers = {801,802}` — physically fight over table 802 while being
completely invisible to the constraint.

For that class, the only guard is the in-transaction
`getOccupiedTableNumbers` re-check **plus the `SERIALIZABLE` isolation level**.
That is the half of the claim nobody had tested.

## 4. Runtime proof — concurrent, with the lock failed open

Method: the **real** `withSlotLock` is called with a `LockClient` whose `set()`
throws `ECONNREFUSED`, so production lines `redis.ts:162-168` actually execute
(the shared `rezervno-redis` container was never touched). Ground truth is a SQL
overlap detector across primary **and** merged table numbers — never the API's
own return values.

### 4a. Deterministic write-skew (the case EXCLUDE is blind to)

Two `psql` sessions, both **read** before either **writes**; T1 books 802
directly, T2 books a merge with primary 801 and `merged={801,802}`.

**SERIALIZABLE (the product's setting):**

```
=== INTERLEAVE iso=serializable db=rezervno_slotlock ===
FIXTURE_EXIT=0
T1_PSQL_EXIT=0
T2_PSQL_EXIT=0
--- T2 OUTPUT ---
BEGIN
 num
-----
(0 rows)
psql:<stdin>:26: ERROR:  could not serialize access due to read/write dependencies among transactions
DETAIL:  Reason code: Canceled on identification as a pivot, during write.
HINT:  The transaction might succeed if retried.
ROLLBACK
--- GROUND TRUTH: physical overlaps (primary + merged) ---
 a_code | b_code | shared_table
--------+--------+--------------
(0 rows)
 code  |               table_id               | merged_table_numbers
-------+--------------------------------------+----------------------
 IL-T1 | 33333333-3333-3333-3333-333333333332 | {}
GROUNDTRUTH_EXIT=0
SCRIPT_EXIT=0
```

**READ COMMITTED (control — proves the harness really builds the race):**

```
=== INTERLEAVE iso=read committed db=rezervno_slotlock ===
T1_PSQL_EXIT=0
T2_PSQL_EXIT=0
(both BEGIN → INSERT 0 1 → COMMIT, no error)
--- GROUND TRUTH: physical overlaps (primary + merged) ---
 a_code | b_code | shared_table
--------+--------+--------------
 IL-T1  | IL-T2  |          802
(1 row)
 code  |               table_id               | merged_table_numbers
-------+--------------------------------------+----------------------
 IL-T1 | 33333333-3333-3333-3333-333333333332 | {}
 IL-T2 | 33333333-3333-3333-3333-333333333331 | {801,802}
GROUNDTRUTH_EXIT=0
SCRIPT_EXIT=0
```

**Self-reported error:** the first control run passed `'read committed'` with
quotes, which made `BEGIN ISOLATION LEVEL 'read committed'` a syntax error, so
the two statements ran in autocommit rather than in explicit transactions. It
produced the same overlap, but the evidence was not what it claimed to be, so it
was re-run correctly. The output above is the corrected run.

### 4b. Application-level concurrency, real fail-open branch

`Promise.allSettled` over the real `createReservation`. Raw per-scenario output
(from the scratch probe; the same scenarios are now standing tests, §5):

```
{"scenario":"S1a-direct-failopen","n":2,"lock":"FAIL-OPEN (redis down)","ok":1,"codes":{"TABLE_CONFLICT":1},"db_active_rows":1,"fallback_delta":2}
{"scenario":"S1b-direct-failopen","n":10,"lock":"FAIL-OPEN (redis down)","ok":1,"codes":{"TABLE_CONFLICT":9},"db_active_rows":1,"fallback_delta":3}
{"scenario":"S1c-direct-control","n":10,"lock":"REAL redis lock","ok":1,"codes":{"TABLE_CONFLICT":9},"db_active_rows":1,"fallback_delta":0}
{"scenario":"S2-merge-vs-direct-failopen","lock":"FAIL-OPEN (redis down)","ok":1,"codes":{"SLOT_FULL":1},"db_active_rows":1,"rows":[{"num":802,"merged":[]}]}
{"scenario":"GROUND-TRUTH","physical_overlaps":0,"detail":[]}
{"scenario":"FALLBACK-EVIDENCE","down_client_set_calls":24,"counter":"rezervno_slot_lock_fallback_total 24"}
```

Control arm (`REAL redis lock`, `fallback_delta: 0`) behaves identically:
exactly one winner. The lock changes *which error the losers see* and how much
retry pressure hits Postgres — not the outcome.

**Self-reported error #2:** the first version of the probe put every scenario on
one restaurant at 60-minute spacing while a booking blocks for 90+15=105 minutes,
so scenario N collided with scenario N−1's winner and reported "0 winners" as 7
failures. Those were fixture bugs, not product bugs. Every scenario now gets its
own restaurant. Raw first-run output is in the session scratchpad
(`probe-2.log`); the corrected design is what shipped as the test.

## 5. The standing gate — `api/tests/slot-lock-failopen-double-booking.test.mts`

Imported at `api/tests/_all.runner.mts:192`:

```
192:import './slot-lock-failopen-double-booking.test.mts';
```

Completeness check against the directory listing (the trap that once hid three
files):

```
$ comm -23 <(ls tests/*.test.mts | sed 's|tests/||' | sort) \
           <(grep -oE "\./[A-Za-z0-9._-]+\.test\.mts" tests/_all.runner.mts | sed 's|\./||' | sort -u)
COMM_EXIT=0                     # empty = no orphan files
counts: files=155 imports=155
```

Four layers, 7 tests:

1. **Live constraint** — `no_table_overlap` exists, is `contype='x'`, keys on
   `table_id` + `tsrange(slot_start, block_end)`, and its status set is compared
   for **set equality** with `ACTIVE_RESERVATION_STATUSES`. Removing one status
   (the historical C1 bug) is a partial mutation that "does the constraint
   exist?" would never catch.
2. **Live isolation level** — an uncommitted blocking row parks the product's
   own transaction inside `db.$transaction`, and the test counts
   `pg_locks WHERE mode='SIReadLock' AND relation='reservations'::regclass`.
   Non-zero only if the product transaction is genuinely `SERIALIZABLE`. No
   polling, no timing race.
3. **Behaviour under real fail-open** — 10 concurrent bookings of one table and
   the merge-vs-secondary race; exactly one winner, zero physical overlaps,
   every loser carries a domain error code (not a raw 500).
4. **Deterministic write-skew with a positive control** — SERIALIZABLE must
   abort one side with `could not serialize access`; the same interleave at
   READ COMMITTED must produce **exactly one real overlap**. If the control
   stops producing an overlap, the harness has stopped building the race and
   the SERIALIZABLE test's green becomes meaningless — so that is asserted and
   fails loudly.

Absence of the subject is an error everywhere: missing constraint → fail;
missing fixture rows → fail; fail-open branch never entered → fail
(`setDelta >= 1`); observation window never reached → fail.

Baseline run of the file alone: **7 tests, 7 pass, 0 fail, exit 0.**

Inside the full suite (`npm test` = `tsx --test tests/_all.runner.mts`), all 7
are counted in the totals:

```
ℹ tests 1542
ℹ suites 365
ℹ pass 1542
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 288123.5779
NPM_TEST_EXIT=0
```

**Honesty note on that number:** I did **not** measure the pre-change total on
this database, so "1542 − 7 = 1535" is arithmetic, not evidence. The evidence
that the file actually executed inside the runner is the seven `✔` lines below,
taken from that same run's output — plus the fact that earlier full runs of the
same tree failed *on one of these very tests* (`full-test-3.log:3022`), which a
never-executed file cannot do. Also note the task brief's stated baseline of
1529 does not match this tree; other agents added tests to `main` in parallel.

Their individual lines in that run:

```
  ✔ no_table_overlap وجود دارد و مجموعه‌ی وضعیت‌هایش دقیقاً برابرِ ACTIVE_RESERVATION_STATUSES است (332.0394ms)
  ✔ ستونِ block_end یک ستونِ generatedِ واقعی است (پایه‌ی محاسبه‌ی بازه‌ی بلاک) (360.5457ms)
  ✔ در حینِ باز بودنِ تراکنشِ createReservation، SIReadLock روی reservations وجود دارد (512.8592ms)
  ✔ ۱۰ درخواستِ هم‌زمان روی یک میزِ مشخص: یک ردیف، صفر تداخلِ فیزیکی، و هر ۱۰ تا واقعاً از شاخه‌ی fail-open رد شدند (766.4133ms)
  ✔ merge و رزروِ مستقیم هم‌زمان روی یک میزِ *ثانویه* — جایی که EXCLUDE ساختاراً کور است (1271.2433ms)
  ✔ کنترلِ مثبت: همین اینترلیو در READ COMMITTED یک double-bookingِ واقعی می‌سازد (1501.1286ms)
  ✔ SERIALIZABLE همان اینترلیو را رد می‌کند: یک ردیف، صفر تداخل، و بازنده ۴۰۰۰۱ می‌گیرد (1727.0419ms)
```

**Self-reported error #4 — layer 2 was flaky three times, and only the full
suite ever showed it.** Each version passed standalone and failed inside
`npm test`. The three causes, all mechanism bugs, none of them fixed by
weakening the assertion:

| v | Mechanism | Why it failed under load | Evidence |
|---|---|---|---|
| 1 | fixed 2.5s observation window | under load the product had not reached its INSERT yet, so no SIReadLock existed | full-test.log:4009 |
| 2 | sample when `pg_locks WHERE NOT granted AND database = …` sees a waiter | `pg_locks.database` is **NULL** for `transactionid` locks — exactly the lock an EXCLUDE wait takes — so the loop never matched anything | 2 consecutive standalone runs, full poll counts, 0 observations |
| 3 | sample when `pg_stat_activity` shows any session waiting on a Lock | in the busy full-suite process an *unrelated* session was waiting, so it sampled before the product's transaction opened | full-test-2.log:3022 |

Final mechanism: an explicit gate (product starts only after the blocker's
INSERT has actually landed, released in a `finally` so an abort can never strand
it), polling of **the subject itself** across the window, and a lock filter that
covers `reservations` *and its indexes* — SIReadLocks land on the index, not the
heap, once the planner switches to an index scan on a populated database. Plus a
diagnostic dump on failure, so a recurrence produces data instead of a
hypothesis. Under mutation M3 that dump now reads `SIReadLockهای موجود: []` over
196 samples with the product parked for 8040ms — a far stronger negative than
the single sample the first version took.

**Self-reported error #3:** the first version asserted
`downSetCalls - before === N`. That is a *timing* property, not a safety
property — the pre-lock occupancy check at `reservations.ts:191` rejects late
arrivals before they ever reach the lock, so the count can legitimately be < N.
Mutation M2 exposed it. The assertion is now the exact invariant
(`fallbackDelta === setDelta`, `setDelta >= 1`), which is strictly harder to
satisfy accidentally and is not flaky. **No assertion was weakened to make a
test pass** — this one was replaced because it was measuring the wrong thing.

## 6. Falsifiability — every mutation with its exit code

| # | Mutation | Where | Result | Exit |
|---|---|---|---|---|
| baseline | none | — | 7 pass / 0 fail | **0** |
| M1 | `ALTER TABLE reservations DROP CONSTRAINT no_table_overlap` | live DB | 5 pass / **2 fail** (layer 1: "0 پیدا شد"; layer 2 collaterally, since it uses the constraint to park the tx) | **1** |
| M1-revert | re-run `sql/026` | live DB | constraint restored | **0** |
| M2 | rebuild constraint with `'dining'` removed | live DB | 5 pass / **2 fail** (layer 1 set-equality: "بازگشتِ باگِ C1") | **1** |
| M2-revert | re-run `sql/026` (`grep -c dining` → `1`) | live DB | restored | **0** |
| M3 | `Serializable` → `ReadCommitted` | `reservations.ts:396` | 5 pass / **2 fail** — layer 2 (`بیشینه: 0` over 196 samples, `SIReadLockهای موجود: []`) **and** layer 3, which produced a genuine product-path double-booking: `دقیقاً یک برنده انتظار می‌رود، 2 تا شد` | **1** |
| M3 — **existing suite under the same mutation** | `redis.test.mts` + `table-merge-occupancy-concurrency.test.mts` | — | **11 pass / 0 fail** | **0** |
| M3-revert | `git checkout` | — | line 396 back to `Serializable` | **0** |
| M4 | delete `metrics.slotLockFallback.inc()` | `redis.ts:166` | 5 pass / **2 fail** (fallback-evidence assertions) | **1** |
| M4-revert | `git checkout` | — | line 166 restored | **0** |
| M5 | delete the `merged_table_numbers` UNION branch | `table-occupancy.ts:43-49` | **not caught** by the new file — 7 pass, 3 consecutive runs | **0** |
| M5 — existing suite | `table-merge-occupancy.test.mts` | — | 8 pass / **1 fail** ("رزروِ مستقیمِ میزِ ثانویه‌یِ همون ترکیبِ فعال (۹۰۲) رد می‌شود") | **1** |
| M5-revert | `git checkout` | — | restored | **0** |

**The M3 row is the finding of this pass.** The whole existing concurrency and
lock suite — including the describe literally named *"C2 — قفلِ Redis کاملاً
fail-open … DB به‌تنهایی هنوز محافظت می‌کند"* — stays green with `SERIALIZABLE`
deleted. It passes because every scenario it builds is one the EXCLUDE
constraint alone can catch. Layer 2 of the new file closes that.

**M5 is reported as a blind spot in my own test, not hidden.** The
merged-secondary occupancy branch is covered by the pre-existing sequential test
`api/tests/table-merge-occupancy.test.mts`, which does go red (exit 1). The
concurrent version of that mutation is timing-dependent and I chose not to write
a flaky assertion for it.

## 7. Blast radius of a Redis outage on the reservation path

Not exploitable, and no attacker is needed or sufficient.

| Effect | Status |
|---|---|
| Double-booking of the primary table | **Impossible** — EXCLUDE constraint (proven M1 + §4b) |
| Double-booking of a merged secondary table | **Impossible** — SERIALIZABLE SSI + in-tx re-check (proven §4a) |
| Waitlist seating (`acceptOffer`) | Same path, same protections |
| QR check-in | Not affected — no lock, no table assignment, no status-set change |
| Losers' error codes | Degrade in quality: more `409 SLOT_FULL` / `TABLE_CONFLICT` / `409 CONCURRENCY_RETRY`, fewer clean `423` |
| Throughput | Degrades: without the lock every concurrent attempt reaches Postgres, so SSI aborts and `TX_MAX_RETRIES` backoff replace a cheap Redis round-trip |
| Latency | Separately documented at `redis.ts:28-56`: 0.02s → 8.5–22s on cached endpoints before the command timeouts were added |

## 8. Beyond the mandate — a real hole the slot lock has nothing to do with

`createWalkin` (`api/src/lib/reservations.ts:~745`) validates only that the
table exists, belongs to the restaurant, is active and not in maintenance. It
**never calls `getOccupiedTableNumbers`**, and its transaction
(`createWalkinTx`, `db.$transaction(...)` with no `isolationLevel`) runs at
READ COMMITTED. Its only anti-double-booking guard is therefore the EXCLUDE
constraint — which is blind to merged secondary tables.

So a staff member can seat a walk-in on a table that is already physically
occupied as the **secondary** table of an active merged reservation. No
concurrency, no attacker, no Redis outage: a plain sequential operation on the
happy path. Live result in §8a below.

Direction matters: the reverse is safe — `createReservation`'s merge path *does*
see walk-ins, because a walk-in is `status='seated'` with a real `table_id`.

### 8a. Live result

Sequential probe on the clean scratch DB, with a positive control first:

```
{"step":"control-primary-841","outcome":"REJECTED code=TABLE_CONFLICT"}
{"step":"walkin-on-merged-SECONDARY-842","outcome":"ACCEPTED code=RZJGXRVX2 table=842"}
{"step":"ground-truth","physical_overlaps":1,"detail":[{"num":842,...}]}
{"step":"rows","rows":[{"code":"RZJGXRVX2","num":842,"merged":[]},
                       {"code":"WKM-845f","num":841,"merged":[841,842]}]}
WALKIN_PROBE_EXIT=0
```

The control rejects (so the EXCLUDE constraint is live and the probe is valid);
the secondary-table walk-in is **accepted**, and the ground-truth detector finds
one real physical overlap on table 842. Decision package in
`SLOT-LOCK-FAILOPEN.json` — **not implemented**, needs architect sign-off.

## 9. Should `rezervno_slot_lock_fallback_total` be alerted now?

**Yes — as a `warning`, describing degraded reservation throughput, explicitly
NOT as a correctness alarm.**

Round-20 wired its three siblings and deliberately left this one dark
(`audit/round-20/ALERTS-GAP.md` §7 and §8.2), because it was "under active
investigation elsewhere" — this investigation. The result of the investigation
is what makes the rule writable, because it fixes the annotation text:

- The counter's meaning is now *proven*: "reservations are being created without
  the optimistic lock, and correctness is still guaranteed by
  `no_table_overlap` + `SERIALIZABLE`." An on-call engineer who sees it must not
  start hunting for double bookings.
- It is the only signal that says specifically **the money path is degraded**.
  `RateLimitRedisFailOpen` and `BanCheckFailOpen` (`observability/alerts.yml:109`
  and `:124`) already fire on the same Redis outage, so this rule is partly
  redundant as a *detector* — but not as a *description of impact*.
- Same shape as its siblings, and the `for` > `increase` window reasoning at
  `alerts.yml:96-108` applies unchanged (single blip stays silent, sustained
  outage fires).
- `observability/alerts.yml:120-121` already contains the sentence
  "`rezervno_slot_lock_fallback_total`، lib/redis.ts:166 — نویسنده‌اش اما هنوز
  آلارم ندارد" inside another rule's description. That is documentation of a
  gap living inside a production artefact; it should become a rule.

Severity should be `warning`, not `critical` like the two siblings, precisely
because correctness is not at risk — and that difference is now evidence-backed
rather than assumed.

## 10. What I did not do

- No commit. Working tree changes: two new files
  (`api/tests/slot-lock-failopen-double-booking.test.mts`, this report + its
  JSON) and one added import line in `api/tests/_all.runner.mts`. All source
  mutations were reverted and verified with `git status --porcelain api/src/lib/`
  returning empty.
- No alert rule was added — that is round-20's scope and needs its own
  falsifiability pass with `promtool` against `observability/alerts.test.yml`.
- No fix for §8. It touches the reservation lifecycle, so it needs architect
  sign-off. Decision package in `SLOT-LOCK-FAILOPEN.json`.
- `rezervno_a11` and the dev DB `rezervno` were not modified; the dev DB was
  only read.

## 11. Correction to this report, and a live environment blocker

**Correction — I stated a cause I had not established.** Mid-investigation a
scratch probe stopped producing output and I attributed it, in this report and
in a source comment, to a cross-transaction gate in my Prisma interleave that
never resolves when one side aborts. That was a hypothesis presented as a
finding. When the abandoned process finally reported, its raw output was:

```
tee: 'standard output': No space left on device
tee: '…/scratchpad/probe-3.log': No space left on device
[exited with code 1]
```

It never printed its own `PROBE_EXIT` marker (`grep -c PROBE_EXIT` → `0`), so
the process died on a full disk / blocked stdout pipe, not on my gate. The
gate-deadlock explanation is **withdrawn**. The gateless interleave design is
kept because it is correct on its own merits, not because that hypothesis was
confirmed; both source comments have been corrected to say so.

Nothing else in this report depends on that claim — the interleave evidence in
§4a comes from `psql`, not from that probe.

**Live blocker: the machine is out of disk.**

```
$ df -h /c
Filesystem      Size  Used Avail Use% Mounted on
C:              119G  119G     0 100% /c
```

At zero bytes the agent harness itself failed
(`ENOSPC: no space left on device, open '…/tasks/….output'`) and a plain
`psql -c "SELECT count(*)"` against the scratch DB exceeded a 120 s timeout.
I freed ~110 MB of my own and stale temp task outputs purely to be able to write
this correction; I did **not** attempt to reclaim the 119 GB, because deciding
what to delete (Docker images and volumes, `node_modules`, `.next` caches) is an
ops decision, not mine to take unilaterally.

**What this does and does not put in doubt.** The final full-suite run completed
and its wrapper wrote the last line of the log, `NPM_TEST_EXIT=0`, after
`ℹ pass 1542 / ℹ fail 0` — a truncated log could not contain its own final line,
so that result stands. What I cannot rule out is that disk pressure contributed
to the earlier layer-2 flakes I attributed in §5 to the fixed window, the
`pg_locks.database` NULL and the noisy proxy. Those three are mechanism defects
that are true independently — the `transactionid`/NULL behaviour and index-level
SIReadLocks are properties of Postgres, not of this machine — and mutation M3
still drives the final version red with 196 samples and an empty lock dump. But
"the fix is why it is green" is, honestly, **not fully separable** from "the disk
freed up", and I am not going to claim it is. Re-running the suite on a machine
with headroom is the outstanding verification.

## 11b. Two cross-session facts discovered while closing out

**My §8 walk-in finding has been escalated by a parallel test-integrity session,
and I have not verified their result.** The shared memory namespace now records
that racing `createWalkin` against a merge booking with the **real, unmodified**
`withSlotLock` (no dependency injection, real Redis) produces double-bookings —
one note says 6/6, another 14/15 — and reclassifies R20-SLOTLOCK-03 as **P0**.
Their added lesson is that injecting a fake lock for "determinism" had handed the
merge side a zero-latency path it never has in production, so the DI version came
back 0/8 and 0/15 "safe". That is a sharper result than my sequential probe and it
is consistent with it, but it is **their claim, not my measurement** — I did not
run it, and the two numbers are not identical. Treat it as a lead to re-verify,
not as established, and note it raises the severity of the decision package.

**This work was committed by another session, against my "do not commit"
instruction.** `api/tests/slot-lock-failopen-double-booking.test.mts` landed in
`036b453`; my misplaced memory directory was swept into `81ed857`. I did not make
either commit. The corrections in §11 are uncommitted modifications on top of
`036b453`, and the working tree now also contains a deletion of
`api/.claude/agent-memory/test-integrity/` — those four files were mine, written
to the wrong path (repo convention is the tracked root `.claude/agent-memory/<ns>/`,
where `census/` and `launch-ops/` live). Byte-identical copies now sit at
`.claude/agent-memory/test-integrity/`, verified with `diff -q` before removal, and
the originals remain in git history.

## 12. One thing to flag for whoever schedules agents

Full-suite run #3 failed `schema-drift.integration.test.mts` with
`ALTER TABLE "restaurants" ADD COLUMN "drift_test_marker_zzz" TEXT`. That test
does not inject any marker — it runs `prisma migrate diff` between
`api/prisma/schema.prisma` **on disk** and the database. So another process
transiently wrote that column into the shared `schema.prisma` during my run,
almost certainly a concurrent agent doing its own falsifiability injection on
that same gate. The string exists nowhere in the repo now
(`grep drift_test_marker` → no files) and `git status --porcelain
api/prisma/schema.prisma` is clean; the final run passed 1542/1542.

Databases are partitioned per agent, but **the working tree is not**. Any gate
that reads a repo file as its subject — `schema-drift`, the standalone-bundle
`--check`, the design-system `--check` — will produce false reds when two agents
run mutation rounds at the same time. Worth a scheduling rule rather than an
allowlist.
