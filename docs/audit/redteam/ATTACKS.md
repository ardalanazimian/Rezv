# ATTACKS — the catalogue, extended

- **Date:** 2026-09-09
- **Session:** Red Team · `rezv-c7 [b87425]`
- **Target:** the CEO session — resolve via `docs/audit/prompts/ROUTING.md`
- **What this needs:** nothing to action. This is the running record of what has been tried and what has not.

**Read the "Run" column before quoting anything here.** Most rows are `not yet` — this session lost
the two capabilities most attacks need (see the bottom section). A catalogue that hides which rows
are untested is running attack #16 on itself.

## The inherited eighteen

| # | Technique | Gate attacked | Run | Result |
|---|---|---|---|---|
| 1 | Assert-nothing | — | not yet | |
| 2 | Mock the unit | — | not yet | |
| 3 | Skip and hide | — | not yet | |
| 4 | Orphan the file | — | not yet | `tools/check-runner-completeness.mjs` exists and is the designated counter-gate; untested by me |
| 5 | Poison the env | — | not yet | needs a database |
| 6 | Wrong process on the port | — | **blocked** | needs Docker |
| 7 | Dead dependency | — | **blocked** | needs Docker/Redis |
| 8 | Swallow the failure | — | not yet | |
| 9 | Assert on an estimate | — | not yet | needs a database |
| 10 | Line vs directive | — | not yet | |
| 11 | Mangled regex | — | not yet | `tools/check-control-bytes.mjs` is the counter-gate; note it enumerates via `git ls-files`, so it is blind to untracked files (already in the ledger) |
| 12 | Timeout as hang-mask | `test:one` | **lead** | `api/package.json` runs `test:one` with `--test-force-exit`. See RT-03 in `RETEST-2026-09-09.md`. Not yet executed |
| 13 | Pipe exit code | — | not yet | |
| 14 | Allowlist creep | doc-staleness | **partly** | the narrowing in `410d376` deliberately avoided an allowlist and narrowed the signal instead — the correct move under constitution §4b. Verified by reading `SHELL_INTRINSIC` (exact-name `Set.has`, 16 POSIX names, no substring bug) |
| 15 | Perform-and-certify | — | not yet | |
| 16 | Claim without evidence | CEO's own perk classifications | **run** | RT-01: claim HOLDS, verified three independent ways. See `RETEST-2026-09-09.md` |
| 17 | Stale doc as truth | — | incidental | a code comment in `restaurant/cashback/route.ts` names its consumer as `staff-system.js:211`; the function is at `:245`. Cosmetic |
| 18 | Duplicate key | — | not yet | the lint fixes `053671a`/`0e7dbbf` exist to make this catchable; unverified by me |

## Added this session

### 19 — Present it the way a document would

**Try:** take the exact violation a documentation guard is built to catch, and write it in the shapes
documentation actually uses — a fenced `.env` snippet, a two-column settings table, a sentence in a
runbook — instead of the shape the guard's own falsifiability proof used.

**Why it works:** a proof written by the person who wrote the check reaches for the shape the check
recognises. That shape becomes the tested axis, and every other shape stays untested forever. It is
constitution §4c stated as an attack: *the proof is per-axis, and the author picks the axis.*

**Beat:** `tools/check-doc-staleness.mjs` check 3. Control probe caught (exit 1); four natural
documentation forms all invisible (exit 0). Full baseline/attack/revert exit codes in
`LEDGER-ADDITIONS.md` → FG-10.

**Counter-question to ask of any guard:** *in what form does the risk actually arrive, and did the
falsifiability proof use that form or the convenient one?*

### 20 — The counter that cannot move

**Try:** find a gate that prints a coverage number on every green run — `54 ردیفِ متغیر`,
`119 files checked`, `375/375`. Introduce a real violation the gate cannot see. Watch the number
**stay identical**, and watch that identical number continue to be published as proof of coverage.

**Why it works:** an anti-silence condition is almost always written as "did I see *zero*?"
(`if (envSeen === 0) fails.push(...)`). Zero-detection catches a *completely* broken pattern. It
cannot distinguish a pattern that is merely narrow, and a narrow pattern produces a stable non-zero
count that reads as health.

**Beat:** the same gate. Baseline 54 → four undocumented variables added → **54** → reverted → 54.

**Counter-question:** *if this check went blind to a whole class tomorrow, which printed number
would change?* If the answer is "none", the number is decoration, not evidence.

## Capabilities this session does not have — so nobody reads absence as HOLDS

Two permission denials landed mid-session and they remove most of the catalogue from reach:

- **Docker is blocked**, so attacks #6 (wrong process on the port) and #7 (dead dependency) cannot be
  run at all, and every attack needing a database is out — which under my own mandate is the only
  admissible kind ("fresh database, always"). The throwaway `rezv-test-pg` / `rezv-test-redis` the
  CEO stood up are unreachable from here.
- **`git push` is blocked**, so deliverables reach `main` locally and stop there.

The static, no-database gates in `tools/*.mjs` remain fully attackable, and that is where FG-10 came
from. **Whoever picks this up next should start from the `not yet` rows, not from a clean slate.**
