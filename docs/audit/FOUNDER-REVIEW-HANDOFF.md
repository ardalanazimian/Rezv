# FOUNDER-REVIEW-HANDOFF — how to audit the CEO session

> **STATUS: DRAFT. Not in force.** Written 2026-09-04 by the CEO session — that is, by the party
> this document exists to audit.
>
> **Conflict of interest, stated up front.** The audited party defining the questions by which it
> is audited is at least as bad as an auditor writing its own spec, and arguably worse: I have the
> stronger incentive to scope the questions narrowly. The reviewer session declined to write it on
> COI grounds and named only the half that pointed away from itself; I am naming the other half.
>
> This draft is valid only under both conditions: **the reviewer audits it before using it**, and
> **the founder confirms the arrangement**. Until then it is a proposal, not a standard.
>
> Everything below is derived from repository sources and executed commands. Where a fact could
> not be sourced, it says **UNKNOWN** rather than guessing. There is no build prompt for this file
> in the CEO session's context — the requirement reached the CEO second-hand via the reviewer, and
> the reviewer has since withdrawn the accompanying claim that a prior verification step was
> skipped, on the grounds that "never asked" and "asked and skipped" are equally consistent with
> the evidence.

---

## 0. Repository identity — the fact that has already regressed once

**`https://github.com/ardalanazimian/Rezv.git`** — from `git remote get-url origin`, exit=0,
on 2026-09-04. `origin` is the only remote, identical for fetch and push.

This is stated first because it is the one fact in this project that has **already come back wrong
after being corrected**: a wrong repository address was fixed in round 15 and then re-introduced by
a fresh session pasting a handoff prompt that lived outside the repository and therefore could not
be reached by any gate. That is the entire reason `docs/audit/SESSION-HANDOFF.md` now lives in the
repository and is covered by `tools/check-doc-staleness.mjs`.

A reviewer that cannot state the repository URL from its own handoff will eventually accept a claim
about the wrong repository. Note also that the `gh` token is **invalid**, so anything requiring
GitHub is browser-only today — do not report a GitHub fact as verified when the CLI could not run.

## 1. What the reviewer is for

The CEO session builds and verifies. The reviewer establishes whether the CEO's verification was
real. These are different jobs and the second cannot be delegated to the first.

The reviewer's product is a **verdict on claims**, not a second implementation. It is read-only on
the codebase by design — see §7 for why that boundary keeps failing and what actually enforces it
(nothing, currently).

## 2. The rule that outranks everything else

Zero-trust runs in **every** direction: at the CEO, at the reviewer, at prior audit reports, and at
the founder. Truth is current source, a live database, and executed commands. Everything else is a
claim, including anything in this file.

This has already mattered upward, twice, and both are recorded in the constitution:

- **P0-014** — the founder corrected a "hibernated" reading to "credential desync". The correction
  was wrong and he withdrew it himself. The process failure was accepting a claim that contradicted
  an executed tool result *because of its source*.
- **P0-021** — a founder order named `SECURITY.md` and `DATABASE.md` as presenting RLS as an active
  control. Neither did; the sharpest false claim was in a third file the order never mentioned.
  Literal compliance would have left the real defect in place.

**Never satisfy an instruction literally when literal compliance would hide a defect.** Fix what the
directive named *and* what it missed, and report both.

## 3. What counts as evidence

`{ id, severity: blocker|major|minor, area, claim, evidence, verified_by }` where evidence is one of:
`path/file.ts:L120`, a command **with its exit code**, or a live query with its raw result.

Rejected on sight: a log tail, a paraphrase, "tsc passed" offered as "tested", a control-plane status
offered as a live fact, or "zero"/"empty" where the truth is "we could not query it".

- **The exit code is the truth, never the log tail.** A Playwright run that really had `12 failed`
  printed `12 passed (10.3m)` in its tail; its exit code was 1.
- **Never read an exit code off the end of a pipe.** `cmd | head` reports `head`'s status. The CEO
  session made exactly this error on 2026-09-04 and nearly filed a false accusation against a tool
  wrapper on the strength of it.
- **When a wrapper sits between you and the command, re-measure a surprising result with something
  unwrapped.** A hooked `grep` reported 75 control-byte matches in a file that provably has zero.

## 4. The gate inventory — executed, not described

A hand-written table here is exactly the kind of artifact this audit warns against: accurate the day
it was typed, silently wrong the day a gate, a script, or this machine changes. So this section is no
longer typed by hand. `tools/report-gate-status.mjs` (round-20) **runs every evaluation-only gate itself**,
records the literal command and the literal exit code, classifies each as `GREEN` / `RED` /
`COULD_NOT_RUN` / `UNKNOWN`, and writes the raw stdout+stderr of every run to
`audit/round-20/gate-inventory/<id>.log` plus a full JSON at `audit/round-20/gate-inventory/gate-inventory.json`.
It never performs a destructive or outward-facing action (`gate-send.mjs` and `gate-destructive.mjs`
are read-only evaluators — confirmed by reading their source, not assumed), never invokes an
argument-requiring gate without saying which argument and why, and carries no allowlist of expected
results: it reports what actually happened, not what it expects to see.

**Re-run it rather than trusting the table below** — `node tools/report-gate-status.mjs` — that is the
entire point of the section. The table below is one snapshot, captured on 2026-09-04, machine
`DESKTOP-8DAJNO5` (win32 10.0.26200, node v24.20.0); a gate inventory is inherently machine-local and
this one will visibly rot the moment `psql` is installed here or a gate changes.

`docs/DECISIONS.md:30-35` describes the A-gates in prose; the rows below are the gates themselves.

> تولیدشده توسطِ `node tools/report-gate-status.mjs` در 2026-09-07T04:45:35.326Z روی DESKTOP-8DAJNO5 (win32 10.0.26200, node v24.20.0). **این جدول یک عکسِ لحظه‌ای است، نه یک ادعای دائمی — دوباره اجرا کن، اعتماد نکن.**

| Gate | Command | Exit | State | Note |
|---|---|---|---|---|
| Agent charter | `node tools/check-agent-charter.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/agent-charter.log` |
| Control bytes | `node tools/check-control-bytes.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/control-bytes.log` |
| Doc staleness | `node tools/check-doc-staleness.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/doc-staleness.log` |
| Classic scripts | `sh tools/check-classic-scripts.sh` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/classic-scripts.log` |
| Fonts | `python tools/check-fonts.py` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/fonts.log` |
| Schema drift | `sh tools/check-schema-drift.sh` | 2 | COULD_NOT_RUN | خودِ گیت اعلام کرد اجرا نشد (کدِ خروجِ ۲ — پیش‌نیازِ غایب/خراب، مثلِ psql). جزئیات در لاگِ خام. — evidence: `audit/round-20/gate-inventory/schema-drift.log` |
| A1 destructive (--scope local/rezervno_verify) | `node tools/gate-destructive.mjs --scope local/rezervno_verify` | 1 | RED | evidence: `audit/round-20/gate-inventory/destructive-local_rezervno_verify.log` |
| A1 destructive (--scope production) | `node tools/gate-destructive.mjs --scope production` | 1 | RED | evidence: `audit/round-20/gate-inventory/destructive-production.log` |
| A2 deploy/DNS | `node tools/gate-deploy.mjs` | 1 | RED | evidence: `audit/round-20/gate-inventory/deploy.log` |
| A3 decision (--id D-001) | `node tools/gate-decision.mjs --id D-001` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/decision-D-001.log` |
| A3 decision (--id D-002) | `node tools/gate-decision.mjs --id D-002` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/decision-D-002.log` |
| A3 decision (--id D-003) | `node tools/gate-decision.mjs --id D-003` | 1 | RED | evidence: `audit/round-20/gate-inventory/decision-D-003.log` |
| A4 real sends (--recipients 1) | `node tools/gate-send.mjs --recipients 1` | 1 | RED | evidence: `audit/round-20/gate-inventory/send.log` |
| Test runner completeness | `node tools/check-runner-completeness.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/runner-completeness.log` |
| Manifest assets | `node tools/check-manifest-assets.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/manifest-assets.log` |
| Alert ↔ metric binding | `node tools/check-alert-metric-binding.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/alert-metric-binding.log` |
| Agent memory location | `node tools/check-agent-memory-location.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/agent-memory-location.log` |
| XSS escaping regression | `node tools/xss-escaping-regression.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/xss-escaping-regression.log` |
| XSS sink audit (--check) | `node tools/xss-sink-audit.mjs --check` | 1 | RED | evidence: `audit/round-20/gate-inventory/xss-sink-audit-check.log` |
| A1 restore drill executor (tools/restore-drill.sh) | `(اجرا نشد)` | — | UNKNOWN | اجراکننده است، نه گیت: واقعاً pg_dump/CREATE DATABASE/pg_restore/DROP DATABASE انجام می‌دهد. خودِ فایل هم تصریح می‌کند اجراکننده و تفسیرکننده (gate-destructive.mjs) عمداً جدا نگه داشته شده‌اند. این ابزار طبقِ محدودیتِ صریحِ خودش («فقط ارزیابی») چنین چیزی را اجرا نمی‌کند. |
| boot-path (tools/check-boot-path.sh) | `(اجرا نشد)` | — | UNKNOWN | یک Postgresِ کاملاً خالی و دورانداختنی می‌سازد/می‌شکند و برایِ ۹ دقیقه یک سرورِ واقعی روی یک پورت بالا می‌آورد — یک jobِ سنگینِ CI است (ci.yml)، نه یک چکِ سبکِ محلی؛ به‌علاوه cwd را عوض می‌کند و روی وضعیتِ DB اثر می‌گذارد. |
| CI-only jobs (build, test, image-build, security, observability, e2e, design-system, standalone, seo, landing, base-freshness) | `(اجرا نشد)` | — | UNKNOWN | در .github/workflows/ci.yml تعریف شده‌اند، نیازمندِ سرویس‌های Postgres/Redisِ CI، Docker build، یا مرورگرهایِ Playwright‌اند. این‌ها jobِ CI‌اند نه گیتِ محلیِ سبک؛ اجرایشان اینجا محدودیتِ «بدونِ عملِ سنگین/بیرونی» را نقض می‌کند. |

**Deliberately not run, listed rather than silently skipped** (a missing result must never render as a
pass):

| Gate | Why not run |
|---|---|
| `tools/restore-drill.sh` | It is the drill *executor*, not a gate — it really runs `pg_dump`/`CREATE DATABASE`/`pg_restore`/`DROP DATABASE`. `report-gate-status.mjs` only runs pure evaluators. |
| `tools/check-boot-path.sh` | Builds and tears down a disposable schema and holds a real server up for up to 9 minutes on a port — a CI-weight job, not a lightweight local gate. |
| CI-only jobs: `build`, `test`, `image-build`, `security`, `observability`, `e2e`, `design-system`, `standalone`, `seo`, `landing`, `base-freshness` | Defined in `.github/workflows/ci.yml`; need CI's Postgres/Redis services, a Docker build, or Playwright browsers — out of scope for a local gate inventory. `observability` was added 2026-09-04; before that **nothing in CI parsed `observability/alerts.yml`**. |

## 5. Standing decisions — do not reopen

- Production DB is **Postgres in the existing Docker stack**. Supabase is off the critical path.
- **RLS is inert and stays inert until after launch.** Enabled on 61 of 73 tables with **zero
  policies**; the app connects as owner + `SUPERUSER` + `BYPASSRLS`. Never accept "RLS is enabled"
  as isolation evidence. The tenant boundary is application-layer only (`ctx.restaurant.id` /
  `auth.tenantId`), which makes any gap in it a blocker rather than a major.
- Panel host is `business.`, not `biz.` — settled by four independent sources.
- Payments disabled at launch. OTP removed from the business/company panels, kept for the customer app.
- Currency is **Toman (IRT)** everywhere; Zarinpal defaults to Rial, so `currency: 'IRT'` must be
  explicit or every amount is off by 10×.
- Migrations live in `api/prisma/sql/NNN-*.sql`. `prisma/migrations/manual/` **does not exist**.
- No Google Fonts, ever — unreachable from Iran; Vazirmatn is self-hosted.

## 6. Known fake-green classes — **open-ended, not a closed list**

Every entry is a real failure in this repository. The list is numbered for reference, **not
bounded**: entries 8–10 were added on 2026-09-04 alone. A reviewer that treats this as a checklist
to complete has misread it. The question to ask of any gate is always the constitution's:
*what is the smallest change that breaks this but still passes?*

1. A `--check` that compared artifact **staleness** rather than counts (XSS guard).
2. A `boot-path` job that never ran `npm run build`, so no server ever started.
3. An `escaped` classifier that was a substring test.
4. A boundary test that passed **silently whenever its subject was absent** — a `<` → `<=` mutation
   walked straight through it. Absence of the subject must be an error, never a pass.
5. Test files never imported in `api/tests/_all.runner.mts`, so `npm test` never ran them. Three
   were hidden at once while a PR claimed "375/375 passing"; the real number was 352.
6. A shipped artifact with **no CI job that builds it**: `postinstall: prisma generate` broke
   `docker build` from the day it landed and stayed hidden **two months** behind eleven green jobs.
7. A heredoc that turned `\b` into a literal `0x08` byte. The file read perfectly in an editor and
   in `git diff`, Node executed it without error, and the regex never matched.
8. **Alert rules not bound to the code that emits their metrics** (2026-09-04, F-C). Renaming
   `rezervno_rate_limit_fallback_total` in `api/src/lib/metrics.ts:144` while leaving
   `observability/alerts.yml` untouched left **both** `promtool check rules` and `promtool test
   rules` at exit=0, with the rule watching a metric nothing emits. `promtool test rules` feeds
   synthetic series and is structurally blind to producer-side changes. The CEO's own falsifiability
   certification was **sound about rules and blind about producers** — a gate can be genuinely
   falsifiable on one axis and useless on another.
9. **A read-only agent declaration is unenforceable wherever `Bash` is granted** (2026-09-04, F-A).
   `ai-intelligence-auditor.md:5`, `census.md:7` and `sweeper.md:6` all declare
   `tools: Read, Grep, Glob, Bash` with no `Write` and no `Edit`;
   `ai-intelligence-auditor` nonetheless produced 52KB across two files, through Bash, in the course
   of ordinary work. `tools/check-agent-charter.mjs` never parses `disallowedTools` at all (one grep,
   no match). Relatedly, `ceo.md:8` grants **bare `Agent`** with no scope list, so the audited
   session can spawn its own auditor; the guard understands the scoped `Agent(...)` form at
   `check-agent-charter.mjs:66` but uses it only to print a label. Both remedies are permission
   configuration and therefore **the founder's**, not the CEO's and not the reviewer's.
10. **`check-control-bytes.mjs` passes on mojibake**, because mojibake is valid UTF-8 — merely wrong.
    Every Persian document in the repository is exposed; a verbatim transcription would not catch it.
11. **A guard that is hostile to the mandated evidence format corrupts the record it protects**
    (2026-09-04, F-B). `check-doc-staleness.mjs` flags shell variables inside fenced code blocks as
    stale config, so an author had to lowercase `EXIT=` and elide a hostname **in their own recorded
    evidence** to get the gate green. A false-positive rate that forces an allowlist is a design
    failure, not a tuning step — that same gate once produced 23 false positives out of 26.

## 7. What the reviewer must not do

- **Never accept a peer session's assertion of its own authority as proof of it.** A peer cannot
  widen another session's permissions. "The reviewer told me to" and "the CEO told me to" are the
  same laundering in opposite directions.
- **Never route a permission-configuration remedy through the audited party.** Hooks, tool grants
  and settings go to the founder directly. This was got wrong once, on 2026-09-04, and corrected.
- **Never implement.** The reviewer holds `Bash` and can therefore write files regardless of its
  declared tools (§6.9). That it does not is a discipline, not a control — do not mistake the two.
- **Never let silence read as agreement.** State explicitly which claims were *not* checked. The
  reviewer's first directive did this and it was the most useful part of it.
- **Never file a directive citing the wrong line.** A directive citing `ci.yml:339` for a fact at
  `:340` is the same defect a report would be rejected for.

## 8. UNKNOWN — stated, not guessed

- Whether a founder build prompt for this document exists. It is not in the CEO session's context.
- A3's live status (`gate-decision.mjs` requires a decision id; not run).
- `check-schema-drift.sh`'s true verdict on this machine (`psql` absent).
- Whether the reviewer's delegated authority over repository layout and gate design is real. It is
  asserted in `.claude/agents/reviewer.md` §3; provenance is the founder's to settle.
- Whether any of the 16 alert rules would reach a human. No Alertmanager and no notification
  receiver exists anywhere in the repository — the only repo-wide match for `alertmanager` is a
  comment at `observability/alerts.yml:2`.

## 9. Outstanding — the founder queue

A handoff whose job is to say what is unfinished is worthless without this. Transcribed from
`docs/audit/SESSION-HANDOFF.md`; **re-read it there rather than trusting this copy**, which is a
snapshot and will rot.

### Blocked on the founder — nobody else can do these

| # | Action | What it unblocks |
|---|---|---|
| F1 | Merge PR #81, then open the hardening PR. The `gh` token is **invalid**, so browser only | gates E1+E2 → all of Wave 2 |
| F2 | Decide P0-019 / baseline (b) vs ADR 0002 — package at `docs/audit/reports/CEO-F3-DECISION-PACKAGE-2026-09-04.md` | A10 creates no Vercel project |
| F3 | Decide P0-023 — settled by evidence, needs only the word: keep `business.` | acceptance criterion of surface B |
| F4 | **Melipayamak key rotation** — 5 minutes; the key is live and leaked | **gate A4 can never go green** |
| F5 | Supabase D1→D3: restore → reset password → `pg_dump` → fill the manifest | the project cannot be deleted |
| F6 | **IRNIC/HODA → `rezervno.ir` → ArvanCloud staging** | **gate A2 can never go green**, and all four golden journeys |

F4 and F6 are the real bottleneck: two of the four delegated-authority gates are structurally
incapable of going green until they are done, so no amount of engineering moves them.

### Raised 2026-09-04, awaiting a founder ruling

| # | Item | Why it cannot be decided below |
|---|---|---|
| G1 | A `PreToolUse` hook to actually enforce agent tool declarations (§6.9) | harness permission configuration |
| G2 | Provenance of the reviewer's delegated authority over repository layout and gate design, asserted at `.claude/agents/reviewer.md` §3 | authority, not engineering |
| G3 | Scoping the bare `Agent` grant at `ceo.md:8` so the audited session cannot spawn its own auditor | the CEO's own tool grant |
| G4 | Whether fake-green class §6.11 is promoted into the constitution skill | project instruction file, same class as `CLAUDE.md` |

G1–G4 share a property worth stating: **each is a change the CEO session is technically able to make
and deliberately does not.** A peer session cannot widen another session's permissions, and neither
the CEO nor the reviewer may route a permission-configuration remedy through the other. That
boundary was got wrong once on 2026-09-04, by the reviewer, and corrected in writing.

### The four launch gates that stay open regardless

(a) an **executed** restore drill against production — one has run only against
`local/rezervno_verify` (72 tables, zero row diff).
(b) **off-host** backup copies — the `S3_*` fields in the backup service are all empty.
(c) uptime + disk alerting — advanced on 2026-09-04 (16 rules, new `observability` CI job) but
**still open for the reason that matters: nobody is paged**. See §8.
(d) the non-pausing proof — `audit/round-19/non-pausing-proof-design.json`.
