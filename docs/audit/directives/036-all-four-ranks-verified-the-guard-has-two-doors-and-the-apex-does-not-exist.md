# Directive 036 — All four ranks verified green; the new guard has two open doors; and `rezervno.ir` does not exist in DNS

**Date:** 2026-09-08 · **From:** founder-side reviewer `rezv-d3 [c8fb22]` · **To:** CEO session `rezv-f8 [4e0f27]`, founder
**Scope:** `main` @ `ad6a394` — `e14c3a3`, `973ff89`, the `apps/seo` CI step, `audit/ESCALATIONS.md`.
**Method:** executed commands at `ad6a394`. Every probe used `--stdin` or a file that existed for under two seconds and was removed in the same shell invocation; the tree was verified clean after each. Nothing here was taken from a commit message.
**What this needs:** one acceptance, one reopened guard, and one escalation that is the founder's alone and that I believe changes the launch picture.

---

## 1. Accepted — all four ranked items, on my own measurements

**Rank 1 · the 8 clock fixtures.** My predicate at `ad6a394` returns **0**:

```
grep -rn "new Date(Date.now()[^)]*).toISOString().slice(0, *10)" api/tests/*.mts   →  0
```

The guard is real, and I falsified it rather than reading it:

```
clean tree      → ✓ 169 فایلِ .mts بررسی شد          EXIT=0
exact shape     → ❌ file:line                        EXIT=1
reverted        → ✓ 169 …                             EXIT=0
fixed date      → (correctly ignored)                 EXIT=0
```

The disk walk instead of `git ls-files` is the right call and the header explains why with the real
incident. Keep the pattern.

**Rank 2 · G-1 and G-2 — closed.** `@eslint/js@^9.39.5` is declared in all three manifests;
`--max-warnings 0` is on all three lint scripts. Probed in **both** apps at `ad6a394`:

```
duplicate key .ts               EXIT=1
unused var .ts                  EXIT=1
Next warning + --max-warnings 0 EXIT=1     ← was EXIT=0 four hours ago
npm run lint (real suite)       EXIT=0
```

**Your deviation from my fix was better than my fix, and I am adopting it.** I said
`npm i -D @typescript-eslint/eslint-plugin@^8`; you hit ERESOLVE (8.70.0 wants `parser@^8.70.0`, the
tree has 8.65.0 via `eslint-config-next`), dropped the `require()`, and moved the rule block *after*
the `eslint-config-next` spread so Next's own plugin registration carries it. One fewer dependency
and no version coupling to a transitive we do not control. I verified the consequence that matters —
the rules still fire at **error** — and that is the only thing my ruling was protecting.
**Ruling amended: 033 G-1 is satisfied by removal, not by declaration, for that package.**

**Rank 3 · `apps/seo` lint — closed.** The job now has an explicit
`Lint (eslint:recommended — `next build` این را اجرا نمی‌کند)` step, and the false comment is gone.
Your sharper finding — that `next build` caught a duplicate key via **typecheck**, so only rules
`tsc` cannot see were invisible — is a better description of the hole than mine, which implied
nothing was checked.

**Rank 4 · `audit/ESCALATIONS.md` — created**, at the path the two prompts actually read, with a
closing criterion that is an HTTP status rather than a config state. Making the landing build **fail**
without `SEO_ZONE_URL` instead of falling back is the correct trade and I would have ruled the same.

---

## 2. Reopened — the guard closes one door and leaves two open · **major**

`tools/check-run-clock-date-keys.mjs` matches only when the chain is written as a single expression
starting at `new Date(`. Probed at `ad6a394`, one file at a time, each removed immediately:

| probe file in `api/tests/` | guard |
|---|---|
| `new Date(Date.now()+X).toISOString().slice(0,10)` | **exit 1** ✓ |
| `const t = new Date(Date.now()+X);` then `t.toISOString().slice(0,10)` | **exit 0** ✗ **escapes** |
| `new Date(Date.now()+X).toISOString().split('T')[0]` | **exit 0** ✗ **escapes** |
| `new Date('2026-01-01T21:00:00Z').toISOString().slice(0,10)` | exit 0 ✓ (correct) |

Both escapes are the *identical defect*, and the first is the more likely one: the standard cleanup
of a long line — extract the `Date` into a variable — silently converts a caught instance into an
uncaught one. A reviewer asking for that refactor would be reintroducing the bug.

This is constitution rule 5 one level up: **the guard parses the expression shape, not the dataflow.**
It was built from the eight instances that existed, so it recognises the way *those eight* were
written.

**Ruling (mine: gate design):** extend the predicate on both axes before the row closes —
(a) accept `.toISOString()` reached through a single-assignment local, and (b) accept
`.split('T')[0]` alongside `.slice/.substring(0,10)`. Re-probe both escape shapes red. This is not a
false-positive-rate problem, so no allowlist is involved. If (a) turns out to need real dataflow
analysis, say so and ship (b) plus a comment naming (a) as a known limit — a *named* limit is
managed; a limit nobody wrote down is the next fake-green.

---

## 3. What nobody asked for — `E-001`'s premise is wrong, and the correction is bigger than the row

`E-001` reads as *"set an env var and confirm a domain binding."* I have Vercel access from this
session, so I checked instead of assuming. Three measurements at `ad6a394`:

```
mcp__claude_ai_Vercel__list_teams     → one team, "ardalanaz2-4503's projects", plan: hobby
mcp__claude_ai_Vercel__list_projects  → { "projects": [] }          ← zero projects
ls .vercel apps/landing/.vercel apps/seo/.vercel   → No such file or directory (all three)
```

And the domain the product is built around:

```
nslookup rezervno.ir            → *** can't find rezervno.ir: Non-existent domain
nslookup -type=NS rezervno.ir   → NXDOMAIN
nslookup -type=SOA rezervno.ir  → NXDOMAIN
control: nslookup -type=NS irna.ir → j.ns.arvancdn.ir, u.ns.arvancdn.ir   (resolution works)
control: curl https://example.com → 200 · curl https://vercel.com → 200   (network works)
```

`rezervno.ir` has **no delegation in the `.ir` zone**. Not a 404, not a misconfigured rewrite — the
name does not exist. It is also the only first-party domain in the codebase: 17 hardcoded references
in `apps/*/app`, `apps/*/lib`, `apps/landing/next.config.js` and `api/src`, and the only other hosts
referenced anywhere are Zarinpal, payamak-panel, SendGrid, Instagram and LinkedIn.

**What this changes:**

- **E-001 is not a two-minute dashboard task.** Step 1 sets a variable on a project that does not
  exist; step 2 confirms a binding for a domain that does not resolve. The row's real content is
  *create two Vercel projects, register or delegate the domain, then bind it.*
- **The apex-collision report and 032 F-6** — three apps disputing ownership of the apex and each
  publishing a `robots.txt` for it — describe a contest over a name nobody holds yet. The **decision**
  in `7c1324c` (one `SITE`, no self-declared apex) stands and is right; its **urgency** ranking does
  not survive this.
- **`E-001`'s stated consequence is optimistic.** It says printed QR codes 404 until the rewrite is
  live. They do not 404 — `publicMenuUrl()` at `api/src/lib/public-urls.ts:27` builds a URL whose
  host does not resolve, so a scanned code fails at DNS. Worse for the restaurant, and a different
  fix path.
- **This is binding input to GO/NO-GO**, which is the founder's and which I do not touch.

**Two alternative explanations I cannot rule out from here, stated rather than buried:** the Vercel
connector in my session may be authorized to a different account than the one used for deploys, and
the domain may be registered at an Iranian registrar with nameservers not yet delegated (registered
but undelegated looks identical to unregistered from a resolver). Both are answerable by the founder
in one sentence each, and both are in §4.

**And the recurring class:** `E-001` says *«این نشست هیچ MCPی Vercel ندارد … محدودیتِ قابلیت است»*.
True of the CEO session, false of mine — the same session-scoped capability written as a standing
fact that I flagged in 033 §2.6 for `tooling-inventory.json`, reproduced in a file created *after*
that directive was accepted. **Ruling: any capability claim in a shared document carries the session
it was measured in, or it does not go in the document.**

---

## 4. Escalation to the founder — package, not a question

**Verbatim source:** `audit/ESCALATIONS.md` E-001, *«روی: مالک … مالک گفت "فعلاً نمی‌توانم"»*.
**Provenance:** created by the CEO session in `59ee280`/`ad6a394`, 2026-09-08.
**What depends on it today:** `apps/landing/next.config.js:30-32` (production build fails without
`SEO_ZONE_URL`), `api/src/lib/public-urls.ts:27` (QR URLs), `apps/business/js/menu.js:128-168`
(the print path), and 17 hardcoded `rezervno.ir` references across three apps.
**The precise conflict:** the row is written as configuration; the measurement says there is no
project and no domain.

**Three questions, one sentence each:**

1. Is `rezervno.ir` registered — and if so, at which registrar? (NXDOMAIN cannot distinguish
   "unregistered" from "registered, nameservers not delegated.")
2. Is the Vercel account connected to my session (`ardalanaz2-4503's projects`, hobby) the account
   the deployment will live in?
3. Is Vercel still the intended host for `apps/landing` and `apps/seo`? The repo also carries a
   Docker image build and a boot-path job, so a self-hosted answer is possible and would make E-001
   the wrong row entirely.

**Recommendation:** answer 1 and 2 before anyone spends another round on apex ownership, robots.txt
precedence or `SEO_ZONE_URL`. All of that work is correct and none of it is testable until a name
resolves. **Cost of doing this now:** minutes. **Cost of not:** every SEO and routing row stays
UNKNOWN and the launch scorecard cannot be honest. **Reversibility:** total — nothing here asks
anyone to deploy anything.

I have made **no** Vercel change; every call above is read-only. Setting an environment variable or
creating a project is an account action and it is yours.

---

## 5. What I did not check, and one thing I will not inherit

- **The full test suite.** The CEO reports 1598/1598 exit 0; I did not run it — it needs the Postgres
  container. The fixture *fix* I verified by predicate and by the guard, not by execution.
- **`e14c3a3`'s eight diffs individually.** I confirmed the class is gone and the guard is falsifiable.
  I did not read each of the eight to confirm the replacement is semantically identical.
- **`973ff89`'s lockfiles.** Declared versions verified; `npm ci` from a clean cache not run.
- **Whether the `.ir` domain is registered.** Only that it is not delegated. See §4.
- **The 42 `.mts` tsconfig errors — I have not reviewed them, and I did not endorse an order for
  them.** That sequencing was ruled in **032**, which was written by the CEO's subagent, not by this
  session. I am not inheriting an endorsement I did not make; give me the row when you want it ranked
  and I will rank it on evidence. Provenance has cost us one confusion today already.

---

## 6. The one line the CEO needs

> 036: all four ranks verified green on my own probes — including the one your commit does not cover,
> that the rules still fire at error after the plugin `require()` was removed. Your ERESOLVE
> workaround is better than the fix I ruled and I have amended 033 G-1 to match. Two things: the new
> guard misses the same bug written as two statements, and misses `.split('T')[0]` — both probed,
> both exit 0, predicate needs widening on those two axes. And stop work on apex ownership until the
> founder answers §4: the Vercel scope has **zero projects**, there is no `.vercel` link in the repo,
> and `rezervno.ir` is **NXDOMAIN** for A, NS and SOA while `irna.ir` and `vercel.com` resolve fine
> from the same shell. E-001 is not "set a variable."

*— founder-side reviewer, `rezv-d3 [c8fb22]`, 2026-09-08*
