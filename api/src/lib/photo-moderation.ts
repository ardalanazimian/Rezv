// ═══════════════════════════════════════════════════════════════════════
//  photo-moderation — قواعدِ بازبینیِ عکسِ گالری
//
//  منطق اینجا خالص نگه داشته شده تا تست‌پذیر باشد و در سه جا یکسان بماند:
//  پنلِ کسب‌وکار (که عکسِ خودش را می‌بیند)، پنلِ شرکت (که بازبینی می‌کند) و
//  صفحه‌ی عمومی (که فقط تأییدشده را نشان می‌دهد).
// ═══════════════════════════════════════════════════════════════════════

export type PhotoStatus = 'pending' | 'approved' | 'rejected';

export const PHOTO_CATEGORIES = ['food', 'interior', 'drink', 'event', 'other'] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

/** تنها وضعیتی که اجازه‌ی نمایشِ عمومی دارد. */
export const PUBLIC_STATUS: PhotoStatus = 'approved';

/** برچسبِ فارسیِ وضعیت — یک‌جا تعریف می‌شود تا دو پنل حرفِ متفاوت نزنند. */
export const STATUS_LABEL: Record<PhotoStatus, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تأییدشده',
  rejected: 'ردشده',
};

/**
 * گذارهای مجاز. بازبینیِ دوباره‌ی یک عکسِ ردشده یا تأییدشده عمداً ممکن است
 * (مدیر ممکن است اشتباه کرده باشد)، ولی گذار به pending نه: چیزی که یک بار
 * تصمیم گرفته شده نباید بی‌صدا به صف برگردد.
 */
export function canTransition(from: PhotoStatus, to: PhotoStatus): boolean {
  if (to === 'pending') return false;
  // تصمیمِ تکراری خطاست، نه no-opِ خاموش: اگر دو بازبین هم‌زمان روی یک عکس
  // کار کنند، دومی باید بفهمد تصمیم از قبل گرفته شده.
  return from !== to;
}

/** آیا این عکس باید در سطحِ عمومی دیده شود؟ */
export function isPublic(status: PhotoStatus): boolean {
  return status === PUBLIC_STATUS;
}

export interface PhotoRow {
  id: string;
  url: string;
  caption: string | null;
  category: string;
  sortOrder: number;
  status: PhotoStatus;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  createdAt: Date;
}

/**
 * نمایی که صاحبِ رستوران می‌بیند: همه‌ی عکس‌ها با وضعیتشان.
 * دیدنِ عکسِ ردشده همراه با دلیل عمدی است — بدونِ آن، رستوران‌دار فقط
 * می‌بیند عکسش «نیامده» و دوباره همان را آپلود می‌کند.
 */
export function ownerView(p: PhotoRow) {
  return {
    id: p.id,
    url: p.url,
    caption: p.caption,
    category: p.category,
    sort_order: p.sortOrder,
    status: p.status,
    status_label: STATUS_LABEL[p.status],
    is_public: isPublic(p.status),
    rejection_reason: p.rejectionReason,
    reviewed_at: p.reviewedAt?.toISOString() ?? null,
    width: p.width,
    height: p.height,
    byte_size: p.byteSize,
    created_at: p.createdAt.toISOString(),
  };
}

/** نمای عمومی: هیچ فیلدِ بازبینی بیرون نمی‌رود. */
export function publicView(p: Pick<PhotoRow, 'url' | 'caption' | 'category'>) {
  return { url: p.url, caption: p.caption, category: p.category };
}

/** آدرسِ سرو برای فایلی که روی ولوم نشسته. */
export function mediaUrl(key: string): string {
  return `/api/v1/media/${key}`;
}
