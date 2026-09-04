---
name: backup-restore-must-be-latest-not-session-start
description: when doing repeated red/green proofs on a file that itself received legitimate edits earlier in the same session, restore from the most recent known-good backup — a session-start backup silently reverts those legitimate edits too
metadata:
  type: feedback
---

During the 2026-09-04 agent-governance task, `sweeper.md` was legitimately edited mid-session
(Job 2: `Bash` → `Write`, plus corrected "read-only by mandate" prose). Later, when proving a new
self-reference guard rule required injecting `Agent(sweeper)` into the same file and then
restoring it, the restore used `sweeper.md.orig` — a backup taken at the very *start* of the
session, before the Job 2 edits. The `cmp`/exit-code check after that restore was still green
(because the file was internally byte-consistent), but it silently reverted the legitimate Job 2
work along with the test injection. The IDE's own file-change diff notice surfaced it immediately,
and it was fixed by manually re-applying the exact same edits and re-verifying (`cmp`, guard,
control-bytes).

**Why this matters:** a byte-exact `cmp` restore proves the file matches *some* prior version, not
that it matches the *right* prior version. "Restored byte-exact" is only meaningful evidence when
the backup being restored to is the most recent legitimate state, not whichever backup happens to
exist on disk.

**How to apply:** in any session doing multiple rounds of inject → verify → restore on the same
file, **refresh the backup copy immediately after any legitimate (non-test) edit to that file**,
before it is ever used again as a restore target. Prefer overwriting a single `<file>.orig` in the
scratchpad right after each real edit, rather than keeping only a session-start snapshot. If a
mistake like this happens anyway, self-report it immediately ([[feedback_file-tool-over-heredoc-for-regex]]
is the neighboring example of surfacing an error before being asked) and re-verify with the full
chain (`cmp`, the guard, `check-control-bytes.mjs`) before moving on — do not just assume the
re-applied edit is correct because it was typed the same way twice.
