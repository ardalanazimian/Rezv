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
] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

const FLAG_LABEL: Record<FeatureFlagKey, string> = {
  reservations_enabled: 'ثبتِ رزروِ آنلاین',
  waitlist_enabled: 'پیوستن به لیستِ انتظار',
  reward_marketplace_enabled: 'خرجِ سکه در فروشگاهِ جایزه',
  missions_claim_enabled: 'دریافتِ جایزه‌یِ ماموریت',
  ai_recommendations_enabled: 'پیشنهادهایِ هوشمند',
};
export function featureFlagLabel(key: FeatureFlagKey): string { return FLAG_LABEL[key]; }

/** آیا این قابلیت الان فعال است؟ پیش‌فرضِ نبودِ کلید = فعال (fail-open، نه fail-closed). */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const raw = await getPlatformSetting(`feature_flag:${key}`);
  if (raw === undefined) return true;
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
