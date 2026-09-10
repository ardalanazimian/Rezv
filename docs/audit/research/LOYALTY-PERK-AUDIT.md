# LOYALTY-PERK-AUDIT — the four promises in `PERKS`, checked both directions

_Scout · written 2026-09-09 · target `rezv-9c [5283b5]` per `docs/audit/research/../prompts/ROUTING.md`
(re-resolve before trusting this id — session ids rotate). Triggered by the founder's own directive
today: «تمرکز روی فیچر ها، واقعی بودن و کار کردنشون» — features must be real and must work, because
they cannot be cheaply changed after launch. This file audits one loyalty promise end-to-end against
live code, then checks the market's tolerance for the same failure mode with sourced evidence._

> **What this file is not.** Not a repeat of `PARITY-RISK.md` or `ANTI-PATTERNS.md` — those compare
> Rezervno to competitors. This file starts from a claim the CEO session made about our own code today
> and independently re-verifies each of its four sub-claims against current `main`, because per
> `rezervno-audit-constitution` §1 a founder/CEO claim is evidence to check, not evidence to cite.

---

## 0. The claim under audit

`apps/customer/js/data/seed.js:62`:

```js
export const PERKS=[
  ['🎁','کش‌بک','تا ۱۵٪ برگشت پول'],
  ['⚡','رزرو سریع','اولویت در ساعات شلوغ'],
  ['🎂','هدیه تولد','تخفیف ویژه ماه تولد'],
  ['👑','میز VIP','دسترسی به میزهای ویژه'],
];
```

Rendered verbatim, unconditionally, on the loyalty screen for every user regardless of tier
(`apps/customer/js/features/loyalty.js:16,100` — `PERKS.map(...)`, no tier filter, no gating). A diner
who has never made a reservation sees the identical four-item list as a diner on the top tier. This
matters for everything below: **the promise is presented as flat**, so "only the top tier gets it" is
not disclosed anywhere the user can see.

The CEO session's brief characterized this session's task as verifying four claims it had already
made: birthday REAL, cashback PARTIAL, priority FAKE, VIP-table FAKE. Each is re-derived below from a
fresh read, independent of that framing.

---

## 1. کش‌بک (cashback) — "تا ۱۵٪ برگشت پول"

**Verdict: PARTIAL, confirmed.**

`api/prisma/schema.prisma:175-178` defines four distinct cashback rate columns on `Restaurant`:

```
cbBasePct     Int @default(5)  @map("cb_base_pct")
cbPreorderPct Int @default(8)  @map("cb_preorder_pct")
cbVipPct      Int @default(12) @map("cb_vip_pct")
cbWinbackPct  Int @default(20) @map("cb_winback_pct")
```

All four are writable by a restaurant admin — `api/src/app/api/v1/restaurant/cashback/route.ts:39-42`
accepts and persists `base_pct`, `preorder_pct`, `vip_pct`, `winback_pct` independently, and the GET on
the same route (`:23,26-27`) returns all four back to the panel as if they are all live settings.

But the only place cashback is ever actually computed and paid into the ledger is
`api/src/lib/reservations.ts:610-616`:

```ts
const cbPct = r.cbBasePct ?? 0;
cashback = Math.round((final * cbPct) / 100);
```

`cbPreorderPct`, `cbVipPct`, `cbWinbackPct` do not appear in this function, in `loyalty.ts`, or
anywhere else that touches `pointsLedger.create` (grepped across `api/src/lib/*.ts` — zero hits outside
the admin route and `staff-helpers.ts`'s read-only `RESTAURANT_SELECT` list). A restaurant owner can set
`cbVipPct = 12` in the panel, see it echoed back as saved, and it will never once change a cashback
figure for any customer at any tier. **This is not a missing feature — it is three settings that look
live and are dead**, which is a sharper failure than simply not building VIP cashback: the admin UI
actively confirms a write that has no effect downstream.

Default value `cbBasePct = 5`, and the copy promises "تا ۱۵٪" ("up to 15%") — so even the one live rate
is, by default, a third of the ceiling advertised. Whether any restaurant has actually configured 15%
was not checked (would require live DB access, out of scope for a code audit).

## 2. اولویت در ساعات شلوغ (priority at busy hours) — **CORRECTING the CEO session's own claim**

**Verdict: REAL as a mechanism, MISLEADING as presented. Not FAKE.**

The CEO's brief said `grep waitlist_priority` → 0 hits and called this FAKE. That grep is a
string-literal search for a token that was never the variable name; it is not evidence the feature is
absent, and per the Gen-Z charter's second behavior ("contradict a directive when the source
disagrees — including the CEO's"), the correction is filed here rather than silently assumed.

What actually exists, read end-to-end:

- **Customer-facing entry point is real.** `apps/customer/js/waitlist.js:78` posts to `/waitlist` from
  the live customer app (invoked from `offerWaitlist` in `apps/customer/js/data/booking.js:11` when a
  slot is full) — this is exactly the "busy hours" moment the perk copy describes.
- **The server computes a real, tier-based priority score.** `api/src/lib/waitlist.ts:133-153`:
  ```ts
  export function isVipTier(tier: string): boolean {
    return tier === 'gold' || tier === 'platinum' || tier === 'vip';
  }
  export function tierToPriority(tier: string): number {
    if (tier === 'platinum' || tier === 'vip') return VIP_PRIORITY;   // 100
    if (tier === 'gold') return CLUB_GOLD_PRIORITY;                    // 50
    if (tier === 'silver') return 20;
    return 0;                                                          // bronze / no membership
  }
  ```
- **The priority score genuinely changes who gets seated first.** Waitlist entries are queried with
  `orderBy: [{ priority: 'desc' }, { joinedAt: 'asc' }]` in three separate places
  (`api/src/lib/waitlist.ts:282,335,393`) — including the path that decides who receives the next
  table offer. This is not a cosmetic field; it is load-bearing in the actual serving order.

**Why "misleading as presented" and not "closed, ship it":** `tierToPriority` returns **0 for bronze**,
which is the tier every new member starts at (`computePriority`, `waitlist.ts:146-153`, default
`tier ?? 'bronze'`). The perk card renders identically for a brand-new bronze member and a platinum
member — both see "⚡ اولویت در ساعات شلوغ" as one of "the club's four benefits," with no tier
qualifier in the UI copy anywhere in `loyalty.js`. A bronze member who joins specifically for this perk
gets **exactly the same priority as a non-member (0)**, and nothing in the product tells them that.
This is the same shape of problem as item 1 (a technically-real mechanism whose promise is broader than
its delivery) but inverted: cashback pays a *smaller* number than advertised to everyone; priority pays
*zero* to most people while being marketed as universal.

**Recommendation implication:** this is a labeling fix, not a build. Either (a) state the tier
threshold in the perk copy ("از سطح نقره‌ای به بعد" / "from Silver up"), or (b) give bronze a small
non-zero priority so "joining the club" itself is never worth literally nothing on this axis. Both are
copy/small-logic changes, not new infrastructure — see `proposals/007` below.

## 3. هدیه تولد (birthday gift) — "تخفیف ویژه ماه تولد"

**Verdict: REAL, confirmed.**

`api/src/lib/loyalty.ts:376-446`, `grantBirthdayRewards()`, runs as a daily cron, queries users whose
birthday is today (`birthdayUsers` query, `:402`), and awards `POINTS.birthday = 1000` points via
`addPoints({..., reason: 'birthday', note: 'هدیه‌ی تولد 🎂'})` (`:413`), then enqueues an SMS
(`:424`). The code contains its own documented bug-fix history — a comment (`:379-391`) records and
fixes a real prior defect where a Jalali birth-month written by the restaurant panel was compared
against the wrong calendar, causing the reward to fire "on the wrong day." That fix being present and
explained, rather than the bug being silently reintroduced, is itself a small positive signal about
how this codebase handles its own admitted mistakes — consistent with the audit constitution's own
tone. This is the one perk of four that is delivered exactly as promised, to every tier, unconditionally.

## 4. میز VIP (VIP table) — "دسترسی به میزهای ویژه"

**Verdict: FAKE as promised. Confirmed, and worse than a simple absence.**

The pieces exist in isolation but are never connected:

- `Table.isVip: Boolean @default(false)` is a real schema column (`schema.prisma:286`), settable by
  restaurant staff through `api/src/app/api/v1/restaurant/tables/route.ts:18,57` and
  `.../tables/[id]/route.ts:23,46` — a genuine per-table admin flag, plus a `'vip'` zone value in the
  same `ZONES` enum (`tables/route.ts:10`).
- Separately, `ClubMember.tier` drives `isVipTier`/`tierToPriority` (above) and a **different** `isVip`
  boolean lives on `GuestProfile`/`Customer`-style analytics rows (`schema.prisma:624,1031`), consumed
  exclusively by CRM/churn code: `customer-insights.ts:319,339-348` (sets/resets the flag from
  `predictedClvToman`, a churn-risk computation), `loyalty-status.ts:71,83,166` (`isVipAnywhere`, a
  cross-restaurant analytics rollup), `crm-recommendations.ts:25,65` (feeds a churn-risk recommendation
  rule). None of these three files touch `Table` or any reservation-assignment path.
- A targeted grep across every reservation/table-assignment code path in `api/src/lib/*.ts` for any
  read of `Table.isVip` in relation to a customer or a club tier: **zero hits.** The only two files
  that read `Table.isVip` at all are the two staff-admin table-management routes above, which use it
  purely as a label a host can filter/display by — never as an input to who gets seated where.

**So there are two unrelated things named "VIP" in this codebase — a table-zone label for staff, and a
churn-analytics flag for restaurant owners — and neither one gives a diner who reaches VIP club tier
any actual claim on a VIP-zone table.** This is a sharper finding than "feature not built": the
naming collision means a future engineer skimming the schema could plausibly believe the connection
exists (`isVip` appears on `Table`, `GuestProfile`, and implicitly via `isVipTier` on `ClubMember`) and
ship a claim about it without checking, exactly the failure class `rezervno-audit-constitution` §1
exists to prevent. Flagging the naming collision itself as a small but real footgun.

---

## 5. Summary table

| Perk | Copy promises | Verdict | Evidence |
|---|---|---|---|
| کش‌بک | "up to 15%" for everyone | **PARTIAL** — only `cbBasePct` (default 5%) ever pays; `cbPreorderPct`/`cbVipPct`/`cbWinbackPct` are writable, echoed-back, and dead | `reservations.ts:610-616` vs `cashback/route.ts:39-42` |
| اولویت در ساعات شلوغ | flat perk, no tier stated | **REAL mechanism, misleading presentation** — genuinely reorders the waitlist queue, but bronze (the entry tier) gets priority 0, same as a non-member | `waitlist.ts:133-153,282,335,393` |
| هدیه تولد | "special discount in birth month" | **REAL** — daily cron, 1000 pts, SMS, documented bug-fix history | `loyalty.ts:376-446` |
| میز VIP | "access to special tables" | **FAKE** — `Table.isVip` (staff label) and club-tier `isVip*` (churn analytics) never connect; zero reservation-assignment code reads either together | grep across `api/src/lib/*.ts`, 0 hits |

**Net: of four flat promises shown identically to every user, one is fully honest, one pays roughly a
third of its advertised ceiling by default, one works only for the ~tier most members will never
reach and says nothing about that, and one does not exist as connected functionality at all.** This is
not "mostly fine with one gap" — it is a pattern: every perk that involves restaurant-side
configuration or cross-model wiring is compromised, and the only fully-real one (birthday) is the one
computed entirely server-side with no restaurant input and no cross-model dependency. That pattern is
worth naming for whoever builds the fix: **the risk is not the loyalty feature's design, it is
anywhere a promise depends on two models agreeing that were built by different work at different
times.**

---

## 6. Does the market punish this? — evidence, both weak and strong

The founder asked specifically whether competitors are punished for the same dark pattern, and how
loudly. Honest answer: **the evidence found is real but thin — this is a genuinely under-covered
question in the existing 34-file corpus, not a settled one.**

**Iran — no direct precedent, and that itself is informative.** `corpus/snappfood/features.md:196`
(already on file, 2026-09-04): targeted Persian and English searches for a SnappFood tier/VIP/status
system found nothing — "reads as a genuine absence rather than a search failure." None of Fidilio's,
SmartX's, or Foodism's corpora (all five evidence-mode files each, already on file) surfaced a named
VIP-table or tiered-priority mechanic to criticize in the first place. **This means Rezervno's PERKS
list is already more ambitious than anything a real user of an Iranian competitor has had the chance to
be disappointed by** — nobody is being punished in this market because nobody has shipped the promise
yet. That is a reason for urgency (we would be first, and first mover on a broken promise sets a worse
precedent than a slow follower on an honest one), not a reason for comfort.

**Global — the closest analogue is Resy's *opacity*, not a broken promise, and it draws less fire than
TheFork's broken one.** Resy grants "VIP"-equivalent status by invitation with criteria the company
declines to publish. The Points Guy, 2026 (fetched): *"Now, you may be asking yourself how you can get
this status? Well, it's unclear."* [thepointsguy.com/news/resy-loyalty-program/, fetched 2026-09-09] —
no criteria, no complaint about the criteria being false, because Resy never states a mechanism a user
could catch it failing. **Contrast with TheFork, already on file in `ANTI-PATTERNS.md` #1**: a
*stated* promise (accrued Yums value) that gets revoked draws direct, dated, quoted 1-star backlash —
4 of 21 recent reviews, 19%, in a 4-week window. **The pattern across both: silence about a mechanism
draws far less punishment than a stated promise that turns out false or partial.** Rezervno's PERKS
card is the second shape, not the first — it makes four specific, checkable claims in one screen. That
is the more dangerous shape, evidenced by TheFork's own numbers, even though TheFork's specific failure
(confiscation) is not the same failure (partial/misleading, not confiscated) as ours.

**One more secondary, unverified data point, flagged as weak evidence on purpose:** a WebSearch result
paraphrase (not a fetched primary page) reported "complaints about Agoda VIP bookings not providing
hotel chain loyalty program benefits" — a promised-tier-benefit-not-delivered pattern in the same
family, but Agoda is travel booking, not restaurant reservation, and the claim was never fetched to a
primary source. Recorded as `UNKNOWN — not verified, secondary paraphrase only`, not used as a load-
bearing finding.

**What was NOT found, honestly:** no verbatim, dated, sourced review of any competitor complaining
"my VIP status did nothing" or "my cashback rate was less than advertised." The corpus is 50+ reviews
deep on money-confiscation and undisclosed-charge complaints (TheFork), but zero reviews were located
specifically about a *partial/misleading* loyalty perk, as opposed to a *confiscated* one. **This is a
real gap in this research programme, not a settled "no" — the next research pass should search
specifically for "loyalty tier didn't help," "VIP means nothing," and Persian equivalents
(«سطح‌بندی باشگاه فرقی نداشت», «وی‌آی‌پی الکی بود») across Trustpilot, Reddit, and Persian social,
rather than assuming the silence above is a complete answer.**

---

## 7. What I did NOT verify

- Whether any live restaurant has actually configured `cbVipPct`/`cbPreorderPct`/`cbWinbackPct` above
  their defaults, believing they were live — that requires production DB access, out of scope here.
  If any restaurant has, the gap between what they were told they configured and what customers
  received is a support/trust liability beyond the code-level finding.
- Whether `VIP_PRIORITY=100`/`CLUB_GOLD_PRIORITY=50`/silver `20` actually produce a noticeably faster
  wait in practice, or whether waitlists are short enough in typical use that the ordering rarely
  matters — this is an operational question, not a code-existence one.
- The exact tier thresholds (points needed for silver/gold/platinum) were not re-derived here; they
  are already cited in `PARITY-RISK.md` #3 as `api/src/lib/loyalty.ts:41-45` and not re-verified this
  pass.
- Whether any Persian-language competitor review specifically calling out a fake/partial loyalty perk
  exists — searched, not found, but not exhaustively; see §6's explicit call for a follow-up pass.
- No production data, no live user sentiment for Rezervno itself (pre-launch) — everything above is a
  static-code read.

---

**Routing note:** this file plus `proposals/007-loyalty-perk-honesty.md` are the two artifacts the CEO
needs from this section. See `BRIEF-2026-09-09.md` for the one-line summary and ranking against the
existing proposal backlog (001-006).
