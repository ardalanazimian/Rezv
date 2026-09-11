# Proposal — the constitution's `git diff --cached` rule is defeated by its `--name-only` form

**Date:** 2026-09-11 · **Session:** Deputy `rezv-66 [9be89e]` (sessionId `4123addc…`)
**Ordered by:** CEO `rezv-0c [6a8557]` — "take your own proposal; write it with a real measured example."
**Status: DRAFTED, NOT APPLIED — waiting for the founder's direct yes.**

**Why not applied:** the target is `.claude/skills/rezervno-audit-constitution/SKILL.md`, an
agent-instruction file loaded into every session, the same class as `CLAUDE.md`. I do not edit
instruction files on a peer's order, even a benign one. Directive 022 §8 records `-05` holding the
same line on `CLAUDE.md`, and the Reviewer called it correct. Agents have edited this file before
(`efb44e9`…`a45d4c6`, 2026-09-10), so this is not a claim that nobody may. It is a question of whose word
authorises *this* edit. **One word from the founder, and the two replacements below apply exactly.**

---

## The gap

`SKILL.md:77-82` already records a same-file collision (2026-09-10) and names `git diff --cached` as the
check that a pathspec cannot give you. `SKILL.md:152` repeats it. **Neither says that the most
natural way to run that check, `--name-only`, cannot see the failure it exists for.** A second
session's edit to the same file produces the same filename, so the output is identical whether you
changed one row or someone else changed another beside it.

## The measured example (2026-09-11, commit `6c04db0`)

Two sessions edited their own rows of `docs/audit/prompts/ROUTING.md` in the shared checkout: the
Deputy and the Reviewer (`rezv-8d`).

```text
before staging:  git diff --stat -- docs/audit/prompts/ROUTING.md
                 → 1 file changed, 2 insertions(+), 2 deletions(-)      ← intended: 1 and 1. Ignored.
after staging:   git diff --cached --name-only
                 → docs/audit/prompts/ROUTING.md                        ← same output for 1 row or 2
committed:       git show 6c04db0 -- docs/audit/prompts/ROUTING.md
                 → two rows changed: Reviewer and Deputy
```

- **The Reviewer made the identical error the same minute.** Its index check was also `--name-only`,
  and its "did only my row change?" count ran *after* `6c04db0` had absorbed the diff, so it returned
  0 and told it nothing.
- **The only signal present was the line count**: 2 and 2 against an intended 1 and 1. It came from
  `--stat` before staging, and it was not acted on.
- **Damage:** none to content. The Reviewer's row was byte-identical, well-formed, and nothing was lost.
  **The defect was attribution.** Its change sat under a commit whose message said "only my row".
  Corrected in `870541d`. No force-push, no revert.

## Exact replacements (mechanical; nothing else in the file changes)

**1. `SKILL.md:81-82`**, current:

```
  `git show --stat` sees only the file they expected. On a shared tree, `git diff --cached` before
  committing is the check that pathspec cannot give you.
```

**replace with:**

```
  `git show --stat` sees only the file they expected. On a shared tree, `git diff --cached` before
  committing is the check that pathspec cannot give you — **read as content, not as names.**
  **`git diff --cached --name-only` defeats it:** a second session's edit to the same file prints the
  same filename. Measured 2026-09-11 (`6c04db0`): the Deputy and the Reviewer both ran `--name-only`
  in the same minute, both saw only `ROUTING.md`, and the commit carried both rows. The one signal
  present was a line count — `2 insertions(+), 2 deletions(-)` against an intended 1 and 1 — and
  it was ignored. Use `git diff --cached -- <file>` and read which lines changed, or count `+`/`-`
  lines against what you intended to change.
```

**2. `SKILL.md:151-153`**, current:

```
`git diff --cached` before every commit — not `git show --stat`, which shows you the file you
expected and hides that its contents are wider than your change.
```

**replace with:**

```
`git diff --cached -- <file>` before every commit, **read as content** — not `--name-only` and not
`git show --stat`, both of which show you the file you expected and hide that its contents are
wider than your change.
```

## Two corrections to the order, for the record

- **The order cites directive 049 as the source of the reason.** 049 contains none of `name-only`,
  `--stat`, `cached`, `staged` (`grep -i` → no match). The reason comes from the Reviewer's message
  and the `6c04db0` incident, not from 049.
- **The order paraphrases the reason as "`--stat` shows what is really staged, `--name-only` does not."**
  That contradicts this file's own `:81` and `:152`, which warn that `--stat` shows only the file you
  expected. Precisely: `--stat`'s *line counts* carried the only signal in this incident, but only
  when compared against the intended count. Its file list is as blind as `--name-only`. The
  replacement text above says that, not the paraphrase.
