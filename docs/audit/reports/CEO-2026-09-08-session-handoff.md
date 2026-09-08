# Session handoff — 2026-09-08

**From:** CEO `rezv-f8 [4e0f27]` · **Machine:** DESKTOP-I0P8973 · **Reason:** founder shutting the laptop down.
**State:** `main @ e94b906`, tree clean, **0 unpushed**, 24 commits today, all on `origin/main`.

---

## 1. The one thing that changes everything, read this first

**`rezervno.ir` does not resolve.** Measured from two independent sessions with controls:

```text
nslookup -type=A|NS|SOA rezervno.ir  @8.8.8.8   →  NXDOMAIN on all three
nslookup -type=NS       app.rezervno.ir         →  NXDOMAIN
control: irna.ir (another .ir)                  →  RESOLVES
control: vercel.com                             →  RESOLVES
Reviewer's Vercel read: one hobby team, list_projects → []
```

The domain has no delegation in the `.ir` zone. **Everything built today for the web layer is
correct and untestable until a name resolves.** Do not spend another round on apex ownership,
robots precedence or `SEO_ZONE_URL` before `audit/ESCALATIONS.md` E-001 is answered.

A registered domain with no delegated nameservers looks identical from outside to an unregistered
one — that distinction cannot be made from this machine.

## 2. Environment — this took real work today, do not rediscover it

Installed on this machine today: **Node 20.20.2** (`winget OpenJS.NodeJS.20`), **Python 3.12.10**,
**WSL2 + Ubuntu** (needed `wsl --install --no-distribution` **plus a reboot** — the installer
reports success while a reboot is still pending). `npm ci` has been run in all four workspaces.

**Test database** — throwaway containers, recreate with:
```bash
docker run -d --name rezv-test-pg -e POSTGRES_PASSWORD=ephemeral_local_only \
  -e POSTGRES_USER=rezervno -e POSTGRES_DB=rezervno_test -p 55432:5432 postgres:16-alpine
docker run -d --name rezv-test-redis -p 56379:6379 redis:7-alpine
```
Then, from `api/`, the CI-equivalent schema recipe: `npx prisma db push --skip-generate` →
`sh prisma/apply-sql.sh` → `psql … -f prisma/test-schema-fixups.sql`.

**`npm test` needs all six env vars or ~130 tests fail spuriously** — that is a setup artifact, not
a regression:
`DATABASE_URL` (`postgresql://rezervno:ephemeral_local_only@localhost:55432/rezervno_test`),
`DATABASE_DIRECT_URL`, `DIRECT_URL` (same), `REDIS_URL=redis://localhost:56379`,
`ALLOWED_ORIGINS`, `JWT_SECRET` (≥32 chars), `JWT_REFRESH_SECRET`.

**Green baseline as of shutdown:** `npm test` exit 0 · **1598 pass / 0 fail / 382 suites** ·
`tsc --noEmit` exit 0 in all three apps · `npm run lint` exit 0 in all three · `next build` exit 0.

## 3. Traps this machine has, each of which cost real time today

- **`git show <rev>:<path>` is silently mangled** by MSYS path conversion into `rev\path;…`,
  returning **empty output**. A `grep -c` on that reads as zero and looks like a real finding. Use
  `MSYS_NO_PATHCONV=1`.
- **`npm test` in `apps/landing`/`apps/seo` fails on Windows** — the script globs `test/*.test.mts`
  and npm's shell does not expand it. Run `npx tsx --test --test-force-exit $(ls test/*.test.mts)`.
  CI on Linux is unaffected.
- **Background tasks can survive and hang.** Twelve orphaned `tsx --test` processes held the Prisma
  engine DLL for ~5 hours and broke `npm run build` with `EPERM`. Check with
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` before blaming the code.
- **Never read an exit code from the end of a pipe.** It produced a false "install succeeded" today.
- **`docker info` / `docker version --format` return exit 0 while the engine 500s.** Only
  `docker ps` fails honestly.

## 4. Open queue

**Blocked on the founder (E-001, in `audit/ESCALATIONS.md`):** is `rezervno.ir` registered and
where · is the Vercel account the Reviewer can see the deploy account · is Vercel still the intended
host, given the repo also builds a Docker image.

**Mine, not blocked:**
- 42 `.mts` type errors (0 in `src/`). Sequencing endorsed: fix the 42, *then* add `**/*.mts` +
  `allowImportingTsExtensions` to `api/tsconfig.json`. **Not yet ranked by the Reviewer** — that
  ordering came from a CEO subagent (032), and I wrongly attributed the endorsement to `rezv-d3`.
- Known limit, deliberately named in the guard header: `check-run-clock-date-keys.mjs` tracks only a
  direct local assignment. A date returned from a function or arriving as a parameter is invisible.
- `.mts` files in `apps/landing`/`apps/seo` have no unused-vars coverage (two different parsers).
  Recorded in each `eslint.config.js`, not silenced.
- Reviewer ranks 5 and 6, both downgraded by it: `restaurants.timezone` has no CHECK constraint
  (operator footgun, no reachable 500) and day-length `+24h` arithmetic (latent — Iran has no DST).

**Roster:** 9 sonnet · 4 opus · 3 haiku. `ds-token-guardian` was moved back to sonnet after it turned
out to be the sole writer of `apps/landing/components/**` — I had downgraded the owner of a whole app
on a policy sweep without reading its charter.

## 5. Team

`rezv-f8 [4e0f27]` CEO (this session) · `rezv-d3 [c8fb22]` founder-side Reviewer, active and
productive — it authored directives 033, 035, 036 and caught the three sharpest findings of the day.
`docs/audit/prompts/ROUTING.md` is the addressing source of truth; **session ids change on restart**,
mine went `rezv-b0` → `rezv-f8` mid-day and 26 references across seven prompts went stale.

`rezv-b1 [5f3782]` has been running 6+ hours and never identified itself. The second team on
`DESKTOP-8DAJNO5` (`audit/launch-hardening`) has been silent since 2026-09-07 16:07 and is now well
behind `main`. **Git is the only channel that reaches them** — cross-session messaging does not.
