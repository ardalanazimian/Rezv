# FIX-BE-14 — a guard so no new module-level per-test hook enters api/tests silently

- **Date:** 2026-09-17 · **Session:** Implementation Team `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`; Red Team `rezv-31` may attack it
- **What it needs from its reader:** try to add a module-level hook the scanner misses. **Status: submitted.**
- **Branch:** `impl/rezv-85-be14-hook-guard`, based on `553ecf4` (the 090 lineage, which merges first)

## The claim fixed

BE-14 (found during FIX-BE-02; CEO ruling 2026-09-17: P2, "a static guard that flags module-level hooks
in api/tests with a self-test, so the 16th file can't be added silently; don't fix the other 13 now").
`api/tests/_all.runner.mts` imports every test file into one process. A `beforeEach`/`afterEach` outside
any `describe` is registered on the **root** test, so it runs before or after **every** test in the
suite. One throwing hook (`fraud.integration.test.mts:84`, once migration 090 landed) turned 1829
unrelated tests red and hid the real failures underneath.

## Root cause and class

- **Root cause:** node:test's root-hook semantics combined with a single-process runner. A hook's
  author sees file-local behaviour when running the file alone, and suite-wide behaviour in CI.
- **Class:** test code whose blast radius is the whole suite. Siblings: module-level `before`/`after`
  (they run once, but a throw there is equally global): 201 calls in 109 files on `99065a7`. They are
  **out of this ruling's scope** and stated so in the guard header.

## The diff

- `tools/check-module-level-test-hooks.mjs` (new, zero dependencies; the `design-system` job installs none).
  - **Scanner:** tracks `(`/`[`/`{` depth, skipping strings, templates (including `${…}`), comments and
    regex literals. Regex detection also works after keywords (`return /x/`), which the rejects-matcher
    tokenizer it is modelled on does not handle. Only depth-0, non-member `beforeEach(`/`afterEach(`
    calls count.
  - **Ratchet with a per-file baseline** (14 files, 1 hook each, counted on `553ecf4`). A new file
    fails, more hooks in a baseline file fail, and fewer hooks without shrinking the baseline also
    fail, so the list can only shrink deliberately.
  - **Self-test:** 7 must-flag and 7 must-not-flag samples, including fraud's shape (column 0 inside a
    `describe`). Any miss exits 2, "gate did not run". Scope sanity: fewer than 50 files scanned also
    exits 2.
- `.github/workflows/ci.yml`: a step in the `design-system` job, after the §6 guard.

## Proofs — tested

| Case | Result |
|---|---|
| `--print-baseline` on `553ecf4` | 14 files. A plain `git grep -E "^(beforeEach\|afterEach)\("` finds 15; the extra one is `fraud.integration.test.mts`, whose hook is at column 0 **inside** a `describe` (the FIX-BE-02 rewrite), so the depth tracking is doing its job |
| Clean tree | **exit 0**: `14 فایل / 14 هوک … (206 فایلِ اسکن‌شده) … 14 نمونه‌ی ساختگی` |
| M1: a new probe test file (deleted after the run) with a module-level `beforeEach` | **exit 1**: `تازه: … (beforeEach:2)` |
| M2: append a module-level `afterEach` to `rewards.integration.test.mts` | **exit 1**: `بیشتر شد: … 1 → 2` |
| M3: remove the hook from `metrics-endpoint.test.mts` without touching the baseline | **exit 1**: `کوچک شد (پیشرفت): … 1 → 0` |
| M4: break the scanner (drop the `depth === 0` condition) | **exit 2**: self-test names both inside-describe samples |
| All reverted | **exit 0**; `git status` shows only the new tool |

## Baseline shrink after m-21 (2026-09-17)

Branch `impl/rezv-85-be14-after-m21`: the guard commit cherry-picked unchanged onto the m-21 fix, plus one
commit that removes `dna-summary.integration.test.mts` from `BASELINE`. It is a new branch, so the
already-pushed `impl/rezv-85-be14-hook-guard` was not force-pushed.

| Case | Result |
|---|---|
| Guard on the m-21 tree, baseline unchanged | **exit 1**: `کوچک شد (پیشرفت): api/tests/dna-summary.integration.test.mts 1 → 0`, so the ratchet demands the shrink |
| Baseline shrunk | **exit 0**: `13 فایل / 13 هوک … (208 فایلِ اسکن‌شده)` |
| Mutation: a module-level `beforeEach` re-added to dna-summary | **exit 1**: `تازه: … dna-summary.integration.test.mts (beforeEach:80)`; file restored byte-identical |

**Measured sibling (still out of scope, now with evidence):** during m-21's discovery run, a throw inside
`vip-and-clv-honesty`'s module-level **`before`** (runs once, not per test) cancelled the tests of other
files: business-panel-contract, admin-branches, and the route-permission guard. The full run then hung for
30+ minutes. A two-file mini runner showed it also fails the tests of the file imported **before** it. A
failing one-shot root hook is therefore as global as a per-test one. This guard does not cover it.

## What I did not verify

- **Linux CI** (the `design-system` job). Windows only.
- Hooks imported under an alias (`import { beforeEach as be }`), or hooks defined through helpers that
  call `beforeEach` at import time from another module. Neither shape exists in `api/tests` today, and
  neither is covered.
- The 14 baseline files themselves were not audited or fixed, per the ruling.
