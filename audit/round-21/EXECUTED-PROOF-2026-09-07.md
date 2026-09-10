# Round 21 — Executed proof: the XSS sink gate cannot go red for the truncation class

**Date:** 2026-09-07 · **By:** CEO agent (session `rezv-b0`) · **Status:** EXECUTED, not reasoned

## 0. Environment — recorded because a measurement carries a machine, not just a timestamp

```text
host          DESKTOP-I0P8973
os            Microsoft Windows 10 Pro, build 19045
node          v20.20.2      (installed this session via winget OpenJS.NodeJS.20, exit 0)
npm           10.8.2
node_modules  ABSENT — not needed; both tools import only node: builtins
              plus the repo-local ./internal/simple-glob.mjs
repo root     C:\Users\Ardalan\Desktop\rezv\Rezv
branch        main @ 96322a0   (origin/audit/launch-hardening is 32 commits ahead)
docker        29.7.2 installed, daemon DOWN, and NOT on PATH
```

This is **not** the machine that produced the round-20 artifacts (`audit/round-20/GATE-HONESTY.md`
records host `DESKTOP-8DAJNO5`, root `c:/Users/Asus/Desktop/rezv3/rezervnofullsource`, node
`v24.20.0`). Nothing in round 20 was re-established here except what is executed below.

## 1. The claim under test

`tools/xss-sink-audit.mjs` keys a manual-review override on `sinkHash(expr, sourceLine)`
(`:465-468`), and both inputs are drawn from the sink line alone. For a sink of the form
`x.innerHTML = ` + backtick-template, `grabExpression` takes the **naive** branch (`:143-150`) —
a flat scan to the first unescaped backtick, with no `${...}` or nesting awareness — because
`matchingParen`, which *is* nesting-aware (`:73-93`), only runs when the RHS opens with `(`
(`:139-141`).

Therefore any escaping that sits after the first nested backtick is **outside the hashed identity**,
and removing it cannot change the key.

## 2. The injection

Target: `apps/company/js/badges.js`.

```text
:21   document.getElementById('v-badges').innerHTML=`      ← sink, opens with a backtick
:26   ${BADGES_LIST.length?`<div class="tier-grid">${BADGES_LIST.map(b=>`   ← FIRST nested backtick
:27   ...esc(b.color...)      ← every esc() in this template
:29   ...esc(b.name)             sits AFTER the truncation
:30   ...esc(b.key)              point at :26
:31   ...esc(b.description)
:33   ...esc(b.id) esc(b.name)
:34   ...esc(b.id) esc(b.name)
```

Edit applied — **in place, line count preserved** (131 lines before and after), so no line number
in `tools/xss-sink-audit-report.json` shifts and the artifact-staleness check cannot fire for an
unrelated reason:

```diff
-          <div class="tier-name">${esc(b.name)}${b.isActive?'':' <span class="badge">غیرفعال</span>'}</div>
+          <div class="tier-name">${b.name}${b.isActive?'':' <span class="badge">غیرفعال</span>'}</div>
```

`b.name` is an API-supplied field. After this edit the panel interpolates it raw into `innerHTML`.
**This is a real, exploitable XSS hole, not a violation that merely looks like one.**

## 3. Result — three runs, three real exit codes

| # | Tree state | Command | Exit | unsafe | review | payload_not_captured |
|---|---|---|---|---|---|---|
| 1 | clean | `node tools/xss-sink-audit.mjs --check` | **0** | 65 | 20 | 0 |
| 2 | **XSS hole present** | `node tools/xss-sink-audit.mjs --check` | **0** | 65 | 20 | 0 |
| 3 | reverted | `node tools/xss-sink-audit.mjs --check` | **0** | 65 | 20 | 0 |

Run 2 also printed `✓ آرتیفکتِ ممیزیِ XSS با کد هماهنگ است` — the artifact agreed with the code
while the code was vulnerable. **Not one counter moved.**

Per `rezervno-audit-constitution` §3: *a gate that cannot go red is a defect.* This one cannot go
red for this class. Confirmed, not suspected.

## 3b. Reproduced on `audit/launch-hardening` — the branch that is actually shipping

The runs in §3 were on `main`. Because `main` is 32 commits behind, a finding proven only there is
easy to dismiss. So the same injection was repeated in a separate git worktree checked out at
`origin/audit/launch-hardening` (tip `1f724c8`), leaving the `main` checkout untouched.

`apps/company/js/badges.js` is **byte-identical on both refs** (`git diff main
origin/audit/launch-hardening -- apps/company/js/badges.js` → empty, exit 0), so the injection is the
same edit.

| # | Tree state | Exit | unsafe | review | dead overrides |
|---|---|---|---|---|---|
| 1 | clean | **0** | 65 | 20 | 67 of 87 |
| 2 | **XSS hole present** | **0** | 65 | 20 | 67 of 87 |
| 3 | reverted | **0** | 65 | 20 | 67 of 87 |

Identical outcome, including the line `✓ آرتیفکتِ ممیزیِ XSS با کد هماهنگ است`. **The defect is not
an artefact of the stale branch.** It is live on the branch heading for launch.

Note the override counts differ by ref and both are correct for their own population: **65 of 85 on
`main`, 67 of 87 on `audit/launch-hardening`** (the branch adds two overrides). Any future comparison
of those two numbers is comparing two different sets, not finding a discrepancy — the same trap
directive 022 §4 records for the 448/224 split.

## 4. No other gate covers it either

```text
node tools/xss-escaping-regression.mjs   → exit 0
```

It passes because it never looks. `:84` imports exactly one module
(`apps/customer/js/data/discover.js`) and `:96-99` defines exactly two cases — `cardHTML` and
`slotsHTML`, six payload combinations. `badges.js`, `chat.js`, `loyalty.js` are not reachable from
it at all.

This is the second, independently sufficient cause of the blindness, and it is the one that makes
directive 022 §6's named remedy a no-op: **exporting `bubble`/`bizBubble` adds zero coverage**,
because nothing imports them into a test case. The tool's own note at `:498-500` attributes the gap
solely to the missing `export` and does not mention this.

## 5. A correction to a note written on 2026-09-07

`origin/audit/launch-hardening` adds override `apps/customer/js/features/loyalty.js#bcaa1558aca0`,
whose note states it verified **every** dynamic insertion in `:69-103` by counting rather than
sampling, names `b.name` and `b.emoji` among them, concludes «هیچ مقدارِ API‌ای بدونِ esc نمانده»,
and adds a limitation warning that «هر درجِ تازه‌ای در :69-103 کلید را باطل می‌کند».

The statement about the code may be true. **The statement about the key is false.** The sink opens
at `:69`; the first nested backtick is `${PERKS.map(p=>` + backtick at `:100`; `badges.map` with
`esc(b.emoji)`/`esc(b.name)` is at `:102` — after the cut. Insertions past `:100` do **not**
invalidate the key.

That is worse than an undocumented limitation: it is a **stated guarantee the mechanism does not
provide**, on the branch heading for launch.

## 6. Denominator, settled by execution

Both my subagent's count (60 of 87) and my own grep (60 line-form of ~90) were wrong. The tool's
own runtime report is authoritative:

```text
⚠ 65 از 85 overrideِ اعلام‌شده هیچ سینکی را نگرفت.
```

**85 declared · 65 dead · 20 live.** The dead set is not only the legacy `path:line` keys — it
includes hash-form keys too (e.g. `apps/customer/js/features/trips.js#6ea9860e2c7f`), which neither
of the earlier counts predicted. Fail-closed, so not a hole; but 65 recorded human reviews are inert
and the warning that says so is `console.warn` only — it never sets `regressed` (`:826-832`).

## 7. Recommended order of repair — the order matters

1. **Fix `grabExpression` first.** `matchingParen` at `:73-93` already implements the correct
   nesting-aware scan; the naive branch simply never calls it. Until this is fixed, every recorded
   human review of a template-literal sink is of *unknown* value — not wrong, unknown.
2. **Expect a wave of invalidated overrides**, and budget for it. Correct behaviour (a stale review
   must not be inherited) but it means the gate goes red and dozens of sinks need genuine re-reading.
   Count the affected sinks *before* the fix so the size is known in advance.
3. **Then** widen `xss-escaping-regression.mjs` beyond `discover.js`. Note the asymmetry found this
   session: `apps/customer/js/features/chat.js` is an ES module (`index.html:268`, `type="module"`)
   and can be imported; `apps/business/js/chat.js` is a classic script (`index.html:190`) where
   `export` is a SyntaxError and `type="module"` would break the inline `onclick` handlers at
   `:25`/`:42`. The remedy is not symmetric between the two files.
4. `apps/business/js/chat.js:10` defines `chatEsc`, a second escaper independent of
   `shared/js/format.js`, with **no test anywhere** (`grep -rn chatEsc api/tests/` → no output,
   while `esc` has `api/tests/esc.test.mts`). Fixing the sink axis leaves this untouched.

## 8. Axes

**Tested, executed:** helper-body axis · extractor-truncation axis · override-liveness · gate
falsifiability (inject → observe → revert) · behavioural-gate coverage · artifact-staleness
interaction.

**NOT tested, still UNKNOWN:** the full `npm test` suite (never run on this machine) · CI job wiring
· the standalone bundle · the remaining hash-keyed overrides individually · whether the proposed
`grabExpression` fix regresses anything, since it was described and not applied · any database or
runtime behaviour (docker daemon down).

**Nothing in this document was inferred from a log tail.** Every exit code above was captured from
the process that produced it.
