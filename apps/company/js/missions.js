// ═══ رزرونو — پنل company: ماموریت‌هایِ پلتفرم (Company Control Plane، فازِ ۳) ═══
// CRUDِ خودِ رکوردِ Mission — بدونِ تغییر در updateMissionProgressTx/claimMission
// (منطقِ پیشرفتِ کاربر در lib/missions.ts دست‌نخورده می‌ماند).
let MISSIONS_LIST = [];
const MISSION_KIND_FA = { weekly:'هفتگی', seasonal:'فصلی', onboarding:'خوش‌آمدگویی', recovery:'بازگشت', general:'عمومی' };

function rMissions(){
  document.getElementById('v-missions').innerHTML=`<div style="text-align:center;padding:60px;color:var(--t2)">در حال بارگذاری...</div>`;
  loadMissions();
}
async function loadMissions(){
  const res = await API.listMissions();
  if(!res.ok){
    document.getElementById('v-missions').innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">${icon('alert',{size:16})} اتصال به سرور برقرار نشد — این صفحه بدون بک‌اند کار نمی‌کنه.</div>`;
    return;
  }
  MISSIONS_LIST = res.data.items || [];
  renderMissions();
}
function renderMissions(){
  document.getElementById('v-missions').innerHTML=`
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">${icon('check',{size:16})} ماموریت‌هایِ پلتفرم</div><div class="panel-sub">ماموریت‌هایِ سراسری (بدونِ رستورانِ خاص) و مختصِ یک رستوران</div></div>
        <button class="btn btn-primary btn-sm" onclick="openMissionModal()">${icon('plus',{size:14})} ماموریتِ جدید</button>
      </div>
      ${MISSIONS_LIST.length?`<div class="mini-list">${MISSIONS_LIST.map(m=>`
        <div class="mini-row">
          <div class="mini-ava">${icon('check',{size:16})}</div>
          <div class="mini-info">
            <div class="mini-name">${esc(m.title)} <span class="badge ${m.status==='active'?'active':'expired'}">${m.status==='active'?'فعال':'آرشیوشده'}</span></div>
            <div class="mini-sub">${esc(MISSION_KIND_FA[m.kind]||m.kind)} · هدف: ${fa(m.targetCount)} · XP: ${fa(m.xpReward)} · سکه: ${fa(m.walletReward)}${m.restaurantId?'':' · سراسری'}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" data-mid="${esc(m.id)}" onclick="openMissionModal(this.dataset.mid)">ویرایش</button>
            <button class="btn btn-sm" data-mid="${esc(m.id)}" data-status="${m.status}" onclick="toggleMissionStatus(this.dataset.mid,this.dataset.status)">${m.status==='active'?'آرشیو':'فعال‌سازی'}</button>
          </div>
        </div>`).join('')}</div>`:`<div class="empty-state"><div class="empty-state-icon">${icon('check',{size:32})}</div><div class="empty-state-desc">هنوز ماموریتی تعریف نشده</div></div>`}
    </div>`;
}

function openMissionModal(id){
  const m = id ? MISSIONS_LIST.find(x=>x.id===id) : null;
  openModal(`
    <div class="modal-title">${m?'ویرایشِ ماموریت':'ماموریتِ جدید'}</div>
    <div class="field-label">عنوان</div>
    <input class="inp" id="msTitle" placeholder="مثلاً «۳ رزرو این هفته»" value="${m?esc(m.title):''}">
    <div class="field-label">توضیح (اختیاری)</div>
    <textarea class="inp" id="msDesc" rows="2">${m?esc(m.description||''):''}</textarea>
    ${m?'':`<div class="field-label">نوع</div>
    <select class="inp" id="msKind">
      ${Object.entries(MISSION_KIND_FA).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
    </select>`}
    <div class="field-label">هدف (تعداد)</div>
    <input class="inp" id="msTarget" type="number" min="1" value="${m?m.targetCount:1}">
    <div class="field-label">پاداشِ XP</div>
    <input class="inp" id="msXp" type="number" min="0" value="${m?m.xpReward:0}">
    <div class="field-label">پاداشِ سکه</div>
    <input class="inp" id="msWallet" type="number" min="0" value="${m?m.walletReward:0}">
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" data-mid="${m?esc(m.id):''}" onclick="submitMission(this.dataset.mid||null)">${m?'ذخیره':'ساختِ ماموریت'}</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
  `);
}
async function submitMission(id){
  const title=(document.getElementById('msTitle')?.value||'').trim();
  const description=(document.getElementById('msDesc')?.value||'').trim()||undefined;
  const target_count=+((document.getElementById('msTarget')?.value)||1);
  const xp_reward=+((document.getElementById('msXp')?.value)||0);
  const wallet_reward=+((document.getElementById('msWallet')?.value)||0);
  if(!title){toast('','عنوانِ ماموریت رو بنویس');return;}

  const res = id
    ? await API.updateMission(id,{title,description,target_count,xp_reward,wallet_reward})
    : await API.createMission({title,description,kind:document.getElementById('msKind')?.value||'general',target_count,xp_reward,wallet_reward});
  if(!res.ok){toast('',res.error?.message||'ذخیره ناموفق بود');return;}
  closeModal();
  toast('',id?'ماموریت به‌روزرسانی شد':'ماموریت ساخته شد');
  loadMissions();
}
async function toggleMissionStatus(id,current){
  const next = current==='active' ? 'archived' : 'active';
  if(!confirm(next==='archived'?'این ماموریت آرشیو بشه؟ دیگه به کاربرها نشون داده نمی‌شه.':'این ماموریت دوباره فعال بشه؟'))return;
  const res=await API.updateMission(id,{status:next});
  if(!res.ok){toast('',res.error?.message||'انجام نشد');return;}
  toast('','به‌روزرسانی شد');
  loadMissions();
}
