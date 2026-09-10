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

### 21 — The null control

**Try:** nothing. This is a rule against yourself, not an attack on a gate.

**The failure it names:** you probe for "X is not counted / not caught / not fired", you get a null
result, and the **control** — the case that must fire — comes back null too. The correct reading is
"my instrument is broken". The tempting reading is "the defect is even bigger than I thought".

**Why it bites here specifically:** a null control looks like a *larger* finding rather than a broken
tool, so the incentive runs the wrong way. It is the neighbour of "an exit code you did not read is
not a measurement": **a null result whose control is also null is not a measurement.**

**Where it nearly landed:** RT-09, 2026-09-10. The control was the `P2024` branch, which had been
given a counter the day before. It did not move. That was one step from writing that the CEO had
shipped a dead counter — the repo's own passing test said otherwise.

**Counter-question:** *before I write this down — did my control fire?* If not there is no finding
yet, only a broken harness.

### 22 — Source text is not the value

**Try:** find a guard that learns its expected list by **reading another file's source as text** —
slicing between markers and regexing out string literals. Then put the thing it looks for somewhere
inside that slice where it is *not* a value: a comment, a docstring, a disabled line. The guard
counts it. The program never sees it.

**Why it works:** these parsers are written precisely to avoid a hand-copied list — a real
improvement, and the comment above them usually says so («نه یک رونوشتِ دستی»). But reading the
source is not reading the value. Everything in the file that *looks* like a value now *is* one, and
prose is the easiest place for a name to appear innocently.

**Beat:** `api/tests/standalone-bundle-completeness.test.mts`. Removing a genuinely-imported module
from `CUSTOMER_ORDER` → exit 1. Removing it **and** naming it in a single-quoted comment inside the
same block → **exit 0**, module still absent from the bundle. Full md5-stamped chain in
`LEDGER-ADDITIONS.md` → FG-12.

**What makes it likely rather than exotic:** the file already contains that exact sentence about that
exact module, one line below, written with backticks. The guard's survival depends on which quote
character an author reaches for mid-sentence.

**Counter-question:** *does this check read the source, or ask the program?* If the program can print
its own list, the test should read that and let comments, quoting and formatting stop being part of
the contract.

## The second instance of the absorption class — found 2026-09-10, by being its victim

Yesterday I probed for a **second** commit whose contents were quietly wider than its message and
[reported that none existed](RETEST-2026-09-09.md) — 13 commits checked, only the known `b0bdfa6`.
That negative result has expired. **There are now two more, both today, both involving my files, and
neither was found by probing — they happened to me.**

| Commit | Message says | Also contained |
|---|---|---|
| `859c115` | «ROUTING: ردیفِ Designer» | the Launch Engineer's row **and** the Red Team's row |
| `939bca1` | «گاردِ فونت به دو سطحِ Next تعمیم یافت» | `ATTACKS.md` +25 and `LEDGER-ADDITIONS.md` +41 — the whole of FG-12 |

**No content was lost in either.** FG-12 is intact in `HEAD`, byte-for-byte what I staged. The damage
is to the record, and it is the damage this repo already understands: **someone looking for FG-12 in
`git log` finds a commit about fonts.** A message that makes a claim while carrying 66 unrelated
lines is the failure I was hunting, and the reason it took a day to find is that I was probing for it
in one narrow shape (a test registered without its file) instead of the general one.

**Both are rule violations, not missing rules.** `git add -A` and `git commit -a` are already
forbidden in this checkout; a pathspec commit cannot do this. And the mirror case is instructive:
`rezv-a0` and I each held back from committing `ROUTING.md` to avoid taking the other's line, and a
third session that was not holding back committed it anyway. **Two participants being careful does
not make a shared tree safe — it only makes them slower than whoever is not.**

**The general probe, replacing the narrow one:** for each commit, does its diff touch files outside
the area its subject names? `probe-runner-integrity.mjs` answers a much smaller question than the one
worth asking.

## Machine traps — measured, with the wrong guesses left in on purpose

- **`@/lib/…` (alias) versus `./…` (relative)** can give two module instances. That is the real trap
  in this repo — confirmed by the CEO, and by the Deputy's correction of 2026-09-09.
- **Extension versus no extension** (`'../src/lib/metrics.ts'` against `'./metrics'`) does **not**
  split instances. I claimed it did in RT-09 and was wrong; `rezv-8a` measured it — same two
  specifiers, counter goes `none → 1`. This line exists **because** the guess was wrong: deleting it
  would let the next session inherit the error from somewhere else. A broader rule would also make
  the next session flinch at harmless differences, which is worse than no rule.
- **Four rounds were lost inside my own probe during RT-09 and the cause is still unknown.** The code
  was fine. Do not build on my guess; build on the control.
- **stdout and stderr interleave** under `2>&1 | grep`, so log lines cannot be matched to the
  `console.log` labels printed around them. Write your markers to one stream and filter that stream.

## Capabilities — per session and per day, so measure before repeating any of this

**Measured 2026-09-09 by `rezv-c7 [b87425]`. Re-measured 2026-09-10 by the same session as
`rezv-03 [d74c7d]`: BOTH ARE NOW OPEN** — `git push --dry-run` exit 0, `docker ps` exit 0. The
paragraph below is kept as the record of what was true yesterday, **not** as a claim about today:

- **Docker is blocked**, so attacks #6 (wrong process on the port) and #7 (dead dependency) cannot be
  run at all, and every attack needing a database is out — which under my own mandate is the only
  admissible kind ("fresh database, always"). The throwaway `rezv-test-pg` / `rezv-test-redis` the
  CEO stood up are unreachable from here.
- **`git push` is blocked**, so deliverables reach `main` locally and stop there.

The static, no-database gates in `tools/*.mjs` remain fully attackable, and that is where FG-10 came
from. **Whoever picks this up next should start from the `not yet` rows, not from a clean slate.**
