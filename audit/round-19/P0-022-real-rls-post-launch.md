# P0-022 — Real DB-level defense-in-depth (RLS), **post-launch**

**Opened:** 2026-09-04 · **Ordered by:** founder directive 4, order 2c · **Severity:** major · **Schedule:** POST-LAUNCH — do **not** implement pre-launch
**Depends on:** P0-014 decision (self-hosted Postgres in the Docker stack) · **Blocks:** nothing at launch
**Related:** P0-021 (the honesty finding), `api/tests/rls-policy-honesty.integration.test.mts` (the gate), `docs/SECURITY.md` §10 and §12.4

---

## Why this became possible only now

On the paused Supabase project we did not own the role layer in any practical sense.
With the founder's 2026-09-04 decision to run **Postgres inside our own Docker stack**,
we control roles, `GRANT`s and the connection string — so real RLS is finally
implementable rather than theoretical.

## Why it is NOT done pre-launch

Today the application connects as a role that is **owner + `rolsuper` + `rolbypassrls`**
(verified: `rezervno super=true bypassrls=true`). Every query in the product runs through
it. Moving the app onto a non-owner role pre-launch means *every* read and write path is
re-authorized at once, with no production traffic to catch what broke and no rollback
window. The expected gain is defense-in-depth behind a boundary that already exists and
is separately tested (the A5 application-layer isolation matrix). The risk/benefit is
plainly wrong before launch — this is a deliberate, recorded deferral, not an oversight.

## Definition of done — all three, or none of it counts

RLS protects only when **all three** hold. Any one missing and the other two protect nothing:

1. **A non-owner application role.** A dedicated role (e.g. `rezervno_app`) that is *not*
   the table owner, *not* `SUPERUSER`, and *not* `BYPASSRLS`, with explicit
   `GRANT SELECT, INSERT, UPDATE, DELETE` per table. `DATABASE_URL` points at it;
   migrations keep using the owner role.
2. **Actual policies.** Per-table `CREATE POLICY` expressing the tenant predicate, driven
   by a request-scoped setting (`SET LOCAL app.tenant_id = …` at transaction start via a
   Prisma middleware/extension) — not by a session-wide global.
3. **`FORCE ROW LEVEL SECURITY`** on every table that has policies, so even the owner
   cannot silently bypass them during a maintenance script.

## Work breakdown

| # | Step | Note |
|---|------|------|
| 1 | New idempotent migration `api/prisma/sql/NNN-rls-app-role.sql` — create the role, grants, `FORCE ROW LEVEL SECURITY` | file numbering continues from the current max; never edit a previous file |
| 2 | Policies per tenant-scoped table, in the same or a following migration | must be mirrored in `schema.prisma` where Prisma can express it, per the CLAUDE.md two-source rule |
| 3 | Prisma middleware that sets `app.tenant_id` per transaction from the auth context — **never** from body/query | the same rule the application layer already follows |
| 4 | Flip `DATABASE_URL` to the app role; keep a separate owner URL for migrations | `DATABASE_DIRECT_URL` is currently inert (`docs/ENVIRONMENT.md`) — wiring it is part of this ticket |
| 5 | Update the gate's allowlist: every table that gains real policies **must** leave `RLS_ENABLED_WITHOUT_POLICY_ALLOWLIST` — clause 2 of the gate fails if it does not | the gate is designed to force this |
| 6 | Falsifiability proof: with the app role connected, a cross-tenant `SELECT` must return **zero rows at the DB level** even when the application check is bypassed; record the raw output | this is the only evidence that separates real RLS from today's inert RLS |
| 7 | Re-correct the docs this ticket makes stale: `SECURITY.md` §10 + §12.4, `DATABASE.md` §10, `DEPLOYMENT.md`, `KNOWN_LIMITATIONS.md`, `SUPABASE-SECURITY.md` | they currently state, correctly, that RLS is inert |

## Acceptance

- Step 6's cross-tenant query returns zero rows with the raw output recorded, **and**
- `api/tests/rls-policy-honesty.integration.test.mts` is green with a **shrunk** allowlist, **and**
- the full suite (`npm test` in `api/`) is green with the app on the non-owner role.

Anything less and the honest label stays: *RLS is enabled and inert*.
