# Two apps claim the apex — and both publish a robots.txt for it

**Date:** 2026-09-08 · **Session:** `rezv-b0 [d8087d]` (CEO)
**What this is:** a correction to how the apex-domain risk has been described, plus a sharper defect found while checking it.
**What it needs from its reader:** one founder decision (which app owns `rezervno.ir`), and one fix that is mine to make once that is decided.

---

## 1. The existing framing is wrong on one half, and I am correcting it upward

`docs/audit/reports/NIGHT-REPORT-2026-09-07.md` §6.1 states that Caddy serves only
`api.` / `app.` / `business.` / `admin.`, that there is **no block for `rezervno.ir`**, and that
`landing` and `seo` are **«در هیچ فایلِ استقراری نیستند»** — in no deployment file.

The first half is true. **The second half is not.**

```text
deploy/caddy/Caddyfile:6   {$DOMAIN} → وب‌سایتِ عمومی، روی Vercel. Caddy عمداً دستش نمی‌زند.
docs/adr/0002-public-website-and-cms.md   status: پذیرفته‌شده (accepted)
apps/landing/vercel.json   exists — {"framework":"nextjs","regions":["fra1"]}
apps/seo/vercel.json       exists — {"framework":"nextjs","regions":["fra1"]}
```

The apex is not unowned; it is **deliberately delegated to Vercel by an accepted ADR**, and both
apps carry Vercel deployment config. "No owner" describes a gap that the architecture already
closed on paper.

That matters because the two framings lead to different work. "Nobody owns the apex" invites
someone to add a Caddy block for it — which would contradict ADR 0002 and take the apex away from
Vercel. The real question is narrower.

---

## 2. The actual defect: two apps, one apex, two robots.txt

Both Next apps own a root route and both publish sitemap and robots for the **same** production host.

```text
apps/landing/app/page.tsx        exists   → owns /
apps/seo/app/page.tsx            exists   → also owns /

apps/landing/app/robots.ts:18    sitemap: `${SITE}/sitemap.xml`
apps/landing/app/robots.ts:19    host: SITE

apps/seo/app/robots.ts:3         const SITE = 'https://rezervno.ir'      ← hardcoded
apps/seo/app/robots.ts:9         sitemap: `${SITE}/sitemap.xml`
apps/seo/app/robots.ts:10        host: SITE
apps/seo/app/sitemap.ts:4        https://rezervno.ir                     ← hardcoded
```

Route families are disjoint, which is why this has stayed invisible:

```text
apps/landing   /  /about  /blog  /blog/[slug]  /features  /faq  /demo  /contact  /pricing …
apps/seo       /  /r/[slug]  /city/[city]  /cuisine/[cuisine]
```

**Only one Vercel project can be bound to `rezervno.ir`.** Whichever is not bound still serves a
`robots.txt` that declares `host: https://rezervno.ir` and points at
`https://rezervno.ir/sitemap.xml` — from a domain it does not own. And whichever *is* bound hides
the other's routes entirely.

So exactly one of these is true today, and both are bad:

| If bound | Consequence |
|---|---|
| `landing` owns the apex | `/r/[slug]`, `/city/`, `/cuisine/` return 404. Every restaurant page is gone — the entire reason the SEO layer exists. |
| `seo` owns the apex | The marketing site, pricing and demo funnel are gone. |
| neither is bound yet | Nothing is live, and the risk is still latent rather than resolved. |

I could not determine which is actually bound: domain binding lives in the Vercel dashboard, not in
`vercel.json`, and this session has **no Vercel MCP** (verified — see
`docs/audit/tooling-inventory.json`). **Status: UNKNOWN — not verified.** I am not guessing it.

---

## 3. The second-order hazard, which is worse than the first

`apps/seo` hardcodes `https://rezervno.ir` rather than reading it from the environment. A hardcoded
canonical host does not stay on production: **every preview deployment of that app publishes a
`robots.txt` and `sitemap.xml` claiming the production domain.**

`apps/landing` uses a `SITE` variable instead, so the two apps do not even agree on the mechanism.

Google treats a 404 on a canonical URL as "this page is gone." Publishing a sitemap before the
addresses answer is worse than publishing none — that part of the night report is exactly right, and
this makes it concrete rather than hypothetical.

---

## 4. What I am not doing, and why

I am not choosing which app owns the apex. That is a product decision with a real cost either way,
it is not reversible within a day once search engines have crawled it, and §7 of my mandate wants
`/`, `/r/[slug]` and `/c/[city]/[cuisine]` on **one** host — which neither app provides today and
which no rewrite layer in this repository supplies.

**The decision the founder owns:** one host serving both route families (a rewrite/proxy layer, or
merging the apps), or two hosts with the SEO app on a subdomain and its canonical host corrected.

**The fix that is mine once that is decided:** make the canonical host environment-driven in both
apps, and add a guard that fails the build when a production build resolves an empty or non-matching
`SITE`. That guard is worth building regardless of which way the decision goes.

---

## 5. What I verified, and what I did not

**Verified by reading source:** every `file:line` above; both `vercel.json` files; both `page.tsx`
roots; ADR 0002's status line; the Caddyfile comment block.

**NOT verified:** which Vercel project is bound to `rezervno.ir` · whether either app is deployed at
all · whether DNS points anywhere · whether `apps/landing`'s `SITE` resolves correctly in production.
All UNKNOWN, all blocked on Vercel access this session does not have.

**Not run:** no build, no test — this report changes no code.
