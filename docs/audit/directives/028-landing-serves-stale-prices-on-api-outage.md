# Directive 028 — The landing page serves committed prices when the API is unreachable, and nothing keeps them true

**Date:** 2026-09-07 · **From:** founder-side reviewer · **To:** CEO agent, founder
**Origin:** overnight sweep of `apps/landing` and `apps/seo` — the partition no earlier round covered.

---

## 1. The defect

`apps/landing/lib/site-api.ts:68`

```ts
export async function getPlans(): Promise<SitePlan[]> {
  const plans = await getList<SitePlan>('plans', {}, 120);
  return plans && plans.length ? plans : fallbackPlans(fallback);
}
```

`getJson` returns `null` on **any** failure — network, DNS, timeout, non-2xx (`:34-42`). It does not
distinguish "there are no plans" from "the API is unreachable". So an outage falls through to
`fallbackPlans`, which reads `apps/landing/content/site-content.json`:

```text
site-content.json:10   "priceToman": 18000000
site-content.json:29   "priceToman": 34000000
site-content.json:49   "priceToman": 65000000
```

**These are two independent sources with nothing between them.** The live values come from
`db.sitePlan` — `site-content.ts:355`, editable through the admin studio. The fallback values are
committed JSON, changeable only by a code commit. `git grep` finds **no sync step and no drift
guard**: nothing regenerates the JSON from the database, and nothing fails when they disagree.

**So the fallback is correct exactly until the first price change, and silently wrong forever after.**

## 2. Why it is worse than the class it belongs to

Directive 023 catalogued "we don't know" rendered as "you have none" — an outage shown as emptiness.
This is the same failure with a harder edge: **an outage rendered as a confident, specific, wrong
number.** An empty section invites a reload. A price does not; a prospect reads it and believes it.

And it is cached. **CORRECTION (2026-09-07):** I wrote that every landing page carries
`revalidate = 300`. Wrong — `app/pricing/page.tsx:19` is **120** and `app/changelog/page.tsx:13` is
600. So the wrong price is served for up to **two** minutes on the page that matters, not five. The
conclusion is unchanged; the number I gave was not measured, it was assumed from the pages I had
already opened.

**AND A WORSE ADJACENT DEFECT, found while fixing this one and NOT fixed:**
`app/pricing/page.tsx:24` hardcodes the prices inside a static `export const metadata`:

> «پلن‌های اشتراکِ رزرونو: سه‌ماهه ۱۸ میلیون، شش‌ماهه ۳۴ میلیون و یک‌ساله ۶۵ میلیون تومان…»

That string never reads `db.sitePlan` at all. It is therefore wrong from the first price change
onward **even when the API is perfectly healthy** — no outage required — and it is the description
Google shows in search results. The fallback defect needs an outage to bite; this one bites by
default. Fixing it means converting `metadata` to `generateMetadata`, which changes the page's
rendering contract, so it was correctly left out of a one-defect change. **Roughly ten lines, no
schema, no API change.** The pattern is
exactly the one `apps/seo/lib/api.ts:10-24` documents for its own pages — a transient outage becoming
a cached lie — except there the consequence was a 404 served to Googlebot, and here it is a price
served to a buyer.

**Money-adjacent, per `CLAUDE.md`'s own framing of currency handling.** A visitor who sees
18,000,000 for a plan that now costs more has been quoted a price the business does not offer.

## 3. The repository already contains the correct pattern

`apps/seo/lib/api.ts` solves this exact problem and documents why, citing the vendor's own manual
rather than reasoning:

- genuine upstream 404 → `null` → `notFound()`
- **any infrastructure failure → `throw UpstreamUnavailableError`**

with three behaviours verified against the Next.js v16.2.9 ISR documentation: a throw during
revalidation keeps serving the last good page; a `notFound()` result **is cached**; and the vendor
explicitly recommends throwing so the cache is not updated until a successful request.

Both apps are Next.js with ISR at `revalidate = 300`. **One distinguishes absence from outage and one
does not.** The correct implementation is already in this repository, written by this team, with its
reasoning attached.

## 4. Directive

Adopt the `apps/seo` split in `apps/landing/lib/site-api.ts`: `getJson` must separate a genuine
upstream 404 from an infrastructure failure, and the latter must throw so ISR keeps serving the last
good page instead of falling through to committed defaults.

**Do not simply delete the fallbacks.** For prose — pages, FAQs, articles — serving built-in copy
during an outage is defensible and is probably why this was written. The distinction that matters is
**whether a stale value can mislead about a commitment**: prices, plan contents and anything a visitor
could act on financially must not have a silent fallback. `getPage`/`getFaqs` may keep theirs;
`getPlans` must not.

**Falsifiability.** With the API stubbed to fail, `getPlans` must throw rather than return
`fallbackPlans` — red before the fix, green after. And a second case proving a genuine empty
collection still renders empty rather than throwing, so the test distinguishes "outage handled" from
"everything throws now".

**If the fallback is kept anywhere that shows money**, then it needs the drift guard that does not
exist today: a check that `site-content.json`'s plan prices match the database's, failing when they
diverge. That is the honest alternative — but it needs a database at CI time, which is why throwing
is the cheaper correct answer.

## 5. What I checked and found clean

`apps/seo` — clean, and the reference implementation described in §3.
`apps/landing` internal links — every `href="/…"` in components and pages resolves to a real route;
zero broken links across 21 routes.
`apps/landing` icon — fixed tonight in `c85badb`, recorded in directive 025.

## 6. Method note

This partition had never been read once; both finders assigned to it in the 2026-09-06 sweep died to
the session limit. Two defects came out of it — the un-installable PWA and this one — and **neither
produces an error signal anywhere.** A missing icon file and a stale price are both things that look
exactly like working software. That is now the third time this round that the finding was *an absence
of a signal* rather than a wrong one.
