// ═══ رزرونو — پنل company: جزئیات رستوران + آنالیز پلتفرم (Vanilla JS، scope مشترک) ═══
function rDetail(){
  const r=currentRest;
  if(!r){nav('restaurants');return}
  let statusText=STATUS_LABEL[r.status];
  if(r.status==='active')statusText=r.daysLeft!=null?`فعال · ${fa(r.daysLeft)} روز مونده`:'فعال · نامحدود';
  else if(r.status==='expired'||r.status==='trial_expired')statusText=r.daysLeft!=null?`${fa(Math.abs(r.daysLeft))} روز منقضی`:'منقضی';
  else if(r.status==='expiring')statusText=`${fa(r.daysLeft)} روز تا انقضا`;
  else statusText=`آزمایشی · ${fa(r.daysLeft)} روز`;
  const badgeCls = r.status==='trial_expired' ? 'expired' : r.status;
  document.getElementById('v-detail').innerHTML=`
    <button class="back-btn" onclick="nav('restaurants')">${icon('arrowR',{size:15})} بازگشت به لیست</button>
    <div class="detail-hero">
      <div class="detail-logo" style="background:${esc(r.grad)}">${esc(r.logo)}</div>
      <div class="detail-info">
        <div class="detail-name">${esc(r.name)}</div>
        <div class="detail-meta">عضو از ${esc(r.joined)} · <span class="plan-badge ${esc(r.plan)}">${PLAN_LABEL[r.plan]}</span> · ${r.isOpen?`<span class="live-dot" aria-hidden="true"></span> باز`:`<span class="dot-closed" aria-hidden="true"></span> بسته`}</div>
      </div>
      <div class="detail-actions">
        <span class="badge ${badgeCls}" style="align-self:center"><span class="bdot"></span>${statusText}</span>
        ${r.provision_status && r.provision_status!=='ACTIVE' ? `<span class="badge ${r.provision_status==='PENDING_ACTIVATION'?'trial':'expired'}" style="align-self:center" title="وضعیتِ provisioning">${({PENDING_ACTIVATION:'در انتظارِ فعال‌سازی',SUSPENDED:'معلق',OFFBOARDED:'خارج‌شده'})[r.provision_status]||esc(r.provision_status)}</span>`:''}
        ${r.provision_status==='PENDING_ACTIVATION' ? `<button class="btn btn-ghost btn-sm" onclick="resendProvisionInvite(${jsq(r.id)},this)" aria-label="ارسالِ مجددِ دعوتِ اولین‌ورود">${icon('mail',{size:14})} ارسالِ مجددِ دعوت</button>`:''}
        <button class="btn btn-ghost btn-sm" onclick="toggleRestOpen(${jsq(r.id)})">${r.isOpen?`${icon('lock',{size:14})} غیرفعال کردن`:`${icon('check',{size:14})} فعال کردن`}</button>
        <button class="btn btn-primary btn-sm" onclick="openRenew(${jsq(r.id)})">${icon('refresh',{size:14})} مدیریت اشتراک</button>
      </div>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic ink">${icon('users',{size:17})}</div></div><div class="kpi-val">${fa(r.members)}</div><div class="kpi-label">عضو باشگاه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic violet">${icon('calendar',{size:17})}</div></div><div class="kpi-val">${fa(r.reservations)}</div><div class="kpi-label">کل رزروها</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">${icon('mail',{size:17})}</div></div><div class="kpi-val">${fa(r.sms)}</div><div class="kpi-label">پیامک ارسالی</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic green">${icon('phone',{size:17})}</div></div><div class="kpi-val">${fa(r.smsBalance||0)}</div><div class="kpi-label">موجودی پیامک</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">جزئیات بیشتر</div></div></div>
      <div style="font-size:13px;color:var(--t2);line-height:2">
        برای دیدن لیست تک‌تک اعضای باشگاه، رفتار خرید و RFM این رستوران به‌صورت جداگانه، باید وارد
        <b style="color:var(--t1)">پنل خودِ همان رستوران</b> شوی — این داده‌ها برای حفظ حریم خصوصی مشتری‌ها در پنل شرکت به‌صورت جزء‌به‌جزء نمایش داده نمی‌شن.
        خلاصه‌ی تجمیعی (RFM/CLV) همه‌ی رستوران‌ها رو می‌تونی توی صفحه‌ی «هوش تجاری مشتریان» ببینی.
      </div>
      <button class="btn btn-ghost btn-block" style="margin-top:14px" onclick="nav('customers')">رفتن به هوش تجاری مشتریان ${icon('arrowL',{size:13})}</button>
    </div>
    <div class="panel" id="credPanel">
      <div class="panel-head"><div>
        <div class="panel-title">${icon('lock',{size:16})} دسترسی پنل رستوران</div>
        <div class="panel-sub">نام کاربری و رمز برای ورودِ این رستوران به پنلِ خودش</div>
      </div></div>
      <div id="credBody" style="font-size:13px;color:var(--t2)">در حال بارگذاری…</div>
    </div>`;
  loadCredentials(r.id);
}

// ═══════════ اعتبارنامه‌ی پنلِ رستوران (مهاجرتِ ۰۷۴) ═══════════
// ⚠️ چرا این بخش وجود دارد: تنها راهِ ورود به پنل‌ها OTPِ پیامکی بود و
// بدونِ کلیدِ کاوه‌نگار هیچ رستورانی نمی‌توانست وارد شود. حالا شرکت برایشان
// یوزر/پسورد می‌سازد و ورود به پیامک وابسته نیست.
//
// ⚠️ رمز **هرگز** از سرور خوانده نمی‌شود — سرور فقط می‌گوید «رمز دارد یا نه».
// یعنی این صفحه نمی‌تواند رمزِ فعلی را نشان دهد، فقط رمزِ تازه ست کند.
async function loadCredentials(restaurantId){
  const box = document.getElementById('credBody');
  if (!box) return;
  const res = await API.staffCredentials(restaurantId);
  if (!res.ok) {
    box.innerHTML = `<div class="empty-state-title">فهرست دسترسی‌ها بارگذاری نشد</div>
      <div style="margin-top:6px">${esc(res.error?.message || 'خطای ناشناخته')}</div>`;
    return;
  }
  const rows = (res.data?.staff || []).map(sf => `
    <tr>
      <td>${esc(sf.name || '—')}</td>
      <td>${sf.username ? `<code>${esc(sf.username)}</code>` : '<span style="color:var(--t3)">ندارد</span>'}</td>
      <td>${esc(sf.role)}</td>
      <td>${sf.has_password ? `${icon('check',{size:13})} دارد` : '<span style="color:var(--t3)">ندارد</span>'}</td>
      <td>${sf.is_active ? 'فعال' : 'غیرفعال'}</td>
    </tr>`).join('');
  box.innerHTML = `
    ${rows ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr>
        <th>نام</th><th>نام کاربری</th><th>نقش</th><th>رمز</th><th>وضعیت</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`
      : '<div style="margin-bottom:10px">هنوز هیچ کاربری برای این رستوران ثبت نشده.</div>'}
    <div style="margin-top:16px;display:grid;gap:10px">
      <div class="panel-title" style="font-size:14px">ساخت / تغییر دسترسی</div>
      <label class="login-field-label" for="credName">نام مسئول</label>
      <input class="login-inp" id="credName" placeholder="مثلاً: علی رضایی">
      <label class="login-field-label" for="credPhone">شماره موبایل</label>
      <input class="login-inp" id="credPhone" inputmode="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹">
      <label class="login-field-label" for="credUser">نام کاربری</label>
      <input class="login-inp" id="credUser" spellcheck="false" placeholder="فقط حروف انگلیسی، رقم، نقطه، خط تیره">
      <label class="login-field-label" for="credPass">رمز عبور</label>
      <input class="login-inp" id="credPass" type="password" autocomplete="new-password" placeholder="حداقل ۸ کاراکتر">
      <button class="btn btn-primary btn-block" id="credSaveBtn" onclick="saveCredentials(${jsq(String(restaurantId))})">ذخیره‌ی دسترسی</button>
      <div style="font-size:12px;color:var(--t3);line-height:1.9">
        اگر این شماره از قبل ثبت شده باشد، فقط نام کاربری و رمزش عوض می‌شود و کاربرِ تکراری ساخته نمی‌شود.
        رمز را جای امنی نگه دار — بعد از ذخیره دیگر قابلِ دیدن نیست.
      </div>
    </div>`;
}

async function saveCredentials(restaurantId){
  const name = (document.getElementById('credName')?.value||'').trim();
  const phoneRaw = (document.getElementById('credPhone')?.value||'').trim();
  const username = (document.getElementById('credUser')?.value||'').trim();
  const password = document.getElementById('credPass')?.value||'';
  // ارقامِ فارسی را به انگلیسی برگردان — همان کاری که فرمِ ورود می‌کند.
  const phone = phoneRaw.replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'');
  if (!/^09\d{9}$/.test(phone)) { toast('','شماره موبایل معتبر وارد کن'); return; }
  if (!username) { toast('','نام کاربری را وارد کن'); return; }
  if (password.length < 8) { toast('','رمز باید حداقل ۸ کاراکتر باشد'); return; }

  const btn = document.getElementById('credSaveBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'در حال ذخیره…'; }
  const res = await API.setStaffCredentials({
    restaurant_id: restaurantId, phone, username, password,
    ...(name ? { name } : {}),
  });
  if (btn){ btn.disabled = false; btn.textContent = 'ذخیره‌ی دسترسی'; }
  if (!res.ok) { toast('', res.error?.message || 'ذخیره نشد'); return; }
  toast('', res.data?.created ? 'دسترسی ساخته شد' : 'دسترسی به‌روز شد');
  await loadCredentials(restaurantId);
}
async function toggleRestOpen(id){
  const r=RESTAURANTS.find(x=>String(x.id)===String(id));if(!r)return;
  const action = r.isOpen ? 'deactivate' : 'activate';
  const res = await API.control(id, { action });
  if(res.ok){
    r.isOpen = res.data.is_open;
    toast('', r.isOpen?'رستوران فعال شد':'رستوران غیرفعال شد');
    rDetail();
  } else {
    toast('', res.error?.message || 'عملیات ناموفق بود');
  }
}

// ════════ آنالیز سراسری (همه‌ی رستوران‌ها) ════════
function rAnalytics(){
  const totalMembers=RESTAURANTS.reduce((s,r)=>s+r.members,0);
  const totalRes=RESTAURANTS.reduce((s,r)=>s+r.reservations,0);
  const totalSmsBalance=RESTAURANTS.reduce((s,r)=>s+(r.smsBalance||0),0);
  const topByMembers=[...RESTAURANTS].sort((a,b)=>b.members-a.members).slice(0,5);
  const topByRes=[...RESTAURANTS].sort((a,b)=>b.reservations-a.reservations).slice(0,5);
  const planDist={};RESTAURANTS.forEach(r=>{planDist[r.plan]=(planDist[r.plan]||0)+1});
  document.getElementById('v-analytics').innerHTML=`
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic ink">${icon('users',{size:17})}</div></div><div class="kpi-val">${fa(totalMembers)}</div><div class="kpi-label">کل اعضای باشگاه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic violet">${icon('calendar',{size:17})}</div></div><div class="kpi-val">${fa(totalRes)}</div><div class="kpi-label">کل رزروها</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic amber">${icon('phone',{size:17})}</div></div><div class="kpi-val">${fa(totalSmsBalance)}</div><div class="kpi-label">موجودی پیامک کل</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-ic green">${icon('store',{size:17})}</div></div><div class="kpi-val">${fa(PLATFORM_STATS?.subscription_breakdown?.active ?? RESTAURANTS.filter(r=>r.status==='active').length)}</div><div class="kpi-label">رستوران فعال در پلتفرم</div></div>
    </div>
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-head"><div><div class="panel-title">توزیع پلن‌ها</div><div class="panel-sub">چند رستوران روی هر پلن هستن</div></div></div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${Object.entries(planDist).map(([p,c])=>`<div style="display:flex;align-items:center;gap:12px"><span style="width:100px;font-size:13px;font-weight:600">${PLAN_LABEL[p]||p}</span><div style="flex:1;height:10px;background:var(--s-100);border-radius:5px;overflow:hidden"><div style="height:100%;width:${RESTAURANTS.length?c/RESTAURANTS.length*100:0}%;background:var(--ink);border-radius:5px"></div></div><span style="font-weight:800;font-size:14px;width:24px;text-align:left">${fa(c)}</span></div>`).join('')}
      </div>
    </div>
    <div class="row-2">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">برترین بر اساس باشگاه</div></div>
        ${topByMembers.map((r,i)=>`<div class="list-stat" style="cursor:pointer" onclick="openRest(${jsq(r.id)})"><div class="ls-rank">${fa(i+1)}</div><div class="rest-logo" style="background:${esc(r.grad)};width:34px;height:34px;font-size:15px">${esc(r.logo)}</div><div class="ls-info"><div class="ls-name">${esc(r.name)}</div><div class="ls-meta">${fa(r.reservations)} رزرو</div></div><div class="ls-val">${fa(r.members)}</div></div>`).join('')}
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">برترین بر اساس رزرو</div></div>
        ${topByRes.map((r,i)=>`<div class="list-stat" style="cursor:pointer" onclick="openRest(${jsq(r.id)})"><div class="ls-rank">${fa(i+1)}</div><div class="rest-logo" style="background:${esc(r.grad)};width:34px;height:34px;font-size:15px">${esc(r.logo)}</div><div class="ls-info"><div class="ls-name">${esc(r.name)}</div><div class="ls-meta">${fa(r.members)} عضو</div></div><div class="ls-val">${fa(r.reservations)}</div></div>`).join('')}
      </div>
    </div>`;
}

// ════════ هوش تجاری مشتریان — تجمیعی و واقعی، از /admin/business-intelligence ════════

// ═══════════ SPEC-B — ارسالِ مجددِ دعوتِ اولین‌ورود (وضعیتِ PENDING) ═══════════
// چهار حالت: loading (قفلِ دکمه) / error (toast با پیامِ سرور) / success
// (toast با ماسکِ شماره). دکمه فقط برای رستورانِ PENDING_ACTIVATION رندر می‌شود.
async function resendProvisionInvite(id, btn){
  const label = btn ? btn.innerHTML : '';
  if(btn){ btn.disabled = true; btn.textContent = 'در حالِ ارسال…'; }
  const res = await API.adminResendInvite(id);
  if(btn){ btn.disabled = false; btn.innerHTML = label; }
  if(res.ok){
    toast('', `دعوتِ تازه به ${res.data?.invite_sent_to || 'مالک'} ارسال شد`);
  } else {
    toast('', res.error?.message || (res.offline ? 'اتصال به سرور برقرار نشد' : 'ارسالِ دعوت ناموفق بود'));
  }
}
