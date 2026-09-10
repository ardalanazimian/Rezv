// ═══════════════════════════════════════════════════════════════════════
//  انتخابِ نقش — بالای صفحه‌ی اصلی
//
//  چرا این‌جا لازم بود: صفحه‌ی اصلی قبلِ این تغییر هیچ مسیری به اپِ مشتری
//  نداشت — هیرو و کلِ بدنه‌ی CMS مخاطبش صاحبِ رستوران بود («شروعِ دموی
//  ۳۰ روزه»)، و تنها درِ اپِ مشتری در `/login` بود که هیچ مهمانی به آن سر
//  نمی‌زند. مهمانی که به `rezervno.ir` می‌رسد باید در **همین صفحه**، بدونِ
//  خواندنِ چیزی، بفهمد کجا برود.
//
//  چرا از DoorPicker استفاده شد نه یک ویجتِ تازه: آن کامپوننت از قبل بدونِ
//  جاوااسکریپت کار می‌کند، با کیبورد قابلِ‌پیمایش است و RTL را درست رعایت
//  می‌کند (`DoorPicker.tsx`) — مشکلش مکانش بود، نه کیفیتش. این‌جا با دو در
//  به‌جای سه، و بیرونِ چارچوبِ تمام‌قدِ `.gate`، دوباره استفاده می‌شود.
//
//  چرا فقط دو در (بدونِ «پنلِ شرکت»): پنلِ شرکت مخصوصِ کارکنانِ داخلیِ
//  رزرونوست، نه بازدیدکنندهٔ سایت؛ نمایشش این‌جا خودش یک منبعِ گیجی است.
// ═══════════════════════════════════════════════════════════════════════

import { DoorPicker, type Door } from './DoorPicker';
import { appBase } from '@/lib/i18n';

const HOME_DOORS: Door[] = [
  {
    key: 'customer',
    icon: 'phone',
    title: 'مهمانم، دنبالِ رزرو',
    body: 'کشفِ رستوران، دیدنِ منو، و رزروِ میز با شماره‌ی موبایل.',
    hint: 'رزرو در چند ثانیه، بدونِ نصب',
    // appBase() همیشه یک مقدار دارد (استخراج از NEXT_PUBLIC_SITE_URL)، پس
    // این در هرگز به «پیکربندی‌نشده» نمی‌افتد.
    href: appBase(),
  },
  {
    key: 'business',
    icon: 'layout',
    title: 'صاحبِ رستورانم',
    body: 'رزرو، میز، لیستِ انتظار، مشتریان و گزارش‌های رستوران.',
    hint: 'دموی ۳۰ روزه، بدونِ کارتِ بانکی',
    href: process.env.NEXT_PUBLIC_BUSINESS_APP_URL ?? null,
    fallbackHref: '/demo',
    fallbackLabel: 'شروعِ دموی رایگان',
  },
];

export function HomeGate() {
  return (
    <section className="section section--tight home-gate" aria-labelledby="home-gate-title">
      <div className="container">
        <div className="section-head section-head--center">
          <span className="eyebrow">رزرونو برایِ هر دو طرفِ میز است</span>
          <h2 id="home-gate-title" className="h2">مهمانید یا صاحبِ رستوران؟</h2>
          <p className="lead">هرکدام هستید، مسیرِ درست همین‌جاست — نه در فرمِ تماس.</p>
        </div>
        <DoorPicker doors={HOME_DOORS} />
      </div>
    </section>
  );
}
