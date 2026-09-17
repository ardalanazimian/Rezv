// ═══════════════════════════════════════════════════════════════════════
//  پیش‌فرض‌های محیطِ تست — باید «اولین» importِ _all.runner.mts باشد.
//
//  ⚠️ چرا ماژولِ جدا و نه چند خط بالای runner (تله‌ی واقعیِ ۲۰۲۶-۰۸-۲۴):
//  در ESM همه‌ی importها hoist می‌شوند و پیش از هر statementِ بدنه اجرا
//  می‌شوند. یعنی «process.env.X ??= ...» که بالای runner نوشته شود، عملاً
//  *بعد از* لودِ lib/redis.ts اجرا می‌شود و بی‌اثر است. تنها راهِ تضمینِ
//  ترتیب، سایدافکت در ماژولی است که پیش از بقیه import شود.
//
//  چرا این envها: lib/redis.ts (به‌درستی برای تولید) commandTimeout=250ms
//  دارد. این runner ~۹۰ فایلِ تست را در «یک» پروسه اجرا می‌کند و event loop
//  زیرِ بارِ transpile/DB کند می‌شود؛ تایمرِ ioredis دیر شلیک می‌شد، یک hookِ
//  سراسری می‌مرد و node:test همه‌ی ۹۰۰+ تست را cancel می‌کرد — بدونِ حتی یک
//  پیامِ خطای مرتبط. فقط پیش‌فرضِ تست است؛ مقدارِ ست‌شده‌ی بیرونی می‌بَرد و
//  محصول همان ۲۵۰msِ سختگیرانه را نگه می‌دارد.
import { randomBytes } from 'node:crypto';

process.env.REDIS_COMMAND_TIMEOUT_MS ??= '8000';
process.env.REDIS_CONNECT_TIMEOUT_MS ??= '8000';
// هرمتیک‌بودنِ سوئیت (P0-011): بدونِ این، api/.env ی محلی (ADMIN_LOGIN_ENABLED=true)
// نتیجه‌ی اجرای کامل را عوض می‌کرد در حالی که CI (بدونِ .env) سبز بود. هوکِ تستی که
// عمداً عاملِ سوم را می‌خواهد بعد از importها اجرا می‌شود و این را override می‌کند.
process.env.ADMIN_LOGIN_ENABLED = 'false';
// S-05 (D-24): حلقه‌ی کلیدِ رازها فقط برای تست — در هر پروسه تازه ساخته می‌شود، پس هیچ کلیدی
// در مخزن نیست. عمداً `=` نه `??=`: کلیدِ واقعیِ api/.env ی محلی نباید واردِ سوئیت شود.
process.env.SECRETS_KEYRING = `test:${randomBytes(32).toString('base64')}`;
process.env.SECRETS_ACTIVE_KEY_ID = 'test';
export {};
