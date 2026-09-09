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
  // ⚠️ زیرِ isolationِ Serializable، ابطال با ۴۰۰۰۱/۴۰P۰۱ رفتارِ *عادیِ* SSI است
  // و مکانیزمِ retry (reservation-helpers.ts → withSerializationRetry) مسیرِ داغ
  // است، نه یک حالتِ لبه. بدونِ این شمارنده هیچ راهی نبود بفهمیم retry واقعاً
  // شلیک می‌کند یا فقط در کد حاضر است — و یک مکانیزمِ اندازه‌گیری‌نشده در مسیرِ
  // رزرو دقیقاً همان چیزی است که «سبزِ توخالی» می‌سازد. صعودِ ناگهانی‌اش یعنی
  // فشارِ همزمانی رویِ یک اسلات؛ صفرِ دائمی‌اش زیرِ بار یعنی retry مرده است.
  serializationRetries: new Counter('rezervno_serialization_retries_total', 'تعداد تلاشِ مجددِ تراکنش پس از تداخلِ serialization/deadlock (۴۰۰۰۱/۴۰P۰۱/P۲۰۳۴)'),
  // ⚠️ اضافه‌شده ۲۰۲۶-۰۹-۰۹ — یافته‌ی بازبین (`rezv-e6`) روی وصله‌ی P2028 همان
  // روز. من ادعا کردم «هیچ عددی برای این حادثه تکان نمی‌خورد»؛ آن **غلط** بود
  // (`httpErrors` روی هر ≥۴۰۰ بالا می‌رود و زنگِ HighErrorRate را می‌زند) ولی
  // حقیقت بدتر بود:
  //
  //   • `reservationConflicts` فقط زیرِ `isConflictError` بالا می‌رود (کانستریتِ
  //     EXCLUDE) — یعنی تداخلِ *اثبات‌شده*، نه انقضای تراکنش.
  //   • `serializationRetries` فقط داخلِ حلقه‌ی retry شمرده می‌شود، و P2028
  //     **عمداً** وارد آن حلقه نشد. پس هرگز به این شمارنده نمی‌رسد.
  //   • `throw Err.concurrencyRetry()` هیچ‌چیز نمی‌شمرد.
  //
  // نتیجه‌اش یک رگرسیونِ رصدپذیری **داخلِ یک رفعِ درست** بود: با رفتن از ۵۰۰
  // به ۴۰۹ شکلِ 5xx حذف شد بدونِ اینکه جایگزینی بیاید، و آلارمِ
  // `reservation_conflicts / reservations_created > 0.3` — که دقیقاً برای همین
  // ساخته شده — در طوفانِ واقعی صورتِ ثابت و مخرجِ **نزولی** می‌گیرد، یعنی
  // به‌سمتِ «سلامت» حرکت می‌کند در حالی که رزرو از کار افتاده.
  //
  // ⚠️ عمداً شمارنده‌ی جدا و نه `reservationConflicts`: آن یکی معنایش
  // «double-booking جلوگیری‌شده» است و آلوده‌کردنش هم آن معنا را خراب می‌کرد
  // هم نسبتِ ۰.۳ را مسموم.
  reservationTxTimeouts: new Counter('rezervno_reservation_tx_timeouts_total', 'تعداد رزروی که به‌خاطرِ انقضایِ تراکنش (P2028ِ expired) رد شد — رقابتِ شدید روی یک اسلات، نه تداخلِ اثبات‌شده'),
  // ⚠️ اضافه‌شده ۲۰۲۶-۰۹-۰۹ — یافته‌ی رد تیم (`rezv-c7`، RT-05). استدلالش
  // حسابی بود و بعد اندازه‌گیری شد: `connection_limit=10` و `pool_timeout=10`
  // (db.ts:52,56) و هر تراکنشِ رزرو تا ۱۰ ثانیه اتصالش را نگه می‌دارد. اجرای
  // واقعی روی همین ماشین: ۱۰ اتصالِ نگه‌داشته → یازدهمی دقیقاً ۱۰.۰ ثانیه صبر
  // کرد → `P2024` → `errorResponse` → **HTTP 500 / INTERNAL**.
  //
  // جمله‌ی رد تیم که چرا این از P2028 بدتر است: «P2028 یک تراکنشِ کُند لازم
  // دارد؛ P2024 ده تراکنشِ **عادی**.»
  //
  // این شمارنده تنها چیزی است که «ظرفیت کم است» را از «یک چیزی خراب شد» جدا
  // می‌کند: بدونِ آن، طوفانِ استخر فقط انبوهی ۵۰۳ در لاگ است و هیچ عددی
  // نمی‌گوید علت اشباعِ استخر بوده. عمداً سطحِ DB است نه سطحِ رزرو — هر
  // endpointی می‌تواند آن را بالا ببرد.
  dbPoolTimeouts: new Counter('rezervno_db_pool_timeouts_total', 'تعداد درخواستی که به‌خاطرِ ته‌کشیدنِ استخرِ اتصالِ DB رد شد (P2024) — سیگنالِ ظرفیت، نه خرابی'),
  smsQueueDepth: new Gauge('rezervno_sms_queue_depth', 'تعداد پیام‌های در صف SMS'),
  smsSent: new Counter('rezervno_sms_sent_total', 'تعداد پیامک‌های ارسال‌شده'),
  smsFailed: new Counter('rezervno_sms_failed_total', 'تعداد پیامک‌های ناموفق (به دست مشتری نرسید)'),
  // ⚠️ «فرستاده نشد چون کاربر انصراف داده» یک حالتِ سومِ کاملاً متفاوت است و
  // نه موفقیت است نه شکست. بدونِ این متریک، رعایتِ انصراف یک سکوتِ کامل بود
  // (قاعده‌ی بخشِ ۹ CLAUDE.md: جایی که عمداً چیزی ارسال نمی‌شود باید لاگِ
  // ساختاریافته + متریکِ قابلِ‌آلارم بدهد). برچسبِ `site` نقطه‌ی صدور را
  // مشخص می‌کند تا افتِ ناگهانیِ ارسال به یک نقطه نسبت داده شود.
  smsSuppressed: new Counter('rezervno_sms_suppressed_total', 'تعداد پیامک‌هایی که به‌خاطر انصرافِ صریحِ کاربر ارسال نشدند'),
  inAppSuppressed: new Counter('rezervno_inapp_suppressed_total', 'تعداد اعلان‌های درون‌اپ که به‌خاطر انصرافِ صریحِ کاربر نمایش داده نشدند'),
  // ⚠️ همان الگویِ smsSent/smsFailed، و به همان دلیل: تا امروز مسیرِ ایمیل
  // **هیچ متریکی** نداشت و در نبودِ ارائه‌دهنده بی‌صدا «موفق» برمی‌گشت. کلِ
  // قیفِ فروشِ B2B از همین مسیر می‌گذرد (درخواستِ دمو، فعال‌سازیِ اشتراک،
  // پیامِ فرمِ تماس) — یعنی سرنخ‌ها بی‌صدا گم می‌شدند.
  emailSent: new Counter('rezervno_email_sent_total', 'تعداد ایمیل‌هایی که ارائه‌دهنده واقعاً پذیرفت'),
  emailFailed: new Counter('rezervno_email_failed_total', 'تعداد ایمیل‌های ناموفق (به دستِ گیرنده نرسید)'),
  pushNotSent: new Counter('rezervno_push_not_sent_total', 'تعداد اعلان‌های push که ارسال نشدند چون ترنسپورتِ push هنوز ساخته نشده'),
  // ⚠️ همان الگویِ smsSuppressed/inAppSuppressed، و به همان دلیل: «رویداد
  // رسید ولی درج نشد» نه موفقیت است نه خطا — و تا امروز **سکوتِ کامل** بود.
  //
  // یافته‌ی اندازه‌گیری‌شده‌ی ۲۰۲۶-۰۸-۲۶: هر دو نامِ رویدادی که کلاینت‌ها
  // واقعاً می‌فرستند (`app.opened`, `page.viewed`) خارج از allowlistِ سرور
  // بودند، پس **۱۰۰٪** تله‌متریِ کلاینت بی‌صدا دور ریخته می‌شد در حالی که
  // پاسخِ ۲۰۲ برمی‌گشت. بدونِ این متریک هیچ سیگنالی وجود نداشت — نه لاگ،
  // نه شمارنده — و همین باعث شد ماه‌ها دیده نشود.
  //
  // برچسب‌ها: `reason` = shape|prefix ، `type` = نامِ رویداد (مهارشده؛ به
  // `capTelemetryTypeLabel` رجوع کن — ورودیِ کلاینت است و بدونِ مهار هم
  // نشتِ حافظه می‌داد و هم می‌توانست متنِ Prometheus را خراب کند).
  telemetryEventRejected: new Counter('rezervno_telemetry_event_rejected_total', 'تعداد رویدادهای تله‌متری که به‌خاطرِ نامِ خارج از allowlist درج نشدند'),
  // ⚠️ آلارم‌پذیر و باید همیشه صفر باشد: یعنی مدلی ذخیره شده که با بردارِ
  // ویژگیِ فعلی جور نیست و امتیازدهی throw کرده. سیستم به heuristic افتاده
  // (رزرو نمی‌شکند) ولی هوش خاموش شده — و بدونِ این متریک، بی‌صدا.
  modelScoringFailed: new Counter('rezervno_model_scoring_failed_total', 'تعداد دفعاتی که امتیازدهیِ مدل شکست خورد و به heuristic سقوط کرد'),
  // ⚠️ آلارم‌پذیر و باید پس از گرفتنِ پنلِ کاوه‌نگار **همیشه صفر** بماند:
  // یعنی مسیرِ ورودِ اضطراری (break-glass) استفاده شده. عددِ غیرمنتظره یعنی
  // یا کسی دارد سوءاستفاده می‌کند یا خاموش‌کردنش فراموش شده.
  breakGlassOtp: new Counter('rezervno_break_glass_otp_total', 'تعداد استفاده از ورودِ اضطراریِ OTP (باید پیش از لانچِ عمومی خاموش شود)'),
  // ⚠️ آلارم‌پذیر: غیرفعال‌شدنِ خودکارِ مدل یعنی سیستم به heuristic برگشته.
  // اتفاقِ نادری است؛ اگر برای چند رستوران پشتِ‌هم بیفتد، یعنی یا دادهٔ
  // ورودی عوض شده یا خودِ خطِ آموزش مشکل دارد — هر دو نیازِ نگاهِ انسان.
  modelRolledBack: new Counter('rezervno_model_rolled_back_total', 'تعداد غیرفعال‌سازیِ خودکارِ مدل به‌خاطرِ افتِ کارایی در تولید'),
  // ⚠️ آلارم‌پذیر: مدلی ذخیره شده ولی به‌خاطرِ ناسازگاریِ نسخه‌ی ویژگی سرو
  // نمی‌شود. عددِ پایدارِ غیرصفر یعنی آموزشِ شبانه کار نمی‌کند و سیستم روی
  // heuristic گیر کرده — دقیقاً همان حالتی که بدونِ متریک ماه‌ها دیده نمی‌شد.
  modelVersionMismatch: new Counter('rezervno_model_version_mismatch_total', 'تعداد دفعاتی که مدلِ ذخیره‌شده به‌خاطرِ ناسازگاریِ نسخه‌ی بردارِ ویژگی سرو نشد'),
  dbDuration: new Histogram('rezervno_db_query_duration_seconds', 'مدت زمان کوئری دیتابیس بر حسب ثانیه'),
  cacheHits: new Counter('rezervno_cache_hits_total', 'تعداد اصابت کش (cache hit)'),
  cacheMisses: new Counter('rezervno_cache_misses_total', 'تعداد عدم‌اصابت کش (cache miss)'),
  waitlistPromoted: new Counter('rezervno_waitlist_promoted_total', 'تعداد ارتقاء از لیست انتظار به رزرو (وقتی جا باز می‌شود)'),
  // ⚠️ آلارم‌پذیر. تا ۲۰۲۶-۰۹-۰۵ هر چهار فراخوانِ `promoteNext` خطایش را با
  // `.catch(() => {})` می‌بلعید (waitlist.ts:553/596/644 و مسیرِ sweep که اصلاً
  // گاردی نداشت). نتیجه‌اش یک ترکیبِ چهارلایه بود که هیچ‌کدام از لایه‌هایش
  // به‌تنهایی غلط نبود ولی حاصلشان «موفقیت» گزارش می‌کرد: promoteNext خطا را
  // می‌بلعید، expireOffers دوباره می‌بلعید، endpoint‌ی ۲xx می‌داد، و
  // `cron/run.sh:10` یک `✓ waitlist` چاپ می‌کرد. یعنی یک ارتقایِ **سیستماتیکاً
  // شکست‌خورده** از یک ارتقایِ سالم قابلِ تفکیک نبود — cron هر ۲ دقیقه
  // (cron/crontab:17) دوباره تلاش می‌کرد، هر ۲ دقیقه شکست می‌خورد، و هیچ
  // سیگنالی تولید نمی‌شد.
  //
  // ⚠️ چرا برچسبِ `site` اجباری است — دقیقاً همان استدلالِ
  // `withSerializationRetry('walkin', …)` در reservation-helpers.ts: بدونِ
  // برچسب، شمارشِ چهار مسیر در یک عدد جمع می‌شد و یک مسیرِ **مرده** (مثلاً
  // ارتقا از مسیرِ decline که همیشه شکست می‌خورد) پشتِ ترافیکِ مسیرِ sweep
  // نامرئی می‌ماند. `site=decline|cancel|expire|sweep`.
  waitlistPromotionFailed: new Counter('rezervno_waitlist_promotion_failed_total', 'تعداد تلاش‌هایِ ناموفقِ ارتقا از لیستِ انتظار (کنشِ خودِ کاربر موفق بوده؛ فقط ارتقا شکست خورده) — label: site=decline|cancel|expire|sweep'),
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
  // ⚠️ اضافه‌شده ۲۰۲۶-۰۹-۰۶: نوشتنِ audit در DB عمداً best-effort است
  // (`lib/audit.ts` — از‌دست‌رفتنِ یک رکورد نباید کاربر را بلاک کند) ولی تا
  // امروز شکستش فقط یک `log.warn` بود: هیچ شمارنده‌ای، هیچ آلارمی. یعنی یک
  // کنشِ حساس می‌توانست ۲۰۰ برگرداند در حالی که ردِ حسابرسی‌اش هرگز ننشسته
  // بود، و هیچ‌کس نمی‌فهمید.
  //
  // چرا این‌جا فقط «انطباق» نیست: `fraud.listFlaggedAbuseUsers` نسب‌نامه‌ی
  // فلگ‌ها (چه کسی/چرا/کدام رستوران) را از همین جدول می‌خواند — یعنی
  // audit_logs یک **مسیرِ خواندنِ محصولی** است، نه صرفاً بایگانی.
  //
  // برچسبِ `action` یک unionِ بسته‌ی TS است (~۴۰ مقدار)، پس کاردینالیتی
  // ساکن و امن است — و «کدام رویدادِ امنیتی ردش را گم کرد» دقیقاً همان
  // چیزی است که در تحقیق لازم می‌شود.
  auditWriteFailed: new Counter('rezervno_audit_write_failed_total', 'تعداد رکوردهای audit که در DB ثبت نشدند (کنشِ اصلی موفق بود؛ فقط ردِ حسابرسی گم شد) — label: action'),
  activeRequests: new Gauge('rezervno_active_requests', 'تعداد درخواست‌های در حال پردازش'),
  jobsPending: new Gauge('rezervno_jobs_pending', 'تعداد job‌های در انتظار در صف'),
  jobsDead: new Gauge('rezervno_jobs_dead', 'تعداد job‌های dead-letter (شکست دائمی)'),
  jobsProcessed: new Counter('rezervno_jobs_processed_total', 'تعداد job‌های پردازش‌شده (با label: kind/outcome)'),
  // ⚠️ اضافه‌شده ۲۰۲۶-۰۹-۰۶: تا این تاریخ کارِ گیرکرده در 'processing' هیچ
  // نماینده‌ای در متریک‌ها نداشت — فقط pending و dead شمرده می‌شدند. یعنی
  // workerی که وسطِ کار می‌مرد، jobها را برای همیشه معلق می‌گذاشت و هیچ
  // داشبورد و هیچ آلارمی خبردار نمی‌شد. هر دو در observability/alerts.yml
  // (گروهِ rezervno_queue) قاعده دارند.
  jobsStuck: new Gauge('rezervno_jobs_stuck', 'تعداد job‌هایی که فراتر از اجاره در وضعیت processing مانده‌اند (workerِ مرده)'),
  jobsReclaimed: new Counter('rezervno_jobs_reclaimed_total', 'تعداد job‌هایی که پس از انقضای اجاره بازپس گرفته شدند (label: kind/outcome=retry|dead)'),
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

/**
 * سقفِ سختِ کاردینالیتیِ برچسبِ `route`.
 *
 * چرا لازم است حتی با وجودِ `normalizeRoute`: نرمال‌سازیِ regex-محور فقط
 * الگوهایی را می‌شناسد که برایشان قاعده نوشته شده (UUID، عدد، کدِ رزروِ
 * بزرگ‌حروف). یک بخشِ پویا با شکلِ دیگر — مثلاً **اسلاگِ رستوران** در
 * `/api/v1/restaurants/<slug>/availability` — از همه‌ی این قاعده‌ها رد می‌شود
 * و به‌ازای هر رستوران یک label-set تازه می‌سازد که هرگز پاک نمی‌شود.
 *
 * از این پس مسیرِ اصلی این ریسک را ندارد، چون `withApiMetrics` **الگویِ
 * ثابتِ فایل‌سیستمی** (`/api/v1/restaurants/[slug]/availability`) را پاس
 * می‌دهد، نه pathnameِ خام. ولی `withRestaurantAuth` هنوز از pathname
 * استفاده می‌کند و هر تماسِ آینده هم ممکن است مسیرِ خام بدهد؛ پس این سقف
 * به‌عنوانِ آخرین خطِ دفاع می‌ماند: بعد از MAX_ROUTE_LABELS الگوی متمایز،
 * هر مسیرِ تازه در یک سطلِ واحد `__other__` جمع می‌شود. متریک از دست می‌رود،
 * ولی حافظه رشدِ بی‌حد نمی‌کند.
 */
const MAX_ROUTE_LABELS = 300;
const seenRouteLabels = new Set<string>();

export function capRouteLabel(route: string): string {
  if (seenRouteLabels.has(route)) return route;
  if (seenRouteLabels.size >= MAX_ROUTE_LABELS) return '__other__';
  seenRouteLabels.add(route);
  return route;
}

/** تعدادِ الگوهای مسیرِ دیده‌شده — فقط برای تست/تشخیص. */
export function routeLabelCount(): number {
  return seenRouteLabels.size;
}

/**
 * مهارِ برچسبِ `type` برایِ متریکِ تله‌متری — **دو** خطر، نه یکی.
 *
 * ۱) نشتِ حافظه/کاردینالیتی: `type` مستقیماً از بدنه‌ی درخواستِ کلاینت می‌آید و
 *    تنها اعتبارسنجی‌اش «رشته‌ی ۱ تا ۱۲۰ کاراکتری» است. بدونِ مهار، هر مقدارِ
 *    یکتا یک label-set تازه در مپِ in-memory می‌ساخت که هرگز پاک نمی‌شود —
 *    یعنی یک کلاینت با ۱۲۰ درخواست در دقیقه می‌توانست تا ۶۰۰۰ برچسبِ ماندگار
 *    در دقیقه بسازد. این دقیقاً همان باگِ H12 است که برایِ برچسبِ `route`
 *    بالاتر رفع شد، فقط با یک ورودیِ **صریحاً غیرقابلِ‌اعتمادتر**.
 *
 * ۲) تزریق در متنِ خروجیِ Prometheus: `labelKey` مقدار را بدونِ escape داخلِ
 *    `k="v"` می‌گذارد. یک `type` حاویِ `"` یا newline می‌توانست خطِ متریکِ
 *    جعلی بسازد. پس هر مقداری که با شکلِ کانونیِ نامِ رویداد جور نباشد به
 *    `__malformed__` تبدیل می‌شود — و شکلِ کانونی فقط `[a-z0-9_.]` است، پس
 *    مقدارِ عبورکرده اثباتاً بی‌خطر است.
 *
 * سقف عمداً از سقفِ مسیرها کمتر است: فهرستِ نام‌های مشروع کوچک و شمردنی است.
 */
const TELEMETRY_TYPE_SAFE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const MAX_TELEMETRY_TYPE_LABELS = 200;
const seenTelemetryTypes = new Set<string>();

export function capTelemetryTypeLabel(type: string): string {
  if (!TELEMETRY_TYPE_SAFE_RE.test(type) || type.length > 120) return '__malformed__';
  if (seenTelemetryTypes.has(type)) return type;
  if (seenTelemetryTypes.size >= MAX_TELEMETRY_TYPE_LABELS) return '__other__';
  seenTelemetryTypes.add(type);
  return type;
}

/** تعدادِ نام‌های رویدادِ دیده‌شده — فقط برای تست/تشخیص. */
export function telemetryTypeLabelCount(): number {
  return seenTelemetryTypes.size;
}

export function recordHttp(method: string, route: string, status: number, durationSec: number) {
  const normalized = capRouteLabel(normalizeRoute(route));
  const labels = { method, route: normalized, status: String(status) };
  metrics.httpRequests.inc(labels);
  metrics.httpDuration.observe(durationSec, { method, route: normalized });
  if (status >= 400) metrics.httpErrors.inc(labels);
}
