# Orchestration Model

## Lifecycle

Every task, in every agent role, moves through:

```
PROPOSAL → VALIDATION → APPROVAL → EXECUTION → VERIFICATION → LEARNING UPDATE
```

- **PROPOSAL** — a task description with a named domain (maps to one agent
  role in `registry/agents.yaml`) and cited evidence for why it's needed
  (link to an audit doc, a failing test, a user report — not a hunch).
- **VALIDATION** — `rezv-orchestrator` checks the proposal names a real
  agent role, doesn't require an approval-gated action without flagging
  that gate (`governance/GOVERNANCE.md#approval-gates`), and has bounded
  cost/timeout per the defaults in `registry/agents.yaml`.
- **APPROVAL** — for anything on the approval-gate list, this step blocks
  on an explicit human "yes." For everything else, opening the PR *is* the
  approval request (standard review).
- **EXECUTION** — the domain agent role does the work, following
  `governance/GOVERNANCE.md`'s PR lifecycle and mandatory pre-push checklist.
- **VERIFICATION** — `rezv-qa`/`rezv-security`/`rezv-review` confirm the
  claimed result against actual command output, not the PR author's say-so.
- **LEARNING UPDATE** — `rezv-knowledge` records a `knowledge/
  KNOWLEDGE_SYSTEM.md` entry *only if* the outcome was actually measured
  (Section 23) — otherwise nothing is written, per the "no evidence, no
  learning claim" rule.

## What actually runs this lifecycle today

A human-directed Claude Code session, one task at a time. That is the
entire runtime. There is no dispatcher process reading
`registry/agents.yaml` and picking an agent automatically.

## The real building blocks available, if the human wants to go further

This environment (Claude Code Remote / Claude Code on the web) does provide
genuine primitives that could implement pieces of "continuous operation" —
they are listed here for accuracy, not because this change turns any of
them on:

- **`create_trigger` (Routine)** — can fire a prompt into a session on a
  cron schedule or a one-off timestamp. This is the closest real analog to
  a "scheduled agent."
- **`subscribe_pr_activity`** — delivers PR comments/CI events into a
  session automatically, which is how a "PR Steward"-style role (close to
  `rezv-release`/`rezv-review`) can react to activity without polling.
- **GitHub MCP tools** (`mcp__github__*`) — real branch/PR/issue/review
  operations, already in use for this very change.
- **Claude Code Remote sessions** (`create_session`) — can spawn a sibling
  session for a specific domain task, which is the mechanism a human could
  use to literally run one Claude Code session per `registry/agents.yaml`
  role in parallel.

## Activating a Routine

None of the above is wired up by this change. Doing so — e.g. creating a
Routine that fires `rezv-security` on a schedule to re-scan the repo, or a
Routine that auto-merges on green CI — is a **governance change** under
`governance/GOVERNANCE.md#approval-gates` and requires the human to say so
explicitly, because it changes the repo from "AI acts when a person asks"
to "AI acts on a timer without a person asking that time." That crosses
exactly the line Section 37 of the original request draws: *"Never bypass
security or governance controls," "Never modify production without
approval."* A scheduled agent that can push code is, by definition, acting
without per-instance approval unless the schedule itself was the approval —
which is a legitimate design, but one the human needs to choose, not one an
agent enables for itself.

If/when a human wants to activate a specific piece of this (e.g. "watch
open PRs and auto-fix failing CI," which this session's own operating
instructions already do for PRs it opens), the concrete steps are:
1. Name the exact trigger condition and exact allowed actions (e.g. "may
   push a fix commit; may not merge; may not touch `api/prisma/sql/`").
2. Create the Routine/subscription with those bounds stated in its prompt.
3. Record the decision in `knowledge/KNOWLEDGE_SYSTEM.md` under
   `DECISION_MEMORY` so it isn't a silent, undocumented standing grant.
