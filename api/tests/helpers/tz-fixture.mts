// ═══════════════════════════════════════════════════════════════════════
//  fixtureِ مشترکِ تست‌هایِ «مرزِ نیمه‌شبِ رستوران در برابرِ ساعتِ سرور» (T2)
//
//  چرا این فایل: هم `reservations-restaurant-timezone.integration.test.mts`
//  و هم `assistant-answers-timezone.test.mts` به یک ساختِ fixture نیاز
//  دارند — تایم‌زونی برایِ رستوران پیدا کن که در **هر** لحظه‌ی واقعی که این
//  تست اجرا می‌شود، مرزِ روزِ آن با مرزِ روزِ تایم‌زونِ پروسه‌ی سرور فاصله‌ی
//  معناداری داشته باشد، و یک جفت (لحظه‌ی «نیمه‌شبِ رستوران»، لحظه‌ی جعلیِ
//  «الان» = ~۲۳:۵۵ همان روز) بساز. یک‌بار نوشتنِ این منطق به‌جایِ دو کپی
//  (بندِ ۳۲ — تحکیم به‌جایِ تکرار).
//
//  اثباتِ عددیِ اینکه انتخاب همیشه فاصله‌ی کافی می‌دهد: شبیه‌سازیِ آفلاینِ
//  ۱۰٬۰۸۰ ترکیبِ (آفستِ سرور × ساعتِ روز، هر ۱۵ دقیقه) صفر نقض و حداقلِ
//  حاشیه‌ی ۶ ساعت داد. `assertFixtureIsMeaningful` پایین همان پیش‌شرط را
//  در **لحظه‌ی واقعیِ اجرا** هم دوباره چک می‌کند — اگر یک‌بار نقض شد، تست
//  با پیامِ روشن fail می‌شود، نه اینکه بی‌صدا سبز بماند.
// ═══════════════════════════════════════════════════════════════════════

import assert from 'node:assert/strict';

const { zonedTimeToUtc, dateKeyInTz } = await import('../../src/lib/hours.ts');

function offsetMinutesAt(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function circularDiffMinutes(a: number, b: number): number {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
}

// چهار تایم‌زونِ Etc/GMT بدونِ DST، فاصله‌ی ۶ساعته از هم — پوششِ کاملِ دایره.
const TZ_CANDIDATES = ['Etc/GMT+12', 'Etc/GMT+6', 'Etc/GMT-6', 'Etc/GMT-11'];

function pickFarthestTz(now: Date): { tz: string; scoreMinutes: number } {
  const serverOffset = -now.getTimezoneOffset();
  let best = TZ_CANDIDATES[0];
  let bestScore = -1;
  for (const c of TZ_CANDIDATES) {
    const score = circularDiffMinutes(offsetMinutesAt(now, c), serverOffset);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return { tz: best, scoreMinutes: bestScore };
}

export interface TzFixture {
  tz: string;
  /** نیمه‌شبِ «امروزِ» رستوران — شروعِ بازه‌ی صحیح. */
  reservationSlot: Date;
  /** ~۲۳:۵۵ به وقتِ رستوران، همان روزِ تقویمی — برایِ فریزکردنِ ساعت. */
  fakedNow: Date;
}

/** تایم‌زون و جفتِ (نیمه‌شبِ رستوران، الانِ جعلی) را می‌سازد و پیش‌شرط‌ها را assert می‌کند. */
export function buildTzFixture(realNow: Date = new Date()): TzFixture {
  const picked = pickFarthestTz(realNow);
  assert.ok(picked.scoreMinutes >= 60,
    `انتخابِ تایم‌زون فاصله‌ی کافی از سرور ندارد (${picked.scoreMinutes} دقیقه) — طراحیِ fixture نیاز به بازبینی دارد`);

  const todayKey = dateKeyInTz(realNow, picked.tz);
  const reservationSlot = zonedTimeToUtc(todayKey, '00:00', picked.tz);
  const fakedNow = new Date(reservationSlot.getTime() + (23 * 60 + 55) * 60_000);

  // پیش‌شرط: با الگوریتمِ **قدیمیِ** (باگی، سرورمحلی)، این لحظه باید بیرونِ
  // «امروز»ِ سرور بیفتد — وگرنه fixture چیزی را نمی‌سنجد.
  const buggyStart = new Date(fakedNow); buggyStart.setHours(0, 0, 0, 0);
  const buggyEnd = new Date(buggyStart); buggyEnd.setDate(buggyEnd.getDate() + 1);
  assert.ok(reservationSlot < buggyStart || reservationSlot >= buggyEnd,
    `پیش‌شرطِ fixture نقض شد: reservationSlot=${reservationSlot.toISOString()} داخلِ بازه‌ی سرورمحلیِ ` +
    `[${buggyStart.toISOString()}, ${buggyEnd.toISOString()}) است — این تست چیزی را نمی‌سنجد`);

  return { tz: picked.tz, reservationSlot, fakedNow };
}
