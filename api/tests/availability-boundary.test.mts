import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  مرزِ دقیقِ هم‌پوشانیِ بازه  (نمونه‌گیریِ جهش، ۲۰۲۶-۰۸-۲۸)
//
//  ⚠️ چرا این فایل ساخته شد: جهشِ
//      b.slotStart <  blockEnd && bBlockEnd >  start
//   →  b.slotStart <= blockEnd && bBlockEnd >= start
//  از هر سه فایلِ تستی که `lib/availability` را لمس می‌کنند سالم رد شد.
//
//  اثرش «کوچک» نیست: با مرزِ بسته، سانسی که **دقیقاً** پس از پایانِ بلاکِ
//  رزروِ قبلی شروع می‌شود «پر» اعلام می‌شود. یعنی رستوران هر روز ظرفیتِ
//  فروختنی را از دست می‌دهد و مشتری «تکمیل» می‌بیند در حالی که میز آزاد است —
//  خطایی که هیچ‌کس به‌عنوانِ باگ گزارش نمی‌کند، فقط درآمد کم می‌شود.
//
//  این فایل هر دو طرفِ مرز را پین می‌کند: چسبیده = آزاد، یک دقیقه زودتر = پر.
// ═══════════════════════════════════════════════════════════════════════

const { computeSlots, timingOf } = await import('../src/lib/availability.ts');

const TZ = 'Asia/Tehran';
const DATE = '2027-05-19';
const TABLE = {
  id: 't1', number: 1, capacity: 4, isActive: true,
  minPartySize: 1, maxPartySize: null, isMergeable: false, mergeableWith: [],
} as never;

/**
 * سانسِ ۹۰ دقیقه + نظافتِ ۳۰ → بلاک = **۱۲۰ دقیقه**.
 * عمداً مضربِ ۳۰ است تا مرزِ بلاک دقیقاً رویِ یکی از SERVICE_TIMES بیفتد؛
 * وگرنه سانسِ مرزی اصلاً در فهرست نیست و تست بی‌صدا بی‌اثر می‌شود.
 */
const CFG = timingOf({ slotMinutes: 90, bufferMinutes: 0, cleaningMinutes: 30, holdMinutes: 10 });

function slotsWith(busyStartIso: string) {
  const start = new Date(busyStartIso);
  return computeSlots({
    date: DATE, party: 2, tz: TZ, cfg: CFG,
    openingHours: null, closureSet: new Set<string>(),
    tables: [TABLE],
    busy: [{
      tableId: 't1',
      slotStart: start,
      slotEnd: new Date(+start + 90 * 60_000),
      blockBufferMinutes: 30,
      mergedTableNumbers: null,
    }] as never,
  });
}

/**
 * ⚠️ نبودِ سانس **خطا** است، نه عبور. نسخه‌ی اولِ این فایل وقتی سانس را پیدا
 * نمی‌کرد بی‌صدا `return` می‌کرد — و همین باعث شد جهشِ مرزِ بسته از تست سالم
 * رد شود. یک تست که وقتی موضوعش غایب است سبز می‌ماند، تست نیست.
 */
function statusAt(slots: ReturnType<typeof computeSlots>, time: string) {
  const hit = slots.find(s => s.time === time);
  assert.ok(hit, `سانسِ ${time} باید در خروجی باشد — وگرنه این تست چیزی نمی‌سنجد`);
  return hit.status;
}

describe('مرزِ هم‌پوشانیِ بازه — باز است، نه بسته', () => {
  test('سانسِ چسبیده به پایانِ بلاک آزاد می‌ماند', () => {
    const slots = slotsWith('2027-05-19T14:30:00.000Z'); // ۱۸:۰۰ به‌وقتِ تهران
    // رزروِ ۱۸:۰۰ تا ۱۹:۳۰ + ۳۰ نظافت → بلاک تا ۲۰:۰۰.
    // سانسِ ۲۰:۰۰ دقیقاً رویِ مرز است و باید **آزاد** باشد.
    assert.equal(statusAt(slots, '20:00'), 'open',
      'مرزِ بسته (`<=` / `>=`) سانسِ سالمِ چسبیده را «پر» می‌کند و ظرفیتِ '
      + 'فروختنی را بی‌صدا از بین می‌برد');
  });

  test('کنترلِ مثبت: سانسِ داخلِ بلاک واقعاً پر است', () => {
    const slots = slotsWith('2027-05-19T14:30:00.000Z');
    assert.equal(statusAt(slots, '18:30'), 'full',
      'بدونِ این کنترل، منطقی که **هیچ‌وقت** تداخل نبیند هم تستِ بالا را پاس می‌کرد');
  });

  test('بافرِ رزروِ موجود واقعاً اعمال می‌شود', () => {
    // ۱۹:۳۰ پایانِ خودِ رزرو است ولی داخلِ بافرِ ۳۰ دقیقه‌ای — باید پر باشد.
    const slots = slotsWith('2027-05-19T14:30:00.000Z');
    assert.equal(statusAt(slots, '19:30'), 'full',
      'نادیده‌گرفتنِ blockBufferMinutes میز را بلافاصله پس از پایانِ رزرو '
      + 'آزاد نشان می‌دهد — بدونِ زمانِ نظافت',
    );
  });
});
