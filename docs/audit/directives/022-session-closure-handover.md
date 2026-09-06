# Directive 022 — Closure handover: what two sessions leave behind, and one phantom I stopped

**Date:** 2026-09-06 · **From:** founder-side reviewer · **To:** CEO agent, and whoever reads next
**Why this exists:** `rezervnofullsource-05` and `-ed` are stopping. Everything below lived only in
cross-session messages. Once those sessions close, their transcripts are unreachable.

---

## 1. Both sessions verified clean before stopping — and neither could close itself

Both reported the same thing independently and both **verified rather than asserted**: tree empty,
nothing listening on 3000/3001, no background work, nothing in flight. `-05` additionally probed for
connections to `rezervno_branch_verify` — the precise orphan test rather than a general "nothing is
running" — and ruled itself out by construction: it started no server at any point, only `npm test`
and `docker exec`.

**Neither can terminate its own session**, and both refused to improvise one by killing their own
process tree. That refusal was correct: an abrupt self-kill risks leaving exactly the half-dead
process the 44.8-hour port-3000 orphan taught us to avoid. Closing a terminal is the founder's action.

## 2. A phantom obligation, caught before it was handed over

`-ed` handed back what it believed was an orphaned commitment: the `extractRhs` deadline of
2026-09-11, owned by `-05`, which would lose its owner if `-05` closed.

**It does not exist.** Verified:

```text
grep "2026-09-11" tools/*.mjs .github/workflows/ci.yml   → no matches
payload_not_captured across hits + report_only_hits      → 0
4cf7e20  «امنیت: رفعِ ریشه‌ای — طبقه‌بند حالا payload را واقعاً می‌خواند»
```

The root fix landed six days inside the deadline, and `-05` then deliberately removed the fence
because a landed fix makes it guard nothing and a baseline of zero is strictly stronger — it fires
the moment any uncaptured payload reappears rather than waiting for a date.

**A phantom obligation is worse than none**: someone spends real effort guarding a date nobody owes.

## 3. `-ed`'s proof that the fix works is better than mine, and the technique generalises

I checked that `payload_not_captured` is zero. **That is ambiguous** — zero is equally consistent with
"the fix works" and "the verdict was quietly removed."

`-ed` checked the *distribution* instead: the ten `insertAdjacentHTML` sinks were previously one
undifferentiated `safe_static` block and now spread across four verdicts — `dom_api_safe` 6,
`escaped` 1, `review` 1, `unsafe` 2.

**A dropped verdict collapses a set into one bucket. Only a working extractor spreads it.** That
distinguishes the two explanations where my check could not. **Technique worth keeping: when a
verdict disappears, check whether the population it described redistributed or vanished.**

## 4. Two scopes, one artifact — record this or someone will chase a discrepancy that is not there

```text
my count  (hits + report_only_hits)   448   unsafe 145 · dom_api_safe 109 · safe_static 102 · escaped 47 · review 45
artifact's own by_classification      224   enforced scope only
```

**Both are correct.** They count different populations. Written down because a future session
comparing the two would find a 224-row "discrepancy" and investigate a defect that does not exist.

## 5. Two rules from `-ed`, both better stated than I had them

**On the 815 MB it spent on a false premise:** *prove the health of whatever reported the emptiness
**before** taking any compensating action* — a pull, a rebuild, a re-seed. "Empty" and "I don't know"
are not the same answer. It put this in durable memory rather than leaving it in a transcript.

**On the phantom handback:** *trusting a reading past the moment it was taken.* Its information was
accurate when formed and it handed it over as still true. **A measurement carries a timestamp, and
using it later is using a different fact.** That is the same defect as the false zero, in the time
axis rather than the tool axis — and it is the third form of that family this round, after the
recovering-Docker single sample and the instrument-under-modification case.

## 6. The item I am taking, so it does not close with them

**XSS overrides pin the call site, not the helper body.** Remove `esc` from inside `bubble()` and the
call site is unchanged, its hash is unchanged, and the override still applies — a sink that stopped
escaping keeps a review written when it did.

I ruled against chasing it with a cleverer hash: hashing callee bodies means guessing which function
a call resolves to, which is heuristic static analysis wearing a security label. The honest fix is
exporting `bubble`/`bizBubble` so `tools/xss-escaping-regression.mjs` can reach them — an
`apps/business` source change, owned by other agents.

**Owner: me and the CEO, both of whom remain.** Not closed by anything that landed today.

## 7. What `-05` said about closing sessions, which the founder should weigh

> Three findings today were made by someone doing something else, each invisible to the tool that
> owned the area — and we are reducing the number of independent observers for memory pressure.

The redundancy had **measured yield today**: the `document.write` sink, the second `vhdx`, and the
`075→080` staleness were all found by sessions looking at something else. That is a real trade and
the founder should make it knowing the number, not assuming the redundancy was overhead.

## 8. And my own error in this exchange

I relayed the founder's closure decision as though relaying made it actionable. `-05` correctly
treated it as a checkpoint, not an instruction, and said so: *a peer relaying a founder decision is
not the founder speaking.* That is the exact boundary I enforced against the CEO over the
`PreToolUse` remedy, and that `-05` itself held when it refused to edit `CLAUDE.md` on my say-so.
**Closing a session is the founder's direct action and must not arrive through me.**
