import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/revalidate — تازه‌سازیِ فوریِ کشِ صفحه‌ها بعد از ویرایش در استودیو
//
//  مسئله: کشِ Redisِ بک‌اند بلافاصله باطل می‌شود، ولی کشِ ISRِ خودِ Next تا
//  پایانِ revalidate همان HTMLِ قدیمی را می‌دهد. یعنی ویرایشِ محتوا تا چند
//  دقیقه روی سایت دیده نمی‌شد.
//
//  احرازِ هویت: بدونِ کلیدِ مشترک (که در مرورگر امن نیست). توکنِ مدیرِ پلتفرم
//  که استودیو در دست دارد، به خودِ API فرستاده می‌شود؛ اگر یک endpointِ
//  مدیریتی آن را بپذیرد، تماس‌گیرنده واقعاً مدیر است. تصمیمِ دسترسی همان‌جا
//  گرفته می‌شود که همیشه گرفته می‌شود — نه اینجا.
// ═══════════════════════════════════════════════════════════════════════

const API_BASE = (process.env.SEO_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'توکن لازم است' }, { status: 401 });
  }
  if (!API_BASE) {
    return NextResponse.json({ ok: false, error: 'API پیکربندی نشده است' }, { status: 503 });
  }

  try {
    const check = await fetch(`${API_BASE}/api/v1/admin/site/overview`, {
      headers: { Authorization: auth },
      cache: 'no-store',
    });
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: 'دسترسی مدیر لازم است' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'بررسیِ دسترسی ناموفق بود' }, { status: 502 });
  }

  // یک ویرایش می‌تواند چند صفحه را تغییر دهد (تغییرِ پلن روی صفحه‌ی اصلی و
  // قیمت‌گذاری هر دو اثر دارد)، پس کلِ درختِ لِی‌اوت تازه می‌شود. برای یک
  // سایتِ بازاریابی این ارزان است و از حدس‌زدنِ وابستگی‌ها مطمئن‌تر.
  revalidatePath('/', 'layout');

  return NextResponse.json({ ok: true, revalidated_at: new Date().toISOString() });
}
