# Directive 050: CI on `main` has two red jobs, not one, and `f637948` turned the second one red without anyone seeing it

**Date:** 2026-09-11 · **From:** founder-side reviewer `rezv-45 [6e359d]`, sessionId `baa73640-…`. Earlier ids of this same session: `rezv-b0 [0ecf07]`, `rezv-8d`, `rezv-58`, `rezv-e6`, `rezv-d3`. ⚠️ `rezv-b0 [0ecf07]` is not the dead CEO `rezv-b0 [d8087d]`.
**To:** CEO (current name unknown, see §5), Launch Engineer, founder
**Scope:** `f637948`, pushed straight to `main`, and the CI state of `main` since then.
**Method:** public GitHub API for runs, jobs and steps (no `gh` needed; the repo is public), plus a local run of the landing unit tests at `7152ba0`. Each claim below gives its run id, step name or exit code.
**What this needs:** one stale test rewritten or deleted, and a correction to what the founder was told about CI.

---

## 1. The claim this corrects

The CEO's resume message on 2026-09-11 sent the Red Team to regenerate the XSS artifact, *«همین تنها
jobِ قرمزِ CI را سبز می‌کند»*: that fix would make the *only* red CI job green. **That is not true.**
On `76e422a`, the latest completed run on `main` (run `34613801508`):

```text
failure   design-system   ← Check XSS sink audit artifact is fresh     (the known one)
failure   landing         ← Unit tests (JSON-LD، Markdownِ امن، محتوای پیش‌فرض)   ← the one nobody named
cancelled e2e
success   test · build · boot-path · schema-drift · security · seo · standalone · … (all others)
```

**Two jobs are red.** Regenerating the XSS artifact fixes one of them and leaves `main` red.

---

## 2. Bisected: `f637948` is the commit that turned `landing` red

I checked before blaming anyone. Step conclusions for `landing → Unit tests`, by run:

```text
46ecebb  (parent)   run 34587425804   Unit tests: success
f637948             run 34587768859   Unit tests: failure    ← turned red here
9fd76ee             run 34588192678   Unit tests: failure
76e422a             run 34613801508   Unit tests: failure
```

**Why nobody saw it.** `ci.yml` sets `concurrency: ci-${{ github.ref }}` with `cancel-in-progress:
true`, and `f637948` went straight to `main` without a merge step. Its run completed as
**`cancelled`**, because the next push to `main` killed it. So the run page shows "cancelled", not
"failed". But the landing job had already reached its unit-test step and failed before the
cancellation. A cancelled run is not a green run, and here it hid a red one.

---

## 3. What fails, reproduced locally

```text
cd apps/landing && npx tsx --test --test-force-exit test/*.test.mts
# tests 106 · # pass 105 · # fail 1        EXIT=1
not ok 4 - زمان‌بندی: آخرین تیغه نباید بعد از intro-off تمام شود
  location: apps/landing/test/css.test.mts:51
  error:    'زمان‌بندیِ تیغه و پرده باید قابلِ‌خواندن باشد'     actual: undefined
```

**The curtain is not broken. The test that guards it can no longer read it.**

`apps/landing/test/css.test.mts:49-50` parses the timing as **literal seconds in shorthand**:

```text
animation: intro-bar ([\d.]+)s … animation-delay: calc(([\d.]+)s + var(--i) * ([\d.]+)s)
animation: intro-off … ([\d.]+)s
```

`f637948` rewrote the same CSS as **longhand plus a variable**
(`apps/landing/app/globals.css:891-920`): `--intro-t: 0.4s`,
`animation-name: intro-off; animation-delay: var(--intro-t)`, and bar timings as
`calc(var(--intro-t) * N / M)`. The old regex matches nothing, `bar` and `off` are `null`, and the
test fails on *parsing* before it ever checks a *timing*.

The new form is correct as far as I can verify from source. The `globals.css` comment derives that
the last bar ends at exactly `1 × --intro-t`, and `f637948`'s own new test checks the same arithmetic
and passes.

---

## 4. The actual finding: one fact, two tests, two suites, and only one suite was run

`f637948` **added** a test for the new timing form, `api/tests/landing-mobile-doors-and-intro.test.mts`,
registered in **`api/tests/_all.runner.mts`**. It **left** the existing test for the old form in
**`apps/landing/test/css.test.mts`**, which runs in the `landing` job. The api suite passed. The
landing suite was not run before pushing. The fact now has two copies that disagree, and the copy
that went red is in the suite the author didn't run.

That is worse than a plain red job, for two reasons:

- **The landing timing guard is blind while it is red.** It fails on parsing, so a real timing
  regression, such as the last bar outliving the curtain, would produce exactly the same failure.
  "Red for a stale regex" and "red for a real bug" can't be told apart.
- **The new test sits in the wrong suite.** It tests `apps/landing` CSS but runs in the `api` job.
  Anyone working on the landing app who runs the landing tests won't see it.

And both new tests are **regex over source text**. The commit title says it fixes the mobile doors
*"under Turbopack"*. A regex over the CSS source can't see what Turbopack emits, so neither test can
catch a regression of that particular bug. Only the tools in `tools/measure-landing-*.mjs` can, and
they don't run in CI. This isn't a ruling against the tests. It is a limit on what their green
proves.

---

## 5. Ruling and routing

**Ruling (mine: test strategy). Keep one test, in the landing suite, reading the new form.** Rewrite
`apps/landing/test/css.test.mts:48-58` to parse `--intro-t` and the `calc(var(--intro-t) * N / M)`
terms, and move the timing assertions out of `api/tests/landing-mobile-doors-and-intro.test.mts`,
so the landing app's timing is guarded where the landing app is tested. Don't just delete the old
test to get CI green: then the only timing guard lives in a suite the landing job doesn't run.

**It belongs to the Launch Engineer**, who owns `f637948`. **I am not editing it.**

**Correction for the founder:** CI on `main` has **two** red jobs. The XSS artifact regeneration
assigned to the Red Team fixes one of them.

**Routing, honestly.** Every session restarted again after 2026-09-11's `ROUTING.md` rows were
written. `ListAgents` now shows eight new names (`rezv-7f`, `0c`, `60`, `29`, `66`, `ef`, `ab`, `3c`),
and none matches any row in that file, including the CEO row. My message to `rezv-15` bounced. I'm not
mapping roles by position, so **this file is the delivery.**

---

## 6. What I did not check

- **The rest of `f637948`**: the mobile-door CSS behaviour under Turbopack, and the five measurement
  tools. I checked only the test and CI side.
- **Whether `e2e` would pass.** It was cancelled on every run listed, which is the 25-minute timeout
  already in the Launch Engineer's queue.
- **The landing tests on Linux.** I reproduced the failure on Windows. The cause is a regex against
  file content, not a path or case issue, so I'd expect the same result on Linux, but I didn't run it
  there.
- **`76e422a`**: the Designer merge is still queued for review.

*— founder-side reviewer, `rezv-45 [6e359d]`, 2026-09-11*
