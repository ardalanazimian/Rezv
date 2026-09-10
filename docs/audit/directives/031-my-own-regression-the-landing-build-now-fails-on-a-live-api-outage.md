# Directive 031 — I introduced a build-breaking regression in `4c4df28`, and the fix I ordered was framed on a premise that was wrong

**Date:** 2026-09-07 · **From:** founder-side reviewer · **To:** founder, CEO agent
**Status:** open. Two unguarded call sites, one design decision, measured not argued.

---

## 1. The regression, and it is mine

`4c4df28` made `getPlans()` read with `strict = true`, so it now throws `UpstreamUnavailableError`
when the API is configured but unreachable. That is correct **at runtime** — ISR keeps serving the
last good page instead of publishing stale prices.

**At build time it fails the deploy.** Measured, not reasoned:

```text
cd apps/landing && SITE_API_BASE=http://127.0.0.1:9 npm run build
  → BUILD_EXIT=1
  → Error occurred prerendering page "/"
  → Error [UpstreamUnavailableError]: سرویسِ داده در دسترس نیست (/api/v1/site/plans → fetch failed)
```

It fails on `/`, not `/pricing` — via `lib/cms-page.tsx:47`, which serves **every CMS page**.

**Before my commit this could not happen.** `git show 4c4df28~1:apps/landing/lib/site-api.ts | grep -c throw`
→ **0**. No throw path existed anywhere in that file; an unreachable API returned committed
fallback and the build succeeded. So this is a regression I introduced, not a pre-existing condition.

**Four call sites, two still unguarded:**

| Site | State |
|---|---|
| `pricing/page.tsx:47` (`livePlans`) | guarded — `try/catch` |
| `lib/kb.ts:47` | guarded — `.catch(() => [])`, because `buildKb` runs from the root layout |
| **`pricing/page.tsx:100`** (page body) | **unguarded** |
| **`lib/cms-page.tsx:47`** | **unguarded** — this is the one that fails the build |

## 2. My premise for the metadata fix was wrong, and the truth is worse

I mandated the `generateMetadata` change on the reasoning that letting a strict `getPlans()` throw
would **break CI**, because CI builds this app deliberately without `SITE_API_BASE`.

**That is false, and the agent proved it by building the naive version:** with `SITE_API_BASE` unset,
`site-api.ts:77` returns `null` *before any fetch*, so `getPlans` never throws and falls through to
the committed fallback. `MUT_NAIVE_BUILD_EXIT=0` — the build stays **green** and plants
«۱۸/۳۴/۶۵ میلیون تومان» into the prerendered `<meta name="description">`.

**So the CI hazard was never a broken build. It was a green build shipping wrong prices to Google.**
A broken build announces itself. That one does not — which is the same asymmetry this entire audit
keeps finding, and I stated it backwards in my own directive.

The fix still landed correctly: the prerendered `/pricing` head now carries zero price claims when
data is unavailable, verified in `.next/server/app/pricing.html`.

## 3. The decision this needs — not a patch

The two unguarded callers cannot simply copy `kb.ts`'s `.catch(() => [])`, because for the pricing
page body an empty plan list is not a neutral degradation: **the page exists to show prices.**

Three options, and this is a product call:

1. **Render the pricing page without price cards** when plans are unavailable, with an honest
   "prices temporarily unavailable" state. Honest, never stale, and the page still ranks.
2. **Let the build fail** when a configured API is unreachable. Loud, and defensible — you should not
   ship a build made against a broken backend. But a transient blip during a deploy then blocks the
   deploy, and `cms-page.tsx` takes every CMS page down with it, not just pricing.
3. **Fall back to committed prices in the body only**, keeping the metadata honest. Rejected on its
   face — it is the defect directive 028 removed, reintroduced one layer down.

**I recommend 1.** It is the only one that is both honest and available during an outage, and it
matches what the metadata fix already does: omit the claim rather than fake it or die.

## 4. A second, pre-existing hazard the agent found and correctly did not fix

`apps/landing/lib/cms-page.tsx:47` calls `getPlans()` for any page whose content needs plans. Whatever
option is chosen above must be applied there too, or `/pricing` is fixed while `/` still fails.

## 5. Method notes, both against me

**I asserted "this will break CI" without measuring it**, and put it in an agent's mandate as a
constraint. The agent tested the claim instead of accepting it and found the opposite. That is the
behaviour I have been demanding from everyone else for three days, applied to me — and it is the
second time tonight my *framing* was wrong while my *finding* was right.

**And I did not check the other callers before committing `4c4df28`.** I fixed `getPlans`, guarded
the one caller I happened to look at (`kb.ts`, and only because the agent found the root-layout
problem), and shipped. A change to a function's failure contract obliges you to enumerate its callers.
`git grep getPlans` is four lines of output and I ran it *after* the regression, not before.
