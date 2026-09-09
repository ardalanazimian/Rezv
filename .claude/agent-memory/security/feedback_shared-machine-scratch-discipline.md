---
name: shared-machine-scratch-discipline
description: Several agent sessions edit this tree concurrently — log to the scratchpad not /tmp, and never explain a red suite before re-running on a settled tree
metadata:
  type: feedback
---

Write run logs to the session scratchpad, never `/tmp`. And when a full-suite run goes red,
**re-run it on a settled tree before offering any explanation for the failures.**

**Why (two measured incidents, both 2026-09-06):**

1. A full-suite log written to `/tmp/FULL.log` was **clobbered by another session using the
   same filename**. `grep -n` reported a summary at line 4369; `wc -l` on the same path later
   returned 2643. Counts already read off it were not from my run.

2. Worse, and the real lesson: I reported 5 suite failures as "load-dependent under
   full-suite concurrency" and located them in another session's files. **Both readings were
   wrong.** Other sessions were actively editing `queue.ts`, `worker.ts`, `sms.ts`,
   `notify.ts` *while my runs were in flight* — `git status` showed those modifications only
   afterwards. Once the tree settled, the same DB and same command gave **1617/1617, exit 0**.
   A parallel agent hit related reds from a different cause entirely (a skipped
   `prisma/test-schema-fixups.sql` when building its scratch DB).

**How to apply:** a red suite on a shared tree has at least three candidate causes — your
change, a concurrently edited file, or your own DB build. Distinguish them with evidence
before reporting: run `git status --porcelain` (does it list files you did not touch?), run
the failing file alone and record its exit code, verify your scratch DB matches the handoff
recipe, then re-run the suite. "Load-dependent flakiness" is a conclusion that needs proof,
not a default explanation — reaching for it once cost a wrong attribution that a coordinator
had to correct. UNKNOWN is the honest label until the re-run exists.

Related: [[correct-the-directive]]
