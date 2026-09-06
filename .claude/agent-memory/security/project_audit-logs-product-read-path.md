---
name: audit-logs-is-a-product-read-path
description: audit_logs is not only a compliance archive — the company panel reads flag provenance from it, so a dropped audit row corrupts product data
metadata:
  type: project
---

`audit_logs` in this API is **read back by product code**, not just archived:
`listFlaggedAbuseUsers` (`api/src/lib/fraud.ts`) derives `flagged_by`, `reason` and
`restaurant_id` for the company panel from the latest `security.abuse_flag` row per user.

**Why this matters:** `audit()` (`api/src/lib/audit.ts`) is deliberately best-effort — it
never throws, and a failed DB insert used to be a silent `log.warn`. Because the same
table feeds the panel, a lost row does not degrade to "slightly less logging"; it
degrades to **wrong provenance shown to an operator**. That reframing is what justified
raising the new `AuditWriteFailing` alert to `severity: critical` rather than `warning`.

**How to apply:** when weighing whether an audit-write failure is "just observability",
check whether the action's audit rows are read anywhere. For `security.abuse_flag` they
are. Treat proposals to make audit writes lossier (batching, sampling, fire-and-forget
queues) as product-data changes, not logging changes.

Related: [[abuse-flag-clear-policy]]
