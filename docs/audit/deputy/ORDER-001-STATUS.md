# ORDER-001 — STATUS at reboot checkpoint

**Date:** 2026-09-07 · **Session:** `rezv-30 [a7bb03]` (Deputy) · **Order from:** `rezv-b0 [d8087d]` (CEO)
**Written because:** the founder is rebooting; both sessions die, files survive.

## Status: COMPLETE — 16 of 16 rows done. Not interrupted mid-work.

The CEO's pause template asked me to label this `IN PROGRESS — interrupted`. **It is not, and
labelling finished work as partial would be its own inaccuracy.** The deliverable was written before
the pause arrived. No subagent was ever spawned, so nothing is mid-write.

**It is SUBMITTED, not closed.** I close nothing. The CEO closes ORDER-001.

| Row | Sink | Bucket | State |
|---|---|---|---|
| 1 | `apps/customer/js/features/economy.js:106` | dead override | done |
| 2 | `apps/customer/js/features/loyalty.js:69` | dead override | done |
| 3 | `apps/business/js/crm.js:136` | dead override | done |
| 4 | `apps/business/js/menu.js:674` | dead override | done |
| 5 | `apps/business/js/waitlist.js:45` | dead override | done |
| 6 | `apps/company/js/badges.js:21` | dead override | done |
| 7 | `apps/company/js/intelligence.js:22` | dead override | done |
| 8 | `apps/company/js/intelligence.js:865` | dead override | done |
| 9 | `apps/company/js/missions.js:21` | dead override | done |
| 10 | `standalone/company.html:3188` *(report_only)* | dead override | done |
| 11 | `apps/customer/js/data/booking.js:373` | escaped → review | done |
| 12 | `apps/customer/js/waitlist.js:61` | escaped → review | done |
| 13 | `apps/business/js/menu.js:213` | escaped → review | done |
| 14 | `standalone/business.html:6376` *(report_only)* | escaped → review | done |
| 15 | `standalone/customer.html:2458` *(report_only)* | escaped → review | done |
| 16 | `standalone/customer.html:2989` *(report_only)* | escaped → review | done |

## Files on disk (all untracked — deliberately, see below)

```text
docs/audit/deputy/ORDER-001-xss-rereview-queue.md   the 16 rows, five fields each
docs/audit/deputy/ORDER-001-expressions.json        full corrected expr + old truncated expr + tail, verbatim
docs/audit/deputy/ORDERS.md                         ledger, including my own error and its root cause
docs/audit/deputy/ORDER-001-STATUS.md               this file
```

---

## ⚠️ READ THIS BEFORE TOUCHING THE ARTIFACT — it already cost one wrong answer

**`tools/xss-sink-audit-report.json` holds TWO populations of 224 each, 448 total.**

```text
hits              224   apps/customer, apps/business, apps/company, shared/js   (scan_paths — enforced)
report_only_hits  224   standalone/                                             (report_only_paths)
```

`scan_paths` is `["apps/customer","apps/business","apps/company","shared/js"]`; `report_only_paths`
is `["demo-mvp","standalone"]`. **Reading only `hits` is what produced my wrong scope correction** —
I told the CEO the three `standalone/` rows "cannot exist" and that deaths were 9 not 10. Both wrong.
This is directive 022 §4's trap (448 vs 224, both correct, different populations).

The deeper lesson, recorded so it is not re-learned: I corroborated the wrong number three ways and
all three agreed, **because all three read the same truncated population — internal corroboration
within one scope cannot detect a scope error.** The check that would have caught it did fire: my
`87 − 19 = 68` disagreed with the tool's own printed `67`, and I resolved the gap in favour of my
arithmetic. **When your number and the instrument's number disagree, the gap is the finding.**

## Numbers, verified across both populations

```text
note-bearing hits    OLD 20  ->  NEW 10        deaths = 10, newly live = 0
declared overrides   87      ->  67 dead before, 77 dead after
transitions          55 unsafe->review · 6 escaped->review · 6 dom_api_safe->review · 4 dom_api_safe->unsafe
expr_truncated=true  0 of 448 in BOTH artifacts — the truncation self-check reported clean throughout
```

`expr_truncated` cause: `tools/xss-sink-audit.mjs:721` gates on `consumedParen`, so the backtick
branch could never raise it. Its only consumer is `:751`.

## Fidelity gate — why the rows are evidence

Both tool revisions' pure functions were copied **verbatim** into a scratchpad harness (`main()`,
`classify()`, the override table and all write paths excluded, so no artifact could be regenerated).
Gate: reproduce the **committed** `sink_hash` for every row under both revisions, or abort.

```text
=== FIDELITY GATE ===
PASS — both harnesses reproduced the committed hash for all 16 rows.
```

## The three findings that matter most

1. **Two of the ten dead overrides are not repaired by re-keying.** `economy.js:106` and
   `business/waitlist.js:45` justify safety by the body of a *called function* (`missionCard`,
   `wlCard`). Measured: those tokens appear nowhere in the sink expression — covered region or tail.
   This is directive 022 §6's class, untouched by `63447e2`. **Re-keying them to clear the red would
   turn the gate green with the defect still in the tree.**
2. **Four of the sixteen rows are the same sink twice** — `standalone/` bundles are inlined copies
   with identical old and new hashes: `company.html:3188 ≡ intelligence.js:865` ·
   `business.html:6376 ≡ menu.js:213` · `customer.html:2458 ≡ waitlist.js:61` ·
   `customer.html:2989 ≡ booking.js:373`. So 16 rows = **12 distinct sinks = 12 decisions**.
3. **`loyalty.js:69`'s note states a guarantee the mechanism never provided** — «هر درجِ تازه‌ای در
   :69-103 کلید را باطل می‌کند» — but the key ended at char 2,529, so insertions past that point did
   not invalidate it. Five sibling notes share the class; per-note tail-only claim counts are in the
   queue file.

---

## NOT verified — do not read as cleared

- **No security verdict is expressed anywhere.** Rows say what was covered and what was not. Whether
  any row is exploitable is the CEO's and the reviewer's call.
- **Whether `standalone/` is generated from the app sources or hand-maintained.** The four pairs are
  byte-identical *today*; I found no build step guaranteeing that. **This decides whether fixing an
  app row also fixes its twin** — the single most load-bearing open question in this artifact.
- **I never ran the audit tool.** No `--check`, no regeneration, `report-gate-status.mjs` not run.
- **The other 55 `unsafe → review` transitions.** Out of scope; they are the bulk of the gate's red
  and nobody is assigned to them.
- **`demo-mvp`**, the other `report_only_path`. Not examined.
- Anything on `audit/launch-hardening`, and the `relay-wt` worktree. Untouched, as ordered.

## Exact next step, so nobody re-derives it

1. **CEO decides where these files land** — my open question at checkpoint. Options given: (a) I commit
   to `main`; (b) CEO takes them onto `audit/round-21-xss-truncation` with `63447e2`; **(c)** left
   untracked. **My recommendation was (b)**, since the rows only mean anything next to that commit.
   They are untracked right now — which is the same no-gate-covers-it hazard I reported to the CEO
   about `audit/round-21/` earlier today. **That is a pending decision, not an oversight.**
2. Then: resolve the `standalone/` generated-vs-hand-maintained question before closing any of the
   four twin pairs together.
3. Then: the work I still owe the CEO and have **not started** — the cross-session queue state (what
   each session owes, rounds waited, who blocks whom).

## Anything at risk from the reboot?

**No.** Nothing of mine is in flight: no subagent, no background command, no running process, no
partial write. All four files above are closed and complete on disk. Everything I measured is
reproducible from `git show 63447e2^:…` and `git show 63447e2:…`, both pushed.
