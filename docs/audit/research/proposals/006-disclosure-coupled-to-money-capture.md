# 006 — Disclosure and money capture ship together, or neither ships

_Status: proposed 2026-09-05 by Scout (batch 3). Same T1/T2/T3 caveat as 001–005: no CEO tiering
definition exists in-repo; the generic scale is used._

> **The short version.** Rezervno currently tells a diner, in hardcoded Persian, that a deposit
> **"آنلاین دریافت نمی‌شود"** — it is not collected online. That sentence is **true today** and the team
> proved it with a grep. It stops being true the moment a per-restaurant database boolean is flipped,
> and **nothing in CI can see that flip.** This proposal is about pinning the claim to the capability
> so they cannot drift apart. The competitor evidence for why that drift matters is dated, named and
> costly.

## The gap

### What it looks like when a platform gets this wrong

From `profiles/thefork.md` — Trustpilot, 21,638 reviews, fetched directly 2026-09-05, 21 most recent
1-star reviews read:

- **Clive Fathers (GB, 2026-07-21):** *"The App did not alert me to the charge, otherwise I wouldn't
  have cancelled."* — a **£100** cancellation fee.
- **AJK (GB, ~2026-08-29):** *"Charged £40 even though attended the booking."*

From batch 1 (`profiles/opentable-resy-sevenrooms.md`): OpenTable no-show fees of **$25–50/person**
described as a source of "adversarial" disputes; Resy fees **up to $100/person**, called "obscene" by
a reviewer.

From batch 3 (`profiles/iran-reservation-longtail.md`), and closest to home: **RSEE** — the only live
dedicated Iranian table-reservation platform — sells the diner a chair-denominated credit
(**«هر آرسی معادل یک صندلی از یک میز می باشد»**) and forfeits **50–100%** of it on a late cancellation.
In Iran, right now, the diner-pays-to-book model is not hypothetical. It is the incumbent.

**The common shape across all four is not "fees exist."** Fees are a legitimate business decision.
The shape is: **the number was enforceable before it was visible.** That is the failure this proposal
prevents.

### Where Rezervno is exposed — verified, on a named ref

All citations on ref **`audit/launch-hardening` @ `35fff27`**, 2026-09-05.

**1. A hardcoded diner-facing claim whose truth depends on a runtime database row.**

`apps/customer/js/data/booking.js:66-70`:

```
export function depositLabel(r){
  if(r?.depositRequired === true) return 'این رستوران سیاستِ بیعانه دارد — آنلاین دریافت نمی‌شود، هنگامِ حضور هماهنگ کن';
  if(r?.depositRequired === false) return 'رزرو رایگان · بدون پیش‌پرداخت';
  return '';   // نامعلوم → سکوت، نه ادعا
}
```

**Credit where it is due — this function is already excellent, and it is the reason the proposal is
cheap rather than a rescue.** Its header comment (`:43-65`) records that the app previously hardcoded
*«رزرو رایگان · بدون پیش‌پرداخت»* even at restaurants that had deposits switched on; that this was
fixed; that `null` must produce **silence, not a guess**; that it is deliberately the **single**
implementation of deposit copy in the whole app (§۲۲); and that on 2026-08-24 the `true` branch was
*softened* from "this restaurant charges a deposit" to "not collected online" **because the customer
app never calls the payment route** — *"تأییدشده با grep: صفر فراخوان به `/reservations/:code/pay`"*.

That is exactly the right instinct, verified the right way. **The problem is that the verification was
a one-time grep by a human, and the thing it verified is now load-bearing user-facing copy.**

**2. The capability it denies exists, is authorised, and is one row away.**

- `api/src/app/api/v1/reservations/[code]/pay/route.ts` exists and starts a real Zarinpal payment.
- Its only gate is a **per-restaurant database boolean**: `:35` —
  `if (!resv.restaurant.paymentEnabled) throw Err.validation('پرداخت آنلاین برای این رستوران فعال نیست')`.
- A repo-wide grep for `paymentEnabled` / `payment_enabled` across `api/src`, `apps/customer/js` and
  `shared/js` returns **exactly two hits, both inside that one route** (`:27` select, `:35` guard).
  **Nothing else in the product reads it — including the copy that tells the diner what it means.**
- Platform feature flags are stored in `platform_settings` and flipped at runtime by an admin
  (`api/src/lib/feature-flags.ts:63,74-75` — `getPlatformSetting` / `setPlatformSetting` + `audit`).

So the sentence *"آنلاین دریافت نمی‌شود"* is falsified by **an `UPDATE` statement and a wired button** —
neither of which is a code change CI reviews, and one of which is not a code change at all.

**3. A monetary penalty that is configured, stored, and invisible to the diner.**

`docs/audit/CANCELLATION-POLICY.md` §1 tabulates the five `cancellation_policies` columns and states
that `partial_penalty_hours` and `partial_penalty_pct` are **owner-only, never sent to the diner, and
not enforced** (enforcement needs money capture) — and the doc **self-corrects an earlier wrong claim**
that the penalty *was* shown to the diner. The default is **50%** (`schema.prisma:1989`;
`api/prisma/sql/038-unified-economy.sql:99`), it is editable in the business panel
(`apps/business/js/crm.js:988`), and resolution logic exists in `api/src/lib/cancellation-policy.ts`.
Meanwhile `apps/customer/js/data/booking.js:80-83` (`cancelPolicyLabel`) tells the diner about the
free-cancel window and a **reputation** consequence — a strike and a visible badge downgrade — and
says **nothing about money**, correctly, because no money moves.

**Today that is honest.** The exposure is that "restaurant sets 50%" + "payment capture enabled" is a
two-flag combination that becomes a real charge, and the diner-facing string is not derived from either
flag.

## The mechanism

Three changes. One is a real fix; two are gates that keep the fix true after everyone forgets about it.

**1. Derive the sentence from the server, stop hardcoding it.** Add an explicit
`onlineDepositActive` (or equivalently-named) boolean to the restaurant payload that
`GET /api/v1/restaurants/[slug]` already sends — sourced from the same `paymentEnabled` row the pay
route guards on — and make `depositLabel()` branch on it instead of hardcoding *"آنلاین دریافت نمی‌شود"*.
Preserve the existing three-state discipline exactly: **`null` → silence, never a guess.** Flipping the
database row then changes what the diner is told, automatically, in the same request.

**2. A coupling gate: the claim cannot outlive the capability.** A test asserting that **if** any file
under `apps/customer/js` references the payment route (`/reservations/`…`/pay`), **then**
`depositLabel`'s `true` branch must not contain the literal string `آنلاین دریافت نمی‌شود`. This is the
2026-08-24 grep, automated, run on every push. It passes today (zero call sites). It goes red the day
someone wires the button without updating the copy.

**3. The same coupling for the money penalty.** A test asserting that **if** `partial_penalty_pct`
becomes readable by any diner-facing response contract **or** by any code path that captures money,
**then** the customer app must render it. `api/tests/business-panel-contract.integration.test.mts:108`
already pins `partial_penalty_pct` as a key the *business* panel consumes — this is the mirror
assertion for the *diner* side, and it should live next to the existing
`booking-policy-contract.integration.test.mts`, whose header comment already reasons about exactly this
distinction (`:115` — *"برخلافِ `partial_penalty_pct` و `deposit_required` که بدونِ درگاه اجرانشدنی‌اند"*).

### Both gates must be proven falsifiable, and both must error on a missing subject

This is not optional decoration; it is `CLAUDE.md` rules 2 and 5 and the direct lesson of
`docs/audit/GATE-FALSIFIABILITY.md`.

- **Rule 2 — prove it goes red.** Add a `fetch('/api/v1/reservations/x/pay')` call in a scratch file
  under `apps/customer/js`, run gate 2, **record the non-zero exit code in the PR**, revert.
- **Rule 5 — absence must be an error, not a pass.** If the gate cannot locate `depositLabel`, or
  cannot locate the pay route, it must **fail loudly**. A grep-based gate whose target has been renamed
  and which therefore matches nothing is the textbook silent escape hatch: it stays green forever while
  measuring nothing. This repo has already been burned three times by exactly that.
- **Rule 3 — catch the partial mutation.** The assertion must not be "does the app mention deposits at
  all." Ask the smaller question: *what is the smallest change that makes the copy false but keeps the
  gate green?* Answer today: rewording the string. So the gate should pin the **semantic claim**
  ("collection does not happen online") to the **capability**, and the string constant it matches on
  should live in one place that both the code and the test import — not be duplicated into the test.

## Why it wins

- **It is the exact complaint a real diner filed six weeks ago against the largest reservation loyalty
  platform in Europe**, in the same sentence he used to explain the decision he would have made
  differently: *"otherwise I wouldn't have cancelled."* That is not a fee complaint. It is a consent
  complaint.
- **It converts a one-time human grep into a standing guarantee** — and it does so on a claim the team
  has *already decided* it wants to be true. There is no product debate to win here; the copy is
  already written, already reviewed, already correct. The proposal only stops it from silently rotting.
- **Competitors cannot copy it as marketing.** "We disclose our fees" is a sentence anyone can print.
  "Our CI refuses to let a charge become enforceable before it is displayed" is an engineering
  commitment with an artifact behind it — and it is precisely the kind of claim
  `proposals/002` (data-provenance receipt) is designed to carry to users credibly.
- **It is the right time.** RSEE proves the Iranian market's incumbent model already takes the diner's
  money at booking. When Rezervno eventually turns deposits on — and the schema, route, gateway and
  panel UI all say it intends to — the honest-disclosure path must already be the default path, not a
  remembered obligation.

## Cost estimate

**T2**, and the cheapest of the three T2s currently on the table (005, 004, 006) because item 1 is a
one-field payload addition and a two-line branch change.

Touches: one field added to the restaurant payload in `api/src/app/api/v1/restaurants/[slug]/route.ts`
(and `restaurants/route.ts` if the list view also renders the label); `apps/customer/js/data/booking.js`
(→ requires a `CACHE_VERSION` bump at `apps/customer/sw.js:14` per `CLAUDE.md`); two test files under
`api/tests/`; and a recorded falsification run.

**Owners:** `backend-integrity-engineer` for the payload field (it touches a diner-facing response
contract); `contracts-consolidation-engineer` for `booking.js`, since removing a client-side hardcoded
business claim is squarely its "client fallbacks that fabricate business success" mandate;
`test-integrity` for both gates and the falsification proof. **No architect sign-off needed** — this
adds no schema and changes no reservation-lifecycle logic.

## Product-bar check

- **Money honesty:** this is the entire proposal — passes.
- **No dark patterns:** passes. It removes a possible future misstatement; it adds no urgency, no
  friction, no pre-checked anything.
- **Notification restraint:** passes by construction — nothing here sends any message.
- **Honest labels:** passes. No new user-facing branding at all. The only new user-visible text is a
  truthful variant of a sentence that already exists.
- **Explicitly NOT proposed:** that Rezervno should or should not charge deposits or cancellation
  penalties. That is the founder's commercial decision. This proposal is neutral on the *policy* and
  concerns itself only with the *ordering* — the diner learns the number before it can be charged.

## What I did NOT verify

- **I did not run any of this.** No test executed, no server started, no exit code recorded. Every
  claim above is read from source on one named ref. Per this repo's own first rule, **"typecheck
  passed" ≠ "tested," and "I read the code" is weaker still.**
- **`resolvePolicy()` caller count.** `docs/audit/CLEANUP-REPORT-2026-08-23.md:203` states it has zero
  callers. I read that claim; I did **not** independently re-grep it. If it now has callers, item 3 is
  more urgent than written, not less.
- **Whether `GET /restaurants/[slug]` already returns something equivalent to `paymentEnabled`.** I
  confirmed `paymentEnabled` appears nowhere outside the pay route, but I did not read the full
  response shape of the restaurant routes, so the field may exist under a different name.
- **Whether any restaurant currently has `paymentEnabled = true`.** That is live-data, and per this
  machine's constraints no production database is reachable. If some already do, the hardcoded sentence
  is **already** wrong for those diners today — and that would make this a bug report rather than a
  proposal. **Someone with database access should check this before deciding the priority.** I flag it
  as the single highest-value unknown in this file.
- **The customer app's list view.** I verified the label is rendered in the booking sheet
  (`booking.js:261`); I did not check every other surface that might display deposit copy, though the
  file's own §۲۲ comment claims it is the single implementation.
- **TheFork's and RSEE's side of their stories.** Verified: what users publicly reported, and what RSEE
  publicly published. Not verified: whether any individual charge was justified.
