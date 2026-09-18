// ═══════════════════════════════════════════════════════════════════════
//  قراردادِ شواهدِ سفرهای طلایی — ساختِ فایلی که گیتِ A2 می‌خواند
//
//  این ماژول **هیچ سفری را اجرا نمی‌کند**. فقط نتیجه‌ی اجرا را به شکلی
//  می‌نویسد که `tools/gate-deploy.mjs` می‌خواند. مرزِ عمدی است:
//
//    runner مشاهده می‌کند · این فایل ثبت می‌کند · گیت داوری می‌کند
//
//  چرا این مرز (قانون‌نامه: «یک اسکریپت نمی‌تواند هم کاری را انجام دهد و هم
//  گواهی‌اش کند»): اگر runner بتواند فقط موفقیت بنویسد، همان JSONِ دست‌نویس
//  است با چند قدمِ اضافه. پس **نوشتنِ passed:false مسیرِ عادی است، نه خطا**.
//
//  و یک قاعده‌ی دوم که از بندِ ۴ منشور می‌آید: «نبودِ موضوع» هرگز pass نیست.
//  اگر محیطی وجود نداشته باشد، assertion وضعیتِ BLOCKED می‌گیرد و سفر
//  passed:false می‌شود. هیچ‌وقت «چیزی برای سنجیدن نبود پس سبز است».
// ═══════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** وضعیتِ یک assertion. عمداً سه‌تایی است، نه دوتایی. */
export const PASS = 'pass';
export const FAIL = 'fail';
/** محیط/پیش‌نیاز نبود. **pass نیست** و سفر را قرمز می‌کند. */
export const BLOCKED = 'blocked';

/**
 * یک assertion را ثبت می‌کند.
 * `raw` هر چیزی است که چشمِ انسان باید ببیند: پاسخِ خام، شمارش، تفاوت.
 */
export function record(id, title, status, detail, raw) {
  if (![PASS, FAIL, BLOCKED].includes(status)) {
    throw new Error(`وضعیتِ ناشناخته برای ${id}: ${status}`);
  }
  return { id, title, status, detail: detail ?? '', raw: raw ?? null };
}

/**
 * از نتایجِ assertionها یک ردیفِ journey می‌سازد.
 *
 * `passed` **مشتق** است، نه ورودی — هیچ صداکننده‌ای نمی‌تواند سفری را سبز
 * اعلام کند که assertionِ قرمز یا بلاک‌شده دارد. این تنها جای این مخزن است
 * که «سبز» تعریف می‌شود، و عمداً یک خط است تا خواندنش ارزان باشد.
 */
export function journey(name, baseUrl, assertions, network) {
  const failed = assertions.filter((a) => a.status !== PASS);
  const blocking = assertions.filter((a) => a.status === BLOCKED);
  return {
    name,
    base_url: baseUrl,
    passed: failed.length === 0 && assertions.length > 0,
    exit_code: failed.length === 0 && assertions.length > 0 ? 0 : 1,
    assertions,
    // «کدام assertion جلوی سفر را گرفت» — درخواستِ صریحِ CEO (۲۰۲۶-۰۹-۱۸):
    // فرقِ «لانچ بلاک است» با «دقیقاً این یک کار انجام نشده».
    blocked_by: blocking.map((a) => a.id),
    failed_by: assertions.filter((a) => a.status === FAIL).map((a) => a.id),
    raw_output_path: null, // صداکننده پر می‌کند
    network: network ?? null,
  };
}

/**
 * خروجیِ خامِ یک سفر را روی دیسک می‌نویسد و مسیرِ نسبی‌اش را برمی‌گرداند.
 * گیت وجودِ **فایل** را چک می‌کند، نه ادعای وجودش را.
 */
export function writeRaw(repoRoot, name, text) {
  const rel = join('audit', 'staging', 'raw', `${name}.log`);
  const abs = join(repoRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text, 'utf8');
  return rel.split('\\').join('/');
}

/**
 * فایلِ شواهد را می‌نویسد.
 *
 * ⚠️ `ci` از بیرون **کپی** می‌شود، محاسبه نمی‌شود. runner حق ندارد درباره‌ی
 * سبزیِ CI ادعا کند — سیستمی است که خودش اجرایش نکرده (بندِ ۴i منشور:
 * «سبز» یعنی شناسه‌ی اجرای CI روی همان sha).
 */
export function writeEvidence(repoRoot, { journeys, ci, rollback, secretsReseal }) {
  const rel = join('audit', 'staging', 'golden-journeys.json');
  const abs = join(repoRoot, rel);
  mkdirSync(dirname(abs), { recursive: true });

  const doc = {
    schema: 'rezervno.golden-journeys/1',
    completed_at: new Date().toISOString(),
    journeys,
    ci: ci ?? null,
    rollback: rollback ?? null,
    secrets_reseal: secretsReseal ?? null,
    // آنچه این فایل **نمی‌داند**، صریح. خواننده نباید از سکوت نتیجه بگیرد.
    not_measured_here: [
      'rollback — نیازمندِ دو استقرارِ واقعی؛ این runner استقرار نمی‌کند',
      'secrets_reseal — پاسخِ خامِ اپراتور روی همان استقرار',
      'تحویلِ پیامک به گوشیِ واقعی — فقط پذیرشِ ارائه‌دهنده ماشینی سنجیده می‌شود',
    ],
  };

  writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { rel: rel.split('\\').join('/'), doc };
}
