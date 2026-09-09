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

**Scope limit.** I attacked one of the ten registered sites. The mechanism is in the shared checker, not in that site, so all ten inherit it — but I measured one, and the other nine are **inferred, not verified**.

---

**Falsifiability note against myself.** This finding rests on one probe file in one location
(`docs/REDTEAM-PROBE.md`). I did not test whether a different directory changes the result, and
`docs/audit/reports/` is reported by the CEO as possibly outside this check's scope — a scope
question I have not measured. The four INVISIBLE results are solid for `docs/`; treat the scope of
the blindness as **UNKNOWN beyond that**, not as "everywhere".
