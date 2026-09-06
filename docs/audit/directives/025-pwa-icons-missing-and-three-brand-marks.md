# Directive 025 — The customer PWA is not installable: both manifest icons do not exist. Plus three different brand marks.

**Date:** 2026-09-07 · **From:** founder-side reviewer · **To:** CEO agent, founder
**Origin:** founder, 2026-09-06 (overnight authorisation) — "even the landing page and even the icon, update them".
**Partition:** `apps/landing`, `apps/seo`, brand assets — never swept by any earlier round; both finders
assigned to this area died to the session limit in the 2026-09-06 workflow.

---

## 1. The defect: the PWA promises two icons that are not in the repository

```text
apps/customer/manifest.webmanifest:13   "src": "/icon-192.png"   → does not exist
apps/customer/manifest.webmanifest:14   "src": "/icon-512.png"   → does not exist
git check-ignore apps/customer/icon-192.png                      → not ignored; genuinely absent
git grep icon-192\|icon-512 -- apps standalone                   → only those two manifest lines
tools/build-standalone.py                                        → no generation step; it only STRIPS
                                                                   icon/manifest <link> tags (:190-191)
```

**Consequence.** Chrome's installability criteria require a manifest with a 192px and a 512px icon.
With both missing, the customer app is **not installable as a PWA** — the install prompt does not
appear. `index.html:26` links the manifest and `:9` sets an SVG favicon, so the browser tab looks
correct and nothing errors visibly. **The app looks fine and cannot be installed**, which is why this
survived to launch week: there is no red anywhere, only an absent capability.

`apps/customer/sw.js` does not precache them, so there is no second symptom to notice either.

**And iOS has no icon at all.** `git grep apple-touch-icon -- apps standalone` returns nothing.
An iOS "Add to Home Screen" therefore renders a screenshot of the page instead of a brand mark.

This is the whole point of shipping a PWA rather than a website, and it is the one thing that does
not work.

## 2. Three different brand marks across the surfaces

| Surface | Mark | Palette |
|---|---|---|
| `shared/css/tokens.css:84-86` — the design-system source of truth | — | `--brand-500: #4F46E5` · `--brand-400: #6A4BFF` |
| `apps/customer/favicon.svg` (64×64, letter «ر») | rounded square + glyph | `#6A4BFF → #2563EB` — **matches `--brand-400`** |
| `apps/landing/public/icon.svg` (32×32) | rect + gradient | `#6366F1 → #7C3AED → #E8925A` — **matches nothing** |
| `apps/landing` stylesheets | — | gold/orange: `#ddb457`, `#f07f4d`, `#e2612c`, `#17120f` |

The customer favicon is the only asset that agrees with the design tokens. The landing icon is a
third palette that appears nowhere else. The landing *site* palette being warm is defensible as a
deliberate marketing direction — **the icon is not a palette choice, it is identity**, and a guest
who installs the app and then visits the site currently sees two unrelated marks.

`manifest.webmanifest` also declares `theme_color: #6A4BFF`, consistent with the customer favicon and
the tokens — so the landing icon is the outlier, not the app.

## 3. Directive

**Generate `icon-192.png` and `icon-512.png` from `apps/customer/favicon.svg`**, since that is the
asset that already agrees with `--brand-400` and with the manifest's own `theme_color`. Add an
`apple-touch-icon` link so iOS has a mark. Do not invent a new design tonight; the identity question
in §2 is the founder's and generating from the existing agreeing asset does not pre-empt it.

**Falsifiability, because "the icon file exists" is not "the PWA installs".** A guard that asserts
every `src` in every manifest resolves to a file on disk, proven red by renaming one icon and
watching it fail. That is the check that would have caught this at any point in the last months, and
it is three lines. Without it the fix is one asset commit and the next manifest edit reintroduces it.

**Do not** strip the manifest from the standalone builds as a workaround — `build-standalone.py:190`
already removes those tags for the single-file artifact, which is correct for that artifact and is
also why the standalone HTML shows no symptom.

## 3b. Fixed by the CEO in `c85badb` — and the near-miss is worth more than the fix

Both PNGs now exist (8750B, 96932B, valid signatures), an `apple-touch-icon` is linked, and
`tools/check-manifest-assets.mjs` is written and wired into CI's `design-system` job. I verified the
guard myself by mutation: removing `icon-512.png` → exit 1 naming the file; truncating `icon-192.png`
to zero bytes → exit 1; restore → exit 0, both icons byte-identical afterwards. CI registration
confirmed by parsing the workflow with `js-yaml`, not by grep.

**The near-miss.** The first generation used `sharp`, which **exited 0** and reported
`rendered 192x192, 4339B`. Every signal green. The PNG contained a Latin **"J"** — librsvg had
silently substituted a glyph for the Persian «ر». Not a tofu box, which announces itself: a
well-formed, plausible, entirely wrong letter. It was regenerated through a real browser with the
repo's own Vazirmatn face and inspected visually before commit.

**I verified the final artifact the same way, because it is the only instrument that works here.** At
512px the glyph is unambiguously «ر» — continuous curve, no vertical stem, angled terminals, ink
below the baseline. At 192px I could not have called it. That asymmetry is the finding.

`exit 0` meant *pixels were produced*, not *the right pixels were produced*, and **no exit code in
any toolchain distinguishes those.** This is the neighbouring-question failure in its sharpest form:
a Persian product would have shipped a home-screen icon reading "J" — visible to every user, invisible
to every check we own, including the new guard, which asserts the file exists and says so in its own
failure text.

## 4. What I am not deciding

Whether the landing adopts the product's indigo/violet identity or the product adopts the landing's
warm palette. That is a brand decision, it is the founder's, and both directions are defensible. I am
recording that they currently disagree and that **only one of the three agrees with the tokens**.

## 5. Method note

Both of the earlier sweep's finders for this area were killed by the session limit, so this partition
had never been read once. The defect is not subtle — a missing file referenced by a committed
manifest — and it survived because nothing produces a failure signal. **An absent capability emits no
error**, which is the same reason the queue's stranded jobs and the inert RLS both survived: all three
are things that do not happen, and nothing in the system is shaped to notice something not happening.
