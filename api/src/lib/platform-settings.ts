import { db } from './db';
import { cached, invalidatePattern } from './cache';
import { openSecret, sealSecret } from './secret-box';

// ⚠️ همگام‌سازی‌شده با DB زنده (migration 020_platform_settings_payment_toggle).
//
// تنظیماتِ سطح‌پلتفرم (کلید/مقدار ساده) — مثل merchant_id زرین‌پال، فلگ sandbox،
// کلید کاوه‌نگار — عمداً در دیتابیس نگه داشته می‌شوند نه فقط env، تا از پنل
// شرکت («تنظیمات پلتفرم») بدون نیاز به ری‌دیپلوی قابل‌ویرایش باشند.
// کش ۳۰ ثانیه‌ای تا هر request مستقیم دیتابیس نخورد.

const TTL_SEC = 30;

// ⚠️ S-05 (حکمِ D-24، ۲۰۲۶-۰۹-۱۷): اعتبارنامه‌ی ارائه‌دهنده فقط رمزشده در DB می‌نشیند
// (lib/secret-box.ts). کش هم همان متنِ رمز را نگه می‌دارد، نه متنِ ساده — Redis هم «در سکون» است.
// ردیفِ رمزنشده‌ی این کلیدها خطاست، نه fallback؛ مهاجرتش: maintenance/secrets-reseal?seal_plaintext=1.
export const SEALED_SETTING_KEYS: ReadonlySet<string> = new Set(['zarinpal_merchant_id']);

/** پاسخِ پنل برای کلیدِ رمزشده‌ای که مقدار دارد — مقدارِ خام هرگز برنمی‌گردد. */
export const SEALED_SETTING_MASK = '••••••••';

export const settingSealContext = (key: string) => `platform_settings:${key}`;

/** خواندنِ یک تنظیمِ پلتفرم (با کش). اگر در DB نبود، fallback به env. */
export async function getPlatformSetting(key: string, envFallback?: string): Promise<string | undefined> {
  const value = await cached(`platform-settings:${key}`, TTL_SEC, async () => {
    const row = await db.platformSettings.findUnique({ where: { key } });
    return row?.value ?? null;
  });
  if (value != null && SEALED_SETTING_KEYS.has(key)) return openSecret(value, settingSealContext(key));
  return value ?? envFallback ?? undefined;
}

/** نوشتنِ یک تنظیمِ پلتفرم (پنل شرکت). کش مربوطه بلافاصله باطل می‌شود. */
export async function setPlatformSetting(key: string, value: string, updatedByStaffId?: string): Promise<void> {
  const stored = SEALED_SETTING_KEYS.has(key) ? sealSecret(value, settingSealContext(key)) : value;
  await db.platformSettings.upsert({
    where: { key },
    create: { key, value: stored, updatedBy: updatedByStaffId },
    update: { value: stored, updatedBy: updatedByStaffId, updatedAt: new Date() },
  });
  await invalidatePattern(`platform-settings:${key}`);
}

/** همه‌ی تنظیماتِ زرین‌پال یک‌جا (برای پنل شرکت + lib/zarinpal.ts). */
export async function getZarinpalConfig(): Promise<{ merchantId: string | undefined; sandbox: boolean }> {
  const [merchantId, sandboxRaw] = await Promise.all([
    getPlatformSetting('zarinpal_merchant_id', process.env.ZARINPAL_MERCHANT_ID),
    getPlatformSetting('zarinpal_sandbox', process.env.ZARINPAL_SANDBOX),
  ]);
  return { merchantId, sandbox: sandboxRaw === 'true' };
}
