---
name: feature-census-id-collision
description: audit/round-16/feature-census.json's `id` field collides between customer and company apps, and is entirely absent for business — discovered 2026-09-04 during A11, unresolved. Read before merging any per-row result into that file by `id`.
metadata:
  type: project
---

`audit/round-16/feature-census.json`'s census array uses an `id` field (e.g. `C04`, `C57`) that
looks like a global row identifier but is not one:

- Every `C##` id from `C01` to `C81` is used **twice** — once for a `customer`-app row and once
  for a `company`-app row (both app names start with "C", and whoever generated the ids picked
  the letter without checking for the collision). Example confirmed live: `C04` is simultaneously
  "customer: Points chip (nav-pts)" and "company: Login «ورود با پیامک» button".
- All 143 `business`-app rows have **no `id` field at all**.

**Why: unresolved as of 2026-09-04.** Found while trying to merge A11's 55 runtime-verified rows
back into this file. I did not fix it or merge through it — merging by `id` alone would silently
write to the wrong row for every customer/company pair. Instead I computed the merge mapping keyed
by the compound `(app, element)` pair (collision-free) and left it at
`audit/round-16/A11-census-mapping.json` for whoever does the actual merge.

**How to apply:** never join against this file using `id` alone without also checking `app`.
Before any future automated merge into `feature-census.json`, either fix the id scheme (distinct
prefixes per app; backfill the missing `business` ids) or join on `(app, element)` like the A11
mapping does. Verify this is still true before relying on it — a later round may have already
fixed it.
