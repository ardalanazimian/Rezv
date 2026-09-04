---
name: founder-reviewer-directives-channel
description: The founder-side reviewer's rulings/decisions on gate design land as numbered files in docs/audit/directives/NNN-*.md — check there before trusting a coordinator's paraphrase of a ruling
metadata:
  type: reference
---

During the round-20 doc-staleness fence-fix work (2026-09-04), a coordinator message paraphrased a
founder-side reviewer's ruling on the fence-fix coverage trade-off. The verbatim source turned out to
be committed at `docs/audit/directives/004-fence-fix-coverage-ruling.md`. Cross-checking it against
the paraphrase found it accurate (no variance to report that time), but the directive contained
additional context the paraphrase didn't carry (e.g. §4's unrelated running scorecard on other
findings, §5's list of still-open items).

**Why this matters:** per Constitution rule 1 (zero-trust in every direction), a coordinator's summary
of a founder/reviewer decision is a claim, not the decision itself. When a task references "a ruling"
or "a directive," check `docs/audit/directives/` for a numbered file before treating the paraphrase as
complete — other directives observed in that folder as of this session: `001-channel-bootstrap-and-round20-partial.md`,
`002-fc-closed-handoff-draft-audit.md`, `003-founder-authorizations-g1-g3.md`,
`004-fence-fix-coverage-ruling.md`. This directory is actively growing; expect more.
