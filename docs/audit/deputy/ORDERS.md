# Deputy — Order ledger

**Date opened:** 2026-09-07 · **Session:** `rezv-30 [a7bb03]` (Deputy)
**Reporting target:** `rezv-b0 [d8087d]` (CEO, live) — see "Target resolution" below
**Repo:** `C:\Users\Ardalan\Desktop\rezv\Rezv` · **Branch:** `main` · **HEAD:** `96322a0`

This file is the record. Every order I accept, refuse, or am handed gets a row. I close nothing,
approve nothing, certify nothing — I mark my own work **submitted** and the CEO closes it.

---

## Target resolution — stated before anything else

My mandate names the reporting target as `rezervnofullsource-d9 [8dde6c]`.

| Claim | Verification | Result |
|---|---|---|
| `rezervnofullsource-d9 [8dde6c]` is the reporting target | `ListAgents` — 12 peers enumerated | **UNKNOWN — not verified.** No peer by that name or ref. |
| `rezv-b0 [d8087d]` is the CEO session | Founder said so directly; CEO confirmed and accepted the routing | Present in `ListAgents` as `interactive`. **Live.** |

Routing to `rezv-b0 [d8087d]`. The CEO's own inference is that `8dde6c` is a CEO session on a
different machine (host `DESKTOP-8DAJNO5`, per the night report naming `-df` CEO and `-6f` reviewer).
**That inference is recorded, not adopted.** `8dde6c` stays UNKNOWN — not verified.

---

## Orders

| ID | Date | Source | What was asked | What I did | Status | Evidence |
|---|---|---|---|---|---|---|
| — | 2026-09-07 | founder (direct) | contact `rezv-b0 [d8087d]`, ask for an order | Sent; identified myself, reported verified repo state, flagged the target conflict | closed by arrival of ORDER-001 | msg `ad5db7f8` |
| **ORDER-001** | 2026-09-07 | CEO `rezv-b0 [d8087d]` (cross-session) | Build the XSS override re-review queue: 16 rows, five fields each (full corrected expression · old truncated coverage · interpolations outside the old hash · override note verbatim + whether it describes real coverage · the human decision). Read-only against `origin/audit/round-21-xss-truncation`. No verdicts, no baseline change, no artifact regeneration. | Restated in one line before starting. Built `ORDER-001-xss-rereview-queue.md` (16 rows) + `ORDER-001-expressions.json` (full expressions). Extraction harness copies both tool revisions' pure functions verbatim; gated on reproducing all 16 committed `sink_hash` values — **PASS**. | **SUBMITTED — CEO closes** | `docs/audit/deputy/ORDER-001-xss-rereview-queue.md` |

## Refusals

None. Nothing asked has fallen in the founder-only list (§5).

## Errors I reported on myself

| Date | What I got wrong | How it was caught | Correction |
|---|---|---|---|
| 2026-09-07 | Told the CEO its ORDER-001 scope was wrong — claimed `escaped → review` was 3 not 6, deaths 9 not 10, and that the three `standalone/` rows "cannot exist". | I read only the artifact's `hits` array and never `report_only_hits` — a second population of 224 `standalone/` entries. CEO rejected the correction on measurement and told me to verify rather than accept; I did, and it was right on every count. | All 16 rows rebuilt across both populations. Root cause recorded in §0 of the artifact: **internal corroboration within one scope cannot detect a scope error**, and my `87−19=68` disagreed with the tool's printed `67` — I resolved that gap in favour of my own arithmetic instead of stopping at it. |

---

## Standing corrections to the record (so a cold reader does not inherit them)

- **Directive 022 §6's named remedy is a no-op, not merely incomplete.** Exporting `bubble`/`bizBubble`
  so `tools/xss-escaping-regression.mjs` can reach them adds **zero** coverage: `:84` imports only
  `apps/customer/js/data/discover.js` and `:96-99` defines two cases, so nothing imports those helpers
  into a test. The remedy is also not symmetric — `apps/customer/js/features/chat.js` is an ES module
  (`apps/customer/index.html:268`), while `apps/business/js/chat.js` is a classic script
  (`index.html:190`) where `export` is a SyntaxError.
  **022 §6's diagnosis was sound and its ruling against callee-body hashing still stands** — only the
  named remedy was wrong, and the real root cause was one level deeper: `grabExpression`'s flat
  backtick scan, fixed in `63447e2`. Attribution: CEO `rezv-b0`. Do not record this as merely
  "superseded" — a session reading that word may still trust the remedy elsewhere.
- **`QUEUE.md` at the repo root is the product's background-job system, not an audit queue.** The name
  invites the confusion; it cost me one read.

---

## What I did without an order (setup only, per mandate §8.2)

- Created `docs/audit/deputy/` and `docs/audit/orders/`. Both were absent. `docs/audit/orders/` is
  empty — no CEO-written order was waiting on disk; ORDER-001 arrived cross-session.
- Read, to know what was in flight: directive `022`, `docs/audit/SESSION-HANDOFF.md`, `QUEUE.md`,
  `audit/round-21/EXECUTED-PROOF-2026-09-07.md`, and the report/directive indexes.
- Reported one hazard: `audit/round-21/` existed **untracked** in the main working tree, two files
  covered by no gate, byte-identical to the committed versions on the branch (`55874b57…`,
  `55db2b0f…`). The CEO verified independently and removed the copies. Ruled-out hazard, not a finding.

---

## Update 2026-09-09 — both orders closed, and my session id has moved twice

**Identity:** I am now `rezv-fa [0a4dbb]`. Was `rezv-b1 [5f3782]` (09-08), and `rezv-30 [a7bb03]`
(09-07) when ORDER-001 was issued. One session, three ids, continuous transcript. The roster in
`docs/audit/prompts/ROUTING.md` is the authority for addressing — **not** the ids hardcoded above.

| ID | Order | Closed by | Evidence |
|---|---|---|---|
| ORDER-001 | 16-row XSS override re-review queue | **CEO, 2026-09-07** | `da82092`, now an ancestor of `main` |
| ORDER-002 | Cross-session queue state | **CEO, 2026-09-09** | `4871590` — `QUEUE-STATE-2026-09-09.md` |

Both were **submitted** by me and **closed by the CEO**. I closed neither. Nothing is owed by me at
`410d376`; no order is waiting in `docs/audit/orders/`, which is still empty.

### Rulings that came back on my work, recorded so they are not re-litigated

- **ORDER-001 rows B1/B2 may not be closed by re-keying** (Reviewer, 037 §3; Reviewer verified B1 at
  source independently). `economy.js:106` and `waitlist.js:45` cite `esc()` inside `missionCard` /
  `wlCard` — outside the hashed expression. Two legal closures only: name something inside the hashed
  region, or refactor the sink so the escaping is inside it. **Still open.**
- **The other 15 ORDER-001 rows have never been re-derived by anyone.** The Reviewer said so
  explicitly; the CEO confirmed 2026-09-09 that it has not assigned them. **Unowned.**

### Errors, mine and others', that this ledger exists to keep visible

| Whose | What | How it surfaced |
|---|---|---|
| Mine | Rejected ORDER-001's scope reading only `hits`, never `report_only_hits` — 448 hits live in **two** populations of 224. | CEO rejected on measurement and told me to verify rather than accept. It was right on every count. **Internal corroboration within one scope cannot detect a scope error**; my `87−19=68` disagreed with the tool's printed `67` and I resolved it in favour of my own arithmetic. When your number and the instrument's disagree, the gap is the finding. |
| Mine | Two commits **committed but never pushed** — in the same round I told the Reviewer that a file git does not track does not exist for the other machine. Same error, one layer down. | Reviewer found it only because a later push carried them. Fixed by 037 §3b's end-of-round check, which does not depend on anyone remembering. |
| Reviewer's | Told **both** unidentified sessions to add their row to one shared file with no ordering — the two-auditors-one-tree failure arriving through the instruction written to prevent it. | I declined to comply and said why. Rule promoted (038 §1): **an instruction that names a shared file must name a writer.** |
| CEO's | Reported «peak-hour priority FAKE — 0 code» from a grep for three field names the code does not use (`waitlist_priority`, `waitlistPriority`, `priorityScore`); the field is just `priority`. | Directive 039 §2.1 corrected it to PARTIAL — `waitlist.ts:133-153` is real and running. **A failed search is not evidence of absence**; «we don't know» is never reported as «zero». I used 039 and flagged the divergence rather than reconciling it silently. |

### Standing hazard I found and the mitigation that is proven, not asserted

**A fourth depth of invisibility: `staged`.** The Reviewer's three (untracked · committed-not-pushed ·
pushed-but-unmerged) all *hide* work. Staged-but-uncommitted **misattributes** it — a bare
`git commit` by any session sweeps another session's half-finished work into its own commit, under its
own message, invisibly in `git log`. Found live on 2026-09-09: 36 of Scout's files staged in the
shared index.

**Mitigation:** explicit pathspec on every commit (`git commit -- <path>`), never `git add -A`.
Verified rather than claimed — Scout's staged count was **36 before and 36 after** my commit, which
touched 1 file. The CEO has adopted it and recorded that dispatching Scout into the shared checkout
rather than a worktree was its own error.

**Owed by me right now: nothing.** Next work is the CEO's (cashback tiers, after Phase 1 proves the
ledger constraint). Not mine, and I have not started it.

---

## Update 2026-09-09 (later) — ORDER-003 and ORDER-004

| ID | Order | Status | Evidence |
|---|---|---|---|
| ORDER-003 | Landing promise audit — what `apps/landing` promises vs what the product pays | **SUBMITTED** | `0f99893` — `ORDER-003-landing-promise-audit.md`, 10 rows |
| ORDER-004 | Reproduce the `otp-break-glass` intermittent failure | **SUBMITTED** | `ff48bf9` + addendum `c8ff47e` |

Both submitted by me; neither closed by me. I still close nothing.

**ORDER-003 result:** two rows fail. `PinnedStory.tsx:37` «رزروِ تازه بدونِ رفرش ظاهر می‌شود» has **no mechanism at all** — no EventSource/WebSocket/SSE, and the three `setInterval`s are chat, an outbound-only heartbeat, and a dashboard-KPI refresh gated on the overview tab. And `apps/customer/index.html:18` points its canonical at the apex, which D-006 gave to the landing — wrong today, not DNS-parked. I edited nothing in `apps/landing`: the *decision* to remove a false promise is not the founder's, but the *hand* is the Launch Engineer's.

**ORDER-004 result:** not reproduced in 4 executed runs (5 with the CEO's). Both CEO hypotheses **refuted by construction** — one counter writer behind a phone-equality guard, and a rate-limit bucket keyed by a phone drawn from 10⁷ values; both were about *interference*. The real mechanism, supplied by `rezv-a0` and then **proven** by injecting a stub at `ratelimit.ts:83`: one transient Redis error makes `rateLimitInMemory` open a fresh bucket, so the 4th request is allowed (`remaining=2` while Redis had counted 3). **No fix made — nothing went red**, and the assertion was deliberately not relaxed to `>= before + 1`.

**Escalated, not decided:** may a Redis blip reset a per-phone OTP limit to zero on an auth path? That is a product/security decision. A retry has since been written for it by another session — **a mitigation is not the decision.**

### Three near-misses in one day, all the same family

Recorded because the pattern matters more than any one of them: **reading an artefact as if it were the behaviour.**

1. `docker-compose.prod.yml` lists only `api` and `caddy` — I was about to report "no cron runs in production". Its own header says `-f docker-compose.yml -f docker-compose.prod.yml`; it is an **override**. One file read as the whole configuration.
2. `booking-error-contract.test.mts` appeared in a `P2024` grep and I was about to file it as breaking the CEO's assumption. The match was **in a comment**.
3. `rateLimitFallback` read `0 → 0` while the fallback demonstrably fired. I was about to report "labelled counters do not record" — a serious, false claim against working code. Cause: `'./metrics'` and `'@/lib/metrics'` resolve to **two module instances** under `tsx`. Caught by testing the instrument instead of trusting it.

Only the third would have shipped as a defect report against correct code. **The one habit that caught all three was checking the thing that produced the number, not the number.**

### A misattribution, and how it was settled

`rezv-a0` twice called uncommitted work in `api/src/lib/ratelimit.ts`, `metrics.ts`, `_all.runner.mts` and an untracked `ratelimit-transient-redis-error.test.mts` "your E-003 work", and suggested my write may have carried its injected `MUTANT` lines back into the shared file.

**None of it is mine, and it was settled with evidence rather than denial:** every file I have committed this session is under `docs/` — zero under `api/` or `apps/`, across all commits. And the test file refers to me in the **third person** («معاون در ۴ اجرا بازتولیدش نکرد»), so it is written *about* the Deputy, not by one. `rezv-a0` re-verified independently and withdrew the attribution.

**I did not name the real owner.** By elimination it is one of two sessions, but assigning ownership by elimination is the error the Reviewer refused to make about a roster row, and doing it about *code* is worse. Routing went to the CEO.

**Standing hazard as of this entry:** those ~47 lines are **uncommitted and unpushed** — depth 0 and depth 1 at once. Invisible to the other machine, and destroyable by anyone's `git checkout --` on that path. They survive only because `rezv-a0` removed its mutation with an explicit edit instead of a checkout.

**Carried forward for whoever owns E-003:** the retry absorbs a single transient error, so **both the attempt and the retry must now fail** to exercise the fallback. Any future mutation test that throws once will pass and prove nothing — which is how a guard quietly stops guarding.
