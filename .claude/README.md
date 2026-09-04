# Rezervno — Claude Code agent system

```
.claude/
├── settings.json                  # shared project settings — deny rules only (see "What is NOT wired")
├── settings.local.json            # personal allow-list, not shared
├── agents/
│   ├── _TEAM.md                   # the roster map — not an agent (no frontmatter)
│   ├── ceo.md                     # opus   · orchestrator, the only agent allowed to spawn others
│   ├── census.md                  # sonnet · read-only feature-reality census
│   ├── security.md                # opus   · authz, tenant isolation, secrets
│   ├── test-integrity.md          # opus   · fake-green hunting, falsifiability, mutation
│   ├── launch-ops.md              # sonnet · deploy, backups, SMS, monitoring
│   ├── sweeper.md                 # haiku  · bulk mechanical work
│   └── … 8 pre-existing Phase-2 agents (see _TEAM.md)
└── skills/
    └── rezervno-audit-constitution/SKILL.md   # preloaded into the rigor-critical agents
```

## Run it

```bash
claude --agent ceo
```

Then delegate explicitly:

```
@census   run the customer-app feature census
@security build the exhaustive tenant-isolation matrix
```

## How the isolation works

- **Context** — each agent starts in its own window with only its own system prompt. Verbose
  work (greps, logs, test output) stays inside the agent; only the summary returns.
- **Tools** — `tools` is an allowlist. `census` and `sweeper` have no `Edit`/`Write` at all, so
  a read-only agent *cannot* modify what it audits. The constraint is enforced, not requested.
- **Model** — `model` routes each agent to its tier. That is the cost handle.
- **Spawn allowlist** — `tools: Agent(a, b, c)` in `ceo.md` restricts which agent types may be
  spawned. This works **only for the agent running as the main thread** (`claude --agent ceo`);
  inside a subagent definition the parenthesised list is ignored.
- **Memory** — `memory: project` gives an agent a persistent directory under
  `.claude/agent-memory/<name>/`, shareable through version control.

## What is NOT wired, and why — read before you "fix" it

These four points come from an original design note that did not survive verification against
this repository. They are recorded rather than silently dropped.

1. **No `mcpServers:` frontmatter anywhere.** That field is real, but it resolves server names
   from an MCP config, and **this project has no `.mcp.json`**. Supabase, Vercel, Sentry and
   Context7 reach the session as claude.ai connectors whose tools are named
   `mcp__claude_ai_<Server>__*` — there is no server called `supabase`. Writing
   `mcpServers: [supabase, …]` would be a config line that silently does nothing, which is
   precisely the fake-green this whole audit exists to eliminate. Add it the day a `.mcp.json`
   with matching names exists, and not before.
2. **`settings.json` carries no concurrency or nesting-depth keys.** The documented top-level
   keys are `permissions`, `env`, `hooks`, `model`, and `outputStyle`. No documented key controls
   subagent concurrency or agent nesting depth, so none is written here. Concurrency is
   controlled by the CEO's own spawn discipline (`ceo.md` §3), which is a real constraint because
   an agent that is never spawned costs nothing.
3. **`CLAUDE_CODE_SUBAGENT_MODEL` / `…_FORCE` are not documented settings keys** and are not
   set here. To run cheaply, set `model:` per agent — that is verifiable.
4. **No duplicate agents were created.** Eight Phase-2 agents already existed and are committed.
   `backend`, `ui-ux`, `ml` and `loyalty` were **not** created as new files, because
   `backend-integrity-engineer`, `panels-ui-engineer`, `ai-intelligence-auditor` and
   `data-trust-engineer` already own that ground. `ceo.md`'s spawn allowlist points at the real
   ones. Building a parallel roster would be the "duplicate logic" defect CLAUDE.md forbids.

## Cost, on the record

The `agency/` layer (~23 agents) was **DISABLED on 2026-08-13** for excessive token and resource
consumption, and `docs/audit/BASELINE.md` §0 warns that this protocol is "a bigger version of the
same request that produced `agency/`".

Defining an agent is free; running one is not. The roster is therefore deliberately small, the
cheap `sweeper` tier exists so opus agents stop paying for grep, and `ceo.md` §3 makes an inline
mandate the default over a spawn whenever the work is a single verifiable pass.

## Wiring notes

1. Project agents require trusting the workspace folder before their frontmatter takes effect.
2. Adding the first file to a new `agents/` directory needs a Claude Code restart; later edits
   are picked up within seconds.
3. Keep `description` fields short — every agent description shares one context budget.
