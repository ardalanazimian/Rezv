import { db } from './db';
import { Err } from './errors';
import { enforceRateLimit, RULES } from './ratelimit';
import { normalizeUsername, verifyPassword } from './password';
import { createLogger } from './logger';

const log = createLogger('password-auth');

// ═══════════════════════════════════════════════════════════════════════
//  ورودِ کارکنان با نامِ کاربری و رمز — مسیرِ مشترکِ هر دو پنل
//
//  ⚠️ چرا یک تابعِ مشترک و نه دو پیاده‌سازی: مسیرِ ورودِ `staff` و
//  `platform-admin` تفاوتشان فقط در **مجوزِ بعد از احراز** است، نه در خودِ
//  احراز. دو نسخه‌ی موازی یعنی هر سخت‌سازیِ آینده باید دو بار انجام شود و
//  یکی‌شان فراموش می‌شود — دقیقاً همان چیزی که برای ریت‌لیمیتِ دستیِ OTP رخ
//  داد (رجوع کن به کامنتِ `requestOtp` در lib/otp.ts).
//
//  ── سه گاردی که این را از یک فرمِ لاگینِ ساده جدا می‌کند ──
//
//  ۱. **بدونِ نشتِ وجودِ حساب.** نامِ کاربریِ ناموجود و رمزِ اشتباه دقیقاً
//     یک خطا می‌دهند. اگر فرق می‌کردند، مهاجم می‌توانست فهرستِ حساب‌های
//     واقعی را ارزان بسازد و بعد فقط روی آن‌ها رمز حدس بزند.
//
//  ۲. **بدونِ اوراکلِ زمانی.** وقتی حساب پیدا نمی‌شود هم یک محاسبه‌ی
//     scryptِ ساختگی انجام می‌شود. بدونِ این، پاسخِ «کاربر نیست» ده‌ها
//     میلی‌ثانیه سریع‌تر برمی‌گشت و همان نشتِ بندِ ۱ را از راهِ زمان
//     می‌داد — گاردِ ۱ را بی‌اثر می‌کرد.
//
//  ۳. **ریت‌لیمیتِ دوبُعدی.** هم per-IP و هم per-username. فقط per-IP یعنی
//     یک بات‌نت با IPِ چرخان می‌تواند بی‌نهایت روی یک حساب حدس بزند.
//
//  ⚠️ ترتیب عمدی است: ریت‌لیمیت **قبل** از هر کوئری اجرا می‌شود، وگرنه خودِ
//  مسیرِ ورود یک تقویت‌کننده‌ی DB برای مهاجم است.
// ═══════════════════════════════════════════════════════════════════════

/** هشِ ساختگی برای مسیرِ «کاربر پیدا نشد» — تا زمانِ پاسخ لو ندهد. */
const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

export type PasswordAuthResult = Awaited<ReturnType<typeof db.staff.findFirst>>;

/**
 * نام کاربری و رمز را می‌سنجد و ردیفِ staff را برمی‌گرداند.
 * روی هر شکستی `Err.unauthorized` با **همان** پیام پرتاب می‌کند.
 *
 * @param ip برای ریت‌لیمیتِ per-IP — از `clientIp(req)` بده.
 */
export async function authenticateStaffByPassword(rawUsername: string, password: string, ip: string) {
  const username = normalizeUsername(rawUsername);

  // گاردِ ۳ — هر دو بُعد، پیش از هر کوئری.
  await enforceRateLimit(ip, RULES.passwordLogin);
  if (username) await enforceRateLimit(`u:${username}`, RULES.passwordLogin);

  const staff = username
    ? await db.staff.findUnique({
        where: { username },
        include: { tenant: { select: { id: true, name: true } } },
      })
    : null;

  // گاردِ ۲ — همیشه یک محاسبه‌ی scrypt انجام می‌شود، چه حساب باشد چه نباشد.
  const ok = await verifyPassword(password, staff?.passwordHash ?? DUMMY_HASH);

  // گاردِ ۱ — یک پیامِ واحد برای «نیست»، «رمز غلط» و «رمز اصلاً ست نشده».
  //
  // ⚠️ صادقانه، طبقِ جهش‌آزمایی: جزءِ `!staff.passwordHash` **افزونه** است.
  // با برداشتنش هیچ تستی قرمز نشد (۰ از ۱۵)، چون حسابِ بدونِ رمز از مسیرِ
  // `?? DUMMY_HASH` رد می‌شود و `verifyPassword` رویش همیشه false می‌دهد —
  // یعنی `!ok` خودش می‌گیردش. عمداً نگه داشته شده به‌عنوانِ لایه‌ی دوم و
  // برای خوانایی (نیت را صریح می‌کند)، ولی مرزِ امنیتی **اینجا نیست**؛
  // مرز `DUMMY_HASH` و `!ok` است. اگر روزی آن fallback را عوض کردی، این
  // خط نجاتت نمی‌دهد — تستِ «حسابی که رمز ندارد» را حتماً دوباره بزن.
  if (!staff || !staff.passwordHash || !ok) {
    throw Err.invalidCredentials();
  }

  // ⚠️ این **بعد** از سنجشِ رمز می‌آید، نه قبلش: اگر «حساب غیرفعال است» را
  // پیش از تأییدِ رمز می‌گفتیم، خودش یک اوراکلِ وجودِ حساب بود.
  if (!staff.isActive) {
    log.warn('ورودِ حسابِ غیرفعال رد شد', { staff_id: staff.id });
    throw Err.forbidden('این حساب غیرفعال شده است');
  }

  return staff;
}
