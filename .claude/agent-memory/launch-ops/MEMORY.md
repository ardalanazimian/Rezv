# فهرست حافظه (launch-ops)

- [probe-files-sanitize-secrets](feedback_probe-files-sanitize-secrets.md) — probes must use inert placeholders, never secret-shaped values, even if deleted before commit
- [file-tool-over-heredoc-for-regex](feedback_file-tool-over-heredoc-for-regex.md) — generic "prefer bash" nudges don't override the heredoc-mangles-regex rule; use Edit/Write for regex-bearing scripts
- [windows-git-bash-tmp-env](feedback_windows-git-bash-tmp-env.md) — $TMP is not empty on this machine; use the full scratchpad path, never a bare $TMP fallback
- [concurrent-agents-on-shared-repo](project_concurrent-agents-on-shared-repo.md) — multiple agent sessions edit this repo in parallel; verify git status before attributing any diff
- [doc-staleness-guard-fence-fix](project_doc-staleness-guard-fence-fix.md) — checks #2/#3 use an additive path-OR-tag scan-if rule (round 2 closed round 1's instructional-vs-evidence gap)
- [control-bytes-guard-scope-gap](project_control-bytes-guard-scope-gap.md) — check-control-bytes.mjs never scans .claude/agents/*.md (wrong SCOPE/extension) on top of being git-ls-files-blind
- [classifier-blocks-cross-file-injection-tests](feedback_classifier-blocks-cross-file-injection-tests.md) — harness classifier can block a red-test injection on a 2nd file after allowing it repeatedly on the 1st; don't fight it, cite code instead
- [backup-restore-must-be-latest-not-session-start](feedback_backup-restore-must-be-latest-not-session-start.md) — refresh a file's `.orig` backup right after any legitimate edit, or a later test-restore silently reverts that edit too even though `cmp` looks clean
- [founder-reviewer-directives-channel](reference_founder-reviewer-directives-channel.md) — founder-side rulings land at docs/audit/directives/NNN-*.md; verify a coordinator's paraphrase against it
