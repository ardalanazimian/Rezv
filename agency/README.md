> ## ⛔ AGENCY_STATUS=DISABLED — PLANNED / NOT IMPLEMENTED
>
> **این سند فقط «معماریِ برنامه‌ریزی‌شده» است و هیچ سیستمِ در حالِ اجرایی را توصیف نمی‌کند.**
> در ۲۰۲۶-۰۸-۱۳ با تصمیمِ صریحِ مالکِ محصول، اجرایِ خودکارِ عامل‌ها به‌طورِ کامل
> متوقف شد (دلیل: مصرفِ بیش از حدِ توکن/منابع). رجوع کن به `agency/AGENCY_STATUS`.
>
> هیچ‌چیز در این فایل دستورالعملِ اجرایی نیست. به‌طورِ مشخص ممنوع است:
> ساختِ Routine/trigger/cron، اشتراکِ خودکارِ رویدادِ PR، حلقهٔ خودگردان،
> پایشِ پس‌زمینه، خودآموزی، و هر عملیاتِ خودکارِ گیت‌هاب.
> کلیدهایِ فعال‌سازیِ قدیمی (`REZV`، `REZV FULL`) بی‌اثرند.
>
> فعال‌سازیِ دوباره فقط با تصمیمِ مکتوبِ انسانی و تغییرِ دستیِ `agency/AGENCY_STATUS`.

# Rezv AI Agency OS — Charter

> **Status: mostly SPECIFICATION, plus one narrow live Routine.** This
> directory defines a governance and organization layer for how AI-assisted
> work on this repository *should* be structured, gated, and remembered.
> As of 2026-08-11, exactly one piece of it is actually scheduled: a daily,
> **report-only** (no commits, no pushes, no PRs) health-check Routine the
> human explicitly authorized — see `ORCHESTRATION.md#activating-a-routine`
> and `knowledge/KNOWLEDGE_SYSTEM.md § DECISION_MEMORY`. Every other agent
> role and capability in this directory remains `DOCUMENTED_ONLY`: no
> agent has standing write, push, or PR authority. Treat every claim below
> as `DOCUMENTED_ONLY` unless a section explicitly says otherwise, per the
> classification rules in [`DISCOVERY.md`](./DISCOVERY.md).

~~Activation keyword: `REZV`. Highest-level command: `REZV FULL`.~~
**باطل‌شده (۲۰۲۶-۰۸-۱۳): این کلیدها دیگر هیچ کاری را فعال نمی‌کنند.**
متنِ زیر فقط برایِ ثبتِ تاریخی نگه داشته شده. هر دو زمانی قرار بود
conventions for prompting a human-operated Claude Code session against this
repo — they are not wired to any trigger, webhook, or script.

## What this actually is

A request was made to build "a persistent AI organization" with ~23 agents
that continuously monitors, researches, and ships changes to Rezv with no
human in the loop. That literal system does not exist and was not built in
this change, for a concrete reason: this repository's own rules
(`CLAUDE.md`) require type-check + lint + test + Playwright E2E + a design-
system diff to be **green before every push**, forbid claiming "tested" work
that wasn't actually run, and require human-approved PRs for anything
touching auth, reservations, or double-booking locks. A "continuously
operating" agent that pushes without those gates would violate the
project's own highest-priority rule. So this change implements the parts of
the request that are real and honest to ship right now:

1. **An org chart and agent registry** (`registry/agents.yaml`) — every
   agent from the request, with real permissions, forbidden actions, and
   escalation rules expressed in terms of tools that actually exist in this
   environment (GitHub MCP, Claude Code Remote sessions/Routines,
   Playwright, `sync-design-system.sh`, etc.) rather than invented tooling.
2. **A discovery index** (`DISCOVERY.md`) — this repo already contains
   dozens of real audits (`docs/architecture-audit/`, `docs/backend-audit/`,
   `SECURITY-AUDIT.md`, `AUDIT-REPORT-2026-08-07.md`, …). Re-running that
   discovery from scratch would duplicate real work and risk contradicting
   it. `DISCOVERY.md` indexes what already exists as evidence and states
   what is genuinely still `UNKNOWN`.
3. **A capability matrix** (`CAPABILITY_MATRIX.md`) grounded in citations to
   those existing audits, not fabricated end-to-end verification.
4. **A full-repo code search** (`CODE_SEARCH_AUDIT.md`) — the Section-7
   marker sweep (`TODO`/`FIXME`/`MOCK`/`STUB`/`FAKE`/`BYPASS`/…) actually
   run this session, with every hit hand-classified, not just counted.
5. **A CEO briefing** (`CEO_BRIEFING.md`) — the first real output of the
   `rezv-ceo` role: the above synthesized into FACT/EVIDENCE/INFERENCE/
   RECOMMENDATION/UNKNOWN statements, per Section 12's own requirement.
6. **Governance** (`governance/GOVERNANCE.md`) — evidence hierarchy,
   security/approval gates, branch strategy, PR lifecycle, release states,
   cost control, observability, AI-security rules, failure handling — as
   concrete policy for *human-run* Claude Code sessions working this repo.
7. **A knowledge system** (`knowledge/KNOWLEDGE_SYSTEM.md`) — the eleven
   memory categories from the request, seeded only with facts that already
   have a citation in the repo (mostly from `CLAUDE.md` and
   `PROJECT-KNOWLEDGE.md`), not invented ones.
8. **An orchestration model** (`ORCHESTRATION.md`) — the
   PROPOSAL → VALIDATION → APPROVAL → EXECUTION → VERIFICATION →
   LEARNING lifecycle mapped onto tools this environment genuinely has
   (Claude Code Remote `create_trigger`/Routines, GitHub PR subscriptions),
   with an explicit note that turning any of it into a scheduled,
   unattended trigger is a governance change requiring human sign-off
   (Section 36 of the original request, and `CLAUDE.md`'s "high-risk
   changes get a PR + human approval" rule) — not something this change
   enables unilaterally.

## What this is not

- Not a multi-agent runtime. No agent in `registry/agents.yaml` calls
  another agent automatically. Each "agent" is a role definition a human
  (or a human-directed Claude Code session) adopts on purpose.
- Not continuous. Nothing here polls, schedules, or watches the repo unless
  a human explicitly creates a Routine/trigger and says so (see
  `ORCHESTRATION.md`).
- Not a replacement for `CLAUDE.md`. `CLAUDE.md` remains the binding project
  rulebook; this directory is additive governance for how a "Rezv AI
  Agency" role-plays inside those same rules, never a way around them.

## Reading order

1. `DISCOVERY.md` — what is actually known about this repo, and from where.
2. `CODE_SEARCH_AUDIT.md` — the Section-7 full-repo marker search
   (TODO/FIXME/MOCK/STUB/…), classified, not just counted.
3. `CAPABILITY_MATRIX.md` — capability-by-capability status with citations.
4. `CEO_BRIEFING.md` — the CEO agent role's synthesis of the above into
   FACT/EVIDENCE/INFERENCE/RECOMMENDATION/UNKNOWN statements.
5. `registry/agents.yaml` — the agent org chart.
6. `governance/GOVERNANCE.md` — the rules every agent role operates under.
7. `knowledge/KNOWLEDGE_SYSTEM.md` — the persistent memory categories.
8. `ORCHESTRATION.md` — how proposals move from idea to merged PR, and what
   "activating" continuous operation would actually require.
