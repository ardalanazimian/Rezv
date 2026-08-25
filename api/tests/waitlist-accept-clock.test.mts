import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ P0 — «ترکیبِ دو ساعتِ متفاوت» در acceptOffer (فازِ ۲، پروتکل §۴)
//
//  باگ: acceptOffer تاریخ را از UTC (`toISOString`) و ساعت را از ساعتِ محلیِ
//  *پروسه* (`toTimeString`) می‌ساخت، بعد createReservation آن جفت را به‌عنوانِ
//  ساعتِ دیواریِ محلیِ **رستوران** تفسیر می‌کرد. رویِ کانتینرِ UTC (که TZ ست
//  نشده — نه در Dockerfile نه در docker-compose)، این یعنی هر پذیرشِ آفر
//  ۳.۵ ساعت در گذشته می‌افتاد و با PAST_TIME رد می‌شد.
//
//  این تست منطقِ زمانی را **خالص** می‌سنجد (بدونِ DB): همان دو روشِ ساختِ
//  (تاریخ، ساعت) را کنارِ هم می‌گذارد و نشان می‌دهد روشِ قدیمی با تفسیرِ
//  Tehran به گذشته می‌افتد و روشِ جدید نمی‌افتد.
// ═══════════════════════════════════════════════════════════════════════

const { zonedTimeToUtc, dateKeyInTz } = await import('../src/lib/hours.ts');

const TZ = 'Asia/Tehran';

/** روشِ **قدیمیِ** معیوب: تاریخ از UTC، ساعت از ساعتِ محلیِ پروسه. */
function legacyPair(now: Date): { date: string; time: string } {
  return { date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5) };
}

/** روشِ **جدید**: هر دو جزء از تایم‌زونِ رستوران. */
function fixedPair(now: Date, tz: string): { date: string; time: string } {
  return {
    date: dateKeyInTz(now, tz),
    time: new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit' }).format(now),
  };
}

describe('acceptOffer — ساختِ زمانِ رزرو از یک تایم‌زونِ واحد (P0)', () => {
  test('روشِ جدید هرگز در گذشته نمی‌افتد (نمونه‌برداری ۲۴ ساعته)', () => {
    // هر ساعتِ شبانه‌روز را می‌سنجیم تا ثابت شود این یک حالتِ لبه‌ی نیمه‌شب نیست.
    for (let h = 0; h < 24; h++) {
      const now = new Date(Date.UTC(2026, 7, 23, h, 17, 0));
      const { date, time } = fixedPair(now, TZ);
      const start = zonedTimeToUtc(date, time, TZ);
      const driftSec = Math.abs(+start - +now) / 1000;
      // دقیقه‌ها گرد می‌شوند، پس تا ۶۰ ثانیه اختلاف طبیعی است.
      assert.ok(
        driftSec <= 60,
        `ساعت ${h}:17 UTC → انحرافِ ${driftSec}s؛ باید ≤۶۰s باشد (date=${date} time=${time})`,
      );
    }
  });

  test('روشِ قدیمی روی سرورِ UTC واقعاً به گذشته می‌افتاد (اثباتِ خودِ باگ)', () => {
    // این تست فقط وقتی معنا دارد که پروسه رویِ UTC باشد — دقیقاً حالتِ تولید.
    // اگر ماشینِ توسعه‌دهنده TZ دیگری دارد، تست را skip می‌کنیم به‌جای ادعایِ غلط.
    const probe = new Date(Date.UTC(2026, 7, 23, 18, 0, 0));
    const isUtcProcess = probe.toTimeString().slice(0, 5) === '18:00';
    if (!isUtcProcess) {
      // صادقانه: روی این ماشین قابلِ اثبات نیست.
      assert.ok(true, 'پروسه رویِ UTC نیست — این ادعا در این محیط قابلِ سنجش نیست');
      return;
    }
    const { date, time } = legacyPair(probe);
    const start = zonedTimeToUtc(date, time, TZ);
    // تهران +۳:۳۰ است، پس تفسیرِ «۱۸:۰۰ تهران» می‌شود ۱۴:۳۰ UTC → ۳.۵ ساعت عقب.
    assert.ok(
      +start < +probe - 60_000,
      'روشِ قدیمی باید در گذشته بیفتد — اگر نیفتاد یعنی فرضِ این رگرسیون عوض شده',
    );
    const behindHours = (+probe - +start) / 3_600_000;
    assert.ok(Math.abs(behindHours - 3.5) < 0.01, `باید دقیقاً ۳.۵ ساعت عقب باشد، بود: ${behindHours}`);
  });

  test('روشِ جدید نزدیکِ نیمه‌شبِ UTC تاریخِ محلیِ درست را می‌دهد', () => {
    // ۲۲:۰۰ UTC = ۰۱:۳۰ روزِ بعد به وقتِ تهران — تاریخ باید جلو برود.
    const now = new Date(Date.UTC(2026, 7, 23, 22, 0, 0));
    const { date, time } = fixedPair(now, TZ);
    assert.equal(date, '2026-08-24', 'تاریخِ محلیِ تهران باید روزِ بعد باشد');
    assert.equal(time, '01:30');
    const start = zonedTimeToUtc(date, time, TZ);
    assert.ok(Math.abs(+start - +now) / 1000 <= 60);
  });
});
