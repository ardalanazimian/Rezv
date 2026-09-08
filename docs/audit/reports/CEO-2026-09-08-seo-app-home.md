# Where `apps/seo` lives now that the apex belongs to landing

**Date:** 2026-09-08 · **Session:** CEO `rezv-f8 [4e0f27]`
**What this is:** the CEO's ruling on the two things D-004 left broken, with the evidence behind it.
**What it needs from its reader:** nothing to decide — the founder delegated this ("براشون راه حل پیدا کن"). It needs *checking*.

---

## 1. The problem D-004 created

`rezervno.ir` now belongs to `apps/landing`. That leaves `apps/seo` — which owns `/r/[slug]`,
`/r/[slug]/menu`, `/city/[city]` and `/cuisine/[cuisine]`, i.e. **every restaurant page** — with no
domain, while still hardcoding `https://rezervno.ir` in **13 places across 10 files**.

Those hardcodes are not merely stale. `apps/seo/app/robots.ts:3` sets `host: SITE` and
`sitemap: ${SITE}/sitemap.xml`, so wherever that app deploys it announces itself as the apex.

## 2. The ruling: subfolder under the apex, via Next Multi-Zones — not a subdomain

**Rewrite `/r/:path*`, `/city/:path*` and `/cuisine/:path*` from `apps/landing` to the `apps/seo`
deployment.** Restaurant pages then genuinely live at `rezervno.ir/r/<slug>`.

**Why not a subdomain.** A subdomain (`find.rezervno.ir`) is easier — a separate Vercel project with
its own domain and sitemap, no proxy. It is also the wrong answer here. Search engines pool authority
per host; restaurant pages are the growth engine of a marketplace, and putting them on a second host
means the apex earns nothing from them and they start from zero. Subfolder consolidates. That
asymmetry is the whole reason `apps/seo` exists (`docs/adr/0001-seo-rendering-architecture.md`).

**Why this is cheap here, verified rather than assumed:**

```text
apps/landing/next.config.js   no rewrites today — clean slate
apps/landing/app/[slug]       one segment (CMS pages)
apps/seo routes               /r/[slug] · /r/[slug]/menu · /city/[city] · /cuisine/[cuisine]  — all ≥2 segments
```
**No route collides.** Landing's catch-all takes a single segment; every seo route is deeper. The
only overlap is seo's own `/`, which simply is not rewritten.

**And it repairs the hardcodes for free.** Under this topology the 13 `rezervno.ir` references become
*correct* — those pages really are served from the apex. A subdomain would require changing all 13
and would still split authority. This is the rare case where the cheaper fix is also the better one.

## 3. What must ship with it, or the rewrite creates a new defect

1. **The `apps/seo` origin must be `noindex`.** Its own deployment URL will still serve the same
   pages. Two hosts serving identical content is duplicate content, and the wrong one may win.
2. **The sitemap has to be reachable from the apex.** Rewrite a path such as
   `/sitemap-restaurants.xml` to the seo app's `sitemap.xml`, and reference it from landing's
   `robots.ts`. Otherwise the restaurant URLs are crawlable but never announced.
3. **`apps/seo/app/robots.ts` must stop claiming `host`.** Under a rewrite the apex host is
   landing's to declare. Two apps declaring `host:` for one domain is the same class of defect this
   report exists to close.
4. **Derive, do not hardcode.** `SITE` in `apps/seo` should come from the environment with the apex
   as its default, exactly as `apps/landing/lib/i18n.ts:9` already does. Today a preview deployment
   of `apps/seo` publishes a `robots.txt` claiming the production domain.

## 4. `apps/customer/robots.txt` — fixed in this commit

It is served from `app.rezervno.ir` and declared `Sitemap: https://rezervno.ir/sitemap.xml` — a
sitemap on a **different host**, which crawlers ignore unless that domain is verified in the same
Search Console property. Best case inert, worst case misleading. Removed; announcing the apex sitemap
is landing's job now.

**Deliberately not decided here:** the app is a JavaScript shell (9 script tags, no server-rendered
content) and has nothing to index. `noindex` would be more honest, but it also forecloses SSR later.
Crawling stays allowed — a page with nothing to index is a neutral loss, not a false claim. That one
is the founder's, and it is written into the file so the next reader does not think it was missed.

## 5. What I have NOT verified

- **Which Vercel project is bound to `rezervno.ir`.** Dashboard-only; this session has no Vercel MCP.
  UNKNOWN, not assumed.
- **That the rewrite works end to end.** It is unimplemented — `apps/landing/next.config.js` is being
  edited by another agent right now and I will not race it. Implementation and its proof follow.
- **Any live crawler behaviour.** No request has been made to the real domain from here.
