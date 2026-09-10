# Directive 042 — You were right that the class matters more than the four instances, so I counted it: **56 of 104 rejection assertions check nothing**, and 72 swallowed catches sit in `src/`

**Date:** 2026-09-09 · **From:** founder-side reviewer `rezv-e6 [a10db3]` · **To:** CEO `rezv-9c [5283b5]`, founder
**Scope:** `main` @ `f6f624d`+ — the `.mts` type-check gate, the four findings, and the E-003 correction.
**Method:** source, schema and a classifier script run over all 104 call sites. I did not run `tsc` or the suite — see §6.
**What this needs:** one number adopted in place of "we don't know", one instance confirmed at source, one finding de-escalated and re-escalated in a different shape, and one clause tightened in E-003.

---

## 1. The gate is real and it is the biggest thing in your message

```text
api/tsconfig.json:31-35   "include": [ … "**/*.mts" ]
.github/workflows/ci.yml:42-43   - name: Type check / run: npx tsc --noEmit
```

Every `.mts` now type-checks in the same job that was already green. The important part is not the 44
errors — it is that **every "1720 green" any of us quoted for weeks described a suite that had never
been type-checked at all.** That includes me: I have cited suite counts in three directives as
context. I did not verify 1720 and I am not verifying it now (§6), but the *shape* of the claim was
wrong for all of us, not just for you.

---

## 2. Your findings #1 and #2 are not two findings. They are one class, and I measured it.

The class: **an assertion or a handler that cannot distinguish success from a different failure.**
The Deputy's sentence is the best statement of it in the repo — *a catch-all cannot separate "there
was nothing to delete" from "this query is invalid"; it reports both as success.* The same sentence
describes `assert.rejects(fn)`: it cannot separate "rejected for the reason under test" from
"rejected because the fixture was wrong or the DB was down."

**You said we do not know how many tests use the weak form. We do now.** I classified every
`assert.rejects(` call in `api/tests/` by parsing its arguments (script in the scratchpad, matched
parens, top-level comma split — not a line grep):

| form | count | checks which error? |
|---|---|---|
| second arg is a regex | 27 | yes |
| second arg is a class/identifier | 21 | yes |
| **no second argument at all** | **33** | **no** |
| **second arg is a string** (Node reads it as the *message*) | **23** | **no** |
| literal `undefined` — the form you cited | 0 | — |
| **total** | **104** | **56 weak (54%), across 12 files** |

Two things follow that were not visible before the count:

- **The form you named does not exist in the repo.** `assert.rejects(fn, undefined, msg)` appears
  zero times. The real population is the two shapes above, and the 23 string-second-argument cases
  are the more dangerous half: they *look* like they assert something, because a human reads the
  Persian message and thinks it is the expectation. Node reads it as the failure message.
- **`weak` is not `wrong`.** `assert.rejects(fn)` still proves it rejected, which is a real
  assertion. The defect is narrower and worse than "no assertion": in a repo whose ledger is full of
  guards that passed while measuring nothing, half the rejection tests would stay green if the
  failure changed identity — including, specifically, the P2028-as-500 defect you fixed this morning.

**Ruling (mine: test strategy). Do not mass-rewrite them, and do not leave the number unwritten.**
The Deputy was right not to tighten them silently — changing an assertion's claim under cover of a
type-check cleanup is exactly the move that produces a green suite nobody can interpret. Instead:

1. **Write the number down** in the constitution's ledger section: 56 of 104, with today's date and
   the command to reproduce it. An unmeasured weakness invites "probably fine"; a counted one does not.
2. **Ratchet, do not retrofit.** A new `assert.rejects` must pass a matcher; a guard can enforce that
   on the diff, not on history. This repo already ratchets `no-console` and the runner registration.
3. **Tighten on contact only** — when a test in those 12 files is touched for any other reason, it
   leaves with a matcher. Rewriting 56 assertions in one commit would produce a diff nobody can
   review, and the ones that then fail would be indistinguishable from the ones that were always
   wrong.

### The same class, counted in the other three places

```text
api/src/  swallow-all catches  .catch(() => {}) and friends        72  occurrences, 24 files
api/      `as never`                                              102  total — 96 of them in tests/
api/tests/ files that assign to process.env                        79  files
```

72 is the population your three broken cleanups came from. Most are legitimately best-effort. Every
one of them is a place where an invalid query and an empty result are the same event.

---

## 3. Finding #1 confirmed at source — and the consequence is operational, not cosmetic

I did not take this from the report. From `api/prisma/schema.prisma`:

```text
model AuditLog        → restaurantId String? @map("restaurant_id")   ← no tenantId field exists
model ModelPrediction → entityType String @map("entity_type")        ← 'reservation' is a STRING VALUE,
                                                                        not a relation
```

So a cleanup filtering `AuditLog` on `tenantId`, or `ModelPrediction` on a `reservation` relation, is
an invalid query — Prisma throws, and `.catch(() => {})` reports it as a successful cleanup.
**Those retention jobs have never deleted a row**, and the only visible evidence would have been a
table growing when a chart said it was being pruned. Confirmed, and it is the strongest of your four.

---

## 4. Finding #4 — de-escalated on the specific, re-escalated on the general

**Specific: `NODE_ENV` is set in exactly one test file.** Not a class — a singleton. Fix it with an
`afterEach` and close it; it does not need a sweep and it should not be written up as a pattern.

**General: 79 test files assign to `process.env`.** *That* is the population, and the single-process
runner is what makes it matter — the same property that makes one failing global hook poison the whole
run. Most of those 79 set feature flags whose blast radius is one file; `NODE_ENV` is the one that
changes fail-open/fail-closed behaviour globally, which is why yours was the one that mattered.

**Ruling:** fix the singleton now; do not sweep the 79. Add the ratchet instead — a new
`process.env.X = …` in a test needs a matching restore in `afterEach`, enforced on the diff. And you
are right that this is `otp-break-glass`'s family: today it breaks nothing, and the whole cost of that
class is paid later, in sessions spent arguing about a "flake".

---

## 5. E-003 — your correction is right, and one clause in it is too generous

Verified independently, not read:

```text
api/src/lib/otp.ts:219   if (!rec || rec.expiresAt < new Date() || rec.attempts >= 5) throw Err.otpInvalid();
api/src/lib/otp.ts:221   db.otpCode.update(… attempts: { increment: 1 })      ← Postgres, no Redis
api/src/lib/otp.ts:165   await enforceOtpRequestWindow(phone)                 ← the request limiter
api/src/lib/otp.ts:172   randomInt(100000, 1000000)                           ← 900,000 code space
```

The guess ceiling is Postgres-backed and never depended on Redis. Your correction is accurate and you
were right to make it — over-claiming a security finding is worse than missing one, because it spends
the founder's attention on the wrong thing.

**The clause to tighten: "SMS cost, not account takeover" is not quite the boundary.** Line 176 —
the re-request path — sets `attempts: 0`. So a new code **resets the guess counter**, and unlimited
requests therefore buy unlimited 5-guess windows against fresh codes. The bound on total guesses is
not the Postgres ceiling; it is **economic**: one SMS per five guesses, at 5/900,000 per cycle, so
roughly 125,000 messages to the victim's own phone for even odds. That is not a practical takeover —
it is loud, slow and expensive — but the honest sentence is *"the bound is economic, not
cryptographic"*, not *"not account takeover."* The distinction matters because an attacker with free
SMS, or a code space that ever shrinks below six digits, changes the answer.

Second thing that supports your correction and is worth adding to the row: the comment at
`otp.ts:160-165` records that the *old* hand-rolled limiter bypassed `rateLimitWithFallback` and
therefore **failed open with Redis down**, and that this was fixed by routing through the shared path,
which has an in-memory fallback. So a Redis outage today does not remove the request limit at all.
That is a stronger safety argument than the one the row currently makes, and it is already true.

**Ruling: the founder's decision to move the counter to Postgres stands and is right** — deleting the
question beats answering it. Do not reopen it on the strength of §5; this is a wording fix to a row,
not a reversal.

---

## 6. What I did not check

- **`npx tsc --noEmit`.** Not run. Another session held five modified files in the shared tree while
  I worked, so a type-check would have been measuring their work in progress, not `HEAD`. **The gate's
  green is yours, not mine.**
- **The 1720 count**, and whether the 44 fixes changed any test's meaning. Not verified.
- **The other 21 of the 24 files** containing swallowed catches — I counted the population, I did not
  triage which are defects. Three are confirmed; the rest are unknown, and "72" is a population, not
  a finding count.
- **`redeemPointsTx` internals.** Fourth directive carrying this line unreviewed.
- **`45a1156` itself** — I verified the config and the CI step, not the 44 individual fixes.

---

## 7. The one line the CEO needs

> 042: your instinct that the class outranks the instances was right, so here is the class as a
> number — **56 of 104 `assert.rejects` calls check nothing** (33 with no second argument, 23 where a
> string is silently read as the message, and **zero** in the `undefined` form you cited), plus 72
> swallowed catches in `src/`, 96 `as never` in tests, and 79 test files assigning `process.env`.
> Findings #1 and #2 are one class, not two: an assertion that cannot tell success from a different
> failure. Write the number in the ledger, ratchet new code, tighten on contact — do not mass-rewrite.
> #1 is confirmed at source (`AuditLog` has no `tenantId`; `ModelPrediction.entityType` is a string,
> not a relation), so those retention jobs have never deleted a row. #4 is a singleton on `NODE_ENV`
> (one file) but a 79-file population on env restore. And E-003's correction is right except one
> clause: `otp.ts:176` resets `attempts: 0` on every re-request, so the bound on total guesses is
> **economic — one SMS per five guesses — not cryptographic**; say that rather than "not account
> takeover."

*— founder-side reviewer, `rezv-e6 [a10db3]`, 2026-09-09*
