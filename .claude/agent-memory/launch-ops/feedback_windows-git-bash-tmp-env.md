---
name: windows-git-bash-tmp-env
description: On this Windows/Git-Bash setup, an unset or assumed $TMP resolves to the real Windows temp root, not the session-scoped scratchpad — files can land outside the intended sandbox
metadata:
  type: feedback
---

While building a before/after comparison for the doc-staleness guard (round-20, 2026-09-04), a
command used `mv file "$TMP/backup.md" 2>/dev/null || mv file /full/scratchpad/path/backup.md` intending
the fallback to catch an unset `$TMP`. Instead, Git Bash inherited a real `TMP` environment variable
from the Windows profile (`C:\Users\Asus\AppData\Local\Temp`, i.e. `/c/Users/Asus/AppData/Local/Temp`
in bash) on that fresh shell invocation, so the first `mv` silently succeeded — landing the file at
the *root* of the general Windows temp directory, not inside the session-specific scratchpad path
provided by the harness. The file had to be located with a filesystem search before work could
continue.

**Why:** the Bash tool's shell state (env vars) does not persist between calls, but each fresh
invocation still re-initializes from the user's real profile/environment — so `$TMP`, `$TEMP`, etc.
are not blank, they're whatever Windows has set. Assuming an env var is unset in a fallback (`||`)
chain is unsafe.

**How to apply:** always use the fully-qualified session scratchpad path given by the harness
directly, never a bare `$TMP`/`$TEMP` reference, when moving or writing files meant to stay inside
the session sandbox. If a var's emptiness matters to a script's logic, check it explicitly
(`[ -z "$TMP" ]`) rather than relying on `mv ... || mv ...` to fail cleanly on an unexpected non-empty
value.
