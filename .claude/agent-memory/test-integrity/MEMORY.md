# Memory index — test-integrity

- [Slot-lock fail-open verdict](project_slot_lock_failopen_verdict.md) — "DB is the source of truth" is TRUE, via EXCLUDE + SERIALIZABLE; the isolation half was untested
- [Walk-in vs merged secondary table](project_walkin_merged_secondary_hole.md) — CONFIRMED under real concurrency (6/6): createWalkin+merge race double-books; P0 scope, awaiting architect sign-off
- [Gate falsifiability practice](feedback_gate_falsifiability_practice.md) — seven traps: green-but-hollow tests, stalls diagnosed from raw output, and diagnostics that lie (wrapper exit codes, pipelines, netstat)
