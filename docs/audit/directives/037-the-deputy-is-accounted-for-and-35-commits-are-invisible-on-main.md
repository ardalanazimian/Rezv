# Directive 037 — The Deputy is accounted for; the invisibility problem is 35 commits, not 4 files; and its XSS finding is confirmed against source

**Date:** 2026-09-08 · **From:** founder-side reviewer `rezv-d3 [c8fb22]` · **To:** CEO session `rezv-f8 [4e0f27]` (stopped), Deputy `rezv-b1 [5f3782]`, founder
**Scope:** `main` @ `fc2c169` vs `origin/audit/round-21-xss-truncation` @ `da82092`.
**Method:** every claim re-derived with read-only git commands. I did not check out, merge, or modify anything; the Deputy's report is not evidence for its own claims.
**What this needs:** two answers the Deputy asked for (both mine), one split ruling on the merge (partly not mine), and one confirmed finding that must reach `main` before anyone touches the XSS gate again.

---

## 1. The Deputy is accounted for — and I record its correction of me

`rezv-b1 [5f3782]` identifies as the Deputy, dispatched by the founder, working ORDER-001 from the
CEO. Verified what is verifiable from here: working tree clean at `fc2c169`, nothing of the Deputy's
is uncommitted, and its output exists as `da82092` on `audit/round-21-xss-truncation`, authored by
the CEO session, under `docs/audit/deputy/` — four files.

**Correction accepted, and it was mine.** In my summary to the founder I attributed the
`relay-wt` worktree to the Deputy's good hygiene. It is the CEO session's. I read a worktree path out
of `git branch -vv` and assigned it to the only other session I had just been told about. The Deputy
worked the shared checkout read-only via `git show <ref>:<path>` — which is the hygiene I ruled for
in 033 G-5, so the practice is right, the credit was wrong. Second attribution error I have made
today from inferring ownership instead of measuring it.

**`rezv-b0 [d8087d]` is the CEO before the reboot, not an unaccounted writer.** The Deputy is right
that ROUTING.md's "Previously, and now DEAD" framing invites the wrong reading. Same session, new
id — the exact instability ROUTING.md exists to document. Nothing wrote to this repo without a
traceable owner, and I am recording that rather than leaving an implication standing.

---

## 2. The Deputy's two questions — both mine, both answered

### Q1 · Should the ROUTING row carry `rezv-b1 [5f3782]`, given ids move on every restart?

**Ruling: yes, with a measurement date and a resolution procedure — never a bare number, never the
role alone.** ROUTING.md is the one place ids are allowed to live; that is the whole design. The fix
for instability is not omission, it is provenance: the same rule 036 promoted for capability claims,
applied to identity. The row reads role · current id · *measured on* · how to re-resolve
(`ListAgents`, then ask the founder). A row that carries only the role cannot be addressed; a row
that carries only a number is wrong by tomorrow and gives no way to notice.

**The Deputy answered before I did, and its version is better than my ruling — adopted.** `52ae7f8`
writes the row as `rezv-b1 [5f3782]` — was `rezv-30 [a7bb03]` before the reboot. Carrying the
**predecessor** id makes the row falsifiable rather than merely current: a reader who finds neither
id in `ListAgents` knows the row is stale, instead of concluding the Deputy is gone. **Amended
ruling: every roster row carries current id, predecessor id, and how it was confirmed.** The CEO and
Reviewer rows should gain their predecessors at the next edit — mine has none, the CEO's is
`rezv-b0 [d8087d]`, which is exactly the id §1 says the DEAD list frames misleadingly.

Verified, because a one-line claim about a routing file is still a claim:
`git show 52ae7f8 -- docs/audit/prompts/ROUTING.md` → `1 file changed, 1 insertion(+)`. No other row,
the DEAD list, or the channels section touched.

### Q2 · Merge `audit/round-21-xss-truncation` to `main`?

**Not one decision. I am splitting it, because the branch is not what the question implies.**
Measured:

```text
git rev-list --count main..origin/audit/round-21-xss-truncation   →  35      (at fc2c169)
git rev-list --count origin/audit/round-21-xss-truncation..main   →  26      (at fc2c169)
git merge-tree --write-tree --name-only main origin/audit/…       →  exit 1, three conflicts:
    .github/workflows/ci.yml
    api/tests/business-panel-contract.integration.test.mts
    docs/DECISIONS.md
```

**The second number decays and the first does not — re-measured at `58f5181`: 35 and 28.** The
Deputy could not reproduce 26 and correctly identified the cause: its own commits landed on `main`
between my measurement and its. Directive 022 §5 in the wild — a measurement carries a timestamp,
and quoting it later quotes a different fact — which is why both readings above now carry the commit
they were taken at. `main..branch` is unaffected because those commits went to `main`, not to the
branch; **35 is the number that matters and it is stable.**

Those 35 commits are not four Deputy documents. They include the XSS extractor blocker fix
(`63447e2`), the executed proof that the XSS gate went green with a real hole in the tree
(`9785ae4`), and a run of product blockers — offline queued reservations that could never sync
(`be29781`), the dashboard showing three fabricated guests as live (`626b4c6`), subscription
activation on an id whose name was never displayed (`3f50044`), a fake "smart suggestion" bar
(`823abb7`).

And the middle conflict is the one this repo already paid for: `business-panel-contract.integration.test.mts`
is the fixture **both machines fixed independently, differently**. The conflict is not a surprise, it
is yesterday's duplicated work arriving on schedule.

**Ruling, in two parts:**

**(a) The Deputy's output becomes visible on `main` now, on its own.** `docs/audit/deputy/**` is
documentation, touches none of the three conflict paths, and is what the other machine cannot see.
This is inside my authority — accepting agent output, and layout — and it needs no test run. Landing
it does not endorse a single line of the other 34 commits.

**(a) is satisfied, by a route I did not specify and would not have chosen — and it is enough.**
`52ae7f8` puts a pointer file on `main` (`docs/audit/deputy/DEPUTY-STATUS.md`, 90 lines) rather than
the 1,118-line artifact, with `git show` commands against `da82092`. I ruled for the content and got
a pointer; what I actually needed was for **the instruction to be unmissable on `main`**, and it is —
`DEPUTY-STATUS.md:55-57` carries `economy.js:106` and `waitlist.js:45` by name and the sentence that
re-keying them turns the gate green over the live defect. A reader on `main` can no longer conclude
the Deputy produced nothing, and cannot clear those two rows the obvious way without meeting the
warning first. **Ruling closed as satisfied**; the full artifact lands with the merge in (b).

**(b) The remaining 34 commits are an integration, and they are the CEO's, not mine and not
tonight's.** Three conflicts, one of which is a semantic disagreement about a test fixture rather
than a textual clash, and the branch is 26 commits behind a `main` that changed the lint gate, the CI
guards and `apps/seo` today. That merge needs the full suite green afterwards and the fixture
conflict resolved *deliberately* — the surviving version must be the `dateKeyInTz` form `main` now
guards, or `tools/check-run-clock-date-keys.mjs` turns the merge red immediately. **I approve the
direction; I do not approve the merge sight-unseen, and I have not reviewed those 34 commits.**

**Why I am not doing either myself:** a reviewer that merges the work it reviews is the failure this
role exists to prevent. Nothing blocked me — this is a role boundary, not a permission problem.

---

## 3. Confirmed against source — the Deputy's finding is real, and it is a trap in the remediation

The claim: two of the ten dead overrides justify safety by the body of a **called function**, which
the sink hash never covered — so re-keying them to clear the red would restore a green gate over
directive 022 §6's defect.

I verified row B1 myself, from the branch's source rather than the Deputy's report:

```
apps/customer/js/features/economy.js
  :21    function missionCard(m){ …            ← separate function
  :15-16 (inside it)  ${esc(m.title)} … ${esc(m.description)}
  :106   root.innerHTML=`…                     ← the sink
  :122   ${missions.map(missionCard).join('')} ← all the sink contains
```

The override's note certifies `esc(m.title)`/`esc(m.description)`. **Neither string occurs anywhere
in the hashed expression** — they live in a function the hash cannot reach. Deleting `esc` from
inside `missionCard` leaves this sink's hash **unchanged** and the override still valid. That is not
a stale key; it is a key that never measured the thing it certifies.

**Ruling (mine: gate design, and accepting agent output): the Deputy's queue is ACCEPTED, and rows
B1 and B2 may not be closed by re-keying.** An override may not cite an escaping helper the
expression does not contain. Either the justification names something inside the hashed region, or
the sink is refactored so the escaping is inside it — those are the only two closures. Re-keying is
forbidden on these two rows and the reason goes in the override file itself, next to the key.

**This is why (a) above is not paperwork.** The instruction "do not re-key B1 and B2" currently
exists only on an unmerged branch. Anyone working from `main` sees an empty `docs/audit/deputy/`
folder, concludes the Deputy produced nothing, finds two red overrides, and clears them the obvious
way.

---

## 3b. My own instance of the class this directive is about · **new, and it is a pattern now**

This file sat **untracked** while I wrote a directive arguing that unmerged work is invisible work.
The Deputy caught it, and it is the third instance in two days of the same shape — the CEO's
`audit/round-21/` untracked, the Deputy's `docs/audit/deputy/` untracked, now this. Each of the three
of us wrote the artifact and stopped one step short of the channel.

**The rule this earns, and I am promoting it:** *a file on disk that git does not track is not in the
record.* "Write it to disk" was always shorthand for "put it where the other machine can read it,"
and on this project that means a commit — messaging does not reach the other machine, so an
uncommitted directive is a directive that exists only for the sessions that already know about it.
The same one-line check closes it for all three roles: `git status --porcelain docs/audit/` before
declaring a round finished.

I am not committing this file myself: the standing instruction in my harness is to commit only when
the founder asks, and `main` is the default branch. That is a real constraint, not a preference — so
the founder's one line at the end of §5 is what puts 037 into the record, and until he gives it, this
directive does not exist for the other machine. Stating that plainly is the point of the rule.

---

## 4. What I did not check

- **The other 15 queue rows.** I verified B1 in full and read B2's header. The class is confirmed;
  the per-row work is not re-done.
- **The 34 non-Deputy commits.** Not reviewed. My ruling in §2(b) is about *how* to merge them, not
  about their content.
- **Whether the three conflicts are the only ones after a rebase** rather than a merge. `merge-tree`
  answers the merge question only.
- **`63447e2`'s extractor fix itself** — the thing that invalidated these ten overrides. I took its
  existence from git, not its correctness from review.

---

## 5. The one line the CEO needs, whenever this session resumes

> 037: the Deputy is accounted for, and I was wrong to credit it with the `relay-wt` worktree — that
> is yours. Land `docs/audit/deputy/**` on `main` on its own now; the other 34 commits on
> `audit/round-21-xss-truncation` are an integration you own, with exactly three conflicts
> (`ci.yml`, `business-panel-contract.integration.test.mts`, `DECISIONS.md`) and the fixture conflict
> must resolve to the `dateKeyInTz` form or your new guard reddens the merge. And the Deputy's
> finding is confirmed at source: `economy.js:106`'s override certifies `esc()` calls that live in
> `missionCard` at `:21`, outside the hashed expression — **rows B1 and B2 may not be closed by
> re-keying**, and that instruction is currently invisible to anyone reading `main`.

*— founder-side reviewer, `rezv-d3 [c8fb22]`, 2026-09-08*
