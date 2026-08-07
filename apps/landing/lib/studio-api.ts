'use client';

// ═══════════════════════════════════════════════════════════════════════
//  کلاینتِ استودیو — همان API پنلِ شرکت، با احرازِ هویتِ مدیرِ پلتفرم
//
//  توکن در sessionStorage نگه داشته می‌شود (نه localStorage): با بستنِ تب
//  از بین می‌رود، که برای یک کنسولِ مدیریتی رفتارِ درست‌تری است.
// ═══════════════════════════════════════════════════════════════════════

import { ApiError } from './client-api';

const LOCAL_DEMO_TOKEN = 'rz_local_demo_token';

function resolveApiBase(): string {
  const explicit = (process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  try {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost';
    }
  } catch {
    /* noop */
  }

  return '';
}

const BASE = resolveApiBase();
const TOKEN_KEY = 'rz_studio_token';

function isLocalhost(): boolean {
  try {
    return typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function isLocalDemoToken(): boolean {
  return getToken() === LOCAL_DEMO_TOKEN;
}

function demoOverview(): OverviewResponse {
  return {
    funnel: {
      pending_purchases: 2,
      contacted_purchases: 1,
      activated_purchases: 3,
      trials_30d: 4,
      open_inquiries: 1,
      action_required: 2,
    },
    revenue_30d: { activated_count: 3, amount_toman: 54000000 },
    content: { draft_pages: 2, draft_articles: 1, published_articles: 7, active_plans: 3 },
    recent: [
      { id: 'demo-order-1', code: 'DMO-1001', kind: 'trial', status: 'pending', business_name: '[DEMO] رستوران ویترین', plan_name: null, amount_toman: null, created_at: new Date().toISOString() },
      { id: 'demo-order-2', code: 'DMO-1002', kind: 'purchase', status: 'activated', business_name: '[DEMO] کافه آبی', plan_name: 'پلن حرفه‌ای', amount_toman: 18000000, created_at: new Date().toISOString() },
    ],
  };
}

function demoCollection(path: string): { collection: string; total: number; count: number; items: Record<string, unknown>[] } {
  const now = new Date().toISOString();
  const collection = path.split('/').pop() || 'demo';
  const map: Record<string, Record<string, unknown>[]> = {
    pages: [
      { id: 'demo-page-1', title: 'صفحه‌ی اصلی', slug: 'home', status: 'published', updatedAt: now },
      { id: 'demo-page-2', title: 'قیمت‌گذاری', slug: 'pricing', status: 'draft', updatedAt: now },
    ],
    articles: [
      { id: 'demo-article-1', title: 'رزرو آنلاین چرا فروش را بالا می‌برد؟', slug: 'reservation-growth', status: 'published', updatedAt: now },
    ],
    faqs: [
      { id: 'demo-faq-1', question: 'چطور شروع کنیم؟', scope: 'general', status: 'published', updatedAt: now },
    ],
    plans: [
      { id: 'demo-plan-1', name: 'پلن حرفه‌ای', key: 'pro', status: 'published', updatedAt: now },
    ],
    testimonials: [
      { id: 'demo-testimonial-1', author: 'مدیر رستوران نمونه', company: '[DEMO] کافه آبی', status: 'published', updatedAt: now },
    ],
    banners: [
      { id: 'demo-banner-1', message: '[DEMO] نسخه‌ی محلی فعال است', tone: 'info', status: 'published', updatedAt: now },
    ],
    'release-notes': [
      { id: 'demo-release-1', title: 'پیش‌نمایش استودیو', version: '0.1', status: 'draft', updatedAt: now },
    ],
  };
  const items = map[collection] ?? [{ id: 'demo-row-1', title: 'ردیفِ نمایشی', status: 'published', updatedAt: now }];
  return { collection, total: items.length, count: items.length, items };
}

function demoOrders(): { items: OrderRow[] } {
  const now = new Date().toISOString();
  return {
    items: [
      {
        id: 'demo-order-1', code: 'DMO-1001', kind: 'trial', status: 'pending', plan_key: null, plan_name: null, months: null, amount_toman: null,
        business_name: '[DEMO] رستوران ویترین', contact_name: 'آراد', phone: '+989120000000', email: null, city: 'تهران', branch_count: 1, note: 'درخواست دموی محلی',
        tenant_id: null, restaurant_id: null, suggested_tenant: null, trial_ends_at: null, activated_at: null, plan_expires_at: null,
        admin_note: null, rejected_reason: null, utm_source: 'local-demo', utm_campaign: null, landing_path: '/studio', created_at: now,
      },
      {
        id: 'demo-order-2', code: 'DMO-1002', kind: 'purchase', status: 'activated', plan_key: 'pro', plan_name: 'پلن حرفه‌ای', months: 6, amount_toman: 18000000,
        business_name: '[DEMO] کافه آبی', contact_name: 'مینا', phone: '+989122079763', email: null, city: 'کرج', branch_count: 2, note: null,
        tenant_id: 'demo-tenant', restaurant_id: 'demo-restaurant', suggested_tenant: null, trial_ends_at: null, activated_at: now, plan_expires_at: null,
        admin_note: null, rejected_reason: null, utm_source: 'local-demo', utm_campaign: 'studio', landing_path: '/pricing', created_at: now,
      },
    ],
  };
}

function demoInquiries(): { items: InquiryRow[] } {
  const now = new Date().toISOString();
  return {
    items: [
      { id: 'demo-inquiry-1', code: 'INQ-1001', name: 'مینا', phone: '+989122079763', email: null, company: '[DEMO] کافه آبی', topic: 'سوال دمو', message: 'سلام، می‌خواهم نسخه‌ی محلی را ببینم.', status: 'open', admin_note: null, handled_at: null, utm_source: 'local-demo', landing_path: '/contact', created_at: now },
    ],
  };
}

function demoResponse<T>(method: string, path: string): T {
  if (method === 'GET') {
    if (path.includes('/overview')) return demoOverview() as T;
    if (path.includes('/orders')) return demoOrders() as T;
    if (path.includes('/inquiries')) return demoInquiries() as T;
    if (path.includes('/admin/site/')) return demoCollection(path) as T;
  }
  return {} as T;
}

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
    if (isLocalhost()) return demoResponse<T>(method, path);
    throw new ApiError('ارتباط با سرور برقرار نشد.', 'NETWORK', 0);
  }

  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* پاسخِ غیر-JSON */ }

  if (!res.ok) {
    // توکنِ منقضی → پاک کن تا کاربر دوباره وارد شود، نه اینکه در حلقه‌ی خطا بماند.
    if (res.status === 401) setToken(null);
    if (isLocalhost() && res.status >= 500) return demoResponse<T>(method, path);
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
  requestOtp: async (phone: string) => {
    try {
      return await request<{ devCode?: string } | null>('POST', '/api/v1/auth/admin/request', { phone }, false);
    } catch (e) {
      if (isLocalhost()) return { devCode: '1234' };
      throw e;
    }
  },

  /** تأیید کد و گرفتنِ توکنِ دسترسی. */
  verifyOtp: async (phone: string, code: string) => {
    try {
      const res = await request<{ access: string; admin: { tenant_name: string } }>(
        'POST', '/api/v1/auth/admin/verify', { phone, code }, false,
      );
      if (!res?.access && isLocalhost() && code.trim() === '1234') {
        setToken(LOCAL_DEMO_TOKEN);
        return { access: LOCAL_DEMO_TOKEN, admin: { tenant_name: 'دموی محلی' } };
      }
      return res;
    } catch (e) {
      if (isLocalhost() && code.trim() === '1234') {
        setToken(LOCAL_DEMO_TOKEN);
        return { access: LOCAL_DEMO_TOKEN, admin: { tenant_name: 'دموی محلی' } };
      }
      throw e;
    }
  },
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
