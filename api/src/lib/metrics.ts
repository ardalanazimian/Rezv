// ═══════════════════════════════════════════════════════════════════════
//  لایه‌ی Metrics (سازگار با Prometheus)
//
//  چرا بدون وابستگی سنگین: prom-client عالی است، ولی برای کار در محیط
//  edge/serverless و بدون افزودن dependency، یک رجیستری سبک in-memory
//  می‌سازیم که خروجی فرمت متنی Prometheus را تولید می‌کند. اگر بعداً
//  prom-client اضافه شد، فقط همین فایل عوض می‌شود (نقطه‌ی واحد).
//
//  سه نوع متریک پایه:
//   • Counter — فقط بالا می‌رود (تعداد درخواست، تعداد خطا)
//   • Gauge   — بالا/پایین (اتصال‌های فعال، طول صف)
//   • Histogram — توزیع (latency درخواست) با bucketها
//
//  ⚠️ نکته‌ی مقیاس: این رجیستری per-instance است. در چند pod، Prometheus
//     هر pod را جدا scrape می‌کند و جمع‌بندی سمت Prometheus انجام می‌شود
//     (همان مدل استاندارد pull-based).
// ═══════════════════════════════════════════════════════════════════════

type Labels = Record<string, string>;

function labelKey(labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  return Object.keys(labels).sort().map((k) => `${k}="${labels[k]}"`).join(',');
}

class Counter {
  private values = new Map<string, number>();
  constructor(public name: string, public help: string) {}
  inc(labels?: Labels, by = 1) {
    const k = labelKey(labels);
    this.values.set(k, (this.values.get(k) ?? 0) + by);
  }
  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [k, v] of this.values) lines.push(`${this.name}${k ? `{${k}}` : ''} ${v}`);
    return lines.join('\n');
  }
}

class Gauge {
  private values = new Map<string, number>();
  constructor(public name: string, public help: string) {}
  set(value: number, labels?: Labels) { this.values.set(labelKey(labels), value); }
  inc(labels?: Labels, by = 1) { const k = labelKey(labels); this.values.set(k, (this.values.get(k) ?? 0) + by); }
  dec(labels?: Labels, by = 1) { this.inc(labels, -by); }
  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    for (const [k, v] of this.values) lines.push(`${this.name}${k ? `{${k}}` : ''} ${v}`);
    return lines.join('\n');
  }
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

class Histogram {
  private buckets = new Map<string, number[]>();
  private sums = new Map<string, number>();
  private counts = new Map<string, number>();
  constructor(public name: string, public help: string, private le = DEFAULT_BUCKETS) {}
  observe(value: number, labels?: Labels) {
    const k = labelKey(labels);
    if (!this.buckets.has(k)) this.buckets.set(k, new Array(this.le.length).fill(0));
    const arr = this.buckets.get(k)!;
    for (let i = 0; i < this.le.length; i++) if (value <= this.le[i]) arr[i]++;
    this.sums.set(k, (this.sums.get(k) ?? 0) + value);
    this.counts.set(k, (this.counts.get(k) ?? 0) + 1);
  }
  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [k, arr] of this.buckets) {
      const base = k ? `{${k}` : '{';
      for (let i = 0; i < this.le.length; i++) {
        lines.push(`${this.name}_bucket${base}${k ? ',' : ''}le="${this.le[i]}"} ${arr[i]}`);
      }
      lines.push(`${this.name}_bucket${base}${k ? ',' : ''}le="+Inf"} ${this.counts.get(k)}`);
      lines.push(`${this.name}_sum${k ? `{${k}}` : ''} ${this.sums.get(k)}`);
      lines.push(`${this.name}_count${k ? `{${k}}` : ''} ${this.counts.get(k)}`);
    }
    return lines.join('\n');
  }
}

// ── متریک‌های اصلی برنامه ──
export const metrics = {
  httpRequests: new Counter('rezervno_http_requests_total', 'تعداد کل درخواست‌های HTTP'),
  httpErrors: new Counter('rezervno_http_errors_total', 'تعداد پاسخ‌های خطا (۴xx/۵xx)'),
  httpDuration: new Histogram('rezervno_http_request_duration_seconds', 'مدت زمان درخواست HTTP بر حسب ثانیه'),
  reservationsCreated: new Counter('rezervno_reservations_created_total', 'تعداد رزروهای موفق ساخته‌شده'),
  reservationConflicts: new Counter('rezervno_reservation_conflicts_total', 'تعداد رد رزرو به‌خاطر تداخل (double-booking جلوگیری‌شده)'),
  smsQueueDepth: new Gauge('rezervno_sms_queue_depth', 'تعداد پیام‌های در صف SMS'),
  smsSent: new Counter('rezervno_sms_sent_total', 'تعداد پیامک‌های ارسال‌شده'),
  smsFailed: new Counter('rezervno_sms_failed_total', 'تعداد پیامک‌های ناموفق (به دست مشتری نرسید)'),
  // ⚠️ تا ۲۰۲۶-۰۸-۲۶ هیچ متریکِ ایمیلی وجود نداشت (برخلافِ پیامک) — یعنی
  // نبودِ کاملِ ارسالِ ایمیل هیچ‌جا قابلِ دیدن نبود.
  emailSent: new Counter('rezervno_email_sent_total', 'تعداد ایمیل‌های ارسال‌شده'),
  emailFailed: new Counter('rezervno_email_failed_total', 'تعداد ایمیل‌های ناموفق (به دست مشتری نرسید)'),
  dbDuration: new Histogram('rezervno_db_query_duration_seconds', 'مدت زمان کوئری دیتابیس بر حسب ثانیه'),
  cacheHits: new Counter('rezervno_cache_hits_total', 'تعداد اصابت کش (cache hit)'),
  cacheMisses: new Counter('rezervno_cache_misses_total', 'تعداد عدم‌اصابت کش (cache miss)'),
  waitlistPromoted: new Counter('rezervno_waitlist_promoted_total', 'تعداد ارتقاء از لیست انتظار به رزرو (وقتی جا باز می‌شود)'),
  rateLimitHits: new Counter('rezervno_rate_limit_hits_total', 'تعداد دفعات فعال‌شدن rate-limit'),
  // ⚠️ سه متریکِ زیر برایِ A3 (سختگیریِ acquisition-grade، ۲۰۲۶-۰۸-۱۴) اضافه
  // شدن — قبلاً fail-open رویِ rate-limit/بن فقط لاگِ ساده (یا هیچی) داشت،
  // بدونِ متریکِ قابلِ‌آلارم‌گذاری. رجوع کن به ratelimit.ts.
  rateLimitFallback: new Counter('rezervno_rate_limit_fallback_total', 'تعداد دفعاتی که ریت‌لیمیت به‌خاطرِ قطعیِ Redis به سقفِ in-memory سقوط کرد (label: scope=middleware|route)'),
  rateLimitAutoBan: new Counter('rezervno_rate_limit_auto_ban_total', 'تعداد بن‌هایِ خودکارِ IP به‌خاطرِ عبورِ مکرر از ریت‌لیمیت'),
  banCheckFailOpen: new Counter('rezervno_ban_check_fail_open_total', 'تعداد دفعاتی که چکِ بنِ IP به‌خاطرِ قطعیِ Redis fail-open شد (بن موقتاً اعمال نشد)'),
  // ⚠️ اضافه‌شده برایِ حسابرسیِ Time-Range/EXCLUDE/Redis-evidence (۲۰۲۶-۰۸-۱۴):
  // قفلِ Redisِ رزرو (withSlotLock) قبلاً هیچ fallbackی نداشت — قطعیِ Redis
  // یک throwِ خامِ ioredis رو تا بیرون از createReservation leak می‌کرد که
  // errorResponse آن را ۵۰۰ی عمومی ترجمه می‌کرد، با اینکه طبق معماریِ مستندشده
  // قفل فقط بهینه‌سازی است و DB (EXCLUDE + Serializable) منبعِ حقیقتِ
  // ضدِ double-booking. رجوع کن به redis.ts.
  slotLockFallback: new Counter('rezervno_slot_lock_fallback_total', 'تعداد دفعاتی که قفلِ Redisِ رزرو به‌خاطرِ قطعیِ Redis fail-open شد (بدونِ قفل ادامه یافت، DB منبعِ حقیقت است)'),
  authFailures: new Counter('rezervno_auth_failures_total', 'تعداد شکست احراز هویت (سیگنال امنیتی)'),
  activeRequests: new Gauge('rezervno_active_requests', 'تعداد درخواست‌های در حال پردازش'),
  jobsPending: new Gauge('rezervno_jobs_pending', 'تعداد job‌های در انتظار در صف'),
  jobsDead: new Gauge('rezervno_jobs_dead', 'تعداد job‌های dead-letter (شکست دائمی)'),
  jobsProcessed: new Counter('rezervno_jobs_processed_total', 'تعداد job‌های پردازش‌شده (با label: kind/outcome)'),
};

/** خروجی متنی همه‌ی متریک‌ها در فرمت Prometheus. */
export function renderMetrics(): string {
  return Object.values(metrics).map((m) => m.render()).join('\n\n') + '\n';
}

/** اندازه‌گیری یک درخواست HTTP — در middleware/wrapper صدا زده می‌شود. */
/**
 * نرمال‌سازی مسیر برای برچسب متریک (باگ H12).
 *
 * مشکل: قبلاً برچسب route همان pathname خام بود که شامل بخش‌های پویا (کد رزرو،
 * UUID، شناسه‌ی عددی) می‌شد. هر مقدار یکتا یک label-set جدید در مپ‌های in-memory
 * متریک می‌ساخت که هرگز پاک نمی‌شد → رشد بی‌حد حافظه (memory leak) و کندی /metrics.
 *
 * راه‌حل: بخش‌های پویا به placeholder ثابت (:id / :code) تبدیل می‌شوند تا کاردینالیتی
 * برچسب محدود و متناسب با تعداد الگوهای مسیر بماند، نه تعداد رکوردها.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESV_CODE_RE = /^[A-Z0-9]{6,12}$/;   // کد رزرو مثل RZ7K2N9
const NUMERIC_RE = /^\d+$/;

export function normalizeRoute(pathname: string): string {
  const parts = pathname.split('/').map((seg) => {
    if (!seg) return seg;
    if (UUID_RE.test(seg)) return ':id';
    if (NUMERIC_RE.test(seg)) return ':id';
    if (RESV_CODE_RE.test(seg)) return ':code';
    return seg;
  });
  return parts.join('/') || '/';
}

export function recordHttp(method: string, route: string, status: number, durationSec: number) {
  const normalized = normalizeRoute(route);
  const labels = { method, route: normalized, status: String(status) };
  metrics.httpRequests.inc(labels);
  metrics.httpDuration.observe(durationSec, { method, route: normalized });
  if (status >= 400) metrics.httpErrors.inc(labels);
}
