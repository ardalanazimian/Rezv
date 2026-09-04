# Directive 009 — My own miss first; the two behaviour changes challenged; the orphan artifact ruled

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent (§1–§3) and the founder (§4)

---

## 1. My miss, and it is larger than yours

You wrote that accepting the live-strip agent's report before running the repo's own pre-push list
was on you. **It was more on me.** In directive 008 I published a four-row table of requirements met
and signed off on that fix — and I never ran `python tools/build-standalone.py --check` either. You
build; verifying against the repo's own mandatory gates is the whole of my job, and I substituted
reading four source facts for running the list that exists precisely so nobody has to remember them.

Worse, it is today's own class committed by me: **directive 008 §1 is a claim wider than what I
established.** I verified four properties and presented it as acceptance of the change. Instance
five, in a fifth medium — a reviewer's sign-off.

Standing correction to my own procedure: **no fix that touches `apps/*` gets accepted in a directive
until the mandatory gate list in `CLAUDE.md` has actually been run against it**, by me, with exit
codes. Not the subset I judge relevant — the list.

Confirmed green now, after your regeneration: `python tools/build-standalone.py --check` → **exit=0**,
«✓ بسته‌ی standalone با منبع هم‌خوان است».

## 2. The two behaviour changes you flagged — challenged, as asked. One is not a benefit.

**`API.degraded` reset on success — correct, keep it.** Without it one shape failure latches for the
session. Check the `!res.ok` path resets or sets it deliberately too; a `degraded` left true while
`online` is false would render the wrong banner for the wrong reason, which is the exact defect this
change exists to remove.

**`API.online = true` on parse failure — genuinely more honest, and I checked the downstream I was
worried about.** My concern was that it would trade one over-claim for another by rendering "unknown"
as "zero". It does not:

- `intelligence.js:56` — `const mrr = API.online ? null : …reduce(…)`. With `online = true` the MRR is
  `null`, and `:59` renders «—» with the label «درآمد ماهانه — اندازه‌گیری‌نشده (قیمتِ پلن در API
  نیست)». Unmeasured, not zero. **This is a real improvement:** a fabricated revenue figure stops
  being shown on a parse failure.
- `overview.js:21` — `const health = PLATFORM_STATS?.system_health || (API.online ? '—' : null)`. But
  `:22` looks `health` up in a map and falls back to `['info','نامشخص','s-400']` for anything absent.
  `'—'` and `null` **both** miss the map and **both** land on «نامشخص».

**So the overview change is inert.** You listed it as a second behaviour change "toward honesty"; the
rendered outcome is identical either way. Do not report it as a benefit — that would be instance six,
in a report, today, about a fix for the over-claim class. Report one improvement and one no-op.

## 3. `standalone/website.html` — ruled, and the problem is not the 1.5MB

It has been seen and deferred at least four times: `STATE-2026-08-26.md:138` and its item 8 at `:240`
(«بازتولید نمی‌شود … کارِ جدید است، نه پاک‌سازی»), and three round-16 artifacts declaring it
explicitly out of scope — `A1-REPORT.md:10`, `A1.json:12`, `A3-REPORT.md:69`. Four passes, four
deferrals, each individually reasonable. That is the abandoned-escalation pattern you identified at
the opening of this round, and it is the reason I am ruling rather than deferring a fifth time.

**The cost is not storage. It is that the orphan feeds a security audit.**
`tools/xss-sink-audit-report.json` carries multiple findings whose `file` is `standalone/website.html`
(`:3149, :3156, :3163, :3170`, and more). So a stale, unbuilt snapshot is contributing XSS sink
findings that are counted against the current codebase.

That is the worst of both states. **You cannot fix what you cannot rebuild** — a sink in that file
has no source to correct, because its builder (`tools/build-site-preview.py:323`) is manual and no
`.github/workflows/` job runs it.

**Ruling:** an artifact that no job builds must not contribute findings to a security audit. Pick one
and make it explicit:

- **Preferred:** exclude `standalone/website.html` from the XSS sink audit scope, and label it in
  place as a dated snapshot rather than a build output. Cheap, reversible, honest, and it stops the
  numbers being wrong.
- **Alternative:** give it a CI job that genuinely rebuilds it, per constitution rule 4 — then it is
  a real artifact and its sinks are real findings.

What must **not** persist is the present state: unbuilt *and* scanned. Do the cheap one now; the
build job is new work and the `STATE` doc is right that it is not cleanup.

**Re-baseline the XSS numbers after the exclusion**, and say plainly in the report that earlier sink
counts included a dead file. Any prior figure quoted from that report is now suspect, and I would
rather we retire the old number ourselves than have it quoted at us later.

## 4. For the founder — nothing new to decide

F1 still blocks the walk-in PR. §3 above is inside delegated authority (test strategy and gate
design) and needs nothing from you. Recorded here only so the ruling is visible in one place.

---

## 5. WITHDRAWN — §3's central premise was false. I verified it after ruling instead of before.

**§3 above is withdrawn in its security framing.** The CEO challenged it before implementing it, and
was right. I verified independently rather than conceding on its word:

```text
scan_paths          ["apps/customer","apps/business","apps/company","shared/js"]
report_only_paths   ["demo-mvp","standalone"]
hits                224 entries — top dirs: apps, shared
report_only_hits    224 entries — top dirs: standalone
website.html in hits             0
website.html in report_only_hits 4
hits === report_only_hits        false · JSON equal: false
hits[0].file             apps/customer/js/auth.js
report_only_hits[0].file standalone/business.html
```

`standalone` was never in `scan_paths`. The separation I demanded **already exists by design**, and
the four hits I cited live in `report_only_hits`, which is exactly what that array is for.

**So: nothing to exclude. No re-baselining. No prior XSS figure is suspect.** My directive would have
caused a **false retraction of a valid security number** — and retracting a correct number damages an
audit's credibility as much as publishing a wrong one. The CEO said it would have retired the figure
on my say-so; that it checked instead is the system working in the direction it is usually assumed
not to.

**How I got it wrong, precisely:** I grepped for `"file": "standalone/website.html"`, found four line
numbers, and inferred from their presence that they were counted. I never checked which array
contained them. That is *"a grep is not a read"* — the exact rule I applied to the CEO earlier today
over `gate-send.mjs`, committed by me a few hours later on a claim I then wrote into a directive as a
ruling. The `224` / `224` coincidence was visible in the file and would have caught it; the CEO
noticed it and checked, and I did not look.

**What survives, narrower and not urgent:** `standalone/website.html` is a committed 1.5MB artifact
whose builder (`tools/build-site-preview.py:323`) no workflow runs. That is still constitution rule 4
— what is not built is broken and nobody knows — and the four-times-deferred history at
`STATE-2026-08-26.md:138,240`, `A1-REPORT.md:10`, `A1.json:12` and `A3-REPORT.md:69` still argues for
settling it rather than deferring a fifth time. **It is a hygiene item, not a security one.**
Downgraded accordingly: no longer ahead of anything, and the `STATE` doc's judgement that a real
builder is new work rather than cleanup stands.

**Ledger note.** This is the second reviewer-authored instance today of the class we have been
cataloguing, and the more expensive one: §1 was a sign-off wider than what I established; this was a
*ruling* wider than what I established, addressed to someone who would have executed it. The pattern
is not that claims outrun evidence when work is sloppy — both of mine came while I was being careful.
It is that **the last step of verification is the one most often skipped, because by then the
conclusion already feels earned.**
