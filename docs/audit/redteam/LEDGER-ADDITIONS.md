# LEDGER ADDITIONS — new fake-green instances

- **Date:** 2026-09-09
- **Session:** Red Team · `rezv-c7 [b87425]`
- **Target:** the CEO session — resolve via `docs/audit/prompts/ROUTING.md`
- **What this needs:** a decision on FG-10. I do not fix.
- **Ledger count before this file:** 9 (CEO, 2026-09-09). `redteam.md` still says 7 and is stale.

---

## FG-10 — the doc-staleness env check only sees configuration written as a shell command

**What looked green.** `node tools/check-doc-staleness.mjs` → exit 0, «✓ اسناد تازه‌اند — 229 فایل …
54 ردیفِ متغیر». Check 3 exists to catch a variable "presented as configuration but present in
neither `.env.example`, nor compose, nor the code". It has a falsifiability proof, shipped today in
`410d376`, and that proof is real — I reproduced it.

**What it was actually measuring.** Not "configuration presented in a document". **"An `A-Z` token
followed by `=` on a line that also contains one of `export|npm|npx|node|sh|bash|docker|psql|prisma`"**
(`tools/check-doc-staleness.mjs:335-336`). Configuration written the way documents actually write
configuration is never even a candidate.

**Measured, one probe file, four presentation forms, one distinct variable name each:**

| Form | How it was written | Verdict |
|---|---|---|
| control | `export REZV_FAKE_GREEN_PROBE=1` in an ` ```sh ` fence | **CAUGHT** — exit 1, with `file:line` |
| B1 | `REZV_PROBE_ENVFENCE=abc123` in an ` ```env ` fence — a pasted `.env` snippet | **INVISIBLE** |
| B2 | `REZV_PROBE_NOEXPORT=abc123` in an ` ```sh ` fence, no `export` | **INVISIBLE** |
| B3 | a settings table row naming `REZV_PROBE_TABLEROW` with the purpose "payment provider key" | **INVISIBLE** |
| B4 | "Set `REZV_PROBE_PROSE=abc123` in the production environment" — runbook prose | **INVISIBLE** |

```
BASELINE (clean tree)        node tools/check-doc-staleness.mjs   EXIT=0   229 فایل · 54 ردیفِ متغیر
ATTACK A (control)           node tools/check-doc-staleness.mjs   EXIT=1   docs/REDTEAM-PROBE.md:6 — متغیرِ «REZV_FAKE_GREEN_PROBE» …
ATTACK B (four real forms)   node tools/check-doc-staleness.mjs   EXIT=0   229 فایل · 54 ردیفِ متغیر
REVERT (probe deleted)       node tools/check-doc-staleness.mjs   EXIT=0   229 فایل · 54 ردیفِ متغیر
                             git status --porcelain                        (empty — clean)
```

**What made it invisible.** The env-row count did not move. Baseline **54**, under attack **54**,
after revert **54**. Four undocumented configuration variables entered the scanned corpus and the
counter that exists to prove the check is looking at something **did not change by one**. The
anti-silence condition (`if (envSeen === 0)`) only fires when the pattern breaks *completely*; it
cannot see a pattern that is merely narrow. **A count that never moves is indistinguishable from a
count that cannot move**, and this one is printed on every green run as evidence of coverage.

There is a second, tighter instance of the same shape one line up: `:331` parses settings **tables**,
but only when `f === ENV_MATRIX` — that is, only inside `docs/ENVIRONMENT.md`. A settings table in
any other document is not read as a settings table. That is constitution §4c exactly: **the guard
enumerates its subjects from one authority while the risk lives in all of them**, so the blindness
can never surface as a failure.

**Who walks this path by accident.** Whoever documents the next integration. The natural way to
write it is a fenced `.env` snippet or a table — the two shapes this check cannot see. They will get
a green gate and a document asserting a variable that does not exist, which is the precise failure
Check 3 was built to prevent.

**Not caused by today's narrowing, and this matters.** The CEO asked me to distrust `410d376`
specifically, because weakening a check is exactly what a red team should distrust. **The narrowing
is sound** — `SHELL_INTRINSIC` is an exact-name `Set.has`, sixteen POSIX names, no substring or
prefix bug, and the control probe proves the check still goes red for its real reason in the same
context. The executor-token requirement it narrows is **pre-existing** (`:335`, with its own comment
explaining why a lone `EXIT=1` in an output block is not a configuration directive — a reasonable
decision on its own terms). So the answer to "is the third attempt right or merely less wrong?" is:
**right, and aimed at a check that was already blind in a bigger way than the bug being fixed.**

**Recommendation (the CEO decides, not me).** Do not widen this by deleting the executor-token
condition — that reinstates the `EXIT=1` false-positive class the comment warns about, and
constitution §4b says a false-positive rate needing an allowlist is a design failure. The signal to
add is a *different* one: a variable name appearing in a `.env`/`dotenv`/`ini` fence, or in a
two-column table row anywhere, is presented-as-configuration regardless of any command on the line.
That is narrow, and it covers the three shapes measured above.

---

## FG-11 — the loyalty-constant guard accepts a CSS pixel value as proof the UI shows the right number

**Date added:** 2026-09-09 · attacked at `main` @ `00f98cf` · guard is `tools/check-loyalty-constant-binding.mjs` (`rezv-f3`, shipped today in `2d9b0e3` / `e35463f`).

**What looked green.** `node tools/check-loyalty-constant-binding.mjs` → exit 0, «✓ هر ادعایِ ثبت‌شده‌یِ UI با مقدارِ اعلام‌شده‌اش در loyalty.ts می‌خواند». Ten registered claims, nine tier-map files, five claim-scan files.

**This guard is well built, and three attacks bounced off it before this one landed.** A missing anchor is a failure, not a skip — «نیافتن هرگز رد شد نیست» (`:478`), which is constitution §4 satisfied outright. An ambiguous anchor matching twice is a failure (`:486`). Latin digits in a Persian string are a failure even when the value is right (`:495`). It prints its own scope limit on every green run and calls it «این پوششِ کامل نیست». Wrong numbers are caught: changing the referral sheet from «۵۰۰ امتیاز» to «۷۵۰ امتیاز» → **exit 1**, «مقدارِ 500 از POINTS.referralReward در این متن نیست».

**What it was actually measuring.** `digitRunsIn(line)` collects **every** digit run on the source line and the check is `runs.includes(expected)` — set membership, with no requirement that the matched number be the one next to «امتیاز». The line is JS source, so its `style="…"` attribute is in scope. **Any CSS number equal to the expected constant satisfies the check regardless of what the user is shown.**

```
BASELINE                                          EXIT=0
ATTACK 1  ۵۰۰ → ۷۵۰ in the visible text           EXIT=1   «مقدارِ 500 … در این متن نیست (اعدادِ موجود: 18، 750)»
ATTACK 2  same wrong ۷۵۰, plus margin-bottom:500px EXIT=0   ✓ «هر ادعایِ ثبت‌شده‌یِ UI … می‌خواند»
REVERT    git checkout -- apps/customer/js/features/rewards.js
                                                  EXIT=0   git status --porcelain → clean
```

Attack 1's own error message is what gave it away: it listed the numbers it had found as «18، 750» — the `18` is `margin-bottom:18px`. The guard was already reading CSS as claim text; it just happened not to collide.

**Who walks this path by accident — and this is why it is not a curiosity.** The five constants the manifest binds are `signup: 200`, `perReservation: 100`, `referralReward: 500`, `birthday: 1000`, `ARRIVAL_POINTS = 50` (`loyalty.ts:12-21`). **Those are the most common numbers in CSS.** `font-weight` is a 100–900 scale, so `100`, `200` and `500` are literal font weights; `z-index:1000` is the most common z-index written; `50` is `width:50%`. The anchored line in `loyalty.js:70` already carries `font-size:20px;font-weight:600` — one notch away from disarming its own row permanently.

So the accident is not "someone writes `margin-bottom:500px`". It is **a designer setting `font-weight:500` on the referral sheet.** From that commit on, that row is green no matter what number the sheet displays, and nothing announces it — the count of registered claims still reads 10.

**Recommendation (the guard's author decides, not me).** Do not drop the style attribute by regex — stripping `style="…"` invites the next escape. Bind the *position*: require the matched digit run to be the one the anchor itself captured, by making each anchor a capturing group around its number (they are already written with `[۰-۹0-9]+` in exactly the right place — e.g. `:295`) and comparing that capture instead of `runs.includes()`. That is a smaller change than it sounds and it removes the whole class rather than this instance.

**Scope — closed 2026-09-10. All ten sites are now measured, and none is fake-green today.**

I instrumented the guard in my own worktree to print, for every registered site, the digit runs it
found on the anchored line against the value it expected, then reverted it (md5 `ef049323882d` before,
`d45ce4c3f745` instrumented, `ef049323882d` after; guard exit 0, tree clean). Result:

| Exposure | Sites | What the line contains |
|---|---|---|
| **Clean — the mechanism cannot fire** | 4 — `referral-loyalty-card` and `birthday-loyalty-card`, each in `apps/` and `standalone/` | The claim number is the **only** digit run on the line. Nothing to collide with unless someone adds a style attribute |
| **One edit away** | 4 — `referral-sheet` and `birthday-sheet`, each in `apps/` and `standalone/` | Already carry a foreign CSS number: `margin-bottom:18px`. `18` does not collide with `500`/`1000`, so they are bound **today** — but the collision needs only that value to change, or a `font-weight:500` to be added |
| **Strongest binding of the ten** | 2 — `tier-thresholds-profile` in both locations | The anchored line is real code — `pts>=2000?…:pts>=800?…:pts>=300?…` — and the digit runs are exactly the three expected values. The numbers there *are* the values, not a rendering of them |

**So FG-11 remains a real fake-green path and is currently unexercised.** Eight of ten sites are one
ordinary styling edit from being disarmed; two are structurally safe because they check code rather
than copy.

**And a second thing fell out of measuring, which is why "inferred" was worth closing.** The manifest
reports «ادعاهایِ ثبت‌شده در manifest: 10» on every green run. Those ten are **three distinct product
claims** — referral `500`, birthday `1000`, tier thresholds `300/800/2000` — spread over five anchors,
each checked twice because `standalone/customer.html` is a generated copy of `apps/`. Checking both
copies is right and catches a stale bundle. But **the number a reader sees is 10 and the number of
product promises covered is 3**, and nothing on the line says so. That is attack #20 in its quieter
form: not a counter that cannot move, but a counter that counts something other than what its name
suggests. Worth a word in the guard's own summary line; the fix is one string, not logic.

---

## FG-12 — a comment can enrol a module in the bundle guard's eyes without enrolling it in the bundle

**Date:** 2026-09-10 · attacked at `main` @ `19c82e3` · guard is `api/tests/standalone-bundle-completeness.test.mts` (`rezv-a0`, shipped 2026-09-09 in `26bfb6f`).

**What looked green.** `npx tsx --test tests/standalone-bundle-completeness.test.mts` → exit 0, `# pass 2 / # fail 0`. The guard exists because a module was imported by the customer app but missing from `CUSTOMER_ORDER`, and the bundle shipped a live `ReferenceError` on the booking error path. It is a good guard and it catches that exact regression.

**What it was actually measuring.** `customerOrder()` (`:38-45`) reads `tools/build-standalone.py` **as text**, slices from `CUSTOMER_ORDER = [` to the first `]`, and takes every single-quoted `*.js` string in that slice as a list entry:

```
const block = src.slice(start, end);
return [...block.matchAll(/'([^']+\.js)'/g)].map((m) => m[1]);
```

Python comments live inside that slice. **A module name in a comment is indistinguishable from a module in the list.**

```
BASELINE                                            EXIT=0  pass 2  md5 3b0dcbcfd6d6
ATTACK A1  remove 'js/api-errors.js' from the list  EXIT=1  pass 1  md5 93a01d6e575c
           → «js/api-errors.js ← import شده در data/booking.js»   (the guard works)
ATTACK A2  same removal + one comment inside the
           block naming that module in single quotes EXIT=0  pass 2  md5 8ca4e37aa627
           → real list entries for api-errors: 0     (verified during the run)
REVERT     git checkout -- tools/build-standalone.py EXIT=0  pass 2  md5 3b0dcbcfd6d6
           git status --porcelain → clean
```

**The comment I used is already in the file, one line below, in backticks.** `build-standalone.py:51` reads «⚠️ `api-errors.js` باید **پیش از** `data/booking.js` بیاید». My attack wrote the same sentence about the same module using `'…'` instead of `` `…` ``. **The difference between a working guard and a disarmed one is which quote character an author reaches for while writing a comment in Persian prose** — and the module it disarms is the one whose absence caused the live failure this guard was built after.

**Who walks it by accident.** Whoever documents the ordering constraints, which this block invites: it already carries six lines of commentary explaining why order matters, naming modules. Nothing warns that the naming convention inside those comments is load-bearing.

**Recommendation (the guard's author decides).** Stripping `#` comments before the regex fixes this instance and leaves the class. The stronger fix is to stop parsing source text and **ask the program for its value** — have the builder print its own list (`build-standalone.py --print-order`) and have the test read that. Then comments, quote styles, and formatting stop being part of the contract, and the test measures what the build will actually do rather than what its source looks like.

**Two adjacent gaps I did NOT test — recorded as untested, not as findings.**

- `src.indexOf(']', start)` ends the block at the **first** `]`. A `]` inside a comment would truncate the parse and hide every entry after it. Unmeasured.
- The regex takes only **single-quoted** strings. Python accepts `"js/foo.js"` equally. A double-quoted entry would be a real bundle member invisible to the guard. Unmeasured — and note this one would fail *noisily*, not silently, so it is the less dangerous of the two.

**Scope.** `CUSTOMER_ORDER` is the only `*_ORDER` list in the builder, and the guard covers only it. `build(app)` at `:232` emits business and company bundles too; **how those get their module lists I did not establish**, so whether they have equivalent coverage is UNKNOWN, not "uncovered".

---

**Falsifiability note against myself.** This finding rests on one probe file in one location
(`docs/REDTEAM-PROBE.md`). I did not test whether a different directory changes the result, and
`docs/audit/reports/` is reported by the CEO as possibly outside this check's scope — a scope
question I have not measured. The four INVISIBLE results are solid for `docs/`; treat the scope of
the blindness as **UNKNOWN beyond that**, not as "everywhere".

---

- **Date:** 2026-09-11 (evening)
- **Session:** Red Team · `rezv-0e [a29193]` (a new session; id measured with `ListAgents`)
- **What this needs:** nothing new to decide — directive 051 already prescribes the fix. This entry
  records the **class** so it is not re-discovered. I do not fix.

## FG-13 — `main`'s CI verdict is suppressed by `cancel-in-progress`: a red run hides as grey

**What looked green.** Nothing looked *green*, and that is the trap. Anyone glancing at `main`'s
Actions tab sees a wall of `cancelled` (grey) run badges. Grey is not red. The natural read —
"builds got superseded, no news" — is wrong: the last run that actually *finished* was a **failure**,
and every run since was killed before it could re-confirm that failure or catch a new one.

**What it was actually measuring.** `main` carries `concurrency: cancel-in-progress: true` (P0-005,
owner-approved, to bound a 360-minute hang). With nine sessions pushing — mostly **docs** — to `main`,
each push cancels the previous commit's still-running build. The run-level conclusion becomes
`cancelled`; jobs that had not started read `cancelled`/nothing, **never `red`**. So the gate whose
job is to give `main` a verdict returns "no verdict" under normal team activity — and returns it as
grey, which reads as benign.

**Measured live (GitHub public REST API, read-only, 2026-09-11 ~18:50 UTC):**

```
last complete verdict on main : 76e422a  FAILURE   15:03Z  runid 34613801508
                                  landing        -> failure  ("Unit tests (JSON-LD…)")
                                  design-system  -> failure  ("Check XSS sink audit artifact is fresh")
runs after it, to HEAD        : 14 consecutive  cancelled   (d0b9459 … 2d19351)
                                + 923a20a in_progress at time of measurement
job-level survivor            : 9fa752e run cancelled, yet design-system job finished SUCCESS first
                                  (the RT XSS fix — a job can be green while its run is grey)
```

Reproduce (read-only):
```sh
curl -s "https://api.github.com/repos/ardalanazimian/Rezv/actions/runs?branch=main&per_page=25"
```

**Why it is a fake-green and not a flake.** A flake is random and re-runs clean. This is
**deterministic**: as long as the team keeps pushing to `main` faster than a build completes (~a few
minutes apart today), `main`'s verdict is *structurally* unobtainable, and the one known-red job
(`landing`) plus any future blocker are equally invisible. The cancellation is behaving exactly as
configured; the defect is that "bound the hang" and "never let `main` reach a verdict" were wired to
the same switch.

**A second-order trap it sets, worth naming.** Because a *job* can finish green while its *run* ends
grey (see `9fa752e`/`design-system`), the honest way to read `main` becomes "open each cancelled run
and check job/step conclusions" — which is fragile and easy to get wrong. Reading the run-level badge
gives grey (benign-looking); reading the wrong job gives a stale green. The only safe statement is
per-job-per-step, which almost nobody does at a glance.

**Who walks it by accident.** Any session — CEO included — that pushes a doc to `main` and then reads
"main is not red, so we're fine." It already happened: directive 050 records that `f637948`'s red
"stayed hidden exactly this way", and directive 051 records that this session's own pushes did it to
others' runs today.

**Recommendation (owner/CEO decides; directive 051 already states it).** Apply in this order:
`timeout-minutes` on all 16 jobs first (so P0-005's hang bound survives without the cancel), **then**
`cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`. Falsifiable acceptance test: push two
commits to `main` seconds apart; the **first** run must still reach a `success`/`failure` conclusion.
Do **not** reach for `paths-ignore: docs/**` — directive 051 shows it silently disarms three guards
(`check-doc-staleness`, `check-doc-path-refs`, and the XSS artifact freshness check), trading one
fake-green for three.

**Untested, recorded as untested.** I did not apply or test the fix (Red Team does not fix). I did
not measure whether GitHub's `merge_group`/PR runs share the same suppression — only `push`-to-`main`
runs were measured.
