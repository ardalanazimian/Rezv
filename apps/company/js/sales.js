// ═══════════════════════════════════════════════════════════════════════
//  رزرونو — پنل company: صفِ درخواست‌های وب‌سایت (فروش و فعال‌سازی)
//
//  اینجا همان صفی است که «اپِ شرکت» برای فعال‌سازیِ اشتراک مسئولش است:
//  درخواستِ خریدی که از وب‌سایتِ عمومی ثبت شده، با یک کلیک به اشتراکِ واقعیِ
//  کسب‌وکار تبدیل می‌شود (tenant.plan + planExpiresAt) و روی همان ردیف ثبت
//  می‌شود چه‌کسی و چه‌زمانی فعالش کرده.
//
//  منبعِ داده: GET /api/v1/admin/site/orders و /admin/site/overview
//  عملیات:    PATCH /api/v1/admin/site/orders/{id}  { action: ... }
//
//  بدونِ بک‌اند حالتِ خالیِ صادقانه نشان داده می‌شود (نه دادهٔ نمونه) — چون
//  اینجا تصمیمِ مالی گرفته می‌شود و دادهٔ ساختگی می‌تواند گمراه‌کننده باشد.
// ═══════════════════════════════════════════════════════════════════════

let SALES_ORDERS = [];
let SALES_INQUIRIES = [];
let SALES_TAB = 'orders';       // orders | inquiries
let SALES_FILTER = 'pending';   // pending | all
let SALES_LOADING = false;
let SALES_ERROR = null;
let SALES_BADGE = 0;            // شمارشِ کارِ باقی‌مانده برای نشانِ کنارِ منو

const SALES_STATUS = {
  pending: { label: 'در انتظار', cls: 'expiring' },
  contacted: { label: 'تماس گرفته شد', cls: 'trial' },
  activated: { label: 'فعال شد', cls: 'active' },
  rejected: { label: 'رد شد', cls: 'expired' },
  cancelled: { label: 'لغو شد', cls: 'expired' },
};
const INQUIRY_STATUS = {
  open: { label: 'باز', cls: 'expiring' },
  in_progress: { label: 'در حالِ پیگیری', cls: 'trial' },
  closed: { label: 'بسته', cls: 'active' },
};
const TOPIC_LABEL = {
  sales: 'خرید و قیمت', support: 'پشتیبانی', partnership: 'همکاری', press: 'رسانه', other: 'سایر',
};

/** تومان با ارقامِ فارسی و جداکننده‌ی هزارگان. */
function salesToman(n) {
  if (n === null || n === undefined) return '—';
  return fa(Number(n).toLocaleString('en-US')) + ' تومان';
}

/** تاریخِ کوتاهِ خوانا از ISO. */
function salesDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Tehran',
    }).format(d);
  } catch { return fa(d.toISOString().slice(0, 10)); }
}

// ════════ بارگذاری ════════

async function loadSales() {
  SALES_LOADING = true;
  SALES_ERROR = null;
  rSales();

  const qs = SALES_FILTER === 'pending' ? '?status=pending' : '';
  const [orders, inquiries] = await Promise.all([
    API.get('/admin/site/orders' + qs),
    API.get('/admin/site/inquiries'),
  ]);

  SALES_LOADING = false;
  if (!orders.ok) {
    SALES_ERROR = orders.offline
      ? 'اتصال به سرور برقرار نیست — این بخش دادهٔ نمونه ندارد چون تصمیمِ مالی روی آن گرفته می‌شود.'
      : (orders.error && orders.error.message) || 'دریافتِ درخواست‌ها ناموفق بود.';
    SALES_ORDERS = [];
  } else {
    SALES_ORDERS = orders.data.items || [];
  }
  SALES_INQUIRIES = inquiries.ok ? (inquiries.data.items || []) : [];
  rSales();
  refreshSalesBadge();
}

/** شمارشِ کارِ باقی‌مانده روی نشانِ منو (بدونِ رندرِ کلِ صفحه). */
async function refreshSalesBadge() {
  const res = await API.get('/admin/site/overview');
  if (!res.ok) return;
  SALES_BADGE = (res.data.funnel && res.data.funnel.action_required) || 0;
  const el = document.getElementById('salesBadge');
  if (!el) return;
  el.textContent = SALES_BADGE ? fa(SALES_BADGE) : '';
  el.style.display = SALES_BADGE ? 'inline-flex' : 'none';
}

// ════════ رندر ════════

function rSales() {
  const el = document.getElementById('v-sales');
  if (!el) return;

  const pendingCount = SALES_ORDERS.filter((o) => o.status === 'pending' && o.kind === 'purchase').length;
  const openInquiries = SALES_INQUIRIES.filter((q) => q.status === 'open').length;

  el.innerHTML = `
    <div class="bill-summary">
      <div class="bill-stat"><div class="bs-val" style="color:var(--amber-600)">${fa(pendingCount)}</div><div class="bs-label">درخواستِ خریدِ در انتظارِ فعال‌سازی</div></div>
      <div class="bill-stat"><div class="bs-val" style="color:var(--ink)">${fa(SALES_ORDERS.filter(o=>o.kind==='trial').length)}</div><div class="bs-label">حسابِ دمو در این فهرست</div></div>
      <div class="bill-stat"><div class="bs-val" style="color:var(--green-600)">${fa(openInquiries)}</div><div class="bs-label">پیامِ بازنشده‌ی سایت</div></div>
    </div>

    <div class="panel">
      <div class="panel-head" style="flex-wrap:wrap;gap:10px">
        <div>
          <div class="panel-title">درخواست‌های وب‌سایت</div>
          <div class="panel-sub">فعال‌سازیِ اشتراک از همین‌جا انجام می‌شود و در گزارشِ حسابرسی ثبت می‌گردد</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm ${SALES_TAB==='orders'?'btn-primary':'btn-ghost'}" onclick="salesTab('orders')">سفارش‌ها</button>
          <button class="btn btn-sm ${SALES_TAB==='inquiries'?'btn-primary':'btn-ghost'}" onclick="salesTab('inquiries')">پیام‌ها${openInquiries?` (${fa(openInquiries)})`:''}</button>
          ${SALES_TAB==='orders' ? `
            <button class="btn btn-sm ${SALES_FILTER==='pending'?'btn-primary':'btn-ghost'}" onclick="salesFilter('pending')">در انتظار</button>
            <button class="btn btn-sm ${SALES_FILTER==='all'?'btn-primary':'btn-ghost'}" onclick="salesFilter('all')">همه</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="loadSales()">${SALES_LOADING?'در حال بارگذاری…':'تازه‌سازی'}</button>
        </div>
      </div>

      ${SALES_ERROR ? `<div style="padding:22px;text-align:center;color:var(--red-600);font-size:13px">${esc(SALES_ERROR)}</div>` : ''}
      ${SALES_LOADING ? `<div style="padding:22px;text-align:center;color:var(--muted);font-size:13px">در حال دریافت…</div>` : ''}
      ${!SALES_LOADING && !SALES_ERROR ? (SALES_TAB === 'orders' ? renderSalesOrders() : renderSalesInquiries()) : ''}
    </div>`;
}

function renderSalesOrders() {
  if (!SALES_ORDERS.length) {
    return `<div style="padding:28px;text-align:center;color:var(--muted);font-size:13px">
      ${SALES_FILTER === 'pending' ? 'هیچ درخواستی در انتظارِ اقدام نیست. ✓' : 'هنوز درخواستی از وب‌سایت ثبت نشده است.'}
    </div>`;
  }

  return `<div class="mini-list">${SALES_ORDERS.map((o) => {
    const st = SALES_STATUS[o.status] || { label: o.status, cls: 'trial' };
    const isPurchase = o.kind === 'purchase';
    const canAct = isPurchase && o.status !== 'activated' && o.status !== 'rejected';
    const tenantHint = o.tenant_id
      ? 'کسب‌وکار متصل است'
      : (o.suggested_tenant ? `پیشنهاد: ${esc(o.suggested_tenant.tenantName)}` : 'بدونِ کسب‌وکارِ متصل');

    return `<div class="mini-row" style="flex-wrap:wrap;gap:10px">
      <div class="mini-info" style="min-width:200px;flex:1">
        <div class="mini-name">${esc(o.business_name)} <span class="plan-badge ${isPurchase?'pro':'trial'}">${isPurchase?'خرید':'دمو'}</span></div>
        <div class="mini-sub" style="direction:ltr;text-align:right">${esc(o.code)} · ${esc(o.contact_name)} · ${esc(o.phone)}</div>
        <div class="mini-sub">${o.plan_name?esc(o.plan_name)+' · ':''}${salesDate(o.created_at)} · ${esc(tenantHint)}</div>
      </div>
      <div style="min-width:120px;font-size:13px;font-weight:700">${salesToman(o.amount_toman)}</div>
      <span class="badge ${st.cls}" style="align-self:flex-start"><span class="bdot"></span>${st.label}</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="openSalesOrder('${esc(o.id)}')">جزئیات</button>
        ${canAct ? `<button class="btn btn-primary btn-sm" onclick="activateSalesOrder('${esc(o.id)}')">فعال‌سازی</button>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderSalesInquiries() {
  if (!SALES_INQUIRIES.length) {
    return `<div style="padding:28px;text-align:center;color:var(--muted);font-size:13px">صندوقِ ورودی خالی است.</div>`;
  }
  return `<div class="mini-list">${SALES_INQUIRIES.map((q) => {
    const st = INQUIRY_STATUS[q.status] || { label: q.status, cls: 'trial' };
    return `<div class="mini-row" style="flex-wrap:wrap;gap:10px;align-items:flex-start">
      <div class="mini-info" style="min-width:220px;flex:1">
        <div class="mini-name">${esc(q.name)}${q.company?' — '+esc(q.company):''}</div>
        <div class="mini-sub" style="direction:ltr;text-align:right">${esc(q.code)} · ${esc(q.phone)}${q.email?' · '+esc(q.email):''}</div>
        <div class="mini-sub">${esc(TOPIC_LABEL[q.topic]||q.topic)} · ${salesDate(q.created_at)}</div>
        <div style="margin-top:6px;font-size:12.5px;line-height:1.8;white-space:pre-wrap">${esc(q.message)}</div>
      </div>
      <span class="badge ${st.cls}" style="align-self:flex-start"><span class="bdot"></span>${st.label}</span>
      <div style="display:flex;gap:6px">
        ${q.status === 'open' ? `<button class="btn btn-ghost btn-sm" onclick="setInquiryStatus('${esc(q.id)}','in_progress')">در حالِ پیگیری</button>` : ''}
        ${q.status !== 'closed' ? `<button class="btn btn-primary btn-sm" onclick="setInquiryStatus('${esc(q.id)}','closed')">بستن</button>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ════════ تعامل ════════

function salesTab(tab) { SALES_TAB = tab; rSales(); }
function salesFilter(f) { SALES_FILTER = f; loadSales(); }

function openSalesOrder(id) {
  const o = SALES_ORDERS.find((x) => String(x.id) === String(id));
  if (!o) return;
  const st = SALES_STATUS[o.status] || { label: o.status };

  openModal(`
    <div class="modal-title">${esc(o.business_name)}</div>
    <div class="modal-sub" style="direction:ltr;text-align:right">${esc(o.code)} · ${st.label}</div>

    <div class="field-label">تماس</div>
    <div style="font-size:13px;line-height:2">
      ${esc(o.contact_name)}<br>
      <span style="direction:ltr;display:inline-block">${esc(o.phone)}</span>${o.email?`<br><span style="direction:ltr;display:inline-block">${esc(o.email)}</span>`:''}
      ${o.city?`<br>${esc(o.city)}`:''}${o.branch_count?` · ${fa(o.branch_count)} شعبه`:''}
    </div>

    <div class="field-label">اشتراک</div>
    <div style="font-size:13px;line-height:2">
      ${o.kind === 'purchase' ? `${esc(o.plan_name||'—')} · ${fa(o.months||0)} ماه · ${salesToman(o.amount_toman)}` : 'دموی ۳۰ روزه'}<br>
      ثبت: ${salesDate(o.created_at)}
      ${o.trial_ends_at?`<br>پایانِ دمو: ${salesDate(o.trial_ends_at)}`:''}
      ${o.plan_expires_at?`<br>اعتبار تا: ${salesDate(o.plan_expires_at)}`:''}
    </div>

    ${o.note ? `<div class="field-label">یادداشتِ متقاضی</div><div style="font-size:13px;line-height:1.9;white-space:pre-wrap">${esc(o.note)}</div>` : ''}
    ${o.rejected_reason ? `<div class="field-label">دلیلِ رد</div><div style="font-size:13px;color:var(--red-600)">${esc(o.rejected_reason)}</div>` : ''}
    ${(o.utm_source || o.landing_path) ? `<div class="field-label">منبعِ سرنخ</div><div style="font-size:12px;color:var(--muted);direction:ltr;text-align:right">${esc([o.utm_source,o.utm_campaign,o.landing_path].filter(Boolean).join(' · '))}</div>` : ''}

    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">بستن</button>
      ${o.status !== 'activated' && o.status !== 'rejected' ? `
        <button class="btn btn-ghost" onclick="rejectSalesOrder('${esc(o.id)}')">رد کردن</button>
        ${o.status === 'pending' ? `<button class="btn btn-ghost" onclick="contactSalesOrder('${esc(o.id)}')">تماس گرفتم</button>` : ''}
        ${o.kind === 'purchase' ? `<button class="btn btn-primary" onclick="activateSalesOrder('${esc(o.id)}')">فعال‌سازیِ اشتراک</button>` : ''}
      ` : ''}
    </div>`);
}

/** فراخوانِ مشترکِ عملیاتِ سفارش؛ خطا را به کاربر نشان می‌دهد و فهرست را تازه می‌کند. */
async function patchSalesOrder(id, body, successMsg) {
  const res = await API.patch(`/admin/site/orders/${id}`, body);
  if (!res.ok) {
    toast('✕', (res.error && res.error.message) || 'انجامِ عملیات ناموفق بود');
    return false;
  }
  closeModal();
  toast('✓', successMsg);
  await loadSales();
  return true;
}

async function activateSalesOrder(id) {
  const o = SALES_ORDERS.find((x) => String(x.id) === String(id));
  if (!o) return;

  // تنانتِ مقصد: از خودِ سفارش، وگرنه پیشنهادِ سرور، وگرنه از مدیر می‌پرسیم.
  let tenantId = o.tenant_id || (o.suggested_tenant && o.suggested_tenant.tenantId) || null;
  if (!tenantId) {
    tenantId = window.prompt(
      'شناسه‌ی کسب‌وکارِ مقصد (tenant id):\n' +
      'این شماره هنوز به هیچ کسب‌وکاری وصل نیست. اگر حساب ندارند، اول باید دموی رایگان بسازند.',
    );
    if (!tenantId || !tenantId.trim()) return;
    tenantId = tenantId.trim();
  }

  const who = o.suggested_tenant ? `«${o.suggested_tenant.tenantName}»` : 'این کسب‌وکار';
  if (!window.confirm(
    `اشتراکِ ${who} برای ${fa(o.months || 0)} ماه فعال شود؟\n` +
    'تاریخِ انقضای واقعی تغییر می‌کند و عمل در گزارشِ حسابرسی ثبت می‌شود.',
  )) return;

  await patchSalesOrder(id, { action: 'activate', tenant_id: tenantId }, 'اشتراک فعال شد');
}

async function rejectSalesOrder(id) {
  const reason = window.prompt('دلیلِ رد کردن (برای متقاضی هم در صفحه‌ی پیگیری دیده می‌شود):');
  if (!reason || reason.trim().length < 3) return;
  await patchSalesOrder(id, { action: 'reject', reason: reason.trim() }, 'درخواست رد شد');
}

async function contactSalesOrder(id) {
  await patchSalesOrder(id, { action: 'contact' }, 'وضعیت به «تماس گرفته شد» تغییر کرد');
}

async function setInquiryStatus(id, status) {
  const res = await API.patch(`/admin/site/inquiries/${id}`, { status });
  if (!res.ok) {
    toast('✕', (res.error && res.error.message) || 'به‌روزرسانی ناموفق بود');
    return;
  }
  toast('✓', 'وضعیتِ پیام به‌روز شد');
  await loadSales();
}
