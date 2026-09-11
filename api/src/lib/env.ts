// ═══════════════════════════════════════════════════════════════════════
//  پیکربندیِ محیط — تشخیصِ «مقدارِ جانشین» و گاردِ رازهای production
//
//  چرا این فایل: دو متغیر در `.env.example` مقدارِ پیش‌فرضِ خطرناک داشتند و
//  هیچ‌کدام در زمانِ بالا آمدن چک نمی‌شدند:
//
//   • `OTP_DEV_MODE=true` — یعنی کدِ OTP در پاسخِ API برمی‌گردد (بای‌پسِ کاملِ
//     احراز هویت). گاردِ موجود (`lib/otp.ts`) **per-request** است: اپ سالم بالا
//     می‌آید، همه‌چیز سبز به‌نظر می‌رسد، و فقط وقتی اولین کاربرِ واقعی می‌خواهد
//     وارد شود یک ۵۰۰ی بی‌توضیح می‌گیرد. یعنی خطایِ پیکربندی به شکلِ «ورود خراب
//     است» ظاهر می‌شود، نه «سرور بالا نیامد».
//   • `MAINTENANCE_KEY=change-me-random-string` — کلیدی که مسیرهایی مثلِ
//     `maintenance/retention` (پاک‌کننده‌ی داده) را باز می‌کند. هر کسی که
//     `.env.example` را خوانده باشد این رشته را می‌داند، و کد بدونِ هیچ اعتراضی
//     همین مقدار را می‌پذیرفت.
//
//  این ماژول عمداً **بدونِ وابستگی** است (نه next، نه prisma، نه redis) تا هم
//  در middleware و هم در تستِ واحد بدونِ هیچ محیطی قابلِ استفاده باشد — همان
//  نقشی که `parseAllowedOrigins` در lib/security.ts برای ALLOWED_ORIGINS دارد.
// ═══════════════════════════════════════════════════════════════════════

/** مقادیرِ جانشینی که در `.env.example` و نمونه‌های مستندات آمده‌اند. */
export const KNOWN_PLACEHOLDER_SECRETS = [
  'change-me',
  'changeme',
  'change-me-random-string',
  'change-me-random-hex',
  'change-me-strong-password',
  'your-secret-here',
  'secret',
  'todo',
];

/**
 * آیا این مقدار یک «رازِ واقعی» نیست؟ (خالی، یا یکی از جانشین‌های شناخته‌شده،
 * یا هر چیزی که با change-me/changeme شروع شود.)
 *
 * ⚠️ الگو عمداً محدود است: یک کلیدِ واقعیِ `openssl rand -hex 32` هرگز با
 * «change» شروع نمی‌شود، پس این تشخیص هیچ‌وقت یک رازِ درست را رد نمی‌کند.
 */
export function isPlaceholderSecret(value: string | undefined | null): boolean {
  const v = (value ?? '').trim();
  if (!v) return true;
  const lower = v.toLowerCase();
  if (lower.startsWith('change-me') || lower.startsWith('changeme')) return true;
  return KNOWN_PLACEHOLDER_SECRETS.includes(lower);
}

/**
 * ایرادهای رازهای حیاتی در production. آرایه‌ی خالی = سالم.
 * (تابع خالص است تا تست بتواند بدونِ دست‌کاریِ process.env سنجشش کند.)
 */
export function productionSecretProblems(env: {
  OTP_DEV_MODE?: string;
  MAINTENANCE_KEY?: string;
}): string[] {
  const problems: string[] = [];

  if (env.OTP_DEV_MODE?.trim() === 'true') {
    problems.push(
      'OTP_DEV_MODE=true در production یعنی کدِ تأییدِ ورود در پاسخِ API برمی‌گردد ' +
      '(بای‌پسِ کاملِ احراز هویت). روی false بگذار.',
    );
  }

  if (isPlaceholderSecret(env.MAINTENANCE_KEY)) {
    problems.push(
      'MAINTENANCE_KEY تنظیم نشده یا هنوز مقدارِ نمونه‌ی `.env.example` است — ' +
      'همین کلید مسیرهای نگه‌داری (از جمله maintenance/retention که داده پاک می‌کند) ' +
      'را باز می‌کند. یک مقدارِ واقعی بساز:  openssl rand -hex 32',
    );
  }

  return problems;
}
