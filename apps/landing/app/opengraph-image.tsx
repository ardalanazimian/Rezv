import { ImageResponse } from 'next/og';
import { persianFont } from '@/lib/og-font';

// تصویرِ اشتراک‌گذاریِ پیش‌فرضِ سایت (۱۲۰۰×۶۳۰) — در زمانِ درخواست ساخته می‌شود،
// پس هیچ فایلِ تصویری در ریپو نگه‌داری نمی‌شود و با تغییرِ برند خودبه‌خود به‌روز
// می‌ماند. force-dynamic عمدی است: تولیدِ تصویر نباید به مسیرِ بحرانیِ build
// وصل باشد (اگر فونت در دسترس نباشد، build نباید بشکند).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'رزرونو — پلتفرمِ رزرو و مدیریتِ رستوران';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const font = await persianFont();
  // بدونِ فونتِ فارسی، متنِ فارسی درست شکل نمی‌گیرد → نسخه‌ی لاتینِ همان کارت.
  const fa = font !== null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #4338CA 0%, #7C3AED 55%, #4F46E5 100%)',
          color: '#fff',
          fontFamily: fa ? 'Vazirmatn' : 'sans-serif',
          direction: fa ? 'rtl' : 'ltr',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 18,
              background: 'rgba(255,255,255,0.18)',
              border: '2px solid rgba(255,255,255,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 34, fontWeight: 700,
            }}
          >
            {fa ? 'ر' : 'R'}
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {fa ? 'رزرونو' : 'Rezervno'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.03em' }}>
            {fa ? 'میزها پر، تلفن آرام.' : 'Full tables. Quiet phone.'}
          </div>
          <div style={{ fontSize: 34, opacity: 0.9, lineHeight: 1.5 }}>
            {fa
              ? 'پلتفرمِ رزروِ آنلاینِ میز و مدیریتِ رستوران'
              : 'Restaurant reservation & management platform'}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 26,
            opacity: 0.85,
          }}
        >
          <div style={{ display: 'flex' }}>rezervno.ir</div>
          <div
            style={{
              display: 'flex',
              padding: '12px 28px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.4)',
              fontWeight: 700,
            }}
          >
            {fa ? 'دموی ۳۰ روزه‌ی رایگان' : '30-day free trial'}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'Vazirmatn', data: font, weight: 700, style: 'normal' }] : undefined,
    },
  );
}
