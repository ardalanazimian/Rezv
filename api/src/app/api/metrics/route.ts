import { renderMetrics } from '@/lib/metrics';

// GET /api/metrics — هدف scrape برای Prometheus.
// خروجی در فرمت متنی استاندارد Prometheus (text/plain; version=0.0.4).
//
// امنیت: اگر METRICS_TOKEN تنظیم شده باشد، نیاز به هدر Authorization دارد
// تا متریک‌ها عمومی نباشند (می‌توانند ساختار داخلی را لو دهند). در محیط
// k8s معمولاً این endpoint فقط در شبکه‌ی داخلی scrape می‌شود.
export async function GET(req: Request) {
  const required = process.env.METRICS_TOKEN;
  if (required) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${required}`) {
      return new Response('unauthorized', { status: 401 });
    }
  }

  // به‌روزرسانی gaugeهای لحظه‌ای پیش از خروجی (طول صف SMS قدیمی حذف شد؛
  // حالا متریک‌های صف Job از دیتابیس به‌روز می‌شوند)
  try {
    const { refreshQueueMetrics } = await import('@/lib/queue');
    await refreshQueueMetrics();
  } catch {
    // اگر صف/DB در دسترس نبود، آخرین مقدار می‌ماند
  }

  return new Response(renderMetrics(), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
