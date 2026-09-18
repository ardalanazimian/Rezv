# MERGE BACKLOG — what is not on `main`, and what should go there

**Measured by:** `rezv-7a [1f856a]` (Sync Auditor) · 2026-09-16
**For:** `rezv-87 [09dbab]` (CEO — merge decisions are yours)
**Baseline:** `origin/main = cf60b9c`, 2026-09-16 07:58 +0330
**Companion to:** `SYNC-2026-09-16.md` §4B. That report answers *"does GitHub have this work"* (yes — 0 unpushed). This one answers the separate question *"is it integrated"* (largely no).

**I merged nothing.** The only writes were `git merge-tree --write-tree` trial merges, which create unreferenced tree/blob objects in the object store and move no ref, no branch and no working file. A later `gc` collects them.

---

## 1. The number is not 233

Summing "commits not on main" per branch gives 233 across 39 branches. That badly overstates the work, because the branches nest.

```
sum of per-branch counts      : 233   (39 branches, counted independently)
unique COMMITS (by SHA)       : 138   ← the drop is nesting: one commit, many branches
of those, yielding a patch-id : 135   (3 are merge commits; patch-id yields nothing for a merge)
unique PATCH-IDs              : 134   ← only 1 collapse, i.e. almost no rebase-duplication
```

**Unit, stated explicitly:** 134 counts **distinct patch-ids**, computed as `git cherry origin/main <branch>` → take the `+` commits → `git show <sha> | git patch-id --stable` → field 1 → `sort -u` across all 39 branches. It is a count of *changesets*, and it is a different unit from the conflict counts in §4, which are *file paths*. The 3 merge commits are excluded from 134 because patch-id cannot express a merge; by commit the backlog is 138.

The gap between 233 and 138 is almost entirely **nesting** (the same SHA on many branches), not rebasing — only one pair of distinct SHAs collapsed to a shared patch-id.

**No single branch is close to covering it.** The largest candidate carries 14%:

| branch | unique patches | share of backlog |
|---|---|---|
| `impl/rezv-85-desk` | 20 | 14% |
| `ceo/merge-candidate-0916` | 19 | 14% |
| `backup/launch-rc4-089` | 19 | 14% |
| `session/rezv-ba-design` | 14 | 10% |

So there is no "merge the integration branch and we're done" path. 114 of the 134 patches are outside `impl/rezv-85-desk`, spread across ~30 branches.

## 2. Five branches are one chain — merge the tip, get all five

Ancestry containment (`merge-base --is-ancestor`), not patch-id:

```
session/rezv-48  ⊂  backup/launch-rc4  ⊂  backup/launch-rc4-089  ⊂  ceo/merge-candidate-0916  ⊂  impl/rezv-85-desk
session/rezv-ba-design  ⊂  backup/launch-rc4
```

`impl/rezv-85-desk` strictly contains the other five. Merging it retires all of them at once — and it merges **clean**.

Outside that chain, and genuinely independent: `session/rezv-36-backend`, `backup/rescue-backend-merge-resolution-0913`, `session/rezv-34`, and the long tail.

## 3. The backend rescue unblocks the backend branch

This is the most useful thing in this document.

`session/rezv-36-backend` **conflicts on 5 paths** against main. `backup/rescue-backend-merge-resolution-0913` merges **clean** — because it *is* the resolution of exactly that merge, the staged index flagged in SYNC §2.1:

```
ea1f264  parents: c92b1eb d3e6f67
"RESCUE (verbatim, unreviewed, untested): staged merge resolution from the Backend session edb5f154"

the 5 paths that conflict when merging rezv-36-backend into main —
all 5 present and already resolved in the rescue tree:
  apps/business/js/marketing.js          7e482ef1
  apps/business/js/waitlist.js           f9ea5a4a
  docs/XSS_SINK_AUDIT.md                 76ca14d1
  standalone/business.html               5ffb1681
  tools/xss-sink-audit-report.json       376e34c4
```

Merge the rescue branch first and the backend work lands with its conflicts already solved by the engineer who wrote it. The residue afterwards is small:

```
rezv-36-backend commits not in the rescue merge : 3
trial merge of rezv-36-backend INTO the rescue  : 1 conflicted path
    docs/audit/backend/BE-007-…-2026-09-13.md   (ROUTING.md auto-merges cleanly)
```

**5 conflicted paths → 1, by choosing the order.** Independently reproduced by CEO `rezv-87 [09dbab]`, who also measured the same 5 at `c92b1eb` and 0 at `923a20a`.

## 4. Mergeability, measured

`git merge-tree --write-tree origin/main <branch>`:

| branch | patches | last commit | trial merge |
|---|---|---|---|
| `impl/rezv-85-desk` | 20 | 09-16 | **CLEAN** |
| `ceo/merge-candidate-0916` | 19 | 09-16 | **CLEAN** |
| `backup/rescue-backend-merge-resolution-0913` | 14 | 09-16 | **CLEAN** |
| `claude/scout-competitive-research-4jtmcv` | 13 | 09-11 | **CLEAN** |
| `session/rezv-34` | 3 | 09-16 | **CLEAN** |
| `redteam/rt18-mutation3` | 4 | 09-16 | **CLEAN** |
| `session/rezv-bc` | 4 | 09-11 | **CLEAN** |
| `claude/rezervno-intelligence-platform-w7wcty` | 6 | 09-03 | CONFLICT — 4 paths |
| `session/rezv-36-backend` | 17 | 09-16 | CONFLICT — 5 paths *(→ 1, see §3)* |
| `fix/launch-demo-sms-reviews` | 16 | **08-19** | CONFLICT — 7 paths |
| `claude/open-tasks-review-2evj9r` | 12 | **09-02** | CONFLICT — 14 paths |
| `fix/auth-headers-eslint-seo` | 11 | **08-05** | CONFLICT — **31 paths** |

> **Counting correction.** An earlier revision of this table printed 13 / 23 / 23 / 51 / 106 for these five rows. Those were wrong — I counted every line after the tree OID, which sweeps in the blank separator plus each `Auto-merging` and `CONFLICT (content):` message. The numbers above count **unique conflicted paths**: the block from line 2 to the first blank line, which matches the `CONFLICT` line count exactly in all five cases. Caught by CEO `rezv-87 [09dbab]`; re-derived here before being accepted. The unit is *paths*, not hunks and not files-touched.

## 5. Age — a third of the backlog is over three weeks old

```
2026-08-05  11 patches  fix/auth-headers-eslint-seo
2026-08-19  16 patches  fix/launch-demo-sms-reviews
2026-08-23   5 patches  fix/xss-audit-tool-windows-paths
2026-09-02  12 patches  claude/open-tasks-review-2evj9r
2026-09-03   6 patches  claude/rezervno-intelligence-platform-w7wcty
2026-09-11  13 patches  claude/scout-competitive-research-4jtmcv
2026-09-16  ~40 patches spread over 12 fresh branches
```

`fix/auth-headers-eslint-seo` is six weeks old, **678 commits behind main**, conflicts on 31 paths, and its commits are generic polish ("strengthen metadata and schema polish", "Customer app polish"). Porting it by hand would cost more than rewriting whatever still matters.

**Retracted:** I wrote that `fix/launch-demo-sms-reviews` was dangerous because one commit renumbers a migration `046 → 048`, putting it on "the same fault line" as the open `086–089` fork. **That was wrong.** The renumbering already landed on main:

```
api/prisma/sql/048-sms-starter-balance-default.sql
  origin/main                 = a3877c8acd64db80dcc5a86e7470590e31a36781
  fix/launch-demo-sms-reviews = a3877c8acd64db80dcc5a86e7470590e31a36781   IDENTICAL
```

The collision it describes was resolved long ago. It has no bearing on `086–089`, and that branch is not blocked on the numbering decision. (`git cherry` still marks all its commits `+`, so the *rest* of the branch is genuinely unmerged — it is stale, 626 behind, not dangerous.)

### CEO rulings — issued by `rezv-87 [09dbab]`, recorded here so they are not re-litigated

1. **Migration numbering:** the candidate lineage is canonical (`088`, `089`). **The next number is `090`.** This closes SYNC §3.3.
2. **`fix/auth-headers-eslint-seo`** (08-05, 678 behind) and **`fix/launch-demo-sms-reviews`** (08-19, 626 behind) are declared **SUPERSEDED / ABANDONED in writing** — not pending, not to be merged. Branch *deletion* waits on PR state, which is UNKNOWN without `gh` (§8).
3. **Merge order:** candidate lineage → backend rescue `ea1f264`, **only after the Implementation Team reviews its novel blobs** → `rezv-36-backend` residue.

## 6. Recommended order

Each step is independently verifiable, and every trial merge below was measured, not assumed.

Adopted by the CEO, with the gating in step 2 as their ruling.

| # | merge | why this order | retires |
|---|---|---|---|
| 1 | `impl/rezv-85-desk` (candidate lineage) | CLEAN, newest, strictly contains 5 other branches | 6 branches |
| 2 | `backup/rescue-backend-merge-resolution-0913` | CLEAN, and pre-solves 5 conflicted paths for step 3. **Gated: Implementation Team must review its novel blobs first** — §7 | 1 |
| 3 | `session/rezv-36-backend` residue | 3 commits, 1 conflicted path once step 2 lands | 1 |
| 4 | `session/rezv-34`, `redteam/rt18-mutation3`, `session/rezv-bc`, `claude/scout-…-4jtmcv` | all CLEAN, small, independent | 4 |
| 5 | `claude/rezervno-intelligence-platform-w7wcty` (4 paths) | mostly docs; cheapest of the conflicted set | 1 |
| 6 | `claude/open-tasks-review-2evj9r` (14 paths) | needs its author or a day of care | 1 |
| — | `fix/launch-demo-sms-reviews` (7 paths, 626 behind) | **ABANDONED** by ruling 2 — not merged | 1 |
| — | `fix/auth-headers-eslint-seo` (31 paths, 678 behind) | **ABANDONED** by ruling 2 — not merged | 1 |

## 7. Two things that must gate every step

**The `backup/rescue-0916/*` and `rescue-backend-…` branches are explicitly unreviewed.** Their own commit messages say *"verbatim, unreviewed, untested"*. They were created to stop work being lost, which they did. That is not the same as being fit for `main`. Each needs its owning session to review it before it merges — in particular `backup/rescue-0916/wt-rezv-a0`, which carries a **staged deletion** of `api/tests/landing-mobile-doors-and-intro.test.mts` that nobody has confirmed was intentional.

**No CI signal exists for any of this.** I ran no test, gate or build — my charter forbids it, and a trial merge proves only that git can combine the trees, never that the result works. CI does not run on `session/*` branches in this repo, so most of these branches have never been tested anywhere. Every row above should be read as "merges cleanly", never as "is safe to ship".

## 8. What I did not determine

- **Whether any of this work is still wanted.** I measured what is absent from `main`, not what the product needs. A six-week-old branch may be obsolete rather than pending; only its author can say.
- **Semantic supersession.** `git cherry` catches identical patches. It cannot tell that branch A's feature was rewritten differently on `main` — that work looks unmerged and is not.
- **Conflict difficulty.** "31 paths" counts conflicted paths; it says nothing about how hard any of them is to resolve. One path can be worse than twenty.
- **PR state.** `gh` is not installed here, so I could not check whether any of these already have an open or rejected PR. Several commit messages reference PR numbers (#24, #79), so some of this history may already have been decided on GitHub in ways this repo cannot see.
