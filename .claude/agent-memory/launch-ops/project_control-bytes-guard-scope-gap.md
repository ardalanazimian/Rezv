---
name: control-bytes-guard-scope-gap
description: tools/check-control-bytes.mjs never scans .claude/agents/*.md (wrong extension, wrong SCOPE dir) on top of being git-ls-files-blind to untracked files — unresolved, reported to founder 2026-09-04
metadata:
  type: project
---

`tools/check-control-bytes.mjs` guards against invisible control bytes (the `\b` → `0x08` heredoc
incident, [[feedback_file-tool-over-heredoc-for-regex]]). Read it end to end during the 2026-09-04
agent-governance task (`audit/launch-hardening` branch) and found two independent coverage gaps,
both still open:

1. **`SCOPE` never includes `.claude/agents/`.** The array is
   `['tools/', '.github/workflows/', 'deploy/', 'api/prisma/', 'cron/', 'backup/']` — agent
   definition files live outside every one of those paths.
2. **`RUNNABLE` is `/\.(mjs|js|ts|mts|sh|yml|yaml|sql|py)$/`** — `.md` is not in it. Even if agent
   files lived under a scoped directory, the extension filter would still skip them.
3. Independently of both of the above: the guard enumerates via `git ls-files`, so it is blind to
   **untracked** files regardless of path or extension (proven directly this session by editing an
   untracked `.claude/agents/reviewer.md` and confirming it never appeared in the guard's file list).

**Why this matters:** agent `.md` files are not "prose" in this repo — the `tools:`/`skills:`
frontmatter is machine-parsed by `tools/check-agent-charter.mjs`, and a control byte inside a
frontmatter regex-adjacent value would be just as silently disabling as it was in a `.mjs` script.
Nothing currently catches that class of corruption in an agent file.

**How to apply:** when editing any `.claude/agents/*.md` file (or any other `.md`/config file
outside `check-control-bytes.mjs`'s `SCOPE`/`RUNNABLE`), do not rely on that guard for a clean
bill of health — verify bytes directly (e.g. a small standalone Node script that `readFileSync`s
the exact path from argv, bypassing `git ls-files` entirely) and say so explicitly in the report,
the same way the founder's own task description called out the untracked-file blind spot. Don't
expand `check-control-bytes.mjs`'s `SCOPE`/`RUNNABLE` on your own initiative either — it wasn't
the file the 2026-09-04 mandate authorized touching (that was `tools/check-agent-charter.mjs`
plus four agent `.md` files); flag the gap as a finding for the founder/CEO to assign, don't
quietly patch a guard nobody asked you to change.
