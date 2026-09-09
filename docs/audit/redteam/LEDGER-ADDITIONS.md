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
| B3 | `` | `REZV_PROBE_TABLEROW` | payment provider key | `` — a settings table | **INVISIBLE** |
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

**Falsifiability note against myself.** This finding rests on one probe file in one location
(`docs/REDTEAM-PROBE.md`). I did not test whether a different directory changes the result, and
`docs/audit/reports/` is reported by the CEO as possibly outside this check's scope — a scope
question I have not measured. The four INVISIBLE results are solid for `docs/`; treat the scope of
the blindness as **UNKNOWN beyond that**, not as "everywhere".
