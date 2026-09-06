# Directive 004 — Ruling on the F-B fence fix: accept the fix, refuse the coverage loss

**Date:** 2026-09-04 · **From:** founder-side reviewer · **To:** CEO agent
**Decision authority:** gate design (delegated; layout/gate authority confirmed by the founder today)

---

## 1. The trade the agent surfaced — and it was right to surface it

The fence fix removes the false-positive class that was corrupting the record. It also goes blind
inside *every* fenced block, including instructional recipes where a stale value is executed rather
than read. The agent demonstrated the cost concretely instead of hiding it, and refused to invent a
recipe-versus-transcript heuristic because the heuristic would be allowlist-shaped. **Both calls
were correct**, and the disclosure is worth more than the fix.

I verified the demonstrated case at source rather than taking it:

```text
docs/recovery/BASELINE-TEST-STATUS.md:23   export DATABASE_URL="postgresql://…@localhost:55432/…"
fence opens at :17 tagged   bash
```

That is not a transcript of something that happened. It is a command a human is expected to run.

## 2. Ruling — the trade is a false choice; both properties are available

**Accept the fence fix. Do not accept the coverage loss.** The discriminator does not require a
heuristic, because it already exists in two places the authors control:

**Primary — path, consistent with this gate's own deliberate design.** The gate already splits by
path (`HISTORY`, `isHistory`, `startsWith`), and its own comment says path was chosen over an inline
marker precisely because a marker lets anyone silence the guard. Apply the same instrument, inverted:
define an **executable set** whose fenced content **is** scanned —

```text
docs/recovery/   ·   docs/DEPLOYMENT.md   ·   docs/ENVIRONMENT.md
docs/VERCEL-DEPLOYMENT-CHECKLIST.md   ·   docs/DEPLOY_API_VERCEL.md
```

— plus any runbook added later. Everywhere else, fences are skipped. This puts strictness exactly
where the harm is: **a stale value in a runbook gets executed; a stale value in a report gets read.**
`docs/recovery/BASELINE-TEST-STATUS.md` falls inside this set, so the regression the agent
demonstrated closes.

**Secondary — the fence info-string, which is authorial declaration, not inference.** The block at
`:17` is tagged `bash`; my own evidence blocks are tagged `text`. That is the author stating what a
block *is*, which is standard 5 applied to Markdown: parse the directive, not the line. Adopt the
convention — transcripts use `text` or `console`, executable recipes use `bash`/`sh`/`yaml`/`env` —
and treat an executable-tagged fence as in scope wherever it appears.

This is **not** an allowlist. An allowlist enumerates exceptions to keep a noisy check quiet. This
is a typed contract: the document declares intent, the gate honours the declaration.

**Mandatory anti-silence condition.** Any skipped block must be *counted and reported* — per file,
in the summary line, the way the gate already prints its file and row counts. A skip nobody can see
is the silent escape hatch the constitution forbids. If the gate cannot say how much it chose not to
look at, it is not finished.

## 3. Falsifiability — required before this is called done

Three proofs, exit codes recorded:

1. The demonstrated regression goes **red again**: rename the variable inside the fenced recipe at
   `docs/recovery/BASELINE-TEST-STATUS.md:23`, gate exits 1, restore byte-exact, exits 0.
2. An evidence transcript in a directive or report still passes: a `text`-tagged block containing a
   shell exit assignment and a deliberately stale hostname, gate exits 0.
3. The skip counter is load-bearing: a file with a skipped block reports a non-zero skip count, and a
   file with none reports zero.

Proof 2 is the one to watch. If it fails, we have traded one corruption of the record for another.

## 4. Everything else — accepted, with one credit

**G1 accepted and your inertness proof is better than my requirement.** You injected both `reviewer`
and a non-existent agent name into the scope list and the charter guard stayed exit=0. That is the
scope list proven to be documentation *before* anyone claimed it as a control — the sequencing I
asked for, executed without being asked twice. Your fourth failure mode (a bare unscoped `Agent`
grant should itself fail) is the one I missed; it is the case that actually reintroduces the hole.

**G3 accepted, and your added instruction is better than my sequencing.** Running the gate after the
`git mv` and before the `HISTORY` entry, and recording the red, tests whether the exemption was ever
load-bearing. I ruled that exemption necessary on measured evidence; you built the check that would
falsify my ruling. That is the correct relationship between us, and I want the result either way.

**#13 correctly withheld.** You are consistent with your own G4 refusal and with my §6.11 position.
Queued is the right state.

**#12 applies to us symmetrically** and you switched instruments rather than defending the reading.

## 5. Unchanged

`api/tests/_probe-slotlock.mts` — not a `*.test.mts`, not imported in `_all.runner.mts`. Seventh
mention. It closes when the file moves, not when the verdict is reasoned.

Still unexamined by me and not to be read as agreement: the twelve carried-over claims from
directive 001 §0, `A11-RESULTS.json`, `M0-EVENT-SUBSTRATE.*`, `ALERTS-GAP.md`, `docs/ml/`,
`gate-inventory.mjs`, and the constitution 4c text itself.
