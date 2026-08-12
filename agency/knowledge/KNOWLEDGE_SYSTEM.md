# Knowledge System

The eleven memory categories from the original request (Section 24), each
owned by `rezv-knowledge` and updated only by the agent role named in
`registry/agents.yaml`'s `permissions.write` for that area. Per Section 23,
an entry only belongs here if it is backed by observation + evidence +
execution/experiment with a measured outcome — a `RECOMMENDATION` or
`HYPOTHESIS` does not get written into memory as if it were learned fact.

Each category starts with only the entries that already have a citation
elsewhere in the repo (mostly `CLAUDE.md` / `PROJECT-KNOWLEDGE.md`). Empty
categories are empty because no qualifying evidence exists yet — that is
itself the honest state, not a gap to paper over.

## PROJECT_MEMORY
- Five apps, not three: `apps/customer`, `apps/business`, `apps/company`
  (vanilla JS, no build), `apps/landing`, `apps/seo` (independent Next.js/
  React apps). — `CLAUDE.md`
- Backend is one Next.js 16 (App Router, Turbopack) app under `api/`; the
  panels have no server-side code of their own. — `CLAUDE.md`
- `shared/` has no React components/hooks — only CSS tokens, a handful of
  shared JS helpers, and shared content JSON. — `CLAUDE.md`

## TECHNICAL_MEMORY
- Demo OTP has two independent, both-legitimate paths: `OTP_DEV_MODE=true`
  (server returns a real random code, for local/CI testing) vs. the
  client-side offline fallback accepting fixed `1234` only when the
  backend is genuinely unreachable (`file:` protocol or offline response).
  Do not conflate or "simplify" these into one path. — `CLAUDE.md`
- `$queryRaw`/`COUNT(*)`/`SUM(...)` return JS `BigInt`, not `number`, even
  though the TypeScript generic says `number` — cast in SQL (`::int`) *and*
  wrap in `Number()` in JS, both layers, or aggregate stats silently break.
  — `CLAUDE.md`
- Hardcoded `+03:30` timezone offset was a recurring regression across
  `availability.ts` (×2) and `reservation-helpers.ts` before being fixed to
  use `zonedTimeToUtc` with `Restaurant.timezone` — a known regression
  hotspot, watch for reintroduction. — `PROJECT-KNOWLEDGE.md` §4
- OTP input `maxlength`/regex was previously `4` digits across all three
  apps while the backend generates 6-digit codes, making real login
  impossible — fixed to `maxlength="6"` / `/^\d{4,6}$/`; another known
  regression hotspot. — `PROJECT-KNOWLEDGE.md` §3
- **2026-08-12 — full frontend↔backend route/method audit, clean except
  payment.** Every `API.*` call site in the three vanilla-JS panels
  (customer/business/company) plus the server-side API clients in
  `apps/landing` and `apps/seo` was extracted and matched against the real
  105 backend routes (path template + allowed HTTP methods, parsed from
  every `route.ts`). Zero real path/method mismatches (2 flagged by the
  matching script were false positives from `'/x/' + id` string
  concatenation, verified by hand). Same-origin API-base resolution
  (`resolveApiBase()` returning `''`) is correct for the primary
  self-hosted deployment — `deploy/nginx/*.conf` and
  `deploy/caddy/Caddyfile` both reverse-proxy `/api/*` to the backend on
  the same domain; the separate-Vercel-project path still needs manual
  `RZ_API_BASE`/`rz-api-base` configuration, already tracked in
  `docs/KNOWN_LIMITATIONS.md`, not a new finding. The one real gap found:
  payment (see `PRODUCT_MEMORY`). CI's `e2e` job (3 device profiles,
  customer app) was green on this same commit.

## PRODUCT_MEMORY
- **2026-08-12 — online payment (Zarinpal) is backend-only, not reachable
  from any app.** A full frontend↔backend connectivity sweep (every
  `API.get/post/patch/del` call in `apps/customer/js`, `apps/business/js`,
  `apps/company/js`, plus `apps/landing`/`apps/seo`'s server-side API
  clients) was cross-checked programmatically against the real 105 backend
  routes and their HTTP methods. Every call matched a real route+method —
  **except** payment: `POST /reservations/[code]/pay` exists and is wired
  to a real Zarinpal client (`api/src/lib/zarinpal.ts`), but zero UI in any
  of the three panels calls it (grepped for `pay`/`zarinpal`/`deposit`,
  zero hits). `docs/architecture-audit/FEATURE_COVERAGE_MATRIX.md` lists
  payment as part of the "Complete" core flows — that claim does not hold
  up against the actual frontend code as of this verification. —
  `PROJECT-KNOWLEDGE.md` §6 (corrected same day), `agency/CAPABILITY_MATRIX.md`

## UX_MEMORY
- (empty — see `docs/CUSTOMER_UI_AUDIT_REPORT.md` and
  `docs/CUSTOMER_ACCESSIBILITY_REPORT.md` for existing findings; not
  duplicated here until re-verified as still current)

## SECURITY_MEMORY
- Postgres: all 35 tables have RLS **enabled** but **zero policies**
  (deny-by-default at the DB layer); actual authorization happens in
  application code because Prisma connects with an owner role that
  bypasses RLS — RLS is not doing active authorization work today, it is a
  defense-in-depth backstop only. — `PROJECT-KNOWLEDGE.md` §2
- `OTP_DEV_MODE=true` in production is a full auth bypass (OTP returned in
  the API response) and is fail-fast blocked. — `PROJECT-KNOWLEDGE.md` §3
- `ALLOWED_ORIGINS` unset in production silently disables CSRF/Origin
  checks; it is fail-fast required in `middleware.ts`. —
  `PROJECT-KNOWLEDGE.md` §3
- JWT verify pins `algorithms: ['HS256']` explicitly plus `issuer`/
  `audience`, closing an algorithm-confusion class of attack; refresh
  tokens rotate and are revocable via a Redis blacklist. — `SECURITY-AUDIT.md`

## MARKETING_MEMORY
- (empty — no measured campaign/funnel outcomes recorded in-repo yet)

## SEO_MEMORY
- Structured-data (JSON-LD) coverage has an automated unit-test check wired
  into CI as of the "SEO P10" commit. — `git log` (commit `4a27639`,
  verified this session), `SEO_AUDIT_REPORT.md`

## COMPETITIVE_MEMORY
- (empty — `rezv-competitive-intelligence`/`rezv-web-intelligence` populate
  this only from public-source research with a citation, per
  `registry/agents.yaml`)

## EXPERIMENT_MEMORY
- (empty — no experiments with hypothesis/baseline/metric/outcome recorded
  in-repo yet)

## INCIDENT_MEMORY
- (empty in this directory — `docs/KNOWN_LIMITATIONS.md` already tracks
  known issues/tech debt with **(uncertain)**/**(follow-up)** markers;
  treat that file as the incident/debt log of record until findings are
  specifically confirmed as closed incidents worth duplicating here)

## DECISION_MEMORY
- Two design systems intentionally do not sync: `shared/css/` (panels, no
  build) and `apps/seo/app/globals.css` (website) — same token names,
  separate files, by design. — `CLAUDE.md`
- Vanilla-JS panels (`customer`/`business`/`company`) are intentionally not
  migrated to React; Landing/SEO are intentionally kept as separate Next.js
  apps rather than unified with the panels. — `CLAUDE.md`, original request
  §5
- **2026-08-11 — first live Routine activated, scope: report-only.** The
  human explicitly chose "فقط گزارش (بدونِ نوشتن)" (report-only, no
  writing) when asked, via `AskUserQuestion`, exactly what a scheduled
  agent should be allowed to do — out of four options ranging from
  report-only up to "open PRs" and "full babysit-PR posture." This is the
  first (and, as of this entry, only) piece of `ORCHESTRATION.md` promoted
  out of `DOCUMENTED_ONLY`: a daily cron Routine (`trig_017G3nMLE9anexdJvVRFnSfr`,
  `0 6 * * *` UTC, self-bound to the session that created it) acting in an
  `rezv-ceo`/`rezv-security` read-only capacity — checks new commits on
  `main`, CI/PR status if GitHub tools are available in that firing, and a
  light grep-based scan of changed files only. Its prompt hard-forbids
  `git commit`/`git push`/file edits/PR/issue/comment creation and
  instructs it to say so explicitly rather than guess if a check couldn't
  run (e.g. GitHub MCP tools unavailable on that firing). Every other
  agent role and every other capability in `registry/agents.yaml` remains
  `DOCUMENTED_ONLY` — this decision authorizes exactly this one Routine's
  exact scope, not a general "agents may act autonomously" grant. To
  revoke: `delete_trigger` on the ID above, or ask the session to do it.
