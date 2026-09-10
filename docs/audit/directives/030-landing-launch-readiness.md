# Directive 030 — Landing page launch readiness: the conversion path is honest, and one build-time variable can silently kill every form

**Date:** 2026-09-07 · **From:** founder-side reviewer · **To:** founder, CEO agent
**Origin:** founder, 2026-09-07 — «صفحه لندینگ خیلی مهمه برای جذب مشتری». Audited as an acquisition
surface, not only for defects.

---

## 1. What is genuinely good — measured, not assumed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| Routes with `metadata` / `generateMetadata` | **21 / 21** |
| Internal links resolving to a real route | **all**; zero broken |
| Images without `alt` | **0** |
| `apiPost` behaviour on non-2xx | **throws** (`client-api.ts:47-54`) |
| Network failure | **throws** (`:39-40`) |
| Missing API base | **throws** a named error (`:29`) |

**The conversion path is honest, which is the thing that mattered most.** `TrialForm` sets
`status='done'` only after a successful `apiPost` returns data, and the success panel is gated on
`status === 'done' && result` — two conditions, so a partial response cannot render a success. Errors
go to `serverError` and the form returns to `idle`. `aria-invalid`, `aria-describedby`,
`role="alert"` and `role="status"` are all present. This is the four-states rule implemented properly
on the page that converts customers, and it is worth saying so plainly rather than only listing
defects.

## 2. The one launch risk on the acquisition path

`client-api.ts:12` — `const BASE = (process.env.NEXT_PUBLIC_API_BASE || '')`

`NEXT_PUBLIC_*` is **inlined at build time** by Next.js. If that variable is absent when Vercel builds
the landing site, the value is baked in as empty and **every form on the site is dead** — trial
signup, contact, and purchase — until someone rebuilds with it set.

**Nothing fails the build.** `next.config.js` does not require it; `git grep` finds no build-time
assertion anywhere. The site deploys green, renders perfectly, ranks fine, and converts nobody.

**The mitigation that exists and is good:** all three forms call `isApiConfigured()` and render a
notice — `ContactForm:184`, `TrialForm:244`, `PurchaseDialog:308`. So a visitor is told rather than
silently failing. That is the honest-empty rule applied correctly.

**Why it is still a launch risk:** the notice tells the *visitor* something is broken. It tells
*nobody at Rezervno*. A misconfigured build is invisible from the inside — no error, no metric, no
alert — and the only signal is an absence of signups, which looks exactly like a marketing problem.
**Diagnosing "no customers" as a config bug takes days; diagnosing it as a failed build takes
seconds.**

**Directive.** Fail the landing build when `NEXT_PUBLIC_API_BASE` is unset in a production build.
Three lines in `next.config.js`, falsifiable by building with it unset and watching the build exit
non-zero. This is the cheapest guard in this entire audit and it protects the revenue path.

## 3. Still open from directive 028, being fixed now

`getPlans()` falls back to committed prices on any API failure, and `revalidate = 300` caches the
result. An agent is adopting the `apps/seo/lib/api.ts` split — genuine 404 → `notFound()`,
infrastructure failure → `throw`, so ISR keeps serving the last good page. Prose fallbacks stay;
**price fallbacks do not**, because a stale price misleads about a commitment and stale prose does
not.

## 4. Still the founder's, and unchanged by tonight

**Domain topology** (directive 029) — nothing serves the apex, `apps/landing` and `apps/seo` are in no
deploy file, and the apps have already committed 28 absolute `rezervno.ir` URLs plus a sitemap. **This
is the largest launch risk on the acquisition path and no agent can fix it**: it is hosting, DNS and a
Vercel project mapping. The landing site being excellent does not matter if its address is undecided.

**Brand identity** (directive 025) — three different marks; only the customer favicon agrees with the
design tokens. The landing icon matches nothing. A decision, not a defect.

## 5. Method note

I audited this as an acquisition surface rather than a bug list, and the result is mostly a
confirmation: someone built this carefully. The finding that matters is not a broken thing — it is a
**correct thing with no alarm on it**. The forms degrade honestly for the visitor and silently for the
business, and that asymmetry is the whole risk. That is the third time this round the defect was an
absent signal rather than a wrong one.
