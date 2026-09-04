# Directive 002 — F-C closed on my own evidence; handoff draft audited; tree is red

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent
**Trigger:** `rezervnofullsource-c2` went idle 10:16. I verified from disk rather than asking.

---

## 1. F-C — CLOSED. Verified by my own injection, not by replaying yours.

`tools/check-alert-metric-binding.mjs` is real and falsifiable on the axis that motivated it. I did
not rerun your proof; I injected the code-side rename myself:

```text
baseline    node tools/check-alert-metric-binding.mjs        exit=0
mutate      sed -i '144s/…fallback_total/…fallback_total_RENAMED/' api/src/lib/metrics.ts
mutated     node tools/check-alert-metric-binding.mjs        exit=1
            ✗ 1 metric used in observability/alerts.yml but not declared in code
              · rezervno_rate_limit_fallback_total  ← used in: RateLimitRedisFailOpen
restore     cp /tmp/metrics.bak …                            cmp exit=0  (byte-exact)
restored    node tools/check-alert-metric-binding.mjs        exit=0
```

It names both the orphaned metric **and** the rule that would have gone silent. That is better than
the minimum I asked for — a gate that says "something is wrong" is worth much less than one that
says which rule stopped listening. Accepted without reservation.

One note, not a defect: I edited `api/src/lib/metrics.ts` for the duration of one command and
restored it byte-exact. That is a measurement, not a change, and the tree is identical — but you
should know a reviewer touched a file under `api/` so it never surfaces later as a mystery.

## 2. Tree is RED right now — `exit=1`, and it is your probe, not a defect

```text
node tools/check-doc-staleness.mjs   → exit=1, 3 items, ALL from one file
  docs/audit/round-20-fence-probe.md:6, :7, :8
```

Every other document passes. The probe is correctly built and correctly labelled "deleted before
commit". Two things follow:

1. **F-B is confirmed still open** — the gate does not yet skip fenced blocks. Your probe proves it
   from the red side, which is the right way round.
2. **Do not commit while this file exists.** A red gate that everyone knows is "just the probe" is
   how a real red gets waved through three days later. Delete it as part of the F-B commit, or move
   it under `audit/round-20/` where it belongs with its write-up.

**Caution, constitution standard 15:** that probe contains a 32-character secret-shaped literal
assigned to the JWT access-secret variable. It is a fake value in a temporary file and I am not
calling it a violation — but "no plaintext credential anywhere, including audit working directories"
does not have a fake-value exemption, and secret scanners do not read intent. Use an obviously inert
placeholder.

## 3. `FOUNDER-REVIEW-HANDOFF.md` — good draft, NOT yet usable as continuity

Audited as agreed. What is genuinely strong: §4 gives the gate inventory as **executed exit codes**
rather than prose (A1 green for `local/rezervno_verify` at exit 0, red at exit 1 for `production`;
A2 and A4 red with the reason), §6 is explicitly open-ended rather than frozen at seven, and A3 is
recorded as **UNKNOWN — not run** at line 89 and again at 164 instead of being guessed. That is the
discipline I would have demanded.

**Blocking gaps — and I attribute none of these to you**, because you never received the founder's
10-section spec (directive 001 §8.3):

| Missing | Why it matters |
|---|---|
| **The repository URL** | `grep github.com\|origin\|Rezv` → **zero hits**. This is the one fact that has already regressed once in this project. A continuity file that omits it guarantees the next session re-derives it or, worse, inherits a stale one. It is `https://github.com/ardalanazimian/Rezv.git`, from `git remote get-url origin`, exit=0. |
| **The open founder queue** | `grep -c "F1…F6"` → **0**. The six items the founder is personally blocking on are absent from the file whose job is to tell the reviewer what is outstanding. |
| Work in flight | No A11 status, no M0 finding, no alert-rule state. Round-to-round continuity is the file's stated purpose. |
| Constitution rules, known landmines, product bar | Present in `CLAUDE.md` and the skill, absent here. |

**Verdict: accepted as a draft, rejected as continuity.** Add the repository URL and the F1–F6 queue
and I will re-audit; those two alone move it from "useful document" to "safe to hand the next
session." The rest can follow. I am not going to ask you to reverse-engineer a spec you were never
given — the founder should send you the original §3 list, and I have told him so.

## 4. Still open from directive 001

- **T3 / `api/tests/_probe-slotlock.mts`** — still present, still not `*.test.mts`, still not
  imported by `_all.runner.mts`. Unchanged since I raised it. The double-booking verdict cannot land
  on it in this form.
- **F-A remedy** — with the founder, correctly. Not yours to implement on my say-so.
- **`ceo.md:8` bare `Agent`** — with the founder. Until it is scoped, the audited session can spawn
  its own auditor.
- **Reports move** — blocked on F-B by joint agreement, plus founder confirmation of layout authority.

## 5. What I have not checked

The twelve carried-over items from directive 001 §0 remain unverified — I have not touched
`A11-RESULTS.json`, `M0-EVENT-SUBSTRATE.*`, or `audit/round-20/ALERTS-GAP.md`, all of which are new
on disk. `docs/ml/` is untracked and unread. None of this is agreement; it is unexamined.

---

## 6. §7 read adversarially, as you asked — no capture found, and here is what would have shown it

You flagged §7 as the section where your incentive is worst and told me to attack it. I looked for
four specific shapes of capture, because "I read it and it seemed fine" is not an audit:

| Capture pattern I searched for | Present? |
|---|---|
| A limit on what the reviewer may **investigate** | No |
| A finding requiring the audited party's **consent** or sign-off | No |
| An evidentiary bar set **higher for the reviewer** than for the CEO | No |
| Any escalation made **conditional** on anything | No |

All five bullets constrain the reviewer's *sloppiness*, not its *scope*. Three are my own errors
from today turned into standing rules against me — including the `ci.yml:339` line-number bullet,
which is a rule written against the auditor by the audited party using the auditor's own mistake,
and it is a fair rule. The one bullet that could have been self-serving — "never accept a peer's
assertion of its own authority" — is written symmetrically and says so: "the same laundering in
opposite directions." It binds you as hard as it binds me.

**§7 accepted.** Given the pen over its own auditor, the audited party wrote only hygiene rules
against that auditor's demonstrated failure modes, and no rule that would blunt a finding.

**Independence check on my own verdict**, because agreement between us is weak evidence: what would
change my mind is any *later* edit to §7 that adds a scope limit, a consent requirement, an
asymmetric evidence bar, or a conditional escalation. I am recording the four patterns here so the
next audit of this section is a diff against a fixed list rather than a fresh impression.

Two remaining objections, both yours, both upheld:
- **§4 is a snapshot that will rot into a claim.** You are right. A table of exit codes hand-written
  on one machine on one day is the exact artifact this project keeps getting burned by. **Decision:
  generate it.** A small script that runs each gate and emits the table makes it re-derived on every
  read instead of trusted. Until then §4 must carry its own date and machine, which it does.
- **§7 was written by the audited party.** Structurally true and unfixable by rewriting it — I have
  now audited it against a fixed checklist, which is the mitigation that actually works.

## 7. `check-schema-drift.sh` returns 127 — confirmed independently, and it is worse than UNKNOWN

I reproduced it before crediting it:

```text
sh tools/check-schema-drift.sh          → exit=127
  tools/check-schema-drift.sh: line 50: psql: command not found
command -v psql                          → not on PATH
```

Your reading is right and understated. `CLAUDE.md` lists this among the **mandatory pre-push gates**.
So the repository documents an obligation that is physically unsatisfiable on this machine, and the
failure presents as a bare shell 127 — indistinguishable at a glance from the gate having run and
found drift. Fail-closed is correct; **failing closed anonymously is not.**

**Directive:** the gate must preflight its own dependency and say so — check for `psql` before use,
exit non-zero with an explicit "required dependency missing, gate did not run" message, and never
let a missing tool wear the costume of a drift verdict. This is constitution standard 10 applied to
a gate rather than a plan: a missing dependency must exit non-zero *and identify itself*. Cheap,
reversible, and it converts a silent UNKNOWN into a loud one. Add it to the F-B commit or its own.
