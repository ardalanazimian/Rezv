# STALENESS-FENCE-FIX-2 — the additive scan-if rule (closing the coverage loss)

**Date:** 2026-09-04 · **Branch:** `audit/launch-hardening` · **File changed:** `tools/check-doc-staleness.mjs`
**Not committed** (per mandate). No changes to `.claude/agents/`, `observability/`, or
`.github/workflows/ci.yml`. Ruling source verified at
`docs/audit/directives/004-fence-fix-coverage-ruling.md` — its text matches the coordinator's
message exactly where they overlap (path set, tag list, three proofs, accepted-consequence framing);
no variance to report.

## 0. What changed since STALENESS-FENCE-FIX.md

Round 1 made checks #2/#3 skip **every** fenced block. Round 1's own report proved a real cost with a
real exit code: `docs/recovery/BASELINE-TEST-STATUS.md:23`, a runnable setup line
(`export DATABASE_URL=…`) inside a fenced recipe, went from caught (`exit=1`) to missed (`exit=0`)
once fencing was blanket. This round replaces the blanket exemption with an **additive** rule:

> Scan a fenced block if **(a)** its file is in the executable path set (any tag, including none),
> **or (b)** the block's info-string is one of `bash sh zsh yaml env dotenv ini dockerfile make`
> (case-insensitive). Skip otherwise. Path adds scope, tag adds scope, nothing subtracts it.

`EXEC_PATHS = ['docs/recovery/', 'docs/DEPLOYMENT.md', 'docs/ENVIRONMENT.md', 'docs/VERCEL-DEPLOYMENT-CHECKLIST.md', 'docs/DEPLOY_API_VERCEL.md']`,
exactly as specified. No aliases were added to `EXEC_TAGS` (no `shell`, `yml`, `console`) — the
ruling's own §2 calls this a *typed contract*, and inventing synonyms would be exactly the kind of
heuristic-by-another-name Constitution 4b forbids.

## 1. Corpus check before implementing (zero-trust on the ruling's own numbers)

The coordinator's message cited `text 23, mermaid 22, ts 16, js 11, bash 11, sql 8, prisma 8, json 8,
css 7, sh 4`. A live measurement, same method as round 1 (open/close paired fence state machine, same
`isHistory` filter, run today against the current corpus), gives a different picture:

```text
$ node -e '<open/close state-machine tag counter, see script text below>'
untagged 87 · bash 45 · text 23 · mermaid 22 · ts 14 · json 11 · sql 8 · js 7 · css 6 ·
prisma 6 · sh 4 · jsonc 2 · html 2 · tsx 2 · ini 1 · python 1   (241 fence openers total)
```

`text`, `mermaid`, and `sh` match exactly; `bash` (45 vs 11), `ts`, `js`, `json`, `prisma`, `css` are
off by varying amounts. This is corpus drift, not a wrong claim: multiple agents are committing new
`docs/` files this session (confirmed repeatedly via `git status` — `docs/audit/directives/`,
`docs/ml/`, etc. did not exist a few hours ago). It does not change the design — the rule is a typed
contract on tag identity, not a threshold on tag frequency — but the qualitative claim in the ruling
("executable tags separate cleanly") is independently reconfirmed on live data: `bash`(45) + `sh`(4) +
`ini`(1) = 50 executable-tagged openers sit cleanly apart from 104 non-executable-tagged and 87
untagged ones. Comment in the code cites these live numbers, not the coordinator's, and says why.

## 2. The four falsifiability proofs, exit codes

### Proof 1 — the demonstrated regression goes red again, then restores byte-exact

`docs/recovery/BASELINE-TEST-STATUS.md:23` (the real file, not a copy — `docs/recovery/` is now in
`EXEC_PATHS`) was edited in place: `export DATABASE_URL="…"` → `export DATABASE_URL_RENAMED_STALE_PROOF="…"`.

```text
$ node tools/check-doc-staleness.mjs
  • docs/recovery/BASELINE-TEST-STATUS.md:23 — متغیرِ «DATABASE_URL_RENAMED_STALE_PROOF» ...
PROOF1_RED_EXIT=1
```

Restored the exact original line, byte-for-byte:

```text
$ cmp docs/recovery/BASELINE-TEST-STATUS.md <snapshot-taken-before-the-edit>
CMP_EXIT=0
$ git status --porcelain -- docs/recovery/BASELINE-TEST-STATUS.md      → (empty, no diff)
$ node tools/check-doc-staleness.mjs
PROOF1_RESTORED_EXIT=0
```

`cmp` exit 0 confirms byte-exact restore independently of git; `git status` showing no diff confirms
it a second, independent way. This is the exact regression named in round 1 — closed.

### Proof 2 — an evidence transcript still passes (the one to watch)

`docs/audit/round-20-fence2-probe.md` (deleted, §6), outside HISTORY and outside `EXEC_PATHS`, a
`text`-tagged block (the corpus's own convention for "this happened") deliberately containing both a
shell exit assignment shaped to trip check #3 and a stale hostname shaped to trip check #2:

```text
$ node tools/verify-restore.mjs; EXIT=$?
EXIT=1
$ curl -I https://totallyfakehost.rezervno.ir/health
```

```text
$ node tools/check-doc-staleness.mjs
  ⤷ docs/audit/round-20-fence2-probe.md — 1 غیرِ-اجرایی · 0 بدونِ‌برچسب-خارجِ-دامنه
✓ اسناد تازه‌اند — ...
PROOF2_EXIT=0
```

Exit 0. The block is correctly attributed as one skipped-as-non-executable block in the per-file
ledger — visible, not silent — and neither the fake exit assignment nor the fake hostname produced a
failure. This is the proof the ruling said to watch; it passed clean. No corruption of the record was
reintroduced.

### Proof 3 — the skip counter is load-bearing (non-zero where skipped, zero where none)

`docs/audit/round-20-fence3-probe.md` (deleted, §6): plain prose, zero fenced blocks.

```text
$ node tools/check-doc-staleness.mjs 2>&1 | grep fence3-probe
(no output — the file does not appear in the per-file ledger at all)
PROOF3_ZERO_EXIT=0
$ node tools/check-doc-staleness.mjs 2>&1 | grep -c '⤷'
52
```

Explicit, git-independent confirmation of the zero (not just absence from the printed list):

```text
$ node -e '<same open/close state machine run against only this file>'
explicit per-file skip counts for round-20-fence3-probe.md: {"nonExecutable":0,"untaggedOutsideSet":0}
```

Meanwhile the same run reports 52 *other* files with non-zero skip lines in the ledger — proving the
counter genuinely varies per file rather than being a constant placeholder. Both directions shown:
non-zero where skipped (52 files, e.g. `docs/audit/directives/004-fence-fix-coverage-ruling.md — 2
غیرِ-اجرایی`, its own two `text`-tagged evidence quotes), zero where not (this probe, and any file
with no fences).

### Proof 4 (mine) — a tag typed inside the executable path set must not create a bypass

This is the specific one-keyword bypass the ruling names as the reason the rule must be additive, not
subtractive, attacked directly rather than inferred: `docs/recovery/round-20-fence4-probe.md`
(deleted, §6), *inside* `EXEC_PATHS`, with its block deliberately tagged `text` — the exact tag a
genuine evidence transcript carries — wrapped around a fake stale variable:

```text
$ export FENCE4_PATH_BEATS_TAG_STALE_VAR=1
```

```text
$ node tools/check-doc-staleness.mjs
  • docs/recovery/round-20-fence4-probe.md:9 — متغیرِ «FENCE4_PATH_BEATS_TAG_STALE_VAR» ...
PROOF4_EXIT=1
```

Exit 1. Typing `text` on a stale value inside `docs/recovery/` did **not** remove it from scope — path
added scope and no tag subtracted it, exactly as designed. This is the concrete refutation of the
"one keystroke shrinks coverage" failure mode the ruling was written to prevent.

## 3. Skip counts and coverage delta — same live corpus, both rule versions

A throwaway diagnostic (not shipped) ran round-1 semantics (skip every fence, no exceptions) and
round-2 semantics (the additive rule) against the identical 121-file corpus:

| | hostSeen (chk 2) | envSeen (chk 3) | failures either way |
|---|---|---|---|
| round-1 (skip-all-fences) | 16 | 42 | 0 |
| round-2 (additive rule) | **25** | **54** | **0** |

+9 subdomain mentions and +12 env-var rows came back into scope, and **zero new failures** resulted —
every one of them, read at source, turned out to be currently-correct content:

- **5 of the 12 newly-scanned env rows are exactly the regression closed in Proof 1**:
  `docs/recovery/BASELINE-TEST-STATUS.md:19,23,24,25,26` (`POSTGRES_USER`, `DATABASE_URL`,
  `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`) — back in scope because the file is in
  `EXEC_PATHS`.
- The other 7 env rows and all 9 host mentions came back into scope purely on **tag**, not path:
  `STATE-2026-08-26.md:67-70`, `DATABASE-OPS.md:148`, `docs/PROJECT_KNOWLEDGE.md:198`, and
  `docs/adr/0002-public-website-and-cms.md:187` are all `bash`-tagged blocks *outside* `EXEC_PATHS`.
  Read at source (quoted below, §5), every one of them is itself a "run this to set up your
  environment" recipe, not a transcript — the tag-based half of the rule caught genuine runbook
  content that the five named paths didn't enumerate. This is a real, useful finding, not a defect:
  the two-pronged design (path OR tag) has independent value beyond the initial path list.

## 4. Anti-silence condition — what it looks like live

Every run, pass or fail, prints the skip ledger before the pass/fail report. On the current corpus:

```text
— فنس‌هایِ نادیده‌گرفته‌شده طبقِ قاعده‌ی افزایشی: 86 فنسِ غیرِ-اجرایی (نادیده) · 59 فنسِ بدونِ‌برچسب-خارجِ-دامنه (نادیده)
  ⤷ COMPANY-PANEL-API.md — 1 غیرِ-اجرایی · 0 بدونِ‌برچسب-خارجِ-دامنه
  ⤷ DATABASE-OPS.md — 0 غیرِ-اجرایی · 2 بدونِ‌برچسب-خارجِ-دامنه
  … (52 files total)
✓ اسناد تازه‌اند — 121 فایل · 8 آدرسِ مخزن · 25 زیردامنه · 54 ردیفِ متغیر · 86 فنسِ غیرِ-اجرایی (نادیده) · 59 فنسِ بدونِ‌برچسب-خارجِ-دامنه (نادیده)
LIVE_GATE_EXIT=0
```

The two reasons are counted and reported separately (not one merged number) so "non-executable tag"
and "no tag, outside the set" remain distinguishable causes, per file and in aggregate. `86 + 59 = 145`
fenced blocks are currently withheld from checks #2/#3 out of the corpus's fence openers — none of
them silently; every one is attributed to a file in the printed ledger.

## 5. Read at source — the newly-scanned bash-tagged recipes (why zero of them failed)

```text
STATE-2026-08-26.md:63          ### محیطِ لازم برای تست‌های بک‌اند
STATE-2026-08-26.md:64-70       ```bash / docker start … / export DATABASE_URL=… / … / ```

DATABASE-OPS.md:145             **روشِ تشخیص که در تستِ end-to-end این نشست کار کرد:**
DATABASE-OPS.md:146-…           ```bash / cd api / export DATABASE_URL="..." / …

docs/PROJECT_KNOWLEDGE.md:191-200   ```bash / npx serve apps/customer … / BASE_URL=… npm test / ```

docs/adr/0002-public-website-and-cms.md:174-187  ```bash / cd ../apps/landing / npm install /
                                                  SITE_API_BASE=https://api.rezervno.ir … npm run dev / ```
```

All four are "how to reproduce this locally" instructions, correctly re-exposed to checks #2/#3 by
the `bash` tag alone (none of these paths are in `EXEC_PATHS`). All four cite currently-correct names
(`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BASE_URL`, `SITE_API_BASE`,
`api`/`app`/`www`/`business` — all known/served), which is exactly why the coverage increase produced
zero new failures rather than zero new coverage.

## 6. Cleanup

```text
$ rm docs/audit/round-20-fence2-probe.md docs/audit/round-20-fence3-probe.md docs/recovery/round-20-fence4-probe.md
$ node tools/check-doc-staleness.mjs > /dev/null 2>&1; echo $?
0
$ git status --porcelain -- docs/recovery/ docs/audit/round-20-fence*
(empty)
```

`docs/recovery/BASELINE-TEST-STATUS.md` carries no diff (confirmed twice: `cmp` in Proof 1 and
`git status` here). The only tracked-file change from this round is `tools/check-doc-staleness.mjs`.

## 7. Byte verification — git-independent, per instruction

`check-control-bytes.mjs:34` enumerates via `git ls-files`, which lists **tracked** paths regardless
of working-tree modification state — for an already-tracked file like this one, it does read live
disk bytes, so it is not actually blind to *this* edit. It would be blind to a brand-new, never-staged
file in scope, which is the case the instruction was guarding against. Both were run:

```text
$ node tools/check-control-bytes.mjs
✓ بدونِ بایتِ کنترلی — 119 فایلِ اجراشدنی بررسی شد
GIT_DEPENDENT_EXIT=0
$ node -e '<direct Buffer scan of tools/check-doc-staleness.mjs for forbidden C0/DEL bytes, no git>'
forbidden control bytes found: 0
byte length: 25405
GIT_INDEPENDENT_EXIT=0
```
```text
$ node --check tools/check-doc-staleness.mjs
SYNTAX_EXIT=0
```

Written with `Edit`, never a heredoc, throughout.

## 8. Accepted consequences, stated so they are not discovered later

1. **Inside `EXEC_PATHS`, evidence transcripts get scanned too and may false-positive** — the ruling's
   own stated cost. `docs/recovery/` currently holds `OPEN-FINDINGS.md` and `PHASE-2-PLAN.md` in
   addition to `BASELINE-TEST-STATUS.md`; their fenced blocks (`ts`/`js`, none tagged as evidence) are
   now fully in scope by path, any tag. None currently false-positive (confirmed: full-corpus run is
   `exit=0`), but a future audit transcript pasted into any of these three files, in any fence, would
   be scanned and could misfire. **Owner: whoever adds content to `docs/recovery/`, `docs/DEPLOYMENT.md`,
   `docs/ENVIRONMENT.md`, `docs/VERCEL-DEPLOYMENT-CHECKLIST.md`, `docs/DEPLOY_API_VERCEL.md` going
   forward** — the fix for a false positive there is to move the transcript into a report (e.g.
   `docs/reports/` or `docs/audit/directives/`), not to exempt the block. This is deliberate, per §2
   of the ruling: "a stale value in a runbook gets executed; a stale value in a report gets read."
2. **A `bash`/`sh`/etc-tagged block is in scope everywhere, including outside `EXEC_PATHS`** — this
   follows directly from rule (b) being location-independent ("wherever it appears," ruling §2). §3/§5
   above show this is currently a net positive (it caught four real recipes the path list didn't
   name), but the flip side is symmetric: an **evidence transcript mis-tagged `bash` instead of
   `text`/`console`** (exactly the mistake round 1's own probe made) will be scanned as if it were a
   runnable recipe, anywhere in the corpus. This is not a defect in the rule — it is the typed
   contract working as declared — but it means tag discipline now matters for authors, not just for
   this gate. **Owner: whoever writes evidence transcripts going forward** — tag them `text`, not
   `bash`, or they lose the round-1 protection this rule preserves for correctly-tagged transcripts.

## 9. Something this mandate did not ask for

`docs/audit/directives/004-fence-fix-coverage-ruling.md` — the ruling document itself — is **not** in
`HISTORY` (only `docs/reports/`, `docs/audit/reports/`, and specific audit-round prefixes are). It
quotes the exact regression evidence in two `text`-tagged blocks (lines 18-21 and 35-38 of that file).
The live run correctly attributes it `2 غیرِ-اجرایی` in the skip ledger and produces zero failures
from it — the fix handles the ruling's own document with no special-casing, which is a small but real
self-consistency check nobody asked for and that could have gone the other way (e.g. if the ruling's
quoted `docs/recovery/BASELINE-TEST-STATUS.md:23   export DATABASE_URL="postgresql://…"` line had
been read as a live env-var declaration rather than a quoted example, it would have been a false
positive in the very document that diagnosed the round-1 gap). It wasn't, because it's `text`-tagged
and outside `EXEC_PATHS`. Confirmed by reading the live skip ledger output in §4, not asserted.
