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

// ═══════════════════════════════════════════════════════════════════════
//  حلقه‌ی کلیدِ رازهای ذخیره‌شده (S-05، حکمِ D-24 ی CEO، ۲۰۲۶-۰۹-۱۷)
//
//  اعتبارنامه‌هایی که سرور باید دوباره بخواندشان (merchant_idِ زرین‌پال،
//  secretِ وب‌هوک) با AES-256-GCM در DB می‌نشینند (`lib/secret-box.ts`). کلید
//  **فقط** در env است، هرگز کنارِ متنِ رمز:
//    SECRETS_KEYRING="k2026a:<base64 ی ۳۲ بایت>,k2026b:<base64 ی ۳۲ بایت>"
//    SECRETS_ACTIVE_KEY_ID="k2026b"
//  هر متنِ رمز شناسه‌ی کلیدش را با خود دارد؛ چرخش = افزودنِ کلیدِ تازه، فعال‌کردنش،
//  اجرای maintenance/secrets-reseal، و فقط بعد حذفِ کلیدِ قبلی.
//
//  تجزیه این‌جاست (نه در secret-box.ts) تا middleware بدونِ node:crypto همان
//  قاعده را در بوتِ production بسنجد. پیام‌ها هرگز خودِ کلید را نمی‌آورند.
// ═══════════════════════════════════════════════════════════════════════

export type SecretsKeyringEntry = { id: string; keyBase64: string };

const KEYRING_ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
// base64ِ استانداردِ دقیقاً ۳۲ بایت = ۴۳ نویسه + یک «=».
const KEY_32_BASE64_RE = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;

export function parseSecretsKeyring(raw: string | undefined, activeId: string | undefined): {
  entries: SecretsKeyringEntry[]; activeId: string; problems: string[];
} {
  const problems: string[] = [];
  const entries: SecretsKeyringEntry[] = [];
  const text = (raw ?? '').trim();
  if (!text) {
    problems.push(
      'SECRETS_KEYRING تنظیم نشده — اعتبارنامه‌های ذخیره‌شده (merchant_idِ زرین‌پال، secretِ وب‌هوک) ' +
      'بدونِ آن نه نوشته می‌شوند نه خوانده. بساز:  echo "k1:$(openssl rand -base64 32)"',
    );
  } else {
    text.split(',').forEach((part, i) => {
      const item = part.trim();
      const sep = item.indexOf(':');
      const id = sep > 0 ? item.slice(0, sep) : '';
      const keyBase64 = sep > 0 ? item.slice(sep + 1) : '';
      if (!KEYRING_ID_RE.test(id)) {
        problems.push(`ورودیِ شماره‌ی ${i + 1} ی SECRETS_KEYRING شکلِ «id:base64» با idِ [a-z0-9_-] ندارد`);
        return;
      }
      if (entries.some((e) => e.id === id)) {
        problems.push(`شناسه‌ی کلیدِ «${id}» در SECRETS_KEYRING تکراری است`);
        return;
      }
      if (!KEY_32_BASE64_RE.test(keyBase64)) {
        problems.push(`کلیدِ «${id}» در SECRETS_KEYRING دقیقاً ۳۲ بایتِ base64 نیست (openssl rand -base64 32)`);
        return;
      }
      if (/^A{43}=$/.test(keyBase64)) {
        problems.push(`کلیدِ «${id}» در SECRETS_KEYRING تمام‌صفر است — مقدارِ نمونه، نه کلید`);
        return;
      }
      entries.push({ id, keyBase64 });
    });
  }
  const active = (activeId ?? '').trim();
  if (text && !active) {
    problems.push('SECRETS_ACTIVE_KEY_ID تنظیم نشده — معلوم نیست رازِ تازه با کدام کلید رمز شود');
  } else if (active && problems.length === 0 && !entries.some((e) => e.id === active)) {
    // وقتی خودِ ورودی‌ها ایراد دارند، «فعال در حلقه نیست» پیامدِ همان ایراد است، نه ایرادِ دوم.
    problems.push(`SECRETS_ACTIVE_KEY_ID=«${active}» در SECRETS_KEYRING نیست`);
  }
  return { entries, activeId: active, problems };
}

/**
 * ایرادهای رازهای حیاتی در production. آرایه‌ی خالی = سالم.
 * (تابع خالص است تا تست بتواند بدونِ دست‌کاریِ process.env سنجشش کند.)
 */
export function productionSecretProblems(env: {
  OTP_DEV_MODE?: string;
  MAINTENANCE_KEY?: string;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  SECRETS_KEYRING?: string;
  SECRETS_ACTIVE_KEY_ID?: string;
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

  // ⚠️ افزوده‌ی ۲۰۲۶-۰۹-۱۲ — شکافی که پچِ سخت‌سازیِ env نبسته بود:
  // مخزن **دو** فایلِ `.env.example` دارد و فقط ریشه‌ای‌اش امن شد.
  // `api/.env.example` همان فایلی است که `docs/ENVIRONMENT.md` «فهرستِ مرجعِ
  // runtimeِ بک‌اند» می‌نامدش و `docs/DEPLOY_API_VERCEL.md` صریح می‌گوید
  // مقادیرِ Vercel را از آن بردار — و `JWT_SECRET=change-me-very-long-random-string`
  // می‌داد. آن رشته **۳۳** کاراکتر است، پس تنها گاردِ موجود
  // (`lib/jwt.ts`: طول ≥ ۳۲) از آن عبور می‌کرد و هیچ‌جا `isPlaceholderSecret`
  // روی کلیدهای JWT صدا زده نمی‌شد. نتیجه‌ی عملی: دیپلویی که دقیقاً runbookِ
  // خودِ این مخزن را اجرا کند، با کلیدِ امضایی بالا می‌آید که در تاریخچه‌ی
  // گیتِ عمومی هست — یعنی جعلِ توکنِ هر مشتری و هر مالک. **طول، جانشین‌بودن
  // را رد نمی‌کند.**
  for (const [name, value] of [
    ['JWT_SECRET', env.JWT_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
  ] as const) {
    if (isPlaceholderSecret(value)) {
      problems.push(
        `${name} تنظیم نشده یا هنوز مقدارِ نمونه است — با کلیدی که در مخزنِ عمومی ` +
        'هست هر کسی می‌تواند توکنِ هر کاربری را جعل کند. یک مقدارِ واقعی بساز:  ' +
        'openssl rand -hex 32',
      );
    }
  }

  // S-05 (D-24): بدونِ حلقه‌ی کلید، سرور در production بالا نمی‌آید — نه اینکه
  // اولین پرداخت یا اولین تحویلِ وب‌هوک با خطای رمزگشایی بشکند.
  problems.push(...parseSecretsKeyring(env.SECRETS_KEYRING, env.SECRETS_ACTIVE_KEY_ID).problems);

  return problems;
}
