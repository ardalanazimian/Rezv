'use client';

// ═══════════════════════════════════════════════════════════════════════
//  کلاینتِ استودیو — همان API پنلِ شرکت، با احرازِ هویتِ مدیرِ پلتفرم
//
//  توکن در sessionStorage نگه داشته می‌شود (نه localStorage): با بستنِ تب
//  از بین می‌رود، که برای یک کنسولِ مدیریتی رفتارِ درست‌تری است.
// ═══════════════════════════════════════════════════════════════════════

import { ApiError } from './client-api';

const BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
const TOKEN_KEY = 'rz_studio_token';

export function studioApiConfigured(): boolean {
  return Boolean(BASE);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* حالتِ خصوصی مرورگر */ }
}

interface ErrorBody { error?: { code?: string; message?: string } }

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  auth = true,
): Promise<T> {
  if (!BASE) throw new ApiError('آدرسِ API پیکربندی نشده است.', 'NO_API_BASE', 0);

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (!token) throw new ApiError('ابتدا وارد شوید.', 'UNAUTHORIZED', 401);
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('ارتباط با سرور برقرار نشد.', 'NETWORK', 0);
  }

  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* پاسخِ غیر-JSON */ }

  if (!res.ok) {
    // توکنِ منقضی → پاک کن تا کاربر دوباره وارد شود، نه اینکه در حلقه‌ی خطا بماند.
    if (res.status === 401) setToken(null);
    const err = (json as ErrorBody | null)?.error;
    throw new ApiError(err?.message ?? `خطای ${res.status}`, err?.code ?? `HTTP_${res.status}`, res.status);
  }
  return json as T;
}

export const studio = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),

  /** درخواستِ کدِ ورود برای مدیرِ پلتفرم. */
  requestOtp: (phone: string) =>
    request<{ devCode?: string } | null>('POST', '/api/v1/auth/admin/request', { phone }, false),

  /** تأیید کد و گرفتنِ توکنِ دسترسی. */
  verifyOtp: (phone: string, code: string) =>
    request<{ access: string; admin: { tenant_name: string } }>(
      'POST', '/api/v1/auth/admin/verify', { phone, code }, false,
    ),
};

/**
 * تازه‌سازیِ فوریِ صفحه‌های سایت بعد از ویرایش.
 *
 * کشِ Redisِ بک‌اند خودش با هر نوشتن باطل می‌شود؛ این فراخوان کشِ ISRِ Next را
 * هم پاک می‌کند تا تغییر همان لحظه روی سایت دیده شود. اگر ناموفق باشد فقط
 * یعنی صفحه تا پایانِ بازه‌ی revalidate دیرتر به‌روز می‌شود — نباید ذخیره‌ی
 * موفق را به خطا تبدیل کند.
 */
export async function revalidateSite(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/revalidate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── انواعِ مشترکِ استودیو ──

export interface CollectionListResponse {
  collection: string;
  total: number;
  count: number;
  items: Record<string, unknown>[];
}

export interface OrderRow {
  id: string; code: string; kind: 'trial' | 'purchase';
  status: 'pending' | 'contacted' | 'activated' | 'rejected' | 'cancelled';
  plan_key: string | null; plan_name: string | null; months: number | null; amount_toman: number | null;
  business_name: string; contact_name: string; phone: string; email: string | null;
  city: string | null; branch_count: number | null; note: string | null;
  tenant_id: string | null; restaurant_id: string | null;
  suggested_tenant: { tenantId: string; tenantName: string } | null;
  trial_ends_at: string | null; activated_at: string | null; plan_expires_at: string | null;
  admin_note: string | null; rejected_reason: string | null;
  utm_source: string | null; utm_campaign: string | null; landing_path: string | null;
  created_at: string;
}

export interface InquiryRow {
  id: string; code: string; name: string; phone: string; email: string | null;
  company: string | null; topic: string; message: string;
  status: 'open' | 'in_progress' | 'closed';
  admin_note: string | null; handled_at: string | null;
  utm_source: string | null; landing_path: string | null; created_at: string;
}

export interface OverviewResponse {
  funnel: {
    pending_purchases: number; contacted_purchases: number; activated_purchases: number;
    trials_30d: number; open_inquiries: number; action_required: number;
  };
  revenue_30d: { activated_count: number; amount_toman: number };
  content: { draft_pages: number; draft_articles: number; published_articles: number; active_plans: number };
  recent: {
    id: string; code: string; kind: string; status: string;
    business_name: string; plan_name: string | null; amount_toman: number | null; created_at: string;
  }[];
}
