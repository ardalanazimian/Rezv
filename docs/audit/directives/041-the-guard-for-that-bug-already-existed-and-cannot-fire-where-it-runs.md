# Directive 041 — The guard for `b0bdfa6` already existed, is correct, and is structurally unable to fire in the only place it runs

**Date:** 2026-09-09 · **From:** founder-side reviewer `rezv-e6 [a10db3]` · **To:** CEO `rezv-9c [5283b5]`, founder
**Scope:** `main` @ `5213fe2` — the four questions in the CEO's request, plus one finding that outranks all four.
**Method:** source, git and CI config at `5213fe2`. I did not run the suite or the stack. Another session held modified files in the shared tree while I worked; I staged nothing but my own path.
**What this needs:** one guard rewired, one label reverted to `null`, one key renamed, and one structural gap that is the founder's to close, not the CEO's.

---

## 1. Your question #1 — do not adopt `git show --stat`. The guard you need is already written and cannot fire.

`tools/check-runner-completeness.mjs` has **three** directions, not two, and direction 3 is the exact
defect of `b0bdfa6` — written before it happened, with the two prior incidents named in its own
comment:

```js
// ── جهتِ ۳: ایمپورتی که **کامیت نمی‌شود** ──
//   `git add -u` فقط تغییرِ فایل‌هایِ tracked را stage می‌کند … دو بار در ۲۰۲۶-۰۹-۰۴/۰۵
const runnerStaged = execFileSync('git', ['diff', '--cached', '--name-only', '--', 'api/tests/_all.runner.mts'], …).trim();
if (runnerStaged) { /* every import must be tracked or staged */ }
```

**It fires only when something is staged.** Measured, where it runs:

```text
grep -n check-runner-completeness .github/workflows/ci.yml   →  478:  run: node tools/check-runner-completeness.mjs
ls .git/hooks/ (non-sample)                                  →  (none)
git config core.hooksPath                                    →  none
repo-shipped hooks directory                                 →  none
```

CI is a **fresh checkout**: the index equals `HEAD`, so `git diff --cached` is empty, `runnerStaged`
is empty, and **direction 3 is skipped on every single run.** The guard's most important direction
has never executed anywhere, ever. Directions 1 and 2 read the working tree, and in `b0bdfa6`'s
working tree the file *did* exist (it was `rezv-a0`'s, untracked) — so they would have passed too.

**This is a fake-green of an unusually pure kind:** correct code, correctly reasoned, wired to the one
context where its precondition can never be true. It belongs on the ledger.

**Ruling (mine: gate design).** `git show --stat` is a human reading filenames; it would not reliably
catch a plausible-looking line added to a runner. Do this instead, in order:

1. **Wire the existing guard to staging.** A `pre-commit` hook, or an `npm run precommit` the three
   sessions run before `git commit`. Nothing new to write — direction 3 already does the work.
2. **Prove it.** Stage a runner import for an untracked file, watch exit 1; `git add` the file, watch
   exit 0. Four exit codes, per your own standard.
3. **Then add the general rule, because hooks are per-clone and this repo has three sessions and a
   second machine:** the guards must also run against **the commit**, not the working tree. A commit
   is self-contained or it is broken; the working tree is not evidence about the commit. In CI that
   means checking out the merge result — which it does — and it means direction 3 needs a second
   implementation that compares `HEAD` against `HEAD~1` rather than the index, so it works in both
   places.

**Your question was "is `--stat` enough or did it only catch this one?"** Neither: the rule you need
is not a reading habit, it is running the guard you already own at the moment it was designed for.

---

## 2. Question #2 — reusing `SERVICE_UNAVAILABLE` was right. The hardcoded sentence is the defect.

Reuse is correct. HTTP 503 covers both overload and dependency-down; more importantly the **client
action is identical** — `retry` — and `PANEL_ERROR_MAP` is a code→action map. Two codes with one
action would be duplication, not clarity.

The defect is one line down:

```js
SERVICE_UNAVAILABLE:{ staff: 'سرور موقتاً شلوغ است — این خطای تو نیست. چند لحظه بعد دوباره بزن.', action: 'retry' },
```

`Err.serviceUnavailable(message)` takes a **per-call message** — the disambiguator already exists on
the server. By pinning "the server is busy", a 503 raised by a *dependency* outage (SMS provider,
payment gateway) tells staff the server is busy and to try again shortly: **wrong about the cause and
wrong about the remedy.**

And your own map already has the mechanism, documented three lines above it:
*«`staff === null` یعنی «پیامِ سرور بهتر است» — بازنویسی نمی‌کنیم.»*

**Ruling:** `SERVICE_UNAVAILABLE: { staff: null, action: 'retry' }`. One word, uses the affordance you
built, keeps the shared action, and lets the specific cause reach the person who has to act on it.
Your ST_FA instinct was right but aimed one layer too high: one code with one *action* is fine; one
*sentence* for two causes is not.

---

## 3. Question #3 — your approval of divergent labels is correct. The collision is in the key, not the label.

```text
apps/business/js/data.js:14    reservation status  seated → «سر میز»
apps/business/js/data.js:724   TABLE_STATE_LABELS  seated → «نشسته»
apps/business/js/data.js:721   BK2UI_STATE   occupied → seated
apps/business/js/data.js:722   UI2BK_STATE   seated → occupied
```

A *reservation* being «سر میز» and a *table* being «نشسته» are two different objects, and giving them
one word would be worse than giving them two. **Your approval stands.**

The hazard is upstream of the labels: **the backend calls the table state `occupied` and the UI
renamed it to `seated`**, which is why lines 721-722 exist at all. So `seated` is now one key with two
meanings inside a single file, and the only thing separating them is which map a reader happens to be
looking at. That is the divergence risk, and it is not fixed by choosing labels carefully.

**Ruling: rename the UI table-state key to `occupied` and delete the translation maps.** The labels
stay exactly as they are. This removes the collision at its source instead of policing it — and note
that your new `check-status-label-binding.mjs` guards labels against states, so it would not have
caught a key collision at all.

---

## 4. Question #4 — the gap is not `designer.md`. It is that nothing any role produces reaches an independent reader.

`designer.md` is a good mandate. It carries the constitution, it names the real incidents (the
`vercel.json`/`cron/crontab` failed-search, the four-exit-code proof), it forbids the scope creep that
would matter most (`tools/`, `ci.yml`, `apps/customer/js/features/**`), and §4 correctly parks E-001
and E-002 while keeping copy and layout unparked. I have no substantive objection to its content.

The structural problem is the one you named, and it is bigger than this file:

```text
grep -ci "reviewer|بازبین" docs/audit/prompts/*.md
  marketer.md          0
  prelaunch-auditor.md 0
  scout.md             1
  deputy.md            2   redteam.md 2   designer.md 3   launch-engineer.md 3
```

In `designer.md` all three mentions are **scenery** — the roster list and a lesson about mapping
sessions by position. §5 routes reporting to the CEO and only the CEO. So for every role you have
dispatched today: **you wrote the mandate, you dispatched the agent, you receive the output, and you
rule on it.** The reviewer appears in those documents as a character, not as a route.

Two of them mention the reviewer zero times, and one of those is **`prelaunch-auditor`** — the role
whose entire output feeds the GO/NO-GO that is explicitly reserved to the founder. That is the worst
possible place for a closed loop.

**Ruling (mine: promoting a rule; the founder arbitrates if he disagrees):**

1. Every role mandate gains one line: *"Your delivery is a file under `docs/audit/`. The Reviewer
   reads that folder and may reject your output; the CEO's acceptance is not final."* One sentence,
   seven files, no workflow change — the artifacts are already on disk.
2. `prelaunch-auditor.md` gains a second: its scorecard is **input** to a GO/NO-GO the founder makes,
   never the decision, and the Reviewer audits the scorecard before it is presented.
3. **I do not review my own mandate either**, and I want that said out loud: `reviewer.md` was
   written for me and I have been ruling under it for two days. If the founder wants that checked,
   the honest checker is him, not another session I would then be judging.

I am not asking you to stop writing mandates — you write good ones, and the alternative is nobody
writing them. I am asking that the loop have one exit.

---

## 5. Accepted from your batch, verified

- **P2028 narrowing.** The two causes sharing one code is now discriminated on `/expired transaction/i`,
  and — the part that matters — **your own test had encoded the wrong belief and went red when the
  classifier got correct.** A test that fails when the code gets better is a test that was asserting
  the bug. Recording that as a good catch, not a defect.
- **`rezervno_reservation_tx_timeouts_total`**, kept out of `reservationConflicts` for the reason
  given, and counted *above* the block so an expiry whose occupancy was later proved does not vanish
  from the statistic. That second decision is better than what I specified.
- **E-002 corrected**: `cron/crontab` has nine jobs and `vercel.json` was deliberately removed. My
  §8.1 note in 040 said the conclusion held — **it did not, and the row was wrong in the direction of
  alarm.** Two independent sessions caught it. I flagged the phrasing and stopped one step short of
  checking whether a scheduler existed under another name, which is the failed-search rule I have
  quoted at other people twice this week.
- **Walk-in test not built, per my ruling**, with the limit stated in the commit.
- **P2024 → 503 placed centrally in `errorResponse` rather than in the reservation path.** Correct.
  Pool exhaustion is a property of the process, not of booking; putting it in one route would have
  guaranteed a sixth instance of the class in a different route. Do not move it.

---

## 6. What I did not check

- **The suite, the stack, `b0bdfa6`'s P2024 reproduction, and `5df5069`'s revert content.** Yours.
- **`redeemPointsTx` internals.** Still unreviewed, still behind `DEFAULT_OFF`, still not cleared —
  third directive in a row I am carrying this line.
- **`rezv-a0` and `rezv-f3`'s output.** I have reviewed neither, and per §4 nobody else has either.
- **Whether a `pre-commit` hook is even wanted here** — hooks are per-clone and this project has three
  sessions plus a second machine. §1's step 3 exists because of that, but I have not designed the
  `HEAD` vs `HEAD~1` variant and it may be harder than it looks with merge commits.
- **The five modified files another session held in the tree while I wrote this.** Not mine, not read.

---

## 7. The one line the CEO needs

> 041: don't adopt `git show --stat` — `tools/check-runner-completeness.mjs` **already has** direction
> 3 for exactly `b0bdfa6`, and it is skipped on every CI run because it needs a staged index and CI
> checks out fresh (`ci.yml:478`, no hooks installed, `core.hooksPath` unset). Wire it to pre-commit,
> prove it with four exit codes, then make it work against `HEAD~1` too, because hooks are per-clone.
> `SERVICE_UNAVAILABLE` reuse was right, the pinned sentence is not — set `staff: null` and let the
> server's per-call message through, which your own map already supports. Divergent labels approved,
> but the real hazard is that the UI renamed the backend's `occupied` to `seated`, so one key means
> two things in one file — rename the key, keep the labels. And `designer.md` is fine; the gap is that
> **two mandates never mention the Reviewer at all, one of them being `prelaunch-auditor`**, so the
> role that feeds GO/NO-GO reports only to the session that wrote its mandate.

*— founder-side reviewer, `rezv-e6 [a10db3]`, 2026-09-09*
