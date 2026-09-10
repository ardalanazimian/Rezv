# Directive 029 — App topology: five apps, two deployment models, and nothing serves the apex domain

**Date:** 2026-09-07 · **From:** founder-side reviewer · **To:** founder, CEO agent
**Origin:** founder, 2026-09-07 — audit how the apps relate to each other and fix what is wrong.

---

## 1. What is coherent

`sync-design-system.sh --check` → **exit 0**. The three vanilla panels each carry their two
distributed shared files; `apps/landing` carries one; `apps/seo` is standalone by design with its own
font and CSS. The distribution mechanism works and is verified.

`apps/landing` internal links: every `href="/…"` resolves to one of its 21 routes. Zero broken links.

## 2. The gap: nothing serves `rezervno.ir`

`deploy/caddy/Caddyfile` defines exactly four site blocks plus a health listener:

```text
:122  api.{$DOMAIN}       → reverse_proxy api:3000
:149  app.{$DOMAIN}       → root /srv/customer
:165  business.{$DOMAIN}  → root /srv/business
:181  admin.{$DOMAIN}     → root /srv/company
:197  :8080               → healthz
```

**There is no `{$DOMAIN}` block.** The bare domain is not served by the self-hosted stack, and
`docker-compose.prod.yml` contains only `api` and `caddy` — `apps/landing` and `apps/seo` appear in
neither. `git grep` finds zero references to either app in the Caddyfile.

Meanwhile the apps commit **28 absolute references to `https://rezervno.ir`**, including:

- `apps/customer/index.html:47` — JSON-LD telling search engines the organisation is at
  `https://rezervno.ir/#org`, `"url": "https://rezervno.ir/"`, with `"logo":
  "https://rezervno.ir/favicon.svg"`.
- `apps/seo` — canonical URLs and a sitemap over `rezervno.ir/r/<slug>`, `/city/<city>`,
  `/cuisine/<cuisine>`. **No edge configuration serves any of those paths.**

**So at launch, on the self-hosted stack as committed:** the customer PWA tells Google the brand lives
at an address that returns nothing, its declared logo URL resolves nowhere, and the SEO app — whose
entire purpose per ADR 0001 is organic ranking — publishes a sitemap of URLs that do not exist.

## 3. Why this is not simply "a missing Caddy block"

`docs/DEPLOYMENT.md:3` states **two supported models**: Vercel (managed) and Docker Compose
(self-hosted). Both `apps/landing/vercel.json` and `apps/seo/vercel.json` exist, so the intended
topology is evidently **hybrid** — the API and the three panels on the self-hosted stack behind Caddy,
the two Next.js sites on Vercel.

That is a reasonable architecture. **But it is nowhere written down as a hostname map**, and the one
place that discusses it, `DEPLOYMENT.md:140-144`, says of the front-ends: *"each app is intended as
its own Vercel project … **(uncertain / follow-up)**: there is no root `vercel.json` wiring the
front-ends; this is a dashboard configuration step."*

**The topology exists only as an intention.** Nobody can answer "which host serves `rezervno.ir`"
from this repository, and the apps have already committed to an answer in their structured data.

## 4. Directive

**Write the hostname map down, in one place, before anything is provisioned.** Which host serves the
apex; where `apps/landing` lives; where `apps/seo` lives; and whether `/r/`, `/city/` and `/cuisine/`
are served by the SEO app at the apex or on a subdomain. That decision is the founder's — it is a
hosting and DNS choice, and §5 explains why it cannot be deferred to launch day.

**Then make the committed URLs follow the map rather than the reverse.** Today the apps assert a
topology that the infrastructure does not implement. Whichever way the decision goes, the JSON-LD in
`apps/customer/index.html:47` and the canonical/sitemap generation in `apps/seo` must agree with it.

**And a guard**, because this is precisely the class this repo keeps closing: something that asserts
a URL should verify the URL is served. A check that every committed absolute `rezervno.ir` URL maps
to a defined host in the Caddyfile or a documented Vercel project — failing when an app advertises an
address nothing serves. Falsifiable by adding a reference to a nonexistent subdomain and watching it
go red.

## 5. Why the ordering matters

Structured data and sitemaps are **not** low-stakes copy. Google treats a 404 on a canonical URL as
"this page is gone" and de-indexes it — the exact mechanism `apps/seo/lib/api.ts:10-24` documents in
its own header as the reason that app throws rather than returning `null`. **The team already knows
this failure mode and wrote a careful defence against one instance of it**, while the topology-level
version of the same problem sits unaddressed one layer up.

Publishing a sitemap before the URLs resolve is worse than publishing nothing: it teaches the crawler
that those addresses are dead, and recovering an index position is slower than earning it.

## 6. What I am not deciding

Which host serves what. That is hosting, DNS and money — the founder's, and gate A2 is red precisely
because none of it is provisioned. **I am recording that the apps have already committed to an answer
he has not made**, which is the part that will bite on launch day rather than before it.
