// ═══════════════════════════════════════════════════════════════════════
//  تعریفِ فیلدهای استودیو
//
//  آینه‌ی schemaی بک‌اند (api/src/lib/site-content.ts) به‌شکلِ داده. ویرایشگر
//  از روی همین تعریف ساخته می‌شود، پس افزودنِ فیلدِ تازه فقط یک ردیف اینجاست.
//  اعتبارسنجیِ نهایی همیشه سمتِ سرور است؛ این‌ها فقط شکلِ فرم را می‌سازند.
// ═══════════════════════════════════════════════════════════════════════

export type FieldType =
  | 'text' | 'slug' | 'textarea' | 'markdown' | 'number' | 'boolean'
  | 'select' | 'tags' | 'list' | 'json' | 'datetime';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  /** فیلدهای سئو در یک بخشِ جمع‌شونده‌ی جدا می‌آیند تا فرم شلوغ نشود. */
  group?: 'content' | 'seo';
  placeholder?: string;
}

export interface CollectionDef {
  key: string;
  label: string;
  icon: string;
  description: string;
  /** فیلدی که در فهرست به‌عنوان عنوانِ ردیف نشان داده می‌شود. */
  titleField: string;
  subtitleField?: string;
  fields: FieldDef[];
}

const STATUS: FieldDef = {
  key: 'status', label: 'وضعیت', type: 'select', group: 'content',
  options: [{ value: 'draft', label: 'پیش‌نویس' }, { value: 'published', label: 'منتشرشده' }],
  hint: 'فقط ردیف‌های منتشرشده روی سایت دیده می‌شوند.',
};

const SORT: FieldDef = { key: 'sortOrder', label: 'ترتیب', type: 'number', group: 'content', hint: 'عددِ کوچک‌تر بالاتر.' };

const SEO_FIELDS: FieldDef[] = [
  { key: 'seoTitle', label: 'عنوانِ سئو', type: 'text', group: 'seo', hint: 'اگر خالی باشد از عنوانِ اصلی استفاده می‌شود. ۵۰ تا ۶۰ نویسه ایده‌آل است.' },
  { key: 'seoDescription', label: 'توضیحِ متا', type: 'textarea', group: 'seo', hint: '۱۲۰ تا ۱۶۰ نویسه؛ همان چیزی که در نتایجِ جست‌وجو دیده می‌شود.' },
  { key: 'seoKeywords', label: 'کلیدواژه‌ها', type: 'tags', group: 'seo' },
  { key: 'ogImage', label: 'تصویرِ اشتراک‌گذاری', type: 'text', group: 'seo', hint: 'آدرسِ کامل. خالی = تصویرِ خودکارِ سایت.', placeholder: 'https://…' },
  { key: 'noindex', label: 'ایندکس نشود', type: 'boolean', group: 'seo', hint: 'صفحه از نتایجِ جست‌وجو و sitemap کنار می‌رود.' },
];

export const COLLECTIONS: CollectionDef[] = [
  {
    key: 'pages',
    label: 'صفحه‌ها',
    icon: 'layout',
    description: 'صفحه‌های بازاریابی و بلوک‌های محتوایی‌شان',
    titleField: 'title',
    subtitleField: 'slug',
    fields: [
      { key: 'slug', label: 'اسلاگ', type: 'slug', required: true, group: 'content', hint: 'مثلاً pricing — حروفِ کوچکِ لاتین، عدد و خط‌تیره.' },
      { key: 'title', label: 'عنوانِ صفحه', type: 'text', required: true, group: 'content' },
      { key: 'description', label: 'توضیحِ داخلی', type: 'textarea', group: 'content', hint: 'فقط برای تیمِ محتوا؛ روی سایت دیده نمی‌شود.' },
      {
        key: 'sections', label: 'بلوک‌های محتوایی', type: 'json', group: 'content',
        hint: 'آرایه‌ای از بلوک‌ها. هر بلوک باید کلیدِ type داشته باشد: hero، metrics، apps، features، split، steps، comparison، showcase، pricing، testimonials، faq، cta، prose، legal.',
      },
      ...SEO_FIELDS,
      { key: 'structuredData', label: 'دادهٔ ساخت‌یافته‌ی دستی', type: 'json', group: 'seo', hint: 'JSON-LD اضافی. خالی بگذارید مگر دلیلِ مشخصی داشته باشید.' },
      STATUS,
    ],
  },
  {
    key: 'articles',
    label: 'مقاله‌ها',
    icon: 'list',
    description: 'بلاگ و محتوای آموزشی',
    titleField: 'title',
    subtitleField: 'slug',
    fields: [
      { key: 'slug', label: 'اسلاگ', type: 'slug', required: true, group: 'content' },
      { key: 'title', label: 'عنوان', type: 'text', required: true, group: 'content' },
      { key: 'excerpt', label: 'چکیده', type: 'textarea', required: true, group: 'content', hint: 'در فهرستِ بلاگ و توضیحِ متا استفاده می‌شود.' },
      { key: 'body', label: 'متنِ مقاله', type: 'markdown', required: true, group: 'content', hint: 'Markdown: ## عنوان، **پررنگ**، - فهرست، [متن](آدرس).' },
      { key: 'tags', label: 'برچسب‌ها', type: 'tags', group: 'content' },
      { key: 'authorName', label: 'نویسنده', type: 'text', group: 'content' },
      { key: 'authorRole', label: 'سِمَتِ نویسنده', type: 'text', group: 'content' },
      { key: 'readingMinutes', label: 'زمانِ مطالعه (دقیقه)', type: 'number', group: 'content' },
      { key: 'coverUrl', label: 'تصویرِ کاور', type: 'text', group: 'content', placeholder: 'https://…' },
      { key: 'coverAlt', label: 'متنِ جایگزینِ کاور', type: 'text', group: 'content' },
      { key: 'featured', label: 'مقاله‌ی ویژه', type: 'boolean', group: 'content' },
      { key: 'publishedAt', label: 'تاریخِ انتشار', type: 'datetime', group: 'content', hint: 'خالی = زمانِ انتشار خودکار ثبت می‌شود.' },
      ...SEO_FIELDS,
      STATUS,
    ],
  },
  {
    key: 'faqs',
    label: 'پرسش‌ها',
    icon: 'chat',
    description: 'پرسش‌های متداول و دادهٔ ساخت‌یافته‌ی FAQ',
    titleField: 'question',
    subtitleField: 'scope',
    fields: [
      { key: 'question', label: 'پرسش', type: 'text', required: true, group: 'content' },
      { key: 'answer', label: 'پاسخ', type: 'textarea', required: true, group: 'content', hint: 'پاسخِ کامل و مستقل؛ همین متن در FAQ schema هم می‌رود.' },
      {
        key: 'scope', label: 'محلِ نمایش', type: 'select', group: 'content',
        options: [
          { value: 'general', label: 'عمومی' },
          { value: 'pricing', label: 'قیمت و پرداخت' },
          { value: 'demo', label: 'دوره‌ی آزمایشی' },
          { value: 'business', label: 'پنلِ کسب‌وکار' },
          { value: 'customer', label: 'مهمان‌ها' },
        ],
      },
      SORT,
      STATUS,
    ],
  },
  {
    key: 'plans',
    label: 'پلن‌ها',
    icon: 'ticket',
    description: 'پلن‌های اشتراک و قیمت‌ها',
    titleField: 'name',
    subtitleField: 'key',
    fields: [
      { key: 'key', label: 'کلید', type: 'slug', required: true, group: 'content', hint: 'مثلاً m6. بعد از انتشار تغییرش ندهید (روی سفارش‌های ثبت‌شده اثر دارد).' },
      { key: 'name', label: 'نامِ پلن', type: 'text', required: true, group: 'content' },
      { key: 'tagline', label: 'توضیحِ کوتاه', type: 'text', group: 'content' },
      { key: 'months', label: 'مدت (ماه)', type: 'number', required: true, group: 'content' },
      { key: 'priceToman', label: 'قیمتِ کلِ دوره (تومان)', type: 'number', required: true, group: 'content', hint: 'همین عدد مبنای سفارش است؛ کلاینت نمی‌تواند تغییرش دهد.' },
      { key: 'compareAtToman', label: 'قیمتِ مرجع (تومان)', type: 'number', group: 'content', hint: 'برای نمایشِ صرفه‌جویی. خالی = بدونِ مقایسه.' },
      { key: 'badge', label: 'نشان', type: 'text', group: 'content', placeholder: 'محبوب‌ترین' },
      { key: 'features', label: 'امکانات', type: 'list', group: 'content', hint: 'هر خط یک مورد.' },
      { key: 'highlight', label: 'پلنِ برجسته', type: 'boolean', group: 'content' },
      {
        key: 'tenantPlan', label: 'تیرِ اشتراک', type: 'select', group: 'content',
        options: [
          { value: 'free', label: 'رایگان' },
          { value: 'starter', label: 'شروع' },
          { value: 'pro', label: 'حرفه‌ای' },
          { value: 'enterprise', label: 'سازمانی' },
        ],
        hint: 'فعال‌سازی، کسب‌وکار را روی همین تیر می‌برد.',
      },
      SORT,
      STATUS,
    ],
  },
  {
    key: 'testimonials',
    label: 'نظرها',
    icon: 'star',
    description: 'نظرِ مشتریان (فقط نظرِ واقعی و با اجازه)',
    titleField: 'author',
    subtitleField: 'company',
    fields: [
      { key: 'quote', label: 'متنِ نظر', type: 'textarea', required: true, group: 'content' },
      { key: 'author', label: 'نامِ گوینده', type: 'text', required: true, group: 'content' },
      { key: 'role', label: 'سِمَت', type: 'text', group: 'content' },
      { key: 'company', label: 'کسب‌وکار', type: 'text', group: 'content' },
      { key: 'avatarUrl', label: 'تصویر', type: 'text', group: 'content', placeholder: 'https://…' },
      { key: 'rating', label: 'امتیاز (۱ تا ۵)', type: 'number', group: 'content' },
      SORT,
      STATUS,
    ],
  },
  {
    key: 'banners',
    label: 'بنرها',
    icon: 'megaphone',
    description: 'نوارِ اطلاعیه‌ی بالای سایت',
    titleField: 'message',
    subtitleField: 'tone',
    fields: [
      { key: 'message', label: 'متنِ بنر', type: 'text', required: true, group: 'content' },
      { key: 'ctaLabel', label: 'متنِ دکمه', type: 'text', group: 'content' },
      { key: 'ctaHref', label: 'لینکِ دکمه', type: 'text', group: 'content', placeholder: '/pricing' },
      {
        key: 'tone', label: 'لحن', type: 'select', group: 'content',
        options: [
          { value: 'brand', label: 'برند' },
          { value: 'success', label: 'موفقیت' },
          { value: 'warning', label: 'هشدار' },
          { value: 'info', label: 'اطلاع' },
        ],
      },
      { key: 'startsAt', label: 'شروعِ نمایش', type: 'datetime', group: 'content', hint: 'خالی = از همین حالا.' },
      { key: 'endsAt', label: 'پایانِ نمایش', type: 'datetime', group: 'content', hint: 'خالی = بدونِ پایان.' },
      SORT,
      STATUS,
    ],
  },
  {
    key: 'release-notes',
    label: 'تغییرات',
    icon: 'rocket',
    description: 'یادداشت‌های انتشارِ محصول',
    titleField: 'title',
    subtitleField: 'version',
    fields: [
      { key: 'version', label: 'نسخه', type: 'text', required: true, group: 'content', placeholder: '2.4' },
      { key: 'title', label: 'عنوان', type: 'text', required: true, group: 'content' },
      { key: 'body', label: 'شرحِ تغییرات', type: 'markdown', required: true, group: 'content', hint: 'با «- » فهرستِ تغییرات بنویسید.' },
      { key: 'tags', label: 'برچسب‌ها', type: 'tags', group: 'content' },
      { key: 'releasedAt', label: 'تاریخِ انتشار', type: 'datetime', required: true, group: 'content' },
      STATUS,
    ],
  },
];

export function collectionByKey(key: string): CollectionDef | undefined {
  return COLLECTIONS.find((c) => c.key === key);
}

/** مقدارِ خالیِ پیش‌فرضِ هر نوع فیلد — برای فرمِ «ردیفِ تازه». */
export function emptyValue(field: FieldDef): unknown {
  switch (field.type) {
    case 'boolean': return false;
    case 'number': return '';
    case 'tags':
    case 'list': return [];
    case 'json': return field.key === 'sections' ? [] : null;
    case 'select': return field.options?.[0]?.value ?? '';
    default: return '';
  }
}
