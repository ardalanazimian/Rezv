// ═══ رزرونو — پنل company: نشان‌هایِ کنترل‌شده‌یِ پلتفرم (Company Control Plane، فازِ ۳) ═══
// کاملاً جدا از BADGES قدیمیِ اپِ کاستومر (emojiِ نمایشی، بدونِ رکوردِ سرور)؛
// این‌ها را فقط ادمینِ پلتفرم تعریف/اعطا/لغو می‌کند (رجوع کن به schema.prisma
// برایِ توضیحِ کامل + یادداشتِ «آماده‌یِ بلاکچین»).
let BADGES_LIST = [];

function rBadges(){
  document.getElementById('v-badges').innerHTML=`<div style="text-align:center;padding:60px;color:var(--t2)">در حال بارگذاری...</div>`;
  loadBadges();
}
async function loadBadges(){
  const res = await API.listBadges();
  if(!res.ok){
    document.getElementById('v-badges').innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">${icon('alert',{size:16})} اتصال به سرور برقرار نشد — این صفحه بدون بک‌اند کار نمی‌کنه.</div>`;
    return;
  }
  BADGES_LIST = res.data.items || [];
  renderBadges();
}
function renderBadges(){
  document.getElementById('v-badges').innerHTML=`
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-head"><div><div class="panel-title">${icon('sparkle',{size:16,fill:true})} نشان‌هایِ کنترل‌شده‌یِ پلتفرم</div><div class="panel-sub">این‌ها فقط با تصمیمِ دستیِ ادمین اعطا می‌شن — جدا از نشان‌هایِ خودکارِ اپ</div></div>
        <button class="btn btn-primary btn-sm" onclick="openCreateBadgeModal()">${icon('plus',{size:14})} نشانِ جدید</button>
      </div>
      ${BADGES_LIST.length?`<div class="tier-grid">${BADGES_LIST.map(b=>`
        <div class="tier-card" style="--tier-fg:${esc(b.color||'#7C3AED')}${b.isActive?'':';opacity:.55'}">
          <div class="tier-ic">${icon(b.icon||'star',{size:18})}</div>
          <div class="tier-name">${esc(b.name)}${b.isActive?'':' <span class="badge">غیرفعال</span>'}</div>
          <div class="tier-meta mono-ip">${esc(b.key)}</div>
          ${b.description?`<div class="tier-meta">${esc(b.description)}</div>`:''}
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;justify-content:center">
            <button class="btn btn-sm" data-bid="${esc(b.id)}" data-bname="${esc(b.name)}" onclick="openGrantBadgeModal(this.dataset.bid,this.dataset.bname)">اعطا</button>
            <button class="btn btn-sm" data-bid="${esc(b.id)}" data-bname="${esc(b.name)}" onclick="openRevokeBadgeModal(this.dataset.bid,this.dataset.bname)">لغو</button>
            <button class="btn btn-ghost btn-sm" data-bid="${esc(b.id)}" onclick="toggleBadgeActive(this.dataset.bid)">${b.isActive?'غیرفعال‌کردن':'فعال‌کردن'}</button>
          </div>
        </div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-state-icon">${icon('sparkle',{size:32,fill:true})}</div><div class="empty-state-desc">هنوز نشانی تعریف نشده</div></div>`}
    </div>`;
}

function openCreateBadgeModal(){
  openModal(`
    <div class="modal-title">${icon('sparkle',{size:18,fill:true})} نشانِ جدید</div>
    <div class="field-label">کلید (فقط لاتین، مثلاً founding_member)</div>
    <input class="inp" id="bgKey" placeholder="founding_member">
    <div class="field-label">نام نمایشی</div>
    <input class="inp" id="bgName" placeholder="مثلاً عضوِ بنیان‌گذار">
    <div class="field-label">توضیح (اختیاری)</div>
    <textarea class="inp" id="bgDesc" rows="2" placeholder="این نشان یعنی چی"></textarea>
    <div class="field-label">آیکون (اختیاری — نامِ آیکون از مجموعه‌ی رزرونو)</div>
    <input class="inp" id="bgIcon" placeholder="star" value="star">
    <div class="field-label">رنگ (اختیاری — hex)</div>
    <input class="inp" id="bgColor" placeholder="#7C3AED">
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" onclick="submitCreateBadge()">ساختِ نشان</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  `);
}
async function submitCreateBadge(){
  const key=(document.getElementById('bgKey')?.value||'').trim();
  const name=(document.getElementById('bgName')?.value||'').trim();
  const description=(document.getElementById('bgDesc')?.value||'').trim()||undefined;
  const iconName=(document.getElementById('bgIcon')?.value||'').trim()||undefined;
  const color=(document.getElementById('bgColor')?.value||'').trim()||undefined;
  if(!key||!name){toast('','کلید و نام رو وارد کن');return;}
  const res=await API.createBadge({key,name,description,icon:iconName,color});
  if(!res.ok){toast('',res.error?.message||'ساختِ نشان ناموفق بود');return;}
  closeModal();
  toast('','نشان ساخته شد');
  loadBadges();
}
async function toggleBadgeActive(id){
  const b=BADGES_LIST.find(x=>x.id===id);if(!b)return;
  if(!confirm(`${b.isActive?'غیرفعال':'فعال'}‌کردنِ نشانِ «${b.name}»؟`))return;
  const res=await API.updateBadge(id,{is_active:!b.isActive});
  if(!res.ok){toast('',res.error?.message||'انجام نشد');return;}
  toast('','به‌روزرسانی شد');
  loadBadges();
}

// ── اعطا/لغو: جست‌وجویِ کاربر با شماره/شناسه (بازاستفاده از همون customer360) قبل از اقدام ──
async function resolveUserForBadge(query){
  const q=(query||'').trim();
  if(!q){toast('','شماره‌موبایل یا شناسه‌ی کاربر رو وارد کن');return null;}
  const res=await API.customer360(q);
  if(!res.ok){toast('',res.error?.message||'کاربر پیدا نشد');return null;}
  return res.data.user;
}
function openGrantBadgeModal(badgeId,badgeName){
  openModal(`
    <div class="modal-title">اعطایِ «${esc(badgeName)}»</div>
    <div class="field-label">شماره‌موبایل یا شناسه‌ی کاربر</div>
    <input class="inp" id="bgGrantQuery" placeholder="۰۹۱۲۳۴۵۶۷۸۹">
    <div class="field-label">یادداشت (اختیاری)</div>
    <input class="inp" id="bgGrantNote" placeholder="مثلاً دلیلِ اعطا">
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-bid="${esc(badgeId)}" onclick="submitGrantBadge(this.dataset.bid)">اعطا</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  `);
}
async function submitGrantBadge(badgeId){
  const user=await resolveUserForBadge(document.getElementById('bgGrantQuery')?.value);
  if(!user)return;
  const note=(document.getElementById('bgGrantNote')?.value||'').trim()||undefined;
  const name=[user.first_name,user.last_name].filter(Boolean).join(' ')||user.phone;
  if(!confirm(`این نشان به «${name}» اعطا بشه؟`))return;
  const res=await API.grantBadge(badgeId,user.id,note);
  if(!res.ok){toast('',res.error?.message||'اعطا ناموفق بود');return;}
  closeModal();
  toast('',res.data?.already_granted?'این کاربر از قبل این نشان رو داشت':'نشان اعطا شد');
}
function openRevokeBadgeModal(badgeId,badgeName){
  openModal(`
    <div class="modal-title">لغوِ «${esc(badgeName)}»</div>
    <div class="field-label">شماره‌موبایل یا شناسه‌ی کاربر</div>
    <input class="inp" id="bgRevokeQuery" placeholder="۰۹۱۲۳۴۵۶۷۸۹">
    <div class="field-label">دلیل (اختیاری)</div>
    <input class="inp" id="bgRevokeReason" placeholder="مثلاً اشتباه بود">
    <button class="btn btn-danger btn-block btn-lg" style="margin-top:14px" data-bid="${esc(badgeId)}" onclick="submitRevokeBadge(this.dataset.bid)">لغوِ نشان</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  `);
}
async function submitRevokeBadge(badgeId){
  const user=await resolveUserForBadge(document.getElementById('bgRevokeQuery')?.value);
  if(!user)return;
  const reason=(document.getElementById('bgRevokeReason')?.value||'').trim()||undefined;
  const name=[user.first_name,user.last_name].filter(Boolean).join(' ')||user.phone;
  if(!confirm(`این نشان از «${name}» لغو بشه؟`))return;
  const res=await API.revokeBadge(badgeId,user.id,reason);
  if(!res.ok){toast('',res.error?.message||'لغو ناموفق بود');return;}
  closeModal();
  toast('',res.data?.already_revoked?'این کاربر این نشان رو نداشت':'نشان لغو شد');
}
