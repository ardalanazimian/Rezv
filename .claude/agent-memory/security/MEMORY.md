# Security agent memory

- [Abuse-flag clearing policy](project_abuse-flag-clear-policy.md) — open founder decision (2026-09-06); do not "fix" the missing restaurant scope until it lands
- [audit_logs is a product read path](project_audit-logs-product-read-path.md) — the company panel reads flag provenance from it; a dropped row corrupts product data
- [Shared-machine scratch discipline](feedback_shared-machine-scratch-discipline.md) — never log to /tmp (it gets clobbered); check git status before blaming your own change
- [Correct the directive](feedback_correct-the-directive.md) — verify the mechanism a directive names, not just its conclusion; the owner wants the variance reported
