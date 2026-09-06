# STALENESS-FENCE-FIX — checks #2/#3 now skip fenced code blocks

**Date:** 2026-09-04 · **Branch:** `audit/launch-hardening` · **File changed:** `tools/check-doc-staleness.mjs`
**Not committed** (per mandate). No changes to `observability/`, `.github/workflows/ci.yml`, or any
other file — another agent is active in both, confirmed live in `git status` during this session.

## 1. The problem, reproduced (not asserted)

Check #3 (env-var check) treats a line as a "configuration declaration" whenever it contains a
command-word token (`export`/`npm`/`npx`/`node`/`sh`/`bash`/`docker`/`psql`/`prisma`) followed by
an `UPPER_SNAKE=` assignment — with no regard for whether that line sits inside a fenced evidence
transcript or in ordinary prose giving current instructions. A minimal probe doc,
`docs/audit/round-20-fence-probe.md` (deleted, see §5), containing exactly the transcript shape the
constitution mandates:

```bash
$ node tools/verify-restore.mjs; EXIT=$?
$ npm test; REAL_NPM_TEST_EXIT=$?
$ export JWT_ACCESS_SECRET=PLACEHOLDER_NOT_A_SECRET
$ node server.js
EXIT=1
```

Running the **original, committed** guard (`git show HEAD:tools/check-doc-staleness.mjs`, executed
as a sibling temp file so `REPO` still resolves correctly) against this doc:

```
❌ کهنگیِ سند — 3 مورد:

  • docs/audit/round-20-fence-probe.md:6 — متغیرِ «EXIT» به‌عنوانِ پیکربندی عرضه شده ...
  • docs/audit/round-20-fence-probe.md:7 — متغیرِ «REAL_NPM_TEST_EXIT» به‌عنوانِ پیکربندی عرضه شده ...
  • docs/audit/round-20-fence-probe.md:8 — متغیرِ «JWT_ACCESS_SECRET» به‌عنوانِ پیکربندی عرضه شده ...
```

**`PRE_FIX_EXIT=1`.** All three false positives sit on lines 6–8, all three inside the same fenced
block. `EXIT` and `REAL_NPM_TEST_EXIT` are shell variables that exist only in the pasted shell
session; `JWT_ACCESS_SECRET` is a real repo defect *of a different kind* — a name that is genuinely
absent from `.env.example`/compose/code (only `JWT_SECRET` exists, confirmed with
`git grep -n -E "process\.env\.JWT_ACCESS_SECRET" -- api/src api/tests 'api/*.ts' tools apps e2e loadtest cron backup`
→ exit 1, no match — the exact regex check #3's own `codeText` extraction uses) — but citing it
inside a transcript of a **test-harness override** is not the same claim as citing it as production
configuration, and the guard could not tell the two apart. (A plain-text, unscoped
`git grep JWT_ACCESS_SECRET` now also matches the explanatory comment this fix adds to the guard
itself, at `tools/check-doc-staleness.mjs:85` — that is this report's own prose, not a code path, and
irrelevant to what check #3 actually parses; the scoped `process\.env\.` grep above is the claim
that matters and it is exit 1.)

(The probe's secret-shaped value was originally a 32-char string; on request from the coordinator
mid-task it was replaced with the inert literal `PLACEHOLDER_NOT_A_SECRET` before any run shown in
this report, since the guard's own no-committed-secrets posture has no fake-value exemption and
secret scanners don't read intent. This changes nothing about the proof — check #3 keys on the
*variable name*, never the value.)

## 2. The fix

`fenceMask(fileLines)` in `tools/check-doc-staleness.mjs` (new, ~55 lines) walks a file's lines once
and returns a boolean mask of which lines sit inside a fenced code block, plus the line number of
any fence left unclosed at EOF. A new iterator, `eachOutsideFence`, wraps the existing `each` helper
and skips masked lines. **Only checks #2 and #3 were switched to it** — check #1 (repo address)
still uses plain `each`, unchanged, per the mandate's explicit scope.

Fence recognition, and why:

- **``` and ~~~, with or without a language tag.** `/^[ \t]*(`{3,}|~{3,})/` matches the opening run;
  a closing line must repeat the same character, be at least as long, and have nothing but
  whitespace after it — the CommonMark rule, so a 2-backtick line inside a 3-backtick block does
  **not** close it (proven in §3).
- **Indented fences.** Leading whitespace before the fence marker is unbounded, not limited to
  CommonMark's strict "≤3 spaces" rule. This is a deliberate widening: a fence nested under a list
  item is commonly indented by 2–4+ spaces depending on the marker, and a 3+ run of backticks/tildes
  at the start of a line (after only whitespace) is never, in practice, anything other than a fence
  marker — so being generous here costs nothing in false-fence-positives and buys correct handling
  of list-nested transcripts (proven in §3).
- **Unclosed fences.** A fence opened but never closed is, per CommonMark, code all the way to EOF —
  and if the guard silently adopted that and did nothing else, an unclosed ``` would silently exempt
  the rest of the document from checks #2/#3, which is exactly the kind of escape hatch Constitution
  rule 4 forbids. So the guard does **both**: it still treats the remainder as fenced (matching real
  rendering, and avoiding double-flagging content that was only ever meant to be inside the block),
  **and** it pushes its own `fails` entry naming the line of the unopened— sorry, unclosed — fence.
  The gate cannot go green until the fence is actually closed; leaving one open is not a way to hide
  content, it is a way to fail the build. Proven in §3.
- **Inline single-backtick spans are *not* exempted**, and this is deliberate, not an oversight. A
  span like `` `export FOO=1` `` sitting mid-sentence is exactly the shape of an in-prose
  configuration *claim* — the thing this guard exists to catch — not a transcript. Exempting it
  would reopen a laundering path (wrap any claim in single backticks, it vanishes) and would be
  exactly the kind of allowlist-by-another-name that Constitution rule 4b forbids. Proven in §3.

## 3. Falsifiability — both directions, with exit codes

### 3a. Fix removes the false positives on the same doc

```
$ node tools/check-doc-staleness.mjs
✓ اسناد تازه‌اند — 119 فایل · 8 آدرسِ مخزن · 16 زیردامنه · 42 ردیفِ متغیر
```
`POST_FIX_EXIT=0` — same probe doc (with `EXIT`, `REAL_NPM_TEST_EXIT` and `JWT_ACCESS_SECRET` still
sitting in its fenced transcript), zero failures. This run predates the extra prose line added in
§3b. See §4 for the isolated repo-wide before/after count delta, run separately with the probe
removed for an apples-to-apples comparison against the pre-fix guard.

### 3b. The fix did not go blind — proof, not assertion

A second line was added to the **same** probe doc, in prose, outside any fence, using an inline
single-backtick span around a genuinely nonexistent variable:

```
Separately (prose, not a transcript): before boot, run `export TOTALLY_FAKE_STALE_VAR=1` — this
is a genuinely stale claim, not evidence of anything executed, and lives outside any fence.
```

```
$ node tools/check-doc-staleness.mjs
❌ کهنگیِ سند — 1 مورد:
  • docs/audit/round-20-fence-probe.md:13 — متغیرِ «TOTALLY_FAKE_STALE_VAR» به‌عنوانِ پیکربندی عرضه شده ...
```
`RED_AGAIN_EXIT=1`. Exactly one failure — the three fenced false positives stayed suppressed, the
one genuine prose claim (inside a single-backtick inline span) was still caught. The gate did not
stop failing; it got more precise about *what* fails it.

### 3c. Fence-variant matrix (tilde, language tag, indented, mismatched closer, unclosed)

A second probe, `docs/audit/round-20-fence-probe2.md` (deleted, see §5), exercised five shapes in
one file: a `~~~text` fence, a fence indented two spaces under a list item, a fence "closed" by a
too-short ` `` ` run that must **not** count as closing, and a fence never closed at all — each
containing its own fake env-var name (`TILDE_FAKE_VAR`, `INDENTED_FAKE_VAR`, `SHORT_CLOSE_FAKE_VAR`,
`UNCLOSED_FAKE_VAR`).

```
$ node tools/check-doc-staleness.mjs
❌ کهنگیِ سند — 1 مورد:
  • docs/audit/round-20-fence-probe2.md:27 — فنسِ کد باز شده و تا انتهای فایل بسته نشده؛ طبقِ
    CommonMark محتوای بعدش همه کدِ همان بلوک حساب می‌شود، ولی خودِ نبستن یک نقصِ ساختاری است —
    فنس را ببند.
```
`VARIANTS_EXIT=1` — exactly one failure, at line 27, which is the opening ` ```bash ` marker of the
unclosed block (verified by reading the file at that line). `TILDE_FAKE_VAR`, `INDENTED_FAKE_VAR`
and `SHORT_CLOSE_FAKE_VAR` were correctly suppressed (proper fences); `UNCLOSED_FAKE_VAR` was
correctly **not** additionally flagged as a stale variable (it is genuinely inside the code block
by CommonMark's own rule) — the guard raised exactly the one failure that matters, the structural
one, instead of also raising a misleading "unknown config var" for content that was never a
configuration claim in the first place.

### 3d. Control-byte guard (the heredoc hazard named in the mandate)

The entire edit was written with the `Edit`/`Write` tools, never a heredoc, because this file is
full of regex (`\b`-style character classes, `${...}` literals) and a heredoc on this machine has
previously turned a `\b` into a literal backspace byte:

```
$ node tools/check-control-bytes.mjs
✓ بدونِ بایتِ کنترلی — 119 فایلِ اجراشدنی بررسی شد
```
`CONTROL_BYTES_EXIT=0`. Additionally verified directly: `Buffer.includes(0x08)` on the edited file
→ `false`, byte length `18138` (the committed pre-edit file, `git show HEAD:tools/check-doc-staleness.mjs
| wc -c`, is `12568` bytes — the growth is exactly the new `fenceMask` function and its comment
block, no truncation, no dropped content). `node --check tools/check-doc-staleness.mjs` →
`SYNTAX_CHECK_EXIT=0`.

## 4. Repo-wide before/after — the count delta, explained

Run on the **real repo corpus only** (no probe files present), original guard vs fixed guard, same
tree:

| | files | repo addresses (chk 1) | subdomains (chk 2) | env-var rows (chk 3) |
|---|---|---|---|---|
| pre-fix | 118 | 8 | 32 | 55 |
| post-fix | 118 | 8 | **16** | **42** |
| exit code | 0 → 0 | — | — | — |

Files and repo-address counts are unchanged, as expected — check #1 was not touched, and fencing
does not change which files are scanned. Both runs pass at `exit=0`, so **no new failures were
introduced and no existing failures were hidden** on the corpus as it stands today.

The `-16` subdomains and `-13` env-var rows were enumerated line-by-line with a throwaway diagnostic
(reused the exact `fenceMask` logic to list every match that moved from "counted" to "excluded"):

- All 16 removed subdomain mentions are inside fenced `curl`/DNS-check transcripts in
  `DEPLOY-COMMANDS.md`, `HTTPS-SETUP.md`, `LAUNCH-GUIDE.md`, `docs/adr/0002-public-website-and-cms.md`
  and `docs/PHOTOGRAPHY.md`, citing `www`/`api`/`app`/`business`/`admin` — every one of them a host
  Caddy genuinely serves (or, for `www`, on the explicit `NOT_OURS` disclosure list). None were
  failing before; the drop removes double-counting of already-correct citations, not coverage of a
  real defect.
- All 13 removed env-var rows are `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
  `POSTGRES_USER`, `SITE_API_BASE`, `BASE_URL` inside setup/recipe transcripts in
  `DATABASE-OPS.md`, `STATE-2026-08-26.md`, `docs/adr/0002-public-website-and-cms.md`,
  `docs/audit/SESSION-HANDOFF.md`, `docs/PROJECT_KNOWLEDGE.md` and `docs/recovery/BASELINE-TEST-STATUS.md`
  — every single one already a **known** variable (present in `.env.example`/compose/code). None
  were failing before either.

So on the corpus as it exists right now, the count drop is pure noise reduction: zero real defects
were being caught by the lines that stopped being counted. That is a claim about *today's* corpus,
not a guarantee for all time — see §6 for the one case where it does matter.

## 5. Cleanup

```
$ rm docs/audit/round-20-fence-probe.md docs/audit/round-20-fence-probe2.md \
      docs/audit/round-20-fence-gap-demo.md tools/__orig_check_doc_staleness_TEMP.mjs tools/__orig_TEMP2.mjs
$ node tools/check-doc-staleness.mjs
✓ اسناد تازه‌اند — 119 فایل · 8 آدرسِ مخزن · 16 زیردامنه · 42 ردیفِ متغیر
```
`FINAL_TREE_EXIT=0`. `git status --porcelain` shows no leftover probe file and no diff on any real
document — `docs/recovery/BASELINE-TEST-STATUS.md` (used as a read-only source for §6's copy) was
never written to; only a copy under `docs/audit/` was, and that copy is deleted. The 119-vs-118 file
count between §3a/§4 and here reflects other agents committing new files under `docs/` during this
session (`docs/audit/FOUNDER-REVIEW-HANDOFF.md`, `docs/audit/directives/`, `docs/ml/`,
`docs/reports/CEO-ROUND20-OPEN-2026-09-04.md` — all confirmed via `git status` at the time), not
anything this change did; the guard is intentionally live-corpus-sensitive, which is its job.

## 6. What the guard can no longer catch — proved, not asserted

The honest answer is **not** "nothing." The fix cannot distinguish a *transcript of an already-run
command* from an *instructional code block telling the reader what to run now* — both use an
identical fenced-block shape (opening line of three-or-more backticks, e.g. `` ```bash ``), and the
guard has no way to tell "this happened" from "do this." Concretely:

`docs/recovery/BASELINE-TEST-STATUS.md:23` is a reproducible-environment recipe inside a fenced
block: `export DATABASE_URL="postgresql://test:test@localhost:55432/rezervno_test"`. A copy of that
file was made under `docs/audit/round-20-fence-gap-demo.md` with that one line changed to
`export DATABASE_URL_RENAMED_STALE=...` — simulating the real failure mode this guard exists for
(a var renamed in code, doc left stale) landing inside this exact kind of block instead of prose.

```text
$ node tools/__orig_TEMP2.mjs        # original guard, HEAD's committed version
❌ کهنگیِ سند — 1 مورد:
  • docs/audit/round-20-fence-gap-demo.md:23 — متغیرِ «DATABASE_URL_RENAMED_STALE» به‌عنوانِ
    پیکربندی عرضه شده ولی نه در .env.example است، نه در compose، نه در کد
ORIG_EXIT=1
```
```text
$ node tools/check-doc-staleness.mjs   # fixed guard, same file
(no output — zero failures)
FIXED_EXIT=0
```
**`ORIG_EXIT=1` → `FIXED_EXIT=0` on the identical injected defect.** This is the real, provable cost
of the fix: any doc that gives *current* setup instructions inside a fenced block — rather than
prose — is now exempt from check #3, same as a genuine evidence transcript is, because the guard
(deliberately, per the mandate) cannot and does not try to tell them apart by content, only by
fence-or-not. `docs/recovery/BASELINE-TEST-STATUS.md` and `docs/DATABASE-OPS.md`-style "run this"
blocks fall on the same side of that line as `docs/reports/CEO-*.md`-style "this is what I ran"
blocks now.

This was not fixable without either (a) reopening the exact false-positive problem the mandate asks
to close, or (b) inventing a heuristic to distinguish "recipe" from "transcript" prose around a
fence — which is precisely the kind of narrow-the-signal-without-an-allowlist work Constitution rule
4b demands, and greping for words like "recipe"/"run this" beforehand is itself an allowlist-shaped
hack with its own false-negative rate nobody has measured. Recommendation, not acted on unilaterally
per the "no scope creep beyond the mandate" instruction: fenced *instructional* blocks that name
live config (`.env.example`-style templates, setup runbooks) are a distinct document class from
fenced *evidence* transcripts, and deserve either (a) their own explicit heading marker the guard
can key on (e.g. a convention like "### Setup" vs "### Evidence"), decided by whoever owns doc
conventions, or (b) a decision that check #3 was only ever meant to catch prose claims, in which
case this is an accepted, documented trade rather than an open gap. Both are founder/doc-owner
decisions, not something this task authorizes changing further.

## 7. Residual note on check #1 (not fixed, per scope)

Check #1 (repo address) still scans **all** lines, fenced or not. It has zero real false positives
in the current corpus (`ghSeen=8`, all correct, on both runs in §4) — so there is nothing to fix
today — but the same theoretical exposure exists: a pasted `git remote -v` transcript showing a
stale/wrong address for narrative reasons would trip it. The mandate explicitly scoped this task to
checks #2 and #3 ("Do not disturb the checks that are working"), so check #1 was left untouched.
Flagging this per Constitution rule 1 ("fix what the directive named **and** what it missed, and
report both") — reporting it here rather than silently fixing unrequested code.

## Exit-code ledger (every command in this report, restated)

| step | command | exit |
|---|---|---|
| §1 | original guard on probe (3 false positives) | 1 |
| §3a | fixed guard on same probe | 0 |
| §3b | fixed guard, prose stale-var line added | 1 |
| §3c | fixed guard on 5-variant fence probe | 1 |
| §3d | `node tools/check-control-bytes.mjs` | 0 |
| §3d | `node --check tools/check-doc-staleness.mjs` | 0 |
| §4 | fixed guard, real corpus, no probes | 0 |
| §5 | fixed guard, final clean tree | 0 |
| §6 | original guard on renamed-var copy of a real doc | 1 |
| §6 | fixed guard on same copy | 0 |
