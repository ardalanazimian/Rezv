# ORDER-005 — 1,700+ tests were never type-checked. Now they are, and the gate is proven falsifiable.

**Date:** 2026-09-09 · **Session:** Deputy `rezv-fa [0a4dbb]` · **Reports to:** CEO `rezv-9c [5283b5]`
**Status: SUBMITTED — not closed.** I close nothing and certify nothing.

**Result in one line:** **44 → 0** type errors across 25 `.mts` test files, `**/*.mts` and `allowImportingTsExtensions` enabled in `api/tsconfig.json`, full suite **exit 0 / 1737 passing / 0 failing** after the fixes, and falsifiability proven with a **control run** showing the old config was blind to the very error the new one catches. No `as any`, no `@ts-ignore`, no tsconfig loosening — and one pre-existing `as never` **removed**.

---

## 1. The measurement, reproduced before trusting it

```text
api/tsconfig.json include:  ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**", …]
                                                          ↑ no **/*.mts
with **/*.mts + allowImportingTsExtensions:
    npx tsc --noEmit   →   exit 2 · 44 errors · 25 files
    TS2554 ×7 · TS2540 ×7 · TS2322 ×5 · TS7060 ×4 · TS7006 ×4 · TS2578 ×4 · TS2538 ×4 · TS2353 ×3 · TS2345 ×3 · TS2503 ×2 · TS2769 ×1
```

The CEO's numbers reproduce exactly. **All 44 were inside `tests/` — none spread to `api/src/`**, so the escalation path in the order was never needed.

I used a throwaway `tsconfig.mtscheck.json` (extending the real one) for the whole fixing pass so the shared `tsconfig.json` stayed untouched until the count was zero. It was deleted before the final runs.

---

## 2. The ordering was followed exactly

Fix all 44 → **then** flip the flag. The reverse would have turned `main` red for five other sessions and made the flag itself the thing under pressure to be reverted. Reviewer's directive 032 ordering, restated by the CEO.

---

## 3. Falsifiability — four results plus a control

The order asked for three (green → red → green). **I added a fourth**, because the first three prove only that the *new* config catches the error; they do not prove the *old* one missed it. The whole claim of this order is that a class was invisible, so the control is the row that actually carries it.

Injected error: `const b64url: (o: unknown) => number = (o: unknown) => …` in `tests/jwt.test.mts` — a genuine type error (body returns `string`).

| # | Tree | Config | md5 of file | `tsc --noEmit` | Errors |
|---|---|---|---|---|---|
| 1 | clean | **new** | `cf0dc91736b1` | **exit 0** | 0 |
| 2 | **mutant** | **new** | `729f9e612304` | **exit 2** | 1 — `TS2322 tests/jwt.test.mts(53,11)` |
| 3 | reverted | **new** | `cf0dc91736b1` | **exit 0** | 0 |
| 4 | **mutant** | **OLD** (no `**/*.mts`) | `729f9e612304` | **exit 0** | **0 — BLIND** |

**Row 4 is the finding.** The same byte-identical hole that the new config reports as an error produced a clean green under the old one. That is the class the order was written about, demonstrated rather than argued.

md5 captured at every step, per the CEO's own rule from the `MUTANT` incident: *in a shared tree, "I changed the file and re-ran" is not a measurement unless you know what was in the file at that moment.*

---

## 4. No test changed meaning — verified by execution, not by inspection

```text
npx tsx --test tests/_all.runner.mts   →   EXIT 0 · 1737 passing · 0 failing blocks
```

Run after all 44 fixes. Every fix was chosen to be behaviour-preserving, and the suite confirms it.

---

## 5. Four findings the type-checker exposed — none of them are type problems

These are the reason the order was worth running. Each is a test doing less than it appears to.

### F-1 · Three cleanup queries filtered on fields that do not exist — and `.catch(() => {})` hid it

`admin-totp-login:112` filtered `db.auditLog.deleteMany({ where: { tenantId: … } })`. **`AuditLog` has no `tenantId` column** (`schema.prisma` — it has `restaurantId`, `actorId`). Prisma rejects an unknown field at runtime, the `.catch(() => {})` swallowed the rejection, and so **that cleanup has never deleted a single row.** Same shape at `points-redemption:138`, which filtered `modelPrediction` by a `reservation` relation that does not exist on that model.

**The pattern is the finding:** a cleanup wrapped in `.catch(() => {})` cannot distinguish "nothing to delete" from "this query is invalid". It reports success either way.

Fixed: `modelPrediction` now filters on `restaurantId`, which exists. `auditLog` now filters on `actorId`, scoped to the two staff rows the test creates (I added `select: { id: true }` to capture them).

**Residual, stated rather than papered over:** `auth.failure` audit rows carry **no `actorId`** (`login/route.ts:101`), so those specific rows are still not cleaned. Scoping them needs a JSON-path filter on `detail.username`, and I deliberately did not add one — if that filter were wrong it would throw into the same `.catch(() => {})` and I would have replaced one silent no-op with another. **The root cause is that `AuditLog` has no tenant column at all**; that is a schema decision, not mine.

### F-2 · A test asked for a named guest and never got one

`model-registry:122` passed `guestName` / `guestPhone` to `createReservation`. `CreateReservationInput` (`src/lib/reservations.ts:65`) has neither — it has `guest?: { name; phone? }`. Both properties were **silently dropped**; every reservation that test created was guest-less.

**I removed the two dead properties rather than moving them into `guest`.** Moving them would have written a different row, and this test measures a *no-show prediction* whose features include things like `staffEntered` and `knownUser` — changing the row could change the number under test. Behaviour preserved; the intent gap is reported here instead. **Whether that test should have a named guest is a decision for its owner.**

### F-3 · Seven route-handler calls passed an argument the handler cannot receive — masked by `as never`

`checkin-points`, `dna-summary` ×2, `vip-and-clv` ×2 called `GET(request, ctx)` on handlers declared `GET(request)`. The extra `ctx` was cast `as never` — **a cast that silenced an *arity* error while looking like it was solving a *shape* one.** The handlers never received it. Removing the argument deletes the cast and changes nothing at runtime.

Two more (`outreach-ledger`) passed a label to `makeUser()`, which takes no parameters; uniqueness comes from an internal `++userSeq`, so the users were distinct anyway and the label was decoration.

### F-4 · An assertion that never checks which error is thrown

`rbac-role-from-db:117` was `assert.rejects(fn, undefined, 'message')`. Node treats a string second argument as the message, so dropping the explicit `undefined` is exactly equivalent — but it is worth saying plainly: **this test asserts only that the call rejects, never that it rejects for the tenant-mismatch reason it is named after.** I did not tighten it, because adding a predicate would change what the test claims. Owner's call.

---

## 6. On `TS2540` — the pattern the CEO asked me to look at

Seven of the 44 were `Cannot assign to 'NODE_ENV'`. The cause is `next/types/global.d.ts:23`, which declares `readonly NODE_ENV` — Next asserting that **app** code must not mutate it. These are tests, which legitimately must.

**Fixed with `Object.defineProperty(process.env, 'NODE_ENV', { … })`** — the identical mutation, and it type-checks with **no cast at all**. That is why it is a fix and not a silencer.

**And the CEO's instinct was right that the pattern is worth a look.** It is the global-mutable-state class: `sms-transport-failclosed` sets `NODE_ENV = 'production'` inside three separate tests but restores it only in `after()` (`:97`), not `afterEach`. In a deliberately single-process runner, every test in that file after the first setter runs under `production` until the file ends. Nothing is currently broken by it — the file's own tests expect production — but it is one `afterEach` away from being the next "flake", and it is the same family as the module-identity trap from ORDER-004. **Reported, not changed:** adding an `afterEach` would alter the file's isolation semantics, which is more than a type fix.

---

## 7. ⚠️ My own error during this order, before anyone finds it

While setting up the control run I ran `git stash push -q tsconfig.json` to swap configs. **That is the shared-tree hazard I have spent two days warning other sessions about, and I walked into it.**

Contained, and I verified rather than assumed: `git stash show --name-only` showed the stash held **exactly one file** — `api/tsconfig.json`, my own change — and no other session's work. Restored with `git stash pop`; `git stash list` is now empty and both config edits are present.

**The right tool was a file copy, which is what I used for the control instead.** `git stash` with a pathspec is still a repo-wide operation in a tree six sessions share; had another session been mid-write on that same path, I would have taken their work into my stash. Recorded because the near-miss is the point, not the outcome.

---

## 8. What I did NOT do

- **No `as any`, no `@ts-ignore`, no tsconfig loosening.** The only tsconfig change is the one the order asked for, and it *tightens* coverage.
- **Removed a silencer rather than adding one:** `coupons:49` already carried `kind: (…) as never`, which was itself producing the error by poisoning the object type. Typing the fixture properly (`CouponKind`, `CustomerSegment`) removed the cast.
- **Deleted four `@ts-expect-error` directives** that `tsc` reported as unused — meaning the lines beneath them type-check cleanly now. Keeping them would have been the silencer.
- **I did not touch `api/src/`.** No fix spread there; the count was 25 test files and `tsconfig.json`, nothing else. Verified: `git status --porcelain` shows exactly 26 paths, all under `api/tests/` or `api/tsconfig.json`.
- **I did not change any assertion**, and where a type fix would have changed one (F-2, F-4) I stopped and wrote it up instead.
- **I did not add an `afterEach` to `sms-transport-failclosed`** (§6) — that is an isolation change, not a type fix.

## 9. What is NOT verified

- **That CI stays green.** `ci.yml:43` runs `npx tsc --noEmit` for `api`, which now covers `.mts`. Locally that is exit 0, but CI runs on Node 20 against a fresh install and I have not run it there.
- **The residual `auth.failure` audit rows** (F-1) still leak. Measured and stated, not fixed.
- **Whether other sessions' in-flight `.mts` files type-check.** The flag now applies to every `.mts` in `api/`, so any test file added from now on must satisfy it — including the ones another session had uncommitted while I worked. **That is worth telling the other sessions before their next commit**, and it is the one way this change could surprise someone.

## 10. One line for the CEO

> ORDER-005 submitted. **44 → 0**, `**/*.mts` + `allowImportingTsExtensions` now in `api/tsconfig.json`, suite **exit 0 / 1737 pass / 0 fail** after the fixes. Falsifiability proven with **four** runs, not three: baseline green, real injected type error **red (exit 2)**, revert green — plus a **control** showing the *same byte-identical* mutant produces **exit 0 under the old config**, which is the actual proof that the class was invisible rather than merely that it is visible now; md5 recorded at every step. Four findings that are not type problems: **three cleanup queries filtered on non-existent fields with `.catch(() => {})` hiding it, so they deleted nothing — ever**; a test that asked for a named guest and silently got none; seven handler calls passing an argument the handler cannot take, masked by an `as never` that was silencing an *arity* error; and an `assert.rejects` that never checks which error. No `as any`, no `@ts-ignore` — and one pre-existing `as never` removed. **My own error, reported: I used `git stash` on a shared tree** — it captured only my own tsconfig and is restored, but a file copy was the right tool and is what I used afterwards. **Heads-up for the other sessions: every `.mts` in `api/` is now type-checked, including files they currently hold uncommitted.**
