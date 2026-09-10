# Directive 024 — The missing production layers: what "fix" means for each, and why I am not writing RLS policies

**Date:** 2026-09-06 · **From:** founder-side reviewer · **To:** founder, CEO agent
**Origin:** founder, 2026-09-06 — "fix the layers that don't exist", against his own 10-layer list.

---

## 0. The short version

Three layers are missing or inert. **None of the three can be fixed by writing code today**, and for
different reasons: one needs money and an account, one is blocked by the first, and one is a recorded
decision that only the founder can reverse. Saying "fixed" about any of them would be the exact class
this audit exists to catch.

## 1. RLS (layer 9) — and why writing policies would be the worst thing we could do

Measured on the CI-faithful database, not assumed:

```text
rls_enabled = 61 tables · policies = 0
app role    = superuser=true · bypassrls=true · owns all 72 tables
```

**The app connects as a role that bypasses RLS three separate ways** — superuser, explicit
`BYPASSRLS`, and table ownership. A policy written today would be ignored by all three.

**So "add RLS policies" is not the fix; it is the most dangerous possible action here.** It would
produce a repository where `SELECT count(*) FROM pg_policies` returns 61, where every reviewer and
every future audit sees "RLS policies exist", and where **not one of them enforces anything**. Every
fake-green we have catalogued in two days is smaller than that one would be.

The real fix is three changes in order, and only the third is policies:

1. **Create a non-superuser, non-BYPASSRLS application role.** No such role exists —
   `grep 'CREATE ROLE\|BYPASSRLS' api/prisma/sql/` returns nothing.
2. **Move the app onto it**, which means auditing every query for operations that silently relied on
   owner privileges, and re-testing migrations, which run as owner.
3. **Then** write policies, table by table, each with a red-first proof that it denies a cross-tenant
   read before it is trusted.

**And this is already a decided deferral, not an oversight.** `SESSION-HANDOFF.md:56-57` records
P0-022: *"RLS is inert and stays inert until after launch … Never cite 'RLS is enabled' as
isolation."* Someone thought about this and chose. **Reversing that is the founder's call, not mine
and not the CEO's** — I am not going to quietly override a recorded decision because a later
instruction sounded broad enough to cover it.

**What this means for launch, stated plainly:** the application layer is the sole tenant boundary,
which the handoff already says. Today we found two live cross-tenant defects in that layer (the
coupon leak and the abuse-flag clear) and one hollow test that was supposed to guard it. That is the
honest argument for or against P0-022 — not "RLS is off".

## 2. Hosting (layer 6) — I cannot fix this and neither can any agent

No host, no domain. This needs a purchase, an account, and DNS — escalation category 2 and 3,
capability limits no instruction can grant. **Founder's, entirely.**

## 3. CD (layer 7) — buildable, but building it now would produce a hollow pipeline

Only `ci.yml` exists; nothing deploys. CD is real work and I could direct it. **I am recommending
against doing it yet**, and the reason is our own standard: a deploy pipeline that has never deployed
anything cannot be proven to work. It would sit in the repo looking like a capability, exactly the
shape of the `boot-path` job that built no server for two months.

**Sequencing: hosting first, then CD written against a real target and proven by an actual deploy.**
The one piece already done and honest is `image-build`, which really builds the image in CI.

## 4. Two things that are not "missing" but are worth the founder's eye

**Rate limiting degrades silently and that is deliberate.** `ratelimit.ts:87-102` falls back to an
in-memory cap when Redis is unreachable. Processes do not share memory, so the effective cap becomes
roughly *cap × process count*. The service survives, which is what makes it dangerous — `CLAUDE.md`
records this exact hazard. **It is instrumented**: `rezervno_rate_limit_fallback` is emitted and has
**2 alert rules**, so the degradation is visible. Changing fail-open to fail-closed is a product
trade — a Redis blip would start rejecting real users — and belongs to the founder, not to a fix.

**Storage is a local disk, not an object store.** `UPLOAD_DIR=/data/uploads` on a named volume, with
the backup container mounting it read-only. That is coherent for one host and becomes the binding
constraint the moment a second app instance exists. Not broken; scope-limited, and worth knowing
before hosting is chosen, because the choice of host constrains it.

## 5. What I am doing and not doing

Not writing RLS policies. Not directing CD before a host exists. Not touching the P0-022 decision.
Recording the three-part RLS change so that if the founder does reverse P0-022, the work starts from
a scoped plan rather than from "add policies" — which is where it would otherwise start, and which
would produce 61 policies that enforce nothing.
