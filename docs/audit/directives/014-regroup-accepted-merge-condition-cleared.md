# Directive 014 — Regroup accepted; merge condition cleared with one open row; the sibling pattern is now three-for-three

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent

---

## 1. Regroup accepted — invariant verified by me

```text
git diff 2c7d059 HEAD --stat
  docs/audit/reports/CEO-ROUND20-OPEN-2026-09-04.md | 301 ++++++++++
  1 file changed, 301 insertions(+)

git rev-list --count origin/audit/launch-hardening..HEAD  →  24
git rev-list --count origin/main..HEAD                    →  56
```

Exactly one file differs, by 301 lines of the CEO's own later appendices. **Every line of code and
all twelve moved documents are byte-identical to pre-regroup.** Six commits, each message true of its
contents. Ref discrepancy resolved: both figures were right against different refs, which is why
neither should have been quoted bare.

**Reporting it as "one file differs, by my own later writing" rather than as "empty" is the right
call and I want it on the record.** An invariant that is 99% satisfied is not satisfied, and rounding
it up while fixing this exact class would have been the class again.

**The failed first attempt is the more valuable half.** Directory globs swept in two uncommitted
changes that were never in the original four commits, and the invariant caught it — two files, 315
insertions instead of empty. So: the agent swept a pre-staged index, and the CEO swept an unstaged
working tree, an hour apart, by the person ruling on it. The reason it did not ship is that the check
had a **visible failure mode**. "Must be empty, if not, stop and restore from reflog" is a gate;
"be careful with staging" would have been a comment, and comments have no enforcement power. That is
the whole thesis of this repo demonstrated on itself inside one hour.

## 2. Retry and isolation in one commit — accepted, and it is better than the split I asked for

You flagged this as a constraint you could not honour. I think it is an improvement, not a compromise.

The property that matters is that **no point in history ships isolation without retry.** Two commits
satisfy that only in one ordering and violate it in the other; one commit satisfies it
unconditionally. And reviewability is a property of the *review*, not only of the commit boundary —
the PR body can present the two changes separately, and `git show bead689` can be read in two passes.
The loss is small and fully mitigable; the guarantee is now structural. Do not spend effort splitting
it.

## 3. Merge condition CLEARED — with one open row

My directive 013 §3 condition was that the panel must present a **clearly retryable** failure. It
does. Verified:

- `errors.ts:46` — `CONCURRENCY_RETRY`, «به دلیل ترافیک بالا رزرو ثبت نشد؛ لطفاً دوباره تلاش کنید»,
  409. The text itself instructs a retry.
- `reservations.js:398` toasts `res.error?.message`, `:399` re-enables the button, and `closeModal()`
  runs **only on success** — so the modal stays open with a live button under the host's finger.

**The affordance clears my bar and I am not blocking the merge on the toast.** Blocking a fix for a
4-in-6 live double-booking over a 2.4-second toast would be disproportionate.

## 4. But the panel cannot tell two *opposite* errors apart — open row, cheap fix

`grep -rn "CONCURRENCY_RETRY\|TABLE_CONFLICT" apps/business/js/` returns **nothing**. The panel takes
`res.error?.message` verbatim and toasts it. So two 409s that demand **opposite host actions** look
identical:

| Error | What the host should do |
|---|---|
| `CONCURRENCY_RETRY` | Press the same button again — **the table is fine** |
| `TABLE_CONFLICT` | The table is genuinely taken — **pick a different table** |

Identical presentation trains one reflex for two opposite situations. A host who learns "red means
press again" will press repeatedly against a real `TABLE_CONFLICT`, conclude the app is broken, and
seat off-system. A host who learns "red means pick another table" will needlessly move a party on a
transient conflict. **Both roads end where directive 012 §8 said they end.**

Second-order: the fallback is `res.error?.message || 'ثبت ورود ناموفق بود'`. If the server message is
ever absent, the host sees "check-in failed" with a live button and no hint that retrying is the right
move — the affordance survives, the instruction does not.

**Directive:** distinguish the two codes in `apps/business/js`. `CONCURRENCY_RETRY` gets a persistent
inline state in the modal saying to try again; `TABLE_CONFLICT` says the table is taken. Cheap,
reversible, and it does not block this PR.

## 5. The sibling pattern is now three-for-three, in one day

This is the same shape as directive 008 §3, where `apps/company/js/api.js` collapsed "offline" and
"answered but unparseable" into one state. **A UI state that presents one label where two distinct
causes exist**, and both instances are in a panel.

Three occurrences today of *class fixed in one place, left in its sibling*:

| Fixed | Left unfixed | Directive |
|---|---|---|
| `createReservation` occupancy check | `createWalkin` | 005 |
| `api.js` discover-feed empty-vs-unreachable | `live-strip.js` | 006 |
| `company/api.js` offline-vs-unparseable | `business/js` retry-vs-conflict | this one |

Three independent instances, three different subsystems, one day. That is no longer a coincidence —
it is the strongest possible argument for the pair sweep you proposed, and it should go to the founder
with these three rows as the evidence rather than as an abstract proposal. The sweep is not
speculative work; it is cleanup of a pattern that has produced a finding every time anyone looked.

## 6. Unchanged and still open

The waitlist at 12/12 remains the worst known live defect, correctly unfixed, swallowed catches first.
The 6-way retry-exhaustion cost is in the PR body as a trade and stays an open row. F1 still blocks
the PR. I have not run the full suite and am not quoting a number for it.
