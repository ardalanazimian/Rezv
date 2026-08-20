import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ═══════════════════════════════════════════════════════════
//  تست بار رزرونو (k6) — هدف: API <۱۵۰ms، P95<۲۵۰ms
//
//  اجرا:
//    k6 run -e BASE_URL=https://api.your-domain.com loadtest/k6-load-test.js
//
//  این تست مسیرهای داغ خواندنی (که بیشترین ترافیک را دارند) را می‌زند:
//  لیست رستوران‌ها، صفحه‌ی رستوران، availability. مسیرهای نوشتنی (رزرو)
//  عمداً اینجا نیستند چون داده‌ی تست واقعی و auth می‌خواهند — برای آن‌ها
//  یک سناریوی جدا با کاربر تست بساز.
// ═══════════════════════════════════════════════════════════

const errorRate = new Rate('errors');
const availTrend = new Trend('availability_duration', true);

export const options = {
  scenarios: {
    // افزایش تدریجی بار تا ۵۰۰ کاربر همزمان
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // گرم‌کردن
        { duration: '1m', target: 200 },   // بار متوسط
        { duration: '2m', target: 500 },   // بار اوج
        { duration: '1m', target: 500 },   // پایداری در اوج
        { duration: '30s', target: 0 },    // سرد‌کردن
      ],
    },
  },
  thresholds: {
    // هدف‌های پروژه — اگر رد شوند، تست fail می‌شود
    http_req_duration: ['p(95)<250', 'p(50)<150'],  // P95<۲۵۰ms، میانه<۱۵۰ms
    errors: ['rate<0.01'],                           // نرخ خطا <۱٪
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  group('لیست رستوران‌ها', () => {
    const res = http.get(`${BASE_URL}/api/v1/restaurants`);
    check(res, {
      'status 200': (r) => r.status === 200,
      'پاسخ < 250ms': (r) => r.timings.duration < 250,
      'بدنه دارد': (r) => r.body && r.body.length > 0,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 2); // شبیه‌سازی مکث کاربر

  group('availability یک رستوران', () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = http.get(`${BASE_URL}/api/v1/restaurants/cheghadr/availability?date=${today}&party=2`);
    availTrend.add(res.timings.duration);
    check(res, {
      'status 200 یا 404': (r) => r.status === 200 || r.status === 404,
      'پاسخ < 250ms': (r) => r.timings.duration < 250,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 3);
}

// خلاصه‌ی سفارشی در پایان
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  const p50 = data.metrics.http_req_duration.values['p(50)'];
  const errRate = data.metrics.errors ? data.metrics.errors.values.rate : 0;
  const pass = p95 < 250 && p50 < 150 && errRate < 0.01;

  const summary = `
═══════════════════════════════════════════
  نتیجه‌ی تست بار رزرونو
═══════════════════════════════════════════
  میانه (P50):   ${p50.toFixed(1)}ms   (هدف: <۱۵۰ms)
  P95:           ${p95.toFixed(1)}ms   (هدف: <۲۵۰ms)
  نرخ خطا:       ${(errRate * 100).toFixed(2)}%   (هدف: <۱٪)
  ───────────────────────────────────────────
  نتیجه: ${pass ? '✅ هدف‌ها برآورده شد' : '❌ هدف‌ها برآورده نشد'}
═══════════════════════════════════════════
`;
  return {
    stdout: summary,
    'loadtest/summary.json': JSON.stringify(data, null, 2),
  };
}
