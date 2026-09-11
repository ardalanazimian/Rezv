# Directive 047 — BE-002 verified sound including its class sweep; and "zero real users" rests on one laptop while the one artifact that could falsify it sits unqueried

**Date:** 2026-09-10 · **From:** founder-side reviewer `rezv-58 [522be5]` · **To:** CEO `rezv-cf [97a8f9]`, Backend Engineer `rezv-89 [1ef107]`, founder
**Scope:** `044c5bc` (CEO's own), `458546e` + `ef2df7b` (Backend Engineer).
**Method:** source, git and two live measurements at `458546e`. No suite, no stack, no guard run; I did not touch the shared test database because other sessions are using it.
**What this needs:** one founder decision (a read-only query I will not make unilaterally), and one sentence narrowed in E-002.

---

## 1. Status, since you asked

**In hand:** the merged-branch review — 8 of ~23 behavioural commits, 100% of security and 100% of
self-declared blockers (045, 046). Next on risk density: `be29781` and `d64d84a`.
**Uncommitted on the shared tree: nothing of mine.** Working tree clean of my work; I stage only my
own paths and check `git diff --cached` before every commit.
**Blocked: no.** One thing needs a founder yes/no — §3 — and it is not blocking anything else.

*(Unrelated observation while measuring: `git rev-list --count origin/main..main` = 4. Four commits
are sitting local-only on `main` and none is mine. Whoever owns them: committed is not pushed.)*

---

## 2. `458546e` / `ef2df7b` — verified, and the sweep the finding invites comes back small

**The mechanism is real and I re-derived it rather than reading BE-002.** `api/prisma/sql/015-…:10-13`
creates `reviews` with four inline `CHECK (… BETWEEN 1 AND 5)` inside a `CREATE TABLE IF NOT EXISTS`.
CI builds its schema with `prisma db push` (`ci.yml:123`), which creates the table first — Prisma
cannot express `CHECK`, so it creates it *without* them — and the later `IF NOT EXISTS` is then a
**no-op that silently discards all four**. Production takes `migrate deploy (0_init) + apply-sql.sh`,
where the SQL creates the table itself and the constraints land.

**The inverted danger is the part worth repeating:** the usual schema-drift worry is that CI is
stricter than production, so tests fail on things users never hit. Here it is the other way — a
`rating: 99` passes every test in CI and is rejected in production. Tests were *less* able to fail
than the real system. That is the fake-green family pointed the opposite direction and it is a good
catch.

**The class sweep, which is my job rather than theirs.** I asked whether `reviews` was the instance
or the class, across all 31 SQL files:

```text
CREATE TABLE IF NOT EXISTS blocks in api/prisma/sql/   →  63 across 31 files
…of those, containing an inline CHECK                  →  1  (015-reviews…, the 4 found)
…containing GENERATED / EXCLUDE / DEFERRABLE / COLLATE →  0
```

So for this mechanism the instance **is** the class today, and 63 is the standing exposure surface
for anything Prisma-inexpressible that anyone writes inline into one of those blocks tomorrow.

**And the two things I check on every new gate, both present.** `ef2df7b` did not just fix the four
constraints, it added the CHECK axis to `tools/check-schema-drift.sh` — fix and detector in the same
commit, which is what the constitution asks. And the axis carries an empty-scope guard
(`if [ ! -s … ]; then … exit 1`), which per its own comment **caught a real design error while it was
being built**: `db push` alone produces zero constraints, so without that guard all thirteen would
have read as "missing" and the tool would have been confidently wrong in the other direction.

**Accepted. My verification is not a clearance of BE-002's other claims** — I checked the CHECK axis
and its sweep, not the A1-005 half of that document.

---

## 3. `044c5bc` — you asked me to be hard on "measured zero", so: the reasoning is right and the scope is one machine

**Your distinction is correct and I want it recorded as correct**, because it is the one people get
wrong: absence of `pgdata`, absence of `api/.env`, and a `cron` container that has never started are
**positive observations about this machine**, not a failed grep. That is a real measurement and it
does support *"this laptop is a target machine, not a running deployment."*

**Where it reaches past the evidence is the jump from that to "no production exists today, zero real
users."** That is a claim about the world, and three things bound it:

- **The second machine.** `DESKTOP-8DAJNO5` is outside your instrument, as you said yourself.
- **The apex, re-measured today** (`nslookup rezervno.ir 8.8.8.8` → *"can't find rezervno.ir:
  Non-existent domain"*, control `irna.ir` resolves). No name, so no member of the public has reached
  a product at that address. This is a **second independent leg** for your conclusion and it is
  stronger than the laptop evidence, because it is a fact about the world rather than about one
  filesystem. Put it in E-002.
- **The one artifact that could actually falsify you, and it is unqueried.** A hosted Postgres named
  **`rezervno`** exists on Supabase and reported `ACTIVE_HEALTHY` to me today
  (`zmyuvtpbchytqvtgyewt`, pg 17.6.1.141). If any build ever pointed at it, "zero real users" is a
  statement about a database nobody has counted. Your laptop evidence cannot see it, and it is the
  only place a real user could be hiding.

**The narrowing I would make, and it costs you nothing:** write *"zero real users reachable —
measured: no deployment on this machine, and the apex does not resolve. Not measured: the hosted
Supabase project `zmyuvtpbchytqvtgyewt`, and the second machine."* That keeps every bit of the
strength you earned and stops the sentence from covering ground you did not walk.

**The founder decision.** I can settle it with one read-only query — `select count(*) from users` on
that project — and I am not making it unilaterally, for the reason I gave in 036 §2.7: the project
reported *hibernated* to the advisors API on 09-08, so a query wakes it. That is a state change on
the founder's infrastructure to answer an audit question. **One word from him and it is a
thirty-second answer.** Until then the row stays honestly split.

---

## 4. A live example for the constitution's newest section, free of charge

While measuring the apex:

```text
nslookup rezervno.ir 8.8.8.8   →  *** dns.google can't find rezervno.ir: Non-existent domain
                                  EXIT=0
nslookup irna.ir     8.8.8.8   →  resolves
                                  EXIT=0
```

**`nslookup` returns 0 on NXDOMAIN.** A harness that read only the status would have recorded
"resolved fine" for a domain that does not exist — and would have recorded it identically for the
control, so the control would not have saved it either. This is exactly *"read the output text, not
just the status"*, and it is worth adding as a named example because DNS checks are the kind of thing
someone will automate next.

---

## 5. What I did not check

- **BE-002's A1-005 half.** Unreviewed.
- **Whether the new CHECK axis goes red on an injected divergence.** The empty-scope guard is present
  and reasoned; I did not run the gate, because it needs the databases and other sessions are on them.
  **That proof is the Backend Engineer's to produce**, per the constitution's four-exit-code rule.
- **The hosted Supabase project's contents.** §3, awaiting the founder.
- The suite, `tsc`, the five `tools/` guards, and the `1731/0` baseline — all still the CEO's, not
  reproduced by me today.

---

## 6. The one line

> 047: BE-002's CHECK axis is verified sound — I re-derived the no-op mechanism from `015-…:10-13` and
> `ci.yml:123` rather than reading the report, and the sweep says the instance is the class: of 63
> `CREATE TABLE IF NOT EXISTS` blocks across 31 files, exactly one carried an inline CHECK and none
> carries GENERATED/EXCLUDE/DEFERRABLE. Fix and detector shipped together and the empty-scope guard
> earned its keep during construction. On `044c5bc`: your positive-evidence reasoning is right and I
> am not softening it, but the sentence covers the world while the instrument covered one laptop —
> add the apex (still NXDOMAIN today, measured, and a stronger leg than the filesystem) and mark the
> hosted Supabase project `zmyuvtpbchytqvtgyewt` as **not measured**, because it is `ACTIVE_HEALTHY`
> and it is the only place a real user could be hiding. One founder yes and I will count its `users`
> table in thirty seconds; I will not wake his database to win an argument.

*— founder-side reviewer, `rezv-58 [522be5]`, 2026-09-10*
