# Round-20 — closing the A10-PLAN.json:614 alerting escalation

Scope: `audit/round-19/A10-PLAN.json:614` named three fail-open security counters
that were emitted by the code, honestly documented as "not alerted," and never
wired into `observability/alerts.yml` because the round-19 agent was read-only
and escalated. This closes that specific escalation. Branch `audit/launch-hardening`,
not committed — left for review.

## 1. What was added

- `observability/alerts.yml` — 3 new rules in the existing `rezervno_security`
  group (`HighErrorRate` group name unchanged, same file, same style): 76 lines
  added, 0 lines of the existing 13 rules changed in the final diff
  (`git diff --stat`: `74 insertions(+)` after I fixed a mistake I made
  mid-session — see §5).
- `observability/alerts.test.yml` (new) — `promtool test rules` unit tests: one
  silent/isolated-blip scenario and one sustained/clustered-firing scenario per
  rule (6 test blocks total).
- `.github/workflows/ci.yml` — new job `observability`, runs `promtool check
  rules` (whole file) and `promtool test rules` (the new test file) via the
  `prom/prometheus:latest` Docker image — the same image
  `docker-compose.observability.yml` already runs for Prometheus itself, not a
  newly-installed tool.
- `docs/SECURITY.md` (§8, §12.5), `docs/KNOWN_LIMITATIONS.md` (rate-limit
  fail-open bullet), `OBSERVABILITY.md` (§10) — updated to say precisely what
  is now true and no more.

## 2. The three rules and why each threshold/`for:` is what it is

All three live in the `rezervno_security` group, right after `RateLimitSpike`.

### `RateLimitRedisFailOpen`

```yaml
expr: sum(increase(rezervno_rate_limit_fallback_total[2m])) > 0
for: 5m
labels: { severity: critical }
```

Metric writer: `api/src/lib/ratelimit.ts:99`, inside `rateLimitWithFallback`'s
catch block. Real execution path: called from `api/src/middleware.ts:151` on
**every** `/api/*` request (`export const config = { matcher: '/api/:path*' }`,
`api/src/middleware.ts:21`) with `scope: 'middleware'`, and from
`enforceRateLimit` (`api/src/lib/ratelimit.ts:107-114`), used by
`withRestaurantAuth`/`withStaffAuth` across 59+ route handlers, with
`scope: 'route'`.

Threshold reasoning: the count threshold is `> 0` — even one fail-open event
means a security control (rate-limiting) was briefly not enforcing its
documented ceiling, so any occurrence matters. The question the mandate raised
is whether that pages on a single blip. Mechanically in Prometheus, for a
counter that jumps once and then stays flat, `increase(metric[W])` stays `> 0`
only for approximately `W` after the jump (both ends of the window then see
equal values → increase 0). So setting `for` **longer** than the window (`for:
5m` > `window: 2m`) means an isolated single event's "true" pulse (~2 minutes)
expires before `for` is satisfied — it never fires. Only a *recurring*
fail-open (Redis actually down, so every subsequent request on that path
increments the counter again) keeps re-triggering the window continuously,
and after 5 minutes of continuous degradation it pages. Severity `critical`
because a sustained Redis outage here has a blast radius beyond rate-limiting:
the real ceiling becomes `max × instances` under multi-instance deployment,
and the same outage degrades `withSlotLock` (see §7) and caching.

### `BanCheckFailOpen`

```yaml
expr: sum(increase(rezervno_ban_check_fail_open_total[2m])) > 0
for: 5m
labels: { severity: critical }
```

Metric writer: `api/src/lib/ratelimit.ts:230`, inside `isBanned`'s catch
block. Real execution path: called from `api/src/middleware.ts:126`, on
**every** `/api/*` request, before rate-limiting or auth run.

Same `for` > `window` reasoning as above, applied to the mandate's explicit
question ("is `> 0` right, or does that page on a single blip?"). Answer: `>
0` is right for the *count* (a banned IP getting through even once during a
real, sustained outage is a live security control failure worth knowing
about), but plain `> 0` with no debounce would page on a single transient
Redis hiccup that self-heals in under a second. `for: 5m` with a `2m` window
filters that isolated case (proven in §5) while still catching the case that
actually matters: Redis down for 5+ continuous minutes, during which every
previously-banned IP is let through on every request. Severity `critical`
because this disables an active security control, not just a defense floor.

### `RateLimitAutoBanSpike`

```yaml
expr: sum(increase(rezervno_rate_limit_auto_ban_total[10m])) > 5
for: 2m
labels: { severity: warning }
```

Metric writer: `api/src/lib/ratelimit.ts:245`, inside `recordViolation`, only
incremented when a ban actually fires (`count >= BAN_THRESHOLD`, i.e. 10
rate-limit violations in 5 minutes from one IP). Real execution path: called
from `api/src/middleware.ts:141` (CSRF-origin violation) and `:153` (global
rate-limit violation).

This one is structurally different from the other two: an auto-ban firing is
the system working *correctly*, not fail-open, so `> 0` is meaningless — a
busy production system will have some auto-bans as background noise. The real
signal is *clustering*: `lib/ratelimit.ts:189-193` already documents that
Iranian mobile CGNAT puts hundreds of subscribers behind one public IP, so a
burst of auto-bans could equally mean (a) a real attack (good, defense is
working, just needs visibility) or (b) the defense just locked out a shared IP
full of real customers (bad, needs a human to `unbanIp`, `lib/ratelimit.ts:276`).
Either way, more than a handful clustering in a short window needs a look;
one or two in ten minutes does not. Here `for: 2m` is a short confirmation
delay (matching `RateLimitSpike`'s existing convention in the same group), not
a blip filter — the count threshold (`> 5` per 10 minutes) does that job.
Severity `warning`, not `critical`, because the defense itself is functioning;
this is "come look," not "something is broken."

**Honest limitation on this threshold**: `5 per 10m` is a reasoned guess, not
a calibrated number — there is no production traffic to calibrate against
(P0-017: zero production infrastructure exists today). It should be revisited
against a real baseline after launch, exactly like the existing comment on
`RULES` in `lib/ratelimit.ts:154` ("اعداد محافظه‌کارانه‌اند؛ بر اساس ترافیک
واقعی تنظیم کن").

## 3. Metric-writer proof (all three, `file:line`, on a live path)

| Metric | Writer | Real caller |
|---|---|---|
| `rezervno_rate_limit_fallback_total` | `api/src/lib/ratelimit.ts:99` | `api/src/middleware.ts:151` (every `/api/*` request) + `enforceRateLimit`, 59+ routes via `withRestaurantAuth`/`withStaffAuth` |
| `rezervno_ban_check_fail_open_total` | `api/src/lib/ratelimit.ts:230` | `api/src/middleware.ts:126` (every `/api/*` request, before auth) |
| `rezervno_rate_limit_auto_ban_total` | `api/src/lib/ratelimit.ts:245` | `api/src/middleware.ts:141` and `:153` |

`api/src/middleware.ts:21`: `export const config = { matcher: '/api/:path*' }`
— confirms this is not a dead/unreachable code path; it is Next.js middleware
applied to the entire API surface.

## 4. Falsifiability evidence — both exit codes, every step

Environment note: `promtool` is **not installed on this machine**
(`which promtool` → not found, `promtool --version` → exit 127). It is
available through `prom/prometheus:latest`, the exact Docker image
`docker-compose.observability.yml` already runs for Prometheus itself — using
it is not installing new tooling, it is running the project's existing
dependency once. Command used throughout:
`docker run --rm -v "$(pwd)/observability:/etc/prometheus:ro" --entrypoint promtool prom/prometheus:latest ...`

1. **Baseline, before any edit**: `promtool check rules` on the untouched
   13-rule file → `SUCCESS: 13 rules found`, **exit 0**.
2. **After adding the 3 rules**: `promtool check rules` on the whole file →
   `SUCCESS: 16 rules found`, **exit 0**. (Confirms the addition doesn't break
   the other 13 — the mandate's specific worry.)
3. **`promtool test rules alerts.test.yml`** (6 scenarios: silent + firing ×
   3 rules) → `SUCCESS`, **exit 0**.
4. **Mutation 1 (red)**: changed `RateLimitRedisFailOpen`'s `for: 5m` to
   `for: 1m` (i.e. `for` ≤ window, exactly the failure mode the design
   avoids) → `promtool test rules` → **FAILED, exit 1** — the isolated-blip
   scenario now fires at `t=3m` when it must stay silent. Reverted to `for:
   5m` → re-ran → `SUCCESS`, **exit 0**.
5. **Mutation 2 (red)**: changed `RateLimitAutoBanSpike`'s threshold from `>
   5` to `> 50` → `promtool test rules` → **FAILED, exit 1** — the
   clustered-firing scenario (7 auto-bans) no longer crosses the threshold and
   the expected alert never fires. Reverted to `> 5` → re-ran → `SUCCESS`,
   **exit 0**.
6. **Final state, both commands**: `promtool check rules` → `SUCCESS: 16
   rules found`, exit 0; `promtool test rules` → `SUCCESS`, exit 0.

Both distinct mechanisms used across the three rules (window/`for` ratio for
the two fail-open rules; raw threshold for the auto-ban rule) were each
independently proven able to go red and were reverted to green — per
constitution §3.

## 5. A mistake I made and caught before reporting

While injecting mutation 1, I used `sed -i '0,/alert: RateLimitRedisFailOpen/{s/for: 5m/for: 1m/}'`
expecting it to touch only the first `for: 5m` line. `sed`'s `0,/regex/`
address range applies the substitution to **every** matching line from the
start of the file through the first match of the range terminator, not just
one occurrence — it silently also changed `HighErrorRate`'s and
`HighLatencyP95`'s `for: 5m` to `for: 1m` (two pre-existing, unrelated rules).
My subsequent manual revert (via a scoped string edit) only touched the
`RateLimitRedisFailOpen` block, so those two collateral changes survived
undetected until I ran `git diff` before finalizing and saw two unexpected
hunks at lines 23-50 of `alerts.yml`. Fixed immediately, both re-verified
against the original committed values, and the final diff
(`git diff --stat observability/alerts.yml` → `74 insertions(+), 0
deletions`) contains only the intended addition. Lesson for next time: use
`Edit`'s exact-string match instead of `sed` range addresses for any mutation
test on a shared file, since a not-unique-enough match silently touches
unrelated content — matching the repo's existing rule against `heredoc`s
mangling content in ways that read clean but aren't.

## 6. CI: did anything validate this file before, and what I did

Before this change: **nothing**. `grep -rn "observability\|alerts\.yml\|promtool" .github/workflows/` found no reference anywhere in `.github/workflows/ci.yml`
(the only workflow file in the repo). `observability/alerts.yml` was a shipped
artifact with zero build/validation job — constitution §5's exact failure
mode ("what is not built is broken and nobody knows"), just for a config file
instead of a binary. A syntax error or a metric-name typo would only surface
when someone actually booted the observability stack and diffed alert counts
by hand.

Added: job `observability` in `.github/workflows/ci.yml`, two steps, both
running the `prom/prometheus:latest` Docker image already used elsewhere in
this repo (no new dependency introduced to the CI runner beyond Docker, which
`ubuntu-latest` already ships):

1. `promtool check rules` over the whole `alerts.yml` (would catch a syntax
   break in any of the 16 rules, not just mine — directly answering the
   mandate's "run it over the whole file" requirement).
2. `promtool test rules` over `alerts.test.yml` (would catch a regression in
   any of the 3 new rules' firing behavior).

**Validated the workflow YAML itself** with `actionlint` (via
`rhysd/actionlint:latest`, also Docker, also not installed on the host):
`.github/workflows/ci.yml` → exit 1, one finding — a shellcheck **style**
suggestion (`SC2001`, "see if you can use `${variable//search/replace}`
instead") in the pre-existing, unrelated `base-freshness` job's `sed`
command. I confirmed this is not something I introduced by running the same
`actionlint` command against `git show HEAD:.github/workflows/ci.yml` (the
original, uncommitted-by-me file): identical warning, identical exit code 1,
just at line 520 instead of 550 (the shift matches exactly the ~30 lines I
inserted earlier in the file). My inserted job produced zero lint findings of
its own.

**What I did NOT prove**: that this job actually goes green inside a real
GitHub Actions run. `act` (nektos/act, for running Actions workflows locally)
is not installed (`act --version` → command not found, exit 127), and I did
not install it. What I *did* prove: (a) the workflow YAML parses and lints
cleanly via `actionlint`, and (b) the exact shell commands the new job runs,
executed manually from the real repository root with the real file paths,
both exit 0 (§4, item 6). The gap between "these commands work when I run
them" and "this job is green in Actions" is small (same image, same mount
pattern already used by the `image-build` job in the same file) but not zero,
and I am not overstating it as proven.

## 7. What I could NOT prove — explicit UNKNOWNs

- **Whether any of this actually pages a human.** This is the biggest gap and
  it is bigger than my mandate. `docker-compose.observability.yml` defines
  only `prometheus` and `grafana` services — **no Alertmanager service
  exists anywhere in this repo**, and `observability/grafana/provisioning/`
  contains only a dashboard provider and a datasource — **no contact point or
  notification policy is provisioned for Grafana's own alerting either**. A
  firing rule today is visible in Prometheus's `/alerts` page and would show
  as red in Grafana if someone opens it, and nowhere else. This is true for
  all 16 rules, not just my 3 — it predates this change and is not something
  round-20 introduced, but it means the literal instruction "must page
  someone" is not fully satisfiable without a founder decision (which
  notification channel — Slack/email/PagerDuty — and its credentials, which
  per the constitution's non-negotiable section is a founder call, not mine).
  Documented in `docs/SECURITY.md` §8/§12.5 and `docs/KNOWN_LIMITATIONS.md`.
- **Real-world calibration of `RateLimitAutoBanSpike`'s `> 5 per 10m`.** No
  production traffic exists to validate against (P0-017).
- **CI job passing inside actual GitHub Actions** (only locally simulated —
  see §6).
- **The other 13 pre-existing alert rules' end-to-end liveness.** Out of
  scope for this pass — I did a partial spot-check (§8) but did not write
  `promtool` tests for all 13, and did not verify every one of their metric
  writers.
- **`rezervno_slot_lock_fallback_total` remains completely unwired** — see §8.
  Its writer is real (`api/src/lib/redis.ts:166`) but no alert rule exists for
  it; out of round-20's named scope (three metrics only), documented as a
  named follow-up instead of silently left for someone to rediscover.

## 8. Things the mandate didn't ask for, that matter

1. **No Alertmanager / no Grafana notification channel exists at all** (§7,
   first bullet) — the single largest finding from this pass. Wiring three
   more rules into a system with no delivery path closes the letter of the
   escalation but not gate (c)'s actual goal ("must page someone"). This
   needs a founder decision (channel + credentials) before it's true.
2. **A fourth, sibling fail-open counter was found and is still dark**:
   `rezervno_slot_lock_fallback_total` (`api/src/lib/redis.ts:166`, inside
   `withSlotLock`'s catch block — fires when Redis is down during reservation
   creation and the code proceeds without the optimistic lock, relying on the
   DB's `EXCLUDE` constraint + `SERIALIZABLE` transaction as the real source
   of truth). `docs/SECURITY.md` §12.5 already listed it as "log-only" before
   this pass; it's the same shape as the two fail-open rules I added and
   could reuse the identical `for` > `window` pattern. I did not add it —
   out of the mandate's explicit three-metric scope — but flagged it in both
   docs so it doesn't silently outlive this round the way the original three
   outlived round-19.
3. **Five-minute dead-metric check on the existing 13** (as the task
   suggested): spot-checked two gauge-based rules, since gauges are the
   easiest metric type to leave silently unset (`Gauge` has no default
   "increment on request" path the way counters usually do). `SmsQueueBacklog`
   / `DeadLetterGrowth` read `rezervno_jobs_pending` / `rezervno_jobs_dead`,
   written by `refreshQueueMetrics()` (`api/src/lib/queue.ts:162-163`), which
   is called both from the `/api/metrics` route handler itself
   (`api/src/app/api/metrics/route.ts:56`, so every Prometheus scrape
   refreshes it) and from the worker loop (`api/src/lib/worker.ts:73`) — both
   alive, not dead. Also spot-checked `SmsFailureRate`/`SmsAllFailing`'s
   metrics: `metrics.smsSent.inc`/`metrics.smsFailed.inc` are called from 9
   distinct sites in `api/src/lib/sms.ts` covering every failure branch
   (balance check, insufficient balance, missing `bodyId`, rejected, network,
   etc.) plus the success path — alive. I did not check the remaining ~8 of
   the 13; a full audit of all pre-existing rules was not in scope for this
   pass and would need its own round.

## 9. Files touched (as of the initial close-out)

- `observability/alerts.yml` — 3 new rules (`74 insertions(+)`, `0`
  deletions in the final diff).
- `observability/alerts.test.yml` — new file, `promtool` unit tests.
- `.github/workflows/ci.yml` — new `observability` job.
- `docs/SECURITY.md` — §8 (rate-limiting section) and §12.5 (recommendations)
  updated.
- `docs/KNOWN_LIMITATIONS.md` — rate-limit fail-open bullet updated.
- `OBSERVABILITY.md` — §10 (security monitoring) corrected; it previously
  claimed alert rules were "intentionally not hard-coded," which was already
  false before this round (13 rules existed) — fixed as part of "fix what
  the directive missed," not just what it named.

---

## Reopened — coordinator review found a real hole (2026-09-04, same day)

A reviewer proved `promtool check rules` and `promtool test rules` (§4-§6
above) both stay green after renaming
`rezervno_rate_limit_fallback_total` → `..._RENAMED` in
`api/src/lib/metrics.ts:144` only, `observability/alerts.yml` left untouched.
Correct and reproduced independently below (§10). The root cause: `promtool`
only ever sees PromQL text and synthetic series — it has no way to know
whether a metric name is actually emitted by any running process. My
falsifiability work in §4 mutated the *rule side* (thresholds, `for:`); the
reviewer's mutation and mine both missed the *producer side*. Two new items,
F-C and F-E, close that and one unrelated but confirmed hole (unpinned
images).

## 10. F-C — metric↔alert binding gate

### The proof of the hole (reproduced independently)

1. Changed `api/src/lib/metrics.ts:144` from
   `new Counter('rezervno_rate_limit_fallback_total', ...)` to
   `new Counter('rezervno_rate_limit_fallback_total_RENAMED', ...)`.
   `observability/alerts.yml` untouched.
2. `promtool check rules` → `SUCCESS: 16 rules found`, **exit 0**.
3. `promtool test rules alerts.test.yml` → `SUCCESS`, **exit 0**.
4. Both green while `RateLimitRedisFailOpen`'s `expr` now refers to a metric
   nothing in the product emits. Confirmed the reviewer's finding exactly.

### What was built

New file `tools/check-alert-metric-binding.mjs` (written with the `Write`
tool, not a heredoc — see the note on this at the end of this section) plus
a new CI step in the `observability` job. It does two things, with two
different, deliberately-chosen policies:

**Forward direction — hard failure.** Every `rezervno_*` token found inside
an `expr:` field anywhere in `observability/alerts.yml` must resolve to a
metric actually declared with `new Counter(...)`, `new Gauge(...)`, or
`new Histogram(...)` somewhere under `api/src` (recursive scan, not
hardcoded to `metrics.ts` — verified first that `metrics.ts` is in fact the
only such site: `grep -rn "new (Counter|Gauge|Histogram)("` across the whole
repo found matches only in `api/src/lib/metrics.ts` and two unrelated k6
load-test files using k6's own client-side `Counter` API with non-`rezervno_`
names). A referenced-but-undeclared metric exits non-zero. Rationale: a rule
watching a name nothing emits is worse than no rule — it looks like coverage
and never fires.

**Reverse direction — warning only, never fails the exit code.** A declared
metric with no alert referencing it is printed as a non-blocking warning.
**Decision and why**: making this a hard failure would force an allowlist
almost immediately — of the 32 metrics currently declared in `metrics.ts`,
18 have no alert today (`rezervno_cache_hits_total`,
`rezervno_db_query_duration_seconds`, `rezervno_email_sent_total`,
`rezervno_jobs_processed_total`, `rezervno_slot_lock_fallback_total`, etc.),
and most of them are legitimately dashboard/debug-only signals that were
never meant to page anyone (constitution 4b: a false-positive rate that
needs more than a couple of exemptions means the *signal* is wrong, not that
it needs a bigger allowlist). `rezervno_slot_lock_fallback_total` — named
explicitly in the reopening message as "under active investigation
elsewhere, do not force a rule for it" — needed **no special-casing at all**
under this policy: it just shows up as one line in the warning list like the
other 17, exactly as intended. That is the test of whether the policy is
right: the metric that must not be forced into a rule isn't forced, without
an exception being written for it by name anywhere in the script.

### Why the extraction doesn't need an allowlist (constitution 4b, applied deliberately)

The naive version of this gate — regex the whole YAML file for
`rezervno_[a-zA-Z0-9_]+` — was tried mentally and rejected before writing
any code, because `alerts.yml` itself contains the exact trap the reopening
message warns about: **group names** (`- name: rezervno_security`,
`rezervno_queue`, `rezervno_notifications`, `rezervno_payments`,
`rezervno_business`, `rezervno_availability`) all start with `rezervno_` and
are not metric names, and **prose inside comments/annotations** mentions
metric names for documentation purposes only (e.g. this round's own new
comment: `"(rezervno_slot_lock_fallback_total، lib/redis.ts:166 — نویسنده‌اش
اما هنوز آلارم ندارد)"` inside `RateLimitRedisFailOpen`'s description — a
real sentence in a real file, not a bug, but a false positive for any
whole-file regex). Verified with `grep -n "rezervno_[a-zA-Z0-9_]+"
observability/alerts.yml`: 6 of the 27 matches are comments/annotations, not
`expr:` values. Fix: the script parses line-by-line, tracks the current
`- alert:` block, and only pulls tokens out of `expr:` field values
(handling both inline `expr: <promql>` and `expr: |` block-scalar forms by
following the block's indentation) — never from comments, `summary:`,
`description:`, or `- name:` group headers. This is a narrower, structurally
correct signal, not a workaround with exceptions.

The one deliberate, systematic (not per-metric) generalization: Prometheus
histograms expose `_bucket`/`_sum`/`_count` suffixed series that don't
literally match the declared base name (`metrics.ts`'s `Histogram.render()`
generates these three suffixes itself). `rezervno_http_request_duration_seconds_bucket`
is referenced twice (`HighLatencyP95`, `PaymentCallbackLatency`) and would
otherwise falsely fail against the declared name
`rezervno_http_request_duration_seconds`. The script strips a trailing
`_bucket`/`_sum`/`_count` and requires the base name be declared **as a
Histogram** specifically — applied uniformly to every histogram, not as a
named exception for this one metric.

### Falsifiability — both exit codes

1. **Before the mutation (baseline)**: `node tools/check-alert-metric-binding.mjs`
   → 14 referenced metrics, 32 declared, 18 orphan warnings (including
   `rezervno_slot_lock_fallback_total`), **exit 0**.
2. **Applied the exact reviewer mutation**: `api/src/lib/metrics.ts:144`
   renamed to `rezervno_rate_limit_fallback_total_RENAMED`,
   `observability/alerts.yml` untouched.
   - `promtool check rules` → `SUCCESS: 16 rules found`, **exit 0** (confirms
     the reviewer's point still stands — `promtool` alone cannot see this).
   - `promtool test rules` → `SUCCESS`, **exit 0** (same).
   - `node tools/check-alert-metric-binding.mjs` → reports
     `✗ ۱ متریک ... استفاده شده ولی در کد اعلام نشده` naming
     `rezervno_rate_limit_fallback_total ← استفاده در: RateLimitRedisFailOpen`,
     **exit 1**.
3. **Reverted** `metrics.ts:144` to the original string. `git diff --stat
   api/src/lib/metrics.ts` → empty (byte-identical to HEAD, confirmed the
   way the reviewer confirmed theirs with `cmp`).
4. **Re-ran the binding gate on the restored tree**: same 14/32/18 result as
   step 1, **exit 0**.

### CI wiring

Added a third step to the `observability` job in `.github/workflows/ci.yml`:
`node tools/check-alert-metric-binding.mjs`, after the two `promtool` steps.
Re-validated the whole workflow file with `actionlint`
(`rhysd/actionlint:latest`, Docker) after this addition: same single
pre-existing shellcheck style finding as before (line number shifted from
550 to 567, matching the 17 lines added — confirmed not a new finding), exit
1 for that unrelated reason only, same as the original committed file.

### Control-bytes guard caught a real gap in itself

Ran `node tools/check-control-bytes.mjs` after writing the new script:
`✓ ... 119 فایل`, exit 0 — but 119 was the *same* count as before the file
existed. Investigated: the guard runs `git ls-files`, which only lists
**tracked** files; a brand-new file that has never been `git add`ed is
invisible to it, silently. I `git add`ed the new script (staging only, not a
commit) and re-ran: `✓ ... 120 فایل`, exit 0 — now genuinely covering the new
file. Then `git restore --staged` to leave the tree in the same all-unstaged
state as every other file in this round. **This means my own round-1
"control-bytes guard passed" claim for `observability/alerts.test.yml` and
`audit/round-20/ALERTS-GAP.md` was accurate only by coincidence** — those
paths aren't in the guard's `SCOPE` list (`tools/`, `.github/workflows/`,
`deploy/`, `api/prisma/`, `cron/`, `backup/`) at all, so tracked-vs-untracked
never mattered for them — but `tools/check-alert-metric-binding.mjs` **is**
in scope, and the guard would have silently skipped it had I not staged it
to check. Flagged in §12 below; not fixing the guard itself (out of this
mandate's scope), but any future new file under those five directories
should be `git add`ed before trusting a green `check-control-bytes.mjs`.
Wrote the script itself with the `Write` tool, never a heredoc, precisely
because it contains regex (`/rezervno_[a-zA-Z0-9_]+/g`,
`/new\s+(Counter|Gauge|Histogram)\s*\(.../`) — this repo rule (not an
external attacker) is what the earlier round's heredoc-mangling lesson
actually is, and it applied directly here.

## 11. F-E — pin the observability images

Confirmed both unpinned locations exist exactly as reported:
`.github/workflows/ci.yml` (now two `docker run --entrypoint promtool
prom/prometheus:latest` invocations after §4/§10) and
`docker-compose.observability.yml:20` (`prom/prometheus:latest`). Checked
`docker-compose.observability.yml:50` as instructed: **same issue**,
`grafana/grafana:latest`, also unpinned.

Resolved concrete versions and verified digest equality before pinning
(never pin to a guess):

- `docker pull prom/prometheus:latest` → digest
  `sha256:5ce7540c3c00ef4ab0c9d2c995c6a5b9c421f44b4a115d97a2c7af3b1c21cbb0`.
  `docker pull prom/prometheus:v3.14.0` → **same digest**. Also cross-checked
  against `promtool --version` output from earlier in this round: `promtool,
  version 3.14.0`. Not a downgrade or a mismatch.
- `docker/grafana:latest` has no version label
  (`docker inspect ... .Config.Labels` → no `org.opencontainers.image.version`
  key), so read the real version from inside the image:
  `docker run --rm --entrypoint sh grafana/grafana:latest -c 'find / ...
  grafana ... -v'` → `Version 13.2.1`. `docker pull grafana/grafana:13.2.1`
  → **same digest** as `:latest`
  (`sha256:f772d434e8fab0049deb2b1b30abd43342bcfca1537614aa8d36080232cf4283`).

Pinned all four locations:

- `.github/workflows/ci.yml:340`, `:350` (post-F-C line numbers) →
  `prom/prometheus:v3.14.0`, with a comment matching the existing
  `mcr.microsoft.com/playwright:v1.62.1-noble` precedent (`ci.yml`, e2e job)
  — same class of problem, same "update this tag together with an upgrade"
  note.
- `docker-compose.observability.yml:20` (prometheus) → `prom/prometheus:v3.14.0`.
- `docker-compose.observability.yml:50` (grafana) → `grafana/grafana:13.2.1`.

Verified the compose file still resolves correctly after pinning:
`POSTGRES_PASSWORD=dummy REDIS_PASSWORD=dummy JWT_SECRET=... MAINTENANCE_KEY=dummy
GRAFANA_PASSWORD=dummy docker compose -f docker-compose.yml -f
docker-compose.observability.yml config --services` → lists all 7 services
including `prometheus`/`grafana`, **exit 0**; `docker compose ... config |
grep image` confirms the resolved config carries
`image: prom/prometheus:v3.14.0` and `image: grafana/grafana:13.2.1`. Also
re-ran both `promtool` commands and the new binding gate against the pinned
tag directly (not just `:latest`) — all three **exit 0**.

## 12. What this reopening still leaves unproven (added to §7's list)

- The metric↔alert binding gate protects against **rename/deletion on the
  producer side**. It does not (and cannot, by construction) protect against
  a metric being declared correctly but never actually `inc()`/`set()`'d on
  any real path — that is what §3's writer-proof and §8's "five-minute dead
  metric check" cover, by reading call sites, not by this gate. The two are
  complementary, not substitutes for each other.
- `check-control-bytes.mjs`'s blind spot for untracked files (§10) is a
  pre-existing gap in a guard I didn't write and didn't fix — flagged, not
  addressed, since fixing `git ls-files` vs `git status --porcelain -uall`
  behavior in that script is a separate, scoped change with its own
  blast-radius (it would then also start seeing every stray untracked file
  in five directories, which could be noisy) that deserves its own review
  rather than a drive-by edit inside this mandate.
- Did not re-verify the other 13 pre-existing rules against the new binding
  gate individually beyond what the tool itself reports (it did check all
  16 rules' `expr` fields in the same pass — the 14 referenced metrics
  span all 16 rules, not just the 3 from round 20 — but I did not separately
  narrate each of the other 13 the way §3 did for the new three).

## 13. Files touched, this reopening

- `tools/check-alert-metric-binding.mjs` — new file, the binding gate.
- `.github/workflows/ci.yml` — new step in the `observability` job; pinned
  both `promtool` image references to `v3.14.0`.
- `docker-compose.observability.yml` — pinned `prometheus` to `v3.14.0` and
  `grafana` to `13.2.1`, each with a comment.
- `audit/round-20/ALERTS-GAP.md` — this section.

Nothing committed — tree left for review, same as the initial close-out.
