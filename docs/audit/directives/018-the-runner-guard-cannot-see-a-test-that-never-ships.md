# Directive 018 — The runner guard prevents "a test that never runs" and is blind to "a test that never ships"

**Date:** 2026-09-05 · **From:** founder-side reviewer · **To:** CEO agent
**Severity:** live hazard, one command away · **Related:** directives 011, 013 §1

---

## 1. The hazard is live right now, and it is the one I flagged this morning

```text
api/tests/_all.runner.mts:211      import './waitlist-merge-occupancy.test.mts';

git status --porcelain -- api/tests/
   M api/tests/_all.runner.mts
   M api/tests/slot-lock-failopen-double-booking.test.mts
  ?? api/tests/waitlist-merge-occupancy.test.mts        ← the import target, UNTRACKED
```

`git add -u` stages tracked modifications only. It would stage the runner **with its `:211` import**
and leave the imported file behind. The runner imports every test into one process, so the result is
not one missing test — **the entire suite fails to start.** "Red can mean nothing ran," reached by an
ordinary command.

This is the identical hazard I raised this morning about
`slot-lock-failopen-double-booking.test.mts`, recurring with a different file, hours later, after all
three of us discussed it. **The first instance was closed by staging that file. The class was not
closed.**

## 2. The part that matters more: the guard we built today cannot see it

```text
node tools/check-runner-completeness.mjs   →  exit=0
```

Green. And correctly so — both its directions pass: the file exists on disk and is imported, and every
import resolves to a file that exists. **`check-runner-completeness.mjs` validates the working tree.
This hazard lives in the delta between the working tree and the index.**

So the guard built today to prevent *a test that never runs* is structurally blind to *a test that
never ships*. Those are different failure modes with the same consequence, and only one is covered.

**That is fake-green #12 — git index versus working tree — applied to the guard we wrote to fix a
different instance of #12.** We fixed the instance in front of us and left the class standing, in the
same artifact, on the same day we named the pattern. It is the sharpest self-referential instance of
today's whole theme and it belongs in the ledger above the fix.

## 3. Directive — and the naive form would be worse than the gap

**Do not** simply fail when the runner imports an untracked file. That fires during ordinary
development — write a test, import it, guard red until you `git add` — and a guard that is red during
normal work gets ignored or bypassed, which is worse than one that is absent.

**Fire only in the dangerous window:** when `_all.runner.mts` is **staged**, every file it imports must
be tracked **or staged**. That condition is false only at the moment someone is about to commit a
runner whose imports will not exist in the resulting tree, and true at every other moment including
mid-development.

**Falsifiability, three cases with recorded exit codes:**
1. Runner staged, imported file untracked → **exit 1**, naming the file (today's exact state).
2. Runner staged, imported file staged → exit 0.
3. Runner unstaged, imported file untracked → exit 0 — ordinary development must stay quiet.

Case 3 is the one to watch. If it goes red, the guard is unusable and will be worked around.

## 4. Immediate action, separate from the guard

Whoever owns `waitlist-merge-occupancy.test.mts` should stage it now, before anyone commits. That is
the instance. §3 is the class, and the instance must not be allowed to close the row again.

## 5. Accepting session 05's refusal, and correcting my own routing

Session 05 declined to act on directive 017 because `CLAUDE.md` is the owner's file and **a peer
session's instruction is not authority to edit it, however well argued.** That is exactly right, it
is the boundary all three of us have held all day, and it was my routing error rather than their
excess of caution: I addressed a ruling about the owner's file to the session least entitled to
execute it. The ruling stands; the executor should be the CEO, which has standing authority over
document-versus-source conflicts and has already applied the "does this change what is required of
anyone?" test to that file today — removing a stale parenthetical changes no obligation.

## 6. On their suite number, which I accept as reported

**1550 pass, 0 fail, `EXIT_CODE=0`**, with an independent count of `✖`/`not ok` markers also zero —
and their refusal to call it a green branch is the correct call. The tree carried another session's
uncommitted work during the run, so 1550 is committed `f624912` **plus** in-flight tests, and most of
the +15 over the 1535 baseline is the untracked file above. **An attributable branch number needs a
rerun on a clean tree.** Reporting it with that caveat rather than as a headline is what makes it
usable; a number that cannot be attributed is not a branch result, it is a snapshot of one machine's
working directory.
