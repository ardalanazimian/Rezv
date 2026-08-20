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
//
//  ─────────────────────────────────────────────────────────
//  ⚠️ بازنویسیِ ۲۰۲۶-۰۸-۲۰ — چهار موردِ «ادعایِ اندازه‌نگرفته»، هر چهار با
//  اجرایِ زنده‌ی خودِ تابع اثبات شد (نه از رویِ خواندنِ کد):
//
//  ۱) `peakHours` محاسبه می‌شد و بعد **دور ریخته می‌شد**؛ بازه‌ی زمانی همیشه
//     هاردکدِ ۱۹:۰۰–۲۳:۰۰ بود. یک کافه‌ی ناهارمحور با اوجِ واقعیِ ساعتِ ۱۳ و
//     *صفر* رزروِ شبانه، این جمله را می‌گرفت: «پنجشنبه و جمعه **شب‌ها**
//     شلوغ‌ترین زمانِ شماست» + قاعده‌ی قیمتِ ۱۹:۰۰–۲۳:۰۰. یعنی هم جمله دروغ
//     بود، هم قاعده روی ساعتی می‌نشست که رستوران اصلاً کار نمی‌کرد.
//
//  ۲) `occupancy_pct` اندازه‌گیری نبود. قاعده‌ی ۲ عددِ **ثابتِ ۵۵** می‌داد،
//     قاعده‌ی ۱ با `Math.min(99, Math.max(60, occ || 85))` کف/سقف/جانشین
//     داشت، و فرمولِ خودش هم یک‌بارِ اضافه بر `weekendPeak.length` تقسیم
//     می‌کرد. نتیجه‌ی واقعی: رستورانی که *هر* خانه‌ی آخرِ هفته‌اش دقیقاً
//     برابرِ بیشینه بود (یعنی ۱۰۰٪) عددِ **۶۰** می‌گرفت — و چون UI برچسبِ
//     «شلوغ‌ترین» را از ۷۰ به بالا می‌زند، شلوغ‌ترین حالتِ ممکن بدونِ برچسب
//     نمایش داده می‌شد، در حالی که متنِ کنارش می‌گفت «شلوغ‌ترین زمانِ شماست».
//
//  ۳) قاعده‌ی ۳ (ناهار) وقتی **هیچ** داده‌ی ناهاری وجود نداشت هم شلیک می‌کرد:
//     `lunchAvg = 0` و `0 < maxCount*0.4` همیشه درست. رستورانی که اصلاً ناهار
//     سرو نمی‌کند این را می‌گرفت: «این بازه خلوت است» با «۰٪» و پیشنهادِ
//     نصف‌کردنِ حداقلِ مبلغ. نبودِ شواهد به‌عنوانِ صفرِ اندازه‌گیری‌شده گزارش
//     می‌شد — دقیقاً همان چیزی که `docs/ML_CONTRACT.md` منع می‌کند.
//
//  ۴) با **یک** رزرو در کلِ ۹۰ روز، `maxCount=1` می‌شد و همان یک رزرو ≥ ۰٫۶
//     بود، پس «جمعه شب‌ها شلوغ‌ترین زمانِ شماست» با ۹۹٪ تولید می‌شد. الگو از
//     n=۱ ساخته می‌شد.
//
//  قاعده‌ی حاکم بعد از این بازنویسی: هر عدد و هر جمله‌ی این فایل باید از
//  `heat` قابلِ‌اشتقاق باشد. اگر شواهد نیست، پیشنهادی هم نیست (آرایه‌ی خالی)،
//  نه پیشنهادی با عددِ ساختگی.
// ═══════════════════════════════════════════════════════════

export interface HeatCell { dow: number; hour: number; count: number }
export interface PricingSuggestion {
  dows: number[];
  from: string;
  to: string;
  min_toman: number;
  label: string;
  reason: string;       // *چرا* این پیشنهاد — شفافیت
  /**
   * شلوغیِ **نسبی**ِ این بازه: میانگینِ رزرو در هر خانه‌ی (روز×ساعت)ِ بازه،
   * به‌صورتِ درصدی از شلوغ‌ترین خانه‌ی همین رستوران. ۰..۱۰۰، بدونِ کف/سقفِ
   * مصنوعی.
   *
   * ⚠️ نامِ فیلد تاریخی است و «اشغال» (occupancy) نیست و نباید این‌طور خوانده
   * شود: ما هیچ‌جا ظرفیت/تعدادِ صندلی را در این محاسبه نداریم — فقط شمارشِ
   * رزرو. برچسبِ UI هم به همین دلیل به «شلوغیِ نسبی» اصلاح شد. نام برای
   * سازگاریِ قراردادِ API (و بسته‌ی آفلاینِ `demo-mvp/`) دست‌نخورده ماند.
   */
  occupancy_pct: number;
}

const DOW_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const WEEKEND_DOWS = [4, 5];             // پنجشنبه، جمعه (آخر هفته‌ی ایران)
const MIDWEEK_DOWS = [0, 1, 2, 3, 6];

/**
 * حداقلِ رزروِ لازم در کلِ پنجره‌ی داده تا اجازه‌ی هر پیشنهادی داده شود.
 *
 * ⚠️ این عدد یک **انتخاب** است، نه یافته‌ای که اندازه گرفته باشیم — همان
 * ترتیبی که `MIN_RESOLVED_FOR_RATE` در `outreach-ledger.ts` انتخاب شد. زیرِ
 * این آستانه «الگو» چیزی جز نویز نیست و موتور باید ساکت بماند.
 */
export const MIN_OBSERVATIONS = 20;

/** خانه‌ای «داغ» است اگر دستِ‌کم این نسبت از شلوغ‌ترین خانه را داشته باشد. */
const PEAK_RATIO = 0.6;
/** بازه‌ای «خلوت» است اگر شلوغیِ نسبی‌اش زیرِ این نسبت باشد. */
const QUIET_RATIO = 0.4;

const LUNCH_FROM_HOUR = 12;
const LUNCH_TO_HOUR = 15;   // انحصاری: ۱۲، ۱۳، ۱۴

/** گِرد کردن مبلغ به نزدیک‌ترین ۵۰هزار تومان (اعداد تمیز برای مشتری). */
function roundToman(n: number): number {
  return Math.max(0, Math.round(n / 50_000) * 50_000);
}

/**
 * ساعت → 'HH:mm'.
 * ⚠️ سقفِ ۲۳:۵۹: خروجیِ این تابع مستقیماً در `pricingAccept` پنل به
 * `PUT /restaurant/pricing` پس داده می‌شود و آن‌جا `zTimeStr` فقط
 * `00:00`..`23:59` را می‌پذیرد. «24:00» پذیرشِ پیشنهاد را ۴۰۰ می‌کرد.
 */
function hhmm(hour: number): string {
  if (hour >= 24) return '23:59';
  return `${String(Math.max(0, hour)).padStart(2, '0')}:00`;
}

/** برچسبِ بخشِ روز از رویِ ساعتِ شروعِ *واقعیِ* بازه — نه فرضِ «شب». */
function partOfDay(fromHour: number): string {
  if (fromHour < 11) return 'صبح';
  if (fromHour < 16) return 'ظهر';
  if (fromHour < 19) return 'عصر';
  return 'شب';
}

const faDows = (dows: number[]) => dows.map(d => DOW_FA[d]).join(' و ');

/**
 * شلوغیِ نسبیِ اندازه‌گیری‌شده‌ی یک بازه، به درصد.
 *
 * مخرج عمداً **همه‌ی خانه‌های ممکنِ بازه** است (روز × ساعت)، نه فقط خانه‌هایی
 * که در `heat` آمده‌اند: کوئریِ منبع `GROUP BY` می‌زند، پس ساعتِ بدونِ رزرو
 * اصلاً ردیف ندارد. اگر روی خانه‌های موجود میانگین بگیریم، هر بازه‌ای که فقط
 * یک ساعتِ شلوغ داشته باشد ۱۰۰٪ نشان داده می‌شود — یعنی همان تورمِ کاذبی که
 * این بازنویسی برای رفعش انجام شد.
 */
function windowSharePct(
  heat: HeatCell[], dows: number[], fromHour: number, toHourExcl: number, maxCount: number,
): number {
  const cells = Math.max(1, dows.length) * Math.max(1, toHourExcl - fromHour);
  const total = heat.reduce(
    (s, c) => (dows.includes(c.dow) && c.hour >= fromHour && c.hour < toHourExcl ? s + c.count : s),
    0,
  );
  return Math.round((total / cells / maxCount) * 100);
}

/** ساعت‌های داغِ یکتا و مرتبِ مجموعه‌ای از روزها. */
function peakHoursOf(heat: HeatCell[], dows: number[], threshold: number): number[] {
  const hours = new Set<number>();
  for (const c of heat) if (dows.includes(c.dow) && c.count >= threshold) hours.add(c.hour);
  return [...hours].sort((a, b) => a - b);
}

/**
 * از داده‌ی heatmap (روز×ساعت) و مبلغِ پایه، قواعدِ قیمتِ پیشنهادی می‌سازد.
 * منطق: بازه‌های شلوغ → حداقل مبلغِ بالاتر (تقاضای بالا). بازه‌های خلوت → پیشنهادِ تخفیف.
 *
 * اگر شواهد کافی نباشد (`MIN_OBSERVATIONS`) آرایه‌ی خالی برمی‌گرداند؛ پنل در
 * این حالت پیامِ «با ثبتِ رزروِ بیشتر، سیستم الگوها رو پیدا می‌کنه» را نشان
 * می‌دهد — که دقیقاً حقیقت است.
 *
 * @param heat داده‌ی واقعیِ رزرو per (dow,hour)
 * @param baseMin مبلغِ پایه‌ی فعلی (اگر ۰ باشد، یک پایه‌ی محافظه‌کارانه فرض می‌شود)
 */
export function suggestPricing(heat: HeatCell[], baseMin: number): PricingSuggestion[] {
  // ردیف‌های خراب را کنار بگذار تا NaN در محاسبات پخش نشود (کوئریِ فعلی
  // همیشه سالم است؛ این محافظت از صداکننده‌ی بعدی است).
  const cells = heat.filter(c =>
    Number.isInteger(c.dow) && c.dow >= 0 && c.dow <= 6 &&
    Number.isInteger(c.hour) && c.hour >= 0 && c.hour <= 23 &&
    Number.isFinite(c.count) && c.count > 0);

  const observations = cells.reduce((s, c) => s + c.count, 0);
  if (observations < MIN_OBSERVATIONS) return [];

  const maxCount = Math.max(...cells.map(c => c.count), 1);
  const peakThreshold = maxCount * PEAK_RATIO;
  // مبلغِ مبنا: اگر رستوران چیزی نگذاشته، یک پایه‌ی محافظه‌کارانه فرض کن
  const base = baseMin > 0 ? baseMin : 300_000;

  // روزهایی که رستوران در آن‌ها واقعاً کار می‌کند (دستِ‌کم یک رزرو در بازه‌ی داده).
  const operatingDows = new Set(cells.map(c => c.dow));

  const suggestions: PricingSuggestion[] = [];

  /** یک پیشنهادِ «بازه‌ی شلوغ» از رویِ ساعت‌های داغِ واقعیِ همان روزها. */
  const pushPeakRule = (groupDows: number[], multiplier: number, groupLabel: string) => {
    const dows = groupDows.filter(d => operatingDows.has(d));
    const hours = peakHoursOf(cells, dows, peakThreshold);
    if (!dows.length || !hours.length) return;

    const fromHour = hours[0];
    const toHourExcl = hours[hours.length - 1] + 1;
    // فقط روزهایی که خودشان دستِ‌کم یک ساعتِ داغ دارند
    const peakDows = dows.filter(d => peakHoursOf(cells, [d], peakThreshold).length > 0);
    const from = hhmm(fromHour), to = hhmm(toHourExcl);
    const pct = windowSharePct(cells, peakDows, fromHour, toHourExcl, maxCount);

    suggestions.push({
      dows: peakDows,
      from, to,
      min_toman: roundToman(base * multiplier),
      label: `${groupLabel} — ${partOfDay(fromHour)}`,
      reason: `${faDows(peakDows)} بینِ ${from} تا ${to} شلوغ‌ترین بازه‌ی شماست `
        + `(${pct}٪ از شلوغ‌ترین ساعتِ رستوران)؛ حداقل مبلغِ بالاتر، تقاضای بالا را `
        + `متعادل می‌کند و درآمدِ هر میز را افزایش می‌دهد.`,
      occupancy_pct: pct,
    });
  };

  // ── قاعده ۱: شلوغ‌ترین بازه‌ی آخر هفته → بالاترین حداقل مبلغ ──
  pushPeakRule(WEEKEND_DOWS, 1.6, 'آخرِ هفته');

  // ── قاعده ۲: شلوغ‌ترین بازه‌ی وسطِ هفته → حداقل مبلغِ استاندارد ──
  pushPeakRule(MIDWEEK_DOWS, 1, 'وسطِ هفته');

  // ── قاعده ۳: ناهارِ وسطِ هفته اگر واقعاً خلوت باشد → پیشنهادِ تخفیف ──
  //
  // ⚠️ شرطِ «دستِ‌کم یک رزروِ ناهارِ مشاهده‌شده» عمدی است: بدونِ آن نمی‌توانیم
  // «خلوت» را از «اصلاً ناهار سرو نمی‌کند» تفکیک کنیم، و همان حالت بود که
  // قبلاً پیشنهادِ نصف‌کردنِ قیمت را به رستورانِ فقط-شام می‌داد.
  //
  // ⚠️ صداقتِ معامله: رستورانی که ناهار سرو می‌کند و در ۹۰ روز *صفر* رزروِ
  // ناهار دارد، بهترین نامزدِ این تخفیف است و حالا پیشنهاد نمی‌گیرد. این
  // هزینه را آگاهانه می‌پذیریم — چون از دیدِ `heat` این دو حالت عیناً یکسان‌اند
  // و ادعا نکردن بهتر از ادعای غلط است. تفکیکِ درست به ساعاتِ کاریِ رستوران
  // نیاز دارد (`hours.ts`) که امروز به این مسیر وصل نیست.
  const lunchDows = MIDWEEK_DOWS.filter(d => operatingDows.has(d));
  const lunchObserved = cells.some(c =>
    lunchDows.includes(c.dow) && c.hour >= LUNCH_FROM_HOUR && c.hour < LUNCH_TO_HOUR);
  if (lunchDows.length && lunchObserved) {
    const pct = windowSharePct(cells, lunchDows, LUNCH_FROM_HOUR, LUNCH_TO_HOUR, maxCount);
    if (pct < QUIET_RATIO * 100) {
      suggestions.push({
        dows: lunchDows,
        from: hhmm(LUNCH_FROM_HOUR), to: hhmm(LUNCH_TO_HOUR),
        min_toman: roundToman(base * 0.5),
        label: 'ناهارِ وسطِ هفته (خلوت)',
        reason: `ناهارِ وسطِ هفته فقط ${pct}٪ از شلوغ‌ترین ساعتِ شماست؛ حداقل مبلغِ `
          + `پایین‌تر (یا حذفِ آن) مشتری‌های حساس به قیمت را جذب می‌کند و میزهای خالی `
          + `را پر می‌کند — درآمدِ اضافه از ظرفیتِ بلااستفاده.`,
        occupancy_pct: pct,
      });
    }
  }

  return suggestions;
}
