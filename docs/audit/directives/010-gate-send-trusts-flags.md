# Directive 010 — Standard 7 resolved for both gates; `gate-send.mjs` trusts flags where its sibling trusts nothing

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent
**Status of the old UNKNOWN:** closed by reading, not grepping

---

## 1. Standard 7 — both gates pass. Read in full, 82 and 94 lines.

We had both left this UNKNOWN three times, each of us correctly refusing to upgrade a grep into a
read. I read them. **Neither script performs the action it certifies:**

- `gate-send.mjs` — reads `audit/sms/transport-proof.json` and `docs/DECISIONS.md`, checks fields and
  file existence, `deny()` → `exit(1)`. **No network call, no send, no write.**
- `gate-destructive.mjs` — reads `audit/drills/restore-drill-*.json`, checks fields, verifies the dump
  file. **No drop, no delete, no write.**

`gate-destructive.mjs:13-15` states the separation as a design intent in its own header: the drill
executor (`tools/restore-drill.sh`) and its interpreter (that file) are deliberately separate,
because "a script that both does the work and certifies itself is the builder grading its own paper
in miniature." That is standard 7 written down by whoever built it, before we asked.

**The UNKNOWN is closed. Neither of us should carry it forward again.**

## 2. But the two gates hold their evidence to wildly different standards

Reading them side by side is what surfaces this; neither file looks wrong alone.

**`gate-destructive.mjs` trusts nothing.** It does not merely read the drill record — it verifies the
record still describes reality: the dump file must still exist (`:85`), its size must match (`:86`),
and it **re-computes the sha256 and compares** (`:87-88`). A record pointing at a deleted or altered
file is rejected. It also rejects a future-dated `completed_at` (`:76`) and a zero `tables_compared`
(`:78`). That is a gate that assumes its own evidence file might be wrong.

**`gate-send.mjs` trusts a boolean and a filename.** Its two central checks are:

| Check | What it actually verifies |
|---|---|
| `:53` — `e.null_response_as_success_impossible !== true` | A **hand-written boolean** in a JSON file |
| `:56` — `existsSync(join(REPO, e.null_response_test.path))` | The test file **exists on disk** |
| `:61-65` — `frequency_cap`, `quiet_hours` | Same shape: an `enforced: true` flag plus `existsSync(test_path)` |

**Existence is not execution.** We established today, from this repo's own runner, that a test file
not imported in `api/tests/_all.runner.mts` never runs — that is why the walk-in test had to be
imported at `:196` and why I repeated the `_probe-slotlock.mts` row eight times. A test file that
exists on disk and is imported nowhere satisfies `gate-send.mjs` completely.

So the gate that guards **real SMS to real phone numbers** can be satisfied by a JSON flag and an
orphaned file, while the gate guarding a database drop re-hashes its evidence.

## 3. Directive — adopt the sibling's standard, do not invent one

The exemplar is already in the repo, written by the same team, one file away. Fix the class:

1. **`gate-send.mjs` must assert every `test_path` it names is imported in `api/tests/_all.runner.mts`**,
   not merely that the file exists. That is the minimum that makes "there is a test" mean "the test
   runs."
2. **Prefer a recomputed fact over a self-reported flag** wherever one is available, as
   `gate-destructive.mjs` does with sha256. `null_response_as_success_impossible: true` is an
   assertion by the author of the evidence file about the author's own work.
3. **Falsifiability proof required**, per the usual standard: point a `test_path` at a real file that
   is *not* imported in the runner, show the gate currently passes (exit 0), apply the fix, show it
   denies (exit 1), restore.

**Not urgent, and I want that stated plainly so it is not inflated:** A4 is red today for an
independent reason — `audit/sms/transport-proof.json` does not exist at all (`:34-40`), so the gate
denies at the first check regardless. This defect is unreachable right now.

**But it becomes reachable at exactly the wrong moment.** The first time this gate matters is the
first time someone is about to send real messages to real customers, and that is precisely when a
hollow check is most expensive. Fix it while it costs nothing, not while someone is waiting on it.

## 4. Method note, since it is the point

This finding was not available from a grep. Both files pass any keyword search for `fetch`,
`execSync` or SQL verbs — that is what let me report "no matches" this morning and correctly refuse
to call it verified. It required reading both, and the defect only became visible **by comparison**:
`gate-send.mjs` looks perfectly reasonable in isolation, and looks negligent beside its sibling.

Worth generalising: where a repo has two gates of the same shape, the weaker one is a finding, and
neither file review would surface it. **Compare siblings, not just files against a standard** — the
repo's own better half is a stricter and more legitimate benchmark than anything I would impose.
