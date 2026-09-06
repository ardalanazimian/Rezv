# Round 20 — Gate honesty: `check-schema-drift.sh` preflight + `gate-inventory.mjs`

Machine: `DESKTOP-8DAJNO5`, win32 10.0.26200, node v24.20.0. Repo root:
`c:/Users/Asus/Desktop/rezv3/rezervnofullsource`. Branch `audit/launch-hardening`. Date: 2026-09-04.
**Not committed** — working-tree changes only, per instruction.

---

## 0. A correction to the task's own premise (zero-trust runs upward too)

The brief states: *"`CLAUDE.md` lists this among the mandatory pre-push gates."* I checked this
directly (`grep -n "drift" CLAUDE.md`) and it is **not accurate as written**:

- `CLAUDE.md` line 24 names `schema-drift.integration.test.mts` — a *different* artifact
  (`api/tests/schema-drift.integration.test.mts`) that uses **Prisma Client and the Prisma CLI only**
  (`db.$queryRaw`, `prisma migrate diff --script`). It has **no `psql` dependency at all** — I read the
  whole file to confirm (`api/tests/schema-drift.integration.test.mts:1-124`). It runs as part of
  `npm test`, gate item 3 in CLAUDE.md's list.
- `tools/check-schema-drift.sh` (the file that actually fails with `psql: command not found`) was
  **not named anywhere in `CLAUDE.md`** before this change. It is real and it does gate merges — it is
  the `schema-drift` job in `.github/workflows/ci.yml:145`, and the gates section's own header says
  "همه در CI هم هستند — merge-on-green" (everything here is also in CI — merge-on-green) — but the
  numbered list itself (items 1–5) never mentioned it.

So the actual defect was sharper than described: `CLAUDE.md` didn't document an unsatisfiable
obligation — it **omitted a real, CI-enforced, merge-blocking gate entirely**, leaving no record that
it exists or what it needs. Per the constitution ("fix what the directive named *and* what it
missed"), I fixed the omission (added it as item 6, see §4) rather than only annotating line 24, which
would have misattributed the `psql` dependency onto a script that doesn't have it.

A live coordinator message during this session sharpened the bar further, before I wrote the edit:
*"does the edit change what is required of anyone?"* Annotating an existing obligation is allowed;
softening it into best-effort/optional/skippable is a founder call, not mine. I applied that test — see
§4 for why the edit passes it.

---

## 1. Every external dependency `check-schema-drift.sh` actually invokes

Read the whole file (`tools/check-schema-drift.sh`, 256 lines pre-edit). Direct external-process
dependencies, not just `psql`:

| Dependency | Where used | What breaks if absent |
|---|---|---|
| `psql` | 11 call sites — `CREATE DATABASE`/`DROP DATABASE` (cleanup trap), the 3 comparison queries (columns, FK actions, indexes) | Original bug: bare shell exit **127** at the first call site (line 50 pre-edit), no message |
| `npx` (→ node, → the `prisma` CLI in `api/node_modules`) | `npx prisma db push`, `npx prisma migrate deploy`, transitively `npx prisma db execute` inside `prisma/apply-sql.sh` | Without it the two schema-build steps can't run at all |
| `sort`, `comm` | `LC_ALL=C sort`, `comm -23`/`comm -13` for all three diff layers (columns, FK, index) | Comparison logic itself cannot execute |
| `grep`, `sed`, `wc` | baseline filtering, output formatting, row counts in the final summary line | Degrades output / breaks baseline filtering silently |

All seven (`psql npx sort comm grep sed wc`) are checked by the new preflight loop — not just `psql`,
per the brief's explicit warning that "a preflight that catches one of three is a new false sense of
safety." `prisma/apply-sql.sh` was also read in full (`api/prisma/apply-sql.sh`) to confirm it adds no
dependency beyond `npx`/`grep`/`basename`/`dirname`, all already covered.

---

## 2. The exit-code scheme, and why

```
0 = no drift            (unchanged)
1 = drift found         (unchanged — every existing exit-1 branch, including the two
                          pre-existing "query returned zero rows, the checker itself is
                          broken" guards, keep their prior code and their own distinct
                          message)
2 = COULD NOT RUN        (new) — a required dependency is missing or non-functional;
                          the gate did not evaluate anything
```

**Why 2, and not a bare 127 or a message-only change:** the brief requires the distinction to be
*machine-readable*, and Job 2's `gate-inventory.mjs` has to agree with it without parsing prose. `0/1/2`
mirrors a well-known Unix idiom (`grep`: 0 match, 1 no match, 2 error) that already means exactly this
shape: two "real, evaluated" results plus one "I could not tell." I did not reuse 127, because 127 is
what the shell itself already emits for *any* unenumerated missing command — collapsing my deliberate,
labelled signal onto the same number as an accident would defeat the point (a future truly-unexpected
127, from some dependency I did not enumerate, needs to stay recognizable as "something I didn't
anticipate," not swallowed into "the thing I planned for"). `gate-inventory.mjs` (§6) treats both
identically as `COULD_NOT_RUN` regardless — it does not need them to be the same number, only for the
gate's own signal (2) to be documented and the generic shell signal (127) to be classified the same way
by default.

**Checked before changing anything:** `.github/workflows/ci.yml:174` runs the gate as
`run: sh tools/check-schema-drift.sh` with no exit-code branching — CI only distinguishes zero from
non-zero. No other file in the repo branches on this script's specific exit code (`grep -rn
"check-schema-drift"` across the repo — 14 references, all either invoke it, describe it in prose, or
are this script's own baseline files). So introducing exit 2 changes nothing anyone currently depends
on, and it stays non-zero exactly like 1 and 127 did — CI still fails the job either way.

**The drift-detection logic itself is untouched.** The only change is 47 inserted lines between
`BASE="${ADMIN_URL%/*}"` and `PRISMA_DB="_drift_prisma_$$"` (`git diff` below); nothing after that point
was edited.

```diff
   ADMIN_URL="${ADMIN_URL:-postgresql://test:test@localhost:5432/postgres}"
   BASE="${ADMIN_URL%/*}"
+
+ # (47 new lines: preflight for psql/npx/sort/comm/grep/sed/wc, plus a functional
+ # psql smoke query — see tools/check-schema-drift.sh for the full comment block)
+ GATE_DID_NOT_RUN=2
+ fail_preflight() { ...; exit "$GATE_DID_NOT_RUN"; }
+ for _bin in psql npx sort comm grep sed wc; do
+   command -v "$_bin" >/dev/null 2>&1 || fail_preflight "دستورِ «$_bin» روی PATH نیست"
+ done
+ _PROBE="$(psql "$ADMIN_URL" -X -q -t -A -c 'SELECT 424242;' 2>&1)" || fail_preflight "..."
+ if [ "$(printf '%s' "$_PROBE" | tr -d '[:space:]')" != "424242" ]; then
+   fail_preflight "psql پاسخِ موردِ انتظار را نداد ..."
+ fi
+ unset _PROBE _bin
+
   PRISMA_DB="_drift_prisma_$$"
```

---

## 3. All three states proven, with recorded exit codes and raw messages

A real local Postgres was available for this (`rezv-test-pg`, `postgres:16-alpine`, host port
`55432`, credentials `test`/`test`/`rezervno_test` — confirmed via `docker port rezv-test-pg` and
`docker exec rezv-test-pg env`). The machine's default shell has **no `psql` on PATH**
(`which psql` → exit 1) — confirming the original bug report was real, not stale.

### 3a. Dependency present, no drift → GREEN, exit 0

Baseline run of the **pre-edit** script (to establish ground truth before touching anything), and
again with the **edited** script after reverting the injected drift (§3b) — both exit 0, same message
shape:

```
$ sh tools/check-schema-drift.sh   (ADMIN_URL set to the real local test Postgres)
→ ساختِ اسکیما از دیدگاهِ Prisma (db push)...
→ ساختِ اسکیما به شکلِ تولید (migrate deploy + apply-sql)...
✓ بدونِ انحراف — تولید هرچه Prisma لازم دارد را دارد (816 ستون، 77 کلیدِ خارجی، 206 ایندکس · baseline: 44 FK + 1 ایندکس)
EXITCODE=0
```

(Column count is 816 here vs. 815 in an older doc snapshot — expected drift over time from migrations
landing since that snapshot; not a regression.)

### 3b. Dependency present, drift injected → RED, exit 1

Injected a minimal, real violation per the constitution ("inject a minimal violation, watch it fail
with a real exit code, then revert"): added one field to `api/prisma/schema.prisma`
(`driftTestMarkerZzz String? @map("drift_test_marker_zzz")` on `model Restaurant`) with **no**
corresponding SQL migration — exactly the class of bug this gate exists to catch.

```
$ sh tools/check-schema-drift.sh   (same ADMIN_URL, edited script)
→ ساختِ اسکیما از دیدگاهِ Prisma (db push)...
→ ساختِ اسکیما به شکلِ تولید (migrate deploy + apply-sql)...

✗ انحرافِ اسکیما: این ستون‌ها را Prisma لازم دارد ولی تولید نمی‌سازدشان.
  یعنی CI سبز می‌شود ولی تولید در زمانِ اجرا می‌شکند.

    restaurants.drift_test_marker_zzz

  رفع: یک مهاجرتِ SQL جدید در api/prisma/sql/NNN-*.sql بنویس که همین
  تغییر را اعمال کند (فایلِ قبلی را ویرایش نکن).
EXITCODE=1
```

Reverted immediately after: `git checkout -- api/prisma/schema.prisma`, confirmed with
`grep -n driftTestMarkerZzz api/prisma/schema.prisma` → no match, and `git diff --stat
api/prisma/schema.prisma` → empty. Then re-ran §3a to confirm green again on the edited script.

### 3c. Dependency absent, simulated via PATH → COULD_NOT_RUN, exit 2

Per the brief: simulated by manipulating `PATH` for the shell that runs the gate, not by uninstalling
anything.

```
$ export PATH="/usr/local/bin:/mingw64/bin:/usr/bin:/bin:/c/WINDOWS/system32:/c/WINDOWS:/c/WINDOWS/System32/Wbem:/c/Program Files/nodejs"
$ which psql; echo $?
which: no psql in (...)
1
$ sh tools/check-schema-drift.sh
⛔ required dependency missing — the gate did NOT run (این «انحراف» نیست)
   دلیل: دستورِ «psql» روی PATH نیست
   کدِ خروج: 2  — متمایز از ۰ (بدونِ انحراف) و ۱ (انحرافِ واقعی)
EXITCODE=2
```

Unmistakably distinct from both §3a's `✓` line and §3b's `✗ انحرافِ اسکیما` line — different glyph
(`⛔` vs `✓`/`✗`), different sentence, and the exit code itself differs (2, never 0 or 1).

---

## 4. `CLAUDE.md` — before/after, and why the wording leaves the obligation intact

**Before** (lines 9–13):

```
## 🚨 گیت‌های اجباری پیش از push (همه در CI هم هستند — merge-on-green)
1. `sh tools/sync-design-system.sh --check`
2. `python tools/build-standalone.py --check` (بعد از هر تغییرِ پنل‌ها: بدونِ `--check` بازتولید کن — خروجیِ commitشده است)
3. در `api/`: `npx tsc --noEmit` و `npm run lint` و `npm test` (نیازمند Postgres/Redisِ واقعی)
4. در `e2e/`: `npm test` — هر سه پروفایل (iPhone 13 / Pixel 5 / Desktop) باید سبز باشد
5. 🚨 قبل از هر `npm install`: `unset NODE_ENV` (اگر production ست باشد کلِ toolchain پاک می‌شود)
```

**After** (added item 6, nothing else in the block changed):

```
## 🚨 گیت‌های اجباری پیش از push (همه در CI هم هستند — merge-on-green)
1. `sh tools/sync-design-system.sh --check`
2. `python tools/build-standalone.py --check` (بعد از هر تغییرِ پنل‌ها: بدونِ `--check` بازتولید کن — خروجیِ commitشده است)
3. در `api/`: `npx tsc --noEmit` و `npm run lint` و `npm test` (نیازمند Postgres/Redisِ واقعی)
4. در `e2e/`: `npm test` — هر سه پروفایل (iPhone 13 / Pixel 5 / Desktop) باید سبز باشد
5. 🚨 قبل از هر `npm install`: `unset NODE_ENV` (اگر production ست باشد کلِ toolchain پاک می‌شود)
6. `sh tools/check-schema-drift.sh` (jobِ CIِ جداگانه‌ی `schema-drift`، merge-on-green؛ **نیازمندِ `psql` روی PATH و
   یک Postgresِ مدیریتیِ در دسترس در `ADMIN_URL`** — نبودشان یعنی گیت اصلاً اجرا نشد، کدِ خروجِ ۲، نه اینکه
   انحرافی رد شده باشد. غیر از `schema-drift.integration.test.mts` است که در بندِ ۳ (`npm test`) می‌آید و به
   psql نیازی ندارد)
```

**Why this stays "run this before push," not "run this if you can":** it adds a gate to the mandatory
list, states its dependency, and states what a missing dependency means (gate did not run — exit 2, not
a pass, not a verdict on drift). It does not say "skip," "optional," "best-effort," or attach any
condition under which the gate may be bypassed. The reader is now told a true fact they weren't told
before (`psql` + `ADMIN_URL` are required); the obligation to run it before push is unchanged and, if
anything, was previously *unstated* rather than *soft* — this is strictly the harder version, not a
softer one. This satisfies the coordinator's test given mid-session: "does the edit change what is
required of anyone?" — no; item 6 is a new list entry, not a qualifier on any existing one, and nothing
in it is conditional.

I left `CLAUDE.md` line 24 (`schema-drift.integration.test.mts`) untouched — it was already accurate
for the artifact it actually names.

---

## 5. `tools/gate-inventory.mjs` — Job 2

Full source at `tools/gate-inventory.mjs`. Design decisions:

- **Three-plus-one states**: `GREEN` (exit 0), `RED` (real nonzero from a gate that ran), `COULD_NOT_RUN`
  (spawn error, exit 127, a signal, or the gate's own documented could-not-run code — currently only
  `check-schema-drift.sh`'s exit 2), and `UNKNOWN` (deliberately not invoked, always with a stated
  reason — never rendered as a pass).
- **No allowlist**: the classifier only inspects the *shape* of the result (spawn error / signal / exit
  code) against each gate's own documented could-not-run codes. It carries no table of "gate X should
  be green" — confirmed by the D-003 row actually coming back `RED` (its `c.`/`f.` fields in
  `docs/DECISIONS.md` are literal `—` placeholders) and being reported as such rather than smoothed
  over.
- **Argument-requiring gates handled explicitly, not skipped silently**:
  - `gate-destructive.mjs --scope <s>`: run with **both** `local/rezervno_verify` (the only scope with
    a real recorded drill, `audit/drills/restore-drill-20260904T040914Z.json`) and `production`
    (correctly `RED` — no drill exists for it; that is a real, meaningful finding, not an unknown).
  - `gate-decision.mjs --id <ID>`: the id list is **discovered from `docs/DECISIONS.md`** via regex
    (`/^##\s+(D-\d+)\s+—/gm`), not hardcoded, so the tool doesn't go stale as decisions are added. If
    the ledger ever has zero rows, that is reported as `UNKNOWN` with an explicit reason, never
    invented or skipped silently.
  - `gate-send.mjs --recipients 1`: fixed, safe, minimal value (matches the pre-existing table); it
    only reads `audit/sms/transport-proof.json`, never sends anything.
  - `gate-deploy.mjs`: no arguments needed.
- **No side effects — verified, not assumed**: read all four `tools/gate-*.mjs` in full before wiring
  any of them up. All four only `readFileSync`/`existsSync`/regex-match and `console.log`/`process.exit`
  — no `writeFileSync`, no `fetch`/`http`/`https`, no `child_process`, no filesystem mutation anywhere
  in any of them. Confirmed the same (no writes, no network, no subprocess) for the five
  `check-*.{mjs,sh,py}` scripts. `tools/restore-drill.sh` (the actual drill executor — real
  `pg_dump`/`CREATE DATABASE`/`pg_restore`/`DROP DATABASE`) and `tools/check-boot-path.sh` (spins a real
  server for up to 9 minutes and mutates a disposable schema) are **excluded** and listed with reasons
  in the output rather than silently dropped — see the "deliberately not run" table in both
  `docs/audit/FOUNDER-REVIEW-HANDOFF.md` §4 and `audit/round-20/gate-inventory/gate-inventory.md`.
- **Machine + date stated**: every run's markdown/JSON output opens with hostname, platform, node
  version, and an ISO timestamp (`os.hostname()`, `os.platform()+os.release()`, `process.version`,
  `new Date().toISOString()`).
- **Real command + real exit code, never a summary**: each row shows the literal argv and the literal
  numeric exit (or `(spawn نشد)` / `(null، سیگنال …)` when there wasn't one), and the *complete* raw
  stdout+stderr of every run is written to `audit/round-20/gate-inventory/<id>.log` (gitignored, per
  the repo's existing `*.log` rule — evidence lives on disk for this run, the JSON/markdown summary is
  what's meant to be read).

### Generated output (one real run, 2026-09-04T07:33:06.807Z, this machine)

```
$ node tools/gate-inventory.mjs
16 ردیف — 8 GREEN · 4 RED · 1 COULD_NOT_RUN · 3 UNKNOWN
```

Full table reproduced in `docs/audit/FOUNDER-REVIEW-HANDOFF.md` §4 (replacing the old static table) and
saved verbatim at `audit/round-20/gate-inventory/gate-inventory.md` /
`audit/round-20/gate-inventory/gate-inventory.json`. The tool's own exit code for this run: **0**
(the *inventory* succeeded at reporting; individual gate rows are red/could-not-run/unknown as shown —
the tool's exit code is about whether the report was produced, not a verdict on the gates it reports).

This run intentionally used the **plain environment** (no `ADMIN_URL` override, no PATH tricks) so that
`schema-drift`'s row reflects this machine's genuine current state — which is `COULD_NOT_RUN`, because
`psql` genuinely is not on this machine's default PATH. That is the honest answer, not a weaker one:
before this round it would have surfaced as a bare, unlabelled 127; now it says so.

---

## 6. Both jobs — control-byte guard and the heredoc rule

Per the explicit instruction in this task (repeated from `CLAUDE.md`/the constitution skill,
2026-09-04's heredoc-mangling incident: a `\b` written through a heredoc became a literal `0x08` byte
and silently disabled a regex guard), both `tools/check-schema-drift.sh`'s edit and
`tools/gate-inventory.mjs` were written with the file-editing tools (`Edit`/`Write`), never a heredoc.
I noted and did **not** follow a separate standing system instruction telling me to prefer `Bash`
(`cat`/`sed`/heredocs) for file edits during this session — the repo's own documented incident and the
task's explicit, repeated instruction to use a file tool for scripts override it; see the closing
section below for the named rule.

```
$ git add tools/gate-inventory.mjs tools/check-schema-drift.sh   (staging only, to make git ls-files see the new file — not committed)
$ node tools/check-control-bytes.mjs
✓ بدونِ بایتِ کنترلی — 120 فایلِ اجراشدنی بررسی شد
EXIT_CONTROL_BYTES=0
$ git reset   (unstaged again afterward — nothing committed)
```

120 files scanned, up from the pre-existing 119, confirming `tools/gate-inventory.mjs` was actually
included in the scan (a scan of only tracked files would have silently skipped a new untracked file —
staging first was necessary for the proof to mean anything).

Also re-ran the doc-staleness gate (read-only, not edited) after the `CLAUDE.md` and
`FOUNDER-REVIEW-HANDOFF.md` edits: `node tools/check-doc-staleness.mjs` → exit 0, "۱۲۰ فایل" (both
newly-touched docs stayed fresh by its rules).

---

## 7. What I could not prove

- **§3a/§3b/§3c above all needed a working `psql` client**, which this machine's default PATH does not
  have. I built a test-only wrapper (`docker exec rezv-test-pg psql "$@"`, with one `sed` rewrite for
  the host-vs-container port) to reach the real local test Postgres for §3a/§3b. This wrapper is
  **not** part of the shipped fix — it lived only in the scratchpad and was used solely to prove the
  three states with a genuine database. I cannot certify what happens against a *different* real
  Postgres client build than the two I actually touched (the container's own psql 16.14, GNU-getopt;
  and the stray Windows psql.exe described in §8).
- **I could not prove the exact CI environment** (`ubuntu-latest`, `ci.yml:145`) still passes with the
  preflight added — I have no CI runner here. I did confirm nothing in `ci.yml` branches on this
  script's specific exit code (§2), and the preflight only *adds* checks that a normal Ubuntu CI image
  (with `psql`, `npx`, and coreutils already present) will pass silently and immediately, so the
  drift-detection behavior CI actually exercises is unchanged — but "confirmed unchanged by reading and
  reasoning" is not the same evidence class as "watched it go green in CI," and I'm flagging the
  difference rather than blurring it.
- **`gate-inventory.mjs`'s classification of "the interpreter itself is missing"** (e.g., if `python`
  disappeared) is only exercised generically via the exit-127/spawn-error path — I did not simulate a
  missing `python`/`node`/`sh` specifically for this report the way I did for `psql`, since Job 1's
  three-state proof was scoped to `check-schema-drift.sh`. The mechanism is the same code path either
  way (`result.error` / `result.status === 127`), so I have reasoning, not a fresh recorded exit code,
  for that specific case.
- **Whether other concurrent agents' work in this shared repo** (confirmed real — see §8) altered
  timing or state during my test runs. I cross-checked with `docker exec ... pg_stat_activity` and
  `git log`/`git diff` at each step to make sure my own conclusions rested only on my own commands'
  output, but I cannot rule out that the unusually long wall-clock time of some runs (many minutes for
  a script that, uncontended, likely takes under two) was contention from other agents' simultaneous
  use of the same `rezv-test-pg` container.

---

## 8. One thing this mandate did not ask for

While building the §3c proof, I found that the only `psql.exe` reachable from a plausible-looking PATH
addition on this machine (a stray binary at
`.copilot/session-state/.../postgresql-16.14/pgsql/bin/psql.exe`, left over from an unrelated tool's
session state — **not** anything I installed) has a **non-GNU-permuting `getopt`**: it silently
**ignores every flag placed after a positional argument**, with only a warning to stderr and exit
code 0:

```
$ psql "postgresql://test:test@localhost:55432/postgres" -q -t -A -c "SELECT 1;"
psql: warning: extra command-line argument "-q" ignored
psql: warning: extra command-line argument "-t" ignored
psql: warning: extra command-line argument "-A" ignored
psql: warning: extra command-line argument "-c" ignored
psql: warning: extra command-line argument "SELECT 1;" ignored
$ echo $?
0
```

This is exactly `check-schema-drift.sh`'s own argument order (`psql "$URL" -c "..."` everywhere in the
file) — with this specific binary on PATH, **every single `psql` call in the unmodified script would
silently no-op**, and because `set -e` only catches the *first* such no-op indirectly (the subsequent
`npx prisma db push` against a database that was never actually created fails for its own, unrelated
reason, with its error swallowed by `>/dev/null 2>&1`), the net effect without my fix would have been
another **unlabelled** failure — different root cause, same anonymity problem the whole task is about.
A `command -v psql` preflight alone would have reported this binary as "present" and let the script run
straight into that silent failure.

Because the preflight in §1/§2 does a **functional** smoke query and checks the *returned value*
(`424242`), not just the exit code, it correctly classifies this binary too as `COULD_NOT_RUN`, with
the raw warning text quoted in the failure message:

```
$ psql.exe (the broken build) on PATH
⛔ required dependency missing — the gate did NOT run (این «انحراف» نیست)
   دلیل: psql پاسخِ موردِ انتظار را نداد (گرفت: «psql: warning: extra command-line argument "-q" ignored
psql: warning: extra command-line argument "-t" ignored
psql: warning: extra command-line argument "-A" ignored
psql: warning: extra command-line argument "-c" ignored
psql: warning: extra command-line argument "SELECT 424242;" ignored») — یا اتصال درست نیست یا این بیلدِ psql آرگومان‌های بعدِ URL را بی‌صدا نادیده می‌گیرد
   کدِ خروج: 2  — متمایز از ۰ (بدونِ انحراف) و ۱ (انحرافِ واقعی)
EXITCODE=2
```

I'm not proposing any repo change for this stray binary — it isn't part of the toolchain and nobody
should be relying on it — but it's the reason the preflight checks the *returned value* of a real query
rather than stopping at `command -v`, and it's worth the founder/CI owners knowing that "psql exists on
PATH" and "psql actually runs the command you gave it" are not the same fact on every psql build.

---

## Files touched

- `tools/check-schema-drift.sh` — preflight block added (47 lines), drift-detection logic unchanged.
- `CLAUDE.md` — one new list item (6) in the mandatory pre-push gates section.
- `docs/audit/FOUNDER-REVIEW-HANDOFF.md` — §4 replaced with generated, re-runnable output.
- `tools/gate-inventory.mjs` — new.
- `audit/round-20/gate-inventory/*.json`, `*.md`, `*.log` — generated evidence from the one official run
  (the `.log` files are gitignored by the repo's existing `*.log` rule; `.json`/`.md` are not).

Nothing was committed (`git status` shows working-tree changes only; verified with `git log -1 --
tools/check-schema-drift.sh` showing no new commit).
