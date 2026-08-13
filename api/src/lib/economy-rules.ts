import { getPlatformSetting, setPlatformSetting } from './platform-settings';
import { audit } from './audit';

// ═══════════════════════════════════════════════════════════════════════
//  ویرایشگرِ قواعدِ اقتصاد (Economy Rule Editor، Company Control Plane،
//  فازِ ۴) — رویِ همون جدولِ platform_settings سوار شده (بدونِ migration).
//
//  ⚠️ محدوده‌یِ عمدیِ این ابزار: فقط اعدادِ پاداشِ رزروِ completed (که در
//  applyReliabilityEventToUserTx هاردکد بودن) قابلِ‌تنظیم شدن. آستانه‌هایِ
//  سطحِ اعتبار (computeReputationTier) و منطقِ محاسبه‌ی eventScore
//  (computeEventScore) عمداً دست‌نخورده ماندن — این‌ها توابعِ خالص و
//  تست‌واحددارِ هسته‌یِ اقتصادن؛ قابلِ‌تنظیم‌کردنشون از پنل یعنی یا باید
//  sync بمونن (که با خواندنِ async از DB نمی‌شه) یا کلِ امضاشون عوض بشه —
//  ریسکش برایِ فازِ اختیاریِ ۴ به ارزشش نمی‌ارزید.
//
//  پیش‌فرض‌ها دقیقاً همون اعدادی‌ان که قبلاً هاردکد بودن (xp:100, coins:20) —
//  یعنی تا وقتی ادمینی دستی تغییرشون نده، رفتارِ سیستم عوض نمی‌شه.
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_COMPLETED_XP = 100;
const DEFAULT_COMPLETED_COINS = 20;

export type EconomyRuleConfig = { completedXp: number; completedCoins: number };
export type EconomyRuleKey = 'completed_xp' | 'completed_coins';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** پاداشِ فعلیِ XP/سکه برایِ رزروِ completed — با کشِ ۳۰ثانیه‌ایِ platform-settings. */
export async function getEconomyRuleConfig(): Promise<EconomyRuleConfig> {
  const [xpRaw, coinsRaw] = await Promise.all([
    getPlatformSetting('economy_rule:completed_xp'),
    getPlatformSetting('economy_rule:completed_coins'),
  ]);
  return {
    completedXp: parsePositiveInt(xpRaw, DEFAULT_COMPLETED_XP),
    completedCoins: parsePositiveInt(coinsRaw, DEFAULT_COMPLETED_COINS),
  };
}

export async function setEconomyRule(key: EconomyRuleKey, value: number, adminId: string): Promise<void> {
  await setPlatformSetting(`economy_rule:${key}`, String(value), adminId);
  await audit({ action: 'economy_rule.update', actorId: adminId, actorType: 'admin', detail: { key, value } });
}
