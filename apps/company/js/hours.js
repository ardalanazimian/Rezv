// ═══════════════════════════════════════════════════════════════════════
//  رزرونو — پنل company: صفِ تأییدِ ساعتِ کاری (Part 3، ۲۰۲۶-۰۸-۱۴)
//
//  رستوران‌دار از پنلِ کسب‌وکار ساعتِ کاریِ جدید پیشنهاد می‌دهد و رکورد
//  با وضعیتِ pending می‌نشیند. تا وقتی اینجا تأیید نشود، ساعتِ کاریِ *زنده*
//  (چیزی که مشتری در availability می‌بیند) دست‌نخورده می‌ماند — دقیقاً همان
//  الگویِ بازبینیِ عکسِ گالری (photos.js)، فقط برای ساعتِ کاری.
//
//  منبعِ داده: GET   /api/v1/admin/hours-changes?status=pending
//  عملیات:    PATCH /api/v1/admin/hours-changes/{id}  { action:'approve'|'reject', reason? }
//
//  صف عمداً FIFO است (قدیمی‌ترین اول): وگرنه یک پیشنهاد می‌تواند هفته‌ها
//  پشتِ پیشنهادهای تازه‌تر بماند در حالی که مشتری همچنان ساعتِ کاریِ
//  قدیمی را می‌بیند.
// ═══════════════════════════════════════════════════════════════════════

let HCHANGE_ITEMS = [];
let HCHANGE_FILTER = 'pending';  // pending | rejected | all
let HCHANGE_LOADING = false;
let HCHANGE_ERROR = null;
let HCHANGE_BADGE = 0;
let HCHANGE_DEMO = false;

const HCHANGE_DOW_ORDER = [6, 0, 1, 2, 3, 4, 5];
const HCHANGE_DOW_FA = { 0: 'یکشنبه', 1: 'دوشنبه', 2: 'سه‌شنبه', 3: 'چهارشنبه', 4: 'پنجشنبه', 5: 'جمعه', 6: 'شنبه' };

// نمونه‌ی نمایشی — فقط وقتی سرور در دسترس نیست. مثلِ photos.js، دکمه‌ها در
// این حالت کاری انجام نمی‌دهند (تصمیمِ ساعتِ کاری هم نباید روی دادهٔ ساختگی گرفته شود).
const HCHANGE_SAMPLE = [
  { id: 'demo-1', timezone: 'Asia/Tehran', status: 'pending', rejection_reason: null,
    requested_at: new Date(Date.now() - 36e5 * 5).toISOString(), reviewed_at: null,
    live_opening_hours: { 6: [['12:00', '23:00']], 0: [['12:00', '23:00']], 1: [['12:00', '23:00']], 2: [['12:00', '23:00']], 3: [['12:00', '23:00']], 4: [['12:00', '23:30']], 5: [] },
    proposed_opening_hours: { 6: [['12:00', '23:30']], 0: [['12:00', '23:30']], 1: [['12:00', '23:30']], 2: [['12:00', '23:30']], 3: [['12:00', '23:30']], 4: [['12:00', '24:00']], 5: [['18:00', '23:00']] },
    restaurant: { id: 'd1', name: '[DEMO] کافه‌رستوران ویستا', slug: 'demo-vista', city: 'تهران' } },
];

const HCHANGE_STATUS = {
  pending: { label: 'در انتظار تأیید', cls: 'expiring' },
  rejected: { label: 'ردشده', cls: 'expired' },
};

function hchangeDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran',
    }).format(d);
  } catch { return fa(d.toISOString().slice(0, 16).replace('T', ' ')); }
}

/** خطِ فشرده‌ی یک روز — برای مقایسه‌ی زنده در برابرِ پیشنهاد. */
function hchangeDayLine(oh, d) {
  const shifts = oh ? oh[d] : undefined;
  if (!Array.isArray(shifts)) return '—';
  if (!shifts.length) return 'تعطیل';
  return shifts.map(s => `${esc(s[0])}–${esc(s[1])}`).join('، ');
}
function hchangeDaysEqual(live, proposed, d) {
  return hchangeDayLine(live, d) === hchangeDayLine(proposed, d);
}

// ════════ بارگذاری ════════

async function loadHoursChanges() {
  HCHANGE_LOADING = true;
  HCHANGE_ERROR = null;
  rHoursChanges();

  const res = await API.hoursQueue(HCHANGE_FILTER);
  HCHANGE_LOADING = false;

  if (!res.ok) {
    if (res.offline) {
      HCHANGE_DEMO = true;
      HCHANGE_ERROR = null;
      HCHANGE_ITEMS = HCHANGE_FILTER === 'pending' || HCHANGE_FILTER === 'all' ? HCHANGE_SAMPLE : [];
      // ⚠️ فازِ ۲ (§۳): نشانِ سایدبار عمداً از دادهٔ نمونه پر **نمی‌شود**.
      // ردیف‌هایِ نمونه فقط داخلِ همان ویوِ صف می‌مانند، جایی که بنرِ دمو
      // توضیحشان می‌دهد. نشان اما رویِ **همه‌ی** صفحاتِ پنل دیده می‌شود و
      // هیچ زمینه‌ای همراهش نیست — پس عددِ ساختگی آن‌جا از بکلاگِ واقعی
      // قابلِ تشخیص نبود. بدونِ پاسخِ سرور، شمارش نامعلوم است، نه صفر و نه سه.
      HCHANGE_BADGE = 0;
    } else {
      HCHANGE_DEMO = false;
      HCHANGE_ERROR = (res.error && res.error.message) || 'دریافتِ صفِ تأییدِ ساعتِ کاری ناموفق بود.';
      HCHANGE_ITEMS = [];
    }
  } else {
    HCHANGE_DEMO = false;
    HCHANGE_ITEMS = res.data.items || [];
    HCHANGE_BADGE = res.data.pending_count || 0;
  }
  rHoursChanges();
  paintHoursChangeBadge();
}

function paintHoursChangeBadge() {
  const el = document.getElementById('hoursBadge');
  if (!el) return;
  el.textContent = HCHANGE_BADGE ? fa(HCHANGE_BADGE) : '';
  el.style.display = HCHANGE_BADGE ? 'inline-flex' : 'none';
}

/** فقط شمارشِ صف را می‌گیرد، بدونِ رندرِ صفحه — مثلِ refreshPhotoBadge/refreshSalesBadge. */
async function refreshHoursChangeBadge() {
  const res = await API.hoursQueue('pending');
  if (!res.ok) return;
  HCHANGE_BADGE = res.data.pending_count || 0;
  paintHoursChangeBadge();
}

function hchangeFilter(f) { HCHANGE_FILTER = f; loadHoursChanges(); }

// ════════ رندر ════════

function rHoursChanges() {
  const el = document.getElementById('v-hours');
  if (!el) return;

  el.innerHTML = `
    <div class="bill-summary">
      <div class="bill-stat"><div class="bs-val" style="color:var(--amber-600)">${fa(HCHANGE_BADGE)}</div><div class="bs-label">پیشنهادِ در انتظارِ بررسی</div></div>
      <div class="bill-stat"><div class="bs-val" style="color:var(--ink)">${fa(HCHANGE_ITEMS.length)}</div><div class="bs-label">در فهرستِ فعلی</div></div>
    </div>

    <div class="panel">
      <div class="panel-head" style="flex-wrap:wrap;gap:10px">
        <div>
          <div class="panel-title">تأییدِ ساعتِ کاری</div>
          <div class="panel-sub">ساعتِ کاریِ رستوران تا تأییدِ اینجا زنده نمی‌شود — مشتری همیشه ساعتِ تأییدشده‌ی قبلی را می‌بیند · هر تصمیم در گزارشِ حسابرسی ثبت می‌گردد</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['pending', 'rejected', 'all'].map((f) => `
            <button class="btn btn-sm ${HCHANGE_FILTER === f ? 'btn-primary' : 'btn-ghost'}" onclick="hchangeFilter('${f}')">
              ${f === 'pending' ? 'در انتظار' : f === 'rejected' ? 'ردشده' : 'همه'}
            </button>`).join('')}
          <button class="btn btn-ghost btn-sm" onclick="loadHoursChanges()">${HCHANGE_LOADING ? 'در حال بارگذاری…' : 'تازه‌سازی'}</button>
        </div>
      </div>

      ${HCHANGE_DEMO ? `<div style="margin:0 0 14px;padding:11px 14px;background:var(--amber-50);border:1px solid #FDE68A;border-radius:10px;font-size:12.5px;color:#92400E;line-height:1.7">
        <b>نمایشِ نمونه.</b> سرور در دسترس نیست، پس این پیشنهادها ساختگی‌اند و با <b>[DEMO]</b> برچسب خورده‌اند.
        دکمه‌های تأیید و رد در این حالت چیزی را تغییر نمی‌دهند.
      </div>` : ''}
      ${HCHANGE_ERROR ? `<div style="padding:22px;text-align:center;color:var(--red-600);font-size:13px">${esc(HCHANGE_ERROR)}</div>` : ''}
      ${HCHANGE_LOADING ? `<div style="padding:22px;text-align:center;color:var(--muted);font-size:13px">در حال دریافت…</div>` : ''}
      ${!HCHANGE_LOADING && !HCHANGE_ERROR ? renderHoursChangeQueue() : ''}
    </div>`;
}

function renderHoursChangeQueue() {
  if (!HCHANGE_ITEMS.length) {
    return `<div style="padding:34px;text-align:center;color:var(--muted);font-size:13px">
      ${HCHANGE_FILTER === 'pending' ? 'صف خالی است — همه‌ی پیشنهادها بررسی شده‌اند.' : 'موردی در این فیلتر نیست.'}
    </div>`;
  }

  return `<div class="hchange-list">
    ${HCHANGE_ITEMS.map((h) => {
      const st = HCHANGE_STATUS[h.status] || HCHANGE_STATUS.pending;
      const live = h.live_opening_hours, proposed = h.proposed_opening_hours;
      return `<div class="hchange-card">
        <div class="hchange-top">
          <div>
            <span class="hchange-rest">${esc(h.restaurant.name)}</span>
            <span class="hchange-meta"> · ${esc(h.restaurant.city || '—')} · پیشنهاد در ${hchangeDate(h.requested_at)}</span>
          </div>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        <div class="hchange-days">
          <div class="hchange-days-head"><span>زنده (فعلی)</span><span>پیشنهاد</span></div>
          ${HCHANGE_DOW_ORDER.map(d => {
            const diff = !hchangeDaysEqual(live, proposed, d);
            return `<div class="hchange-day${diff ? ' diff' : ''}">${HCHANGE_DOW_FA[d]}: ${hchangeDayLine(live, d)}</div>
              <div class="hchange-day${diff ? ' diff' : ''}">${HCHANGE_DOW_FA[d]}: ${hchangeDayLine(proposed, d)}</div>`;
          }).join('')}
        </div>
        ${h.rejection_reason ? `<div class="hchange-reason">دلیلِ رد: ${esc(h.rejection_reason)}</div>` : ''}
        <div class="hchange-actions">
          ${h.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="approveHoursChange('${h.id}')">تأیید و زنده‌سازی</button>
          <button class="btn btn-ghost btn-sm" onclick="rejectHoursChange('${h.id}')">رد</button>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ════════ عملیات ════════

/** در حالتِ نمونه هیچ تصمیمی ثبت نمی‌شود — مثلِ photos.js. */
function hchangeDemoBlocked() {
  if (!HCHANGE_DEMO) return false;
  toast('', 'این یک نمایشِ نمونه است — برای تأیید یا رد باید به سرور وصل باشی');
  return true;
}

async function approveHoursChange(id) {
  if (hchangeDemoBlocked()) return;
  const res = await API.hoursDecide(id, { action: 'approve' });
  if (!res.ok) { toast('✕', (res.error && res.error.message) || 'تأیید ناموفق بود'); return; }
  toast('✓', 'ساعتِ کاری تأیید و زنده شد');
  loadHoursChanges();
}

async function rejectHoursChange(id) {
  if (hchangeDemoBlocked()) return;
  // دلیل الزامی است (بک‌اند هم همین را اجرا می‌کند) — رستوران‌دار باید بداند
  // چه چیزی را اصلاح کند، نه اینکه فقط ببیند رد شده.
  const reason = window.prompt('دلیلِ رد (الزامی — برای رستوران نمایش داده می‌شود):', '');
  if (reason === null) return;
  if (!reason.trim()) { toast('', 'دلیلِ رد الزامی است'); return; }
  const res = await API.hoursDecide(id, { action: 'reject', reason: reason.trim() });
  if (!res.ok) { toast('✕', (res.error && res.error.message) || 'رد کردن ناموفق بود'); return; }
  toast('✓', 'پیشنهاد رد شد');
  loadHoursChanges();
}
