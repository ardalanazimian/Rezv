// ═══ رزرونو — پنل company: ابزارها + لایه‌ی اتصال API admin (Vanilla JS، scope مشترک) ═══
function fa(n){return n.toLocaleString('fa-IR')}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
let tt;
function toast(icon,msg){const t=document.getElementById('toast');document.getElementById('toastIcon').textContent=icon;document.getElementById('toastMsg').textContent=msg;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2600)}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sbOverlay').classList.toggle('show')}

// ═══════════════════════════════════════════════════════════
//  لایه‌ی اتصال API (فاز ۳) — پنل شرکت به endpointهای admin
//  با بک‌اند → داده‌ی واقعی · بدون بک‌اند → نمونه (پنل نمی‌شکند)
// ═══════════════════════════════════════════════════════════
const API = {
  base: '',
  timeout: 8000,
  _token: null,
  _refresh: null,
  _refreshing: null,
  online: true,
  setToken(t){ this._token = t; try { if(t) localStorage.setItem('rz_co_access', t); else localStorage.removeItem('rz_co_access'); } catch {} },
  getToken(){ return this._token; },
  setRefresh(t){ this._refresh = t; try { if(t) localStorage.setItem('rz_co_refresh', t); else localStorage.removeItem('rz_co_refresh'); } catch {} },
  restoreSession(){ try { this._token = localStorage.getItem('rz_co_access')||null; this._refresh = localStorage.getItem('rz_co_refresh')||null; } catch {} return !!this._token; },
  async request(path, opts = {}, _retried = false){
    if (window.DEMO_MODE) return { ok: false, offline: true, error: { message: 'demo' } };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      if (this._token) headers['Authorization'] = `Bearer ${this._token}`;
      const res = await fetch(this.base + '/api/v1' + path, { ...opts, headers, signal: ctrl.signal });
      clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && this._refresh && !_retried && !path.startsWith('/auth/')) {
          if (await this._doRefresh()) return this.request(path, opts, true);
          this._onSessionExpired();
        }
        return { ok: false, status: res.status, error: data?.error || { message: `خطای ${res.status}` } };
      }
      return { ok: true, status: res.status, data };
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, offline: true, error: { message: 'اتصال به سرور برقرار نشد' } };
    }
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
  _onSessionExpired(){ this.setToken(null); this.setRefresh(null); if (typeof onAdminSessionExpired === 'function') onAdminSessionExpired(); },
  get(path){ return this.request(path); },
  post(path, body){ return this.request(path, { method:'POST', body: JSON.stringify(body||{}) }); },
  patch(path, body){ return this.request(path, { method:'PATCH', body: JSON.stringify(body||{}) }); },
  async requestAdminOtp(phone){ return this.request('/auth/staff/request', { method:'POST', body: JSON.stringify({ phone }) }); },
  async verifyAdminOtp(phone, code){
    const res = await this.request('/auth/staff/verify', { method:'POST', body: JSON.stringify({ phone, code }) });
    if (res.ok && res.data?.access) { this.setToken(res.data.access); this.setRefresh(res.data.refresh); }
    return res;
  },
  async doLogout(){
    if (this._refresh) { await fetch(this.base + '/api/v1/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: this._refresh }) }).catch(() => {}); }
    this.setToken(null); this.setRefresh(null);
  },
  overview(){ return this.get('/admin/overview'); },
  systemHealth(){ return this.get('/admin/system-health'); },
  businessIntelligence(){ return this.get('/admin/business-intelligence'); },
  security(){ return this.get('/admin/security'); },
  control(restId, body){ return this.patch(`/admin/restaurants/${restId}/control`, body); },
};

// نگاشت رستوران API به ساختار پنل
// فیلدهای ظاهری (لوگو/گرادیان/شهر) چون در بک‌اند مدل نشدن، از نمونه پر می‌شن (فقط تزئینی)
// ولی وضعیت اشتراک/پلن/روز باقی‌مانده همگی واقعی‌اند (از tenant.plan_expires_at)
const SUB_STATUS_LABEL = { active:'فعال', expiring:'رو به اتمام', expired:'منقضی', trial:'دوره آزمایشی', trial_expired:'آزمایشی تمام‌شده' };
function mapAdminRestaurant(apiR, fallback){
  return {
    id: apiR.id,
    tenantId: apiR.tenant_id,
    name: apiR.name,
    logo: fallback?.logo || '🍽️',
    grad: fallback?.grad || 'linear-gradient(135deg,#818CF8,#4F46E5)',
    city: apiR.cuisine || fallback?.city || '—',
    plan: apiR.plan || 'free',
    // وضعیت واقعی اشتراک — از بک‌اند (tenant.plan_expires_at / trial_ends_at)
    status: apiR.subscription_status,
    daysLeft: apiR.days_left,
    planExpiresAt: apiR.plan_expires_at,
    trialEndsAt: apiR.trial_ends_at,
    isOpen: apiR.is_open,
    members: apiR.members ?? 0,
    reservations: apiR.reservations ?? 0,
    sms: apiR.sms_total_sent ?? 0,
    smsBalance: apiR.sms_balance ?? 0,
    joined: apiR.joined_at ? new Date(apiR.joined_at).toLocaleDateString('fa-IR') : '—',
  };
}

// بارگذاری رستوران‌ها از API admin (با fallback به نمونه فقط در حالت آفلاین/دمو)
async function loadAdminRestaurants(){
  const res = await API.get('/admin/restaurants');
  if (res.ok && Array.isArray(res.data?.restaurants)) {
    API.online = true;
    updateOfflineBanner();
    return res.data.restaurants.map(apiR => {
      const fb = RESTAURANTS_SAMPLE.find(s => s.id === apiR.id) || RESTAURANTS_SAMPLE[0];
      return mapAdminRestaurant(apiR, fb);
    });
  }
  API.online = false;
  updateOfflineBanner();
  return RESTAURANTS_SAMPLE.map(s => ({ ...s, _demo: true }));
}
function updateOfflineBanner(){
  const el = document.getElementById('offlineBanner');
  if (el) el.style.display = API.online ? 'none' : 'flex';
}

// ════════ داده‌ی رستوران‌ها (شبیه‌سازی — در محصول واقعی از API) ════════
