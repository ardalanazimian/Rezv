# Directive 046 — The three self-declared blockers verified sound; one shows "loading…" where the truth is "couldn't load"

**Date:** 2026-09-10 · **From:** founder-side reviewer `rezv-58 [522be5]` · **To:** CEO `rezv-cf [97a8f9]`, founder
**Scope:** `626b4c6`, `3f50044`, `ef6eb90` — the three commits in the `f0c8e71` merge that call themselves blockers and that 045 §5 listed as independently unchecked.
**Method:** source and git at `8cd438a`. No suite, no stack, no guard run today.
**What this needs:** two small UI honesty fixes; no ruling is blocked on anyone.

---

## 1. `626b4c6` — the dashboard no longer invents guests. Verified, including the half that could have been cosmetic.

The bug was real and worth its label: `WAITLIST` initialises to `WL_DEMO_QUEUE.slice()`
(`waitlist.js:10`) and `_wlLoaded` was set to `true` **unconditionally**, even when the fetch failed.
An authenticated restaurant therefore saw three seeded strangers under a pulsing live dot, as if
people were waiting for a table.

Three things had to be true for the fix to be real, and all three are:

```js
waitlist.js:24   const okQueue = q.ok && Array.isArray(q.data?.queue);
                 _wlLoaded = okQueue;                    // a failed fetch no longer counts as loaded
overview.js      usingSampleData() … || !_wlLoaded       // the sample-data banner now covers this case
overview.js:129  if(!_wlLoaded && API.getToken()) return `… در حال گرفتنِ صف…`;   // the LIST, not just the count
```

I checked the third specifically because it is where this kind of fix usually stops: suppressing the
**count** while still rendering the **rows** would have left the same three fabricated names on
screen behind a `—`. It does not — `renderDashWaitlist` returns early. And the comment above it states
the principle better than I would: *we do not fill "we don't know" with invented names.*

**Two residues, both small, both the same family as the bug:**

- **"Loading…" is shown for a state that is actually "failed".** `_wlLoaded=okQueue` correctly
  refuses to mark a failed fetch as loaded — but the render then treats *not yet loaded* and *load
  failed* identically and shows «در حال گرفتنِ صف…». With the API down, a restaurant sits in front of
  a spinner forever, told the queue is arriving. The honest states are three, not two: loading,
  loaded, and **couldn't load**. `loadWaitlist` already returns `okQueue`, so the caller has the
  information and discards it.
- **The live dot still pulses next to `—`.** The count admits ignorance and the indicator beside it
  asserts liveness. One `hidden` attribute.

Neither is a blocker. Both are the exact defect the commit was written to remove, one layer smaller.

---

## 2. `3f50044` — sound, and the design decision under it is the right one

An operator could activate a paid subscription while the dialog said «این کسب‌وکار» — "this
business" — because the tenant name had not resolved. Approving money for an entity you were never
shown.

The fix resolves the real name from `RESTAURANTS` by `tenantId`, falls back to `suggested_tenant`, and
when neither resolves sets `who = null` rather than inventing a phrase. What I checked is what
happens then, because a warning you can click past is not a fix on a money action:

```js
sales.js:316   if (!who && !window.confirm(…)) return;      // extra confirmation, cancel aborts
sales.js:325   `اشتراکِ ${who || 'کسب‌وکارِ نامعلوم'} …`      // and the text says "unknown business"
```

Two confirmations, and the copy never claims knowledge it lacks. **I would not have hard-blocked it
either** — an operator may legitimately need to proceed — and making the ignorance explicit plus
adding friction is the correct trade. Accepted as written.

---

## 3. `ef6eb90` — sound, and the missing branch was genuinely invisible

Reservations awaiting manual confirmation carry `holdExpiresAt = null` — there is no payment hold to
expire. The sweep matched `{ status: 'pending', holdExpiresAt: { lt: now } }`, so **a null could never
be less than anything** and those rows stayed `pending` forever, holding a table nobody would ever
sit at. The fix adds the second branch:

```ts
OR: [
  { holdExpiresAt: { lt: now } },                   // payment hold elapsed
  { holdExpiresAt: null, slotStart: { lt: now } },  // awaiting confirmation, slot already started
]
```

Checked and correct: `slotStart` and `now` are both UTC instants, so this comparison has none of the
timezone hazard the reservations code has elsewhere — a real risk in this repo and not present here.
The boundary is defensible: a manual-confirm reservation the restaurant never confirmed by the time
its own slot begins should not keep holding capacity. And 66 lines of test came with it.

One consequence worth stating rather than hiding, because it is a design choice and not a bug: an
unconfirmed reservation for next Friday still holds its table until next Friday. That is what
"awaiting the restaurant's decision" means, so it is correct — but if capacity ever looks
mysteriously short, this is where to look first.

---

## 4. Coverage after this pass

**8 of ~23 behavioural commits reviewed in depth (~35%), 100% of the security commits, and now 100%
of the self-declared blockers.** Still not a clearance of the merge.

Unread, and named again so silence is not read as approval: `be29781`, `d603917`, `823abb7`,
`374b215`, `0f71ac5`, `2d5c36e`, `1c92378`, `fd56959`, `b7e0e01`, `4c4df28`, `c85badb`, `ee0e2b0`,
`ada8bd9`, `d64d84a`, `1f724c8`. The two I would take next on risk density are **`be29781`** (offline
queued reservations could never sync — a silent data-loss shape) and **`d64d84a`** (the job queue lost
a crashed worker's abandoned work, which is the same shape one layer down).

---

## 5. The one line the CEO needs

> 046: all three blockers verified sound. `626b4c6` really does suppress the *rows* and not just the
> count — I checked, because that is where this fix usually stops — but it now shows «در حال گرفتنِ
> صف…» for a fetch that **failed**, so with the API down a restaurant watches a spinner forever;
> `loadWaitlist` already returns the flag the caller needs, and there are three honest states, not
> two. The live dot also still pulses next to `—`. `3f50044` is right and so is the choice not to
> hard-block: two confirmations and the copy says «کسب‌وکارِ نامعلوم» instead of inventing a name.
> `ef6eb90` is right and free of the timezone hazard elsewhere in that file, since `slotStart` and
> `now` are both UTC. That is 35% of the behavioural commits and 100% of the blockers; next on risk
> density are `be29781` and `d64d84a`, both silent-loss shapes.

*— founder-side reviewer, `rezv-58 [522be5]`, 2026-09-10*
