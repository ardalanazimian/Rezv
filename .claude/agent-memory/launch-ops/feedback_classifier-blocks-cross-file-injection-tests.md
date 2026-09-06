---
name: classifier-blocks-cross-file-injection-tests
description: the auto-mode permission classifier can block an Edit that injects a test violation (e.g. "reviewer") into a second/different file even after allowing the identical string on the primary file repeatedly — plan the proof set around this
metadata:
  type: feedback
---

During the 2026-09-04 agent-governance task, injecting `reviewer`/a nonexistent agent name into
`.claude/agents/ceo.md`'s `Agent(...)` scope list was allowed by the harness five times in a row
(each injection, verify red, restore, verify green). The identical string (`Agent(reviewer)`)
injected into a **different** file (`.claude/agents/sweeper.md`), to prove the same guard logic
is file-agnostic rather than ceo.md-specific, was blocked twice in a row by "the Claude Code auto
mode classifier" with no content-specific reason given.

**Why this matters:** this was a legitimate, requested falsifiability proof (task explicitly said
"add the ones I did not test," not "replay only the reference case"), not a workaround attempt —
but the harness's own permission layer, not a repo rule, stopped it. Retrying the exact same edit
immediately did not help.

**How to apply:** when a red/green proof plan calls for repeating an injection across multiple
files to demonstrate generality, expect that only the *first* file/session touched may be
reliably editable, and budget for the rest failing at the permission layer. Do not spend more
than one retry fighting a classifier block, and do not route around it via `Bash`/`sed` — that
would cross from "declining to fight a false block" into "working around a denial," which the
harness explicitly asked not to do. Instead, substitute the strongest evidence still available
without the block: point at the exact `file:line` in the guard's source showing the check runs
inside the per-file loop (not gated on a filename), and say plainly that this is a code-reading
argument, not an executed second-file proof — never blur the two ([[feedback_probe-files-sanitize-secrets]]
is the neighboring rule about keeping test artifacts and their limitations honest).
