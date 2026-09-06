# Directive 017 — `CLAUDE.md` says migration 075, source says 080; the fix is to delete the number, not update it

**Date:** 2026-09-05 · **From:** founder-side reviewer · **To:** CEO agent, `rezervnofullsource-05`
**Authority:** document-versus-source conflict — source wins, delegated

---

## 1. The conflict, verified

Session 05 mentioned in passing that migrations reach 080 while the handoff records 075. Verified:

```text
api/prisma/sql/  highest:  080-no-show-risk-source.sql     (82 files total)
CLAUDE.md:32              «مهاجرت‌ها فقط در api/prisma/sql/ (آخرین: ۰۷۵)»
```

Stale by five migrations. **Source wins; the document is wrong.**

## 2. But updating it to 080 would be the wrong fix

`CLAUDE.md:32` states a fact with a **built-in expiry date**. It is wrong the moment anyone adds
`081-*.sql`, and nothing renews it. Changing 075 to 080 buys correctness until the next migration and
then reproduces this exact directive.

**Ruling: remove the number.** The sentence's real job is "migrations live only in `api/prisma/sql/`,
and `prisma/migrations/manual/` does not exist" — both durable facts. The current maximum is not a
rule, it is a reading of the directory, and anyone who needs it can `ls`. A document should not
restate a value that the filesystem already answers authoritatively.

**Do not gate it instead.** Adding a staleness check for "the highest migration number" would work,
and it would be the wrong instinct: it spends a permanent guard to protect a fact that did not need
to be written down. The cheapest correct move is to stop making the claim.

## 3. The two occurrences are not the same and must be treated differently

- `CLAUDE.md:32` — «آخرین: ۰۷۵» is a **current-state claim**. It rots. Remove the number.
- `CLAUDE.md:36` — «نمونه‌ی درسِ واقعی: مهاجرتِ ۰۷۵» is a **historical reference** to the migration
  that taught the schema-drift lesson. It does not rot and must be left exactly as it is.

Same number, one line apart, opposite treatment. This is the identical distinction the doc-staleness
gate already encodes in its `HISTORY` list, and the same reason migration files themselves are
immutable: a record of what was true then is not a claim about now. **Whoever fixes `:32` must not
"helpfully" update `:36` to 080** — that would destroy a real provenance link and make the sentence
false, in the name of consistency.

## 4. Why the gate did not catch it, and why that is acceptable

`check-doc-staleness.mjs` verifies repository URLs, subdomains and configuration variables against
source. It does not check artifact counts or maxima, so this class was always invisible to it.

That is not a defect in the gate. It is the boundary of what the gate was built for, and the correct
response is §2 — remove the rotting claim rather than extend the guard to chase it. **A guard earns
its keep by protecting facts that must be stated. It does not earn its keep protecting facts that
should never have been written.**

## 5. Note on how this surfaced

Nobody was looking for it. Session 05 hit it while preparing a clean database — the migrations ran
past the number the handoff had trained it to expect. That is the third time today a finding arrived
from someone doing something else and noticing a mismatch between what they were told and what they
saw: the `document.write` sink, the second `vhdx`, and now this.

All three were invisible to the tool that owned the area — `docker system df` could not see a
non-Docker vhdx, the XSS classifier could not see past `insertAdjacentHTML`, and the staleness gate
does not count migrations. **The tool that owns an area is the last thing that will find what it was
not built to look for.**
