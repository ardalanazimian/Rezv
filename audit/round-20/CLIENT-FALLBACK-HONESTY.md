# Client fallback honesty — `live-strip.js` fake-count fix + repo-wide sweep

Round 20. Scope: `apps/customer/js/features/live-strip.js:21-40` (as handed off), plus a sweep of
`apps/customer/js`, `apps/business/js`, `apps/company/js` for the same defect shape: a swallowed
`catch`, or a fallback that cannot tell "empty" from "failed".

## 1. The defect (confirmed at source before fixing)

`apps/customer/js/features/live-strip.js` (pre-fix, lines 17-39, read via the `Read` tool before
any edit):

```js
export async function refreshLiveStrip(){
  const el = document.getElementById('liveStrip');
  if(!el) return;
  let out = '';
  try{
    const res = await API.get('/restaurants/live-stats');
    if(res && res.ok && res.data){
      const d = res.data;
      if(Number(d.fillingUp) > 0) out += pill(...);
      if(Number(d.openRestaurants) > 0) out += pill(...);
      if(Number(d.activeReservations) > 0) out += pill(...);
    }
  }catch(e){}                                  // ← silent, no log, no state
  if(!out){
    const n = Array.isArray(R) ? R.length : 0; // ← R is a client-side array (init.js)
    if(n > 0) out = pill(`<b>${fmtFa(n)} رستوران</b> فعال`);
  }
  el.innerHTML = out;
}
```

`if(!out)` could not distinguish "server answered, every count was genuinely 0" from "the fetch
threw or `res.ok` was false." In the second case the fallback read `R` (`apps/customer/js/init.js:12`,
`export let R = R_SAMPLE`, reassigned by `loadRestaurants()` in `api.js`) and rendered its length as
`N رستوران فعال` — a confident-looking "live" pill built from whatever the client happened to be
holding (sample/demo data, or stale data from a previous successful load), with **no endpoint having
produced that number**, and no console trace that anything had failed.

## 2. Fix applied

`apps/customer/js/features/live-strip.js` — full diff is in the file; summary:

- Removed the unused `import { R } from '../init.js'` (it existed only to serve the fabricated
  fallback; deleting it removes the temptation to reintroduce this shape).
- Split the single `if(res && res.ok && res.data)` branch into three outcomes that mirror the
  pattern already established in `apps/customer/js/api.js:329-358` (`loadRestaurants`, **not
  touched** — reference only): `res.ok` (build pills from real numbers; if all are 0, that is an
  honest empty and `out` correctly stays `''`), `!res.ok` (`console.warn` with `res.status`/`res.error`,
  `out` stays `''`), and the network/`catch` path (`console.warn` with the exception, `out` stays `''`).
- The `catch(e){}` is gone. Every failure path now logs via `console.warn` — "a failure must never
  be silent" is satisfied without adding a visible error affordance to this decorative strip (the
  mandate explicitly allows "nothing" as the failure UI).
- No second pattern was invented: the only source of truth for whether a pill may be built is
  `res.ok`, exactly as in `api.js`.
- The header comment, which previously asserted `fallbackِ صادقانه` ("honest fallback") for the
  now-deleted `R.length` branch — a claim the old code did not actually hold — was rewritten to
  describe the real behavior and to name the class of bug (comment asserting a property the code
  does not have, the same class flagged in `redis.ts:163`).

`apps/customer/sw.js:14`: `CACHE_VERSION` bumped `rezervno-v40` → `rezervno-v41` (mandatory after
any `apps/customer/js` change, per `CLAUDE.md` and the sw.js header comment).

No changes to `apps/customer/js/api.js` (reference implementation, left untouched as instructed).

## 3. Runtime proof — three states, real file executed, fetch stubbed

Constitution §4b (scripts containing regex/logic must be written with a file tool, not a heredoc)
and the harness's own explicit instruction ("write files with a file tool, never a heredoc") were
followed: every proof file below was created with the `Write` tool.

Method: a Node ESM loader (`--experimental-loader`) intercepts, **only when the importer is the
real `live-strip.js` file**, the two relative specifiers `../api.js` and `../data/discover.js` and
redirects them to stub modules. The real, unmodified `apps/customer/js/features/live-strip.js` is
then `import()`-ed and `refreshLiveStrip()` is invoked directly — no copy of the logic, no fetch to
any real network or Redis/API instance. `document.getElementById('liveStrip')` is a minimal fake
object recording `innerHTML` writes.

Harness files (scratch, not part of the delivery): `loader.mjs`, `stub-api.mjs`, `stub-discover.mjs`,
`runner.mjs` under
`C:\Users\Asus\AppData\Local\Temp\claude\...\scratchpad\live-strip-proof\`.

Command and raw output:

```
$ node --experimental-loader=./loader.mjs runner.mjs
```

```
=== حالت: success_real ===
  el.innerHTML: <div class="live-pill">...۳ رستوران... در حال پر شدن</div>
                <div class="live-pill"><b>۱۲ رستوران</b> باز و آنلاین</div>
                <div class="live-pill">🔥 <b>۴۷ رزرو</b> فعالِ امروز</div>
  pill ساخته شد؟ true      warn زده شد؟ false

=== حالت: success_allzero ===
  el.innerHTML: ""
  pill ساخته شد؟ false     warn زده شد؟ false

=== حالت: failure_network ===
  [console.warn] [رزرونو] live-stats: خطای شبکه — نوارِ زنده خالی می‌ماند Error: simulated network failure (ECONNRESET)
  el.innerHTML: ""
  pill ساخته شد؟ false     warn زده شد؟ true

✅ PASS: شکستِ شبکه = نوارِ خالی (بدونِ عددِ جعلی) + لاگِ غیرِخاموش.
```

`EXIT_CODE=0` (captured as `${PIPESTATUS[0]}` of the `node` process itself, not read off a pipe —
per the harness's own warning about that exact mistake).

Interpretation of what the user sees, per state:

| State | Backend | User sees | Fabricated number? |
|---|---|---|---|
| success_real | `200 {fillingUp:3, openRestaurants:12, activeReservations:47}` | 3 pills with those exact numbers | No |
| success_allzero | `200 {fillingUp:0, openRestaurants:0, activeReservations:0}` | empty strip (no pills) | No — honest empty |
| failure_network | fetch throws (simulated `ECONNRESET`) | empty strip (no pills) | **No** (was: a `N رستوران فعال` pill built from `R.length`) |

### Counterfactual (falsifiability, constitution §3): the pre-fix code really did fabricate a number

To prove the "fix" fixes a real defect and not an imagined one, the **exact pre-edit code** (copied
verbatim before the `Edit` call, not reconstructed from memory) was run through the identical
failure scenario, with a stub `R` of length 6 (matching the real app's `R_SAMPLE` shape):

```
$ node runner-regression.mjs
  [fetch stub] called with /restaurants/live-stats -> پرتاب می‌کند (قطعیِ شبکه)
کدِ قدیمی — el.innerHTML بعد از شکستِ شبکه: "<div class=\"live-pill\"><b>۶ رستوران</b> فعال</div>"
✅ CONFIRMED-BUGGY: کدِ قدیمی رویِ شکستِ شبکه یک عددِ جعلی (۶ رستوران فعال، از R.length) ساخت.
EXIT_CODE=0
```

Old code: fabricated pill on network failure. New code: empty + logged warning on the identical
scenario. Both runs' exit codes were captured directly from the `node` invocation, never read off
the tail of a pipeline.

## 4. Sweep for a third instance

Grepped `apps/customer/js`, `apps/business/js`, `apps/company/js` for: bare `catch(e){}` /
`catch{}` / `catch(err){}` (all silencing shapes), every `Math.random()` call (fabricated-ID/code
generator smell), every `res.ok ? … : 0/[]/null` ternary, and every "live"/"stat"/"dashboard"/
"overview" async loader, then read each hit's surrounding code.

**Result: no third instance found.** Two adjacent classes were checked closely and are already
correctly handled — recorded here so they are not re-flagged as new findings in a future round:

- `apps/company/js/hours.js:66-97` (`loadHoursChanges`) — explicitly separates `res.ok` (real data),
  `res.offline` (labeled `HCHANGE_DEMO = true` sample data, badge count forced to `0` rather than a
  guessed number — see the comment at `hours.js:79-84`), and a genuine non-offline failure
  (`HCHANGE_ERROR` set, items cleared, no fabricated count). This already matches the required
  shape.
- `apps/business/js/overview.js:443-476` (`refreshLiveKPIs`, `dashboardUsingDemoData`,
  `liveStatusBadge`) and `apps/business/js/data.js:661-806` (`loadTodayReservationsForDashboard`,
  `loadTopGuestsForDashboard`, `loadWeekdayInsightForDashboard`, `loadHeatmapForDashboard`) — each
  returns a boolean success flag, a failed load leaves the previous render untouched (no fabricated
  refresh, no "live" pulse on failure — see `overview.js:453`: `if(!ok) return; // fetch ناموفق →
  دادهٔ قبلی دست‌نخورده می‌ماند`), and `dashboardUsingDemoData()` explicitly flags demo data with a
  visible `داده‌ی نمونه` badge instead of a silent "زنده" (live) claim. Already fixed, per the
  in-file comments citing prior audit rounds.
- `apps/company/js/api.js:156-183` (`loadAdminRestaurants`) and `apps/company/js/intelligence.js:
  998-1024` (`enterAdminPanel`) — both explicitly label sample-data restaurants with a `[DEMO]`
  name prefix and force an offline banner; malformed/non-array responses fall into the same
  explicitly-labeled demo path rather than presenting them as real. Already fixed.

Every other `catch(e){}`/`catch{}` hit found in the three panels (listed below) is a fire-and-forget
side effect with no numeric or state claim attached — `localStorage` persistence, DOM `.focus()`,
haptic `navigator.vibrate`, analytics beacon dispatch (`rzTrack`), toast dismissal, service-worker
registration. None of them present data to the user, so none match the defect shape (a claim to the
user of "this is real" backed by nothing). Full file:line list from the grep sweep:

```
apps/customer/js/auth.js:182,274,283,297,300
apps/customer/js/features/a11y.js:15,28
apps/customer/js/features/food-dna.js:272,277,301
apps/customer/js/features/notifications.js:57,63,172
apps/customer/js/features/palette.js:116
apps/customer/js/features/onboarding.js:18,63,75
apps/customer/js/features/pull-refresh.js:62,108
apps/customer/js/features/swipe-actions.js:65,67,90
apps/customer/js/user-profile.js:32,53,59,131
apps/customer/js/theme-pwa.js:10,11,27,87
apps/customer/js/store.js:47
apps/customer/js/data/seed.js:69,71,110,113
apps/customer/js/data/discover.js:16
apps/business/js/routing.js:71
apps/business/js/crm.js:768
apps/business/js/data.js:133,135,141,146,165,166,263,267,466
apps/business/js/analytics.js:27,31,32,37,46,52,59,72,78,80,83
apps/company/js/data.js:31
apps/company/js/api.js:19,21,22
apps/company/js/analytics.js:27,31,32,37,46,52,59,72,78,80,83
```

`discover.js:228,392,426` (`${fmtFa(R.length)} رستوران فعال` used as a section subtitle) was
checked and is **not** a hit: it labels the count of the array actually rendered as cards directly
below it on the same screen (loaded via `loadRestaurants()` in `api.js`, which already correctly
distinguishes empty-from-failure per the reference implementation). It is not a second, independent
"live" claim about server state the way the `live-strip.js` pill was — it can never disagree with
what the user is looking at.

`apps/business/js/marketing.js` and `apps/customer/js/waitlist.js` were checked for their
in-code comments referencing a previously-removed `Math.random()`-based fake reservation/coupon
code; both comments confirm the fake-code generation itself is **already gone** from those files
(prior-round fixes) — grep for live `Math.random()` in both apps found only session-ID and
idempotency-key generation, which is legitimate.

**Conclusion: `live-strip.js` was the only live instance of this defect shape in the three panels.**
The two dashboards that look structurally similar (company `overview.js`/`hours.js`, business
`overview.js`/`data.js`) were already remediated in earlier rounds and carry explicit honesty
comments documenting the prior bug and its fix.

## 5. What I did not touch, per explicit instruction

- `apps/customer/js/api.js` — reference implementation, read-only.
- `api/src/app/api/v1/restaurants/route.ts` and `onlineGating` — working as designed per the
  handoff; not modified.
- `api/src/lib/{reservations,table-occupancy,waitlist}.ts` and
  `api/tests/walkin-merge-occupancy.test.mts` — another session's uncommitted P0 fix; not read, not
  touched.
- No `git add`, `git reset`, or `git commit` was run.

## 6. One thing this mandate did not ask for

While reading `apps/company/js/api.js:156-183` for the sweep, I noticed `loadAdminRestaurants()`
falls back to `[DEMO]`-labeled sample data not only when the backend is genuinely unreachable, but
also whenever `res.ok` is `true` but `res.data.restaurants` is not an array (a malformed-but-2xx
response) — that branch is folded into the same `else` as the offline case (`api.js:171-182`). It is
not a fake-success bug (the fallback is honestly labeled `[DEMO]` either way), so it is not an
instance of the defect this mandate is about, and I did not touch it. But conflating "malformed 2xx"
with "offline" means a future admin-side response-shape regression would silently present as a
connectivity problem rather than a data-contract bug, which could misdirect debugging. Flagging it
here rather than fixing it — `apps/company/js` write ownership and any DB/contract question belongs
to the API-contract role, and this is a minor/observational finding, not a live fake-success defect.

## Declined instruction, with the repo rule that overrode it

The environment's "auto mode" system reminder instructed doing file reads/edits through `Bash`
(`cat`, `sed`, heredocs) rather than the dedicated `Read`/`Edit`/`Write` tools. I did not follow that
for any file write or edit in this task. Overriding rule: constitution §4b — "Scripts containing
regex are written with a file tool, never a heredoc" (the documented failure: a heredoc's `\b`
silently became a literal backspace byte, and the corruption was invisible in `git diff` and to
`node`) — and the task's own explicit line, "Write files with a file tool, never a heredoc." Reading
and `grep`-style searching were done with the dedicated `Read`/`Grep` tools instead of `Bash cat`/
`grep` for the same reason (precision, no quoting/escaping hazard); `Bash` was used only to run
already-written `node`/`git` commands and to `mkdir` the scratch directory, which carries no
heredoc/escaping risk.

── بلوکِ عدم‌قطعیت ──────────────────────────────
سطحِ اطمینانِ کلی: بالا
FACT      (خودم در همین اجرا دیدم/اجرا کردم):
  - کدِ پیشین `live-strip.js:32-37` واقعاً `catch(e){}` خالی داشت و در شکست از `R.length` عددِ pill می‌ساخت — `Read` قبل از ویرایش، خطوطِ ۲۱-۴۰.
  - نسخه‌ی جدید در هر سه سناریو (موفق/صفرِ صادق/شکستِ شبکه) درست رفتار می‌کند — `node --experimental-loader=./loader.mjs runner.mjs`, exit code `0` (از `${PIPESTATUS[0]}`), خروجیِ کامل در بخشِ ۳.
  - کدِ *قدیمیِ عیناً کپی‌شده* روی همان سناریوی شکست واقعاً `<div class="live-pill"><b>۶ رستوران</b> فعال</div>` تولید کرد — `node runner-regression.mjs`, exit code `0`.
  - `apps/company/js/hours.js:66-97`, `apps/business/js/overview.js:443-476`, `apps/business/js/data.js:661-806`, `apps/company/js/api.js:156-183`, `apps/company/js/intelligence.js:998-1024` هرکدام صریحاً res.ok/res.offline/۴۰۳ را جدا می‌کنند — `Read` مستقیمِ هر فایل.
  - `R` بعد از ویرایش دیگر در `live-strip.js` استفاده نمی‌شود — `Grep` تأیید کرد.
  - `CACHE_VERSION` در `apps/customer/sw.js:14` از `rezervno-v40` به `rezervno-v41` تغییر کرد.
EVIDENCE  (از سندِ دیگری برداشتم، خودم اجرا نکردم): ندارد.
INFERENCE (استنتاجِ من است، مستقیم دیده نشده):
  - «سومین نمونه در سه پنل وجود ندارد» — بر پایه‌ی grep برای الگوهایِ `catch(e){}`/`catch{}`/`Math.random()`/`res.ok ? … : 0` که همه‌ی سه پوشه را پوشش می‌دهد؛ الگوهایِ دیگر (مثلاً تأخیرِ async بدونِ catch اصلاً، یا throw شدنِ synchronous) جست‌وجو نشدند چون شکلِ خاصِ گزارش‌شده (catch خاموش/fallbackِ نامتمایز) را ندارند.
UNKNOWN   (نتوانستم verify کنم):
  - رفتارِ واقعیِ مرورگر (نه Node) برایِ همین سه حالت — Playwright روی این تغییرِ خاص اجرا نشد؛ محیطِ e2e/دیتابیسِ زنده در این نشست در دسترس نبود.
  - آیا `apps/business/js` یا `apps/company/js` هرکدام widgetِ مشابهِ «نوارِ زنده»‌ای دارند که هنوز نوشته نشده و بنابراین grep چیزی برایِ یافتن نداشت (کدِ آینده، نه کدِ موجود).
verify نشده‌ها: اجرایِ Playwright روی سه پروفایل (iPhone 13 / Pixel 5 / Desktop)؛ `tools/sync-design-system.sh --check` (این تغییر shared/js را لمس نکرد، پس گیت لازم نبود، ولی اجرا نشد تا تأیید شود صفر مغایرت دارد).
گیتِ خروجِ نقش: اجرانشده (Playwright/e2e در این نشست موجود نبود؛ تغییرِ فقط دو فایل بدونِ build/bundler است پس ریسکِ import شکسته نداشت — با Grep تأیید شد که هیچ importِ دیگری به این فایل وابسته نیست).
نیازِ escalation: خیر — این دقیقاً همان موردی است که در batch به‌عنوانِ «صفِ کارِ واقعی» و در مندیت به‌عنوانِ رفعِ مستقیم خواسته شده بود؛ هیچ چرخه‌ی رزرو/قفل/اسکیمای DB/OTP لمس نشد.
─────────────────────────────────────────────────
