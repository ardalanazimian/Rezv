// ═══════════════════════════════════════════════════════════════════════
//  رزرونو — پنل company: صفِ بازبینیِ عکسِ گالری
//
//  رستوران عکس را از پنلِ کسب‌وکار آپلود می‌کند و عکس با وضعیتِ pending
//  می‌نشیند. تا وقتی اینجا تأیید نشود، در اپ مشتری و صفحه‌ی عمومیِ رستوران
//  دیده نمی‌شود. یعنی هیچ تصویری بدونِ بازبینیِ انسانی روی برندِ پلتفرم
//  منتشر نمی‌شود.
//
//  منبعِ داده: GET  /api/v1/admin/photos?status=pending
//  عملیات:    PATCH /api/v1/admin/photos/{id}  { action: 'approve'|'reject', reason? }
//             DELETE /api/v1/admin/photos/{id}  (موردِ حاد — فایل هم پاک می‌شود)
//
//  صف عمداً FIFO است (قدیمی‌ترین اول): وگرنه عکسِ یک رستورانِ کوچک می‌تواند
//  هفته‌ها پشتِ آپلودهای تازه بماند.
// ═══════════════════════════════════════════════════════════════════════

let PHOTO_ITEMS = [];
let PHOTO_FILTER = 'pending';   // pending | approved | rejected | all
let PHOTO_LOADING = false;
let PHOTO_ERROR = null;
let PHOTO_BADGE = 0;
let PHOTO_DEMO = false;         // آیا چیزی که روی صفحه است دادهٔ نمونه است؟

// نمونه‌ی نمایشی — فقط وقتی سرور در دسترس نیست (نسخه‌ی آفلاینِ پنل برای
// ارائه). نام‌ها عمداً با [DEMO] برچسب خورده‌اند تا هیچ‌وقت با دادهٔ واقعی
// اشتباه گرفته نشوند، و در این حالت دکمه‌های تأیید/رد کاری انجام نمی‌دهند —
// تصمیمِ انتشار نباید روی دادهٔ ساختگی گرفته شود.
const PHOTO_SAMPLE = [
  { id: 'demo-1', url: '', caption: 'میزهای کنارِ پنجره', category: 'interior', status: 'pending',
    width: 1600, height: 1067, byte_size: 384000, original_name: 'salon-window.jpg',
    created_at: new Date(Date.now() - 36e5 * 3).toISOString(), reviewed_at: null, rejection_reason: null,
    restaurant: { id: 'd1', name: '[DEMO] کافه‌رستوران ویستا', slug: 'demo-vista', city: 'تهران' } },
  { id: 'demo-2', url: '', caption: 'خورشتِ ویژه‌ی شب', category: 'food', status: 'pending',
    width: 1200, height: 1200, byte_size: 268000, original_name: 'dish-01.jpg',
    created_at: new Date(Date.now() - 36e5 * 9).toISOString(), reviewed_at: null, rejection_reason: null,
    restaurant: { id: 'd2', name: '[DEMO] سفره‌خانه گرام', slug: 'demo-geram', city: 'اصفهان' } },
  { id: 'demo-3', url: '', caption: '', category: 'drink', status: 'pending',
    width: 900, height: 1600, byte_size: 512000, original_name: 'bar.png',
    created_at: new Date(Date.now() - 36e5 * 26).toISOString(), reviewed_at: null, rejection_reason: null,
    restaurant: { id: 'd3', name: '[DEMO] کافه هانا', slug: 'demo-hana', city: 'تهران' } },
];

const PHOTO_STATUS = {
  pending: { label: 'در انتظار تأیید', cls: 'expiring' },
  approved: { label: 'تأییدشده', cls: 'active' },
  rejected: { label: 'ردشده', cls: 'expired' },
};
const PHOTO_CATEGORY = {
  food: 'غذا', interior: 'فضا', drink: 'نوشیدنی', event: 'رویداد', other: 'سایر',
};

/** حجم به کیلو/مگابایت با ارقامِ فارسی. */
function photoSize(bytes) {
  if (!bytes) return '—';
  return bytes >= 1024 * 1024
    ? fa((bytes / 1024 / 1024).toFixed(1)) + ' مگابایت'
    : fa(Math.round(bytes / 1024)) + ' کیلوبایت';
}

function photoDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran',
    }).format(d);
  } catch { return fa(d.toISOString().slice(0, 16).replace('T', ' ')); }
}

// ════════ بارگذاری ════════

async function loadPhotos() {
  PHOTO_LOADING = true;
  PHOTO_ERROR = null;
  rPhotos();

  const res = await API.get('/admin/photos?status=' + PHOTO_FILTER + '&limit=100');
  PHOTO_LOADING = false;

  if (!res.ok) {
    if (res.offline) {
      // نسخه‌ی آفلاینِ پنل (برای ارائه): نمونه نشان داده می‌شود ولی با برچسبِ
      // آشکار و بدونِ اینکه دکمه‌ها کاری کنند. تصمیمِ انتشار نباید روی دادهٔ
      // ساختگی گرفته شود — همان قاعده، فقط به‌جای صفحه‌ی خالی، شفاف.
      PHOTO_DEMO = true;
      PHOTO_ERROR = null;
      PHOTO_ITEMS = PHOTO_FILTER === 'pending' || PHOTO_FILTER === 'all' ? PHOTO_SAMPLE : [];
      PHOTO_BADGE = PHOTO_SAMPLE.length;
    } else {
      PHOTO_DEMO = false;
      PHOTO_ERROR = (res.error && res.error.message) || 'دریافتِ صفِ بازبینی ناموفق بود.';
      PHOTO_ITEMS = [];
    }
  } else {
    PHOTO_DEMO = false;
    PHOTO_ITEMS = res.data.items || [];
    PHOTO_BADGE = res.data.pending_count || 0;
  }
  rPhotos();
  paintPhotoBadge();
}

function paintPhotoBadge() {
  const el = document.getElementById('photoBadge');
  if (!el) return;
  el.textContent = PHOTO_BADGE ? fa(PHOTO_BADGE) : '';
  el.style.display = PHOTO_BADGE ? 'inline-flex' : 'none';
}

/**
 * فقط شمارشِ صف را می‌گیرد، بدونِ رندرِ صفحه.
 * هنگامِ ورود صدا زده می‌شود تا کارِ منتظر از همان ابتدا دیده شود، نه فقط
 * وقتی که کاربر اتفاقی وارد این صفحه شود. limit=1 چون فقط عدد را می‌خواهیم.
 */
async function refreshPhotoBadge() {
  const res = await API.get('/admin/photos?status=pending&limit=1');
  if (!res.ok) return;
  PHOTO_BADGE = res.data.pending_count || 0;
  paintPhotoBadge();
}

function photoFilter(f) { PHOTO_FILTER = f; loadPhotos(); }

// ════════ رندر ════════

function rPhotos() {
  const el = document.getElementById('v-photos');
  if (!el) return;

  el.innerHTML = `
    <div class="bill-summary">
      <div class="bill-stat"><div class="bs-val" style="color:var(--amber-600)">${fa(PHOTO_BADGE)}</div><div class="bs-label">عکسِ در انتظارِ بازبینی</div></div>
      <div class="bill-stat"><div class="bs-val" style="color:var(--ink)">${fa(PHOTO_ITEMS.length)}</div><div class="bs-label">در فهرستِ فعلی</div></div>
    </div>

    <div class="panel">
      <div class="panel-head" style="flex-wrap:wrap;gap:10px">
        <div>
          <div class="panel-title">بازبینیِ عکسِ گالری</div>
          <div class="panel-sub">عکس تا تأییدِ اینجا در اپ مشتری و صفحه‌ی رستوران دیده نمی‌شود · هر تصمیم در گزارشِ حسابرسی ثبت می‌گردد</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['pending', 'approved', 'rejected', 'all'].map((f) => `
            <button class="btn btn-sm ${PHOTO_FILTER === f ? 'btn-primary' : 'btn-ghost'}" onclick="photoFilter('${f}')">
              ${f === 'pending' ? 'در انتظار' : f === 'approved' ? 'تأییدشده' : f === 'rejected' ? 'ردشده' : 'همه'}
            </button>`).join('')}
          <button class="btn btn-ghost btn-sm" onclick="loadPhotos()">${PHOTO_LOADING ? 'در حال بارگذاری…' : 'تازه‌سازی'}</button>
        </div>
      </div>

      ${PHOTO_DEMO ? `<div style="margin:0 0 14px;padding:11px 14px;background:var(--amber-50);border:1px solid #FDE68A;border-radius:10px;font-size:12.5px;color:#92400E;line-height:1.7">
        <b>نمایشِ نمونه.</b> سرور در دسترس نیست، پس این عکس‌ها ساختگی‌اند و با <b>[DEMO]</b> برچسب خورده‌اند.
        دکمه‌های تأیید و رد در این حالت چیزی را تغییر نمی‌دهند.
      </div>` : ''}
      ${PHOTO_ERROR ? `<div style="padding:22px;text-align:center;color:var(--red-600);font-size:13px">${esc(PHOTO_ERROR)}</div>` : ''}
      ${PHOTO_LOADING ? `<div style="padding:22px;text-align:center;color:var(--muted);font-size:13px">در حال دریافت…</div>` : ''}
      ${!PHOTO_LOADING && !PHOTO_ERROR ? renderPhotoQueue() : ''}
    </div>`;
}

function renderPhotoQueue() {
  if (!PHOTO_ITEMS.length) {
    return `<div style="padding:34px;text-align:center;color:var(--muted);font-size:13px">
      ${PHOTO_FILTER === 'pending' ? 'صف خالی است — همه‌ی عکس‌ها بازبینی شده‌اند.' : 'موردی در این فیلتر نیست.'}
    </div>`;
  }

  return `<div class="photo-queue">
    ${PHOTO_ITEMS.map((p) => {
      const st = PHOTO_STATUS[p.status] || PHOTO_STATUS.pending;
      return `<div class="photo-card">
        ${p.url ? `<a class="photo-card__img" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">
          <img src="${esc(p.url)}" alt="${esc(p.caption || 'عکسِ گالری')}" loading="lazy">
        </a>` : `<div class="photo-card__img photo-card__img--demo">${PHOTO_CATEGORY[p.category] || 'عکس'}</div>`}
        <div class="photo-card__body">
          <div class="photo-card__top">
            <span class="photo-card__rest">${esc(p.restaurant.name)}</span>
            <span class="badge ${st.cls}">${st.label}</span>
          </div>
          <div class="photo-card__meta">
            ${PHOTO_CATEGORY[p.category] || p.category} ·
            ${p.width && p.height ? fa(p.width) + '×' + fa(p.height) : '—'} ·
            ${photoSize(p.byte_size)} · ${photoDate(p.created_at)}
          </div>
          ${p.caption ? `<div class="photo-card__cap">${esc(p.caption)}</div>` : ''}
          ${p.rejection_reason ? `<div class="photo-card__reason">دلیلِ رد: ${esc(p.rejection_reason)}</div>` : ''}
          <div class="photo-card__actions">
            ${p.status !== 'approved' ? `<button class="btn btn-primary btn-sm" onclick="approvePhoto('${p.id}')">تأیید و انتشار</button>` : ''}
            ${p.status !== 'rejected' ? `<button class="btn btn-ghost btn-sm" onclick="rejectPhoto('${p.id}')">رد</button>` : ''}
            <button class="btn btn-ghost btn-sm" style="color:var(--red-600)" onclick="deletePhotoHard('${p.id}')">حذفِ کامل</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ════════ عملیات ════════

/** در حالتِ نمونه هیچ تصمیمی ثبت نمی‌شود — و کاربر باید بداند، نه اینکه حدس بزند. */
function demoBlocked() {
  if (!PHOTO_DEMO) return false;
  toast('', 'این یک نمایشِ نمونه است — برای تأیید یا رد باید به سرور وصل باشی');
  return true;
}

async function approvePhoto(id) {
  if (demoBlocked()) return;
  const res = await API.patch('/admin/photos/' + id, { action: 'approve' });
  if (!res.ok) { toast('✕', (res.error && res.error.message) || 'تأیید ناموفق بود'); return; }
  toast('✓', 'عکس تأیید شد و روی صفحه‌ی رستوران منتشر شد');
  loadPhotos();
}

async function rejectPhoto(id) {
  if (demoBlocked()) return;
  // دلیل اختیاری است ولی خواسته می‌شود: رستوران‌دار همین متن را در پنلش
  // می‌بیند و بدونِ آن فقط می‌فهمد «نشد»، نه اینکه چه چیزی را اصلاح کند.
  const reason = window.prompt('دلیلِ رد (برای رستوران نمایش داده می‌شود):', '');
  if (reason === null) return;
  const res = await API.patch('/admin/photos/' + id, { action: 'reject', reason: reason.trim() });
  if (!res.ok) { toast('✕', (res.error && res.error.message) || 'رد کردن ناموفق بود'); return; }
  toast('✓', 'عکس رد شد');
  loadPhotos();
}

async function deletePhotoHard(id) {
  if (demoBlocked()) return;
  if (!window.confirm('عکس و فایلش برای همیشه حذف می‌شود. مطمئنی؟')) return;
  const res = await API.del('/admin/photos/' + id);
  if (!res.ok) { toast('✕', (res.error && res.error.message) || 'حذف ناموفق بود'); return; }
  toast('✓', 'عکس حذف شد');
  loadPhotos();
}
