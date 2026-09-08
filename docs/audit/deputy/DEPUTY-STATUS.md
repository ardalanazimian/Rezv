# Deputy — channel status on `main`

**Date:** 2026-09-08 · **Session:** `rezv-b1 [5f3782]` (was `rezv-30 [a7bb03]` before the reboot)
**Role:** Deputy — the CEO's chief of staff. Mandate: `docs/audit/prompts/deputy.md`.
**Written because:** this folder is empty on `main`, and an empty folder reads as "produced nothing".

I close nothing, approve nothing, certify nothing. I hand work back marked **submitted**; the CEO closes it.

---

## Where the Deputy's work actually is

**Not on `main`.** ORDER-001 is complete and lives on branch `audit/round-21-xss-truncation`,
commit `da82092` (four files, 1,118 insertions). That branch is **unmerged**.

```sh
git show origin/audit/round-21-xss-truncation:docs/audit/deputy/ORDER-001-xss-rereview-queue.md
git show origin/audit/round-21-xss-truncation:docs/audit/deputy/ORDER-001-expressions.json
git show origin/audit/round-21-xss-truncation:docs/audit/deputy/ORDER-001-STATUS.md
git show origin/audit/round-21-xss-truncation:docs/audit/deputy/ORDERS.md
```

Consequence, stated plainly because it is the point of this file: a session reading only `main`
concludes the Deputy produced nothing, and **the team on the other machine cannot see this work at
all** — git is the channel to them, and this is not on the branch they read. Merging
`audit/round-21-xss-truncation` is the fix. That is the CEO's or the founder's call, not mine.

## ORDER-001 — closed by the CEO, 2026-09-07

**What it was:** a 16-row human re-review queue for the manual-review overrides invalidated by
`63447e2` (the `grabExpression` backtick-truncation fix). Per row: the full corrected sink
expression, the truncated text the old hash actually covered, every interpolation that sat outside
that hash, the old override note verbatim with whether it describes anything the key really
protected, and the one thing a human must decide.

**Verified numbers**, measured across **both** artifact populations (`hits` 224 + `report_only_hits`
224 = 448):

```text
note-bearing hits   OLD 20 -> NEW 10      deaths = 10, newly live = 0
declared overrides  87  ->  67 dead before, 77 dead after
transitions         55 unsafe->review · 6 escaped->review · 6 dom_api_safe->review · 4 dom_api_safe->unsafe
expr_truncated=true 0 of 448 in BOTH artifacts
```

**Why the rows are evidence and not assertion:** both tool revisions' *pure* functions were copied
verbatim into a scratchpad harness — `main()`, `classify()`, the override table and every write path
excluded, so no artifact could be regenerated — then gated on reproducing the **committed**
`sink_hash` for all 16 rows under both revisions. It passed. A harness that must reproduce
known-good output before its novel output counts.

## The three findings worth carrying forward

1. **A trap inside the remediation, not in the code.** Two of the ten dead overrides —
   `apps/customer/js/features/economy.js:106` and `apps/business/js/waitlist.js:45` — justify safety
   by the body of a *called function* (`missionCard`, `wlCard`), which the sink hash never covered.
   **If they are re-keyed to clear the red, the gate goes green with directive 022 §6's defect still
   in the tree.** Re-keying is not a repair for these two.
2. **16 rows = 12 distinct sinks.** The `standalone/` bundles are inlined copies: four rows are
   byte-identical twins of four app rows (identical old *and* new hashes). Whether `standalone/` is
   generated from source or hand-maintained is **NOT VERIFIED** — and it decides whether fixing an
   app row also closes its twin.
3. **A stated guarantee the mechanism never provided.** `loyalty.js:69`'s note claims any new
   insertion in `:69-103` invalidates the key; the key ended at char 2,529, so insertions past that
   point did not. Five sibling notes share the class, including one that misquotes its own source
   (`intelligence.js:22` says `fa()`; the code calls `fnl()`).

## Method note that cost me a round, recorded so it is not repeated

I first told the CEO its order's scope was wrong — because I read only `hits` and never
`report_only_hits`. I corroborated the wrong number three ways and all three agreed, **because all
three read the same truncated population. Internal corroboration within one scope cannot detect a
scope error.** The check that would have caught it did fire: my `87 − 19 = 68` disagreed with the
tool's own printed `67`, and I resolved the gap in favour of my arithmetic.
**When your number and the instrument's number disagree, the gap is the finding.**

## Still owed, not started

The cross-session queue state — what each session owes, how many rounds each row has waited, who
blocks whom. Ordered by the CEO as the next item, behind ORDER-001.

## Not verified — do not read as cleared

- No security verdict is expressed anywhere in ORDER-001. The rows say what was covered and what was
  not; whether any row is exploitable is the CEO's and the Reviewer's call.
- I never ran the audit tool: no `--check`, no artifact regeneration, and
  `tools/report-gate-status.mjs` **not run** — it rewrites the committed record.
- The other 55 `unsafe → review` transitions. Out of ORDER-001's scope, unassigned, and the bulk of
  the gate's red.
- `demo-mvp`, the other `report_only_path`. Not examined.
