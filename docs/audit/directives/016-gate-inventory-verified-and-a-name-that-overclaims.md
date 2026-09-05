# Directive 016 — `gate-inventory.mjs` standard-7 UNKNOWN closed; but its *name* over-claims

**Date:** 2026-09-05 · **From:** founder-side reviewer · **To:** CEO agent
**Closes:** the standard-7 UNKNOWN I carried in directives 005, 007, 008 and 012 without resolving

---

## 1. Standard 7 — satisfied. Closed by reading and then by running.

I named this file four times as "the most natural place in this repo for standard 7 to be violated by
accident" and never checked it. Checked now, both ways.

**By reading.** It runs nine gates: `agent-charter`, `control-bytes`, `doc-staleness`,
`classic-scripts`, `fonts`, `schema-drift`, `deploy`, `send`, `decision-none`. Two of those looked
alarming and neither is:

- `send` → `gate-send.mjs`, which I read in full for directive 010. Purely evaluative. It authorises;
  it never sends.
- `deploy` → `gate-deploy.mjs`, 70 lines, which I had **not** read. Zero matches for `spawnSync`,
  `execSync`, `fetch(`, any URL, `writeFileSync`, `vercel` or `deploy(`. It deploys nothing.

**`EXCLUDED_GATES` is real, not decorative** — three entries, each with a reason, and the first is
exactly right: `tools/restore-drill.sh` is excluded because it genuinely performs
`pg_dump` / `CREATE DATABASE` / `pg_restore` / `DROP DATABASE`, and the exclusion **cites that file's
own statement** that executor and interpreter are deliberately separate. That is the same principle
I verified independently at `gate-destructive.mjs:13-15`. Three files, one consistent understanding
of standard 7, written before anyone audited for it.

**By running it.** `node tools/gate-inventory.mjs` → exit 0, real table, real exit codes.

**And it closes directive 009 §7 in a live run:** `schema-drift` reports **`COULD_NOT_RUN (exit=2)`**
— not RED, not GREEN. The distinction I directed be built is working in production, and a missing
`psql` no longer wears the costume of a drift verdict.

## 2. The finding executing it produced, that reading it did not

**`gate-inventory.mjs` exits 0 while reporting RED gates.** Observed: two RED rows in the table, tool
exit code 0.

That is *correct* for an inventory — it reports, it does not judge, and its header says so plainly:
«بدونِ allowlist: این ابزار **نمی‌داند** هر گیت باید چه نتیجه‌ای بدهد». I am not asking for it to
change behaviour.

**The problem is its name.** Every other `tools/gate-*.mjs` in this repo denies by exiting non-zero:
`gate-send.mjs` (`deny()` → `exit(1)`), `gate-destructive.mjs` (same), `gate-decision.mjs`. In this
repo, `gate-*` has come to mean *this exits non-zero when the thing it guards is not satisfied.*
`gate-inventory.mjs` is the one file with that prefix that **always exits 0**.

**The failure mode is concrete and cheap to reach:** someone adds `node tools/gate-inventory.mjs` to
CI or to the `CLAUDE.md` list, reasonably expecting the prefix to mean what it means on its four
siblings, and gets a step that can never fail. A permanently-green CI step that looks like
enforcement is this repo's oldest documented defect — it is the `--check` XSS guard and the
`boot-path` job that built no server, both recorded in `CLAUDE.md` rule 2.

**Directive:** rename it to something that does not promise enforcement — `report-gate-status.mjs`
or `tools/inventory/gates.mjs`. Cheap, reversible, no behaviour change. If you would rather keep the
name, then it must exit non-zero when any gate is RED — but I recommend the rename, because the
tool's judgement-free design is its virtue and adding a verdict would spoil it.

**This is the over-claim class in a ninth medium: a filename.** The prior eight were a code comment,
a test name, a report headline, a UI state label, a commit message, a reviewer's sign-off, a security
classifier's output, and a risk estimate. A filename is the cheapest of all of them to fix and the
easiest to inherit, because nobody re-reads a filename critically — they read the prefix and assume
the convention holds.

## 3. What this leaves open

Still unexamined by me, and I am no longer going to list these without either checking them or saying
plainly that I will not: the constitution 4c text (including the two rules written from my own
framing, which I have never read as committed text — my own words are the *last* thing I should
accept unverified), `M0-EVENT-SUBSTRATE.{md,json}`, `audit/round-20/ALERTS-GAP.md`, and `docs/ml/`.

The waitlist defect at 12/12 remains the worst known live defect. F1 still blocks the walk-in PR.
