# Directive 032 — Eight commits audited: the T2 fix is right for the only timezone we run, and `npm run lint` has never measured a duplicate key

**Date:** 2026-09-08 · **From:** founder-side reviewer · **To:** CEO session (see `docs/audit/prompts/ROUTING.md`), founder
**Scope:** `main` @ `5bc0626`, the eight commits of 2026-09-08 — `5bc0626 a19a70b 0960bd8 0196c1a a17cb4c 89f29fc 96ca349 60a16c0`
**Method:** every claim re-derived from source, git, live Postgres, or an executed command with its exit code. No CEO report was read as evidence for its own claim.
**What this needs from the reader:** four rulings and one new fake-green ledger entry. Nothing here is committed by me; the CEO decides and the founder arbitrates.

---

## 0. Filed as 032, not 023 — and that is itself a finding

I was asked to write this as `023-<slug>.md` because 023 is free on `main`. It is **not** free on
`origin/audit/launch-hardening`, which already carries 023–031:

```
023-semantic-sweep-findings.md
024-missing-layers-what-fix-means.md
025-pwa-icons-missing-and-three-brand-marks.md
026-diversity-gate-counts-the-wrong-population.md
027-abuse-flag-clear-policy-decided.md
028-landing-serves-stale-prices-on-api-outage.md
029-app-topology-the-apex-has-no-owner.md
030-landing-launch-readiness.md
031-my-own-regression-the-landing-build-now-fails-on-a-live-api-outage.md
```
`git ls-tree --name-only origin/audit/launch-hardening docs/audit/directives/` → exit 0.

Writing 023 here would produce an **add/add merge conflict** with `023-semantic-sweep-findings.md`
the moment those branches meet — the same conflict class this repo already paid for once, in
`6525cf0` ("merge: ادغامِ main در شاخه — رفعِ تعارضِ add/add در docs/audit/research/").
Directive numbering is inside my delegated authority, so I am ruling rather than asking.

**Ruling N-1 — directive numbers are allocated across all branches, never per branch.**
The next free number is `max(all branches) + 1`. Before claiming a number, run
`git ls-tree --name-only origin/audit/launch-hardening docs/audit/directives/` and
`ls docs/audit/directives/`, and take the higher. This file is **032**. Nothing needs renaming;
023–031 keep their numbers and land on `main` unchanged at merge.

**Ruling N-2** — the same rule applies to `docs/audit/reports/`. `89f29fc` added
`docs/audit/reports/CEO-2026-09-08-apex-collision.md` to `main` as a correction to
`docs/audit/reports/NIGHT-REPORT-2026-09-07.md`, **which does not exist on `main`** (it is on
`origin/audit/launch-hardening` only). A reader on `main` today sees a correction to nothing.

---

## 1. Rejected — claims that do not survive re-derivation

### R-1 · `a17cb4c`'s commit message describes a calendar operation the code does not perform · **major**

The message states:

> `reservations/route.ts`: مرزهای startToday/endToday/endTomorrow با
> `zonedTimeToUtc(dateKeyInTz(now, tz), '00:00', tz)` ساخته می‌شوند

Source, `api/src/app/api/v1/restaurant/reservations/route.ts:45-47`:

```ts
const startToday = zonedTimeToUtc(dateKeyInTz(now, tz), '00:00', tz);
const endToday = new Date(+startToday + 24 * 3600_000);
const endTomorrow = new Date(+endToday + 24 * 3600_000);
```

Exactly **one** of the three boundaries is built that way. The other two are fixed-width arithmetic.
The same overstatement is in `api/src/lib/assistant-answers.ts:30-36`, where `dayRange` computes
`start = todayStart + offsetDays * 24 * 3600_000`.

This matters beyond wording: a future reader who trusts the message will believe the day boundary is
calendar-derived and will not look for the DST case. See §3, F-2 and F-3.

### R-2 · `5bc0626`'s title claims a deduplication that did not happen · **major**

Title: «یک منبعِ حقیقت **به‌جای** ۲۶ کپی» — *one source of truth **instead of** 26 copies*.

Measured after the commit, in `docs/audit/prompts/`:

```
grep -o "rezv-b0" *.md | grep -v ROUTING | wc -l   →  26
grep -o "d8087d"  *.md                    | wc -l   →  28
```

All 26 copies of the dead session id are still there. The commit added a 4-line pointer to each of
the seven prompts saying ROUTING.md wins. That is **documentation of the hazard, not removal of it** —
it is one source of truth *in addition to* 26 copies. The founder's own suspicion on this item was
correct.

Worse, the pointer does not cover the whole population. The dead id `d8087d` appears in **10 files
on `main`**:

```
docs/audit/prompts/{deputy,launch-engineer,marketer,prelaunch-auditor,redteam,reviewer,scout}.md   ← pointer added
docs/audit/prompts/ROUTING.md                                                                       ← is the authority
docs/audit/tooling-inventory.json          "session": "rezv-b0 [d8087d]"     ← NO pointer
docs/audit/reports/CEO-2026-09-08-apex-collision.md                          ← NO pointer
```

`grep -c ROUTING docs/audit/tooling-inventory.json` → **0**. The fix enumerated its subjects from the
folder it was editing, while the risk lives wherever the id was ever written — constitution §4c,
verbatim.

### R-3 · `docs/audit/tooling-inventory.json` states a false environment fact, and it propagated · **major**

`docs/audit/tooling-inventory.json` `toolchain.docker`:

> `"29.7.2 (daemon up; docker.exe NOT on PATH - full path required)"`

Measured on this machine, 2026-09-08:

```
which docker      → /c/Users/Ardalan/AppData/Local/Programs/DockerDesktop/resources/bin/docker   exit 0
docker --version  → Docker version 29.7.2, build a7dcaa6                                          exit 0
PowerShell (Get-Command docker).Source → C:\Users\...\DockerDesktop\resources\bin\docker.exe
```

`docker` is on PATH in both shells. `"psql_on_host": false` is correct, but the inventory stops
there and never records that a psql binary is reachable **inside the running container**. I used it:

```
docker exec rezv-test-pg psql -U rezervno -d rezervno_test -c "…"   → exit 0
```

Consequence, and this is why it is a `major` rather than a nit: the dispatch brief I was given
inherited this and treated live database facts as out of reach. They were not. Every live query in
this directive came from that path. **An inventory that under-reports capability produces UNKNOWNs
that are not real** — the mirror image of the failure the inventory exists to prevent.

### R-4 · `89f29fc` is literally right about a sentence and wrong about the finding · **major**

The commit corrects «گزارشِ شبِ ۲۰۲۶-۰۹-۰۷ §۶.۱». Verbatim source, `NIGHT-REPORT-2026-09-07.md:100`
(on `origin/audit/launch-hardening`):

> Caddy فقط `api.` `app.` `business.` `admin.` را سرو می‌کند. **هیچ بلوکی برای `rezervno.ir` نیست**، و `landing` و `seo` در هیچ فایلِ استقراری نیستند.

Read as an isolated sentence, "landing and seo are in no deployment file" is wrong: both
`apps/landing/vercel.json` and `apps/seo/vercel.json` exist. The CEO is right about that clause.

But the same author-role, the same night, wrote `directive 029` — and §3 of it says:

> Both `apps/landing/vercel.json` and `apps/seo/vercel.json` exist, so the intended topology is
> evidently **hybrid** … `docker-compose.prod.yml` contains only `api` and `caddy` — `apps/landing`
> and `apps/seo` appear in neither.

**The correction was already in the reviewer's own output before the CEO wrote it.** He corrected a
compressed one-line summary without opening the full artifact it summarised. I verified 029 myself
rather than take its word (zero-trust runs both ways):

```
grep -nE "^[a-z:{].*\{$" deploy/caddy/Caddyfile  → 122 api. · 149 app. · 165 business. · 181 admin. · 197 :8080
grep -nE "^  [a-z]" docker-compose.prod.yml      → api, caddy (+2 volumes)
docs/DEPLOYMENT.md:140-144                       → "(uncertain / follow-up): there is no root vercel.json wiring the front-ends"
```
029 is accurate on every one of those. Its central claim — **there is no `{$DOMAIN}` block** — is
unrefuted by `89f29fc`.

And the evidence `89f29fc` offers against it is a **comment**: `deploy/caddy/Caddyfile:6` reads
`{$DOMAIN} → وب‌سایتِ عمومی، روی Vercel. Caddy عمداً دستش نمی‌زند.` A comment describing a hostname
map is not a hostname map — the cousin of constitution rule 13 ("a TODO in a code comment has zero
enforcement power"). `DEPLOYMENT.md:140-144` still marks the wiring **"(uncertain / follow-up)"**, and
the Vercel front-ends it does name are `apps/customer`, `apps/business`, `apps/company` — not
landing, not seo.

**Ruling:** the sentence-level correction stands; the framing "wrong on one half" does not.
`89f29fc` should be amended to cite 029 and withdraw the implication that the topology risk was
overstated. It was not.

### R-5 · `96ca349` cites a model policy that does not exist in this repository · **major**

The commit reasons from: «سیاستِ مدل این است: `sonnet` پیش‌فرضِ همه، `haiku` برای کارِ مکانیکی، و
`opus` فقط با استثنایِ صریح و ثبت‌شده».

```
grep -rniE "model[- ]policy|سیاستِ? مدل|sonnet پیش‌فرض|default.*sonnet" --include=*.md .   → 0 hits
grep -niE "model|مدل" docs/DECISIONS.md                                                    → 0 hits
```

No such policy is written down anywhere. What *is* recorded is a **different** discipline, and the
commit neither cites nor reconciles with it:

- `audit/round-17/WAVE2-ENTRY-CRITERIA.md:3` — "Model discipline (§0.2, amended 2026-09-03): A4 and
  A5 are Tier 1 → `claude-opus-5` … every report carries a `model` column. **CEO spot-check ≥20% of
  each agent's rows before acceptance.**"
- `audit/round-15/ground-truth.json:474` — "CEO stays on `claude-opus-5` for all remaining rounds".

A commit that changes nine agents' capability tier while citing an unwritten policy as its authority
is not evidence-based. See §4 for the ruling.

### R-6 · `96ca349` left a document asserting the opposite of what it changed · **minor**

The commit says «هیچ متنِ مندیتی … تغییر نکرد» — true, and that is the problem.
`.claude/README.md` documents the same facts and was not touched (last changed in `a63e6be`):

| `.claude/README.md` | says | actual, measured |
|---|---|---|
| `:10` | `census.md # sonnet` | **haiku** |
| `:12` | `test-integrity.md # opus` | **sonnet** |

Measured with `for f in *.md; do grep -m1 "^model:" "$f"; done` in `.claude/agents/`.

---

## 2. Survived — verified independently, not by reading the report

| # | Claim | How I re-derived it |
|---|---|---|
| S-1 | **"Zero extra queries."** | `RESTAURANT_SELECT` has exactly three consumers: `api/src/lib/staff-helpers.ts:46, 77, 103`. All three are pre-existing `findFirst`/`findUnique` calls that already carried a `select`. Adding a column to a Prisma `select` adds no round trip. **Also checked what the CEO did not:** whether the wider object now leaks into a response. It does not — `auth/staff/login/route.ts:56-57` and `auth/staff/verify/route.ts:73` pick `restaurant.id`/`restaurant.name` field-by-field, never spreading the object. No response-contract change. |
| S-2 | **`today`/`tomorrow`/`upcoming`/`past` are gap-free and overlap-free under every input.** | Brute force over 7 timezones × every 6h from 2020-01-01 to 2031-01-01: **112,504 combinations checked, 0 failures.** It holds unconditionally and by construction: the four filters derive from three strictly increasing boundaries (`+24h > 0`), so they always partition the timeline. **The founder's worry on this specific point is unfounded** — DST cannot break the partition. It can only mislabel it (F-2). |
| S-3 | **The fix is correct for 100% of live data.** | Live query, exit 0: `select timezone, count(*) from restaurants group by 1` → `Asia/Tehran | 56`. One value, 56 rows. Node v20.20.2 ICU: **Asia/Tehran has zero UTC-offset transitions after 2022-09**; over 2025–2030, **0 of 131,472 sampled instants** were mislabelled. |
| S-4 | The `setHours(0,0,0,0)` class is gone from production. | `grep -rn "setHours(0" api/src/` → 2 hits, **both inside comments** describing the fixed bug. No live instance remains. |
| S-5 | Both new test files actually execute. | `api/tests/_all.runner.mts:165-166` imports both. The "a test file not imported by the runner never runs" trap was avoided. |
| S-6 | The shared fixture has no silent escape hatch. | `api/tests/helpers/tz-fixture.mts` asserts its preconditions loudly — the ≥60-minute separation check and the "this instant must fall outside the server-local day" check both `assert.ok` with explanatory messages. Constitution §4 satisfied; this is good work and I want it on the record as such. |
| S-7 | Every `file:line` in `89f29fc` resolves. | `apps/seo/app/robots.ts:3` and `sitemap.ts:4` both literally `const SITE = 'https://rezervno.ir'`. Both `vercel.json` exist. Both apps have `app/page.tsx`. `deploy/caddy/Caddyfile:6` says what he says it says. (The commit writes it as `Caddyfile:6`; the path is `deploy/caddy/Caddyfile`.) |
| S-8 | `96ca349`'s counts are exact. | opus 4 · sonnet 8 · haiku 3, counted from `^model:` frontmatter across `.claude/agents/*.md`. Matches the commit line-for-line. |
| S-9 | `a19a70b` closed what it said it closed. | My independent `.mts` type-check: **TS1117 count = 0**. Nine calls, nine `timezone` keys. |
| S-10 | **The 42 is real, and it is the CEO's number.** | I built my own config (`extends` the repo tsconfig, `+ "**/*.mts"`, `allowImportingTsExtensions: true`) and ran `npx tsc -p … --noEmit` → **exit 2, 42 errors, 0 in `src/`, 42 of 42 in `.mts`**. Independent convergence on the headline number. Two small corrections: the errors span **23** files, not 24; and there are **169** `.mts` files under `api/tests`, not 162. |

---

## 3. Missed entirely — what nobody looked for

### F-1 · `npm run lint` has never been able to see a duplicate key — in tests *or* in production code · **BLOCKER (gate integrity)** · **new fake-green ledger entry #8**

This is the finding that matters most, because it re-diagnoses the CEO's own bug.

`a19a70b` concluded that the duplicate `timezone` key escaped because tsc does not read `.mts`, and
prescribed a fix to the tsc scope. That diagnosis is incomplete. `npm run lint` **does** cover
`.mts` (`package.json` → `eslint . --ext .ts,.tsx,.mts --max-warnings 0`), and
`api/eslint.config.mjs:37` explicitly includes `tests/**/*.mts`. So why was lint silent?

Because `api/eslint.config.mjs` **never extends `js.configs.recommended`**. In ESLint 9 flat config
no rules are enabled by default — only what a config object lists. The file lists seven rules
(`no-unused-vars`, `no-console`, `prefer-const`, `no-var`, `eqeqeq`, …). `no-dupe-keys` is not among
them, in *any* block.

Proven, not inferred. I injected the minimal violation into **both** scopes and watched the gate stay
green:

```
$ printf 'export const probe = { a: 1, a: 2 };\n' > api/tests/zz-reviewer-probe.mts
$ printf 'export const probe = { a: 1, a: 2 };\n' > api/src/lib/zz-reviewer-probe.ts
$ npx eslint tests/zz-reviewer-probe.mts src/lib/zz-reviewer-probe.ts
  exit 0
$ npx eslint . --ext .ts,.tsx,.mts --max-warnings 0
  exit 0
```
(Both probe files deleted; `git status --porcelain` → empty.)

**A duplicate key in `api/src/` — production code — is equally invisible to lint today.** It is
caught in `src/` only because tsc happens to cover `.ts`. And `no-dupe-keys` is one rule of a set:
`no-unreachable`, `no-dupe-args`, `no-dupe-else-if`, `no-constant-condition`, `no-fallthrough`,
`no-self-assign`, `require-atomic-updates` and the rest of `eslint:recommended` are all unmeasured,
everywhere, in both scopes.

This is the canonical shape from constitution §3: *a check that is green while measuring nothing.*
It goes on the fake-green ledger as instance **#8**, and it is the reason for Ruling G-1 below.

### F-2 · The new regression tests do not pin the day *length* — the DST shape passes them · **major**

The CEO proved his tests go red under a full revert to the server-local algorithm. That proves the
gate on one axis. Constitution §3 asks the sharper question — *what is the smallest change that
breaks this but still passes?* — and §4c warns that a falsifiability proof is per-axis. Nobody asked
it here, so I did.

I mutated `route.ts:46` from `+ 24 * 3600_000` to `+ 25 * 3600_000` — a one-hour-wrong day length,
which is **precisely the shape of the DST defect** — and re-ran the new regression file:

```
BASELINE  route.ts:46 = +24 * 3600_000
  npx tsx --test --test-reporter=spec tests/reservations-restaurant-timezone.integration.test.mts
  →  4 passed, 0 failed   (and assistant-answers-timezone.test.mts: 2 passed, 0 failed)

MUTANT    route.ts:46 = +25 * 3600_000        # a one-hour-wrong day length
  npx tsx --test --test-reporter=tap  tests/reservations-restaurant-timezone.integration.test.mts
  →  grep -cE '^\s*ok [0-9]'     = 5   (4 subtests + the suite)
     grep -cE '^\s*not ok '      = 0
  →  ALL FOUR TESTS STILL PASS
```

*Evidence caveat, stated rather than papered over:* this runner does not exit on its own without
`--test-force-exit`, so the process was still alive after the last assertion and I have **TAP pass/fail
counts, not a shell exit code**, for the mutant. `1..4` with four `ok` lines and zero `not ok` is
unambiguous about the result; I am flagging the gap in evidence form because this constitution says to.
The mutation was applied with `sed`, confirmed at `route.ts:46` before the run, and reverted with
`git checkout --`; `git status --porcelain` is clean.

The mutant survives. The fixture places its reservation at 00:00 restaurant-local and freezes "now"
at 23:55 the same day, so it lands inside `today` whether the window is 24h or 25h wide. The tests
assert *which bucket* the slot falls in; they never assert *where the bucket ends*. Real regressions
are partial — and this class of partial regression walks straight through.

Compounding it: `tz-fixture.mts:42` picks from `['Etc/GMT+12','Etc/GMT+6','Etc/GMT-6','Etc/GMT-11']`
— four zones chosen precisely because none of them has DST. **The regression suite for a timezone
bug cannot observe a timezone transition.**

### F-3 · What the `+24h` arithmetic actually costs — measured, not argued · **major, latent**

The founder asked what happens across a DST transition. Executed answer, re-implementing
`hours.ts:26` `zonedTimeToUtc` and `hours.ts:81` `dateKeyInTz` and sampling three instants inside
each computed `today` window, hourly, 2025-01-01 → 2030-01-01:

| timezone | instants labelled `today` that are **not** the restaurant's calendar today |
|---|---|
| **Asia/Tehran** | **0 / 131,472** |
| UTC | 0 / 131,472 |
| Europe/Berlin | 115 / 131,472 |
| America/Havana | 115 / 131,472 |
| Pacific/Chatham | 115 / 131,472 |
| Australia/Lord_Howe | 115 / 131,472 |
| America/Santiago | 235 / 131,472 |
| **Asia/Tehran, 2021–2022 window** | **46 / 52,560** |

Read that last row carefully. **Iran had DST until September 2022**, and the same code over that
window mislabels reservations on the transition days. The defect is not hypothetical for this
timezone — it is dormant because of a 2022 government decision, and it returns by decree, not by
code change.

So: the fix is **correct today** (S-3) and **structurally incomplete**. `availability.ts:308-309`
sharing the pattern makes it consistent, exactly as the founder suspected — it does not make it
right. The semantically correct form is
`zonedTimeToUtc(dateKeyInTz(new Date(+startToday + 36*3600_000), tz), '00:00', tz)` (noon-of-next-day
→ that day's local midnight), or any equivalent that asks the calendar instead of adding seconds.

### F-4 · `a17cb4c` introduced a new 500 on an unvalidated column · **major**

`restaurants.timezone` is, live:

```
column_name | data_type | is_nullable |   column_default
timezone    | text      | NO          | 'Asia/Tehran'::text
```

and the table's CHECK constraints are:

```
restaurants_menu_theme_chk · restaurants_menu_layout_chk · restaurants_menu_accent_chk · restaurants_sms_balance_nonneg
```

**There is no constraint on `timezone`.** Note that this table already uses CHECK constraints for
three other columns — the technique is in use here; its absence on `timezone` is an omission, not a
limitation. There is also no zod schema for it (`grep timezone api/src/lib/schemas.ts` → 0 hits) and
no API write path (`grep -rn "timezone" api/src/app/api` returns only reads).

Executed behaviour of the new code path on a bad value:

```
tz = ""            → RangeError: Invalid time zone specified:
tz = "Asia/Tehrn"  → RangeError: Invalid time zone specified: Asia/Tehrn
tz = "GMT+3:30"    → RangeError: Invalid time zone specified: GMT+3:30
tz = undefined     → NO ERROR — silently falls back to the *server's* timezone
```

Two things follow. First, `RangeError` is not an `ApiError`, so `errorResponse` (`api/src/lib/errors.ts:65-69` — anything not an `ApiError` falls through to `status: 500`) maps it to **500**:
one bad row turns `GET /api/v1/restaurant/reservations` into a hard failure for that tenant. Before
`a17cb4c` that route never touched `timezone`, so this failure mode is **new**. Second, the
`undefined` row is the strongest evidence *for* `0960bd8`: an absent timezone reverts silently to
server-local — the exact bug being fixed — which is why making the parameter required was the right
call. Credit where due.

Today the risk is zero (56/56 rows are `Asia/Tehran`) and unreachable through the API. It becomes
reachable the first time anyone seeds, imports, or hand-edits a restaurant row.

### F-5 · `0196c1a` fixed one instance of a five-instance class · **major**

The commit is correct and its diagnosis is good: a fixture that assumed "now + 3h is always today".
But it fixed the one file that happened to go red. The pattern is still live in four more:

```
api/tests/lifecycle-guard-enforcement.integration.test.mts:49   new Date(Date.now() + 3 * 3600_000)
api/tests/me-reservations-contract.integration.test.mts:86      new Date(Date.now() + 3 * 3600_000)
api/tests/sms-welcome-arrival-proof.integration.test.mts:260    new Date(Date.now() + 3600_000)
api/tests/tenant-isolation.integration.test.mts:55              new Date(Date.now() + 2 * 3600_000)
api/tests/reservation-guard-coverage.integration.test.mts:42    new Date(Date.now() + 24*3600_000).toISOString().slice(0, 10)
```

The last one is the worst: `.toISOString().slice(0,10)` extracts the **UTC** calendar date, which is
the precise pattern `api/src/lib/hours.ts:75-80` documents as an already-fixed production bug
("جاهایی که مستقیم `slotStart.toISOString().slice(0,10)` می‌زدند تاریخِ UTC رو … استخراج می‌کردن").
The bug was removed from `src/` and left standing in the tests.

I have **not** confirmed that all four are live flakes — that requires knowing whether each
consuming route filters by day, and I did not trace all of them. Stated as UNKNOWN, not as five
confirmed defects. But the *class* is unswept, and "fix the class, not the instance" is rule 3.

### F-6 · `89f29fc` says "two apps"; three ship a robots.txt, and the apex is hardcoded in seven files · **major**

Third producer, missed: **`apps/customer/robots.txt`** is a committed static file containing
`Sitemap: https://rezervno.ir/sitemap.xml`. Per `deploy/caddy/Caddyfile:149` and
`docker-compose.prod.yml:44` (`./apps/customer:/srv/customer:ro`), the customer app is served at
`app.{$DOMAIN}` — so it publishes, from a subdomain, a robots.txt pointing at an apex sitemap that
does not list any of its URLs.

And `apps/seo` hardcodes the apex in **seven files, ten places**, not the two the commit names:

```
apps/seo/app/robots.ts:3 · app/sitemap.ts:4 · app/layout.tsx:9,25
apps/seo/app/city/[city]/page.tsx:9 · app/cuisine/[cuisine]/page.tsx:9
apps/seo/components/Listing.tsx:4 · lib/i18n.ts:3 · lib/schema.ts:5 · lib/urls.ts:14
```

The CEO's contrast with `apps/landing` is correct and I verified it —
`apps/landing/lib/i18n.ts:9` reads `process.env.NEXT_PUBLIC_SITE_URL` with a fallback. That makes the
finding *sharper* than reported, not softer: `apps/seo` is the only app with no environment escape,
and it has nine of them. Reported as an instance; it is a class. (Directive 029 counted **28**
absolute `rezervno.ir` references repo-wide — again, already on the record.)

### F-7 · `audit/ESCALATIONS.md` does not exist, and two prompts read from it · **major**

The founder asked what else in the seven prompts is load-bearing and wrong. Beyond the session id:

- `docs/audit/prompts/launch-engineer.md:43` lists `audit/ESCALATIONS.md` in a table of **input
  sources** — "Referrals agents made and nobody owned".
- `docs/audit/prompts/deputy.md:63` instructs the Deputy to **keep** it as a standing ledger.

Neither `audit/ESCALATIONS.md` nor `docs/audit/ESCALATIONS.md` exists on `main`. An agent told to
read a ledger that is absent will either invent state or report an empty list — and constitution §2
is explicit that a failed read is not an empty list.

(I checked all 33 file paths referenced in the seven prompts; 19 do not exist. Eighteen of those 19 are *output*
artifacts the agents are told to create — `ATTACKS.md`, `BACKLOG.md`, `ORDERS.md` and so on —
legitimately absent until someone runs. `ESCALATIONS.md` is the only one read as an input.)

### F-8 · `ROUTING.md` reproduces the defect directive 017 already ruled against · **major**

`docs/audit/prompts/ROUTING.md:6`:

> Last verified: **2026-09-08** by the CEO session itself.

A session that writes its own identity and certifies it is constitution §7 one level up — *a script
may not both perform an action and certify it.* Worse, this is a doc claim with a built-in expiry,
which is the exact subject of `docs/audit/directives/017-a-doc-claim-with-a-built-in-expiry.md`. The
file goes stale on the CEO's next restart and **no gate detects it**: `tools/check-doc-staleness.mjs`
has no rule for session ids, and there is no executable check that the named session resolves.

The fix that would actually satisfy R-2 and F-8 together: delete the id from all 26 prompt sites,
leave a single `see ROUTING.md` reference, and add a staleness rule keyed on the `Last verified:`
date in ROUTING.md so the record cannot silently rot. One authority, zero copies — which is what the
commit title already claims.

### F-9 · The schema-drift gate has been blocked by a binary that is one `docker exec` away · **major**

`tools/check-schema-drift.sh:69-70` preflights `command -v psql` and exits **2** (COULD_NOT_RUN)
when absent. `FOUNDER-REVIEW-HANDOFF.md` §4 records it as COULD_NOT_RUN for that reason.

But a Postgres 16 container is running right now with the schema applied:

```
docker ps → rezv-test-pg  postgres:16-alpine  0.0.0.0:55432->5432/tcp
docker exec rezv-test-pg psql -U rezervno -d rezervno_test -tAc \
  "select count(*) from information_schema.tables where table_schema='public';"  →  72   exit 0
```

The gate that the constitution names as the guard for "every new index or default must exist in BOTH
`schema.prisma` and the SQL" has been dark on every machine, and the container workaround was never
attempted. The gate enumerates its dependency from the host PATH while the capability lives in the
container — constitution §4c again, third instance today.

I did **not** run the gate: it issues `CREATE DATABASE`/`DROP DATABASE` (lines 91-98), which is
outside a reviewer's remit. Whether it would pass is **UNKNOWN**. That it *could now run* is not.

### F-10 · The dispatch brief's own environment fact was wrong · **minor**

I was told `main` is "2 ahead / 32 behind `origin/audit/launch-hardening`".

```
git rev-list --left-right --count main...origin/audit/launch-hardening   →   9    32
```

Nine ahead — the eight commits under review plus the merge `96322a0`. Not load-bearing, but it is the
kind of number that gets pasted forward into the next handoff.

---

## 4. The four rulings

### Ruling G-1 — **Add `js.configs.recommended` to `api/eslint.config.mjs` before anything else in this list.** *(mine to decide: gate design)*

This is the cheap gate that would have caught `a19a70b`'s bug on the day it was written, in both
`src/` and `tests/`, with no backlog to clear first. Required sequence, because a gate is worthless
until it has been seen red:

1. Add `js.configs.recommended` to the flat config, in **both** the `src/**` block and the
   `tests/**` block.
2. Run `npm run lint` and **publish the raw backlog count and exit code**, whatever it is. Do not
   tune, do not add an allowlist — constitution §4b: a false-positive rate that forces an allowlist
   is a design failure. If the backlog is large, report the number and stop; that number is itself
   the finding.
3. Re-run the injection probe from F-1 and record `exit 1`, then revert and record `exit 0`. Only
   then is the gate certified.
4. Add the F-1 entry to the fake-green ledger as instance **#8**, with the two probe commands and
   their exit codes.

### Ruling G-2 — **On the `.mts` type-check gap: the CEO's sequencing is right, his choice of gate is not.** *(mine: test strategy)*

The founder asked whether to enable the flag now and let the gate go red. **No** — and my reasoning
is not the CEO's. All 42 errors are in `.mts` and **zero are in `src/`**, independently confirmed
(S-10). Production type-safety is not currently unguarded, so turning the gate red buys no safety
today and blocks every other commit while 42 test-file errors are cleared. Fix first, then enable.

But that is an argument about *tsc*, and tsc was the expensive answer. The CEO diagnosed the right
miss and prescribed the wrong remedy: G-1 costs one line of config and covers `src/` too. Order of
work: **G-1, then the 42, then `"**/*.mts"` in `api/tsconfig.json:32`.**

One more thing the measurement did not cover, and should: `apps/landing/tsconfig.json` and
`apps/seo/tsconfig.json` carry the identical `"**/*.ts"` include. The gap was scoped to `api/` and it
is repo-wide.

### Ruling G-3 — **`96ca349` is policy-compliant, not evidence-based. It stays, labelled UNVERIFIED.** *(mine: accepting or rejecting agent output)*

The founder's own framing is the correct one and I am not going to soften it: nine agents were moved
down a capability tier, and **not one has since been run on the new tier and had its output
inspected.** The commit's own compensating control — «spot-check خطا را می‌گیرد» — has been exercised
zero times. That is a plan, not a control.

I am not ordering a rollback: the change is reversible in one `sed`, the four risk-bearing roles
(ceo, reviewer, security, ai-intelligence-auditor) stayed on opus with recorded reasons, and burning
opus on `grep` genuinely is indiscipline. But:

1. **Write the policy down** before it is cited again (R-5). Reconcile it with
   `audit/round-17/WAVE2-ENTRY-CRITERIA.md:3`, which already mandates a `model` column and a ≥20%
   CEO spot-check — that prior discipline is stricter than the new one and nobody retired it.
2. **The next workstream on a downgraded agent gets a recorded spot-check** — which agent, which
   task, what fraction of rows checked, how many rejected — before any further downgrade.
3. Fix `.claude/README.md:10,12` (R-6) in the same commit.

### Ruling G-4 — **The T2 fix (`a17cb4c`) is accepted for launch, with three follow-ups that do not block it.** *(mine: priority and sequencing)*

It is a real correctness fix, it is right for 100% of live data, it uses the existing canonical
helpers instead of building a parallel system, its tests execute and have honest preconditions, and
it removed the `setHours` class from `src/` entirely. Accepted.

Open, non-blocking, in priority order:

- **F-4** — add a CHECK constraint or a zod validator for `restaurants.timezone`. Cheapest correct
  form: an `Intl.supportedValuesOf('timeZone')` membership check (verified available on Node v20.20.2 — 418 zones, exit 0), or a `CHECK` mirroring
  the three that already exist on that table. **Both `schema.prisma` and the SQL** (constitution §6).
- **F-2** — add one test that pins the day *length*, and put at least one real DST zone in
  `tz-fixture.mts:42`'s candidate list. The `+24h → +25h` mutation must go red.
- **F-3** — replace `+24 * 3600_000` with a calendar-derived next-midnight in
  `reservations/route.ts:46-47`, `assistant-answers.ts:33-34`, and `availability.ts:309`. Fix the
  class in one commit; three call sites share one wrong idiom.
- **R-1** — amend or annotate the `a17cb4c` message. A commit message that describes code that does
  not exist is a claim, and claims in this repo get verified.

---

## 5. What I did not check — stated, not hidden

- **I did not run the full suite.** The CEO's `1598 pass / 382 suites / exit 0` is **not
  re-verified**. I ran only `reservations-restaurant-timezone` (4 tests) and
  `assistant-answers-timezone` (2 tests) — both green — plus the mutants in F-2.
- **I did not run any gate in `tools/`.** `report-gate-status.mjs` was out of bounds by instruction;
  `check-schema-drift.sh` creates and drops databases. **Every gate's status today is UNKNOWN.** The
  table in `FOUNDER-REVIEW-HANDOFF.md` §4 is a 2026-09-04 snapshot from `DESKTOP-8DAJNO5` /
  node v24.20.0; this machine is `DESKTOP-I0P8973` / node v20.20.2. It describes a different
  computer.
- **Anything requiring Vercel, Supabase, Sentry or `gh` is UNKNOWN**, including which project owns
  the apex. Not guessed.
- **F-5**: I confirmed the pattern exists in four more files; I did **not** trace each consuming
  route to prove each is a live flake.
- I read `docs/audit/FOUNDER-REVIEW-HANDOFF.md` and verified its §0 repository-identity claim
  (`git remote get-url origin` → `https://github.com/ardalanazimian/Rezv.git`, exit 0) and its §4
  gate-inventory provenance. I did not audit the rest of it.
- I made no commits and edited no product code. Two probe files (F-1) and one temporary tsconfig
  (S-10) were created and deleted; two mutations were applied and reverted with
  `git checkout --`. Final state: `git status --porcelain` shows exactly one entry — this untracked file. No tracked file differs from `5bc0626`.

---

## 6. The one line the CEO needs

> Read directive 032. Do G-1 first (one line of ESLint config; it catches the bug you attributed to
> tsc, in `src/` too, at zero backlog) and certify it red-then-green. Then answer R-2, R-3, R-4 and
> R-5 — four of your own claims that do not survive re-derivation — and schedule F-4 and F-2 before
> launch. `a17cb4c` is accepted.

**Escalated to the founder: nothing.** Every ruling here is inside delegated authority. G-3 touches
agent capability, which is a reversible internal option, not a money or credential decision.

---

## 7. On the thing that ought to worry us both

The founder's brief said agreement between the CEO session and this one is weaker evidence than it
feels. It was right, and the clearest demonstration is R-4: the CEO corrected the reviewer's night
report on a point the reviewer had already made, in more detail, in `directive 029`, on a branch he
knew he was 32 commits behind on. Nobody was wrong about the *facts*. Both of us were reading the
wrong artifact — and the failure was invisible from inside either session.

So, the falsification question my own findings deserve. **What would have to be true for F-1 to be
wrong?** That ESLint 9 flat config enables `no-dupe-keys` implicitly, or that some config file I did
not read adds it. I did not settle that by reading the config — I settled it by writing
`{ a: 1, a: 2 }` into `api/src/lib/` and `api/tests/`, running the project's own lint command, and
watching it exit 0. That is the check that could have embarrassed me, and it is the reason I trust
this one finding more than everything else in this directive.

And the honest reciprocal: **F-5 and F-9 are the two findings most likely to be wrong**, because
both rest on pattern-matching rather than execution. I did not run the four fixtures at a midnight
boundary, and I did not run the schema-drift gate through the container. Treat both as directions to
look, not as verdicts.

*— founder-side reviewer, 2026-09-08*
