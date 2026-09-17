# FIX-m-21 — fixture phone prefixes are owned per file, enforced, and unique within the run

- **Date:** 2026-09-17 · **Session:** Implementation Team `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`; Red Team `rezv-31` attacks it first
- **What it needs from its reader:** try to reuse a prefix, or collide a number, without the suite going
  red. **Status: submitted.**
- **Branch:** `impl/rezv-85-m21-phone-prefix`, one commit on `8b63e61` (main). Follow-up for the BE-14
  baseline: `impl/rezv-85-be14-after-m21` (see FIX-BE-14, "Baseline shrink after m-21").

## The claim fixed

STATE m-21 (found by `rezv-31`, verified statically by the CEO on main): `fixturePhone('0921')` was used in
three files, against the helper's own "one prefix per file" rule. `dna-summary.integration.test.mts` also
had a top-level `beforeEach` that created a `0921` user, and its `after()` removed only the last one.
Result: intermittent `Unique constraint failed on (phone)` in main's `test` job, attributed to whatever
test was running at the time.

## Measured before the fix (main `8b63e61`, fresh DB)

- **The rule was broken far more widely than one prefix.** A static census of every quoted prefix token in
  the 49 files that call `fixturePhone`, ordered by runner position, found **27 prefixes used by more than
  one file**. `0921` was in 3 files and `0922` in 4. Two files built prefixes from sequences that ran into
  other files' prefixes: `provision-slug-validation` used 980+n, which hits `0981`–`0983` (business-panel)
  and `0990`/`0991`.
- **The leak was real, but smaller than the finding assumed.** After one full main run the DB held **365**
  users with prefix `0921`. The finding said "~1899, one per test". A two-file probe showed the hook did
  not run before every test: dna-summary plus env-secrets left 18 users. At n≈365 in a 10^7 suffix space,
  the birthday estimate is about 0.7% per run for `0921` alone, plus the other shared prefixes (`0932`: 22,
  `0937`: 19, `0934`: 14 rows). **I did not reproduce the ~16% figure**, and I did not see a collision in
  the baseline run. The mechanism is measured; the rate is not.
- `dna-summary` is the **first** import in `_all.runner.mts`.

## Root cause and class

- **Root cause:** uniqueness of fixture identities rested on a written convention ("choose a different
  prefix per file") plus randomness. Nothing enforced the convention, and randomness only makes a
  collision unlikely.
- **Class:** test-fixture identity collisions in the one-process runner. Siblings: the 27 shared
  prefixes, the two sequence-built prefix ranges, and every module-level hook that creates fixtures. That
  last one is BE-14's ratchet, which now shrinks by one.

## The diff

- `api/tests/_phone.helper.mts`:
  - **Prefix ownership, enforced.** The first test file to use a prefix owns it. Another file using it
    throws `PHONE_PREFIX_REUSE` naming both files. The owner is read from the caller's stack, so a prefix
    passed through a constant or a helper argument is caught too.
  - **In-process uniqueness.** A number already issued in this process is never issued again, so the
    random suffix is no longer a probability.
  - The registry is created by an exported factory, and the suffix source is injectable, so the rule can
    be tested deterministically without touching the global registry.
- `api/tests/dna-summary.integration.test.mts`: the per-test user hook moved from module level into the two
  `describe`s that use a user. Every created user is recorded, and `after()` deletes all of them except
  users that own `points_ledger` rows (FP-009 makes those undeletable by design), without a silent `catch`.
- 20 test files moved off shared prefixes: the file first in runner order keeps each prefix, and the others
  moved to free `09xx` prefixes. `provision-slug-validation` now uses one prefix; its per-call sequence
  existed only to dodge collisions, which the registry now prevents.
- `api/tests/phone-fixture-ownership.test.mts` (new, in the runner): the rule's own tests.

## Proofs — tested

| Step | Result |
|---|---|
| Unit tests of the rule | 6/6, exit 0 |
| Mutant: ownership check removed | exit 1 (1 fail) |
| Mutant: in-process dedup removed | exit 1 (deterministic: the injected suffix source repeats) |
| Mutant: helper's own stack frame not skipped | exit 1 |
| Real-file mutation on the final tree: `vip-and-clv-honesty` (`0902`) moved onto `no-show-outcome-settled`'s `0903`, both files in one process | **exit 1**, `PHONE_PREFIX_REUSE: پیشوندِ «0903» مالِ no-show-outcome-settled.integration.test.mts است و vip-and-clv-honesty.integration.test.mts هم برداشتش`; file restored. Control, same two files unmutated: **17/17, exit 0** (6 + 11 tests, both files confirmed to have run) |
| `check-runner-completeness` · `tsc --noEmit` · `npm run lint` | exit 0 · 0 · 0 |
| 5 sequential full api suites on the commit (detached clean checkout), each on a fresh clone of the 090 template, Redis flushed, one slot, nothing else running | **5/5: tests 1900 · pass 1900 · fail 0 · cancelled 0 · exit 0**. Durations 440s, 361s, 319s, 281s, 279s. `Unique constraint failed on (phone)`: **0** lines in every run. `0921` is no longer among the 8 most-used prefixes in any run's DB (main: 365 rows, first place) |

## Corrections made during this work, recorded so nobody repeats them

- My first reassignment used `08xx` prefixes. `normalizePhone` accepts only `^09\d{9}$`, so every moved
  file that provisions a business or logs in by OTP would have failed. My own S-05 test hit this first
  («شماره موبایل معتبر نیست»). Every prefix was then moved to a free `09xx`.
- My first real-file mutation measured nothing: it put `vip-and-clv-honesty` on `0922`, a prefix that
  `no-show-outcome-settled` no longer used after the reassignment. It exited 0. It was re-aimed at the
  prefix that file actually owns.
- A discovery run with the enforcement, before the reassignment, hung for 30+ minutes. The throw landed in
  `vip-and-clv-honesty`'s module-level `before`, which cancelled other files' tests. The reassignment used
  the static census instead, and the 5 proof runs are the confirmation.
- Two full suites run in parallel on this machine produced 3 unrelated timing failures (5-second
  concurrency tests) on untouched main. The proof runs are therefore sequential, on one slot.

## What this does NOT fix or verify

- **Linux CI.** Windows only, local Postgres 17 + Redis 7.
- **The ~16% rate** in the finding was not reproduced (see "Measured before the fix").
- Phones built **without** `fixturePhone` (hard-coded literals, or files with their own generators such as
  `tenant-isolation`'s `phoneSeq`) are outside the registry.
- Unmerged branches may use prefixes this commit now assigns. The enforcement turns that into a
  deterministic red on the merged tree, which is the point, but it has not been run against them.
- A reuse inside a **module-level** hook still cascades onto other files' tests and can hang the run
  (measured). The error is loud and names both files, but the run is slow to fail.
- The 13 other module-level per-test hooks (BE-14 baseline) are unchanged.
