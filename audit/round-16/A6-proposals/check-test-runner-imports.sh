#!/bin/sh
# Every api/tests/*.test.mts must be imported by tests/_all.runner.mts, otherwise `npm test` silently skips it.
# Proposed CI step (job `test`, before `npm test`):  sh tools/check-test-runner-imports.sh
set -e
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/.." && pwd))"; cd "$ROOT/api"
ls tests/*.test.mts | sed 's#^tests/##' | sort > /tmp/_runner_files.txt
grep -oE "^import '\./[^']+'" tests/_all.runner.mts | sed -E "s#^import '\./##; s#'\$##" | sort > /tmp/_runner_imports.txt
MISSING=$(comm -23 /tmp/_runner_files.txt /tmp/_runner_imports.txt)
DUPES=$(sort /tmp/_runner_imports.txt | uniq -d)
GHOST=$(comm -13 /tmp/_runner_files.txt /tmp/_runner_imports.txt | grep -v '^helpers/' || true)
rm -f /tmp/_runner_files.txt /tmp/_runner_imports.txt
if [ -n "$MISSING" ] || [ -n "$DUPES" ] || [ -n "$GHOST" ]; then
  [ -n "$MISSING" ] && { echo "✗ test files NOT imported by _all.runner.mts (npm test never runs them):"; echo "$MISSING" | sed 's/^/    /'; }
  [ -n "$DUPES" ]   && { echo "✗ duplicate imports in _all.runner.mts:"; echo "$DUPES" | sed 's/^/    /'; }
  [ -n "$GHOST" ]   && { echo "✗ imports that point to non-existent files:"; echo "$GHOST" | sed 's/^/    /'; }
  exit 1
fi
echo "✓ all $(ls tests/*.test.mts | wc -l | tr -d ' ') test files are imported exactly once by _all.runner.mts"
