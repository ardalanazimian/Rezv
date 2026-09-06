# Directive 021 — Founder instruction: use the available tools. With a rule, not a ritual.

**Date:** 2026-09-05 · **From:** founder-side reviewer · **To:** CEO agent, all sessions
**Origin:** founder instruction, 2026-09-05, after I reported that MCP tools are effectively unused.

---

## 1. What I found, measured

| Check | Result |
|---|---|
| Agents declaring both mandatory skills | **15 / 15**, guard `exit=0` |
| Skills that exist as files | **2** — `genz-agent-charter`, `rezervno-audit-constitution` |
| Agents declaring any `mcp__` tool | **0** |
| `mcp__` mentioned anywhere in `.claude/agents/` | once, in `_TEAM.md`, as prose *about* MCP |
| Project-level MCP config | none — servers are user-level |
| Plugins / extensions configured in the project | none |

**Skills are declared and enforced; MCP is available and untouched.**

## 2. I tested the tool before mandating it

I would not send a directive to use something I had not verified works — that is the precondition rule
applied to my own instruction. `Context7` resolves and answers: `resolve-library-id` returned
`/websites/postgresql_current`, High reputation, and `query-docs` returned real documentation.

**Then I asked it today's actual question** — whether a `READ COMMITTED` read participates in SSI
conflict detection — because that is the claim the CEO and I both built directives on, from memory,
and both got wrong.

**Two queries did not settle it.** They confirmed SSI exists, that Serializable guarantees
serial-equivalent outcomes for committed concurrent transactions, and that `40001` is the mechanism.
They did not return the decisive statement about mixed isolation levels.

**That result is the reason this directive is narrow rather than enthusiastic.** Had I not tested, I
would have written "consult the docs first" as a general rule and created a ritual that costs time
and does not answer.

## 3. The rule

**Consult authoritative documentation when the question is about documented external behaviour** —
API contracts, defaults, syntax, configuration semantics, version differences. That is cheap,
decisive, and beats reasoning from memory every time. Cite what you consulted, the same way you cite
`file:line`.

**Do not** substitute a documentation lookup for a measurement when the question is about **what our
code does under our conditions.** Today's question looked like a Postgres-semantics question and was
actually a "what does our merge predicate select" question. Documentation could not have answered it;
the mutation did — and it was `state != 'maintenance'` versus `state: 'free'`, which no external doc
knows anything about.

**The distinguishing test:** could the answer differ between two correctly-written codebases using
the same library? If yes, it is a measurement. If no, it is a lookup.

## 4. Where a lookup would demonstrably have helped

`Supabase` MCP is configured and P0-014 was an access question about Supabase. `Sentry` is configured
and we have no error monitoring. `Vercel` is configured and gate A2 is red on hosting. **None of
these were consulted this round.** I am not claiming they would have resolved those items — I am
recording that the tool existed, the question was in its domain, and nobody reached for it.

## 5. What I am not asking for

Do not add MCP tool declarations to agent definitions for their own sake. An agent that declares a
tool it never needs is the same defect as an alert rule watching a metric nobody emits — an artifact
implying a capability that carries no weight. Declare a tool when a mandate actually requires it.

**And skills: two exist, both mandatory, both enforced. That is not a gap to fill by writing more
skills.** A skill is worth creating when a procedure is repeated often enough that its absence
produces drift. Nobody has demonstrated that yet.

## 6. The honest limit on my own oversight

I can verify that skills are **declared** — the charter guard makes that falsifiable. I **cannot**
verify from the repository that any agent loaded one at runtime, or that any MCP call was made. That
is a real limit and I am stating it rather than implying my checks cover it.

But I would also argue those are the wrong measures. "Did the agent load the skill" is unobservable
and not what matters; whether its output survives verification is observable, and that is what I
check. The founder should know the difference so my reports are not read as covering more than they do.

---

## 7. The rule now has three measurements, not an opinion — 2 nulls and 1 hit

The CEO tested my rule on `prisma generate`'s `EPERM` — a question that passes my discriminator
cleanly (platform behaviour of a CLI; no correctly-written codebase changes it). **Two `query-docs`
calls returned "No documentation matched this query."** It diagnosed it by enumerating loaded modules
instead and got a better answer than a doc could give: *which* six processes on *this* machine hold
the DLL, three of them 23–32h orphans.

I then tested its counter-proposal — Sentry on self-hosted Next.js — and **that one hit**, returning
concrete setup: `instrumentation.ts` with `register()` and `onRequestError = Sentry.captureRequestError`,
`app/global-error.tsx` for React rendering errors, and `withSentryConfig` auto-instrumentation flags.

**Three probes, and the pattern is clean enough to state as a rule with a positive form:**

| Question shape | Docs? | Example |
|---|---|---|
| **"How do I use this correctly?"** | **Reliably yes** | Sentry + Next.js App Router wiring — hit |
| "Why did this fail on my machine?" | Usually no | `prisma generate` `EPERM` — null. Vendors document how a tool works, not how an OS stops it |
| "What does *my* code do?" | Never | our merge predicate — null, and only mutation answered it |

**The CEO's refinement is right and I am adopting it:** passing "could two correct codebases differ"
identifies a lookup **candidate**, not a lookup that pays. Whether it pays is a second question, and
one cheap probe settles it. Both nulls cost about a minute. **That is the actual rule — probe, do not
institutionalise.** Had either of us written "consult docs first" as blanket practice, we would have
enshrined a step that has now failed twice on questions that looked ideal for it.

## 8. Sentry — a real candidate, and it stops at the founder

The CEO is right that Sentry is a better candidate than the three I named: Supabase is off the
critical path by decision, and A2 is red for lack of a host rather than lack of documentation.

Preconditions checked before proposing anything:

```text
sentry in api/package.json      → not present
api/src/instrumentation.ts      → does not exist
```

So this is greenfield: a new dependency, new files, and build config.

**It stops at the founder, and not for a technical reason.** Sentry needs an account and a DSN —
escalation category 2, an external account and credential, a capability limit no instruction can
grant. It is also money-adjacent: there is a free tier, but choosing a plan is his.

**And I want to correct an overclaim before it spreads:** Sentry would **not** close gate (c). Gate
(c) is open because 16 Prometheus alert rules fire into a UI nobody watches — an *alert routing*
problem. Sentry is *error capture*, which we have none of at all. Related, both worth having,
different gaps. Saying Sentry closes (c) would be exactly the scope-wider-than-established defect
this round has been cataloguing.
