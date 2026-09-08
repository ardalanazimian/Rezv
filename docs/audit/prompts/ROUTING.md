# ROUTING — who the CEO session is right now

**This file is the single source of truth for session addressing. When it disagrees with a
hardcoded id inside any prompt, THIS FILE WINS.**

Last verified: **2026-09-08** by the CEO session itself.

---

## Current roster — confirmed by the founder 2026-09-08

| Role | Session | Confirmed how |
|---|---|---|
| **CEO** | `rezv-f8 [4e0f27]` | this session, self-identified via `ListAgents` |
| **Reviewer** (founder-side) | `rezv-d3 [c8fb22]` | founder confirmed directly; author of directive 033 |

Directives **032** and **034** were produced by a *subagent* the CEO ran before a Reviewer session
existed, and carry the same "founder-side reviewer" signature. That ambiguity is resolved: the role
belongs to `rezv-d3 [c8fb22]`, and the CEO is not running that subagent again. **Two auditors racing
one working tree is a failure this project already paid for today** — see
[the git-channel note](#channels-are-files-not-chat) and the duplicated fixture fix in
`api/tests/business-panel-contract.integration.test.mts`.

## Previously, and now DEAD — do not send to these

```
rezv-b0 [d8087d]        ← named in all seven prompt files, 26 times. No longer resolves.
rezervnofullsource-d9 [8dde6c]   ← named in an early Deputy prompt. Never resolved at all.
```

---

## Why this file exists

**A Claude Code session id is not stable.** It changes when the session restarts — after a reboot,
a `--resume`, or a crash. On 2026-09-08 this session restarted and became `rezv-f8 [4e0f27]`; every
one of the seven prompts committed that morning still names `rezv-b0 [d8087d]`, and a session
following those instructions would address a peer that no longer exists.

That is the same defect class as `apps/seo` hardcoding `https://rezervno.ir` in `robots.ts` and
`sitemap.ts` instead of reading it from the environment: **one fact, many copies, and the copies
cannot all be right.** The fix is the same — one authority, everyone else points at it.

## How to resolve the CEO session yourself

1. Run `ListAgents`. The CEO is the session running the CEO mandate; if exactly one interactive
   session is present besides yours, that is it.
2. If `ListAgents` is ambiguous or the name here is stale, **ask the founder** — do not guess and do
   not fall back to a name from a prompt file.
3. If you resolve a new id, update this file in the same commit as whatever else you were doing, and
   say so in your report. Leaving it stale costs the next session a full round.

## What "offline" means before you conclude anything

A peer listed as `offline` (Remote Control) still accepts messages — they queue and deliver when
that machine reconnects. Three messages sent to `robin [a24bfd]` on 2026-09-07 were still
undelivered as of 2026-09-08. **A queued message is not a delivered message; do not assume it was
read, and do not treat silence as disagreement or consent.**

## Channels are files, not chat

Every channel folder under `docs/audit/` exists and is empty as of 2026-09-08 except
`docs/audit/research/` and `docs/audit/reports/`. Note especially:

- `docs/audit/deputy/` is **empty on `main`**. The Deputy's completed ORDER-001 (four files) was
  committed to the branch `audit/round-21-xss-truncation`, not to `main`. A session that looks only
  at `main` will conclude the Deputy produced nothing. It produced 16 verified rows.

**Before reporting that a session did nothing, check the other branches.** `main` is not the whole
record.
