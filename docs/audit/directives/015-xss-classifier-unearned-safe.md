# Directive 015 — No live XSS at the flagged sink; the classifier's verdict is unearned; my disk claim corrected

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** `rezervnofullsource-05`, CEO agent, founder (§4)

---

## 1. `assistant.js:41` — NOT a live vulnerability. Verified by reading every caller.

Session 05 flagged that `assistant.js:41` inserts a bare `html` variable via `insertAdjacentHTML`
and is rated `safe_static`. That is exactly the shape of a live XSS, so I treated it as one until
proven otherwise. It is not one.

`apps/business/js/assistant.js:38-43` is a deliberate HTML-insertion helper. All six call sites:

| Line | Interpolation | Escaped? |
|---|---|---|
| `:51` | `${esc(message)}` | yes |
| `:57` | `${pendingId}` — `'ap' + Date.now()`, internal, numeric | not user-reachable |
| `:65` | static string | n/a |
| `:69` | `${esc(d.answer)}` | yes |
| `:74` | `${chips}` | composed **only** of `jsq(d.log_id)`, `jsq(s.intent)`, `esc(s.label)` |
| `:85` | `${esc(res.data.answer)}` | yes |

`chips` is unescaped at the call site **correctly** — it is intentional markup assembled from
already-escaped fragments. There is no reachable path here. **No emergency, no hotfix, nothing for
the founder to act on.**

## 2. But the finding survives, and it is sharper than "a classifier blind spot"

The sink is safe. **The tool did not establish that — I did, by hand, reading six callers.**

`grabExpression` truncates at the first quote, so for every `insertAdjacentHTML` sink it captures
`.insertAdjacentHTML('beforeend'` and never sees the payload argument. It then rates the sink
`safe_static`.

**`safe_static` is a claim about the inserted content. The tool never looked at the inserted
content.** That verdict is not wrong here; it is *unearned* — and it is unearned identically for all
ten `insertAdjacentHTML` sinks in the repo, only one of which anyone has now actually read.

This is the over-claim class in its most consequential medium yet: **a security classifier's own
output label.** Every previous instance was a comment, a test name, a report headline, a UI state, a
commit message or a reviewer's sign-off. This one is the artifact a future engineer will consult
*instead of* reading the callers — which is the entire purpose of having a classifier. A label that
means "I could not see the payload" must not be spelled the same as one that means "I saw the payload
and it is safe."

**Directive:** the classifier must emit a distinct verdict — `unclassified` / `payload_not_captured`
— wherever `grabExpression` fails to capture the argument. Not `safe_static`. Whether that verdict
counts as gate-failing is a separate decision; making it *visible* is not.

**On not fixing it now:** session 05's reasoning is correct — it moves ten classifications, turns the
baseline red, and closes CI for three concurrent sessions. That is a real sequencing constraint, not
an excuse. But it must be an **owned decision with a date**, not a deferral, because this repo has a
documented four-times-deferred item (`standalone/website.html`) and the pattern is how those start.

## 3. The dead overrides are the bigger finding of the two

**60 of 81 overrides pointed at lines with no sink at all** — `crm.js:89` is a `let` declaration,
`auth.js:209` is a comment. Only 16 were being applied. The manual-review layer was largely fiction,
and the baselines had absorbed it, so nothing was red.

Refusing to script-delete or script-replace them is the right call and I want it recorded as a
decision: **re-placing a security review is human work, and a script that guesses would manufacture
precisely the false assurance being removed.** Under identity keying a stale `path:line` key can
never match a `path#hash` lookup, so they are inert rather than dangerous, and printing the count
every run means the number cannot quietly rot again.

The reproduction of direction two before fixing it — replacing line 49 with
`location.hash + document.referrer`, unchanged line number, and watching it inherit the previous
sink's review at `EXIT=0` — is the standard this repo asks for and rarely gets. It proves the
fail-open rather than arguing it.

## 4. Correcting my own disk claim to the founder

I reported the disk as **100% full, 0 bytes available**, and said every green from this machine was
suspect. Correcting precisely:

```text
when I measured   C:  119G  119G     0  100% /c     ← and I hit a real ENOSPC
now               C:  119G  119G   97M  100% /c
```

**My measurement was accurate when taken and my ENOSPC was real.** Session 05 measured 113MB at a
different moment and was also right. The disk is oscillating within ~100MB of zero on a 119GB volume,
which is why we got different readings minutes apart and why neither of us was wrong.

**What I overstated:** "every green is suspect" was broader than the evidence. Session 05 re-ran all
ten gates after confirming writability and got 10/10 — that is the right response to my challenge and
it answers it.

**What still stands:** ~97MB free is not a working margin. It will hit zero again under any container
run, test suite, or build, and when it does the failure will not look like a disk problem. **The
recommendation to the founder is unchanged and it is his to act on** — nobody here should run
`docker prune` unilaterally, which all three sessions have independently agreed on.

## 5. Cross-session note

Three sessions are now writing to this repository. Session 05 named exactly which files it touched
and which it did not, and corrected a misattribution of its own unprompted. That discipline is the
only reason three concurrent writers is survivable, and it should be the standing expectation rather
than a courtesy.

---

## 6. Directive discharged — and the sixth sink verified at the server, not accepted

`extractRhs` root fix landed in `4cf7e20`, six days inside the deadline. Three defects behind one
symptom, the third only visible after fixing the first — a paren counter that did not understand
strings or templates, hiding behind an unreachable paren-balancing branch. Fixing one gap exposed the
gap behind it, which is the honest shape of most real repairs.

**The sixth sink — `apps/business/js/waitlist.js:422`, a `document.write`, not an
`insertAdjacentHTML`.** Their verdict was "safe". I verified the chain at the server rather than
taking it:

| Step | Source |
|---|---|
| Client injects raw | `waitlist.js:322` — `_tableQrSvg = res.data.svg`, rendered at `:330` |
| Tenant isolation from auth context | `tables/[id]/qr/route.ts:51` — `if (!table \|\| table.restaurantId !== ctx.restaurant.id) throw Err.notFound` |
| Code is server-assigned | `:53` — `table.qrCode ?? await assignQrCode(id, ctx.restaurant.id)` |
| URL is server-built | `:54` — `tableCheckInUrl(code)` |
| SVG is library output | `:56` — `QRCode.toString(url, { type: 'svg' })` |

**Safe, and for two independent reasons**: no user-controlled string reaches the URL, *and* the
qrcode library's SVG is path geometry rather than embedded text, so even a hostile URL could not
carry markup into the document. Verdict confirmed — this time earned rather than asserted.

**The finding that outlives the sink.** All three of us missed it, and we missed it the same way: we
were all looking at `insertAdjacentHTML` because that is where the first instance was found. The
truncation defect was never specific to that sink kind — it was a property of the extractor, and
`document.write` was subject to it the whole time. **Fixing a class by the shape of its first
instance leaves the rest of the class standing.** That belongs in the ledger beside the class itself,
because it is how a genuine class fix still ends up partial.

**Removing the dated fence is correct.** It existed to stop a fifth deferral; the fix landed, so it
guards nothing, and a baseline of zero is strictly stronger — it fires the moment any uncaptured
payload reappears, without waiting for a date. Leaving it would also have made its own text false,
which is the class one more time.

## 7. The hole they recorded rather than half-fixing — my ruling

**Overrides pin the sink line, not the helper body.** If `esc` is removed from inside `bubble()`, the
call site is unchanged, its hash is unchanged, and the override still applies. A sink that stopped
escaping keeps a review that was written when it did.

This is the identity-versus-position defect again, one level of indirection deeper. The first fix
moved the key from *position* to *the call's text*. But the property the review actually depended on
lives in the **callee's body**, and the key still cannot see it.

**Ruling: do not chase it with a better hash.** Hashing helper bodies means guessing which function
a call resolves to, which is static analysis by heuristic and will be wrong at exactly the moments
that matter. The right guard is the behavioural one — `tools/xss-escaping-regression.mjs` — which
tests that escaping *happens* rather than that the call site *looks right*.

It cannot currently reach `bubble` / `bizBubble` because neither is exported. **Exporting them for
test access is a legitimate change, not a workaround**: a helper whose correctness is load-bearing
for a security review should be reachable by the test that verifies it. But it is an `apps/business`
source change, owned by other agents, so it is directed rather than done — and recording it instead
of half-doing it was the right call.

**Minor correction for the record:** the disk went from ~88MB to 3.3GB through my cleanup of three
regenerable caches (`_npx`, `_cacache`, `codex-runtimes`), not the founder's action. It reads 3.2GB
now. The founder's two large levers — hibernation at 9.7GB and Docker at 8.3GB — are both still
unspent, and Docker is currently hung rather than idle.
