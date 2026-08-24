import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sep } from 'node:path';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
// مسیرِ ریشه پیش از import ست می‌شود چون uploadRoot آن را در زمانِ فراخوانی می‌خواند.
process.env.UPLOAD_DIR = '/data/uploads';

const { canTransition, isPublic, ownerView, publicView, mediaUrl, STATUS_LABEL, PUBLIC_STATUS } =
  await import('../src/lib/photo-moderation.ts');
const { resolveKey, uploadRoot } = await import('../src/lib/media-store.ts');

const UUID = '11111111-2222-4333-8444-555555555555';

describe('گذارِ وضعیت', () => {
  test('عکسِ تازه تأیید یا رد می‌شود', () => {
    assert.equal(canTransition('pending', 'approved'), true);
    assert.equal(canTransition('pending', 'rejected'), true);
  });

  test('نظرِ بازبین قابلِ‌تغییر است (اشتباه پیش می‌آید)', () => {
    assert.equal(canTransition('approved', 'rejected'), true);
    assert.equal(canTransition('rejected', 'approved'), true);
  });

  // اگر دو بازبین هم‌زمان روی یک عکس کار کنند، دومی باید خطا بگیرد نه اینکه
  // بی‌صدا رد شود و فکر کند تصمیمش اعمال شده.
  test('تصمیمِ تکراری رد می‌شود', () => {
    assert.equal(canTransition('approved', 'approved'), false);
    assert.equal(canTransition('rejected', 'rejected'), false);
  });

  test('هیچ‌چیز به صفِ انتظار برنمی‌گردد', () => {
    for (const from of ['pending', 'approved', 'rejected'] as const) {
      assert.equal(canTransition(from, 'pending'), false, `${from} → pending نباید ممکن باشد`);
    }
  });
});

describe('مرزِ نمایشِ عمومی', () => {
  test('فقط approved عمومی است', () => {
    assert.equal(isPublic('approved'), true);
    assert.equal(isPublic('pending'), false);
    assert.equal(isPublic('rejected'), false);
  });

  test('PUBLIC_STATUS همان چیزی است که کوئریِ عمومی با آن فیلتر می‌کند', () => {
    assert.equal(PUBLIC_STATUS, 'approved');
  });

  // نشتِ فیلدِ بازبینی به بیرون یعنی هر بازدیدکننده‌ای می‌فهمد کدام عکس رد
  // شده و چرا — دادهٔ داخلیِ رستوران است، نه عمومی.
  test('نمای عمومی هیچ فیلدِ بازبینی ندارد', () => {
    const v = publicView({ url: '/api/v1/media/x.jpg', caption: 'کباب', category: 'food' });
    assert.deepEqual(Object.keys(v).sort(), ['caption', 'category', 'url']);
  });
});

describe('نمای صاحبِ رستوران', () => {
  const row = {
    id: 'p1', url: mediaUrl(`2026/08/${UUID}.jpg`), caption: 'میزِ کنارِ پنجره',
    category: 'interior', sortOrder: 2, status: 'rejected' as const,
    rejectionReason: 'کیفیت پایین است', reviewedAt: new Date('2026-08-05T10:00:00Z'),
    width: 1200, height: 800, byteSize: 240_000, createdAt: new Date('2026-08-04T09:00:00Z'),
  };

  test('دلیلِ رد به رستوران می‌رسد', () => {
    const v = ownerView(row);
    assert.equal(v.status, 'rejected');
    assert.equal(v.rejection_reason, 'کیفیت پایین است');
    assert.equal(v.is_public, false);
  });

  test('برچسبِ فارسیِ وضعیت یک‌جا تعریف شده و در هر دو پنل یکی است', () => {
    assert.equal(ownerView(row).status_label, STATUS_LABEL.rejected);
    assert.equal(STATUS_LABEL.pending, 'در انتظار تأیید');
  });

  test('تاریخ‌ها ISO می‌شوند نه شیِ Date (تا JSON درست شود)', () => {
    const v = ownerView(row);
    assert.equal(typeof v.created_at, 'string');
    assert.equal(typeof v.reviewed_at, 'string');
  });

  test('عکسِ بازبینی‌نشده reviewed_at ندارد', () => {
    const v = ownerView({ ...row, status: 'pending', reviewedAt: null, rejectionReason: null });
    assert.equal(v.reviewed_at, null);
    assert.equal(v.is_public, false);
  });
});

describe('resolveKey — دفاعِ دوم در برابرِ path traversal', () => {
  test('کلیدِ معتبر زیرِ ریشه می‌نشیند', () => {
    const full = resolveKey(`2026/08/${UUID}.jpg`);
    assert.ok(full);
    // باگِ رفع‌شده: قبلاً همیشه '/' هاردکد بود، ولی resolveKey (media-store.ts)
    // خودش با sepِ بومیِ سیستم‌عامل مقایسه می‌کند — روی ویندوز full با
    // uploadRoot()+'\\' شروع می‌شود نه '/'، پس این تست رویِ ویندوز همیشه
    // false می‌داد (کدِ منبع همیشه درست بود؛ لینوکس/CI چون sep==='/' است
    // این باگ را هیچ‌وقت نشان نمی‌داد).
    assert.ok(full!.startsWith(uploadRoot() + sep));
  });

  // حتی اگر روزی الگوی کلید شل شود، این لایه باید جلوی خروج از ریشه را بگیرد.
  for (const bad of [
    `../../../etc/passwd`,
    `2026/08/../../../../etc/shadow`,
    `/etc/passwd`,
    `2026/08/${UUID}.svg`,
    `2026/08/${UUID}.jpg/../../..`,
  ]) {
    test(`رد می‌شود: «${bad}»`, () => {
      assert.equal(resolveKey(bad), null);
    });
  }

  test('آدرسِ سرو همیشه زیرِ /api/v1/media/ است', () => {
    assert.equal(mediaUrl(`2026/08/${UUID}.jpg`), `/api/v1/media/2026/08/${UUID}.jpg`);
  });
});
