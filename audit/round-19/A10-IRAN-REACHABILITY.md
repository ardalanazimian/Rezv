# A10 — Iran Reachability Test Design for Vercel-Hosted Frontends

**Agent:** A10 (LAUNCH-OPS) · **Model:** claude-sonnet-5 · **Round:** 19 · **Mode:** PLAN + VERIFY, read-only on repo, read-only web research (WebSearch/WebFetch + public diagnostic APIs — no repo edits, no MCP write tools, no resource created). Written per founder order 2.ii, following the founder's decision that baseline (b) — three frontends on Vercel, API self-hosted — is conditional on this test.

All web citations below carry the URL fetched. All "live probe" results below were executed by this agent today (2026-09-03) against public, unauthenticated diagnostic APIs (`check-host.net`, `api.globalping.io`) — a genuinely different evidence class from repo `path:Lnn` citations, so each is marked **[LIVE PROBE, 2026-09-03]**.

---

## 0. A conflict this test surfaces before it even runs

The founder's baseline (b) — customer/business/company on Vercel — **changes a decision already recorded and already built in the repo**:

- **`docs/adr/0002-public-website-and-cms.md:33`**: "هر کدام یک پروژه‌ی Vercelِ مستقل‌اند (`Root Directory` = `apps/landing` و `apps/seo`)" — ADR 0002 puts only `apps/landing` and `apps/seo` on Vercel. Customer/business/company are not mentioned as Vercel projects anywhere in this ADR.
- **`deploy/caddy/Caddyfile:8-13`** (comment, "چیدمانِ دامنه (ADR 0002)"): explicitly lays out `{$DOMAIN}` → Vercel (public website only), `api.{$DOMAIN}` → backend, `app.{$DOMAIN}` / `business.{$DOMAIN}` / `admin.{$DOMAIN}` → the three panels — served by Caddy itself.
- **`deploy/caddy/Caddyfile:117-153`**: three live `handle` blocks (`app.{$DOMAIN}`, `business.{$DOMAIN}`, `admin.{$DOMAIN}`) each doing `root * /srv/customer|business|company; try_files {path} /index.html; file_server`, each importing `api_upstream` so `/api/*` is same-origin reverse-proxied — no CORS, no `RZ_API_BASE` override needed.
- **`docker-compose.prod.yml:38-46`**: already mounts `./apps/customer:/srv/customer:ro`, `./apps/business:/srv/business:ro`, `./apps/company:/srv/company:ro` into the `caddy` service.

**This means the FAIL/FLAKY fallback in §4 below is not a new design — it is what the repo already implements today, untested, because no production host exists yet (blocker B4/B6 → CEO P0-017, `audit/round-15/ground-truth.json:225-233`).** PASS on this test is what would require a *deliberate departure* from ADR 0002 for these three apps, not the other way around. This doesn't block running the test — it just means the founder should read this test's result against "are we changing an accepted decision" rather than "are we filling a gap."

---

## 1. Test object — two variants, what differs

**Minimal probe page (recommended, both variants):** don't test the full `apps/customer/index.html` (it pulls the Vazirmatn font, `shared/css/`, and the full ES-module boot chain — confounds network-reachability with asset-weight/parse-time). Deploy a dedicated 1-line probe page instead:

```html
<!doctype html><html><head><meta charset="utf-8"><title>rz-probe</title></head><body>rz-ok-v1</body></html>
```
at `apps/customer/probe.html` (or any app — content is what's asserted, not the app). ~120 bytes. A test script asserts the literal string `rz-ok-v1` appears in the body — this catches not just "connection succeeded" but "a captive-portal / DPI splice page was NOT substituted" (Iran's filtering infrastructure is known to inject block pages rather than just RST/timeout in some configurations), which a bare HTTP-200 check would miss.

**Variant A — Vercel preview/production alias, `*.vercel.app`:**
- URL shape: `https://<project>-<hash>-<team>.vercel.app` (preview) or `https://<project>.vercel.app` (production alias).
- Served over Vercel's shared anycast edge — the same IP ranges as millions of other Vercel-hosted sites, resolved via Vercel's own nameservers (not the founder's DNS).
- **Why this matters for Iran specifically:** a `*.vercel.app` hostname is far less likely to be individually DNS-poisoned than a bespoke domain (Iran's DNS-layer filtering targets specific domains/keywords, not shared platform suffixes used by unrelated third parties) — but it IS subject to any IP-range-level block of Vercel's edge itself.

**Variant B — custom domain (e.g. `app.rezervno.ir`) pointed at the same Vercel project:**
- Adds a DNS-resolution hop the founder controls (A/CNAME record) — this is a **separate potential failure point**: Iran's filtering does DNS-based blocking (poisoned/NXDOMAIN responses for specific domains) independently of IP-based blocking. A domain that has never been individually targeted is unlikely to be poisoned on day one, but this is exactly why both variants must be tested, not assumed equivalent.
- Same underlying Vercel edge IPs as Variant A once resolved, so if Variant A fails, Variant B will very likely fail the same way (IP-range block); if Variant A passes but Variant B fails, that specifically points at DNS-layer filtering of the custom domain, not Vercel's infrastructure.

**Requirement:** run every probe in §2 against BOTH variants once the founder has deployed the probe page and (if applicable) attached a custom domain. Section 3's live pilot data below was run against `vercel.com` (a real, permanently-live Vercel-hosted apex domain) as a stand-in for Variant A, since no rezervno Vercel project exists yet (team has 0 projects — confirmed live, see A10-PLAN.json `vercel.mcp_reads`) — **this pilot must be re-run against the actual probe page once deployed; a marketing site being reachable does not guarantee a specific customer's project shares every edge PoP.**

---

## 2. Probes — concrete, free, non-VPN-dependent

### 2.1 check-host.net — public HTTP/ping probe network with real Iran nodes

**Verified live** [LIVE PROBE, 2026-09-03] by fetching `https://check-host.net/nodes/hosts` (unauthenticated JSON API, documented at `https://check-host.net/about/api`). Current Iran nodes online:

| Node | City | ASN |
|---|---|---|
| `ir1.node.check-host.net` | Tehran | AS47430 |
| `ir2.node.check-host.net` | Isfahan | AS209279 |
| `ir3.node.check-host.net` | Shiraz | AS213953 |
| `ir4.node.check-host.net` | Shiraz | AS212077 |
| `ir5.node.check-host.net` | Tehran | AS214431 |
| `ir7.node.check-host.net` | Tehran | AS213727 |
| `ir8.node.check-host.net` | Tehran | AS214361 |

**Caveat (must carry into the test's interpretation):** these are Iranian datacenter/hosting-provider networks (the ASNs above are hosting/colo companies, not Irancell/MCI/TCI/Shatel/Rightel consumer networks). They correctly test "does traffic that has already entered Iran's networks, exiting toward `vercel.app`, get blocked at the national gateway" — the same choke point that would affect a consumer — but they do **not** exercise a specific mobile carrier's NAT/DPI box the way a real Irancell SIM does. This is exactly why §2.3 (founder's own devices) is not optional.

**Exact commands** (2-step async API — initiate, then poll result):
```bash
# Step 1 — initiate (repeat host=... per node; max_nodes caps how many respond)
curl -s -H "Accept: application/json" \
  "https://check-host.net/check-http?host=<PROJECT>.vercel.app&max_nodes=10&node=ir1.node.check-host.net&node=ir2.node.check-host.net&node=ir3.node.check-host.net&node=ir4.node.check-host.net&node=ir5.node.check-host.net&node=ir7.node.check-host.net&node=ir8.node.check-host.net"
# → returns {"request_id": "...", "permanent_link": "https://check-host.net/check-report/..."}

# Step 2 — poll result (wait ~5-10s for nodes to respond)
curl -s -H "Accept: application/json" "https://check-host.net/check-result/<request_id>"
```
**Expected output shape (per node):** `[<1|0>, <seconds>, "<status text>", "<http code or null>", "<resolved IP or null>"]` — first element `1` = success, `0` = failure. A ping variant exists at `check-ping` for raw TCP/ICMP-style timing.

### 2.2 globalping.io — community probe network, verified Iran coverage

**Verified live** [LIVE PROBE, 2026-09-03] by fetching `https://api.globalping.io/v1/probes` (public, unauthenticated). Currently online Iran probes:

| City | ASN | Network |
|---|---|---|
| Tehran | AS202468 | AbrArvan CDN and IaaS |
| Tehran | AS202468 | AbrArvan CDN and IaaS (2nd probe) |
| Tehran | AS59580 | Batterflyai Media |
| Tehran | AS59441 | Hostiran Network |
| Tehran | AS42043 | Parsian High Tech Company |

Same caveat as 2.1: all hosting/datacenter networks, all Tehran (no geographic diversity today — this is the live count at test-design time and can change since it's a volunteer network; re-check before relying on it). Coverage confirmed via `https://github.com/jsdelivr/globalping-cli` (fetched) for CLI syntax:

```bash
# Requires: npm i -g globalping, or use the web UI at globalping.io/docs
globalping http <PROJECT>.vercel.app from Iran --limit 5
globalping ping <PROJECT>.vercel.app from Iran --limit 5 --latency
```
`--limit N` selects up to N of the currently-online Iran probes; `from Iran` is a location filter (city/network names also work, e.g. `from Tehran`, `from "AbrArvan CDN and IaaS"` for probe-level pinning if the fleet composition changes).

### 2.3 OONI Probe — official censorship-classification tool (complementary, not a substitute)

`explorer.ooni.org/country/IR` (fetch blocked this agent with HTTP 403 — likely bot-protection, not evidence of anything about Iran; confirmed reachable in principle via search-result summaries citing "OONI Probe users in Iran have collected 42,224,483 measurements from 314 local networks" testing WhatsApp/Facebook Messenger/Telegram/Signal/Tor/Psiphon blocking). Value for this test: OONI Probe (free Android/iOS/Desktop app, `ooni.org/install`) run on the founder's own phone doesn't just report connect/timeout — it applies OONI's own confirmed/possible/anomaly classification, which is useful corroboration if a probe result is ambiguous. Treat as a supplementary signal, not a primary pass/fail input, since it can't be scripted into the N=20-per-cell protocol below as cleanly as curl/check-host/globalping.

### 2.4 Founder's own devices — ≥2 Iranian ISPs, mandatory (not optional)

Required because 2.1/2.2 only test datacenter-network paths. At minimum:
- One **mobile** connection (Irancell or Hamrah-e-Aval/MCI SIM, cellular data, not Wi-Fi)
- One **fixed** connection (Shatel, TCI/Mokhaberat DSL/FTTH, or another home ISP)
- Rightel as a third if available (smaller footprint but a real ISP, worth including for coverage breadth).

Exact command (works identically on macOS/Linux/Termux-on-Android; on iOS use the "Network Link Conditioner"-adjacent approach or a terminal app):
```bash
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code} connect=%{time_connect}s tls=%{time_appconnect}s ttfb=%{time_starttransfer}s total=%{time_total}s\n" \
    "https://<PROJECT>.vercel.app/probe.html"
  sleep 2
done
```
Record: HTTP status per attempt, `time_appconnect` (TLS handshake complete) and `time_starttransfer` (first byte / TTFB) per attempt, device + ISP + city + timestamp. A phone screen-recording or terminal transcript is the evidence artifact — paste raw output into the launch log, not a summary.

---

## 3. Falsifiability — numeric PASS/FAIL/FLAKY, plus live-executed controls

### 3.1 Definitions

For **each (ISP × time-of-day window) cell** — 2 ISPs minimum × 3 windows (09:00, 15:00, 22:00 Tehran local time) × 3 days = **18 cells minimum**, N=20 attempts per cell (§2.4 script) — plus the automated probes (§2.1/2.2) run hourly for the same 3 days as a higher-frequency cross-check:

| Verdict | Condition (per cell) |
|---|---|
| **PASS** | ≥95% of N=20 return HTTP 200 (or the expected 2xx/3xx redirect chain terminating in 200) AND contain the literal `rz-ok-v1` string AND TLS handshake (`time_appconnect`) < 1000ms AND TTFB (`time_starttransfer`) < 1500ms for ≥90% of successful attempts, in **every one of the 18 cells** (not just on average — one consistently-bad cell fails the whole test; see falsifiability note below) |
| **FLAKY** | 80–95% success in one or more cells, OR ≥95% success but latency thresholds breached in >10% of successful attempts, OR a clear day-part pattern (e.g. always fails 22:00–02:00, a known DPI-load-shedding pattern reported elsewhere in the region) |
| **FAIL** | <80% success in any single cell, OR any full day where 2+ of the automated probes (§2.1/§2.2) AND both manual ISPs simultaneously show <50% success (systemic block), OR the automated probes stay green while a real device fails on 3+ consecutive attempts across 2+ sessions (this specific pattern is called out separately because it's exactly the datacenter-vs-consumer-path gap §2.1/§2.2 cannot see — it must force FAIL even if the aggregate numbers look fine) |

Latency thresholds are derived from §3.2's live pilot (Iran-datacenter-to-Vercel-edge measured at 190–270ms total) with roughly 4–5x margin for real mobile/last-mile conditions rather than picked arbitrarily; if pilot data from the founder's actual devices comes in tighter or looser, adjust before the 3-day run starts and record why.

### 3.2 Live pilot — proving the test methodology can go red (negative control) and green (positive controls)

Executed **today, 2026-09-03**, via check-host.net against all 7 Iran nodes listed in §2.1, `check-http`, single pass (this is a pilot demonstrating falsifiability, NOT a substitute for the full 18-cell/3-day protocol above):

| Target | Role | Result (7/7 nodes) | Sample timing | Evidence |
|---|---|---|---|---|
| `facebook.com` | **Negative control** — officially blocked in Iran since June 2009 (post-election censorship; corroborated by OONI's own Iran testing catalogue, §2.3) | **7/7 FAILED** — `ir1`/`ir4`: "Connection refused"; `ir2`/`ir3`/`ir5`/`ir7`/`ir8`: "Connection timed out" (2.9–15.6s before timing out) | n/a (no response) | [LIVE PROBE] `https://check-host.net/check-report/49dddd12kf31` |
| `digikala.com` | **Positive control (domestic)** — Iran's largest e-commerce site, must be reachable for the test rig itself to be trustworthy | **7/7 SUCCESS** — HTTP 301 | 0.039–0.128s | [LIVE PROBE] `https://check-host.net/check-report/49dddd25k607` |
| `wikipedia.org` | **Positive control (foreign, non-Vercel)** — isolates "foreign HTTPS sites work at all" from "Vercel specifically works" | **7/7 SUCCESS** — HTTP 301 | 0.163–0.468s | [LIVE PROBE] `https://check-host.net/check-report/49ddf017k319` |
| `vercel.com` | **Vercel-edge proxy** (real project's `*.vercel.app`/custom domain don't exist yet — this is Vercel's own apex, same shared edge infrastructure) | **7/7 SUCCESS** — HTTP 308, resolved to `64.239.x.x` (Vercel edge range) | 0.187–0.266s | [LIVE PROBE] `https://check-host.net/check-report/49dddcfdkf9a` |

**Falsifiability demonstrated:** the exact same tool, same 7 nodes, same minute, returns a clean 7/7 FAIL for a genuinely-blocked site and a clean 7/7 PASS for three different reachable sites (one domestic, one foreign-non-Vercel, one Vercel-owned). If this rig cannot distinguish those, it isn't a test; it does. This satisfies the falsifiability requirement independent of the fuller 3-day protocol, which still must be run against the founder's own devices (§2.4) before trusting a PASS in production, per §3.1's forced-FAIL rule.

**Important context this pilot does NOT settle:** Vercel itself has an official, sanctions-related access history for Iran — a Vercel engineer stated in 2021 (`https://github.com/vercel/vercel/discussions/5891`, fetched): *"we cannot guarantee the deliverability for countries under US sanctions and embargoes. Normally our upstream provider (AWS) will block those countries."* Independent user reports of Vercel-hosted domains being unreachable from Iran continued in **May 2025** (`https://community.vercel.com/t/domain-cant-reach-from-iran-ip/12230`) and as recently as **May 9, 2026** (`https://community.vercel.com/t/request-for-temporary-access-exception-for-users-in-iran/41504`, which instead attributes it to Iranian government-side NAT of outbound traffic, not an AWS-side block) — four months before this pilot. Today's clean 7/7 result does not mean the historical reports were wrong; it means whatever was blocking traffic then is not blocking `vercel.com` from these 7 nodes right now. **Enforcement (on either side — US sanctions lists or Iranian filtering) can change without notice and has a documented history of intermittent, disputed causes** (the GitHub thread itself shows AWS's explanation being challenged by users who noted Netlify/Heroku, also AWS-hosted, remained accessible) — this is precisely why the full 3-day/18-cell protocol (not a single snapshot) is the actual test, and why the decision rule in §4 treats even a today-PASS as provisional on the real 3-day run.

**Additional context — Iran's baseline connectivity has been unstable in 2026 independent of Vercel:** per Wikipedia's "2026 Internet blackout in Iran" (fetched), a nationwide blackout began January 8, 2026 amid protests, partially eased January 28, saw a renewed near-total blackout February 28 (connectivity to ~4% of normal) during Israeli-U.S. strikes, and was only partially restored May 25–26, 2026, with the government itself describing the restored state as "already heavily restricted." Today's clean positive-control results (digikala.com, wikipedia.org) suggest conditions have stabilized further since May, but this is exactly why §3.1 requires a positive control in every single test session, not just once — if `digikala.com` or the founder's own known-working baseline site fails during the 3-day run, that session's data is void (Iran-side outage), not a Vercel FAIL.

---

## 4. Decision rule

**PASS → baseline (b) stands.** Customer/business/company deploy as Vercel projects as planned in `A10-PLAN.json.vercel.projects_to_create`. This is a deliberate departure from ADR 0002 (§0 above) — record that decision explicitly (a one-line ADR amendment or a dated note in `docs/adr/0002-public-website-and-cms.md`) so a future reader doesn't find the Caddyfile's "app./business./admin. are self-hosted" comment and the live Vercel projects disagreeing with no explanation.

**FAIL or FLAKY → fallback: all three frontends served by production Caddy; Vercel for previews only.**

What changes, concretely (all already exists in-repo, per §0 — this is an activation checklist, not new engineering):

- **Caddy static roots:** already defined — `deploy/caddy/Caddyfile:117-153` (`app.`/`business.`/`admin.` blocks, `file_server` off `/srv/customer|business|company`), volumes already wired in `docker-compose.prod.yml:38-46`. Nothing to write; needs a real host (see founder_action iii) and `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
- **Cache headers:** **gap found, not yet in the Caddyfile** — the three `handle` blocks (`Caddyfile:130-152`) have no explicit `Cache-Control` directives; Caddy's `file_server` default caching is not tuned for this app's needs. Before relying on the fallback, add: `Cache-Control: no-cache` (or short max-age) for `index.html` and `sw.js` specifically (matched by path), and long `max-age` + `immutable` for hashed/versioned static assets — otherwise a stale-cache bug class is possible that Vercel's CDN would have handled automatically via its own cache invalidation on each deploy.
- **`CACHE_VERSION` discipline (CLAUDE.md):** unchanged requirement either way — `apps/customer/sw.js` line 14's `CACHE_VERSION` must still be bumped on every `js/`/`css/` change — but it becomes the *only* safety net under self-host (no Vercel atomic-deploy/CDN purge behind it), so treat a missed bump as higher-severity under the fallback than it would be on Vercel.
- **CORS / `RZ_API_BASE`:** the fallback *removes* this problem rather than needing new work — `Caddyfile`'s `api_upstream` snippet (imported by all three panel blocks) reverse-proxies `/api/*` to the `api` container on the same host/origin as the static files, so `resolveApiBase()` (per `docs/DEPLOY_API_VERCEL.md:41-43`) stays at its default `''` (same-origin) with zero code change and zero `ALLOWED_ORIGINS`/CORS header needed beyond what's already required for the API's own cookie/CSRF handling. This is the opposite of blocker B6 in the original plan (frontend-to-API wiring for Vercel-hosted frontends, which does not exist yet and must be built) — under the fallback, that wiring already exists and needs no CORS at all.

---

## 5. Founder conditions (i) and (iii) — recorded as `founder_actions` in `A10-PLAN.json`

Per the coordinator's instruction, both are written into `A10-PLAN.json.founder_actions` (see that file) rather than only here. Summary:

- **(i)** Confirm the 2026-08-28 `api/vercel.json` deletion (commit `3422936`) was an intentional architecture decision (API stays self-hosted), not an accidental loss of Vercel Cron config — this was already `A10-PLAN.json` blocker B2's open question; the founder's baseline message resolves the API side of it (self-hosted, confirmed) but the written confirmation of *intent* behind that specific commit is still requested explicitly, separate from re-deciding it.
- **(iii)** Name the production host target (provider + region) for the self-hosted piece (API always; frontends too, if this test's outcome is FAIL/FLAKY). This is not a new ask — it is recorded by the CEO as **blocker P0-017** (`audit/round-15/ground-truth.json:225-233`, status "open — founder input (iii)", directly citing this agent's B4/B6): *"No production infrastructure exists: Vercel 0 projects, Sentry 0 projects, no reachable production DB from this machine, frontend-to-API wiring absent (A10 B4/B6). Provisioning the production host (provider/region) is itself a launch blocker — founder names the target."* This agent's own MCP reads corroborate the Vercel/Sentry half live (both 0 projects, this session).

---

## 6. What still can't be verified from this machine

- Whether US export-control/OFAC-style blocking of Vercel's edge (as officially described by Vercel staff in 2021, still reported by users through 2026) is currently active for the specific IP ranges the rezervno project would get — today's pilot (§3.2) shows `vercel.com` clean, but a brand-new project's edge assignment and any account/plan-level geo-restriction cannot be confirmed without actually creating the project (out of scope — no MCP write tools used).
- Real-device (§2.4) latency/success numbers — nothing in this document substitutes for the founder actually running the 3-day protocol from real Iranian SIM/ISP connections.
- Whether globalping's Iran probe fleet (5 volunteer nodes, all Tehran, as of today) will still be online during the founder's 3-day window — it is a volunteer network with no uptime guarantee; check-host.net's 7 nodes (a commercial service) are the more durable primary source.
