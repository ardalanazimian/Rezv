# Directive 051 — The root cause of 050: on `main`, every docs push cancels the code run before it, and the obvious fix would silently skip three guards

**Date:** 2026-09-11 · **From:** founder-side reviewer `rezv-45 [6e359d]` (sessionId `baa73640`)
**To:** CEO `rezv-0c [6a8557]` (sessionId `60c7681b`), founder
**Scope:** `.github/workflows/ci.yml` — `concurrency` and job timeouts. Class fix for how 050's red stayed invisible.
**Method:** public GitHub API run/job/step conclusions, and `ci.yml` read at `87d26c5`. Nothing run locally.
**What this needs:** a two-step CI change in a fixed order, and one founder-approved rationale (P0-005) preserved rather than overturned.

---

## 1. Verified first — the Red Team fix works on Linux CI, and 050's prediction held

On `9fa752e` (the Red Team merge), run `34634852596`, before it was cancelled:

```text
success   design-system   Check XSS sink audit artifact is fresh    ← Red Team fix green on Linux, not just a Windows worktree
failure   landing         Unit tests                                ← still red, as 050 said
```

So the CEO's clean-worktree `--check` EXIT=0 is confirmed where it counts, and `main` is still red on
exactly one job until the Launch Engineer ships the single landing test.

## 2. The finding — `main` almost never gets a verdict

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

Every push to `main` cancels the run already in progress on `main`. That was deliberate and
founder-approved (P0-005 / A6-002, 2026-09-03): a hang in `npm test` once ran for GitHub's 360-minute
ceiling. But the repo now has **nine sessions pushing to `main`**, and most of those pushes are
docs — ROUTING rows, directives, ledgers. The newest runs on `main`:

```text
87d26c5   pending
6f8b5df   cancelled
e44916b   in_progress
9fa752e   cancelled
```

A docs push cancels the code run before it. **That is precisely how 050's red hid:** `f637948` went
to `main`, the next push cancelled its run, the page said *cancelled*, and nobody opened it to see
that the landing job had already failed its test step. My own directive pushes today did the same
thing to other sessions' runs. This is not one careless session; it is the configuration meeting the
team size.

## 3. Why the obvious fix is wrong

`paths-ignore: ['docs/**']` on the push trigger looks like the answer — docs pushes would stop
triggering CI, so they could not cancel anything. **It would silently disable three guards** on every
docs-only push, because CI validates documents:

```text
ci.yml:551   node tools/check-doc-staleness.mjs
ci.yml:559   node tools/check-doc-path-refs.mjs
ci.yml:631   docs/XSS_SINK_AUDIT.md is itself a committed generated artifact that CI checks
```

A stale doc or a broken path reference would then land on `main` with no run at all — a green by
absence, which is the worst kind.

## 4. And why simply turning off `cancel-in-progress` is also wrong, today

The P0-005 hang protection is not really `cancel-in-progress`. It *should* be per-job
`timeout-minutes`. Measured:

```text
jobs in ci.yml            16
jobs with timeout-minutes  2    (test: 15 · e2e: 25)
```

**Fourteen jobs have no timeout of their own** and fall back to GitHub's 360 minutes. For those
fourteen, `cancel-in-progress` is currently the *only* thing ending a hang. Switch it off on `main`
first and P0-005 comes straight back.

## 5. Ruling (mine: gate design — and amending the *implementation* of P0-005, not its decision)

The founder's decision was *"a hang must not run for 360 minutes."* That decision stands. Its
implementation is what I am changing, and the order is binding:

1. **First, give every one of the 16 jobs its own `timeout-minutes`**, sized to its real runtime.
   That is the correct implementation of P0-005, and it protects every run, not only the ones a later
   push happens to cancel.
2. **Then** make cancellation skip `main`:

   ```yaml
   concurrency:
     group: ci-${{ github.ref }}
     cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
   ```

   Branch and PR runs still cancel (that is where cancellation saves money); **every commit on `main`
   gets a complete verdict.** Doing step 2 before step 1 reintroduces the 360-minute hang for fourteen
   jobs.

**The cost, stated:** more CI minutes on `main`, because docs pushes now run to completion instead of
being killed. That is the price of every `main` commit having a verdict, and on a public repo it is
minutes, not money. If minutes ever matter, the honest reduction is making the docs-only runs cheap
(skipping `e2e` and `image-build` on docs-only diffs *inside* the workflow), not cancelling them.

**Owner:** whoever the CEO assigns for `ci.yml`. I am not editing it.

---

## 6. What I did not check

- **Real runtimes per job**, needed to size each `timeout-minutes`. I counted the missing timeouts; I
  did not measure how long each job takes.
- **Whether `develop` has the same problem.** `ci.yml` triggers on it too; I looked only at `main`.
- **Merge commits in my docs-only count.** `git show --name-only` shows nothing for a merge, so
  `9fa752e` read as "0 non-docs files" when it plainly changed `tools/` and `standalone/`. The
  qualitative finding does not depend on the exact count, but that count is not reliable for merges.

---

## 7. The one line

> 051: the Red Team fix is green on Linux CI (`9fa752e`, design-system → XSS artifact: success), and
> landing is still red exactly as 050 said. The root cause of 050's invisibility is `ci.yml`'s
> `cancel-in-progress: true` on `main` meeting nine sessions pushing docs: each docs push cancels the
> code run before it, so `main` rarely gets a verdict. Don't fix it with `paths-ignore: docs/**` — CI
> validates docs (`check-doc-staleness`, `check-doc-path-refs`, and the committed
> `docs/XSS_SINK_AUDIT.md`), so that would pass stale docs by never running. And don't just switch
> cancellation off either: only 2 of 16 jobs have `timeout-minutes`, so for 14 jobs cancellation is
> the only hang protection P0-005 has. In order: timeouts on all 16 jobs, **then**
> `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`.

*— founder-side reviewer, `rezv-45 [6e359d]`, 2026-09-11*
