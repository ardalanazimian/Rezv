> ## ⛔ AGENCY_STATUS=DISABLED — PLANNED / NOT IMPLEMENTED
>
> **این سند فقط «معماریِ برنامه‌ریزی‌شده» است و هیچ سیستمِ در حالِ اجرایی را توصیف نمی‌کند.**
> در ۲۰۲۶-۰۸-۱۳ با تصمیمِ صریحِ مالکِ محصول، اجرایِ خودکارِ عامل‌ها به‌طورِ کامل
> متوقف شد (دلیل: مصرفِ بیش از حدِ توکن/منابع). رجوع کن به `agency/AGENCY_STATUS`.
>
> هیچ‌چیز در این فایل دستورالعملِ اجرایی نیست. به‌طورِ مشخص ممنوع است:
> ساختِ Routine/trigger/cron، اشتراکِ خودکارِ رویدادِ PR، حلقهٔ خودگردان،
> پایشِ پس‌زمینه، خودآموزی، و هر عملیاتِ خودکارِ گیت‌هاب.
> کلیدهایِ فعال‌سازیِ قدیمی (`REZV`، `REZV FULL`) بی‌اثرند.
>
> فعال‌سازیِ دوباره فقط با تصمیمِ مکتوبِ انسانی و تغییرِ دستیِ `agency/AGENCY_STATUS`.

# CEO Briefing

The first real output of the `rezv-ceo` role (Section 12 of the original
request): a synthesis of `DISCOVERY.md`, `CAPABILITY_MATRIX.md`, and
`CODE_SEARCH_AUDIT.md` into strategy-relevant statements, each labeled
`FACT`, `EVIDENCE`, `INFERENCE`, `RECOMMENDATION`, or `UNKNOWN` per Section
12's own requirement. Nothing below is a business-intelligence number
pulled from thin air — every `RECOMMENDATION` traces back to a cited row
in one of those three documents.

## Where the product actually stands

- **FACT**: this is a mature, multi-app platform (customer/business/
  company panels + landing + SEO site, 105 API routes, 58 backend `lib`
  modules) with real auth, multi-tenant, multi-branch, and payment
  (Zarinpal) implementations — not a prototype.
- **EVIDENCE**: the platform has been through repeated real security and
  fake-data audit passes (`SECURITY-AUDIT.md`'s OWASP walkthrough; commit
  history titled around removing fabricated dashboard numbers). Quality
  discipline is demonstrably active, not aspirational.
- **FACT**: `CODE_SEARCH_AUDIT.md` found zero `TODO`/`FIXME`/`MOCK`/`FAKE`
  markers across `api/src`, all three panels, and both React apps, and the
  handful of `STUB`/`BYPASS` hits are all benign (security-hardening
  comments, not actual shortcuts).
- **INFERENCE**: given the above two points together, the codebase's known
  gaps are more likely to be *documented-but-unaddressed* debt
  (`docs/KNOWN_LIMITATIONS.md`) than *silently unmarked* debt — a search
  for unmarked issues would need semantic review, not another grep pass.

## Risk picture (Security Agent's hard-gate items, Section 27)

- **FACT**: no P0/P1 finding is open in this briefing — every item in
  `SECURITY-AUDIT.md`'s OWASP walkthrough is recorded as already fixed
  (refresh-token rotation/revocation, `HS256`-pinned JWT, parametrized
  `$queryRaw` only, global `esc()`).
- **EVIDENCE**: RLS is enabled on all 35 Postgres tables but carries **zero
  policies** (`PROJECT-KNOWLEDGE.md` §2) — authorization is fully
  application-layer, RLS is a backstop only, not active defense-in-depth
  today.
- **RECOMMENDATION**: treat "add real RLS policies" as a `rezv-security` +
  `rezv-database` joint proposal, not an emergency — current app-layer
  enforcement is documented as tested and correct, so this is a
  defense-in-depth improvement, not an open vulnerability. Route it through
  the normal PR lifecycle with the destructive-DB-operation approval gate
  (`governance/GOVERNANCE.md`) if it touches existing data.
- **UNKNOWN**: whether `main`'s CI is green right now (not checked this
  session — see `DISCOVERY.md` §3). A CEO-level report should not claim
  "production is healthy" on the strength of this directory alone.

## Technical debt / cost awareness

- **EVIDENCE**: `docs/KNOWN_LIMITATIONS.md` already tracks the honest debt
  inventory (deployment wiring gaps, migration history quirks, frontend
  design-system status) with **(uncertain)**/**(follow-up)** markers of its
  own — this briefing defers to that document rather than re-scoring debt
  from scratch.
- **FACT**: E2E coverage is asymmetric — `apps/customer` has real
  flow-level Playwright coverage (booking, waitlist, auth) across all
  three CI device profiles; `apps/business`/`apps/company` have structural
  smoke tests only (`e2e/tests/panels-smoke.spec.ts`), by that test file's
  own admission ("business و company تا کنون هیچ e2e نداشتند").
- **RECOMMENDATION**: if the next roadmap slot goes to QA/DevOps work
  rather than a new feature, closing the business/company E2E gap is the
  best-evidenced candidate — it's a named, cited gap (not a guess), it's
  within `rezv-qa`'s registered scope, and it's exactly the kind of
  "fix what exists" work `CLAUDE.md` prioritizes over new features.

## Governance state

- **FACT**: this Agency layer (`agency/`) is a specification only. No
  scheduled/unattended agent execution exists against this repo as of this
  briefing.
- **RECOMMENDATION**: any decision to activate real scheduled execution
  (Routines/triggers per `ORCHESTRATION.md`) should specify, per task,
  exactly which repo actions are allowed (report-only vs. push-a-fix vs.
  open-a-PR), because that is the one class of change in this whole
  directory that is genuinely hard to reverse once running.

## What this briefing deliberately does not claim

- No user/business metrics (MRR, DAU, conversion rate, churn %) — none
  were available to query in this session, and Section 16/26 of the
  original request explicitly forbid fabricating them. If those numbers
  exist in an analytics backend, `rezv-marketing`/`rezv-intelligence`
  should pull and cite them directly rather than have this briefing guess.
- No claim about competitors — `rezv-competitive-intelligence`'s
  `knowledge/KNOWLEDGE_SYSTEM.md` §COMPETITIVE_MEMORY section is still
  empty; nothing here substitutes for that agent role actually doing
  public-source research.
