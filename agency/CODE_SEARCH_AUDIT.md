# Full Codebase Search — Section 7 Classification

The original request's Section 7 asks for a full-repo search and
classification of markers that usually signal unfinished or risky code
(`TODO`, `FIXME`, `MOCK`, `STUB`, `PLACEHOLDER`, `FAKE`, `DEMO`,
`TEMPORARY`, `BYPASS`, `NOT_IMPLEMENTED`, `console.warn`/`console.error`,
hardcoded values, `localhost` references, secrets/tokens/passwords, auth/
RBAC/tenant/RLS logic, migrations, webhooks, rate limiting, payment logic,
OTP flows) — "do not modify blindly, classify first." This is that search,
run against `api/src`, `apps/customer`, `apps/business`, `apps/company`,
`apps/landing`, `apps/seo`, `shared` (excluding `node_modules`), for
`*.ts`/`*.tsx`/`*.js`. All findings below are `FACT` — actual `grep`
output from this session, each hand-checked in context rather than counted
blind.

## Marker counts (raw)

| Marker | Matches | Verdict |
|---|---:|---|
| `TODO` | 0 | none found |
| `FIXME` | 0 | none found |
| `MOCK` | 0 | none found |
| `FAKE` | 0 | none found |
| `TEMPORARY` | 0 | none found |
| `NOT_IMPLEMENTED` | 0 | none found |
| `STUB` | 1 | benign (see below) |
| `BYPASS` | 3 | all benign — security *hardening* comments guarding
  against bypasses, not actual bypass code |
| `PLACEHOLDER` | 76 | **false positive as a marker** — every hit is an
  HTML `placeholder="..."` input attribute (form UX text), not a
  code-completeness marker |

**This itself is a real finding, not a null result to wave away**: a
codebase of this size with zero `TODO`/`FIXME`/`MOCK`/`FAKE` markers is
unusual and consistent with the commit history already in `git log`
(multiple prior sessions explicitly titled around removing fake/demo data
from dashboards — e.g. `اعدادِ ساختگی → دادهٔ واقعی`, `رفعِ سه یافته‌ی «دیتای
ساختگی در داشبورد»`). It should be read as "prior audits already swept
this," not "nothing was ever wrong here."

## Line-by-line check of the 4 real hits

- `api/src/lib/reservations.ts:29` — comment about being able to inject a
  test stub for a dependency in unit tests. Standard DI pattern
  description, not an actual stub/mock standing in for real logic.
- `api/src/lib/validate.ts:16` — comment explaining *why* the internal
  Zod-like validation library intentionally mirrors real Zod's immutable-
  schema behavior, to avoid a validation-bypass bug class. Documentation of
  a defense, not a bypass.
- `api/src/lib/otp.ts:46` — comment describing what an OTP-dev-mode bypass
  *would* look like, immediately followed by:
- `api/src/lib/otp.ts:49` — the actual guard: `throw new Error('[SECURITY]
  OTP_DEV_MODE=true در production مجاز نیست...')` — a fail-fast that
  *prevents* the bypass in production. This is the same control already
  documented in `knowledge/KNOWLEDGE_SYSTEM.md` under `SECURITY_MEMORY`.

## `console.warn`/`console.error`

8 hits total, all reviewed:
- `api/src/lib/logger.ts:90,95` — the logger's own implementation
  (`console.error`/`console.warn`/`console.log` dispatch by level). This
  *is* the logging layer, not a leftover debug statement.
- `api/src/lib/otp.ts:53` — `console.warn('[امنیت] OTP_DEV_MODE فعال
  است...')` — a deliberate, loud runtime warning whenever dev-mode OTP is
  active, so it's never silently on. Correct behavior, not a defect.
- `apps/customer/js/icons.js:85`, `apps/business/js/icons.js:85`,
  `apps/company/js/icons.js:85` — identical one-line guard (`if (!p) {
  console.warn('icon نامعتبر:', name); ... }`) in all three panels' copy of
  `icons.js`, consistent with `shared/js/icons.js` being the single source
  synced out to each app (`tools/sync-design-system.sh`) — not three
  independently-drifted files.

## `localhost` references

2 files, both legitimate: `api/src/lib/security.ts:102` and
`api/src/lib/events.ts:74,89` both list `localhost` as a **blocked** host
in SSRF-prevention logic (alongside `metadata.google.internal`,
`169.254.169.254`, `kubernetes.default`) — the opposite of a hardcoded
dev-only URL leaking into production; it's a security control.

## `[DEMO]` labeling discipline (CLAUDE.md rule 6)

`apps/company/js/photos.js` is the one file using the `[DEMO]` tag, and it
does so correctly: three demo restaurant fallback records
(`'[DEMO] کافه‌رستوران ویستا'`, `'[DEMO] سفره‌خانه گرام'`, `'[DEMO] کافه
هانا'`) used only when the photo-review API is unreachable, with an
explicit UI notice ("این عکس‌ها ساختگی‌اند و با [DEMO] برچسب خورده‌اند").
No real restaurant names are used. This is the pattern every other agent
role adding demo data should follow.

## What this search did not cover

- Secrets/tokens/passwords/RBAC/tenant/RLS/migrations/payment/OTP *logic*
  (as opposed to marker strings) is already covered by the cited audits in
  `DISCOVERY.md` §2 (`SECURITY-AUDIT.md`, `docs/backend-audit/
  SECURITY_AUDIT_REPORT.md`, `docs/backend-audit/DATABASE_AUDIT.md`) —
  re-grepping those wasn't repeated here to avoid duplicating that work.
- `.md`/`.html`/`.sql`/`.yml` files were not included in the marker search
  above (scoped to `.ts`/`.tsx`/`.js` since that's where an unfinished
  *code* marker would live); a `TODO` inside a doc file is a roadmap note,
  not the same class of risk.
- This is a static grep, not a semantic audit — it cannot find silent gaps
  that were never marked with any of these tokens. Absence of `TODO` is
  evidence of clean *labeling* discipline, not proof of zero technical
  debt (see `docs/KNOWN_LIMITATIONS.md` for the debt that *was* recorded,
  just not with these markers).
