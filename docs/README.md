# RezervoNo — Documentation

Canonical technical documentation for the RezervoNo platform, generated from the
merged repository. Intended for onboarding senior engineers.

## Read in this order

1. [PROJECT_KNOWLEDGE.md](./PROJECT_KNOWLEDGE.md) — overview, goals, stack, repo
   layout, workflow, conventions, branch strategy, build & CI/CD.
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — system diagram, frontend/backend,
   data flow, auth/authorization, request lifecycle, caching, queue, logging,
   monitoring, external services.
3. [DATABASE.md](./DATABASE.md) — tables, relationships, ER diagram, migrations,
   indexes, constraints, transactions, soft-delete, future notes.
4. [API_REFERENCE.md](./API_REFERENCE.md) — every endpoint (route, method, auth,
   body, response, errors, examples).
5. [FRONTEND.md](./FRONTEND.md) — structure, routing, layout, components, state,
   data fetching, forms, validation, UI patterns, theme.
6. [BACKEND.md](./BACKEND.md) — controllers, guards, services, utilities, jobs,
   configuration, dependency graph.
7. [DEPLOYMENT.md](./DEPLOYMENT.md) — local, Docker, Compose, Vercel, database,
   secrets, rollback.
8. [ENVIRONMENT.md](./ENVIRONMENT.md) — every environment variable.
9. [SECURITY.md](./SECURITY.md) — authN/authZ, tokens, sessions, CSRF, XSS,
   SQLi, rate limiting, secrets, recommendations.
10. [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) — tech debt, known issues,
    scalability, future improvements.

The root [README.md](../README.md) is the quick-start / operator entry point.

## Conventions in these docs

- Everything is based on the **current repository**; nothing is invented.
- Inferences that couldn't be fully verified are marked **(uncertain)**.
- Diagrams are Mermaid (render on GitHub).

## Doc classification (updated 2026-08-24)

This repo carries **120 markdown files**. Most are point-in-time audit outputs,
not living references. Without a map, a new engineer cannot tell which numbers
to trust — so here is the rule and the map.

**Precedence, highest first:**

1. `CLAUDE.md` (repo root) — the operating rules. Always wins.
2. **Current state** — `docs/audit/`:
   - `CLEANUP-REPORT-2026-08-23.md` — what was inspected, fixed, and left open
   - `DEAD-CODE.md` — deletion decisions with evidence
   - `CUSTOMER-PROFILE.md` — §13/§14 field-by-field status
   - `BASELINE.md` — measured baseline
3. **Open work** — `docs/recovery/OPEN-FINDINGS.md` (what is knowingly unfixed).
4. **Canonical references** — the numbered list above (`ARCHITECTURE.md`,
   `DATABASE.md`, `API_REFERENCE.md`, …) plus `docs/adr/` and
   `docs/architecture/`.
5. **Archived snapshots** — everything else. Kept for the *reasoning* they
   record, not their numbers.

### ⚠️ Archived snapshots — numbers are historical

Ten files carry an `ARCHIVED-SNAPSHOT` banner because their route counts were
**measured wrong** on 2026-08-24 (they claim 26 / 46 / 59 / 79 / 82 / 83 / 84
routes; the repository actually has **135**):

`DEPLOY_API_VERCEL.md` · `FRONTEND-BACKEND-SECURITY-AUDIT-2026-07-21.md` ·
`KNOWN_LIMITATIONS.md` · `architecture-audit/API_USAGE_MATRIX.md` ·
`architecture-audit/FINAL_VALIDATION_REPORT.md` ·
`architecture-audit/FULLSTACK_INTEGRATION_AUDIT.md` ·
`backend-audit/API_AUDIT_REPORT.md` ·
`backend-audit/BACKEND_ARCHITECTURE_AUDIT.md` ·
`backend-audit/BACKEND_FINAL_AUDIT.md` ·
`backend-audit/TECHNICAL_DEBT_REPORT.md`

Also historical (not re-measured, treat with the same caution):
`API-CONTRACT.md`, `FINAL-PRODUCTION-AUDIT.md`, `PROJECT-AUDIT-HANDOFF*.md`,
`AUDIT-FIXES-*.md`, `CHAT-FEATURE-2026-07-20.md`, `SUPABASE-SECURITY.md`,
the rest of `architecture-audit/` and `backend-audit/`, and `design/`.

**Nothing was deleted** — per the cleanup protocol, a doc is archived (marked),
never removed, because it records *why* a decision was made even when its
figures have moved on.
