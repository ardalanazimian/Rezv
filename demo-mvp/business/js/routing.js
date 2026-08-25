// ═══ رزرونو — پنل business: مسیریابی بین صفحات (Vanilla JS، بدون build، scope مشترک) ═══
function nav(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  document.getElementById('v-'+v).classList.add('active');
  document.querySelectorAll('.sb-item').forEach(i=>i.classList.toggle('active',i.dataset.v===v));
  document.getElementById('tbTitle').textContent=TITLES[v];
  ({overview:rOverview,reservations:rReservations,waitlist:rWaitlist,floor:rFloor,profile:rProfile,customers:rCustomers,loyalty:rLoyalty,marketing:rMarketing,analytics:rAnalytics,cashback:rCashback,staff:rStaff,pricing:rPricing,chat:rChat})[v]();
  if(window.innerWidth<=768)closeSidebar();
  document.querySelector('.content').scrollTop=0;
}
// ═══════════ سوییچر شعبه (چندشعبه‌ای — وصل به GET/POST /restaurant/branches واقعی) ═══════════
// نکته: انتخاب شعبه فقط هدر X-Restaurant-Id را عوض می‌کند (نه JWT) — طبق طراحی بک‌اند،
// یعنی بدون نیاز به ورود دوباره قابل‌سوییچ است.
let BRANCHES=[];
let BRANCH_LOCKED=false;
async function loadBranches(){
  if(!API.getToken()) return;
  const res=await API.branchesList();
  if(res.ok && res.data){
    BRANCHES=res.data.branches||[];
    BRANCH_LOCKED=!!res.data.locked_to_branch;
    // اولین بار: شعبه‌ی فعلی سرور را به‌عنوان شعبه‌ی فعال ذخیره کن
    if(!API.getActiveRestaurant() && res.data.current_restaurant_id) API.setActiveRestaurant(res.data.current_restaurant_id);
    renderBranchSwitcher();
  }
}
function renderBranchSwitcher(){
  const nameEl=document.getElementById('swName');
  const metaEl=document.querySelector('.sb-switch-meta');
  const cur=BRANCHES.find(b=>b.id===API.getActiveRestaurant())||BRANCHES[0];
  if(nameEl && cur) nameEl.textContent=cur.name;
  if(metaEl) metaEl.textContent=BRANCH_LOCKED?'قفل‌شده به این شعبه':(BRANCHES.length>1?`${fa(BRANCHES.length)} شعبه`:'شعبه اصلی');
  const sw=document.querySelector('.sb-switch');
  if(sw) sw.classList.toggle('locked', BRANCH_LOCKED || BRANCHES.length<=1);
}
function openBranchSwitcher(){
  if(!API.getToken()){ toast('🔄','برای سوییچ شعبه اول وارد شو'); return; }
  if(BRANCH_LOCKED){ toast('🔒','دسترسی شما فقط به همین شعبه است'); return; }
  if(BRANCHES.length<=1){ toast('ℹ️','فقط یک شعبه برای این کسب‌وکار ثبت شده'); return; }
  const curId=API.getActiveRestaurant();
  openModal(`<div class="modal-title">انتخاب شعبه</div><div class="modal-sub">داده‌های پنل بر اساس شعبه‌ی انتخابی نمایش داده می‌شود</div>
    <div style="margin-top:14px">${BRANCHES.map(b=>`
      <div class="staff-row" style="cursor:pointer;${b.id===curId?'background:var(--blue-50);border-radius:12px':''}" onclick="selectBranch('${esc(b.id)}')">
        <div class="staff-ava">${esc((b.name||'?').charAt(0))}</div>
        <div style="flex:1"><div style="font-size:14px;font-weight:700">${esc(b.name)}</div><div style="font-size:12px;color:var(--t2)">${b.is_open?'🟢 باز':'🔴 بسته'}</div></div>
        ${b.id===curId?'<span style="font-size:12px;color:var(--blue);font-weight:700">فعال ✓</span>':''}
      </div>`).join('')}</div>`);
}
async function selectBranch(id){
  if(id===API.getActiveRestaurant()){ closeModal(); return; }
  closeModal();
  toast('🔄','در حال سوییچ به شعبه‌ی جدید...');
  API.setActiveRestaurant(id);
  // همه‌ی کش‌های سطح-شعبه را باطل کن تا صفحات دوباره از سرور بخوانند
  if(typeof _wlLoaded!=='undefined') _wlLoaded=false;
  if(typeof _staffLoaded!=='undefined') _staffLoaded=false;
  if(typeof _notesLoaded!=='undefined') _notesLoaded=false;
  if(typeof _segCounts!=='undefined') _segCounts=null;
  if(typeof _mktLoaded!=='undefined') _mktLoaded=false;
  if(typeof _hoursLoaded!=='undefined') _hoursLoaded=false;
  await loadBranches();
  await loadTables();
  refreshActiveView();
  toast('✅','شعبه عوض شد');
}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sbOverlay').classList.toggle('show')}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sbOverlay').classList.remove('show')}
function toggleStatus(){
  const b=document.getElementById('tbStatus'),open=b.classList.contains('open');
  b.classList.toggle('open');b.classList.toggle('closed');
  document.getElementById('tbStatusText').textContent=open?'بسته':'باز';
  toast(open?'🔴':'🟢',open?'رستوران بسته شد':'رستوران باز شد');
}

// ═══════════ OVERVIEW ═══════════
