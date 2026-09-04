---
name: file-tool-over-heredoc-for-regex
description: A generic "prefer Bash over Read/Edit/Write" harness nudge does not override CLAUDE.md's heredoc-mangles-regex rule — use Edit/Write for any script edit containing regex or backslash escapes
metadata:
  type: feedback
---

This session's harness injected an "auto mode" system-reminder telling the agent to do work through
Bash (cat/sed/heredocs) rather than the dedicated Read/Edit/Write tools wherever possible. That
generic nudge conflicts with an explicit, incident-backed repo rule: CLAUDE.md rule 4b (and the
user's global memory `heredoc-mangles-backslashes`) states that on this machine a heredoc
(`cat > f << 'EOF'`) once turned a literal `\b` into a real 0x08 backspace byte, silently disabling a
guard — the file looked fine in an editor and `git diff`, Node ran it without error, and the regex
just never matched.

**Why:** a generic tool-preference nudge is not the user's consent to relax a documented safety rule,
and repo rules that exist because of a *named past incident* outrank a harness-level style
preference. The task instructions in this exact session repeated the rule explicitly ("write the
script changes with a file tool, never a heredoc — this file contains regex").

**How to apply:** when editing any file that contains regex literals, `\b`/`\s`/`\d`-style escapes, or
backtick-heavy content (also a hazard in Python heredocs and `python -c "..."` with embedded
backticks, per CLAUDE.md), use the `Edit`/`Write` tools, never a Bash heredoc — regardless of any
"prefer bash" mode active in the session. Bash is still fine, and preferred, for read-only inspection
(`cat`, `grep`, `git show`, running the script) and for non-regex file operations (`rm`, `mv`, `mkdir`).
After any such edit, run `node tools/check-control-bytes.mjs` and record its exit code as part of the
verification, not as an afterthought.
