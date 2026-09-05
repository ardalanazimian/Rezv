# 004 — Persian-calendar-aware guest tagging (built in, not bolted on)

_Status: proposed 2026-09-05 by Scout. Tiering scale note: same caveat as proposals 001–003 — no CEO
T1/T2/T3 definition found in-repo; generic scale used._

## The gap

Servme (MENA reservation/CRM platform, profiled this batch —
`docs/audit/research/profiles/servme.md`) draws an explicit competitive-positioning line on its own
comparison pages against TableCheck, Eat App, SevenRooms, OpenTable, and Resy/Tock: **"we built Servme
for MENA operators from day one"** versus global platforms that merely **"add MENA features."** The
concrete, checkable evidence for that claim isn't a vague marketing line — it's a specific, named
product surface: restaurants running on Servme tag guests specifically for **Ramadan/Iftar-period**
campaigns inside the CRM's guest-segmentation tool, confirmed via Servme's own product pages and
corroborated independently by the Hyatt Regency Dubai case study (88,000 guest profiles accumulated
over 3 years, per `profiles/servme.md` §"Review synthesis"). Servme also publishes an annual "Ramadan
marketing ideas" blog series targeting this exact seasonal pattern.

What a restaurant loses without this: every reservation/CRM tool studied this batch (SevenRooms,
Zenchef, Eat App, generic segmentation across the board) treats a Ramadan-period guest, a Nowruz-period
guest, or a Yalda-night guest as just another "recent visitor" — a missed opportunity to recognize a
real, predictable, high-value seasonal demand pattern that Iranian restaurants live through every year
(Nowruz travel-and-dining season, Ramadan/Iftar timing shifts, Yalda-night communal dining, Chaharshanbe
Suri). Rezervno's own `CLAUDE.md` already treats Persian-first/RTL as non-negotiable at the UI layer —
this proposal extends that same "built for Iran, not translated for Iran" discipline into the CRM/guest-
recognition layer, which is currently silent on the question.

## The mechanism

Not a "smart AI calendar feature" — concrete, checkable behavior:

1. A small, versioned table of Iranian calendar events relevant to dining behavior (Nowruz, Yalda,
   Ramadan/Iftar dates — these shift yearly on the Persian/lunar calendars and must be data, not
   hardcoded — Chaharshanbe Suri, Sizdah Bedar) that a restaurant can turn on/off per event.
2. When a reservation falls inside an active event window, the guest's profile gets a visible tag
   (e.g., "مهمانِ نوروز ۱۴۰۴") in the restaurant staff panel — the same panel surface that already
   shows customer-profile/allergy/birthday data per `CLAUDE.md`'s protocol §§3–11 — not a new,
   disconnected system.
3. A restaurant owner can filter/export guests by event tag for their own outreach (SMS via the
   existing Melipayamak integration, `api/src/lib/sms.ts`) — Rezervno provides the tagging and
   filtering; it does not itself send unsolicited marketing on the restaurant's behalf, consistent with
   notification-restraint and avoiding a Rezervno-initiated spam vector.
4. No new consumer-facing "AI" label — this is server-side date-range tagging against a maintained
   calendar table, described as exactly that.

## Why it wins

- Servme's own case study (a named, checkable customer, not anonymous marketing copy) demonstrates
  restaurants actively value and use exactly this kind of event-aware segmentation — it is a demand
  signal from the adjacent MENA market, not a guess.
- No competitor profiled this batch (global or Iranian) has a Persian-calendar-specific equivalent —
  Fidilio and SmartX's CRM-adjacent features (`profiles/fidilio.md` FidiOffer, `profiles/smartx.md`
  Customer Club) were found to be generic segmentation/coupon tools, not calendar-event-aware ones.
  This is a differentiator competitors would need real product work, not a pricing change, to copy.
- It's cheap to build on infrastructure Rezervno already has (customer-profile system, staff panel,
  SMS integration) rather than a new subsystem.

## Cost estimate

**T2.** Touches: a new small reference table (Persian calendar event windows, likely
`api/prisma/schema.prisma` + a `NNN-*.sql` migration per `CLAUDE.md`'s two-stage schema process), a
tagging step in the reservation-write path, and a UI surface in the staff panel
(`apps/business`/`apps/company`) to show/filter by tag. Depends on: confirming where existing
customer-profile tags (if any) already live, so this extends rather than duplicates a tagging system —
**needs `backend-integrity-engineer`** (owns the customer-profile/allergy/birthday data foundation) to
check for an existing tag mechanism before implementation starts, per the "search first" rule in
`CLAUDE.md`.

## Product-bar check

- **Money honesty:** N/A directly (not a pricing feature) — passes by construction.
- **No dark patterns:** passes — this is guest recognition/segmentation, not a manufactured-urgency
  mechanic.
- **Notification restraint:** passes by design — Rezervno tags and filters; it does not auto-send
  marketing messages on a restaurant's behalf. Any SMS a restaurant chooses to send still goes through
  the existing `enqueueSms` fail-closed path (`CLAUDE.md` §پیامک و پول) — no new silent-fallback risk.
- **Honest labels:** passes — no "AI" or "smart" label proposed; it's a maintained calendar table and a
  date-range tag, described as exactly that.

## What I did NOT verify

- Whether Rezervno's customer-profile system already has any tagging/segmentation mechanism this would
  duplicate — `profiles/servme.md` and this proposal are based on Servme's public product pages, not a
  check of Rezervno's own schema for this specific feature. **This must be checked before implementation.**
- The exact, authoritative Persian-calendar date-conversion source Rezervno should depend on (Nowruz is
  fixed to the vernal equinox; Ramadan/Iftar shift on the lunar calendar and require a reliable
  conversion library or maintained lookup table — not calculated ad hoc).
- Whether Iranian restaurant owners actually want this — the demand signal here is from Servme's Gulf
  customers (Ramadan/Iftar), not a documented Iranian restaurant-owner request; Nowruz/Yalda specifically
  are Scout's own extrapolation to Iran's calendar, not sourced to any reviewed competitor or Iranian
  owner testimonial. Flagging this as the weakest link in the proposal's evidence chain.
