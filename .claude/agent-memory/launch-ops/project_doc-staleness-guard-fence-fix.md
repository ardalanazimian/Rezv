---
name: doc-staleness-guard-fence-fix
description: tools/check-doc-staleness.mjs checks #2/#3 use an additive path-OR-tag scan-if rule for fenced blocks (round-20, 2026-09-04) — not a blanket fence exemption
metadata:
  type: project
---

`tools/check-doc-staleness.mjs` has three checks (repo address, unserved subdomain, unknown env var).

**Round 1 (2026-09-04, `audit/round-20/STALENESS-FENCE-FIX.md`):** checks #2/#3 were flagging shell
variables inside fenced (```/~~~) evidence transcripts as config claims (`EXIT`, `REAL_NPM_TEST_EXIT`,
`JWT_ACCESS_SECRET`). Fixed with `fenceMask()` that made checks #2/#3 skip **every** fenced block,
unconditionally. This reopened a different gap: a copy of `docs/recovery/BASELINE-TEST-STATUS.md`
with `DATABASE_URL` renamed inside its fenced setup recipe went from caught (`exit=1`) to missed
(`exit=0`) — the fix couldn't distinguish "this happened" (transcript) from "do this" (runbook), both
being identical fence syntax. Reported honestly rather than hidden or patched with a heuristic.

**Round 2 (same day, `audit/round-20/STALENESS-FENCE-FIX-2.md`), ruled by the founder-side reviewer in
`docs/audit/directives/004-fence-fix-coverage-ruling.md`:** the blanket exemption was replaced with an
**additive, purely OR-based** scan-if rule — closes the round-1 gap without reopening round-1's false
positives:

- Scan a fenced block if **(a)** its file is in `EXEC_PATHS` (`docs/recovery/`, `docs/DEPLOYMENT.md`,
  `docs/ENVIRONMENT.md`, `docs/VERCEL-DEPLOYMENT-CHECKLIST.md`, `docs/DEPLOY_API_VERCEL.md` — any tag,
  including none), **or (b)** the block's info-string is in `EXEC_TAGS`
  (`bash sh zsh yaml env dotenv ini dockerfile make`, case-insensitive) — **wherever it appears**, not
  just inside the path set. Skip otherwise. **Never subtractive** — no tag can remove scope a path
  granted, and vice versa. This is deliberate: an earlier subtractive phrasing would have let someone
  type ` ```text ` on a stale recipe inside `docs/recovery/` to silently bypass it.
- Every skipped block is counted **and printed**, split by reason (`skipped-as-non-executable` vs
  `skipped-untagged-outside-the-set`), per file and in the summary line — a skip nobody can see is the
  same silent escape hatch Constitution rule 4 forbids.
- This is a *typed contract*, not an allowlist: authors already tag evidence `text`/`mermaid`/etc and
  runnable recipes `bash`/`sh`/etc — the rule reads that existing convention rather than inventing a
  recipe-vs-transcript heuristic (which would itself be allowlist-shaped, forbidden by 4b).

**Residual, accepted (not a gap to silently fix — see §8 of round-2 report for named owners):**
(1) inside `EXEC_PATHS`, a genuine evidence transcript pasted into any fence will still be scanned and
could false-positive — the fix there is to move the transcript to a report, not exempt the block;
(2) a `bash`/`sh`/etc-tagged block is in scope **everywhere**, not just in `EXEC_PATHS` — this is a net
positive today (it caught four real "run this" recipes in `STATE-2026-08-26.md`, `DATABASE-OPS.md`,
`docs/PROJECT_KNOWLEDGE.md`, `docs/adr/0002-*.md` that the named path list didn't enumerate), but the
flip side is an evidence transcript mistakenly tagged `bash` instead of `text` loses round-1's
protection. **Tag discipline now matters for authors, not just for the gate** — surface this if a
future false positive traces back to a mis-tagged transcript.

**How to apply:** if extending `EXEC_PATHS`/`EXEC_TAGS` again, re-run the round-2 report's
before/after diagnostic (round-1-semantics vs round-2-semantics on the identical live corpus) rather
than trusting a stated tag-frequency count — the corpus is live (concurrent agents add `docs/` files
constantly) and one such count was already off by 4x (`bash`: claimed 11, measured 45) purely from
drift, not error.
