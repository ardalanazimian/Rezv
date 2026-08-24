import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { suggestPricing, MIN_OBSERVATIONS, type HeatCell } from '../src/lib/pricing.ts';

// ═══════════════════════════════════════════════════════════════════════
//  موتورِ پیشنهادِ قیمت — تستِ واحد (تابع خالص است، DB لازم ندارد)
//
//  ⚠️ چرا این فایل نوشته شد: `lib/pricing.ts` هیچ تستی نداشت و خروجی‌اش
//  مستقیم به رستوران‌دار نمایش داده می‌شود و او رویش تصمیمِ *قیمت* می‌گیرد.
//
//  چهار باگِ زیر با اجرای زنده‌ی خودِ تابع (اسکریپتِ probe، نه خواندنِ کد)
//  پیدا شد و هر چهار اینجا قفل شده‌اند. هر چهار از یک خانواده‌اند: «عددی یا
//  جمله‌ای گزارش می‌شد که از `heat` قابلِ اشتقاق نبود» — همان چیزی که
//  docs/ML_CONTRACT.md منع می‌کند.
// ═══════════════════════════════════════════════════════════════════════

/** یک هیت‌مپِ شام‌محورِ سالم با شواهدِ فراوان. */
function dinnerHeat(): HeatCell[] {
  const h: HeatCell[] = [];
  for (const d of [4, 5]) for (const hour of [19, 20, 21, 22]) h.push({ dow: d, hour, count: 40 });
  for (const d of [0, 1, 2, 3, 6]) for (const hour of [19, 20, 21]) h.push({ dow: d, hour, count: 20 });
  return h;
}

const byLabel = (s: ReturnType<typeof suggestPricing>, needle: string) =>
  s.find(x => x.label.includes(needle));

describe('پیشنهادِ قیمت — بازه‌ی زمانی باید از ساعت‌های داغِ واقعی بیاید', () => {
  test('کافه‌ی ناهارمحور دیگر «شب» به او نسبت داده نمی‌شود', () => {
    // ⚠️ باگِ ۱ (اثباتِ زنده، ۲۰۲۶-۰۸-۲۰): `peakHours` محاسبه و بعد دور
    // ریخته می‌شد؛ بازه همیشه هاردکدِ ۱۹:۰۰–۲۳:۰۰ بود. این کافه *صفر* رزروِ
    // شبانه دارد و اوجش ساعتِ ۱۳ است، ولی خروجیِ قبلی این بود:
    //   [شب‌های آخر هفته] ۱۹:۰۰–۲۳:۰۰
    //   «پنجشنبه و جمعه شب‌ها شلوغ‌ترین زمانِ شماست»
    // یعنی هم جمله دروغ بود، هم قاعده‌ی قیمت روی ساعتی می‌نشست که رستوران
    // اصلاً کار نمی‌کند.
    const lunchCafe: HeatCell[] = [
      { dow: 5, hour: 12, count: 18 }, { dow: 5, hour: 13, count: 30 }, { dow: 5, hour: 14, count: 22 },
      { dow: 4, hour: 13, count: 25 }, { dow: 4, hour: 14, count: 20 },
      { dow: 1, hour: 13, count: 8 }, { dow: 2, hour: 13, count: 7 },
    ];
    const peak = byLabel(suggestPricing(lunchCafe, 300_000), 'آخرِ هفته');
    assert.ok(peak, 'باید پیشنهادِ آخرِ هفته بدهد');

    assert.equal(peak.from, '12:00', 'شروعِ بازه باید اولین ساعتِ داغِ واقعی باشد');
    assert.equal(peak.to, '15:00', 'پایانِ بازه باید بعدِ آخرین ساعتِ داغ باشد');
    assert.ok(!peak.reason.includes('شب'), `متن نباید ادعای «شب» کند: ${peak.reason}`);
    assert.ok(!peak.label.includes('شب'), `برچسب نباید «شب» بگوید: ${peak.label}`);
    assert.ok(peak.reason.includes('12:00') && peak.reason.includes('15:00'),
      'متنِ دلیل باید همان ساعت‌هایی را بگوید که در قاعده گذاشته');
  });

  test('رستورانِ شام‌محور همچنان بازه‌ی شب می‌گیرد', () => {
    // کنترلِ مثبت: اگر تستِ بالا فقط به‌خاطرِ خرابیِ کلیِ قاعده سبز می‌شد،
    // این یکی قرمز می‌شود.
    const peak = byLabel(suggestPricing(dinnerHeat(), 400_000), 'آخرِ هفته');
    assert.ok(peak);
    assert.equal(peak.from, '19:00');
    assert.equal(peak.to, '23:00');
    assert.ok(peak.label.includes('شب'), 'اینجا «شب» درست است چون داده‌اش شبانه است');
    assert.deepEqual(peak.dows, [4, 5]);
  });

  test('ساعتِ ۲۳ به «24:00»ِ نامعتبر تبدیل نمی‌شود', () => {
    // ⚠️ خروجیِ from/to مستقیماً در pricingAccept به PUT /restaurant/pricing
    // پس داده می‌شود و آنجا zTimeStr فقط 00:00..23:59 را می‌پذیرد؛ «24:00»
    // یعنی «قبول این پیشنهاد» با ۴۰۰ شکست می‌خورد.
    const lateNight: HeatCell[] = [4, 5].flatMap(d =>
      [22, 23].map(hour => ({ dow: d, hour, count: 30 })));
    const peak = byLabel(suggestPricing(lateNight, 300_000), 'آخرِ هفته');
    assert.ok(peak);
    const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;   // همان regexِ zTimeStr
    for (const s of suggestPricing(lateNight, 300_000)) {
      assert.match(s.from, HHMM, `from نامعتبر: ${s.from}`);
      assert.match(s.to, HHMM, `to نامعتبر: ${s.to}`);
    }
    assert.equal(peak.to, '23:59', 'سقفِ بازه باید ۲۳:۵۹ شود، نه ۲۴:۰۰');
  });
});

describe('پیشنهادِ قیمت — عددِ شلوغی باید اندازه‌گیری باشد نه ثابت', () => {
  test('آخرِ هفته‌ی اشباع ۱۰۰٪ می‌دهد، نه کفِ ۶۰', () => {
    // ⚠️ باگِ ۲: `Math.min(99, Math.max(60, occ || 85))` — کف، سقف، و
    // جانشینِ ۸۵. در این سناریو *هر* خانه‌ی آخرِ هفته دقیقاً برابرِ بیشینه
    // است (یعنی ۱۰۰٪) ولی عددِ گزارش‌شده **۶۰** بود. چون UI برچسبِ
    // «شلوغ‌ترین» را از ۷۰ به بالا می‌زند، شلوغ‌ترین حالتِ ممکن بدونِ برچسب
    // نمایش داده می‌شد در حالی که متنِ کنارش می‌گفت «شلوغ‌ترین زمانِ شماست».
    const peak = byLabel(suggestPricing(dinnerHeat(), 400_000), 'آخرِ هفته');
    assert.ok(peak);
    assert.equal(peak.occupancy_pct, 100,
      'هر خانه برابرِ بیشینه است، پس شلوغیِ نسبی دقیقاً ۱۰۰٪ است');
    assert.ok(peak.reason.includes('100٪'), 'همان عدد باید در متنِ دلیل هم بیاید');
  });

  test('عددِ ثابتِ ۵۵ برای وسطِ هفته حذف شده', () => {
    // ⚠️ باگِ ۲ب: قاعده‌ی وسطِ هفته occupancy_pct را هاردکد ۵۵ می‌داد —
    // مستقل از داده. اینجا وسطِ هفته نصفِ آخرِ هفته است، پس باید ۵۰ بدهد.
    const heat: HeatCell[] = [];
    for (const d of [4, 5]) for (const h of [20, 21]) heat.push({ dow: d, hour: h, count: 40 });
    for (const d of [0, 1, 2, 3, 6]) for (const h of [20, 21]) heat.push({ dow: d, hour: h, count: 24 });
    const mid = byLabel(suggestPricing(heat, 400_000), 'وسطِ هفته');
    assert.ok(mid, 'وسطِ هفته با ۲۴ از ۴۰ (۶۰٪) داغ حساب می‌شود');
    assert.equal(mid.occupancy_pct, 60, '۲۴÷۴۰ = ۶۰٪ — نه ۵۵ِ ثابت');
  });

  test('خانه‌های خالیِ بازه در مخرج می‌آیند (تورمِ کاذب ندارد)', () => {
    // کوئریِ منبع GROUP BY می‌زند، پس ساعتِ بدونِ رزرو اصلاً ردیف ندارد.
    // اگر میانگین را فقط روی ردیف‌های موجود بگیریم، بازه‌ای که فقط یک ساعتِ
    // شلوغ دارد ۱۰۰٪ نشان داده می‌شود. اینجا آخرِ هفته سه ساعتِ داغ دارد
    // ولی جمعه ساعتِ ۲۱ اصلاً ردیف ندارد (= صفر رزرو).
    const heat: HeatCell[] = [
      { dow: 4, hour: 20, count: 30 }, { dow: 4, hour: 21, count: 30 },
      { dow: 5, hour: 20, count: 30 },
      // (dow 5, hour 21) عمداً غایب است
    ];
    const peak = byLabel(suggestPricing(heat, 300_000), 'آخرِ هفته');
    assert.ok(peak);
    // مجموع ۹۰ روی ۲ روز × ۲ ساعت = ۴ خانه → میانگین ۲۲٫۵ از بیشینه‌ی ۳۰ = ۷۵٪
    assert.equal(peak.occupancy_pct, 75,
      'خانه‌ی غایب باید صفر حساب شود، نه اینکه از میانگین حذف شود');
  });
});

describe('پیشنهادِ قیمت — نبودِ شواهد ≠ صفرِ اندازه‌گیری‌شده', () => {
  test('رستورانِ فقط-شام پیشنهادِ «ناهارِ خلوت» نمی‌گیرد', () => {
    // ⚠️ باگِ ۳: `lunchAvg = 0` و شرطِ `0 < maxCount*0.4` همیشه درست بود، پس
    // رستورانی که اصلاً ناهار سرو نمی‌کند این را می‌گرفت:
    //   «این بازه خلوت است» + occupancy_pct: 0 + پیشنهادِ نصف‌کردنِ حداقلِ مبلغ.
    // نبودِ شواهد به‌عنوانِ صفرِ اندازه‌گیری‌شده گزارش می‌شد.
    const s = suggestPricing(dinnerHeat(), 400_000);
    assert.equal(byLabel(s, 'ناهار'), undefined,
      'بدونِ حتی یک رزروِ ناهار، هیچ ادعایی دربارهٔ ناهار مجاز نیست');
  });

  test('اگر ناهار واقعاً سرو و واقعاً خلوت باشد، پیشنهاد می‌آید', () => {
    // کنترلِ مثبت برای تستِ بالا: وگرنه حذفِ کاملِ قاعده‌ی ۳ هم سبز می‌شد.
    const heat = dinnerHeat();
    heat.push({ dow: 1, hour: 13, count: 3 }, { dow: 2, hour: 13, count: 2 });
    const lunch = byLabel(suggestPricing(heat, 400_000), 'ناهار');
    assert.ok(lunch, 'با شواهدِ ناهارِ کم، پیشنهادِ تخفیف باید بیاید');
    assert.ok(lunch.occupancy_pct > 0, 'عدد باید از داده بیاید، نه صفرِ پیش‌فرض');
    assert.ok(lunch.occupancy_pct < 40, 'و باید واقعاً زیرِ آستانه‌ی «خلوت» باشد');
    assert.equal(lunch.min_toman, 200_000, 'نصفِ پایه، گِردشده به ۵۰هزار');
  });

  test('ناهارِ شلوغ پیشنهادِ تخفیف نمی‌گیرد', () => {
    const heat = dinnerHeat();
    for (const d of [0, 1, 2, 3, 6]) for (const h of [12, 13, 14]) heat.push({ dow: d, hour: h, count: 35 });
    assert.equal(byLabel(suggestPricing(heat, 400_000), 'ناهار'), undefined,
      'وقتی ناهار ۸۷٪ِ اوج است، «خلوت» خواندنش دروغ است');
  });

  test('زیرِ آستانه‌ی شواهد، هیچ پیشنهادی ساخته نمی‌شود', () => {
    // ⚠️ باگِ ۴: با **یک** رزرو در کلِ ۹۰ روز، maxCount=1 می‌شد و همان یک
    // رزرو ≥ ۰٫۶ بود، پس خروجی این بود:
    //   «جمعه شب‌ها شلوغ‌ترین زمانِ شماست» با occupancy_pct: 99.
    // الگو از n=۱ ساخته می‌شد.
    assert.deepEqual(suggestPricing([{ dow: 5, hour: 20, count: 1 }], 300_000), []);
    assert.deepEqual(suggestPricing([], 300_000), []);

    // دقیقاً یکی زیرِ آستانه → ساکت؛ دقیقاً روی آستانه → حرف می‌زند.
    const at = (n: number) => suggestPricing(
      [{ dow: 4, hour: 20, count: n }, { dow: 5, hour: 20, count: n }], 300_000);
    assert.deepEqual(at(Math.floor((MIN_OBSERVATIONS - 1) / 2)), [],
      `زیرِ ${MIN_OBSERVATIONS} مشاهده باید ساکت بماند`);
    assert.ok(at(MIN_OBSERVATIONS).length > 0, 'با شواهدِ کافی باید پیشنهاد بدهد');
  });
});

describe('پیشنهادِ قیمت — مبلغ و ورودی', () => {
  test('مبلغِ پایه‌ی صفر به پیش‌فرضِ محافظه‌کارانه می‌افتد', () => {
    const peak = byLabel(suggestPricing(dinnerHeat(), 0), 'آخرِ هفته');
    assert.ok(peak);
    assert.equal(peak.min_toman, 500_000, '۳۰۰هزارِ پیش‌فرض × ۱٫۶ = ۴۸۰هزار → گِرد به ۵۰۰هزار');
  });

  test('همه‌ی مبالغ مضربِ ۵۰هزار و نامنفی‌اند', () => {
    for (const base of [0, 40_000, 250_000, 1_250_000]) {
      for (const s of suggestPricing(dinnerHeat(), base)) {
        assert.equal(s.min_toman % 50_000, 0, `مبلغِ غیرگِرد: ${s.min_toman}`);
        assert.ok(s.min_toman >= 0);
      }
    }
  });

  test('ردیفِ خرابِ ورودی نه کرش می‌کند نه NaN پخش می‌کند', () => {
    const dirty = [
      ...dinnerHeat(),
      { dow: 9, hour: 20, count: 50 },            // روزِ نامعتبر
      { dow: 4, hour: 99, count: 50 },            // ساعتِ نامعتبر
      { dow: 4, hour: 20, count: NaN },           // شمارشِ نامعتبر
      { dow: 4, hour: 20, count: -5 },            // شمارشِ منفی
    ] as HeatCell[];
    const s = suggestPricing(dirty, 400_000);
    assert.ok(s.length > 0, 'ردیفِ سالم باید همچنان کار کند');
    for (const x of s) {
      assert.ok(Number.isFinite(x.occupancy_pct), `NaN در شلوغی: ${x.occupancy_pct}`);
      assert.ok(Number.isFinite(x.min_toman), `NaN در مبلغ: ${x.min_toman}`);
    }
    // ردیف‌های خراب نباید بیشینه را به ۵۰ ببرند و درصدها را خراب کنند.
    assert.equal(byLabel(s, 'آخرِ هفته')!.occupancy_pct, 100);
  });

  test('فقط روزهایی پیشنهاد می‌گیرند که رستوران در آن‌ها کار می‌کند', () => {
    // فقط جمعه داده دارد → پیشنهادِ آخرِ هفته نباید پنجشنبه را هم ادعا کند.
    const fridayOnly: HeatCell[] = [19, 20, 21].map(hour => ({ dow: 5, hour, count: 30 }));
    const peak = byLabel(suggestPricing(fridayOnly, 300_000), 'آخرِ هفته');
    assert.ok(peak);
    assert.deepEqual(peak.dows, [5], 'پنجشنبه هیچ رزروی ندارد، پس در قاعده نمی‌آید');
    assert.ok(!peak.reason.includes('پنجشنبه'));
  });
});
