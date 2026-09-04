---
name: probe-files-sanitize-secrets
description: Even temporary/to-be-deleted probe or test-fixture files must use obviously-inert placeholder values, never secret-shaped strings
metadata:
  type: feedback
---

When constructing a throwaway probe/fixture doc to exercise a guard (e.g. a fake `JWT_ACCESS_SECRET=...`
line to prove a doc-staleness check fires), do not use a real-looking secret-shaped value (e.g. a
32-char alphanumeric string) even though the file is temporary and will be deleted before the task
ends.

**Why:** the coordinator flagged this mid-task (round-20 doc-staleness fence fix, 2026-09-04): the
repo's no-committed-secrets rule has no fake-value exemption, and secret scanners don't read intent.
A run that gets interrupted, or a scanner that trips on the probe before cleanup, costs far more than
the ~30 seconds it takes to use an unmistakably inert placeholder up front.

**How to apply:** any time a probe/fixture needs a variable *name* to exist for a check to key on, the
*value* is almost always irrelevant to what's being proven — use something like
`PLACEHOLDER_NOT_A_SECRET` (short, obviously not a credential, no entropy an heuristic would flag).
Apply the same caution to anything else in a probe that looks like real infrastructure: hostnames,
tokens, connection strings. A probe's job is to make the gate speak, not to look realistic.
