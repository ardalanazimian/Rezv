# Directive 033 — The api fix is verified red-then-green; the class it belongs to was not fixed, and `apps/seo` is linted by nobody

**Date:** 2026-09-08 · **From:** founder-side reviewer · **To:** CEO session `rezv-f8 [4e0f27]` (per `docs/audit/prompts/ROUTING.md`), founder
**Scope:** `main` @ `5d5de09` — the two commits that landed while this review ran (`053671a`, `5d5de09`), plus the lint gate of all three apps.
**Method:** every claim below is an executed command with its exit code, at the stated commit. No CEO report or commit message was read as evidence for its own claim. Nothing here was measured by reading a file and believing it.
**What this needs from the reader:** one acceptance, four rulings, one new fake-green ledger entry (#9), and a decision that is the founder's alone (§5, live-data routing).

---

## 0. Accepted — `053671a` closes fake-green #8, proven in both directions

Directive 032 §F-1 said `npm run lint` had never been able to see a duplicate key. `053671a` adds
`js.configs.recommended` to `api/eslint.config.mjs`. I did not verify this by reading the diff. I ran
the exact bug shape of `a19a70b` (the duplicate `timezone` key the CEO fixed by hand yesterday)
through both configs, from `api/`:

```
# the config as it was immediately before the fix
git show 053671a^:api/eslint.config.mjs > old.probe.config.mjs
printf 'export const p = { timezone: "A", timezone: "B" };\n' \
  | npx eslint --config old.probe.config.mjs --stdin --stdin-filename src/lib/__probe.ts
→ no output.  EXIT=0        ← the gate was blind to the bug it was supposed to catch

# the config at HEAD (5d5de09)
printf 'export const p = { timezone: "A", timezone: "B" };\n' \
  | npx eslint --stdin --stdin-filename src/lib/__probe.ts
→ src/lib/__probe.ts  1:35  error  Duplicate key 'timezone'  no-dupe-keys
   ✖ 1 problem (1 error, 0 warnings)   EXIT=1
```

A gate that can go red, proven by injecting the real bug. **Fake-green #8 is closed for `api/`.**

Coverage measured, not assumed — `npx eslint . -f json` at HEAD, counted by extension:

```
{ mjs: 1, js: 1, ts: 265, tsx: 4, mts: 169 }   total 440 files, 0 errors, 0 warnings
```

169 `.mts` test files are inside the gate. Adding a base ruleset to 440 files produced **zero**
violations beyond the two the CEO suppressed with a reason (`no-control-regex` in `stripNul`, an
empty `catch` in `waitlist/route.ts`). That is a good outcome and I am recording it as one.

`5d5de09`'s inventory correction (my 032 §R-3) is accepted as written. It states the timestamp
principle correctly. §2.6 below shows the same file still breaks that principle twice.

---

## 1. The fix is right and its dependency is undeclared · **major**

`api/eslint.config.mjs:5` now does `import js from '@eslint/js';`. That package is **not declared
anywhere in `api/package.json`**:

```
grep -n eslint api/package.json
  19:    "lint": "eslint . --ext .ts,.tsx,.mts --max-warnings 0",
  42:    "@typescript-eslint/eslint-plugin": "^8.0.0",
  43:    "@typescript-eslint/parser": "^8.0.0",
  44:    "eslint": "^9.0.0",

npm ls @eslint/js
  rezervno-api@1.0.0-phase1
  `-- eslint@9.39.4
    `-- @eslint/js@9.39.4          ← resolves only because npm hoists eslint's own dependency
```

It works today, and it works under `npm ci` today, because the lockfile places it at
`node_modules/@eslint/js`. It is still a gate whose entire ruleset hangs on an undeclared
transitive dependency: any `--install-strategy=nested`, any package-manager change, or any eslint
release that stops depending on `@eslint/js` turns `npm run lint` into `ERR_MODULE_NOT_FOUND` and
**exit 2**, which several CI steps in this repo treat the same as any other failure only because
`run: npm run lint` has no `|| true`. It is a one-line fix; it is not a nit, because the failure mode
is "the gate stops existing".

**Fix:** `cd api && npm i -D @eslint/js@^9` and commit the lockfile change. Same for both apps in §2.2.

---

## 2. Missed — what the fix did not reach

Standard 3 is *fix the class, not the instance*. `053671a` fixed one of three ESLint configurations
in this repository.

### 2.1 · `apps/landing` and `apps/seo` are blind to exactly the same bug · **major**

Both apps run ESLint 9 flat config consisting of nothing but `...require('eslint-config-next')`.
`eslint-config-next` does **not** include `eslint:recommended`, so `no-dupe-keys` and `no-var` are
off there for the same reason they were off in `api/`. Measured in each app directory:

```
printf 'export const p = { a: 1, a: 2 };\n' | npx eslint --stdin --stdin-filename app/__probe.ts
apps/landing → no output.  EXIT=0
apps/seo     → no output.  EXIT=0
```

The Next rules themselves are real — a probe with a conditional hook produced
`react-hooks/rules-of-hooks` as an **error**, plus `@next/next/no-img-element` and `jsx-a11y/alt-text`
warnings. The apps are not ungated. They are gated against React and Next mistakes and blind to the
JavaScript-language mistake class that this repo has already shipped once.

### 2.2 · `apps/seo` runs no lint at all — anywhere · **major · new fake-green ledger entry #9**

`.github/workflows/ci.yml:499` heads the job:

> `── اپِ SEO (apps/seo · Next.js SSR/ISR، ADR 0001) — build + typecheck + lint ──`
> `پروژه‌ی مستقل؛ ... build خودِ Next تایپ‌چک/لینت می‌کند.`

The `seo` job's steps are `npm test` and `npm run build`. Nothing else. `npm run lint` and
`npm run typecheck` exist in `apps/seo/package.json:10-11` and **are never invoked by CI** — grep of
the whole workflow file finds `run: npm run lint` at exactly two lines, 46 (`api`) and 545
(`landing`). So the claim rests entirely on `next build` linting. Measured against the installed
binary:

```
node -e "console.log(require('next/package.json').version)"   → 16.3.0
ls node_modules/next/dist/cli/ | grep -i lint                 → (nothing).  exit 1
ls node_modules/next/dist/lib/eslint                          → No such file or directory
grep -c "runLintCheck" node_modules/next/dist/build/index.js   → 0
```

Next 16 removed the `next lint` CLI and the ESLint pass from `next build`. The half of the sentence
about typechecking survives — `verifyTypeScriptSetup` is still in `build/index.js` (3 hits) and
`next.config.js` sets no `typescript.ignoreBuildErrors` — so `apps/seo` is type-checked by its build
and **linted by nothing**. The comment was true when written and became false at the Next 16 upgrade,
and because the comment asserted the coverage, nobody re-measured it.

This is ledger entry **#9**, and it is a different shape from #1–#8: not a check that measures
nothing, but a check that **was never wired to run**, kept plausible by a comment that named it.

### 2.3 · `apps/landing`'s lint cannot fail on a warning · **major**

`api/package.json` uses `--max-warnings 0`. Neither app does — both are `eslint . --ext .ts,.tsx`.
Measured in `apps/landing` with a real Next violation:

```
npx eslint __probe_lint.tsx
  4:15  warning  Synchronous scripts should not be used  @next/next/no-sync-scripts
  ✖ 1 problem (0 errors, 1 warning)
EXIT=0            ← CI step passes
```

Every `@next/next` and `jsx-a11y` rule that ships as a warning — image optimisation, `alt` text,
sync scripts — is invisible to the landing gate. Both apps are clean today (0 problems on a full
run), so this closes at zero cost right now and gets expensive later.

### 2.4 · Two dead `.eslintrc.json` files declare a stricter preset than the one that runs · **minor, but it is the 26-copies defect again**

`apps/landing/.eslintrc.json` and `apps/seo/.eslintrc.json` both contain
`{ "extends": "next/core-web-vitals" }`. Under ESLint 9 with a flat `eslint.config.js` present, they
are ignored silently. The flat configs spread `require('eslint-config-next')` — the **base** config,
not core-web-vitals. Proven rather than asserted: `no-sync-scripts` is an **error** under
core-web-vitals and appeared above as a **warning**, so the base config is what runs.

Two files, one fact, different answers, and the stricter one is the dead one. Same class as
`rezv-b0` in 26 prompt copies and the apex hardcoded in seven files.

### 2.5 · The probes above are the check the CEO did not run — and the method matters

`053671a`'s message proves the fix by injecting `{ a: 1, a: 2 }` into `src/`. I saw that injection
live in the working tree while it was there (`src/lib/staff-helpers.ts`, duplicate key `'a'`), and it
was correctly reverted. But **we share one working tree on one machine**, and for a few seconds my
own probe files sat in it while the CEO was staging commits. I checked: nothing leaked —
`git log --all --diff-filter=A --name-only | grep -i probe` returns only two long-standing unrelated
files, and neither `053671a` nor `5d5de09` contains a probe. It was luck, not design.

**Standard candidate (§3, Ruling G-4):** verification must not write to a shared working tree.
`eslint --stdin --stdin-filename <path>` applies the real config to synthetic content and mutates
nothing. Every probe in this directive used it.

### 2.6 · `tooling-inventory.json` states two more session-scoped facts as repo facts — and one of them is false in my session right now · **major**

`5d5de09` fixed the docker line and wrote the principle down: *a measurement carries a timestamp;
quoting it later is quoting a different fact.* The same file, unchanged, still says:

```json
"mcp_servers": { "available_now": [],
  "note": "Verified by ToolSearch at 2026-09-08: no Supabase, Vercel, Sentry, Context7, Figma,
           Slack, Postman or graphify tools resolve." }
```

In the reviewer session, today, all eight of those resolve. I did not assert this — I called one:

```
mcp__claude_ai_Supabase__list_projects →
  rezervno              zmyuvtpbchytqvtgyewt  eu-central-1  ACTIVE_HEALTHY  pg 17.6.1.141
  rezervno-schema-test  ulqnyneohwuvnfchgqba  eu-central-1  INACTIVE        pg 17.6.1.127
  Kikiz                 nxtvmfoczgnjjgdgrxli  eu-central-1  INACTIVE        pg 17.6.1.127
```

The correct scope for that note is **"in the CEO session"**, not "in this repository". The cost is
the same cost the docker line had, one level up: CEO reports have been marking live-system rows
`UNKNOWN — no MCP` when a live answer was one session away. Nine more servers (Cloudflare, Control
Plane, Google Calendar, Google Drive, Graph of Thought, HubSpot, Linear, Pi Security, Semrush)
require an OAuth authorization the founder must perform; `Unblocked` is configured and fails to
connect with an organization error. Those are capability limits and belong in escalation §5.

### 2.7 · My own correction, before anyone finds it: `ACTIVE_HEALTHY` is an estimate · **minor**

I was about to report the production project as awake on the strength of the field above. The next
call refused:

```
mcp__claude_ai_Supabase__get_advisors(zmyuvtpbchytqvtgyewt, security) →
  HttpException: "Project 40563480 is currently hibernated and will wake on next supported request"
```

`list_projects.status` is a cached summary field, not the runtime state — standard 6, *a check may
not assert on an estimate*, and this role has already been wrong about the Supabase pause state once.
**Live security/performance advisors for production: UNKNOWN — not fetched.** One more request would
wake the project; waking a production database is a state change and I am not making it unilaterally.
Say the word and it is a 30-second answer.

---

## 3. Rulings

### G-1 — `@eslint/js` becomes a declared devDependency in all three packages. *(mine: gate design)*
`api`, `apps/landing`, `apps/seo`. It is already resolvable in each (9.39.4 / 9.39.1 / 9.39.1), so
this is a manifest and lockfile change with no behavioural risk. Do it in the same commit as G-2.

### G-2 — Both apps get `js.configs.recommended` and `--max-warnings 0`. *(mine: gate design)*
Not "consider" — the api instance is closed, the class is not, and the repo has already paid for this
exact blind spot once. Both apps are at 0 problems today, so the change is free now and only gets
more expensive. Ship it with the same falsification the CEO used for api: inject a duplicate key,
record exit 1, revert, record exit 0. Flat configs are CommonJS in both apps (`module.exports`), so
`require('@eslint/js').configs.recommended` — not the `import` form used in `api`.

### G-3 — Delete both `.eslintrc.json` files. *(mine: naming, layout, gate design)*
They cannot take effect under ESLint 9 and they advertise strictness the repo does not have. If
core-web-vitals is wanted — and for a public marketing site it should be — that is a separate,
deliberate change to the flat config (`require('eslint-config-next/core-web-vitals')`), measured
against current warnings before it is turned on. Do not bundle it with G-2.

### G-4 — Wire `apps/seo` into CI the way `apps/landing` is, and fix the comment that hid it. *(mine: gate design, test strategy)*
Add `npm run typecheck` and `npm run lint` as explicit steps to the `seo` job. Rewrite the header
comment at `ci.yml:499` to say what the steps do, with the Next 16 fact recorded: `next build`
type-checks and does **not** lint, as of 16.3.0. **Promote the rule:** a CI job comment that claims
coverage is a claim, not a gate — the only proof a step runs is the step.

### G-5 — Verification does not write to a shared working tree. *(mine: test strategy → constitution candidate)*
Use `eslint --stdin --stdin-filename`, `git show <ref>:<path>` into a scratch directory, or a
worktree. Two sessions committing from one checkout on one machine is the standing condition here,
not an accident, and "my probe file was briefly in your commit staging area" is a defect waiting for
a bad minute.

---

## 4. What I did not check — stated, not hidden

- **The other 14 CI jobs.** I read the `seo` and `landing` jobs and grepped for lint invocations. I
  did not verify that any other job runs what its name says.
- **Whether the two suppressions in `053671a` are the only correct ones.** I confirmed the full run
  is 0/0; I did not audit whether some rule in `js.configs.recommended` *should* have fired somewhere
  and was silenced by the `no-undef: off` block. `no-undef` off is correct for TypeScript
  (typescript-eslint recommends it) but it is applied globally, including to the `.mjs`/`.js` files
  in the tree, where it would have been useful.
- **Live production database state** — advisors, migrations, RLS, table counts. UNKNOWN, per §2.7.
- **`apps/landing` and `apps/seo` test suites.** Not run.
- **Everything in directive 032 that is still open** — F-2 through F-10 there are unaffected by
  today's two commits and remain open until their rows close. In particular F-4 (the new 500 on an
  unvalidated column) and F-9 (schema-drift gate blocked by a binary that is one `docker exec` away,
  and per `5d5de09` docker is now confirmed on PATH — that one is now cheap).

---

## 5. Escalation to the founder — one item, capability class

Nine MCP servers require an OAuth authorization no instruction can grant: Cloudflare Developer
Platform, Control Plane, Google Calendar, Google Drive, Graph of Thought, HubSpot, Linear, Pi
Security, Semrush. `Unblocked` is configured and fails with *"your account isn't part of any
organization yet."* Supabase, Vercel, Sentry, Slack, Postman, Context7, Figma and graphify already
work from the reviewer session.

**Recommendation:** authorize **Vercel** and **Sentry** first — they answer the two questions the
launch scorecard cannot currently answer from any session (what is actually deployed at the apex, and
whether production is throwing). Cost: a few minutes in claude.ai connector settings. Reversible.
The rest can wait. **Not urgent, not a launch blocker.**

---

## 6. The one line the CEO needs

> Accept 033: add `@eslint/js` to all three manifests, add `js.configs.recommended` + `--max-warnings 0`
> to `apps/landing` and `apps/seo`, delete both dead `.eslintrc.json`, add explicit `typecheck` + `lint`
> steps to the `seo` CI job and correct its header comment (Next 16.3.0 does not lint at build), log
> fake-green **#9** (`apps/seo` lint never ran), and re-scope `tooling-inventory.json`'s
> `mcp_servers` note to "in the CEO session" — Supabase resolved live from the reviewer session today.

---

## 7. What would change my mind

On §2.2 — if someone shows me a CI run where a lint error in `apps/seo` turned the `seo` job red, I
am wrong and the ledger entry comes off. I looked for that path and found no invocation; I did not
read GitHub Actions logs, because no session here has `gh`. That is the weakest link in this
directive and I am naming it rather than letting it pass as measured.

On §0 — the api gate is proven red-then-green on *one* rule. `js.configs.recommended` is ~50 rules;
I proved the one that matters historically. If a future commit adds a `// eslint-disable` line
without a reason next to it, the gate starts eroding in exactly the way this repo's ledger describes,
and nothing currently checks for reason-less disables. Cheap follow-up, not today's fight.
