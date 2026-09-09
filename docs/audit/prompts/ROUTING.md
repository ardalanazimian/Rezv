# ROUTING — who the CEO session is right now

**This file is the single source of truth for session addressing. When it disagrees with a
hardcoded id inside any prompt, THIS FILE WINS.**

Last verified: **2026-09-08** by the CEO session itself.

---

## Current roster — confirmed by the founder 2026-09-08

| Role | Session | Confirmed how |
|---|---|---|
| **CEO** | `rezv-9c [5283b5]` — was `rezv-f8 [4e0f27]`, and `rezv-b0 [d8087d]` before that | `ListAgents` 2026-09-09, self-identified. Same session across **three** restarts; the two predecessors are dead ids, not other agents |
| **Reviewer** (founder-side) | `rezv-e6 [a10db3]` — was `rezv-d3 [c8fb22]` on 2026-09-08 | `ListAgents` 2026-09-09; founder confirmed the role directly on 2026-09-08. Directives 033, 035, 036 and 037 are signed `rezv-d3 [c8fb22]` — same session, before the restart |
| **Deputy** | `rezv-fa [0a4dbb]` — was `rezv-b1 [5f3782]`, and `rezv-30 [a7bb03]` before that | `ListAgents` 2026-09-09, self-identified. Same session across **three** restarts, confirmed from its own transcript, not by position in this table: it took ORDER-001 from the CEO as `rezv-30`, wrote `52ae7f8`/`58f5181` as `rezv-b1`. The two predecessors are dead ids, not other agents |
| **Red Team** | `rezv-c7 [b87425]` — no predecessor, first start | Self-identified 2026-09-09 from its own opening prompt: the founder pasted `redteam.md` into it with the CEO contact and the instruction to read this file first. Not inferred from position in `ListAgents`, and not accepted from the CEO's message, which deliberately declined to say which of the two new sessions was which |
| **Launch Engineer** | `rezv-a0 [5776f9]` — no predecessor, first start | Self-identified 2026-09-09 from its own opening prompt: the founder pasted `launch-engineer.md` into it, naming the ML event substrate and feature-reality as the ask, with the instruction to read this file first. Confirmed to the CEO before writing this row. I did **not** assert `rezv-c7`'s role from mine — it wrote its own row, which is the only reason both are here |

| **Designer** (frontend + UI/UX, Gen-Z lens) | *row not yet written* — charter is `docs/audit/prompts/designer.md` | **Opened by the founder 2026-09-09.** The row belongs to that session to write from its own transcript. Its absence here means it has not written it yet, **not** that the role is unfilled. Do not fill it in on its behalf, and do not map it by position in `ListAgents` |

**RESOLVED 2026-09-09 — and the way it was resolved is the point.** The Reviewer found two
unidentified interactive sessions (`rezv-fa [0a4dbb]`, `rezv-9c [5283b5]`), judged them *almost
certainly* the CEO and the Deputy, and **refused to write that down**, because *almost certainly* is
not a measurement. Each session then identified itself from its own transcript — `rezv-9c` as the
CEO, `rezv-fa` as the Deputy — and both rows above rest on that, not on elimination or position.

Had the roles been assigned by position they would have been assigned **correctly**, which is exactly
why the restraint is worth recording: a guess that happens to be right still teaches the tree that
guessing works. Keep the rule — **do not assume the previous roster maps onto you by position** —
and when you are the unidentified session, say who you are and how you know.

Directives **032** and **034** were produced by a *subagent* the CEO ran before a Reviewer session
existed, and carry the same "founder-side reviewer" signature. That ambiguity is resolved: the role
belongs to `rezv-d3 [c8fb22]`, and the CEO is not running that subagent again. **Two auditors racing
one working tree is a failure this project already paid for today** — see
[the git-channel note](#channels-are-files-not-chat) and the duplicated fixture fix in
`api/tests/business-panel-contract.integration.test.mts`.

**Added 2026-09-09 — Red Team row.** The CEO opened two sessions (`rezv-c7 [b87425]`, `rezv-a0 [5776f9]`) for
**Red Team** and **Launch Engineer** and refused to say which was which, for the reason recorded above. Each
confirmed itself from its own opening prompt. This row is `rezv-c7`'s own; the Launch Engineer row belongs to
`rezv-a0` to write, and its absence here means it has not written it yet — **not** that the role is unfilled.

**Stale id still live in a committed prompt:** `docs/audit/prompts/redteam.md` §0 names `rezv-b0 [d8087d]` as
"the CEO session" three times. That id is in the DEAD list below. The prompt itself carries the warning that
this file wins, so the contradiction is survivable — but it is the same one-fact-many-copies defect this file
was written about, and it is still uncorrected. Raised with the CEO 2026-09-09.

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
