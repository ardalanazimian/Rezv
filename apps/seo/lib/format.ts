// قالب‌بندیِ فارسی — یک منبع برای همه‌ی صفحه‌ها تا عددها همه‌جا یک شکل باشند.

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** ارقامِ لاتین → فارسی (جداکننده‌ی هزارگان دست‌نخورده می‌ماند). */
export function fa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** عدد با جداکننده‌ی هزارگان و ارقامِ فارسی: ۶۵٬۰۰۰٬۰۰۰ */
export function faNum(n: number): string {
  return fa(Math.round(n).toLocaleString('en-US')).replace(/,/g, '٬');
}

/** مبلغ به تومان — «۶۵٬۰۰۰٬۰۰۰ تومان» */
export function toman(n: number): string {
  return `${faNum(n)} تومان`;
}

/**
 * مبلغِ فشرده برای کارتِ قیمت: «۶۵ میلیون تومان».
 * زیرِ یک میلیون به شکلِ کامل نمایش داده می‌شود تا گِرد‌کردن گمراه‌کننده نباشد.
 */
export function tomanShort(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const label = Number.isInteger(m) ? faNum(m) : fa(m.toFixed(1));
    return `${label} میلیون تومان`;
  }
  return toman(n);
}

const FA_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/**
 * تاریخِ شمسی خوانا: «۱۴ مرداد ۱۴۰۵».
 * از Intl با تقویمِ فارسی استفاده می‌کند و اگر محیط پشتیبانی نکرد به
 * تاریخِ میلادیِ فارسی‌شده برمی‌گردد (به‌جای پرتابِ خطا در زمانِ رندر).
 */
export function faDate(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Tehran',
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const month = Number(get('month').replace(/[۰-۹]/g, (c) => String(FA_DIGITS.indexOf(c))));
    return `${get('day')} ${FA_MONTHS[month - 1] ?? ''} ${get('year')}`.trim();
  } catch {
    return fa(d.toISOString().slice(0, 10));
  }
}

/** فاصله‌ی زمانیِ خوانا برای «۳ روز پیش» در فهرستِ سفارش/مقاله. */
export function faRelative(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  const diffDays = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'امروز';
  if (diffDays === 1) return 'دیروز';
  if (diffDays < 30) return `${fa(diffDays)} روز پیش`;
  if (diffDays < 365) return `${fa(Math.round(diffDays / 30))} ماه پیش`;
  return `${fa(Math.round(diffDays / 365))} سال پیش`;
}
