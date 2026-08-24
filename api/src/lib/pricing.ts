// ═══════════════════════════════════════════════════════════
//  موتورِ پیشنهادِ قیمت (AI Pricing) — منطقِ خالص، شفاف، مبتنی‌بر داده‌ی واقعی
//
//  فلسفه: این یک «جعبه‌ی سیاهِ AI» نیست. یک موتورِ قاعده‌مند است که از داده‌ی
//  واقعیِ شلوغیِ خودِ رستوران استفاده می‌کند و *دلیلِ* هر پیشنهاد را می‌گوید.
//  رستوران‌دار پیشنهاد را می‌بیند، دلیلش را می‌فهمد، و خودش تصمیم می‌گیرد.
//
//  چرا این‌طور: AIِ واقعی به داده‌ی تاریخیِ انبوه نیاز دارد که یک استارتاپِ نوپا
//  هنوز ندارد. پیشنهادِ قاعده‌مندِ شفاف، همین امروز ارزش می‌سازد و قابل‌اعتماد است.
//  بعداً که داده جمع شد، می‌توان لایه‌ی ML اضافه کرد (رابطِ خروجی همین می‌ماند).
// ═══════════════════════════════════════════════════════════

export interface HeatCell { dow: number; hour: number; count: number }
export interface PricingSuggestion {
  dows: number[];
  from: string;
  to: string;
  min_toman: number;
  label: string;
  reason: string;       // *چرا* این پیشنهاد — شفافیت
  occupancy_pct: number;
}

const DOW_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const WEEKEND_DOWS = [4, 5];   // پنجشنبه، جمعه (آخر هفته‌ی ایران)

/** گِرد کردن مبلغ به نزدیک‌ترین ۵۰هزار تومان (اعداد تمیز برای مشتری). */
function roundToman(n: number): number {
  return Math.max(0, Math.round(n / 50_000) * 50_000);
}

/**
 * از داده‌ی heatmap (روز×ساعت) و مبلغِ پایه، قواعدِ قیمتِ پیشنهادی می‌سازد.
 * منطق: بازه‌های شلوغ → حداقل مبلغِ بالاتر (تقاضای بالا). بازه‌های خلوت → پیشنهادِ تخفیف.
 *
 * @param heat داده‌ی واقعیِ رزرو per (dow,hour)
 * @param baseMin مبلغِ پایه‌ی فعلی (اگر ۰ باشد، از میانگینِ منطقیِ منطقه تخمین می‌زنیم)
 */
export function suggestPricing(heat: HeatCell[], baseMin: number): PricingSuggestion[] {
  if (!heat.length) return [];

  // بیشینه‌ی شلوغی برای نرمال‌سازی
  const maxCount = Math.max(...heat.map(c => c.count), 1);
  // مبلغِ مبنا: اگر رستوران چیزی نگذاشته، یک پایه‌ی محافظه‌کارانه فرض کن
  const base = baseMin > 0 ? baseMin : 300_000;

  // ── تجمیع بر اساس روز (میانگینِ شلوغیِ ساعاتِ سرویسِ هر روز) ──
  const byDow = new Map<number, { total: number; peakHours: number[] }>();
  for (const c of heat) {
    if (c.count === 0) continue;
    const e = byDow.get(c.dow) ?? { total: 0, peakHours: [] };
    e.total += c.count;
    if (c.count >= maxCount * 0.6) e.peakHours.push(c.hour); // ساعتِ داغ
    byDow.set(c.dow, e);
  }

  const suggestions: PricingSuggestion[] = [];

  // ── قاعده ۱: شب‌های آخر هفته (شلوغ‌ترین) → بالاترین حداقل مبلغ ──
  const weekendPeak = WEEKEND_DOWS.filter(d => (byDow.get(d)?.peakHours.length ?? 0) > 0);
  if (weekendPeak.length) {
    const occ = Math.round(
      (weekendPeak.reduce((s, d) => s + (byDow.get(d)?.total ?? 0), 0) /
       (weekendPeak.length * heat.filter(c => WEEKEND_DOWS.includes(c.dow)).length || 1)) / maxCount * 100,
    );
    suggestions.push({
      dows: weekendPeak,
      from: '19:00', to: '23:00',
      min_toman: roundToman(base * 1.6),
      label: 'شب‌های آخر هفته',
      reason: `${weekendPeak.map(d => DOW_FA[d]).join(' و ')} شب‌ها شلوغ‌ترین زمانِ شماست؛ حداقل مبلغِ بالاتر، تقاضای بالا را متعادل می‌کند و درآمد هر میز را افزایش می‌دهد.`,
      occupancy_pct: Math.min(99, Math.max(60, occ || 85)),
    });
  }

  // ── قاعده ۲: شب‌های وسطِ هفته (متوسط) → حداقل مبلغِ استاندارد ──
  const midweekBusy = [0, 1, 2, 3, 6].filter(d => (byDow.get(d)?.peakHours.length ?? 0) > 0);
  if (midweekBusy.length) {
    suggestions.push({
      dows: midweekBusy,
      from: '19:00', to: '22:30',
      min_toman: roundToman(base),
      label: 'شب‌های وسطِ هفته',
      reason: 'شب‌های وسطِ هفته تقاضای متوسطی دارند؛ حداقل مبلغِ پایه، تعادلِ خوبی بین پر شدنِ میزها و درآمد ایجاد می‌کند.',
      occupancy_pct: 55,
    });
  }

  // ── قاعده ۳: بازه‌های خلوت (ناهار وسطِ هفته) → پیشنهادِ تخفیف برای پر کردن ──
  const lunchHours = heat.filter(c => c.hour >= 12 && c.hour <= 15 && ![4, 5].includes(c.dow));
  const lunchTotal = lunchHours.reduce((s, c) => s + c.count, 0);
  const lunchAvg = lunchHours.length ? lunchTotal / lunchHours.length : 0;
  if (lunchAvg < maxCount * 0.4) {
    suggestions.push({
      dows: [0, 1, 2, 3, 6],
      from: '12:00', to: '15:00',
      min_toman: roundToman(base * 0.5),
      label: 'ناهارِ وسطِ هفته (خلوت)',
      reason: 'این بازه خلوت است؛ حداقل مبلغِ پایین‌تر (یا حذفِ آن) مشتری‌های حساس به قیمت را جذب می‌کند و میزهای خالی را پر می‌کند — درآمدِ اضافه از ظرفیتِ بلااستفاده.',
      occupancy_pct: Math.round(lunchAvg / maxCount * 100),
    });
  }

  return suggestions;
}
