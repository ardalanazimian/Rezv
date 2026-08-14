-- رفعِ سخت‌گیرانه‌ترِ امنیتی (ممیزیِ acquisition-grade، ۲۰۲۶-۰۸-۱۴):
-- guestAccessToken (migration 041) تا الان خام (plaintext) در
-- waitlist_entries.guest_access_token ذخیره می‌شد — این با الگویِ موجودِ
-- خودِ پروژه برایِ رازهایِ ذخیره‌شده در DB ناسازگار بود (قیاس کن با
-- otp_codes.code_hash در api/src/lib/otp.ts: `sha256(code + JWT_SECRET)`،
-- هرگز خودِ کد). حالا همون الگو برایِ guest token هم پیاده می‌شه: فقط
-- guest_access_token_hash ذخیره می‌شه؛ توکنِ خام هیچ‌وقت به DB نمی‌رسه.
--
-- اثر روی دیتایِ موجود: ورودی‌هایِ مهمانِ فعال (waiting/offered) که قبل از
-- این migration با guest_access_token خام ساخته شده‌اند، بعدِ این تغییر
-- دیگر با همان توکنِ قدیمی قابلِ accept/decline/leave نیستند (هیچ hashی
-- برایشان ذخیره نشده) — روی محیطِ دمو/استیجِ فعلی (این فیچر همین امروز در
-- همین نشست merge شد) قابلِ‌قبول است؛ روی یک استقرارِ واقعی با کاربرانِ
-- فعال، باید قبل از اجرا با یک بازه‌ی خاموشیِ کوتاه هماهنگ شود (این تغییرِ
-- شکنندهٔ دیتا، نه API عمومی، است — شکلِ خروجیِ join/accept/decline/leave
-- برایِ کلاینت کاملاً یکسان می‌ماند).
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS guest_access_token_hash text;

-- ستونِ خامِ قبلی دیگر استفاده نمی‌شود؛ نگه‌داشتنِ یک رازِ خام و بلااستفاده
-- در DB خودش یک بدهیِ امنیتیِ اضافه است، پس حذفش می‌کنیم.
ALTER TABLE waitlist_entries DROP COLUMN IF EXISTS guest_access_token;
