import { getPlatformSetting, setPlatformSetting } from './platform-settings';
import { audit } from './audit';

// ═══════════════════════════════════════════════════════════════════════
//  سوییچ‌هایِ قابلیت (kill-switch) — Company Control Plane، فازِ ۳ (B6)
//
//  رویِ همون جدولِ platform_settings (کلید/مقدار، کشِ ۳۰ثانیه‌ای) سوار
//  می‌شود — بدونِ migrationِ تازه. پیش‌فرض (کلید در DB نیست) = فعال، تا
//  نصبِ تازه/سرویسِ موجود بدونِ تنظیمِ دستی هیچ رفتاری تغییر نکند.
// ═══════════════════════════════════════════════════════════════════════

export const FEATURE_FLAG_KEYS = [
  'reservations_enabled',
  'waitlist_enabled',
  'reward_marketplace_enabled',
  'missions_claim_enabled',
  'ai_recommendations_enabled',
  'gift_card_purchase_enabled',
  'admin_otp_login_enabled',
] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

const FLAG_LABEL: Record<FeatureFlagKey, string> = {
  reservations_enabled: 'ثبتِ رزروِ آنلاین',
  waitlist_enabled: 'پیوستن به لیستِ انتظار',
  reward_marketplace_enabled: 'خرجِ سکه در فروشگاهِ جایزه',
  missions_claim_enabled: 'دریافتِ جایزه‌یِ ماموریت',
  ai_recommendations_enabled: 'پیشنهادهایِ هوشمند',
  gift_card_purchase_enabled: 'خریدِ کارتِ هدیه',
  admin_otp_login_enabled: 'ورودِ پنلِ شرکت با پیامک (OTP)',
};

// ═══════════════════════════════════════════════════════════════════════
//  فلگ‌هایی که پیش‌فرضشان **خاموش** است (fail-closed) — استثنایِ آگاهانه
//
//  قاعده‌ی کلیِ این ماژول fail-open است (نبودِ کلید = فعال) تا نصبِ تازه
//  بدونِ تنظیمِ دستی کار کند. ولی یک قابلیت که در وضعیتِ فعلی‌اش **ارزشِ
//  پولیِ واقعی و خرج‌شدنی تولید می‌کند بدونِ هیچ مرحله‌ی پرداخت**، نباید
//  به‌صورتِ پیش‌فرض روشن باشد — آن‌جا fail-open یعنی «پیش‌فرض: پولِ رایگان».
//
//  gift_card_purchase_enabled (فازِ ۲): مسیرِ POST /api/v1/gift-cards یک
//  GiftCard با balanceToman برابرِ مبلغِ درخواستی و وضعیتِ active می‌سازد،
//  و آن کارت در reservations.ts از طریقِ redeemGiftCardTx رویِ صورت‌حسابِ
//  واقعیِ رستوران خرج می‌شود. هیچ درگاهِ پرداختی در این مسیر نیست.
//  تا وقتی پرداخت (zarinpal، که برایِ بیعانه از قبل هست) به این جریان وصل
//  نشده، پیش‌فرض باید خاموش بماند.
// ═══════════════════════════════════════════════════════════════════════
//  admin_otp_login_enabled (۲۰۲۶-۰۹-۰۲): مسیرِ OTPِ پنلِ شرکت
//  (`auth/admin/request|verify`) همان principalِ platform-admin را صادر
//  می‌کند **بدونِ اینکه TOTP بخواهد** — یعنی عاملِ سومی که در
//  `auth/admin/login` ساخته شد را کاملاً دور می‌زند. تا وقتی آن مسیر
//  زنده باشد، ورودِ سه‌عاملی یک درِ باز پشتِ سرش دارد.
//  پس پیش‌فرض **خاموش**: هرکس عمداً روشنش کند، آگاهانه عاملِ سوم را
//  کنار گذاشته است.
const DEFAULT_OFF: ReadonlySet<string> = new Set<FeatureFlagKey>([
  'gift_card_purchase_enabled',
  'admin_otp_login_enabled',
]);
export function featureFlagLabel(key: FeatureFlagKey): string { return FLAG_LABEL[key]; }

/** آیا این قابلیت الان فعال است؟ پیش‌فرضِ نبودِ کلید = فعال (fail-open، نه fail-closed). */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const raw = await getPlatformSetting(`feature_flag:${key}`);
  if (raw === undefined) return !DEFAULT_OFF.has(key);
  return raw !== 'false';
}

export async function getAllFeatureFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const entries = await Promise.all(FEATURE_FLAG_KEYS.map(async k => [k, await isFeatureEnabled(k)] as const));
  return Object.fromEntries(entries) as Record<FeatureFlagKey, boolean>;
}

export async function setFeatureFlag(key: FeatureFlagKey, enabled: boolean, adminId: string): Promise<void> {
  await setPlatformSetting(`feature_flag:${key}`, enabled ? 'true' : 'false', adminId);
  await audit({ action: 'feature_flag.update', actorId: adminId, actorType: 'admin', detail: { key, enabled } });
}
