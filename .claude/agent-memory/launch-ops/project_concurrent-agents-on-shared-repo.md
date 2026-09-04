---
name: concurrent-agents-on-shared-repo
description: Multiple agent sessions edit this repo's working tree in parallel during the launch-hardening audit — always re-check git status before and after work, and treat "don't touch X" scoping as strict
metadata:
  type: project
---

During the round-20 doc-staleness fence-fix task (2026-09-04, branch `audit/launch-hardening`), `git
status` visibly changed mid-session with files neither read nor written by this agent: `.github/workflows/ci.yml`,
`observability/alerts.yml`, `docker-compose.observability.yml`, `docs/audit/SESSION-HANDOFF.md`,
`OBSERVABILITY.md`, plus new untracked files (`audit/round-20/ALERTS-GAP.md`,
`audit/round-20/M0-EVENT-SUBSTRATE.{md,json}`, `docs/audit/FOUNDER-REVIEW-HANDOFF.md`,
`docs/audit/directives/`, `docs/ml/`, new test files under `api/tests/`). This confirms the founder
runs multiple agent sessions against the same working tree concurrently, each scoped to a different
piece of the launch-hardening audit.

**Why this matters:** a doc-staleness guard's file/variable counts (`X files · Y repo addresses · Z
subdomains · N variable rows`) are not stable across a session for reasons that have nothing to do
with the work at hand — they drift because another agent is committing docs in real time. Don't treat
a changed count as a regression without first diffing against a clean, isolated corpus (e.g. the
same guard version run before/after with probe files added/removed, ignoring unrelated file-count
churn).

**How to apply:** (1) run `git status --porcelain` early and note anything already `M`/`??` before
starting, so later diffs can be attributed correctly; (2) when a task says "do not touch path X,
another agent is working there," treat it as literal and check `git status` for that path before and
after — if it moved, it wasn't this agent; (3) when reporting before/after counts for a repo-wide
gate, isolate the variable under test (e.g. compare the same guard version with/without a probe file)
rather than trusting the wall-clock-adjacent "before" and "after" numbers as apples-to-apples.

**Escalated finding (2026-09-04, reports-move task):** a concurrent agent ran a whole-index `git
reset` (no pathspec) at least twice during a single ~15-minute task. Effect observed directly: my own
`git mv docs/reports/*.md docs/audit/reports/` (11 files, each reported `exit=0`) showed up moments
later as ` D`/`??` (unstaged delete + untracked add) instead of `R `, and — more importantly — an
unrelated file that was `A ` (staged) at the very start of the session, `tools/gate-inventory.mjs`,
was found `??` (unstaged) later with no edit from me. `git reset` (mixed, default) does not touch the
working tree, so file *content* on disk stayed correct throughout — only the index/staged view
flickered. **Consequence:** never trust "staged" as a final state on this repo during concurrent
sessions; re-run `git add` for your own paths right before your final status snapshot, verify
gate/test results by reading the working tree (or running the tool, which reads disk) rather than by
inspecting index state, and flag to the founder that some other session's `git reset` can silently
unstage a third party's committed-but-unpushed work — this is a real risk of losing someone else's
staged changes if they run `git commit` believing their earlier `git add` still holds.
