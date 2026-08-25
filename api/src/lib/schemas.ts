// ═══════════════════════════════════════════════════════════
//  پرایمیتیوهای مشترکِ Validation + helperهای پارس بدنه/کوئری/پارام.
//
//  همه‌ی روت‌ها باید از اینجا (نه مستقیم از './validate') schema بسازند تا
//  قوانین دامنه (فرمت شماره، تاریخ، UUID و ...) یک‌جا تعریف و یکدست بمانند.
// ═══════════════════════════════════════════════════════════
import { z, Schema, Infer } from './validate';
import { safeJson } from './security';

export type { Infer };
export { safeJson, z };
export type { Schema };

// ── پرایمیتیوهای دامنه ──

/** شماره‌ی موبایل خام — فرمتِ دقیق را normalizePhone در lib/otp.ts چک می‌کند؛
 *  این فقط جلوی رشته‌های خالی/بیش‌ازحد بزرگ را به‌عنوان دفاع در عمق می‌گیرد. */
// ⚠️ سخت‌گیرانه شد (ممیزیِ امنیت ۲۰۲۶-۰۸-۲۴، پروتکل §۲۸):
// قبلاً `z.string().min(8).max(20).trim()` بود — **هیچ قالبی** را الزام نمی‌کرد،
// یعنی سرور هر رشته‌ی ۸ تا ۲۰ کاراکتری را به‌عنوانِ «شماره‌ی موبایل» می‌پذیرفت،
// از جمله `"><svg onload=…>`. سه endpointِ **عمومی و بدونِ احراز هویت**
// (`/site/contact`, `/site/orders`, `/site/trial`) از همین استفاده می‌کنند و
// خروجی‌شان در پنلِ شرکت به مدیرِ پلتفرم نشان داده می‌شود.
//
// امروز قابلِ بهره‌برداری **نبود** — پنلِ شرکت همه‌جا `esc()` می‌زند — ولی
// اتکا به لایه‌ی رندر تنها دفاع بود. مهم‌تر: کلاینت‌ها از سرور **سخت‌گیرتر**
// بودند (همه `^09\d{9}$` را الزام می‌کنند)، یعنی اعتبارسنجیِ واقعی فقط سمتِ
// کلاینت بود — دقیقاً وارونه‌ی چیزی که §۲۸ می‌خواهد.
//
// این regex فقط «شکلِ شماره» را تضمین می‌کند (رقم + جداکننده‌های متعارف،
// ۸ تا ۱۵ رقم). درستیِ معناییِ شماره‌ی ایران همچنان کارِ `normalizePhone`
// در lib/otp.ts است — دو لایه، نه یکی.
export const zPhone = z
  .string()
  .min(8)
  .max(20)
  .trim()
  .regex(/^(?=(?:\D*\d){8,15}\D*$)\+?[\d][\d\s().-]*$/, 'شماره‌ی تماس معتبر نیست');

/** کد OTP — بین اپ‌ها ۴ رقمی (دمو) و ۶ رقمی (واقعی) هر دو پذیرفته می‌شوند. */
export const zOtpCode = z.string().regex(/^\d{4,6}$/, 'کد باید ۴ تا ۶ رقم باشد');

export const zUuid = z.string().uuid();

export const zDateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ باید به‌فرمت YYYY-MM-DD باشد');

export const zTimeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'زمان باید به‌فرمت HH:mm باشد');

export const zPartySize = z.number().int().min(1).max(30);

/** کد رزرو: RZ + ۷ کاراکتر Base32 بدون 0/O/1/I (هم‌راستا با genReservationCode). */
export const zReservationCode = z.string().regex(/^RZ[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/, 'کد رزرو نامعتبر است');

/** پارس + اعتبارسنجیِ بدنه‌ی JSON درخواست طبق schema (safeJson از lib/security.ts سقفِ حجم را اعمال می‌کند). */
export async function parseBody<T>(req: Request, schema: Schema<T>): Promise<T> {
  const json = await safeJson(req);
  return schema.parse(json);
}

/** پارس + اعتبارسنجیِ query string طبق schema (مقادیر همیشه رشته‌اند مگر schema تبدیل کند). */
export function parseQuery<T>(req: Request, schema: Schema<T>): T {
  const url = new URL(req.url);
  const obj = Object.fromEntries(url.searchParams.entries());
  return schema.parse(obj);
}

/** پارس + اعتبارسنجیِ پارامترهای مسیر (params) طبق schema — برای روت‌های داینامیک مثل [code]. */
export function parseParams<T>(params: Record<string, string | string[] | undefined>, schema: Schema<T>): T {
  return schema.parse(params);
}
