// ═══════════════════════════════════════════════════════════════════════
//  media-store — نوشتن و خواندنِ فایلِ تصویر روی دیسک
//
//  بایت‌ها عمداً در Postgres ذخیره نمی‌شوند. یک گالریِ چندصد رستورانی چند
//  گیگابایت می‌شود و سرویسِ backup که pg_dump می‌گیرد عملاً از کار می‌افتد.
//  فایل روی ولومِ uploads می‌نشیند و دیتابیس فقط کلیدِ آن را نگه می‌دارد.
//
//  مسیرِ ریشه از UPLOAD_DIR می‌آید (در داکر: /data/uploads). در توسعه اگر
//  تنظیم نشده باشد به .uploads کنارِ پروژه می‌افتد تا بدونِ پیکربندی هم
//  بشود کار کرد.
// ═══════════════════════════════════════════════════════════════════════

import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { isValidStorageKey } from './media';

export function uploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR || join(process.cwd(), '.uploads'));
}

/**
 * کلید را به مسیرِ مطلق تبدیل می‌کند و مطمئن می‌شود از ریشه بیرون نمی‌زند.
 *
 * ⚠️ دو لایه دفاع، عمداً هر دو: اول الگوی سخت‌گیرانه‌ی isValidStorageKey و
 * بعد بررسیِ اینکه مسیرِ نهایی واقعاً زیرِ ریشه است. لایه‌ی دوم حتی اگر روزی
 * الگو شل شود هم جلوی path traversal را می‌گیرد.
 */
export function resolveKey(key: string): string | null {
  if (!isValidStorageKey(key)) return null;
  const root = uploadRoot();
  const full = resolve(join(root, key));
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

export async function putObject(key: string, bytes: Uint8Array): Promise<void> {
  const full = resolveKey(key);
  if (!full) throw new Error('کلیدِ ذخیره‌سازی نامعتبر است');
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function getObject(key: string): Promise<Buffer | null> {
  const full = resolveKey(key);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch {
    // فایلِ نبوده = ۴۰۴، نه ۵۰۰. (مثلاً ولوم تازه و ردیفِ قدیمی)
    return null;
  }
}

/**
 * حذفِ فایل. نبودنش خطا نیست: حذفِ ردیفِ دیتابیس نباید به‌خاطرِ فایلی که
 * قبلاً پاک شده شکست بخورد.
 */
export async function deleteObject(key: string): Promise<void> {
  const full = resolveKey(key);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    /* از قبل نبوده — همان نتیجه‌ی مطلوب */
  }
}
