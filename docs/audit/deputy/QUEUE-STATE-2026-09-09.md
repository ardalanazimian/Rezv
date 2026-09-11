# Cross-session queue state — 2026-09-09

**Session:** Deputy `rezv-fa [0a4dbb]` · **Reports to:** CEO `rezv-9c [5283b5]` · **Order:** the queue-state the CEO ordered second behind ORDER-001, unparked 2026-09-09
**Measured at:** `main` = `origin/main` = `410d376`. Every row below is anchored to that commit, not to a clock.
**Status: SUBMITTED — not closed.** I close nothing, approve nothing, certify nothing, and I mark no row green.

**What this needs from whoever reads it:** a priority call on §2 and an owner for the five unowned rows in §4. Everything here is either measured at `410d376`, attributed to the session that measured it, or labelled UNKNOWN.

---

## 0. How to read a row — provenance is a column, not a footnote

| Label | Means |
|---|---|
| **measured here** | I ran the command this session at `410d376`. Command shown. |
| **CEO-measured** | The CEO ran it this session and reported it. Attributed, not reproduced by me. |
| **git-derived** | Inferred from commits/refs only. Says nothing about whether anyone is working. |
| **UNKNOWN** | Not established. Not "probably fine". |

**"Rounds waited"** = `039` minus the directive that raised the row. Directives run roughly one per round, so this is a proxy — stated so nobody reads it as elapsed time.

**On the other machine:** I can only see its commits. `origin/audit/launch-hardening` last moved 2026-09-07 16:07 — that is an **observation about commits, not about whether anyone is working there.** No row below converts that silence into a claim about a session.

---

## 1. ⚠️ The invisibility column — and a FOURTH depth found this session

The Reviewer put three depths on record (037 §3b). **There is a fourth, it is the worst, and it is live right now.**

| Depth | State | Why it hides | Status at `410d376` |
|---|---|---|---|
| **0 — staged** | in the index, not committed | **Actively contagious.** The other three are merely invisible; this one *attaches itself to the next unrelated commit* and puts another session's name on it. A bare `git commit` by any session sweeps it in. | 🔴 **36 files, all `docs/audit/research/` (Scout).** measured here: `git diff --cached --name-only \| wc -l` → 36 |
| **1 — untracked** | on disk, not in git | invisible to every gate and to the other machine | ✅ 0. measured here |
| **2 — committed, not pushed** | local only | invisible to the other machine, whose only channel is git | ✅ 0. `git rev-list --count origin/main..main` → 0 |
| **3 — pushed, unmerged branch** | on a ref nobody reads | hides *live defects*, not just documents | ✅ effectively closed — see §5 |

**Mitigation, in force for me from this session:** explicit pathspec on every commit (`git commit -- <path>`), never `git add -A`. Recommended for all three sessions until Scout commits. This file was committed that way.

**Why depth 0 belongs above the others:** depths 1–3 lose work. Depth 0 *misattributes* it — Scout's half-finished corpus would land inside someone else's commit, under their message and their reasoning, and the mistake would be invisible in `git log`.

---

## 2. Ranked by the founder's reframe — feature reality above infra hygiene

> «اسم و دامین به راحتی قابل تغییر هست ولی فیچر ها چیزایی نیستن که بشه بعد از لانچ به راحتی تغییر داد، پس تمرکز روی فیچر ها، واقعی بودن و کار کردنشون، نوآورانه بودنشونه»

Domains are cheap; features are permanent. So rows about features that promise what the server does not do rank above every infra row, and the apex/SEO family drops to parked-low.

### 🥇 F-1 · Three cashback percentages are shown to paying restaurants and can never pay out

**The strongest single row in this queue, and it points at the paying customer rather than the diner.**

```text
api/prisma/schema.prisma:176-178   cbPreorderPct Int @default(8)
                                   cbVipPct      Int @default(12)
                                   cbWinbackPct  Int @default(20)
api/src/lib/reservations.ts:612    const cbPct = r.cbBasePct ?? 0;    ← the ONLY calculation site
```

Zero calculation hits for the other three. They are not merely unused — they are **defaulted to confident non-zero values**, so every restaurant on the platform is currently shown a VIP cashback of 12% and a winback of 20% that will never pay a single toman. A zero default would read as unfinished; a non-zero default is the product asserting a number to the person paying us.

Owner: **unassigned.** Raised: 039 §2.2 · Rounds waited: 0 · Blocked on: nobody. Source: Reviewer (039), CEO concurring.

### 🥈 F-2 · Four diner perks: not one is FAKE, and the failure is copy written ahead of behaviour

`apps/customer/js/data/seed.js:62` promises four perks. Corrected classification per 039 §2:

| Perk | Real status | Note |
|---|---|---|
| Birthday | **REAL as messaging, UNVERIFIED as a discount** | `automation.ts:29-38,135` fires the trigger. The copy promises «تخفیف ویژه» — a discount runs through `coupons.ts`, campaign-configured per restaurant. **A message is not a discount.** |
| Cashback | **PARTIAL** | see F-1 |
| Priority at peak hours | **PARTIAL — not FAKE** | `waitlist.ts:133-153` converts loyalty tier → queue priority; three `orderBy` paths use it (`:282`, `:335`, `:393`). Missing from *booking*, not from the product. |
| VIP table | **data model only** | `schema.prisma:254-258,285-286` has `zone`/`isVip`; `availability.ts` references neither. **One join away, not a feature build.** |

**⚠️ CORRECTION I AM CARRYING — the CEO's unpark message gave me superseded data.** It told me «peak-hour priority FAKE (0 code)». Directive 039 §2.1, committed as `5158083`, corrects that to PARTIAL with running code. I am using 039. The Reviewer's reason for the correction is the operational one: **"FAKE — zero code" invites someone to build a second priority mechanism next to the working one**, which is how this repo acquired several duplicate mechanisms already. Flagged rather than silently reconciled, because the CEO's figure is the one in the cross-session record.

Owner: **unassigned** (copy decisions, not engineering). Raised: 039 §2 · Rounds waited: 0.

### 🥉 F-3 · A concurrency guard that flakes under exactly the load it exists for

`api/tests/slot-lock-failopen-double-booking.test.mts` — CEO-measured today: failed **1 run in 3** with `P2028` at ~33s under full-suite load; passed 7/7 twice in isolation. Confirmed by me: the file exists (34,366 bytes) and **is imported by `api/tests/_all.runner.mts`** (so it genuinely executes — the trap from directive 018 does not apply).

It is one of the three double-booking guards. **A guard that is unreliable under load is untrustworthy precisely when it matters.** Logged as an open row, not as noise.

Owner: **CEO** (claimed) · Raised: this session · Rounds waited: 0.

---

## 3. Blocker-class rows — carried, with owners

| # | Row | Owner | Raised | Rounds | Blocked on |
|---|---|---|---|---|---|
| B-1 | **ORDER-001 rows B1/B2 may not be closed by re-keying.** `economy.js:106`, `waitlist.js:45` cite `esc()` inside `missionCard`/`wlCard`, outside the hashed expression. Two legal closures only: name something inside the hashed region, or refactor the sink so the escaping is inside it. **The temptation arrives on main together with the red.** | CEO | 037 §3 | 2 | nobody — actionable now |
| B-2 | **The other 15 ORDER-001 queue rows** have never been re-derived by anyone. Reviewer verified B1 at source and said explicitly it did not do the rest. | unassigned | 037 §4 | 2 | nobody |
| B-3 | **The 34 merged commits are unreviewed.** Reviewer merged under 037 §2(b) without pre-approving them and has restated this in 038 §3 and 039 §0. They are now on `main`. | Reviewer | 037 §2(b) | 2 | Reviewer's capacity |
| B-4 | **Idempotency at `api/src/lib/lifecycle.ts:165-172`.** If it fails, this is "a path that silently mints currency" — the Reviewer wants it filed as a blocker, not as a Phase 1 finding. | `data-trust-engineer` (running) | 039 §4 | 0 | in progress |
| B-5 | **Behavioural proof that main's old extractor truncated** was never produced. Reviewer ruled on string-count + ancestry and explicitly left the behavioural proof UNKNOWN, assigned to the CEO with the merge. Merge is done; **the proof is still not on record.** | CEO | 038 §4 | 1 | nobody |

---

## 4. Unowned rows — the five that need an owner assigned

Surfaced unprompted, per my mandate. Each has no named owner at `410d376`:

1. **F-1** three dead cashback percentages with non-zero defaults.
2. **F-2** perk copy overstating behaviour in three of four rows.
3. **B-2** the 15 un-re-derived ORDER-001 rows.
4. **Gate (c)** — nobody is paged. **measured here:** `alertmanager` appears in **zero** yml/yaml/json files in the repo; `observability/alerts.yml` now has **20** alert rules. All 20 fire into a UI nobody watches. *(Note: `SESSION-HANDOFF.md` says 16 rules — that figure is from 2026-09-04 and is stale; the gate is unchanged but the number moved.)*
5. **Gate (a)/(b)/(d)** — executed production restore drill, off-host backup copies, non-pausing proof. **Not re-measured by me**; carried from `SESSION-HANDOFF.md` @ 2026-09-04 and therefore UNKNOWN today rather than confirmed open.

---

## 5. Depth-3 status — two rows CLOSED by measurement, one genuinely open

The CEO asked me to say so rather than repeat a closed row.

| Ref | ahead of main | Verdict |
|---|---|---|
| `origin/audit/round-21-xss-truncation` | **0** | ✅ **CLOSED.** `63447e2`, `9785ae4` and my `da82092` are all ancestors of `main`; `matchingDelim` in `tools/xss-sink-audit.mjs` = **6**; all five ORDER-001 artifacts are on `main`. measured here. |
| `origin/audit/launch-hardening` | **0** | ✅ **CLOSED, and this one nobody had checked.** Its tip `1f724c8` is an ancestor of `main` — the branch that was "32 commits ahead" on 2026-09-07 is now **fully contained**. The other machine has **no unmerged work** on it. git-derived. |
| `origin/audit/doc-audit` | **1** (`cebb728`, 2026-08-27) | ⚠️ **OPEN, low confidence.** Four files, all of which exist on `main` but **differ in content**: `docs/audit/DEAD-CODE.md`, `docs/recovery/{OPEN-FINDINGS,PHASE-2-PLAN,BASELINE-TEST-STATUS}.md`. The branch is **261 commits behind**, so "differs" most likely means *stale*, not *lost work*. **UNKNOWN whether anything unique is there** — needs a content read, not a merge. |

---

## 6. Parked — and parked means it does not come back each round

Per 038 §2, on the founder's answer that **the domain has not been bought** (recorded in `audit/ESCALATIONS.md` §E-001 with his words and today's date — **verified here**, the CEO did file it):

`SEO_ZONE_URL` · apex rewrite · robots.txt precedence between apps · sitemap ownership · canonical host · which Vercel account · whether Vercel is still the host.

The *decisions* stand as made (one `SITE`, no self-declared apex); they simply cannot be **tested** until a name resolves. **These are parked-low, not open.** The 17 hardcoded `rezervno.ir` references become a second decision if the *name* is also unsettled — 038 §4 flags that as unresolved.

---

## 7. The blocker that changed shape — the laptop as a test VPS

Every "four surfaces" row has been UNKNOWN because staging does not exist. The founder has offered the laptop as a VPS, and 039 §1 rules on exactly what that buys:

**It buys** conversion of feature rows from *read* to *observed* — it proves the seven steps compose, which no unit test in `api/tests/` can show.

**It does not buy, and each stays a labelled UNKNOWN:** A2 is not discharged (no rollback, no real-ISP reachability, no DNS, no public-CA chain); third-party reality **splits** — Zarinpal sandbox proves wiring, a real SMS to a real phone proves delivery, and those two must not be reported at the same confidence; nothing about performance, concurrency at scale or data volume; nothing about backup/restore under real data or the second deploy.

**Two binding conditions:** the harness must assert the identity of what it talks to (version endpoint / build id / commit sha that fails loudly if yesterday's container answers), and every row carries *measured locally, single machine, seeded data, commit `<sha>`, date* **in the row**. Plus the Reviewer's addition: **walk it twice** — cold DB, then the DB the first walk left behind. Most launch defects live in the second run.

**No row in this queue is marked green on the basis of a local walk, and none will be.** The blocker changed shape; it did not disappear.

---

## 8. Who blocks whom

- **Founder blocks:** everything in §6 (domain), and F-1/F-2 to the extent they are copy/pricing decisions rather than engineering.
- **CEO blocks:** B-1, B-5, F-3 — all claimed, none contested.
- **Reviewer blocks:** B-3 (its own capacity; it has declined to approve sight-unseen twice, correctly).
- **Scout blocks the shared index** right now — depth 0, §1. Not a fault; it is mid-write. It blocks *everyone's* ability to commit safely without a pathspec.
- **Nobody blocks:** F-1, F-2, B-2, and gate (c). These are unowned, not blocked — the distinction matters, because an unowned row waits forever while looking like it is waiting on someone.

---

## 9. What I did NOT verify — do not read as cleared

- **I did not re-run `npm test`.** The CEO's `1625 pass / 0 fail / 390 suites` and pre-merge `1598/0/382` are **CEO-measured this session**, attributed, not reproduced. Re-running costs ~240s and host disk, and the CEO owns it. Say the word and I will run it independently.
- **I did not run the stack, touch containers, or start a walk.**
- **I did not re-derive the 15 ORDER-001 rows** (B-2) or read the 34 merged commits (B-3).
- **I did not read `docs/audit/research/`** (Scout's, and staged) or the club-plan Phase 1 ledger work (`data-trust-engineer`'s). Out of my lane this round.
- **Gates (a), (b), (d)** carried from a 2026-09-04 document without re-measurement — UNKNOWN, not confirmed open. The `S3_*` "all empty" claim in particular: my grep of `api/src` returned nothing, which does **not** confirm the doc.
- **Whether `origin/audit/doc-audit` holds anything unique** — content differs, branch is 261 behind, likely stale. Not established.
- **Any security verdict.** None is expressed here.

---

## 10. One line for the CEO

> Queue state at `410d376`, submitted. Top row by the founder's reframe: **three cashback percentages defaulted to 8/12/20 in `schema.prisma:176-178` with zero calculation sites — every restaurant is shown numbers that can never pay out.** Your unpark message's perk data is superseded by 039 (`5158083`): peak-hour priority is **PARTIAL, not FAKE** — `waitlist.ts:133-153` is real and running, and calling it FAKE would get a second priority mechanism built beside it. Two depth-3 rows **close on measurement**: `round-21` and `launch-hardening` are both `ahead=0`, so the other machine has no unmerged work; only `doc-audit` has one 13-day-old commit, likely stale. And there is a **fourth invisibility depth live right now** — 36 of Scout's files are **staged** in the shared index, which is worse than the other three because it misattributes rather than hides: use `git commit -- <path>`, never `git add -A`, until Scout commits. Five rows have **no owner**, including both feature-reality rows.

---

# ADDENDUM 2026-09-10 — "no users yet" RE-RANKS this queue; it does not relax it

**Added by:** Deputy `rezv-0f [7ef389]` (was `rezv-fa [0a4dbb]` when the body above was written).
**Trigger:** the founder answered "where does production run?" with **"on the laptop"**; the CEO
measured the machine instead of recording the sentence (`044c5bc`); the Reviewer then bounded the
conclusion (directive 047 §3).

## A1. What is measured, and — the part that matters — what is not

Reproduced independently in my session, all four of the CEO's observations:

```text
docker volume ls | grep pgdata                 → 0    (no production data volume)
test -f api/.env                               → NO   (no production env file)
docker ps -a | grep cron                       → 0    (cron container never created)
grep -E '^\s+deploy:|compose .* up -d' ci.yml  → 0    (CI has no deploy job)
```

And the Reviewer's second leg, re-measured here **with a control**, because a resolver that answers
nothing for everything proves nothing:

```text
nslookup rezervno.ir 8.8.8.8  → "can't find rezervno.ir: Non-existent domain"
nslookup irna.ir     8.8.8.8  → 185.143.233.238        ← control: the resolver works
```

**I am adopting the Reviewer's narrowing verbatim rather than the flat claim**, because it is right
and it costs nothing:

> **Zero real users *reachable*.** Measured: no deployment on this machine, and the apex does not
> resolve. **Not measured:** the hosted Supabase project `zmyuvtpbchytqvtgyewt` (reported
> `ACTIVE_HEALTHY` today), and the second machine `DESKTOP-8DAJNO5`.

That hosted database is **the only place a real user could be hiding**, and no laptop measurement can
see it. **I could not query it even if it were mine to query:** every MCP in my session is
disconnected — measured today, ToolSearch confirmed working first. And it is a founder decision
regardless, since the project reported *hibernated* on 09-08 and a query wakes it — a state change on
his infrastructure to settle an audit question.

**The apex leg is the stronger of the two** and worth ranking that way: absence of a `pgdata` volume
is a fact about one filesystem; a domain that does not resolve is a fact about the world.

## A2. §7 of this document held under test — in the direction that costs us

§7 ended: **"No row in this queue is marked green on the basis of a local walk, and none will be."**
That sentence is what kept *"production runs on the laptop"* from being written down as *"production
exists."* **A local stack and a deployment are the same bytes and different facts.**

## A3. ⚠️ A sentence of my own that overstates — corrected

§2's 🥇 row is titled *"Three cashback percentages **are shown to** paying restaurants."* With zero
tenants, **nobody is being shown anything today.** The accurate claim is about the mechanism, not the
audience: `schema.prisma:176-178` defaults `cbPreorderPct`/`cbVipPct`/`cbWinbackPct` to 8/12/20 while
`reservations.ts:612` reads only `cbBasePct` — so **the first restaurant to sign up will be shown
numbers that can never pay out.** Present tense was wrong. The finding is unchanged; it is a launch
blocker, not a live harm.

## A4. The re-rank — the axis changes, the standard does not

The CEO's retraction of the E-002 line ("delay cost is not zero, only deferred") is correct: that
sentence assumed a real user. With none, **today's cost of delay genuinely is zero**, and the clock
starts at the first real signup.

**But "no cost today" is not "less important" — it is a different axis, and this is precisely the
moment a team defers everything and calls it prioritisation.** Every row in §2–§4 was ranked by
harm-in-progress. That input is now zero for *all* of them, so it discriminates nothing. The axis
that still discriminates is the founder's own reframe — **rank by what becomes expensive after
launch**:

| Row | Harm now | Cost after launch | Net |
|---|---|---|---|
| **F-1** cashback percentages | 0 | A number the product **asserts** to a paying customer. Wrong from the first signup; credibility and refunds are not recoverable | **unchanged — still first** |
| **F-2** perk copy ahead of behaviour | 0 | Copy is the **cheapest** thing to change before launch and a **withdrawn promise** after | drops, but **must land before the first user** |
| **F-3** slot-lock guard flaking | 0 | A concurrency guard is worth least when nobody is concurrent and most on day one — and cannot be validated once the load has arrived | **rises** |
| **Gate (c)** nobody is paged | 0 | Rises at launch; worthless before | **correctly deferred** |
| **B-2** 15 un-re-derived ORDER-001 rows | 0 | XSS is user-input-shaped; the population does not shrink with zero users, it is merely unmeasured | **unchanged — still unowned** |

**The only row that genuinely relaxes is Gate (c). The only one that genuinely tightens is F-3.**

## A5. Carried, and explicitly not verified by me

- **BE-002 / `ef2df7b`,`458546e`:** CI builds **nine** CHECK constraints, production builds
  **thirteen** — and the Reviewer adds that `db push` alone produces **zero**, so the guard is what
  creates them at all. **The danger runs backwards:** bad code passes every test and dies only in
  production. Same shape as ORDER-005's finding — a gate blind to the class it exists for — on the
  schema axis instead of the type axis. Not mine, not verified here.
- **`rezv-fb [64564e]` holds no role** — self-reported: no charter pasted, zero files written, waiting
  on the founder. So today is **eight interactive sessions, seven roles**, and that gap is
  **measured, not forgotten**. Recorded because this is exactly where the next session guesses. A
  teammate cannot grant write permission, and none was given.
- **A report from `rezv-fb` to the CEO (`msg_id 5bd2b893`) never arrived.** Cross-session messaging
  dropped it silently — fresh evidence for the standing rule that **git is the channel and chat is
  only a notification.** It is why this addendum is a commit rather than a reply.
