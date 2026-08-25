// ═══ رزرونو — پنل business: مسیریابی بین صفحات (Vanilla JS، بدون build، scope مشترک) ═══
// ═══════════ محدودسازیِ منو بر اساسِ مجوزِ کاربر ═══════════
// نگاشتِ هر صفحه به مجوزی که بک‌اند برای endpointهای همان صفحه اعمال می‌کند.
// این فقط UI را هم‌راستا می‌کند؛ اجبارِ واقعی سمتِ سرور است (withRestaurantAuth).
// بدون این، کارمندِ محدودشده همه‌ی صفحات را می‌دید و با کلیک ۴۰۳ می‌گرفت — بن‌بست.
const VIEW_PERMISSION = {
  reservations: 'canManageReservations',
  chat:         'canManageReservations',
  waitlist:     'canManageWaitlist',
  floor:        'canManageTables',
  profile:      'canManageSettings',
  menu:         'canManageSettings',
  cashback:     'canManageSettings',
  pricing:      'canManageSettings',
  marketing:    'canManageCampaigns',
  customers:    'canViewAnalytics',
  loyalty:      'canViewAnalytics',
  analytics:    'canViewAnalytics',
  // ⚠️ `staff` عمداً اینجا **نیست** — پایین‌تر با نقش گیت می‌شود، نه با مجوز.
  // overview همیشه در دسترس است (داشبوردِ پایه).
};

// ═══ صفحاتی که با **نقش** گیت می‌شوند، نه با کلیدِ مجوز ═══
// چرا جدا: `canManageStaff` یک کلیدِ **قابلِ‌دادن ولی هرگز اجرا نشده** است —
// شمارشِ واقعی روی api/src/app/api صفر گارد نشان می‌دهد. مدیریتِ کارکنان با
// `assertManagerOrOwner` محافظت می‌شود (api/src/app/api/v1/restaurant/staff/route.ts:79)
// که نقش را می‌خواهد، نه مجوز را — و این عمدی است: کلیدی که بشود آن را به یک
// staff داد، هم‌ارزِ owner می‌شود (گاردِ PATCH فقط `target.role === 'owner'` را
// می‌گیرد، پس دارنده‌ی کلید می‌توانست خودش را با یک درخواست همه‌مجوز کند).
//
// بن‌بستی که این رفع می‌کند: تا پیش از این `staff: 'canManageStaff'` بود، پس
// کارمندی که آن کلید را گرفته بود تبِ «کارکنان» را **می‌دید** و هر کلیک ۴۰۳
// می‌گرفت. حالا UI دقیقاً همان چیزی را می‌گوید که سرور اجرا می‌کند.
const VIEW_ROLE = {
  staff: ['owner', 'manager'],
};

function canAccessView(v){
  const roles = VIEW_ROLE[v];
  if (roles) {
    // بدونِ اطلاعِ نقش (آفلاین/دمو) پنهان نمی‌کنیم — همان قاعده‌ی API.can.
    const role = (typeof STAFF_INFO !== 'undefined' && STAFF_INFO) ? STAFF_INFO.role : null;
    return !role || roles.indexOf(role) !== -1;
  }
  const key = VIEW_PERMISSION[v];
  return !key || (typeof API !== 'undefined' && API.can ? API.can(key) : true);
}

/** آیتم‌های منویی که کاربر اجازه‌شان را ندارد پنهان می‌شوند. پس از ورود صدا زده می‌شود. */
function applyPermissionsToNav(){
  document.querySelectorAll('.sb-item').forEach(btn => {
    const v = btn.dataset.v;
    if (!v) return;
    const ok = canAccessView(v);
    btn.hidden = !ok;
    btn.setAttribute('aria-hidden', String(!ok));
    btn.tabIndex = ok ? 0 : -1;
  });
}

function nav(v){
  // دفاعِ لایه‌ی دوم: حتی اگر کسی دکمه را دور بزند، به صفحه‌ی بدونِ مجوز نمی‌رود.
  if (!canAccessView(v)) { if (typeof toast === 'function') toast('', 'دسترسی شما به این بخش محدود شده است'); return; }
  try{ if(window.rzTrack) window.rzTrack('page.viewed',{page:v}); }catch(e){}
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  document.getElementById('v-'+v).classList.add('active');
  document.querySelectorAll('.sb-item').forEach(i=>i.classList.toggle('active',i.dataset.v===v));
  document.getElementById('tbTitle').textContent=TITLES[v];
  ({overview:rOverview,reservations:rReservations,waitlist:rWaitlist,floor:rFloor,profile:rProfile,menu:rMenu,customers:rCustomers,loyalty:rLoyalty,marketing:rMarketing,analytics:rAnalytics,cashback:rCashback,staff:rStaff,pricing:rPricing,chat:rChat})[v]();
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

  // ⚠️ رفعِ ادعایِ بی‌پشتوانه (فازِ ۲، §۳): نشانِ #tbStatus یک دکمه بود که فقط
  // کلاسِ خودش را عوض می‌کرد و «رستوران بسته شد» toast می‌داد — سرور، اپِ
  // مشتری و موتورِ ظرفیت هیچ‌کدام خبردار نمی‌شدند و رزرو ادامه داشت. هیچ
  // endpointی هم برایِ نوشتنِ این حالت وجود ندارد. حالا فقط **بازتابِ**
  // حقیقتِ سرور است (b.is_open که همین‌جا در دست داریم و در فهرستِ شعبه‌ها
  // هم رندر می‌شود).
  const stBtn=document.getElementById('tbStatus'), stTxt=document.getElementById('tbStatusText');
  if(stBtn && stTxt && cur){
    const open = cur.is_open !== false;
    stBtn.classList.toggle('open', open);
    stBtn.classList.toggle('closed', !open);
    stTxt.textContent = open ? 'باز' : 'بسته';
    stBtn.setAttribute('aria-label', open ? 'وضعیتِ شعبه: باز' : 'وضعیتِ شعبه: بسته');
  }
  // ⚠️ رفعِ باگ: RESTAURANT.name (پیش‌فرضِ data.js) هاردکد است و هیچ‌وقت
  // به‌تنهایی از سرور خوانده نمی‌شد — تبِ «پروفایل» همیشه نامِ دموی
  // «کافه‌رستوران ویستا» را نشان می‌داد، صرف‌نظر از رستورانِ واقعیِ لاگین‌شده.
  // اینجا همان دیتایی که برایِ سوییچرِ شعبه (بالا) از سرور آمده، به RESTAURANT
  // هم می‌رسد — بدونِ فراخوانیِ اضافه — و اگر تبِ پروفایل باز است دوباره رندر می‌شود.
  if(cur && typeof RESTAURANT!=='undefined' && RESTAURANT.name!==cur.name){
    RESTAURANT.name=cur.name;
    if(typeof profTab!=='undefined' && document.getElementById('v-profile')?.classList.contains('active') && typeof profRenderGallery==='function') profRenderGallery();
  }
}
function openBranchSwitcher(){
  if(!API.getToken()){ toast('','برای سوییچ شعبه اول وارد شو'); return; }
  if(BRANCH_LOCKED){ toast('','دسترسی شما فقط به همین شعبه است'); return; }
  if(BRANCHES.length<=1){ toast('','فقط یک شعبه برای این کسب‌وکار ثبت شده'); return; }
  const curId=API.getActiveRestaurant();
  openModal(`<div class="modal-title">انتخاب شعبه</div><div class="modal-sub">داده‌های پنل بر اساس شعبه‌ی انتخابی نمایش داده می‌شود</div>
    <div style="margin-top:14px">${BRANCHES.map(b=>`
      <div class="staff-row" style="cursor:pointer;${b.id===curId?'background:var(--blue-50);border-radius:12px':''}" onclick="selectBranch(${jsq(b.id)})">
        <div class="staff-ava">${esc((b.name||'?').charAt(0))}</div>
        <div style="flex:1"><div style="font-size:14px;font-weight:700">${esc(b.name)}</div><div style="font-size:12px;color:var(--t2)">${b.is_open?`<span class="live-dot" aria-hidden="true"></span> باز`:`<span class="dot-closed" aria-hidden="true"></span> بسته`}</div></div>
        ${b.id===curId?`<span class="badge badge-brand">${icon('check',{size:12})} فعال</span>`:''}
      </div>`).join('')}</div>`);
}
async function selectBranch(id){
  if(id===API.getActiveRestaurant()){ closeModal(); return; }
  closeModal();
  toast('','در حال سوییچ به شعبه‌ی جدید...');
  API.setActiveRestaurant(id);
  // همه‌ی کش‌های سطح-شعبه را باطل کن تا صفحات دوباره از سرور بخوانند
  if(typeof _wlLoaded!=='undefined') _wlLoaded=false;
  if(typeof _staffLoaded!=='undefined') _staffLoaded=false;
  if(typeof _notesLoaded!=='undefined') _notesLoaded=false;
  if(typeof _segCounts!=='undefined') _segCounts=null;
  if(typeof _mktLoaded!=='undefined') _mktLoaded=false;
  if(typeof _hoursLoaded!=='undefined') _hoursLoaded=false;
  // ⚠️ رفعِ باگ (ریویوی Copilot روی PR + یافته‌ی مشابه در خودِ RES/GUESTS
  // که از PR #5 جا مانده بود): این ۵ کش هم به‌شعبه وابسته‌اند ولی اینجا
  // reset نمی‌شدند — یعنی بعد از سوییچِ شعبه، داشبورد تا مدتی دیتایِ
  // شعبه‌ی قبلی (رزروها، مهمان‌های برتر، اعلان‌ها، بینشِ روزِ هفته، نقشه‌ی
  // حرارتی) را نشان می‌داد، چون گاردِ «if(!_xLoaded)» اجازه‌ی fetchِ
  // دوباره را نمی‌داد.
  if(typeof _resLoaded!=='undefined') _resLoaded=false;
  if(typeof _guestsLoaded!=='undefined') _guestsLoaded=false;
  if(typeof _notifsLoaded!=='undefined') _notifsLoaded=false;
  if(typeof _weekdayInsightLoaded!=='undefined') _weekdayInsightLoaded=false;
  if(typeof _heatmapLoaded!=='undefined') _heatmapLoaded=false;
  await loadBranches();
  await loadTables();
  refreshActiveView();
  // زنگوله‌ی اعلان برخلافِ تب‌ها (که refreshActiveView فقط تبِ فعال را
  // دوباره fetch می‌کند) همیشه روی صفحه است، مستقلِ تبِ جاری — پس باید
  // اینجا صریحاً دوباره بارگذاری شود، وگرنه اعلان‌های شعبه‌ی قبلی تا
  // لاگینِ بعدی روی صفحه می‌مانند حتی با وجودِ ریست‌شدنِ _notifsLoaded.
  if(typeof loadNotifications==='function' && API.getToken()){
    loadNotifications().then(ok=>{ if(ok && typeof renderNotifList==='function') renderNotifList(); });
  }
  toast('','شعبه عوض شد');
}
function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  const open=sb.classList.toggle('open');
  document.getElementById('sbOverlay').classList.toggle('show');
  // aria-expanded باید با وضعیتِ واقعی همگام بماند وگرنه به screen-reader اطلاعِ غلط می‌دهد.
  document.querySelector('.tb-burger')?.setAttribute('aria-expanded', String(open));
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sbOverlay').classList.remove('show');
  document.querySelector('.tb-burger')?.setAttribute('aria-expanded','false');
}
// toggleStatus حذف شد (فازِ ۲، §۳): هیچ مسیرِ سروری‌ای برایِ نوشتنِ وضعیتِ
// باز/بسته وجود ندارد، پس دکمه فقط یک ادعایِ محلیِ نادرست می‌ساخت. نشان حالا
// در renderBranchSwitcher از دادهٔ سرور پر می‌شود. ساعتِ کاریِ واقعی از تبِ
// «پروفایل» → ساعاتِ کاری مدیریت می‌شود (که مسیرِ تأییدِ سروری دارد).

// ═══════════ OVERVIEW ═══════════


// ── فعال‌سازیِ کیبورد برایِ عناصرِ role="button" ──
// (یافته‌ی ممیزیِ ۲۰۲۶-۰۸-۲۴: اپِ مشتری این هندلرِ سراسری را داشت ولی پنل‌ها
// نه — یعنی هر divِ کلیک‌پذیر، حتی با tabindex، با Enter/Space کار نمی‌کرد.)
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target && e.target.closest ? e.target.closest('[role="button"]') : null;
  if (el && el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.tagName !== 'INPUT') { e.preventDefault(); el.click(); }
});
