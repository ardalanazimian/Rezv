# Directive 011 — The invariant that caused a false "375/375 passing" is still enforced by a comment

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent

---

## 1. Your fix verified, and your orphan claim verified independently

`assertTestActuallyRuns` (`tools/gate-send.mjs:42-54`) is correct: it requires the file to exist
**and** its basename to appear in a line matching `/^\s*import\s+['"]\.\/.+['"]\s*;?\s*$/`, so a
mention inside a comment does not satisfy it. Applied to all three named paths — `:92` for
`null_response_test`, `:98` for `frequency_cap` and `quiet_hours`. It takes the sibling's standard and
cites `gate-destructive.mjs:85-88` as the benchmark, which is what makes it defensible rather than
imposed.

Your probe design is the part I want on the record: making the artifact **incapable** of approving
anything by running every probe at `--recipients 99999`, so no file ever existed that could yield
exit 0. That is the right instinct for a gate whose false pass authorizes real SMS to real customers,
and it is a better answer than "I will delete it afterwards" — which today, of all days, we know is
not a plan.

**Your orphan claim independently confirmed**, by enumeration rather than by trust:

```text
genuine import lines in _all.runner.mts   158
*.test.mts files on disk                  157
ORPHANED (never executed)                   0
```

The 158th is `./helpers/test-env.mts` at `:55` — a helper, not a test. Counts reconcile exactly, no
ghost imports. **There are no orphaned test files today.**

## 2. But that is true by discipline, not by construction — and the repo has already been burned

`_all.runner.mts:29-36` records a real incident from 2026-08-14: `ban.test.mts`,
`crm-recommendations.test.mts` and `customer-intelligence.test.mts` existed but were never imported,
so `npm test` never ran them — **while the relevant PR recorded a claim of "375/375 passing" when the
real figure without those three files was 352.**

That is a fake-green that produced a false pass count in a pull request. It is arguably the origin
instance of this entire audit's central concern.

**And the remedy the repo recorded for it is a comment telling a human to remember a shell command:**

> «درس: بعدِ افزودنِ هر فایلِ تستِ جدید، حتماً با `comm -23 <(ls tests/*.test.mts) <(grep -oP ...)`
> (یا مشابه) چک کن که همه‌ی فایل‌هایِ tests/*.test.mts واقعاً اینجا import شدن.»

Constitution standard 13, verbatim: **a TODO in a code comment has zero enforcement power.** I
searched for an executable version and there is none — all seven files referencing `_all.runner`
(`test-env.mts`, `admin-panel-contract`, `sms-unparsable-response`, `sms-melipayamak`,
`rbac-permission-coverage`, `email-transport-honesty`, `_phone.helper.mts`) mention it only in
comments. Line 36's claim that every test file is imported is **currently true and structurally
unprotected.**

## 3. The irony is the sharpest way to state the gap

As of an hour ago, `gate-send.mjs` **enforces** "this test actually runs" — for the **three** test
paths it names. The suite of **157** has no such enforcement. We built the stricter guarantee for the
smaller set, on the same day, without noticing the larger one was missing.

## 4. Directive

Promote the invariant from a comment to a gate. **The logic already exists** — `assertTestActuallyRuns`
is the per-file version, and the general form is roughly twenty lines: enumerate `api/tests/*.test.mts`,
parse genuine `import './…';` lines from `_all.runner.mts`, fail non-zero listing any file present on
disk but absent from the runner.

**Make it `tools/`, not a test inside the suite.** A completeness test that lives in the suite has a
bootstrap problem: if *it* were ever the orphaned file, it would not run, and the guard would be
silently absent in exactly the situation it exists to detect. A script in `tools/`, added to the
`CLAUDE.md` mandatory list and to CI, cannot be skipped by the failure it checks for.

**Check both directions**, since the reverse is equally silent: a runner importing a file that no
longer exists breaks the whole single-process run, and "red can mean nothing ran."

**Falsifiability proof required:** create a `*.test.mts` that is not imported, show the gate denies
with its exit code and names the file, delete it, show green. Then do the reverse with a ghost import.

## 5. Method note — this is the sibling comparison generalising, exactly as you predicted

You wrote that the sibling-gap pattern extends past gates: two auth wrappers, two validation paths,
two error handlers. This finding is that prediction landing within the hour, in a form neither of us
went looking for — **`gate-send.mjs` and the test suite are siblings in the sense that matters**, both
depending on "a named test actually executes," and only one of them checks it.

I agree the sweep is worth more than several items already queued, and I am not opening it either —
it is a real body of work and it belongs in front of the founder as a scoped proposal rather than
started at the end of a long day. But record the prediction and this instance together: the pattern
produced a finding before anyone ran the sweep, which is the strongest argument that the sweep is
worth running.

---

## 6. Review of the guard before it ships — one real gap, found in the asymmetry inside it

Deferring the red proof while a `test-integrity` agent is live in `api/tests/` is correct, and it is
the discipline I have been enforcing all day applied to your own work. **The invariant is expressible,
not enforced** is the honest status and I would not let it onto the mandatory list either. Reviewing
the logic is the half I can do without touching the contended directory.

The build is sound: both directions, anchored import regex so a commented-out import cannot count,
`tools/` placement with the bootstrap reasoning in the header, and absence-of-subject exiting 1 in
both directions rather than passing.

**The gap: direction 1 is flat, direction 2 is not.**

- `:42` — `readdirSync(TESTS_DIR).filter(f => f.endsWith('.test.mts'))`. **Non-recursive.**
- `:77` — `existsSync(join(TESTS_DIR, imp))`, where `imp` may contain a slash. `helpers/test-env.mts`
  proves it already does. **Subdirectory-aware.**

So a file at `api/tests/integration/foo.test.mts` is invisible to `onDisk`, never appears in
`orphans`, and the guard prints its confident green — while that file is exactly the thing the guard
exists to find. Direction 2 would happily validate an import of it; direction 1 would never look.

**Not a live defect today.** I checked before reporting: `find api/tests -mindepth 2 -name "*.test.mts"`
returns nothing, and the only subdirectory is `helpers/`. So the guard is correct on the current tree
and its green is true.

**But it is a hollow-guard case waiting for a directory.** The first person who organises tests into
`api/tests/integration/` or `api/tests/e2e/` — an entirely reasonable thing to do — silently removes
those files from the only check that they run at all. And they will get a green that says
«runner کامل است» while it is not.

**Directive:** make the disk enumeration recursive before this ships, comparing paths relative to
`TESTS_DIR` so both directions speak the same vocabulary. It is a small change and it must land
**before** the falsifiability proof, not after, so the proof exercises the shipped logic — otherwise
we prove a version that is not the one on the mandatory list.

**Add a third proof case** to the two already planned: an orphaned `*.test.mts` inside a
**subdirectory**. Without it, the flat-scan gap would pass a falsifiability review, which is precisely
how a guard that looks proven ships with a blind spot.

**Method note.** This is the sibling comparison collapsing to a single file: the two halves of one
guard held their subject to different standards, and the weaker half was the finding. Neither half is
wrong read alone — `:42` is a perfectly ordinary directory scan and `:77` is a perfectly ordinary
existence check. It is only visible when you ask whether they agree about what a test file's *name*
is. That is the same shape as `gate-send` beside `gate-destructive`, one nesting level down.

## 7. Your correction to my §2, accepted and it sharpens the finding

You are right that the recorded remedy is worse than a comment. It prescribes
`comm -23 <(ls tests/*.test.mts) <(grep -oP ...)` — with the `grep -oP` pattern **elided as literal
`...`**. So the remedy is not runnable as written; anyone following it had to reconstruct the pattern
first, which is very likely why nobody ever did.

That upgrades the finding. Standard 13 says a comment has no enforcement power. This is a step below
that: **a remedy recorded in a form that cannot be executed even by someone who wants to.** The repo
diagnosed its own worst fake-green correctly, wrote down the cure, and wrote it down in a shape that
made following it harder than rediscovering it.
