# ORDER-001 — XSS override re-review queue

**Date:** 2026-09-07 · **Session:** `rezv-30 [a7bb03]` (Deputy) · **Reports to:** `rezv-b0 [d8087d]` (CEO)
**Mandate target `rezervnofullsource-d9 [8dde6c]`:** UNKNOWN — not verified. Not present in `ListAgents`;
the CEO's inference is that it is a CEO session on host `DESKTOP-8DAJNO5`. Recorded, not assumed.
**Fulfils:** ORDER-001, issued by `rezv-b0 [d8087d]`, 2026-09-07.
**Status: SUBMITTED — not closed.** I close nothing and certify nothing. The CEO closes this.

**What this needs from whoever reads it:** a human security judgement on 16 rows. This file supplies
the *reading*, not the *verdict*. Every row states what was covered, what was not, and the one thing
a person must decide. No row here is called safe or unsafe by me.

**Companion file:** `ORDER-001-expressions.json` — the full corrected expression, the old truncated
expression, and the unseen tail, verbatim, for all 16 rows. The order asked for the full expression
per row; pasting 16 template literals (up to 3,926 chars each) into this table would defeat the
purpose of the queue, so the full text lives in the JSON and this file carries the boundaries and the
decisions. That is a deliberate deviation from the letter of the order and it is flagged here.

---

## 0. My own error first, because it changed the shape of this artifact

My first pass reported this set as 12 rows and told the CEO that the three `standalone/` rows in the
order "cannot exist". **That was wrong.** I read only the artifact's `hits` array and never
`report_only_hits`. The artifact carries two populations of 224 each:

```text
hits              224   apps/customer, apps/business, apps/company, shared/js   (scan_paths, enforced)
report_only_hits  224   standalone/                                             (report_only_paths)
```

`scan_paths` is `["apps/customer","apps/business","apps/company","shared/js"]` and `report_only_paths`
is `["demo-mvp","standalone"]`. So `standalone/` never appears under `scan_paths` — which is what made
"there are no standalone sinks" look true when I checked the wrong key. This is the trap directive
022 §4 records (448 vs 224, both correct, different populations).

I corroborated the wrong number three ways — gross transitions, net delta, transitions-into-`escaped` —
and all three agreed **because all three read the same truncated population.** Internal corroboration
within one scope cannot detect a scope error. The check that would have caught it did fire and I
overrode it: my `87 − 19 = 68` disagreed with the tool's own printed `67`, and I resolved that in
favour of my arithmetic. **When your number and the instrument's number disagree, the gap is the
finding.** Recorded here because the next session inherits the method, not the apology.

Every number below is re-measured across both populations.

---

## 1. Method, and the gate that makes it admissible

Read-only throughout. Nothing was checked out, no branch was switched, the `relay-wt` worktree was not
touched, `audit/launch-hardening` was not touched, and `tools/report-gate-status.mjs` was **not run**
(it rewrites the committed record).

```text
node                 v20.20.2
repo                 C:\Users\Ardalan\Desktop\rezv\Rezv   branch main @ 96322a0
subject              origin/audit/round-21-xss-truncation @ 63447e2  (== local ref, verified)
before/after         63447e2^ (9785ae4)  vs  63447e2
sources              git show 63447e2:<path>   — never a checkout
```

**The extractor harness.** `tools/xss-sink-audit.mjs` calls `main()` at its tail, so importing it would
run the whole scan and regenerate the artifact — forbidden by the order. Instead both revisions'
*pure* functions were copied verbatim into a scratchpad harness (`SINK_PATTERNS`,
`matchingParen`/`matchingDelim`, `grabExpression`, `skipQuoted`, `extractInterpolations`,
`normalizeSinkExpr`, `sinkHash`) with `main()`, `classify()`, the override table and every write path
excluded. Verbatim copy, not re-implementation, so there is no drift between my extractor and the
tool's.

**Fidelity gate — this is what makes the rows below evidence rather than assertion.** The harness must
reproduce the *committed* `sink_hash` for every row, under both revisions, or the run aborts:

```text
=== FIDELITY GATE ===
PASS — both harnesses reproduced the committed hash for all 16 rows.
```

If the harness disagreed with the artifact by one byte, the hashes would differ and the run would have
failed. It asserts the identity of what I measured, rather than assuming it.

**One measurement artifact I hit and corrected.** Splitting the *tail* with `extractInterpolations`
gives wrong counts, because the tail begins mid-template and the splitter only returns top-level
interpolations — `menu.js:674` reported 12 interpolations in a tail whose parent expression has 2.
All tail figures below are therefore counted on the tail region directly at any nesting depth
(`${` openings, helper call sites), not by re-splitting it out of context.

---

## 2. Findings that apply across the whole set

### 2.1 The tool's only truncation self-check was structurally blind to this bug

`tools/xss-sink-audit.mjs:721`:

```js
const truncated = consumedParen && !expr.trim().endsWith(')');
```

It is gated on `consumedParen`, which is true only when the sink pattern itself swallowed a `(` —
the call-form sinks. `x.innerHTML = ` + backtick never sets it, so the backtick branch **could not
raise the flag**. `:751` (`hits.filter(h => h.expr_truncated)`) is its only consumer.

Measured across both artifacts, both populations:

```text
old: expr_truncated=true on 0 of 448 hits
new: expr_truncated=true on 0 of 448 hits
```

The one check that existed to detect silent truncation reported clean through the entire defect, and
still does. This is a second, independent blindness from the one the fix addressed: the extractor
stopped reading, and the mechanism meant to notice that it had stopped reading could not see it.

### 2.2 Four of the sixteen rows are the same sink twice

The `standalone/` bundles are inlined copies of the app sources. Four rows are byte-identical
duplicates of four others — identical old hash, identical new hash, identical expression length:

| App row | Standalone twin | shared hashes |
|---|---|---|
| `apps/company/js/intelligence.js:865` | `standalone/company.html:3188` | `1797949972c4` → `3657270d8f86` |
| `apps/business/js/menu.js:213` | `standalone/business.html:6376` | `5c695df0744c` → `2ac12446a42a` |
| `apps/customer/js/waitlist.js:61` | `standalone/customer.html:2458` | `ce542bc538c1` → `d4a2e6ab0f65` |
| `apps/customer/js/data/booking.js:373` | `standalone/customer.html:2989` | `f67d5212799b` → `23aebe67e9d0` |

**16 rows, 12 distinct sinks, 12 human decisions.** The reviewer should read each pair once. But the
pairing carries its own question, stated as row-pair decisions below: a fix to the app source closes
the standalone twin **only if the bundle is regenerated from source**. If `standalone/` is
hand-maintained, fixing the app leaves the bundle carrying the old code. I did not determine which it
is — see §5.

Because `standalone/` is `report_only`, its rows do not fail the gate. That makes them easier to miss,
not less real.

### 2.3 The 16 rows fall into three classes, and they cost very different amounts to review

| Class | Rows | What happened | Reading cost |
|---|---|---|---|
| **C — note was honest** | 2 | The note's every claim sat inside the region the old key really covered. The key died only because the expression got longer; the added tail has zero interpolations. | Low |
| **B — note rests on a helper body** | 2 | The note justifies safety by the contents of a *function called from* the sink (`missionCard`, `wlCard`). The key never covered that function's body, before or after the fix. | Medium — and this is directive 022 §6's class, untouched by the fix |
| **A — note rests on unseen text** | 6 | The note names escaping that sat past the truncation point. The old key certified a prefix and the note described the whole. | High |
| **`escaped` → `review`** | 6 | No override existed. The classifier called these safe having read only part of the expression. | Medium |

---

## 3. The ten dead overrides

Measured: note-bearing hits **20 → 10** across both populations; **10 died, 0 newly live**.
87 declared − 20 live = 67 dead before; 87 − 10 = 77 dead after. Matches the tool's own printed counts.

Field key per row — **(1)** full corrected expression **(2)** what the old hash actually covered
**(3)** what sat outside it **(4)** the note verbatim + whether it describes anything the key protected
**(5)** the human decision.

---

### CLASS C — the note was accurate about its own reach

#### C1 · `apps/company/js/intelligence.js:865` — `dom_api_safe` → `unsafe`
#### C2 · `standalone/company.html:3188` — `dom_api_safe` → `unsafe` *(identical twin of C1)*

Hash `1797949972c4` → `3657270d8f86` (both rows). Note present before, absent after (both rows).

1. **Full corrected expression:** 1,040 chars — `ORDER-001-expressions.json`, rows 8 and 10.
2. **Covered by the old hash:** chars 0–875. Cut point:
   `…onclick="adminPasswordLogin()">ورود به پنل</button>\n    ${_otpLoginEnabled ? \``
3. **Outside the old hash:** 165 chars (16% of the sink), containing **zero interpolation openings**
   and zero helper calls:
   `<button class="login-back" onclick="showAdminLoginPhone()">ورود با پیامک</button>` : ''}` followed
   by a static `login-foot` div.
4. **Note (verbatim, identical on both rows):**
   > «فرمِ ورودِ مدیر (TOTP، ۲۰۲۶-۰۸-۲۹): هر دو درجِ این قالب markupِ **داخلیِ ثابت** است — `totpBlock` یک رشته‌ی literal یا خالی، و ternaryِ onkeydown دو literal. هیچ داده‌ی کاربر/سرور واردش نمی‌شود؛ پرچمِ `_totpRequired` یک boolean از GET /auth/admin/login است. پیش از این تغییر همین محل safe_static بود چون اصلاً درج نداشت. ۲۰۲۶-۰۹-۰۲: درجِ سومِ _otpLoginEnabled هم اضافه شد — همان جنس: یک booleanِ سرور که فقط تصمیم می‌گیرد رشته‌ی literal ساخته شود یا نه.»

   **Does it describe what the key protected? Yes — all three named tokens are inside the covered
   region.** Measured: `totpBlock` covered · `_totpRequired` covered · `_otpLoginEnabled` covered.
   This is the only note in the set whose claims all sat within the old key's real reach.
5. **Human decision:** confirm the 165-char tail introduces no dynamic insertion (measured: it does
   not), then re-key the override to `3657270d8f86`. **Decide C1 and C2 together — same bytes.**

---

### CLASS B — the note rests on a helper body the key never covered (directive 022 §6, still open)

#### B1 · `apps/customer/js/features/economy.js:106` — `dom_api_safe` → `unsafe`

Hash `15dccaa57a8f` → `034d540c7610`.

1. **Full corrected expression:** 1,255 chars — JSON row 1.
2. **Covered:** chars 0–870. Cut point: `…</div>\n    </div>\n\n    ${missions.length ? \``
3. **Outside:** 385 chars (31%), 3 interpolation openings, **no escaping helper calls at all**:
   `${missions.map(missionCard).join('')}`, `${rewards.length ? …}`, `${rewards.map(rewardCard).join('')}`.
4. **Note (verbatim):**
   > «missionCard(m) دیگه esc(m.title)/esc(m.description) داره (رفع‌شده در همین PR).»

   **Does it describe what the key protected? No.** Measured: `esc(m.title)` and `esc(m.description)`
   appear **nowhere in this expression** — neither in the covered region nor in the tail. They live in
   `missionCard`, a separate function; the sink only contains `missions.map(missionCard)`, which is
   itself in the tail. The note certifies a function body the key has never hashed. Deleting `esc`
   from inside `missionCard` would leave this sink's hash unchanged.
5. **Human decision:** this row is not fixed by re-keying. Decide whether an override may cite a
   helper body at all, given the key cannot reach it — this is directive 022 §6's ruling applied to a
   concrete row. Until then the override should not be reinstated on this justification.

#### B2 · `apps/business/js/waitlist.js:45` — `dom_api_safe` → `unsafe`

Hash `0327998ad65e` → `86f84d6861ae`.

1. **Full corrected expression:** 1,574 chars — JSON row 5.
2. **Covered:** chars 0–1,414. Cut point:
   `…<div class="wl-queue">\n      ${queue.length?queue.map((w,i)=>wlCard(w,i)).join(''):\``
3. **Outside:** 160 chars (10%), 1 interpolation opening, `icon('checkCircle',{size:38})` — a static
   empty-state block.
4. **Note (verbatim):**
   > «wlCard(w,i) از قبل esc(w.name) داشت — بررسی شد.»

   **Does it describe what the key protected? No.** Measured: `esc(w.name)` appears nowhere in this
   expression. `wlCard` itself is in the covered region, but only as a call — its body is not hashed.
   Same class as B1.
5. **Human decision:** same as B1. Note that the tail here is genuinely inert (a static empty-state),
   so the *truncation* cost nothing on this row — the defect is entirely the helper-body citation.

---

### CLASS A — the note's evidence sat past the truncation point

#### A1 · `apps/company/js/badges.js:21` — `dom_api_safe` → `review`

Hash `f65ffcf1d105` → `951c06698587`. This is the sink the CEO used for the falsifiability injection.

1. **Full corrected expression:** 1,791 chars — JSON row 6.
2. **Covered:** chars 0–474 only. Cut point:
   `…${icon('plus',{size:14})} نشانِ جدید</button>\n      </div>\n      ${BADGES_LIST.length?\``
3. **Outside:** 1,317 chars — **74% of the sink** — 16 interpolation openings, containing
   **`esc` × 9** and `icon` × 2. Every `esc()` in this template is in the unseen region.
4. **Note (verbatim):**
   > «BADGES_LIST.map از قبل esc(b.name)/esc(b.description)/... داشت — بررسی شد.»

   **Does it describe what the key protected? No — 3 of 3 claims are tail-only.** Measured:
   `esc(b.name)` TAIL ONLY · `esc(b.description)` TAIL ONLY · `BADGES_LIST.map` TAIL ONLY. The
   override certified a review of text the key could not see, which is exactly why removing one `esc`
   here moved no counter.
5. **Human decision:** re-read the 1,317-char tail on its merits and decide whether all 9 `esc()`
   calls cover every API-supplied field, then re-key to `951c06698587`.

#### A2 · `apps/company/js/missions.js:21` — `dom_api_safe` → `review`

Hash `3b88af950f9f` → `65d2c43d791b`.

1. **Full corrected expression:** 1,574 chars — JSON row 9.
2. **Covered:** chars 0–412. Cut point:
   `…${icon('plus',{size:14})} ماموریتِ جدید</button>\n      </div>\n      ${MISSIONS_LIST.length?\``
3. **Outside:** 1,162 chars (74%), 15 interpolation openings, `esc` × 4, `fa` × 3, `icon` × 2, plus
   one bare `${m.status}`.
4. **Note (verbatim):**
   > «MISSIONS_LIST.map از قبل esc(m.title) داشت — بررسی شد.»

   **No — 2 of 2 claims are tail-only.** `esc(m.title)` TAIL ONLY · `MISSIONS_LIST.map` TAIL ONLY.
5. **Human decision:** the note vouches for `m.title` only; the tail also interpolates `m.status`
   bare. Decide whether `m.status` is a server-controlled string, and re-key.

#### A3 · `apps/business/js/crm.js:136` — `dom_api_safe` → `review`

Hash `12cae07d62d0` → `c8e90d5259c3`. **The worst coverage ratio in the set.**

1. **Full corrected expression:** 3,926 chars — JSON row 3.
2. **Covered:** chars 0–208. Cut point:
   `…style="background:${logoPhoto?'transparent':RESTAURANT.logoGradient}">\n        ${logoPhoto?\``
3. **Outside:** 3,718 chars — **95% of the sink** — 30 interpolation openings, `esc` × 5, `fa` × 2,
   `icon` × 9, and bare `${logoPhoto.status}`, `${g.emoji}`, `${i}`, `${i}`.
4. **Note (verbatim):**
   > «کارتِ هویت: RESTAURANT.name با esc() می‌گذره (تنها فیلدِ API)؛ logoEmoji/logoGradient فقط از پیکرِ محلی ست می‌شن (crm.js:274-275 ← pickLogoEmoji/pickLogoGrad)، هرگز از پاسخِ سرور؛ logoPhoto.url و statusLabel هم esc دارن؛ GALLERY.indexOf عدد است.»

   **No — 5 of 6 claims are tail-only.** Measured: `esc(RESTAURANT.name)` TAIL ONLY · `logoEmoji`
   TAIL ONLY · `logoGradient` **covered** · `esc(logoPhoto.url)` TAIL ONLY · `statusLabel` TAIL ONLY ·
   `GALLERY.indexOf` TAIL ONLY. The note's claim that `RESTAURANT.name` is «تنها فیلدِ API» is a claim
   about a 3,926-char expression made while the key held 208 chars of it.
5. **Human decision:** this row needs a genuine full read, not a re-key. In particular decide
   `${g.emoji}` and `${logoPhoto.status}`, which the note does not mention at all.

#### A4 · `apps/business/js/menu.js:674` — `dom_api_safe` → `review`

Hash `cbbe45f8aea6` → `7e2aa5f93d40`. **The shortest covered prefix in the set: 52 chars.**

1. **Full corrected expression:** 2,337 chars — JSON row 4.
2. **Covered:** chars 0–52 — literally `.innerHTML = \`\n    ${groups.length ? groups.map(g=>\``
   and nothing more.
3. **Outside:** 2,285 chars — **98% of the sink** — 19 interpolation openings, `esc` × 3, `jsq` × 8,
   `fa` × 2, plus bare `${g.id}` twice.
4. **Note (verbatim):**
   > «گروه/آپشنِ افزودنی‌ها: esc(g.name)/esc(o.name) رویِ متن، jsq(itemId)/jsq(g.id)/jsq(g.name) داخلِ onclick، و fa(min_select)/fa(max_select) رویِ اعداد — هر مسیرِ دیتا پوشش داره.»

   **No — 5 of 7 claims are tail-only, and 2 are not in the expression at all.** Measured:
   `esc(g.name)` TAIL ONLY · `esc(o.name)` TAIL ONLY · `jsq(itemId)` TAIL ONLY · `jsq(g.id)` TAIL ONLY
   · `jsq(g.name)` TAIL ONLY · `fa(min_select)` **not found** · `fa(max_select)` **not found**.
   The closing claim «هر مسیرِ دیتا پوشش داره» — every data path is covered — was keyed to 52 characters.
5. **Human decision:** full read required. Resolve the two bare `${g.id}` interpolations, and
   establish where `fa(min_select)`/`fa(max_select)` actually live, since they are not in this sink.

#### A5 · `apps/customer/js/features/loyalty.js:69` — `dom_api_safe` → `review`

Hash `bcaa1558aca0` → `6ebcac270f88`. The row the CEO flagged in advance; confirmed.

1. **Full corrected expression:** 3,089 chars — JSON row 2.
2. **Covered:** chars 0–2,529. Cut point:
   `…<div class="perks reveal">${PERKS.map(p=>\``
3. **Outside:** 560 chars (18%), 9 interpolation openings, `esc` × 2, `icon` × 1 — this is the
   `badges.map` block.
4. **Note (verbatim, abridged here — full text in the JSON):**
   > «… بازبینیِ تازه، با شمارشِ **هر** درجِ پویا در بلاکِ :69-103 (نه نمونه‌برداری): esc() روی tier.name، tier.emoji، b.name، b.emoji، progress_pct … هیچ مقدارِ API‌ای بدونِ esc نمانده. … ⚠️ محدودیتِ کلید: به عبارتِ این بلاک بسته است. **هر درجِ تازه‌ای در :69-103 کلید را باطل می‌کند** و گیت دوباره بازبینی می‌خواهد — که همان رفتارِ درست است.»

   **Partly — 3 of 9 claims are tail-only, and the stated *guarantee* is false.** Measured:
   `esc(tier.name)` covered · `esc(tier.emoji)` covered · `esc(progress_pct)` covered ·
   `fmtFa(points)` covered · `nextLine` covered · `PERKS` covered · **`esc(b.name)` TAIL ONLY** ·
   **`esc(b.emoji)` TAIL ONLY** · **`b.earned` TAIL ONLY**.

   The note claims it counted *every* dynamic insertion in `:69-103` rather than sampling — and the
   three it names last are the three the key could not reach. Worse, its explicit limitation warning
   («هر درجِ تازه‌ای در :69-103 کلید را باطل می‌کند») is **the opposite of what the mechanism did**:
   the key ended at char 2,529, so an insertion after that point would *not* have invalidated it.
   This is a stated guarantee the mechanism did not provide — the class the CEO asked me to flag.
5. **Human decision:** re-read `badges.map` only (the tail), since the covered two-thirds were
   genuinely reviewed, then re-key — **and decide whether the note's limitation sentence should be
   rewritten before it is carried forward**, because a future reader will otherwise inherit a false
   guarantee a second time.

#### A6 · `apps/company/js/intelligence.js:22` — `dom_api_safe` → `review`

Hash `11f2da47d260` → `2b1af64528a8`.

1. **Full corrected expression:** 3,418 chars — JSON row 7.
2. **Covered:** chars 0–807. Cut point mid-ternary:
   `…:d.guests.measured_guests!=null&&d.guests.measured_guests<d.guests.total?\``
3. **Outside:** 2,611 chars (76%), 15 interpolation openings, `esc` × 2, `fa` × 5, `fnl` × 1 —
   three large `.map()` blocks: `rfm_distribution`, `behavior_segments`, `top_restaurants_by_value`.
4. **Note (verbatim):**
   > «fa(d.guests.total_clv_toman) + rfm_distribution.map — اعداد/توابعِ trusted.»

   **No — 1 of 2 claims is tail-only and the other is misquoted.** Measured: `rfm_distribution.map`
   TAIL ONLY · `fa(d.guests.total_clv_toman)` **not found** — the source calls
   `fnl(d.guests.total_clv_toman)`, not `fa(...)`. The note names two things: one the key never saw,
   one under a wrong function name.
5. **Human decision:** full read of the three map blocks. `top_restaurants_by_value` and
   `behavior_segments` are not mentioned in the note at all and interpolate restaurant-supplied
   values.

---

## 4. The six `escaped` → `review` sinks

No override ever existed on these. The classifier read a prefix and returned `escaped`; with the full
expression it returns `review`. Three are app sources and three are their standalone twins.

#### E1 · `apps/customer/js/waitlist.js:61` + E2 · `standalone/customer.html:2458` *(identical twins)*

Hash `ce542bc538c1` → `d4a2e6ab0f65`. **The sharpest row in this group.**

1. **Full corrected expression:** 626 chars — JSON rows 12 and 15.
2. **Covered:** chars 0–387, ending at
   `…هیچ چیزی ثبت نشد — وقتی اینترنت وصل شد دوباره تلاش کن.</div>\n      ${retryCall?\``
   The covered region contains `${esc(msg)}` — which is why it classified as `escaped`.
3. **Outside:** 239 chars (38%), 1 interpolation opening, **no escaping helper**, one bare
   identifier: **`${retryCall}` interpolated directly into an `onclick` attribute**:
   ```html
   <button class="btn btn-primary btn-lg btn-block" style="margin-top:18px" onclick="${retryCall}">
   ```
4. **No override, so no note.** Provenance, measured rather than assumed: `retryCall` is the second
   parameter of `wlError(msg, retryCall)` (`apps/customer/js/waitlist.js:58`). Both current call sites
   pass a developer-authored string:
   - `:81` — `` `joinWaitlist('${esc(String(id))}')` `` (dynamic part wrapped in `esc`)
   - `:199` — `'acceptWL()'` (literal)
5. **Human decision:** `${retryCall}` enters an event-handler attribute unescaped by construction; it
   is currently safe only because both callers happen to build it safely, and nothing enforces that.
   Decide whether that caller discipline is acceptable or whether the sink must escape it. This is the
   same shape as class B — safety living outside the expression — but here it was never reviewed at
   all, because the classifier called it `escaped` on the strength of an `esc()` earlier in the string.

#### E3 · `apps/customer/js/data/booking.js:373` + E4 · `standalone/customer.html:2989` *(identical twins)*

Hash `f67d5212799b` → `23aebe67e9d0`.

1. **Full corrected expression:** 1,122 chars — JSON rows 11 and 16.
2. **Covered:** chars 0–620, containing `esc(r.n)`, `esc(bk.date)`, `esc(bk.time)`, `esc(code)`,
   `jsq(code)`. Cut point: `…⧉ کپی کد</button></div>\n      ${(r.cb>0)?\``
3. **Outside:** 502 chars (45%), 1 interpolation opening, `fmtFa` × 1 — the conditional `reward-row`
   block, whose only dynamic insert is `${fmtFa(r.cb)}` (a number formatter).
4. No override, no note.
5. **Human decision:** confirm `fmtFa` is numeric-only and that the reward block introduces no other
   insert, then decide whether this returns to `escaped` or needs a real change. Low cost.

#### E5 · `apps/business/js/menu.js:213` + E6 · `standalone/business.html:6376` *(identical twins)*

Hash `5c695df0744c` → `2ac12446a42a`.

1. **Full corrected expression:** 1,280 chars — JSON rows 13 and 14.
2. **Covered:** chars 0–553, containing `${esc(b.menu_accent || '#2563EB')}`. Cut point:
   `…<option value="">پیش‌فرضِ رزرونو</option>\n      ${themes.map(t=>\``
3. **Outside:** 727 chars (57%), 8 interpolation openings, **`esc` × 5** — the `themes.map` and
   `layouts.map` option lists plus `${esc(b.menu_tagline||'')}`.
4. No override, no note.
5. **Human decision:** the tail is escaped throughout on inspection; confirm `BRAND_THEME_LABEL` /
   `BRAND_LAYOUT_LABEL` lookups cannot yield unescaped markup, then decide `escaped` vs a change.
   Low cost.

---

## 5. What I did NOT verify — do not read these as cleared

- **No security verdict is expressed anywhere in this file.** Rows say what is covered and what is
  not. Whether any row is exploitable is the CEO's and the reviewer's call, not mine.
- **I did not run the audit tool.** No `--check`, no artifact regeneration, no `report-gate-status.mjs`.
  Every classification and hash quoted here is read from the two committed artifacts; every expression
  is reproduced by a harness gated on matching those committed hashes.
- **Whether `standalone/` is generated from the app sources or hand-maintained.** §2.2 shows the four
  pairs are byte-identical *today*; I did not find a build step that guarantees they stay that way.
  This determines whether fixing an app row also fixes its twin, so it needs an answer before the
  pairs are closed together.
- **The other 55 `unsafe` → `review` transitions.** Out of ORDER-001's scope; they are the bulk of the
  gate's red and nobody has been assigned to them.
- **`extractInterpolations` semantics.** I used it only for the app-row offsets and stopped relying on
  it for tails once it mis-split `menu.js:674`. Tail figures come from direct scanning.
- **Anything on `audit/launch-hardening`** and anything in the `relay-wt` worktree. Untouched, as ordered.
- **`demo-mvp`**, the other `report_only_path`. Not examined; no row in this set falls there.

---

## 6. What I noticed that nobody asked about

1. **`scope|file|line` is not a unique key for this artifact, and both the CEO and I used it.**
   448 entries collapse to 447 keys. The collision is `report_only_hits|standalone/website.html|4750`
   — two distinct `innerHTML` sinks on one line of a minified React bundle, hashes `024aeae53e20`
   (`review`) and `5db19ecfbb8f` (`safe_static`). Neither carries a note and neither changed
   classification, so no count in this exchange was affected. But a future diff keyed that way will
   silently drop one row, and it will drop it from the minified bundle where nobody would notice.
2. **`apps/business/js/chat.js:10` defines `chatEsc`, a second escaper with no test.** Carried forward
   from the CEO's §7.4 because it survives this fix untouched: fixing the extractor does not give
   `chatEsc` a test. `grep -rn chatEsc api/tests/` → no output, while `esc` has `api/tests/esc.test.mts`.
3. **Two of the ten dead overrides (class B) are not repaired by re-keying at all.** They cite helper
   bodies. If they are re-keyed as part of clearing the red, the gate goes green while the same
   unreachable-justification defect directive 022 §6 identified stays in the tree. That is the one way
   this queue could be worked through and leave things worse than before.
4. **`audit/round-21/` was untracked in the main working tree** — two files covered by no gate,
   byte-identical to their committed versions on the branch. Reported to the CEO, who verified it
   independently and removed the copies. Recorded as a ruled-out hazard, not a finding.

---

## 7. Reproduction

```sh
export PATH="/c/Program Files/nodejs:$PATH"
git show 63447e2^:tools/xss-sink-audit-report.json > artifact-old.json
git show 63447e2:tools/xss-sink-audit-report.json  > artifact-new.json
# compare BOTH populations: hits AND report_only_hits
```

Scripts used (scratchpad, read-only, not committed): `build-harness.mjs` (copies the pure functions
out of each tool revision), `final-extract.mjs` (16 rows + fidelity gate), `claims-vs-reach.mjs`
(field 4 membership tests), `verify-both-scopes.mjs`, `find-collision.mjs`. All contain regex and were
written with a file tool, never a heredoc, per the standing rule — one `node -e` attempt in this
session did have its backslashes eaten by the shell, which is the rule earning itself again.

**Submitted for the CEO's judgement. Nothing here is closed.**
