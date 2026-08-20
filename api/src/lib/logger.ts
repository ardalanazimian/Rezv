// ═══════════════════════════════════════════════════════════════════════
//  Logger ساختاریافته + Tracing + Sentry sink — رزرونو
//
//  ارتقا از نسخه‌ی قبلی (که فقط console بود) به یک لایه‌ی observability کامل:
//   • Centralized logging: در production خروجی JSON خطی (parseable توسط
//     Loki/Datadog/CloudWatch)؛ در dev خروجی خوانا برای انسان.
//   • Tracing: هر لاگ می‌تواند traceId داشته باشد تا لاگ‌های یک درخواست
//     در سرتاسر سرویس به هم وصل شوند (با AsyncLocalStorage propagate می‌شود).
//   • Sentry: خطاها به sink بیرونی (Sentry) هم فرستاده می‌شوند اگر
//     SENTRY_DSN تنظیم باشد — بدون افزودن SDK سنگین، با fetch مستقیم.
// ═══════════════════════════════════════════════════════════════════════
import { AsyncLocalStorage } from 'async_hooks';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Tracing context: traceId در طول یک درخواست در دسترس همه‌ی لاگ‌هاست ──
type TraceContext = { traceId: string; route?: string };
const traceStore = new AsyncLocalStorage<TraceContext>();

export function withTrace<T>(ctx: TraceContext, fn: () => T): T {
  return traceStore.run(ctx, fn);
}
export function currentTraceId(): string | undefined {
  return traceStore.getStore()?.traceId;
}
export function newTraceId(): string {
  // 16 بایت هگز — سازگار با W3C trace-id
  return crypto.randomUUID().replace(/-/g, '');
}

// ── Sentry sink (بدون SDK؛ ارسال مستقیم به Sentry Store API) ──
async function sendToSentry(level: LogLevel, scope: string, msg: string, meta?: unknown) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || (level !== 'error' && level !== 'warn')) return;
  try {
    // DSN format: https://<key>@<host>/<project>
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) return;
    const [, key, host, project] = m;
    const url = `https://${host}/api/${project}/store/?sentry_key=${key}&sentry_version=7`;
    const body = {
      level: level === 'warn' ? 'warning' : 'error',
      logger: scope,
      message: msg,
      timestamp: new Date().toISOString(),
      tags: { scope, traceId: currentTraceId() || 'none' },
      extra: meta !== undefined ? { meta: safeMeta(meta) } : undefined,
      environment: process.env.NODE_ENV || 'development',
    };
    // fire-and-forget؛ نباید مسیر اصلی را بلاک یا بشکند
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    // sink نباید هرگز خطا بدهد
  }
}

// کلیدهای حساس که هرگز نباید در لاگ ظاهر شوند (CWE-532 — نشت داده در لاگ).
const SENSITIVE_KEYS = /^(password|pass|secret|token|access|refresh|jwt|authorization|auth|otp|code|apikey|api_key|cookie|session|creditcard|cvv)$/i;

function safeMeta(meta: unknown, depth = 0): unknown {
  if (meta instanceof Error) return { name: meta.name, message: meta.message, stack: meta.stack };
  if (meta === null || typeof meta !== 'object' || depth > 4) return meta;
  if (Array.isArray(meta)) return meta.map((x) => safeMeta(x, depth + 1));
  // بازنویسی recursive: هر کلید حساس → [REDACTED]
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : safeMeta(v, depth + 1);
  }
  return out;
}

function emit(level: LogLevel, scope: string, msg: string, meta?: unknown) {
  if (ORDER[level] < ORDER[MIN_LEVEL]) return;
  const traceId = currentTraceId();

  if (IS_PROD) {
    // خروجی JSON خطی — برای جمع‌آوری متمرکز
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      scope,
      msg,
      ...(traceId ? { traceId } : {}),
      ...(meta !== undefined ? { meta: safeMeta(meta) } : {}),
    };
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(JSON.stringify(record));
  } else {
    // خروجی خوانا برای توسعه
    const line = `[${level.toUpperCase()}] [${scope}]${traceId ? ` [${traceId.slice(0, 8)}]` : ''} ${msg}`;
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (meta !== undefined) fn(line, safeMeta(meta));
    else fn(line);
  }

  // ارسال خطا/هشدار به Sentry (در صورت تنظیم DSN)
  void sendToSentry(level, scope, msg, meta);
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: unknown) => emit('debug', scope, msg, meta),
    info: (msg: string, meta?: unknown) => emit('info', scope, msg, meta),
    warn: (msg: string, meta?: unknown) => emit('warn', scope, msg, meta),
    error: (msg: string, meta?: unknown) => emit('error', scope, msg, meta),
  };
}
