// ═══ رزرونو — پنل business: داده و پیکربندی (Vanilla JS، بدون build، scope مشترک) ═══
// ═══════════ DATA ═══════════
// fa/esc از js/format.js (منبعِ واحدِ پنل‌ها) می‌آیند — قبل از این فایل لود می‌شود.
// ── چرخه‌ی حیات کامل رزرو: برچسب فارسی، آیکون، و رنگ هر وضعیت ──
const STATUS_META={
  pending:        {label:'در انتظار',     icon:'clock', bg:'#FEF3C7', fg:'#92400E'},
  waitlisted:     {label:'لیست انتظار',   icon:'inbox', bg:'#FEF9C3', fg:'#854D0E'},
  confirmed:      {label:'تأییدشده',      icon:'checkCircle',  bg:'#DBEAFE', fg:'#1D4ED8'},
  auto_confirmed: {label:'تأیید خودکار',  icon:'trending', bg:'#DBEAFE', fg:'#1D4ED8'},
  preparing:      {label:'آماده‌سازی میز',icon:'utensils', bg:'#E0E7FF', fg:'#4338CA'},
  checked_in:     {label:'حاضر شد',       icon:'check',  bg:'#D1FAE5', fg:'#047857'},
  arrived:        {label:'حاضر شد',       icon:'check',  bg:'#D1FAE5', fg:'#047857'}, // قدیمی
  running_late:   {label:'با تأخیر',      icon:'clock', bg:'#FFEDD5', fg:'#C2410C'},
  seated:         {label:'سر میز',        icon:'utensils', bg:'#FEF3C7', fg:'#B45309'},
  dining:         {label:'در حال صرف غذا',icon:'utensils', bg:'#FED7AA', fg:'#9A3412'},
  completed:      {label:'انجام‌شده',     icon:'check',  bg:'#DCFCE7', fg:'#15803D'},
  no_show:        {label:'نیومد',         icon:'alert', bg:'#FEF3C7', fg:'#D97706'},
  noshow:         {label:'نیومد',         icon:'alert', bg:'#FEF3C7', fg:'#D97706'}, // alias
  cancelled:      {label:'لغوشده',        icon:'close', bg:'#FEE2E2', fg:'#B91C1C'},
  auto_cancelled: {label:'لغو خودکار',    icon:'close', bg:'#FEE2E2', fg:'#B91C1C'},
  rejected:       {label:'ردشده',         icon:'close',  bg:'#FEE2E2', fg:'#991B1B'},
  expired:        {label:'منقضی',         icon:'clock', bg:'#F3F4F6', fg:'#6B7280'},
};
// ── انتقال‌های مجاز چرخه‌ی حیات (همگام با بک‌اند lifecycle.ts) ──
const STATUS_TRANSITIONS={
  pending:['confirmed','rejected','cancelled'],
  waitlisted:['confirmed','cancelled'],
  confirmed:['preparing','checked_in','running_late','no_show','cancelled'],
  auto_confirmed:['preparing','checked_in','running_late','no_show','cancelled'],
  preparing:['checked_in','running_late','no_show','cancelled'],
  checked_in:['seated','cancelled'],
  running_late:['checked_in','seated','no_show','cancelled'],
  seated:['dining','completed','cancelled'],
  dining:['completed'],
  arrived:['seated','cancelled'], // قدیمی
  completed:[],no_show:[],rejected:[],expired:[],cancelled:[],auto_cancelled:[],
};
// منوی تغییر وضعیت برای یک رزرو
function openStatusMenu(i){
  const r=RES[i]; if(!r)return;
  const allowed=STATUS_TRANSITIONS[r.status]||[];
  if(!allowed.length){toast('','این رزرو در وضعیت نهایی است');return;}
  const opts=allowed.map(s=>{const m=STATUS_META[s];return `<button class="status-opt" onclick="changeStatus(${i},'${s}')" style="--c:${m.fg};--bgc:${m.bg}"><span>${icon(m.icon,{size:13})}</span> ${m.label}</button>`;}).join('');
  openModal(`<div class="bs-head"><div class="bs-title">تغییر وضعیت</div><div class="bs-rest">${esc(r.name)} · میز ${fa(r.table)}</div></div>
    <div style="margin:8px 0 4px;font-size:13px;color:var(--t3)">وضعیت فعلی: ${STATUS_META[r.status]?.label||r.status}</div>
    <div class="status-opts">${opts}</div>
    <button class="btn btn-ghost btn-block" style="margin-top:12px" onclick="viewHistory(${i})">${icon('inbox',{size:14})} تاریخچه‌ی تغییرات</button>`);
}
async function changeStatus(i,to){
  const r=RES[i]; if(!r)return;
  closeModal();
  // به‌روزرسانی خوش‌بینانه‌ی UI
  const old=r.status; r.status=to;
  // ثبت محلی در تاریخچه (برای نمایش در حالت دمو)
  r._events=r._events||[{toStatus:old,actor:'system',createdAt:new Date(Date.now()-3600000).toISOString(),isAutomatic:false}];
  r._events.push({toStatus:to,actor:'staff',createdAt:new Date().toISOString(),isAutomatic:false});
  renderResList();
  toast('',`وضعیت به «${STATUS_META[to]?.label||to}» تغییر کرد`);
  // ارسال به بک‌اند؛ فقط اگر سرور آنلاین بود و خطای واقعی داد، برگردان
  if(r.code){
    const res=await API.request(`/restaurant/reservations/${r.code}/status`,{method:'PATCH',body:JSON.stringify({status:to})});
    if(!res.ok&&!res.offline){ r.status=old; r._events.pop(); renderResList(); toast('','تغییر وضعیت ناموفق بود'); }
  }
}
async function viewHistory(i){
  const r=RES[i]; if(!r)return;
  // در دمو، تاریخچه‌ی نمونه؛ با بک‌اند واقعی از API می‌آید
  let events=r._events;
  if(!events){
    const res=await API.request(`/restaurant/reservations/${r.code}/events`);
    events=res.ok?res.data.events:[{toStatus:r.status,actor:'system',createdAt:new Date().toISOString(),isAutomatic:false}];
  }
  const rows=(events||[]).map(e=>{
    const m=STATUS_META[e.toStatus]||{label:e.toStatus,icon:'info',fg:'#666'};
    const who=e.actor==='system'||e.actor==='cron'?'سیستم':e.actor==='customer'?'مشتری':'کارمند';
    const t=new Date(e.createdAt).toLocaleString('fa-IR',{hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'});
    return `<div class="hist-row"><span class="hist-ic" style="color:${m.fg}">${icon(m.icon,{size:14})}</span><div class="hist-body"><div class="hist-status">${m.label}${e.isAutomatic?' <span class="hist-auto">خودکار</span>':''}</div><div class="hist-meta">${who} · ${t}</div></div></div>`;
  }).join('');
  openModal(`<div class="bs-head"><div class="bs-title">تاریخچه‌ی رزرو</div><div class="bs-rest">${esc(r.name)} · کد ${r.code||'—'}</div></div><div class="hist-list">${rows||'<div style="color:var(--t3);text-align:center;padding:20px">رویدادی ثبت نشده</div>'}</div>`);
}
// ═══════════════════════════════════════════════════════════
//  لایه‌ی اتصال API (فاز ۳) — پنل رستوران
//  با توکن staff کار می‌کند. مثل اپ مشتری: تلاش API، fallback به نمونه.
// ═══════════════════════════════════════════════════════════
const API = {
  base: resolveApiBase(),            // '' = same-origin؛ قابلِ override با window.RZ_API_BASE یا <meta rz-api-base> (از api-core.js)
  timeout: 8000,
  _token: null,                      // توکن staff (بعد از ورود مدیر/کارمند)
  _refresh: null,                    // توکن تمدید staff
  _refreshing: null,
  online: true,
  // نگه‌داری توکن staff: حافظه + localStorage (تا رفرش صفحه، کارمند را بیرون نیندازد)
  setToken(t){ this._token = t; try { if(t) localStorage.setItem('rz_biz_access', t); else localStorage.removeItem('rz_biz_access'); } catch {} },
  getToken(){ return this._token; },
  setRefresh(t){ this._refresh = t; try { if(t) localStorage.setItem('rz_biz_refresh', t); else localStorage.removeItem('rz_biz_refresh'); } catch {} },
  restoreSession(){
    try {
      this._token = localStorage.getItem('rz_biz_access')||null;
      this._refresh = localStorage.getItem('rz_biz_refresh')||null;
      this._restaurantId = localStorage.getItem('rz_biz_restaurant_id')||null;
    } catch {}
    return !!this._token;
  },
  // ── شعبه‌ی فعال (چندشعبه‌ای): هدر X-Restaurant-Id، بدون نیاز به ورود دوباره ──
  _restaurantId: null,
  setActiveRestaurant(id){ this._restaurantId = id||null; try { if(id) localStorage.setItem('rz_biz_restaurant_id', id); else localStorage.removeItem('rz_biz_restaurant_id'); } catch {} },
  getActiveRestaurant(){ return this._restaurantId; },
  async request(path, opts = {}, _retried = false){
    // transportِ خام به httpJsonِ مشترک (window.httpJson از api-core.js) واگذار می‌شود؛
    // منطقِ auth (Authorization، X-Restaurant-Id، ۴۰۱→refresh→retry) اینجا و بدونِ تغییر می‌ماند.
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (this._token) headers['Authorization'] = `Bearer ${this._token}`;
    if (this._restaurantId) headers['X-Restaurant-Id'] = this._restaurantId;
    const r = await httpJson(this.base + '/api/v1' + path, { ...opts, headers }, this.timeout);
    if (!r.ok && !r.offline && r.status === 401 && this._refresh && !_retried && !path.startsWith('/auth/')) {
      if (await this._doRefresh()) return this.request(path, opts, true);
      this._onSessionExpired();
    }
    if (r.ok) return { ok: true, status: r.status, data: r.data };
    if (r.offline) return { ok: false, offline: true, error: r.error };
    return { ok: false, status: r.status, error: r.error || { message: `خطای ${r.status}` } };
  },
  async _doRefresh(){
    if (this._refreshing) return this._refreshing;
    this._refreshing = (async () => {
      try {
        const res = await fetch(this.base + '/api/v1/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: this._refresh }) });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.access) { this.setToken(data.access); this.setRefresh(data.refresh); return true; }
        return false;
      } catch { return false; } finally { this._refreshing = null; }
    })();
    return this._refreshing;
  },
  _onSessionExpired(){ this.setToken(null); this.setRefresh(null); if (typeof onStaffSessionExpired === 'function') onStaffSessionExpired(); },
  /**
   * POSTِ بدنه‌ی خام (FormData) — بدونِ Content-Type تا مرورگر خودش
   * boundaryِ multipart را بگذارد. بقیه‌ی منطقِ auth (توکن، شعبه‌ی فعال،
   * ۴۰۱ → refresh → تلاشِ دوباره) دقیقاً همان request است.
   */
  async requestRaw(path, body, timeoutMs = 60000, _retried = false){
    const headers = {};
    if (this._token) headers['Authorization'] = `Bearer ${this._token}`;
    if (this._restaurantId) headers['X-Restaurant-Id'] = this._restaurantId;
    const r = await httpJson(this.base + '/api/v1' + path, { method: 'POST', body, headers }, timeoutMs);
    if (!r.ok && !r.offline && r.status === 401 && this._refresh && !_retried) {
      if (await this._doRefresh()) return this.requestRaw(path, body, timeoutMs, true);
      this._onSessionExpired();
    }
    if (r.ok) return { ok: true, status: r.status, data: r.data };
    if (r.offline) return { ok: false, offline: true, error: r.error };
    return { ok: false, status: r.status, error: r.error || { message: `خطای ${r.status}` } };
  },
  get(path){ return this.request(path); },
  post(path, body){ return this.request(path, { method: 'POST', body: JSON.stringify(body || {}) }); },
  patch(path, body){ return this.request(path, { method: 'PATCH', body: JSON.stringify(body || {}) }); },
  chatList(){ return this.get('/restaurant/chats'); },
  chatMessages(id, after){ return this.get('/restaurant/chats/'+id+(after?('?after='+encodeURIComponent(after)):'')); },
  chatSend(id, body){ return this.post('/restaurant/chats/'+id, { body }); },
  delete(path){ return this.request(path, { method: 'DELETE' }); },
  // ── احراز هویت کارمند ──
  async requestStaffOtp(phone){ return this.post('/auth/staff/request', { phone }); },
  async verifyStaffOtp(phone, code){
    const res = await this.post('/auth/staff/verify', { phone, code });
    if (res.ok && res.data?.access) {
      this.setToken(res.data.access); this.setRefresh(res.data.refresh);
      // مجوزهای مؤثر از سرور — پنل بر اساس همین‌ها منو را محدود می‌کند.
      this.setPermissions(res.data.staff?.permissions || null);
    }
    return res;
  },
  // ── مجوزها ──
  // منبعِ حقیقت سرور است؛ این فقط برای پنهان‌کردنِ چیزی است که کاربر اجازه‌اش را ندارد،
  // نه یک سازوکارِ امنیتی. بک‌اند مستقلاً روی هر روت اعمال می‌کند.
  _perms: null,
  setPermissions(p){
    this._perms = p;
    try { p ? localStorage.setItem('rz_perms', JSON.stringify(p)) : localStorage.removeItem('rz_perms'); } catch {}
  },
  getPermissions(){
    if (this._perms) return this._perms;
    try { const raw = localStorage.getItem('rz_perms'); if (raw) this._perms = JSON.parse(raw); } catch {}
    return this._perms;
  },
  can(key){
    const p = this.getPermissions();
    // بدونِ اطلاعِ مجوز (آفلاین/دمو) چیزی را پنهان نمی‌کنیم؛ سرور تصمیم‌گیرِ نهایی است.
    if (!p) return true;
    return p[key] !== false;
  },
  async doLogout(){
    if (this._refresh) { await fetch(this.base + '/api/v1/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: this._refresh }) }).catch(() => {}); }
    this.setToken(null); this.setRefresh(null); this.setPermissions(null);
  },
  // ارسال پیامک کمپین یا winback
  async sendSms(payload){ return this.post('/restaurant/sms', payload); },
  // ── مدیریت میز (وصل به /restaurant/tables واقعی) ──
  listTables(){ return this.get('/restaurant/tables'); },
  createTable(body){ return this.post('/restaurant/tables', body); },
  updateTable(id, body){ return this.patch(`/restaurant/tables/${id}`, body); },
  deleteTable(id){ return this.delete(`/restaurant/tables/${id}`); },
  setTableState(id, state){ return this.patch(`/restaurant/tables/${id}/state`, { state }); },
  // ── هوش مشتری (RFM/CLV/AI) ──
  customers(qs){ return this.get('/restaurant/customers'+(qs?'?'+qs:'')); },
  customerDetail(userId){ return this.get('/restaurant/customers/'+encodeURIComponent(userId)); },
  rfm(){ return this.get('/restaurant/rfm'); },
  aiRecommendations(){ return this.get('/restaurant/ai'); },
  // ── ورود بدون رزرو (walk-in واقعی، با عضویت خودکار باشگاه) ──
  walkin(body){ return this.post('/restaurant/walkin', body); },
  // ── نظرات، گالری، یادداشت پرسنل، رویداد، تاریخچه‌ی کمپین (همه واقعی) ──
  reviews(qs){ return this.get('/restaurant/reviews'+(qs?'?'+qs:'')); },
  replyReview(id, reply){ return this.patch('/restaurant/reviews', { id, reply }); },
  photos(){ return this.get('/restaurant/photos'); },
  // آپلودِ فایل، نه لینک. عمداً از post استفاده نمی‌کند: request همیشه
  // Content-Type: application/json می‌گذارد و برای multipart باید مرورگر
  // خودش هدر را با boundary بسازد، وگرنه سرور بدنه را نمی‌تواند پارس کند.
  uploadPhoto(file, { category, caption } = {}){
    const fd = new FormData();
    fd.append('file', file);
    if (category) fd.append('category', category);
    if (caption)  fd.append('caption', caption);
    // مهلتِ بلندتر از پیش‌فرضِ ۸ ثانیه: یک عکسِ چندمگابایتی روی اینترنتِ
    // موبایل به‌راحتی بیشتر طول می‌کشد و قطع‌شدنش شبیهِ خطای سرور دیده می‌شد.
    return this.requestRaw('/restaurant/photos', fd, 60000);
  },
  deletePhoto(id){ return this.delete('/restaurant/photos?id='+encodeURIComponent(id)); },
  notes(){ return this.get('/restaurant/notes'); },
  addNote(body){ return this.post('/restaurant/notes', body); },
  pinNote(id, pinned){ return this.patch('/restaurant/notes', { id, pinned }); },
  deleteNote(id){ return this.delete('/restaurant/notes?id='+encodeURIComponent(id)); },
  events(){ return this.get('/restaurant/events'); },
  addEvent(body){ return this.post('/restaurant/events', body); },
  updateEvent(body){ return this.patch('/restaurant/events', body); },
  deleteEvent(id){ return this.delete('/restaurant/events?id='+encodeURIComponent(id)); },
  campaignHistory(){ return this.get('/restaurant/campaigns'); },
  // ── لیست انتظار (وصل به /restaurant/waitlist واقعی) ──
  waitlistQueue(){ return this.get('/restaurant/waitlist'); },
  waitlistAnalytics(days){ return this.get('/restaurant/waitlist/analytics'+(days?'?days='+days:'')); },
  waitlistPromoteNext(){ return this.post('/restaurant/waitlist'); },
  // ── کارکنان و دسترسی (وصل به /restaurant/staff واقعی) ──
  staffList(){ return this.get('/restaurant/staff'); },
  staffUpdate(body){ return this.patch('/restaurant/staff', body); },
  // ── کوپن‌ها (وصل به /restaurant/coupons واقعی) ──
  couponsList(){ return this.get('/restaurant/coupons'); },
  couponCreate(body){ return this.post('/restaurant/coupons', body); },
  // ── اتوماسیونِ مارکتینگ (وصل به /restaurant/automations واقعی) ──
  automationsList(){ return this.get('/restaurant/automations'); },
  automationCreate(body){ return this.post('/restaurant/automations', body); },
  // ── ساعات کاری + تعطیلات (وصل به /restaurant/hours واقعی) ──
  hoursGet(){ return this.get('/restaurant/hours'); },
  hoursSave(body){ return this.request('/restaurant/hours', { method:'PUT', body: JSON.stringify(body||{}) }); },
  // ── سیاستِ کنسلی (وصل به /restaurant/cancellation-policy واقعی) ──
  cancellationPolicyGet(){ return this.get('/restaurant/cancellation-policy'); },
  cancellationPolicySave(body){ return this.request('/restaurant/cancellation-policy', { method:'PUT', body: JSON.stringify(body||{}) }); },
  // ── چندشعبه‌ای: لیست شعبه‌ها + ساخت شعبه‌ی جدید ──
  branchesList(){ return this.get('/restaurant/branches'); },
  branchCreate(body){ return this.post('/restaurant/branches', body); },
  // ── هویتِ رستوران: نام (وصل به GET/PUT /restaurant/profile واقعی) ──
  profileSave(body){ return this.request('/restaurant/profile', { method:'PUT', body: JSON.stringify(body||{}) }); },
  // ── فعالیتِ اخیر برایِ زنگوله‌یِ اعلان (وصل به /restaurant/notifications واقعی) ──
  recentActivity(){ return this.get('/restaurant/notifications'); },
  // ── مدیرِ هوشمندِ رستوران: پرسش‌وپاسخِ مستندِ Finding/Evidence/Confidence ──
  managerInsights(){ return this.get('/restaurant/manager-insights'); },
  // ── آمار رفتار مشتری + نقشه‌ی حرارتیِ شلوغی (روز×ساعت، همان دیتایِ تبِ آنالیتیکس) ──
  analytics(){ return this.get('/restaurant/analytics'); },
};

// ═══════════════════════════════════════════════════════════
//  آفلاین کامل — صف عملیات (Outbox) + همگام‌سازی خودکار
//  فلسفه: وقتی اینترنت نیست، هر عملیات محلی اجرا می‌شود (پرسنل بلافاصله
//  نتیجه را می‌بیند) و در صفی پایدار (localStorage) ذخیره می‌شود. با برگشت
//  اینترنت، صف به‌ترتیب به سرور فرستاده می‌شود. سرور — که با constraint ضد
//  رزرو دوبل محکم شده — منبع حقیقت نهایی است؛ اگر عملیاتی را رد کرد، به‌جای
//  گم‌شدن بی‌صدای داده، به پرسنل هشدار داده می‌شود تا خودش تصمیم بگیرد.
// ═══════════════════════════════════════════════════════════
const Outbox = {
  KEY: 'rz_biz_outbox',
  _queue: null,
  _syncing: false,

  // بارگذاری صف از حافظه‌ی پایدار
  load(){
    if(this._queue) return this._queue;
    try { this._queue = JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
    catch { this._queue = []; }
    return this._queue;
  },
  _persist(){
    try { localStorage.setItem(this.KEY, JSON.stringify(this._queue || [])); } catch {}
    this._updateBadge();
  },
  count(){ return this.load().length; },

  // افزودن عملیات به صف. op = { type, path, method, body, label, localRef }
  enqueue(op){
    this.load();
    op.id = 'op_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    op.queuedAt = Date.now();
    op.attempts = 0;
    this._queue.push(op);
    this._persist();
    return op.id;
  },

  // تلاش برای همگام‌سازی کل صف — به‌ترتیب، متوقف روی اولین خطای شبکه
  async sync(){
    if(this._syncing) return;
    if(!API.getToken()){ return; }          // بدون احراز هویت، sync معنی ندارد
    this.load();
    if(this._queue.length === 0) return;
    this._syncing = true;
    this._updateBadge('در حال همگام‌سازی...');
    const conflicts = [];
    let synced = 0;

    while(this._queue.length > 0){
      const op = this._queue[0];
      op.attempts = (op.attempts||0) + 1;
      let res;
      try {
        res = await API.request(op.path, { method: op.method || 'POST', body: op.body ? JSON.stringify(op.body) : undefined });
      } catch { res = { ok:false, offline:true }; }

      if(res.offline){
        // هنوز آفلاین — توقف، بعداً دوباره تلاش می‌کنیم (داده حفظ می‌شود)
        break;
      }
      if(res.ok){
        this._queue.shift(); synced++; this._persist();
        continue;
      }
      // سرور عملیات را رد کرد → تضاد. از صف خارج کن ولی برای هشدار نگه‌دار.
      conflicts.push({ op, error: res.error?.message || 'رد شد توسط سرور' });
      this._queue.shift(); this._persist();
    }

    this._syncing = false;
    this._updateBadge();
    // گزارش نتیجه به پرسنل
    if(synced > 0 && this._queue.length === 0 && conflicts.length === 0){
      toast('', `${fa(synced)} عملیات آفلاین با موفقیت همگام شد`);
    } else if(synced > 0){
      toast('', `${fa(synced)} عملیات همگام شد`);
    }
    if(conflicts.length > 0){ this._reportConflicts(conflicts); }
    // اگر view فعال است، تازه‌سازی کن تا وضعیت درست دیده شود
    if(synced>0 || conflicts.length>0) refreshActiveView();
  },

  // هشدار تضادها به پرسنل — تصمیم با انسان، نه گم‌شدن بی‌صدا
  _reportConflicts(conflicts){
    const list = conflicts.map(c => `<div style="padding:10px 12px;background:var(--amber-50);border-radius:10px;margin-bottom:8px;font-size:13px">
      <b>${esc(c.op.label||'عملیات')}</b><div style="color:var(--t2);margin-top:2px">${esc(c.error)}</div></div>`).join('');
    if(typeof openModal==='function'){
      openModal(`<div class="modal-title">${icon('alert',{size:18})} ${fa(conflicts.length)} عملیات نیاز به بررسی دارد</div>
        <div class="modal-sub">این عملیات‌ها هنگام آفلاین ثبت شدند ولی سرور نپذیرفت (احتمالاً میز یا زمان قبلاً پر شده). لطفاً دستی بررسی کن:</div>
        <div style="margin-top:14px">${list}</div>
        <button class="btn btn-primary btn-block" style="margin-top:8px" onclick="closeModal()">متوجه شدم</button>`);
    } else {
      toast('', `${fa(conflicts.length)} عملیات آفلاین رد شد — بررسی کن`);
    }
  },

  _updateBadge(customText){
    const el = document.getElementById('offlineBadge');
    if(!el) return;
    const n = this.count();
    if(customText){ el.textContent = customText; el.style.display='inline-flex'; return; }
    if(n > 0){ el.innerHTML = `${icon('clock',{size:13})} ${fa(n)} عملیات در انتظار همگام‌سازی`; el.style.display='inline-flex'; }
    else { el.style.display='none'; }
  },
};

// ── نشانگر وضعیت آنلاین/آفلاین ──
const Net = {
  online: navigator.onLine !== false,
  init(){
    window.addEventListener('online', ()=>this._set(true));
    window.addEventListener('offline', ()=>this._set(false));
    this._render();
    // با شروع، اگر آنلاینیم و صف داریم، sync کن
    if(this.online) setTimeout(()=>Outbox.sync(), 1500);
  },
  _set(on){
    this.online = on;
    this._render();
    if(on){
      toast('','اینترنت برگشت — در حال همگام‌سازی...');
      Outbox.sync();
    } else {
      toast('','اینترنت قطع شد — اپ در حالت آفلاین کار می‌کند');
    }
  },
  _render(){
    let bar = document.getElementById('netBar');
    if(!bar){
      bar = document.createElement('div');
      bar.id = 'netBar';
      document.body.appendChild(bar);
    }
    if(this.online){ bar.className=''; bar.style.display='none'; }
    else {
      bar.className='net-offline';
      bar.innerHTML='<span class="net-dot"></span>حالت آفلاین — کارها محلی ذخیره می‌شوند و با برگشت اینترنت همگام می‌شوند';
      bar.style.display='flex';
    }
  },
};
// نشانه: آیا الان باید آفلاین رفتار کنیم؟
function isOffline(){ return !Net.online; }
// تازه‌سازی view فعال (بعد از sync)
function refreshActiveView(){
  const active = document.querySelector('.view.active');
  if(!active) return;
  const v = active.id.replace('v-','');
  ({overview:rOverview,reservations:rReservations,waitlist:rWaitlist,floor:rFloor,profile:rProfile,customers:rCustomers,loyalty:rLoyalty,marketing:rMarketing,analytics:rAnalytics,cashback:rCashback,staff:rStaff,pricing:rPricing})[v]?.();
}
// ── Heartbeat: به سرور می‌گوید این رستوران آنلاین است ──
// تا وقتی پنل به اینترنت وصل است، هر ۳۰ ثانیه یک سیگنال می‌فرستد. اگر اینترنت
// قطع شود، سیگنال نمی‌رسد و سرور بعد از ~۹۰ ثانیه رستوران را از اپ مشتری پنهان
// می‌کند (تا رزرو آنلاینِ متضاد ثبت نشود). رزرو حضوری/تلفنی در پنل ادامه دارد.
const Heartbeat = {
  _timer: null,
  start(){
    if(this._timer) return;
    const beat = async ()=>{
      if(!API.getToken() || isOffline()) return;   // بدون توکن یا آفلاین، ارسال بی‌فایده
      await API.post('/restaurant/heartbeat', {}).catch(()=>{});
    };
    beat();                                  // فوری یک‌بار
    this._timer = setInterval(beat, 30_000); // بعد هر ۳۰ ثانیه
  },
  stop(){ if(this._timer){ clearInterval(this._timer); this._timer=null; } },
};
// نشانگر منبع داده برای شفافیت (آیا داده واقعی است یا نمونه)
function dataSourceNote(){
  return API.online ? '' : `<div style="font-size:11px;color:var(--amber-600);background:var(--amber-50);padding:6px 12px;border-radius:8px;margin-bottom:14px;text-align:center">${icon('info',{size:13})} داده‌ی نمونه (بک‌اند متصل نیست)</div>`;
}
// ⚠️ رفعِ باگ: این آرایه قبلاً «const RES» بود — یعنی هیچ‌وقت با دیتای واقعی
// جایگزین نمی‌شد. renderResList (تبِ رزروها) از یک متغیرِ محلیِ جدا برای
// دیتای واقعی استفاده می‌کرد، ولی داشبورد (calcTodayKPIs در overview.js:
// رزروِ امروز، اشغالِ میز، عدمِ‌حضور، درآمد، «رزروهایِ امشب») همیشه از همین
// RES ثابت می‌خواند — یعنی داشبورد برایِ هر رستورانِ واقعی، در هر جلسه‌ای،
// همیشه همین دیتایِ نمونه را نشان می‌داد، نه فقط در بارگذاریِ اول بلکه حتیٰ
// بعد از رفرشِ «زنده»یِ هر ۱۵ ثانیه (که خودش هم فقط دوباره از همین RESِ
// ثابت محاسبه می‌کرد، بدونِ هیچ fetchی — رجوع کنید به refreshLiveKPIs).
// حالا RES_DEMO فقط fallbackِ آفلاین/دموست (هم‌الگو با WL_DEMO_QUEUE در
// waitlist.js) و RES با loadTodayReservationsForDashboard از سرور پر می‌شود.
const RES_DEMO = [
  {t:'۱۸:۳۰',name:'نیلوفر رضایی',party:2,table:3,status:'arrived',seg:'vip',pre:true,note:'تولد همسر',phone:'۰۹۱۲۱۱۱۲۲۳۳',date:'today',dLabel:'امروز'},
  {t:'۱۹:۰۰',name:'امیر حسینی',party:4,table:7,status:'confirmed',seg:'new',pre:false,note:'',phone:'۰۹۱۲۲۲۲۳۳۴۴',date:'today',dLabel:'امروز'},
  {t:'۱۹:۰۰',name:'مریم و علی',party:2,table:2,status:'arrived',seg:'regular',pre:true,note:'',phone:'۰۹۱۲۳۳۳۴۴۵۵',date:'today',dLabel:'امروز'},
  {t:'۱۹:۳۰',name:'سامان عباسی',party:3,table:5,status:'confirmed',seg:'regular',pre:false,note:'',phone:'۰۹۱۲۴۴۴۵۵۶۶',date:'today',dLabel:'امروز'},
  {t:'۲۰:۰۰',name:'کیان موسوی',party:6,table:9,status:'confirmed',seg:'vip',pre:true,note:'مشتری VIP — اتاق خصوصی',phone:'۰۹۱۲۵۵۵۶۶۷۷',date:'today',dLabel:'امروز'},
  {t:'۲۰:۰۰',name:'شیدا کریمی',party:2,table:1,status:'confirmed',seg:'regular',pre:false,note:'',phone:'۰۹۱۲۶۶۶۷۷۸۸',date:'today',dLabel:'امروز'},
  {t:'۲۰:۳۰',name:'رضا ملکی',party:5,table:8,status:'confirmed',seg:'new',pre:true,note:'',phone:'۰۹۱۲۷۷۷۸۸۹۹',date:'today',dLabel:'امروز'},
  {t:'۱۳:۰۰',name:'پریسا احمدی',party:4,table:6,status:'confirmed',seg:'regular',pre:false,note:'ناهار کاری',phone:'۰۹۱۲۸۸۸۹۹۰۰',date:'tomorrow',dLabel:'فردا'},
  {t:'۲۰:۰۰',name:'بابک رستمی',party:2,table:4,status:'confirmed',seg:'vip',pre:true,note:'سالگرد ازدواج',phone:'۰۹۱۲۹۹۹۰۰۱۱',date:'tomorrow',dLabel:'فردا'},
  // رزروهای گذشته (گزارش)
  {t:'۲۱:۰۰',name:'حسام رفیعی',party:2,table:3,status:'completed',seg:'regular',pre:false,note:'',phone:'۰۹۱۲۳۲۱۴۵۶۷',date:'past',dLabel:'دیروز'},
  {t:'۱۹:۳۰',name:'لیلا کاظمی',party:4,table:7,status:'completed',seg:'vip',pre:true,note:'مهمانی کاری',phone:'۰۹۱۲۴۵۶۷۸۹۰',date:'past',dLabel:'دیروز'},
  {t:'۲۰:۰۰',name:'نوید اسدی',party:3,table:5,status:'noshow',seg:'new',pre:false,note:'',phone:'۰۹۱۲۵۶۷۸۹۰۱',date:'past',dLabel:'دیروز'},
  {t:'۱۳:۳۰',name:'مونا صادقی',party:2,table:2,status:'completed',seg:'regular',pre:false,note:'',phone:'۰۹۱۲۶۷۸۹۰۱۲',date:'past',dLabel:'۲ روز پیش'},
  {t:'۲۰:۳۰',name:'کاوه مرادی',party:6,table:9,status:'cancelled',seg:'vip',pre:false,note:'',phone:'۰۹۱۲۷۸۹۰۱۲۳',cancelReason:'تماس مشتری — تغییر برنامه',date:'past',dLabel:'۲ روز پیش'},
  {t:'۱۹:۰۰',name:'سپیده یاری',party:4,table:6,status:'completed',seg:'regular',pre:true,note:'',phone:'۰۹۱۲۸۹۰۱۲۳۴',date:'past',dLabel:'۳ روز پیش'},
];
let RES = RES_DEMO.slice();
let _resLoaded = false;
/**
 * رزروهای «امروز» را برایِ داشبورد از سرور می‌گیرد و RES را جایگزین می‌کند.
 * عمداً از loadReservations (بالاتر) استفاده نمی‌کند — آن تابع RES_DATE_FILTER
 * و RES_NEXT_CURSOR را هم عوض می‌کند (paginationِ تبِ رزروها)؛ اگر داشبورد هم
 * از همان تابع استفاده می‌کرد، وقتی کاربر هم‌زمان تبِ رزروها را روی «آینده» یا
 * «گذشته» باز داشت، رفرشِ ۱۵ثانیه‌ایِ داشبورد آن فیلتر/cursor را خرابمی‌کرد.
 */
async function loadTodayReservationsForDashboard(){
  if(!API.getToken()) return false;
  const res=await API.get('/restaurant/reservations?date=today');
  if(res.ok && Array.isArray(res.data?.reservations)){
    RES=res.data.reservations.map(mapResRow);
    _resLoaded=true;
    return true;
  }
  return false;
}
// میزها — الان از API واقعی (/restaurant/tables) لود می‌شه، نه نمونه‌ی ثابت
// نگاشت وضعیت: بک‌اند از 'occupied' استفاده می‌کنه، رابط کاربری همیشه 'seated' نشون می‌داده
const BK2UI_STATE = { free:'free', reserved:'reserved', occupied:'seated', cleaning:'free', maintenance:'free' };
const UI2BK_STATE = { free:'free', reserved:'reserved', seated:'occupied' };
let TABLES = [];
// میزهای نمونه برای حالت دمو/آفلاین — هم‌راستا با رزروهای نمونه (میزهای ۱ تا ۹)
const DEMO_TABLES = [
  {id:'demo-t1',n:1,c:2,s:'free'},{id:'demo-t2',n:2,c:2,s:'free'},{id:'demo-t3',n:3,c:4,s:'free'},
  {id:'demo-t4',n:4,c:2,s:'free'},{id:'demo-t5',n:5,c:4,s:'free'},{id:'demo-t6',n:6,c:4,s:'free'},
  {id:'demo-t7',n:7,c:6,s:'free'},{id:'demo-t8',n:8,c:6,s:'free'},{id:'demo-t9',n:9,c:8,s:'free'},
  {id:'demo-t10',n:10,c:2,s:'free'},
];
function mapApiTable(t){
  return { id:t.id, n:t.number, c:t.capacity, name:t.name||undefined, s:BK2UI_STATE[t.state]||'free', _raw:t };
}
async function loadTables(){
  const res = await API.listTables();
  if (res.ok && Array.isArray(res.data?.items)) {
    TABLES = res.data.items.map(mapApiTable);
  } else if (!TABLES.length) {
    // بک‌اند در دسترس نیست → میزهای نمونه (مثل بقیه‌ی داده‌های دمو) تا پلان سالن و
    // KPI اشغال خالی نمانند
    TABLES = DEMO_TABLES.map(t=>({...t}));
  }
  _tablesLoaded = true;
  return TABLES;
}
// ⚠️ رفعِ باگ (همان الگویِ RES): این آرایه قبلاً «const GUESTS» بود — یعنی
// ویجتِ «مشتریانِ برتر» در داشبورد (overview.js: renderTopCustomers) و مودالِ
// «تاریخچه‌ی مشتری» (viewCustomerHistory) همیشه همین ۴ مشتریِ نمونه را نشان
// می‌دادند، برایِ هر رستورانِ واقعی. توجه: تبِ کاملِ «هوشِ مشتری»
// (crm.js: rCustomers/custRenderOverviewDemo) از قبل درست بود — از
// API.customers واقعی می‌خواند و custRenderOverviewDemo فقط در نبودِ توکن/
// خطایِ API صدا زده می‌شود؛ فقط این دو مصرف‌کننده در overview.js اشتباه بودند.
// GUESTS_DEMO فقط fallbackِ آفلاین است (هم‌الگو با RES_DEMO/WL_DEMO_QUEUE).
const GUESTS_DEMO=[
  {name:'کیان موسوی',ava:'',seg:'vip',visits:18,last:'۳ روز پیش',spent:'۶.۲م',vip:95,ret:92,churn:8,phone:'۰۹۱۲۵۵۵۶۶۷۷',birthday:'۱۵ خرداد',points:3400},
  {name:'نیلوفر رضایی',ava:'',seg:'regular',visits:12,last:'امروز',spent:'۳.۸م',vip:62,ret:78,churn:20,phone:'۰۹۱۲۳۳۳۴۴۵۵',birthday:'۲ آبان',points:1900},
  {name:'امیر حسینی',ava:'',seg:'new',visits:3,last:'هفته پیش',spent:'۸۹۰ک',vip:30,ret:55,churn:45,phone:'۰۹۱۲۷۷۷۸۸۹۹',birthday:'۸ دی',points:300},
  {name:'مریم احمدی',ava:'',seg:'risk',visits:6,last:'۳۵ روز پیش',spent:'۱.۵م',vip:35,ret:30,churn:82},
];
let GUESTS=GUESTS_DEMO.slice();
let _guestsLoaded=false;
/**
 * ۵ مشتریِ برترِ رستوران (بر اساسِ تعدادِ بازدید) را از همان
 * /restaurant/customers که تبِ «هوشِ مشتری» استفاده می‌کند می‌گیرد.
 * نگاشتِ فیلدها: seg فقط برایِ نشانِ VIP لازم است (is_vip بولی، نه رشته‌ی
 * سگمنتِ RFM که تاکسونومیِ جداگانه‌ای دارد). ret (٪بازگشت) از رویِ معکوسِ
 * churn_risk_score تخمین زده می‌شود — نزدیک‌ترین معادلِ واقعیِ موجود.
 * birthday/points عمداً ست نمی‌شوند (این API آن‌ها را ندارد؛ رندرِ شرطیِ
 * موجود در viewCustomerHistory به‌جایِ نمایشِ مقدارِ ساختگی، مخفی می‌ماند).
 * predicted_clv_toman فعلاً برایِ همه صفر است چون هیچ سیستمِ صندوق/پرداختی
 * وصل نیست (رجوع کنید به REVENUE_CONFIG.connected=false در overview.js) —
 * صفرِ واقعی را به‌جایِ «۰ تومان» با «—» نشان می‌دهیم تا «مشتریِ VIP با ۸
 * بازدید ولی صفر تومان خرید» به‌نظر متناقض/اشتباه نرسد؛ این یعنی «هنوز
 * دیتایِ خرید نداریم»، نه «صفر خرج کرده».
 */
async function loadTopGuestsForDashboard(){
  if(!API.getToken()) return false;
  const res=await API.customers('sort=visits&limit=5');
  if(res.ok && Array.isArray(res.data?.items)){
    GUESTS=res.data.items.map(c=>({
      name:c.name, ava:'', seg:c.is_vip?'vip':'',
      visits:c.total_visits||0,
      spent:c.predicted_clv_toman>0?fmtMoney(c.predicted_clv_toman):'—',
      phone:toFaDigits(c.phone||''),
      // Math.min هم لازم است، نه فقط max: churn_risk_score تئوریاً باید ۰-۱۰۰
      // باشد (رفعِ باگش در customer-insights.ts)، ولی این عددِ مشتق‌شده تا
      // ۶۰ ثانیه کش می‌شود؛ کلمپِ دولایه یعنی حتی یک مقدارِ کهنه/منفی هم
      // «۱۰۱٪ بازگشت» در UI نشان نمی‌دهد.
      ret:c.churn_risk_score!=null?Math.min(100,Math.max(0,100-c.churn_risk_score)):0,
    }));
    _guestsLoaded=true;
    return true;
  }
  return false;
}
// ⚠️ رفعِ باگ (یافته‌ی سوم از همان دسته‌یِ RES/GUESTS/NOTIFS): renderInsights
// (overview.js) یک بینشِ هاردکد داشت: «جمعه شب پرترددترین زمان توست» — عیناً
// برایِ هر رستوران نشان داده می‌شد، حتی اگر روزِ شلوغِ واقعی‌اش چیزِ دیگری
// بود. اینجا همان تحلیلِ واقعیِ AI Restaurant Manager (manager-insights →
// پاسخِ strongest_weekdays) را می‌خوانیم؛ اگر داده کم باشد (کمتر از ۵ روزِ
// متمایز یا کمتر از ۳۰ رزرو در ۶۰ روزِ اخیر) آن پاسخ اصلاً برنمی‌گردد و ما
// هم بینش را نشان نمی‌دهیم — نه یک ادعایِ ساختگی.
let WEEKDAY_INSIGHT=null;
let _weekdayInsightLoaded=false;
async function loadWeekdayInsightForDashboard(){
  if(!API.getToken()) return false;
  const res=await API.managerInsights();
  if(res.ok && Array.isArray(res.data?.answers)){
    const a=res.data.answers.find(x=>x.id==='strongest_weekdays');
    WEEKDAY_INSIGHT=a?{t:a.finding, d:a.recommended_action||'کارکنان بیشتری برای این روزها برنامه‌ریزی کن'}:null;
    _weekdayInsightLoaded=true;
    return true;
  }
  // manager-insights پشتِ canViewAnalytics است — کارمندِ بدونِ این مجوز
  // همیشه ۴۰۳ می‌گیرد. بدونِ این شرط، rOverview هر بار دوباره تلاش می‌کرد
  // (fetch بی‌فایده‌ی تکراری)؛ ۴۰۳ یعنی دیگر تلاش نکن، نه یک خطایِ موقت.
  if(res.status===403){ _weekdayInsightLoaded=true; return false; }
  return false;
}
// ⚠️ رفعِ باگ: نقشه‌ی حرارتیِ هفتگی در renderHeatmap (overview.js) یک
// جدولِ ۷×۳ کاملاً هاردکد بود («آخر هفته شب شلوغ‌تر») بدونِ هیچ مسیری به
// دیتایِ واقعی — برخلافِ RES/GUESTS که حداقل fallback بودند، این یکی هرگز
// جایگزین نمی‌شد. همان heatmap واقعیِ /restaurant/analytics (که تبِ
// مارکتینگ/آنالیتیکس هم می‌خواند) را می‌گیریم و در renderHeatmap بر اساسِ
// ساعت به ۳ بازه‌ی ظهر/عصر/شب دسته‌بندی می‌کنیم.
let HEATMAP_DATA=null;
let _heatmapLoaded=false;
async function loadHeatmapForDashboard(){
  if(!API.getToken()) return false;
  const res=await API.analytics();
  if(res.ok && Array.isArray(res.data?.heatmap)){
    HEATMAP_DATA=res.data.heatmap; // [{dow,hour,count}] — dow: 0=یکشنبه..6=شنبه (Postgres DOW)
    _heatmapLoaded=true;
    return true;
  }
  // analytics هم پشتِ canViewAnalytics است — همان دلیلِ weekday insight:
  // ۴۰۳ یعنی دیگر تلاش نکن، وگرنه هر rOverview دوباره fetch بی‌فایده می‌زد.
  if(res.status===403){ _heatmapLoaded=true; return false; }
  return false;
}
// باشگاه مشتریان — دیتای واقعی و زنده
let CLUB=[
  {fn:'کیان',ln:'موسوی',phone:'۰۹۱۲۵۵۵۶۶۷۷',code:'VIS-1001',tier:'gold',points:1240,bMonth:'خرداد',joined:'۳ ماه پیش'},
  {fn:'نیلوفر',ln:'رضایی',phone:'۰۹۱۲۱۱۱۲۲۳۳',code:'VIS-1002',tier:'silver',points:680,bMonth:'خرداد',joined:'۲ ماه پیش'},
  {fn:'مریم',ln:'احمدی',phone:'۰۹۱۲۸۸۸۷۷۶۶',code:'VIS-1003',tier:'silver',points:540,bMonth:'مهر',joined:'۴ ماه پیش'},
  {fn:'امیر',ln:'حسینی',phone:'۰۹۱۲۲۲۲۳۳۴۴',code:'VIS-1004',tier:'bronze',points:210,bMonth:'دی',joined:'هفته پیش'},
  {fn:'سامان',ln:'عباسی',phone:'۰۹۱۲۴۴۴۵۵۶۶',code:'VIS-1005',tier:'bronze',points:150,bMonth:'خرداد',joined:'۲ هفته پیش'},
];
const CUR_MONTH='خرداد';
// نگاشت شماره ماه (۱-۱۲) به نام ماه فارسی
const FA_MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
// بارگذاری اعضای باشگاه از API (با fallback به CLUB نمونه)
async function loadClubMembers(){
  const res=await API.get('/restaurant/members?limit=100');
  if(res.ok && Array.isArray(res.data?.members)){
    API.online=true;
    return res.data.members.map(m=>({
      fn:m.first_name||'',
      ln:m.last_name||'',
      phone:m.phone||'',
      code:m.code,
      tier:m.tier,
      points:m.points,
      bMonth:m.birth_month?FA_MONTHS[m.birth_month-1]:'—',
      joined:m.joined_at?faRelative(m.joined_at):'',
    }));
  }
  API.online=false;
  return CLUB; // fallback به نمونه
}
// تبدیل تاریخ ISO به نمایش نسبی فارسی ساده
function faRelative(iso){
  const d=new Date(iso),now=new Date();
  const days=Math.floor((now-d)/86400000);
  if(days<1)return'امروز';
  if(days<7)return fa(days)+' روز پیش';
  if(days<30)return fa(Math.floor(days/7))+' هفته پیش';
  return fa(Math.floor(days/30))+' ماه پیش';
}
// نگاشت وضعیت enum واقعی بک‌اند → وضعیت فرانت پنل
// بک‌اند: pending/confirmed/arrived/no_show/cancelled_by_user/cancelled_by_restaurant
function mapResStatus(apiStatus){
  if(apiStatus==='arrived')return'arrived';
  if(apiStatus==='no_show')return'noshow';
  if(apiStatus==='cancelled_by_user'||apiStatus==='cancelled_by_restaurant')return'cancelled';
  if(apiStatus==='confirmed'||apiStatus==='pending')return'confirmed';
  return'confirmed';
}
// تشخیص دسته‌ی تاریخ از زمان رزرو (برای سازگاری با فیلتر محلی)
function dateCategoryOf(slotStart){
  const d=new Date(slotStart),now=new Date();
  const startToday=new Date(now);startToday.setHours(0,0,0,0);
  const endToday=new Date(startToday);endToday.setDate(endToday.getDate()+1);
  const endTomorrow=new Date(endToday);endTomorrow.setDate(endTomorrow.getDate()+1);
  if(d<startToday)return'past';
  if(d<endToday)return'today';
  if(d<endTomorrow)return'tomorrow';
  return'upcoming';
}
// بارگذاری رزروهای رستوران از API (با fallback به نمونه)
let RES_NEXT_CURSOR=null;   // cursor صفحه‌ی بعد (اگر بیش از یک صفحه رزرو باشد)
let RES_DATE_FILTER='today';
function mapResRow(r){
  const d=r.slot_start?new Date(r.slot_start):null;
  const timeStr=d?toFaDigits(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')):'—';
  const cat=r.slot_start?dateCategoryOf(r.slot_start):'today';
  return {
    t:timeStr, name:r.name||'مهمان', party:r.party_size||2, table:r.table_number||0,
    status:mapResStatus(r.status), seg:'regular', pre:(r.preorder&&r.preorder.length>0),
    note:r.note||'', phone:toFaDigits(r.phone||''), date:cat,
    dLabel:{today:'امروز',tomorrow:'فردا',upcoming:'آینده',past:'گذشته'}[cat], code:r.code,
    // نشانِ اعتبارِ رزرو (economy.ts) — از loyalty/seg کاملاً جداست، رجوع کن
    // به توضیحِ REPUTATION_BADGE در reservations.js
    reputationTier:r.reputation_tier||null,
  };
}
async function loadReservations(dateFilter){
  RES_DATE_FILTER=dateFilter||'today';
  const res=await API.get('/restaurant/reservations?date='+encodeURIComponent(RES_DATE_FILTER));
  if(res.ok && Array.isArray(res.data?.reservations)){
    API.online=true;
    RES_NEXT_CURSOR=res.data.next_cursor||null;   // ذخیره‌ی cursor برای «بارگذاری بیشتر»
    return res.data.reservations.map(mapResRow);
  }
  API.online=false;
  RES_NEXT_CURSOR=null;
  return null; // یعنی fallback به RES نمونه
}
// بارگذاری صفحه‌ی بعدیِ رزروها (وقتی بیش از ۱۰۰ رزرو در یک روز باشد — مقیاسِ ۱۰k+)
async function loadMoreReservations(){
  if(!RES_NEXT_CURSOR) return [];
  const res=await API.get(`/restaurant/reservations?date=${encodeURIComponent(RES_DATE_FILTER)}&cursor=${encodeURIComponent(RES_NEXT_CURSOR)}`);
  if(res.ok && Array.isArray(res.data?.reservations)){
    RES_NEXT_CURSOR=res.data.next_cursor||null;
    return res.data.reservations.map(mapResRow);
  }
  return [];
}
// نظرات مشتریان (با تفکیک امتیاز و وضعیت پاسخ)
let REVIEWS=[];
// عکس‌های گالری — از /restaurant/photos واقعی لود می‌شن
let GALLERY=[];
// هویت رستوران — name اینجا فقط پیش‌فرضِ اولیه/دموست؛ با اولین اجرایِ
// renderBranchSwitcher (routing.js، بعد از لاگینِ واقعی) از /restaurant/branches
// همگام می‌شود، و «تغییرِ نام» (crm.js) با PUT /restaurant/profile واقعاً
// روی سرور ذخیره می‌کند (رجوع کنید به رفعِ باگِ نامِ رستوران).
// logoEmoji/logoGradient فقط نمایِ جایگزینِ محلی‌اند تا لوگویِ واقعی (یک
// RestaurantPhoto با category='logo'، در GALLERY) آپلود/تأیید شود.
let RESTAURANT={name:'کافه‌رستوران ویستا',logoEmoji:'🌿',logoGradient:'linear-gradient(135deg,#34D399,#059669)'};
function normalizePhone(p){return (p||'').replace(/\s/g,'').replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d])}
// اتصال خودکار: هر رزرو → ثبت در باشگاه (بدون تکرار، کلید: تلفن)
function enrollClub(name,phone){
  const ph=normalizePhone(phone);
  if(!ph||ph.length<7)return {enrolled:false,reason:'no-phone'};
  const existing=CLUB.find(m=>normalizePhone(m.phone)===ph);
  if(existing)return {enrolled:false,member:existing,reason:'exists'};
  const parts=(name||'').trim().split(' ');
  const fn=parts[0]||'مهمان', ln=parts.slice(1).join(' ')||'';
  const code='VIS-'+String(memCounter++).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
  const member={fn,ln,phone:normalizePhone(phone),code,tier:'bronze',points:0,bMonth:'—',joined:'همین الان'};
  CLUB.unshift(member);
  return {enrolled:true,member};
}

const TITLES={overview:'داشبورد',reservations:'مدیریت رزروها',waitlist:'لیست انتظار',floor:'پلان سالن',profile:'پروفایل و نظرات',customers:'مشتریان',loyalty:'باشگاه مشتریان',marketing:'بازاریابی',analytics:'آنالیتیکس',cashback:'تنظیم کش‌بک',staff:'کارکنان',pricing:'قیمت‌گذاری',chat:'پیام‌ها'};

// ═══════════ ROUTING ═══════════
