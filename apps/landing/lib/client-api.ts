'use client';

// ═══════════════════════════════════════════════════════════════════════
//  کلاینتِ سمتِ مرورگر برای فرم‌های سایت (دمو، خرید، تماس)
//
//  یک لایه‌ی نازک روی fetch که سه کارِ تکراری را یک‌جا انجام می‌دهد:
//    • ساختِ آدرسِ API از NEXT_PUBLIC_API_BASE
//    • بیرون‌کشیدنِ پیامِ خطای فارسیِ بک‌اند (به‌جای «خطای ناشناخته»)
//    • ضمیمه‌کردنِ انتسابِ کمپین (UTM و مسیرِ فرود) به هر ثبتِ سرنخ
// ═══════════════════════════════════════════════════════════════════════

const BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

/** آیا API برای مرورگر پیکربندی شده؟ فرم‌ها با این تصمیم می‌گیرند غیرفعال شوند. */
export function isApiConfigured(): boolean {
  return Boolean(BASE);
}

interface ErrorBody { error?: { code?: string; message?: string } }

export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!BASE) {
    throw new ApiError('ارتباط با سرور پیکربندی نشده است. لطفاً با پشتیبانی تماس بگیرید.', 'NO_API_BASE', 0);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('ارتباط با سرور برقرار نشد. اتصالِ اینترنت را بررسی کنید.', 'NETWORK', 0);
  }

  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* پاسخِ غیر-JSON */ }

  if (!res.ok) {
    const err = (json as ErrorBody | null)?.error;
    const message =
      err?.message ??
      (res.status === 429
        ? 'تعدادِ درخواست بیش از حدِ مجاز است. کمی بعد دوباره تلاش کنید.'
        : 'ثبتِ درخواست ناموفق بود. لطفاً دوباره تلاش کنید.');
    throw new ApiError(message, err?.code ?? `HTTP_${res.status}`, res.status);
  }

  return json as T;
}

/**
 * انتسابِ کمپین از URLِ فعلی. بدونِ کوکی و بدونِ ردیابیِ شخصِ ثالث — فقط
 * پارامترهایی که خودِ کاربر با کلیک روی لینک آورده، همراهِ همان یک ثبت.
 */
export function attribution(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const out: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const v = params.get(key);
    if (v) out[key] = v.slice(0, 120);
  }
  out.landing_path = window.location.pathname.slice(0, 300);
  if (document.referrer) out.referrer = document.referrer.slice(0, 300);
  return out;
}

// ── اعتبارسنجیِ سمتِ کلاینت (آینه‌ی قواعدِ سرور، برای بازخوردِ فوری) ──
// سرور همیشه دوباره اعتبارسنجی می‌کند؛ این فقط برای تجربه‌ی کاربر است.

export function validatePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 'شماره‌ی موبایل الزامی است';
  if (!/^09\d{9}$/.test(digits) && !/^989\d{9}$/.test(digits)) {
    return 'شماره‌ی موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)';
  }
  return null;
}

export function validateRequired(value: string, label: string, min = 2): string | null {
  const v = value.trim();
  if (!v) return `${label} الزامی است`;
  if (v.length < min) return `${label} باید حداقل ${min} نویسه باشد`;
  return null;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return null; // اختیاری
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'ایمیل معتبر نیست';
  return null;
}
