# XSS helper-body hole — source verdict + executable proof plan

**Mandate:** T3, directive 022 §6. **Author:** `security` agent. **Date:** 2026-09-07.

**Ref under audit:** `origin/audit/launch-hardening` (not `main` — see §0.2).
Every citation below carries its ref. A bare `file:line` is ambiguous between two real files.

**Execution status: NOTHING IN THIS DOCUMENT HAS BEEN EXECUTED.**
This host has no JavaScript runtime. §1 is a **source-reading verdict**. §2 is the plan that
converts it into an executed one. Every execution-dependent claim is marked `UNKNOWN
(pending-runtime)` with the command that would resolve it.

---

## §0. Environment — why there are no exit codes in this document

### 0.1 Verified absence of a runtime

| Probe | Result | Exit |
|---|---|---|
| `node --version` (Git Bash) | `command not found` | **127** |
| `npm --version` (Git Bash) | `command not found` | **127** |
| `Get-Command node` (PowerShell) | `CommandNotFoundException` | n/a |
| `Get-ChildItem C:\ -Filter node.exe -Recurse -Force` | `NO_NODE_EXE_FOUND_ON_C` (27.6 s) | 0 |
| `wsl --list --verbose` | prints usage — no distro installed | **1** |
| `bun` / `deno` / `podman` / `py` | absent from PATH | n/a |
| `node_modules`, `api/node_modules` | both `False` | n/a |
| `"C:\Program Files\Docker\...\docker.exe" --version` | `Docker version 29.7.2, build a7dcaa6` | 0 |
| `… docker.exe info` | `open //./pipe/docker_engine: The system cannot find the file specified` | **1** |

Required runtime is Node 20 (`node-version: '20'` in the CI jobs). It does not exist here.

**Refinement on the dispatch brief:** `docker` is **not on PATH** — `Get-Command docker` returns
`CommandNotFoundException`; only the absolute path resolves. Any recovery script that shells out to
a bare `docker` will fail with 127 and that 127 means "not on PATH", not "daemon down". This is the
§7 hazard in miniature: two different failures, one indistinguishable exit code.

### 0.2 Ref correction

`git rev-list --left-right --count main...origin/audit/launch-hardening` → `1  32` (exit 0).
The XSS files differ across refs:

```text
.github/workflows/ci.yml         |  24 +++
docs/XSS_SINK_AUDIT.md           |  28 +--
tools/xss-sink-audit-report.json | 404 +++++++++++++++---------------
tools/xss-sink-audit.mjs         |  28 +++
```

**What did NOT change** — and this is what preserves the analysis:
`tools/xss-escaping-regression.mjs`, `apps/business/js/chat.js`, and
`apps/customer/js/features/chat.js` are **byte-identical on both refs** (absent from the diff).

And within the audit tool, only the override *table* moved. Lines 1–476 — every line of the
machinery — hash identically on both refs:

```text
$ git show main:tools/xss-sink-audit.mjs | sed -n '1,476p' | sha256sum
0032cca21a7b5496aa1a791165abb28a4741d3573228647427665a65363f66ee
$ git show origin/audit/launch-hardening:tools/xss-sink-audit.mjs | sed -n '1,476p' | sha256sum
0032cca21a7b5496aa1a791165abb28a4741d3573228647427665a65363f66ee
```

So `sinkHash`, `overrideKeyFor`, `classify`, `grabExpression`, `scanFile` are the same code on both
branches, and every §1 citation is valid on either ref.

---

## §1. Verdict — the hole is REAL (source-reading, not executed)

### 1.1 The subject

`origin/audit/launch-hardening:apps/business/js/chat.js`

- **`:75`** — the sink: `body.insertAdjacentHTML('beforeend', bizBubble(m));`
- **`:82-85`** — the helper `bizBubble(m)`, whose `:84` carries the only escaping:
  `` `…<div>${chatEsc(m.body)}</div>…` ``
- **`:10`** — `chatEsc` is a real escaper over `[&<>"']`.

Symmetric case, `origin/audit/launch-hardening:apps/customer/js/features/chat.js`:
sink at **`:134`**, helper `bubble(m)` at **`:143`**, escaping `esc(m.body)` at **`:145`**.

### 1.2 The chain, one link per line

All citations `origin/audit/launch-hardening:tools/xss-sink-audit.mjs`.

1. **`:666`** — `const expr = grabExpression(text, m.index, scanFrom)`. For a call-form sink the
   extractor balances parentheses (`:98-99`) and returns at the closing `)`. For the `:75` sink that
   terminates on line 75. It never reads line 84.
2. **`:669`** — `snippet` is the sink's **own** line, trimmed, capped at 160 chars.
3. **`:671`** — `overrideKeyFor(relPath, expr, snippet)`.
4. **`:470-472`** — `overrideKeyFor` returns `` `${relPath}#${sinkHash(expr, sourceLine)}` ``.
5. **`:465-468`** — `sinkHash` = `sha256(normalize(expr) + '|' + normalize(sourceLine))`, first 12 hex.
6. **Therefore both hash inputs are drawn exclusively from line 75.** No byte of the helper body
   (`:82-85`) is an input to the key. This is the whole finding.
7. **`:672-673`** — a matching override rewrites the classification to `dom_api_safe`.
8. **`:817` and `:833`** — the ratchet counts only `unsafe` and `review`. `dom_api_safe` is counted
   by neither. The override therefore removes the sink from the gate's arithmetic entirely.
9. **`tools/xss-escaping-regression.mjs:84`** — the behavioural gate imports exactly one module:
   `apps/customer/js/data/discover.js`. **`:96-99`** — it has exactly two cases, `cardHTML` and
   `slotsHTML`. Neither chat module is imported; neither helper is called.

**Conclusion:** deleting the escaping from inside `bizBubble` changes no input to any gate. The sink
line is untouched, so the key still resolves, so the override still fires, so the classification is
still `dom_api_safe`, so both ratchet counters are unchanged. And the behavioural gate never had an
opinion, because it never loads the file.

### 1.3 Independent arithmetic confirmation (not code-reading)

The one step in §1.2 that a reader must otherwise take on trust is #6. It can be checked without a
JS runtime, because the key is just a hash of two strings I can reconstruct from the source:

```text
identity(business) = .insertAdjacentHTML('beforeend', bizBubble(m))
                     |body.insertAdjacentHTML('beforeend', bizBubble(m));
sha256 → first 12  = 7dc23113c97a

identity(customer) = .insertAdjacentHTML('beforeend', bubble(m))
                     |bodyEl.insertAdjacentHTML('beforeend', bubble(m));
sha256 → first 12  = ac1498949c1d
```

Computed with .NET `SHA256` over UTF-8 in PowerShell (no Node). Both match the declared override
keys — `…chat.js#7dc23113c97a` at `tools/xss-sink-audit.mjs:507` and
`…chat.js#ac1498949c1d` at `:502` — and both match the committed artifact
`tools/xss-sink-audit-report.json` (`:790-797` and `:335-342`, each recording
`"classification": "dom_api_safe"`).

Two strings went into each hash. Neither contains anything from the helper body. That is arithmetic,
not inference, and it holds on both refs.

### 1.4 Does anything on `launch-hardening` close the hole?

**No. It records it a third time.** The 28 added lines are two new entries in the
`MANUAL_REVIEW_OVERRIDES` map literal and nothing else — proven by the §0.2 hash over lines 1–476.
The new `apps/business/js/staff-system.js#1f2adc4987cb` entry ends
«همان محدودیتی که برای bubble()/bizBubble() بالاتر ثبت شده», and its own note states that if a
dynamic interpolation is added to that button «این override همچنان اعمال می‌شود و شمارش هم عوض
نمی‌شود … یعنی گیت قرمز نمی‌شود».

So the count of sinks whose safety rests on an unguarded helper body went from two to three while
the guard stayed the same. **Documented is not fixed.**

### 1.5 Is the recorded description complete? **No — one material defect**

The admission at `tools/xss-sink-audit.mjs:498-500` reads:

> گاردِ واقعیِ آن رفتاری است (`tools/xss-escaping-regression.mjs`) و امروز این دو تابع را پوشش
> نمی‌دهد — **چون هیچ‌کدام export نشده‌اند**

It names **one** cause. There are **two independent** ones:

| # | Cause | Evidence |
|---|---|---|
| a | Neither helper is exported | `apps/customer/js/features/chat.js:143`, `apps/business/js/chat.js:82` |
| b | The gate never imports either module, and has no case for either helper | `tools/xss-escaping-regression.mjs:84`, `:96-99` |

Cause (b) is not mentioned anywhere. It is sufficient on its own: **adding `export` to both
functions would change coverage by exactly nothing**, because the gate would still import only
`discover.js` and still run only its two cases.

This matters operationally. Directive 022 §6 names the fix as "exporting `bubble`/`bizBubble`". An
engineer implementing that literally would produce a green run, a plausible diff, and **zero new
coverage** — then close the item. The note as written actively supports that mistake. §3 below
specifies both halves.

---

## §2. The proof plan — executable unattended the moment Node 20 exists

### 2.0 Preconditions (assert these, or every code below is uninterpretable)

```bash
node --version          # MUST print v20.x  — anything else invalidates the run
git rev-parse --abbrev-ref HEAD
git status --porcelain | wc -l   # MUST be 0 before starting
```

If `node --version` exits 127, **every subsequent exit code in this plan is 127 and means nothing**.
Check it first and record it.

### 2.1 The injection — and why it must be *in place*

**Business (classic script):** `apps/business/js/chat.js:84`

```text
-  return `<div class="chat-b ${mine?'me':'them'}"><div>${chatEsc(m.body)}</div><div class="chat-b-t">${chatTime(m.created_at)}</div></div>`;
+  return `<div class="chat-b ${mine?'me':'them'}"><div>${m.body}</div><div class="chat-b-t">${chatTime(m.created_at)}</div></div>`;
```

**Customer (ES module):** `apps/customer/js/features/chat.js:145` — same shape, `${esc(m.body)}` → `${m.body}`.

**The line count must not change, and the sink line must not be touched.**

This is not fussiness. `tools/xss-sink-audit-report.json` records a `line` field per hit
(`:336`, `:791`). Deleting a whole line renumbers every sink below it in that file, the committed
artifact stops matching, and `--check` exits 1 at `tools/xss-sink-audit.mjs:807` — **for artifact
staleness, not for missing escaping.** That red would be a false positive for this question, and the
natural developer response (regenerate and commit the artifact) restores green with the
vulnerability still in place. An in-place edit on line 84 keeps the artifact byte-identical, which is
precisely what makes the blindness visible.

### 2.2 The four points

| # | State | Command | Expected | Meaning |
|---|---|---|---|---|
| 1 | injected, **current** gates | `node tools/xss-sink-audit.mjs --check` | **0** | gate is blind |
| 1b | injected, **current** gates | `node tools/xss-escaping-regression.mjs` | **0** | gate is blind |
| 2 | reverted, **current** gates | both of the above | **0**, **0** | baseline green |
| 3 | injected, **fixed** gate | `node tools/xss-escaping-regression.mjs` | **1** | new coverage bites |
| 4 | reverted, **fixed** gate | `node tools/xss-escaping-regression.mjs` | **0** | no false positive |

Points 1/1b are the falsifiability proof of the hole; a `0` there is the finding. Points 3/4 are the
constitution §3 red→green proof of the replacement.

Revert with `git checkout -- apps/business/js/chat.js apps/customer/js/features/chat.js`. Never commit the injection.

### 2.3 The strongest single step — regenerate and diff (do this at point 1)

With the injection in place, run the tool **without** `--check` so it rewrites the artifacts, then:

```bash
node tools/xss-sink-audit.mjs
git diff --stat -- tools/xss-sink-audit-report.json docs/XSS_SINK_AUDIT.md
```

**Expected: only the `generated_at` timestamp differs — no classification, no count, no hash.**
That is a stronger claim than "exit 0": it shows the tool's entire output is *insensitive* to the
removal of a real escaper. Restore the artifacts afterwards with `git checkout --`.

### 2.4 What would make each exit code a lie

Per NIGHT-REPORT §7 — «کدِ خروجِ یک ابزار هیچ اطلاعاتی درباره‌ی اینکه به کدام سؤال جواب داده حمل
نمی‌کند». For each point, the code alone is insufficient; the listed discriminator must also hold.

| # | Code | It would be a **lie** if… | Discriminator that must also be checked |
|---|---|---|---|
| 1 | 0 | node is absent (shell yields 127, easily misread as "fine" in a loop that ignores codes) | `node --version` = v20.x, recorded, **before** the run |
| 1 | 0 | the tool never scanned `apps/business/js/chat.js` at all — 0 would mean "didn't look" | regenerated `xss-sink-audit-report.json` still contains a hit `apps/business/js/chat.js:75` with `"sink_hash": "7dc23113c97a"` |
| 1 | 0 | the injection was never actually applied | `git diff --stat -- apps/business/js/chat.js` shows `1 +-` **and** `grep -c 'chatEsc(m.body)'` returns 0 |
| 1b | 0 | the gate exited 0 having answered a *different* question | stdout tail must read `✓ هر 6 ترکیب escape شد` — 6 = 2 cases × 3 payloads. After the fix it must read **12**. The number, not the tick, identifies which question was answered |
| 3 | 1 | the gate threw instead of detecting — an import/vm failure also exits 1 | stderr must contain `**خام**` and name the injected case (`bizBubble` / `bubble`). A line containing `استثنا داد` is a *different* failure and does not prove coverage |
| 3 | 1 | the helper was never found and the gate failed on the absence guard | stderr must **not** contain `پیدا نشد — گاردِ توخالی`; that message means the subject was missing, which is a correct failure but not this proof |
| 4 | 0 | the new cases silently did not register | stdout tail must read `✓ هر 12 ترکیب escape شد`. A `6` here means the fix did not take effect and the 0 is meaningless |
| any | any | the run used a stale `node_modules` or a different ref | record `git rev-parse HEAD` and `git status --porcelain` alongside every code |

The `xss-sink-audit` ratchet has a matching trap worth naming: an override that matches **nothing**
produces only `console.warn` (`tools/xss-sink-audit.mjs:826-832`) and never sets `regressed`. A dead
override therefore cannot turn the gate red. Do not read a green `--check` as "every override is
live."

---

## §3. The honest fix — described, not applied

> Not applied deliberately: another session holds ~58 uncommitted files in this repo from a machine
> I cannot inspect. These diffs are for whoever owns that tree.

### 3.1 Establish the loading model first — it is *asymmetric*, and the brief had it backwards

The dispatch brief said both helpers are "plain function declarations in classic scripts." That is
**wrong for the customer app**, and the audit tool's own note (`:500`) already had it right.

| | `apps/customer/js/features/chat.js` | `apps/business/js/chat.js` |
|---|---|---|
| Loaded by | `apps/customer/index.html:268` `<script type="module" src="js/main.js">` → `js/main.js:31` `import './features/chat.js'` | `apps/business/index.html:190` `<script src="js/chat.js"></script>` — **no** `type="module"` |
| Kind | **ES module** — `import` at `:7-9`, `export` at `:25`, `:70`, `:80`, `:112` | **Classic script**, shared global scope (`:2`: «بدون import، مثل بقیه‌ی فایل‌ها») |
| Right mechanism | add `export` | **not** `export` — see 3.3 |

### 3.2 Customer half — `export` is correct and free

```text
--- a/apps/customer/js/features/chat.js
+++ b/apps/customer/js/features/chat.js
@@ -143 +143 @@
-function bubble(m){
+export function bubble(m){
```

**Cost: zero.** The file is already an ES module with four exports; adding a fifth changes no
runtime behaviour, and `main.js:31` is a side-effect import that is unaffected. The standalone
bundler already handles exports in *this exact file* (it has four), so `tools/build-standalone.py`
needs no change.

### 3.3 Business half — `export` here would break the page. Do not.

Two rejected options, with the breakage named:

- **Add `export`.** In a classic script `export` is a **SyntaxError**. The whole file fails to
  parse, so `chatEsc`, `chatTime`, `rChat`, `openBizChat`, `closeBizChat`, `bizPoll`, `bizBubble`
  and `sendBizChat` all vanish from global scope. The business chat panel dies.
- **Switch the tag to `type="module"`.** Module scope is not global scope. The inline handlers
  `onclick="openBizChat(…)"` (`chat.js:25`) and `onclick="closeBizChat()"` (`:42`) resolve against
  `window` and would break, as would the shared-global contract of the other 15 classic scripts at
  `apps/business/index.html:175-190`.

Both violate the mandate's own constraint: do not break the runtime page to satisfy a tool.

**Correct mechanism: load the classic script the way the browser does** — evaluate its source in a
fresh context, via `node:vm`. This is a faithful model of the actual loading model, not a
workaround, and it requires **no change to app source**.

It is cheap here, and that is verifiable rather than hoped: `apps/business/js/chat.js` has **zero
top-level executable statements** — every column-0 line is a declaration (`let`/`const` at `:4-8`,
`function` at `:10`, `:11`, `:14`, `:36`, `:56`, `:63`, `:82`, `:87`). And `bizBubble` (`:82-85`)
depends only on `chatEsc` (`:10`) and `chatTime` (`:11`), both in the same file. So the vm context
needs no DOM shim and no sibling globals.

### 3.4 The gate diff

```text
--- a/tools/xss-escaping-regression.mjs
+++ b/tools/xss-escaping-regression.mjs
@@ imports @@
 import { fileURLToPath, pathToFileURL } from 'node:url';
 import { dirname, join } from 'node:path';
+import { readFileSync } from 'node:fs';
+import { createContext, Script } from 'node:vm';

@@ after the discover import (line 84) @@
 const discover = await import(pathToFileURL(join(ROOT, 'apps/customer/js/data/discover.js')).href);
+
+// اپِ مشتری ES Module است (apps/customer/index.html:268 → main.js:31).
+const custChat = await import(pathToFileURL(join(ROOT, 'apps/customer/js/features/chat.js')).href);
+
+// پنلِ business کلاسیک است (apps/business/index.html:190، بدونِ type=module).
+// پس export نمی‌کنیم — همان‌طور که مرورگر بار می‌کند ارزیابی‌اش می‌کنیم.
+// این فایل هیچ عبارتِ اجرایی در سطحِ بالا ندارد، پس به DOM نیاز نیست.
+function loadClassicScript(relPath, wanted) {
+  const src = readFileSync(join(ROOT, relPath), 'utf8');
+  const ctx = createContext({});
+  new Script(src, { filename: relPath }).runInContext(ctx);
+  // قاعده‌ی ۴: نبودِ موضوع خطاست، نه عبور.
+  const missing = wanted.filter((n) => typeof ctx[n] !== 'function');
+  if (missing.length) {
+    console.error(`✗ ${relPath}: ${missing.join('، ')} پیدا نشد — گاردِ توخالی`);
+    process.exit(1);
+  }
+  return ctx;
+}
+const bizChat = loadClassicScript('apps/business/js/chat.js', ['bizBubble']);

@@ CASES @@
 const CASES = [
   { name: 'cardHTML (کارتِ فید)', run: (p) => discover.cardHTML(poisoned(p)) },
   { name: 'slotsHTML (چیپ‌هایِ ساعت)', run: (p) => discover.slotsHTML(poisoned(p)) },
+  { name: 'bubble (حبابِ چتِ مشتری)',
+    run: (p) => custChat.bubble({ sender: 'user',  body: p, created_at: '2026-09-07T10:00:00.000Z' }) },
+  { name: 'bizBubble (حبابِ چتِ پنل)',
+    run: (p) => bizChat.bizBubble({ sender: 'staff', body: p, created_at: '2026-09-07T10:00:00.000Z' }) },
 ];
```

Plus the customer `export` from §3.2. The final tail then reads `✓ هر 12 ترکیب escape شد`.

**Why the new import adds no shim risk:** `features/chat.js` imports only `../api.js`, `../icons.js`
and `../auth.js` (`:7-9`). All three are already in the module graph the gate loads today via
`discover.js` (`discover.js:2`, `:3`, `:13`). The existing DOM shim
(`tools/xss-escaping-regression.mjs:32-61`) therefore already covers them.

**Registration:** `api/tests/_all.runner.mts` does **not** apply here — this gate is not an
`api/tests` file; CI invokes it directly at
`origin/audit/launch-hardening:.github/workflows/ci.yml:496`. Confirmed absent from the runner by
grep. The constraint binds only if someone instead writes this as an `api/tests/*.test.mts`.

**Control bytes:** the diff above contains a regex-free body, but the file it patches contains
`/[&<>"']/` at `:107`. Write it with a file tool, never a heredoc (constitution §4b), then run
`node tools/check-control-bytes.mjs`. That guard enumerates via `git ls-files`
(`tools/check-control-bytes.mjs:42`) and is therefore **blind to untracked files** — if the patched
file is new or unstaged, check it explicitly with a byte scan.

### 3.5 What this fix does and does not buy

It closes the **helper-body axis for these two helpers by construction**: the gate now calls
`bubble` and `bizBubble` with live attack payloads and inspects the returned HTML, so removing the
escaper inside the body produces raw markers and a red exit — with no dependence on the sink line,
the hash, or the override table.

It does **not** generalise. The third instance
(`apps/business/js/staff-system.js#1f2adc4987cb`) is a different shape — a button-label round-trip,
not a payload-returning helper — and is untouched by this change. Directive 022 §6's ruling against
hashing callee bodies still stands; the counter-measure remains "add a behavioural case per helper",
which scales linearly with reviewed helpers. That cost should be stated when the item is closed, not
discovered later.

---

## §4. Axes — tested and not tested

Constitution §4c: a falsifiability proof is per-axis.

**Tested (by source reading; UNKNOWN pending-runtime for execution):**

| Axis | Verdict |
|---|---|
| Helper-body change (escaper removed inside `bizBubble`/`bubble`) | **BLIND** — the finding. §1.2, §1.3 |
| Key-identity axis (does the key depend on the callee?) | **Proven no**, arithmetically. §1.3 |
| Override-liveness axis (does a dead override fail?) | **Warn-only**, never red. `:826-832` |
| Behavioural-coverage axis (does the runtime gate reach chat?) | **No** — not imported, no case. `:84`, `:96-99` |
| Branch axis (does `launch-hardening` close it?) | **No** — table-only diff. §0.2, §1.4 |

**NOT tested — explicitly out of scope of this proof, and not to be inferred as safe:**

1. **Call-site change** — replacing the sink expression itself. The tool claims this invalidates the
   key and goes red (`:455-456`). Plausible from the code, **unverified here**; it needs its own
   injection.
2. **Sink relocation** — moving the sink to another line/file. Claimed harmless by design (`:454`).
   Unverified.
3. **Second-order helper** — escaping delegated *two* levels down (`sink → h1() → h2()`). Not
   examined at all.
4. **Producer axis** — whether `chatEsc`/`esc` themselves still escape. Covered for `esc` by
   `api/tests/esc.test.mts` (referenced at `:6`); **`chatEsc` (`apps/business/js/chat.js:10`) has no
   such test** and is a separate duplicate implementation. Not verified.
5. **Standalone bundle** — `standalone/business.html:8197` and `standalone/customer.html:5913` carry
   the same sinks with `"classification": "unsafe"`, under `REPORT_ONLY_PATHS` (`:34`) so they never
   affect the exit code. Whether the bundle regenerates correctly after the §3 fix is untested.
6. **Every other `path#hash` override** (27 of them) — only the two chat entries were traced to
   their helpers. The other 25 rest on the same key mechanism and were **not** individually checked.
7. **Runtime behaviour of the §3.4 diff** — `new Script(...).runInContext({})` succeeding, `Set` and
   `Intl` resolving in a bare vm context, and the customer import loading under the shim are all
   **UNKNOWN (pending-runtime)**. Resolved by points 3 and 4 of §2.2.
