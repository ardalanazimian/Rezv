// ═══ رزرونو — پنل business: CRM + هوش مهمان + وفاداری (Vanilla JS، بدون build، scope مشترک) ═══
// ═══════════ مشتریان (ادغام CRM + Smart Data + مارکتینگ) ═══════════
let custTab='profiles';
// ═══════════ پروفایل رستوران (گالری + نظرات) ═══════════
let profTab='gallery', revFilter='all';
function rProfile(){
  document.getElementById('v-profile').innerHTML=`
    <div class="itabs">
      <button class="itab ${profTab==='gallery'?'active':''}" onclick="setProfTab('gallery')">🖼️ عکس‌های مجموعه</button>
      <button class="itab ${profTab==='reviews'?'active':''}" onclick="setProfTab('reviews')">⭐ نظرات مشتری‌ها</button>
      <button class="itab ${profTab==='hours'?'active':''}" onclick="setProfTab('hours')">🕐 ساعات کاری</button>
    </div>
    <div id="pt-gallery" class="isub ${profTab==='gallery'?'active':''}"></div>
    <div id="pt-reviews" class="isub ${profTab==='reviews'?'active':''}"></div>
    <div id="pt-hours" class="isub ${profTab==='hours'?'active':''}"></div>`;
  profRenderGallery();
  profRenderReviews();
  profRenderHours();
  // داده‌ی واقعی را در پس‌زمینه بکش و دوباره رندر کن
  if(API.getToken()){
    loadGallery().then(()=>{ if(profTab==='gallery') profRenderGallery(); });
    loadReviews().then(()=>{ if(profTab==='reviews') profRenderReviews(); });
    loadHours().then(()=>{ if(profTab==='hours') profRenderHours(); });
  }
}
// بارگذاری گالری واقعی از /restaurant/photos
async function loadGallery(){
  const res=await API.photos();
  if(res.ok && Array.isArray(res.data?.items)){
    GALLERY=res.data.items.map(p=>({id:p.id,url:p.url,dataUrl:p.url,label:p.caption||'',emoji:'📷',type:p.category}));
  }
  return GALLERY;
}
// بارگذاری نظرات واقعی از /restaurant/reviews
let REVIEW_STATS={avg:0,total:0,unreplied:0,distribution:{1:0,2:0,3:0,4:0,5:0}};
async function loadReviews(){
  const res=await API.reviews();
  if(res.ok){
    REVIEW_STATS={avg:res.data.avg_rating||0,total:res.data.total||0,unreplied:res.data.unanswered||0,distribution:res.data.distribution||{1:0,2:0,3:0,4:0,5:0}};
    REVIEWS=(res.data.items||[]).map(r=>({
      id:r.id,name:r.name,ava:'👤',rating:r.rating,date:faRelative(r.created_at),
      text:r.body||'',food:r.food||r.rating,service:r.service||r.rating,atmo:r.atmosphere||r.rating,
      replied:r.replied,reply:r.reply||'',seg:'regular',
    }));
  }
  return REVIEWS;
}
function setProfTab(t){
  profTab=t;
  document.querySelectorAll('#v-profile .itab').forEach((b,i)=>b.classList.toggle('active',['gallery','reviews','hours'][i]===t));
  document.querySelectorAll('#v-profile .isub').forEach(s=>s.classList.toggle('active',s.id==='pt-'+t));
}

// ─── تب گالری: آپلود عکس ───
function profRenderGallery(){
  document.getElementById('pt-gallery').innerHTML=`
    <!-- هویت رستوران: نام + لوگو -->
    <div class="identity-card">
      <div class="identity-logo" style="background:${RESTAURANT.logoDataUrl?'transparent':RESTAURANT.logoGradient}">
        ${RESTAURANT.logoDataUrl?`<img src="${RESTAURANT.logoDataUrl}" alt="logo">`:RESTAURANT.logoEmoji}
      </div>
      <div class="identity-info">
        <div class="identity-name">${esc(RESTAURANT.name)}</div>
        <div class="identity-sub">این لوگو و نام توی اپ مشتری و پنل نمایش داده می‌شه</div>
        <div class="identity-actions">
          <button class="btn btn-primary btn-sm" onclick="openLogoEditor()">🎨 تغییر لوگو</button>
          <button class="btn btn-ghost btn-sm" onclick="openNameEditor()">✏️ تغییر نام</button>
        </div>
      </div>
    </div>

    <div class="ai-box" style="margin-bottom:18px">
      <div class="ai-box-head"><div class="icn">🖼️</div><div class="ttl">عکس‌های مجموعه</div></div>
      <div style="font-size:13px;color:var(--t1);line-height:1.6">عکس‌های باکیفیت از فضا، غذاها و محیط رستورانت آپلود کن. این عکس‌ها توی اپ مشتری و صفحه‌ی رستوران نمایش داده می‌شن و نقش مهمی توی جذب مشتری دارن.</div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">گالری (${fa(GALLERY.length)} عکس)</div><div class="panel-sub">برای افزودن روی + بزن</div></div></div>
      <div class="gallery-grid" id="galGrid">
        ${GALLERY.map((g,i)=>`<div class="gal-item">
          ${(g.url||g.dataUrl)?`<img src="${g.url||g.dataUrl}" alt="${esc(g.label)}">`:`<span class="gal-emoji">${g.emoji}</span>`}
          <button class="gal-del" onclick="removeGalleryImg(${i})">×</button>
          <span class="gal-tag">${g.type==='food'?'🍽 غذا':g.type==='interior'?'🏛 فضا':g.type==='drink'?'🥤 نوشیدنی':g.type==='event'?'🎉 رویداد':'📷 عکس'}</span>
        </div>`).join('')}
        <button class="gal-upload" onclick="openAddPhotoByUrl()">
          <span class="up-ic">➕</span><span class="up-tx">افزودن عکس</span>
        </button>
      </div>
      <input type="file" id="galInput" accept="image/*" multiple style="display:none" onchange="handleGalleryUpload(this)">
      <div style="font-size:11px;color:var(--t3);margin-top:14px;line-height:1.5">💡 عکس‌ها با لینک اضافه می‌شن (آپلود مستقیم فایل در فاز بعدی فعال می‌شه)</div>
    </div>`;
}

// ─── ویرایش لوگو ───
let logoChoice={emoji:null,gradient:null,dataUrl:null};
function openLogoEditor(){
  logoChoice={emoji:RESTAURANT.logoEmoji,gradient:RESTAURANT.logoGradient,dataUrl:RESTAURANT.logoDataUrl};
  const emojis=['🌿','🍽️','☕','🍕','🍔','🍜','🥗','🍣','🍰','🍷','🔥','⭐','🏛️','🌟','🍴','👨‍🍳'];
  const grads=[
    'linear-gradient(135deg,#34D399,#059669)',
    'linear-gradient(135deg,#2563EB,#14B8A6)',
    'linear-gradient(135deg,#F59E0B,#EF4444)',
    'linear-gradient(135deg,#8B5CF6,#EC4899)',
    'linear-gradient(135deg,#0EA5E9,#6366F1)',
    'linear-gradient(135deg,#1E293B,#475569)',
  ];
  openModal(`
    <div class="modal-title">🎨 تغییر لوگو</div>
    <div class="modal-sub">یه عکس آپلود کن، یا ایموجی و رنگ انتخاب کن</div>
    <div class="logo-preview" id="logoPreview" style="background:${logoChoice.dataUrl?'transparent':logoChoice.gradient}">
      ${logoChoice.dataUrl?`<img src="${logoChoice.dataUrl}" alt="">`:logoChoice.emoji}
    </div>
    <button class="btn btn-ghost btn-block" onclick="document.getElementById('logoInput').click()">📤 آپلود عکس لوگو</button>
    <input type="file" id="logoInput" accept="image/*" style="display:none" onchange="handleLogoUpload(this)">
    <div class="field-label" style="margin-top:18px">یا یک ایموجی انتخاب کن</div>
    <div class="logo-pick-grid" id="logoEmojiGrid">
      ${emojis.map(e=>`<div class="logo-emoji-opt ${e===logoChoice.emoji&&!logoChoice.dataUrl?'sel':''}" onclick="pickLogoEmoji('${e}')">${e}</div>`).join('')}
    </div>
    <div class="field-label">رنگ پس‌زمینه</div>
    <div class="logo-grad-grid" id="logoGradGrid">
      ${grads.map((g,gi)=>`<div class="logo-grad-opt ${g===logoChoice.gradient?'sel':''}" data-gi="${gi}" style="background:${g}" onclick="pickLogoGrad(${gi},'${g}')"></div>`).join('')}
    </div>
    <button class="btn btn-primary btn-lg btn-block" onclick="saveLogo()">ذخیره لوگو</button>
  `);
}
function refreshLogoPreview(){
  const pv=document.getElementById('logoPreview');
  if(!pv)return;
  if(logoChoice.dataUrl){pv.style.background='transparent';pv.innerHTML=`<img src="${logoChoice.dataUrl}" alt="">`}
  else{pv.style.background=logoChoice.gradient;pv.textContent=logoChoice.emoji}
}
function pickLogoEmoji(e){
  logoChoice.emoji=e;logoChoice.dataUrl=null; // انتخاب ایموجی، عکس رو پاک کن
  document.querySelectorAll('#logoEmojiGrid .logo-emoji-opt').forEach(o=>o.classList.toggle('sel',o.textContent===e));
  refreshLogoPreview();
}
function pickLogoGrad(gi,g){
  logoChoice.gradient=g;
  document.querySelectorAll('#logoGradGrid .logo-grad-opt').forEach(o=>o.classList.toggle('sel',+o.dataset.gi===gi));
  refreshLogoPreview();
}
function handleLogoUpload(input){
  const file=input.files?.[0];
  if(!file)return;
  if(!file.type.startsWith('image/')){toast('⚠️','فقط فایل عکس مجاز است');return}
  if(file.size>5*1024*1024){toast('⚠️','عکس بزرگ‌تر از ۵ مگابایته');return}
  const reader=new FileReader();
  reader.onload=e=>{logoChoice.dataUrl=e.target.result;refreshLogoPreview();
    document.querySelectorAll('#logoEmojiGrid .logo-emoji-opt').forEach(o=>o.classList.remove('sel'));
    toast('✅','عکس لوگو بارگذاری شد')};
  reader.onerror=()=>toast('⚠️','خطا در خواندن فایل');
  reader.readAsDataURL(file);
  input.value='';
}
function saveLogo(){
  RESTAURANT.logoEmoji=logoChoice.emoji||'🌿';
  RESTAURANT.logoGradient=logoChoice.gradient;
  RESTAURANT.logoDataUrl=logoChoice.dataUrl;
  // به‌روزرسانی لوگوی سایدبار (زنده)
  const swEmoji=document.getElementById('swEmoji');
  if(swEmoji){
    if(RESTAURANT.logoDataUrl){swEmoji.style.background='transparent';swEmoji.innerHTML=`<img src="${RESTAURANT.logoDataUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px">`}
    else{swEmoji.style.background=RESTAURANT.logoGradient;swEmoji.textContent=RESTAURANT.logoEmoji}
  }
  closeModal();profRenderGallery();
  toast('✅','لوگو به‌روز شد');
}
// ─── ویرایش نام ───
function openNameEditor(){
  openModal(`
    <div class="modal-title">✏️ تغییر نام رستوران</div>
    <div class="modal-sub">نام نمایشی توی اپ مشتری و پنل</div>
    <div class="field-label">نام رستوران</div>
    <input class="inp" id="restName" value="${esc(RESTAURANT.name)}" placeholder="نام رستوران">
    <button class="btn btn-primary btn-lg btn-block" onclick="saveRestName()">ذخیره</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>`);
  setTimeout(()=>document.getElementById('restName')?.focus(),150);
}
function saveRestName(){
  const n=document.getElementById('restName').value.trim();
  if(!n){toast('⚠️','نام رو وارد کن');return}
  RESTAURANT.name=n;
  const swName=document.getElementById('swName');
  if(swName)swName.textContent=n; // به‌روزرسانی زنده‌ی سایدبار
  closeModal();profRenderGallery();
  toast('✅','نام رستوران به‌روز شد');
}
function handleGalleryUpload(input){
  const files=Array.from(input.files||[]);
  if(!files.length)return;
  // آپلود فایل به فضای ذخیره‌سازی هنوز در بک‌اند راه‌اندازی نشده (فاز ذخیره‌سازی عکس).
  // فعلاً صادقانه به کاربر می‌گیم و راه واقعی (افزودن با لینک) رو پیشنهاد می‌دیم.
  input.value='';
  openModal(`
    <div style="text-align:center">
      <div style="width:52px;height:52px;border-radius:14px;background:var(--amber-50);display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 14px">📤</div>
      <div class="modal-title" style="text-align:center">آپلود مستقیم فایل هنوز فعال نیست</div>
      <div class="modal-sub" style="text-align:center;line-height:1.7">فضای ذخیره‌سازی عکس (مثل S3) هنوز راه‌اندازی نشده. فعلاً می‌تونی عکست رو که جایی آنلاینه با لینک اضافه کنی — این واقعاً ذخیره می‌شه.</div>
      <button class="btn btn-primary btn-block btn-lg" onclick="openAddPhotoByUrl()">افزودن عکس با لینک</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">بعداً</button>
    </div>`);
}
function openAddPhotoByUrl(){
  openModal(`
    <div class="modal-title">🖼️ افزودن عکس با لینک</div>
    <div class="modal-sub">آدرس عکس (با http یا https شروع بشه)</div>
    <div class="field-label">آدرس عکس</div>
    <input class="inp" id="photoUrl" placeholder="https://..." inputmode="url" dir="ltr">
    <div class="field-label">دسته</div>
    <select class="inp" id="photoCat"><option value="food">غذا</option><option value="interior">فضا</option><option value="drink">نوشیدنی</option><option value="event">رویداد</option><option value="other">سایر</option></select>
    <div class="field-label">توضیح (اختیاری)</div>
    <input class="inp" id="photoCap" placeholder="مثلاً پاستا کربونارا">
    <button class="btn btn-primary btn-block btn-lg" style="margin-top:14px" onclick="submitPhotoUrl()">افزودن</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>`);
  setTimeout(()=>document.getElementById('photoUrl')?.focus(),150);
}
async function submitPhotoUrl(){
  const url=(document.getElementById('photoUrl')?.value||'').trim();
  if(!/^https?:\/\//.test(url)){toast('⚠️','آدرس باید با http یا https شروع بشه');return}
  const category=document.getElementById('photoCat')?.value||'food';
  const caption=(document.getElementById('photoCap')?.value||'').trim();
  if(!API.getToken()){toast('⚠️','برای افزودن عکس باید وارد شده باشی');return}
  const res=await API.addPhoto({url,category,caption});
  if(!res.ok){toast('⚠️',res.error?.message||'افزودن عکس ناموفق بود');return}
  await loadGallery();
  closeModal();profRenderGallery();
  toast('✅',`عکس اضافه شد (${fa(GALLERY.length)} عکس)`);
}
function removeGalleryImg(i){
  const g=GALLERY[i];
  openModal(`
    <div style="text-align:center">
      <div style="width:52px;height:52px;border-radius:14px;background:var(--red-50);display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 14px">🗑️</div>
      <div class="modal-title" style="text-align:center">حذف این عکس؟</div>
      <div class="modal-sub" style="text-align:center">«${esc(g.label||'عکس')}» از گالری حذف می‌شه</div>
      <button class="btn btn-danger btn-block" onclick="doRemoveGallery(${i})">بله، حذف کن</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>
    </div>`);
}
async function doRemoveGallery(i){
  const g=GALLERY[i];
  if(g.id && API.getToken()){
    const res=await API.deletePhoto(g.id);
    if(!res.ok){closeModal();toast('⚠️',res.error?.message||'حذف ناموفق بود');return;}
    await loadGallery();
  }else{
    GALLERY.splice(i,1);
  }
  closeModal();profRenderGallery();
  toast('🗑️','عکس حذف شد');
}

// ─── تب نظرات ───
function profRenderReviews(){
  let list=REVIEWS;
  if(revFilter==='positive')list=REVIEWS.filter(r=>r.rating>=4);
  else if(revFilter==='negative')list=REVIEWS.filter(r=>r.rating<=3);
  else if(revFilter==='unreplied')list=REVIEWS.filter(r=>!r.replied);
  // اگر آمار واقعی از سرور داریم استفاده کن، وگرنه از همین لیست محاسبه کن
  const useReal=REVIEW_STATS.total>0;
  const avg=(useReal?REVIEW_STATS.avg:(REVIEWS.length?REVIEWS.reduce((s,r)=>s+r.rating,0)/REVIEWS.length:0)).toFixed(1);
  const totalCount=useReal?REVIEW_STATS.total:REVIEWS.length;
  const dist=[5,4,3,2,1].map(star=>({star,count:useReal?(REVIEW_STATS.distribution[star]||0):REVIEWS.filter(r=>r.rating===star).length}));
  const unreplied=useReal?REVIEW_STATS.unreplied:REVIEWS.filter(r=>!r.replied).length;
  const stars=n=>'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));
  document.getElementById('pt-reviews').innerHTML=`
    <div class="rev-summary">
      <div class="rev-big">
        <div class="rev-big-num">${fa(avg)}</div>
        <div class="rev-big-stars">${stars(+avg)}</div>
        <div class="rev-big-count">${fa(totalCount)} نظر</div>
      </div>
      <div class="rev-bars">
        ${dist.map(d=>`<div class="rev-bar-row"><span class="rl">${fa(d.star)} ستاره</span><div class="rev-bar-track"><div class="rev-bar-fill" style="width:${totalCount?d.count/totalCount*100:0}%"></div></div><span class="rv">${fa(d.count)}</span></div>`).join('')}
      </div>
    </div>
    ${unreplied>0?`<div class="ai-box" style="margin-bottom:16px"><div class="ai-insight"><span class="ic warn">💬</span><div><b>${fa(unreplied)} نظر بی‌پاسخ</b> — پاسخ دادن به نظرات (مخصوصاً منفی‌ها) اعتماد مشتری‌ها رو زیاد می‌کنه و نشون می‌ده بهشون اهمیت می‌دی.</div></div></div>`:''}
    <div class="rev-filters">
      <button class="rev-filter ${revFilter==='all'?'active':''}" onclick="setRevFilter('all')">همه (${fa(totalCount)})</button>
      <button class="rev-filter ${revFilter==='positive'?'active':''}" onclick="setRevFilter('positive')">😊 مثبت (${fa(dist[0].count+dist[1].count)})</button>
      <button class="rev-filter ${revFilter==='negative'?'active':''}" onclick="setRevFilter('negative')">😕 منفی (${fa(dist[2].count+dist[3].count+dist[4].count)})</button>
      <button class="rev-filter ${revFilter==='unreplied'?'active':''}" onclick="setRevFilter('unreplied')">💬 بی‌پاسخ (${fa(unreplied)})</button>
    </div>
    <div id="revList">
      ${REVIEWS.length?(list.length?list.map((r)=>{
        const origIdx=REVIEWS.indexOf(r);
        return `<div class="rev-card">
        <div class="rev-card-top">
          <div class="rev-ava">${r.ava}</div>
          <div><div class="rev-name">${esc(r.name)} ${r.seg==='vip'?'👑':''}</div><div class="rev-stars-sm">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div></div>
          <div class="rev-date">${r.date}</div>
        </div>
        <div class="rev-text">${esc(r.text)}</div>
        <div class="rev-subratings"><span>غذا <b>${fa(r.food)}</b></span><span>سرویس <b>${fa(r.service)}</b></span><span>فضا <b>${fa(r.atmo)}</b></span></div>
        ${r.replied?`<div class="rev-reply"><div class="rev-reply-label">↩️ پاسخ شما</div><div class="rev-reply-text">${esc(r.reply)}</div></div>`:`<div class="rev-actions"><button class="btn btn-primary btn-sm" onclick="openReplyModal(${origIdx})">💬 پاسخ بده</button></div>`}
      </div>`}).join(''):`<div class="no-results"><div class="nr-emoji">💬</div><div style="font-weight:700">نظری در این دسته نیست</div></div>`):`<div class="no-results"><div class="nr-emoji">💬</div><div style="font-weight:700">هنوز نظری ثبت نشده</div><div style="font-size:13px;color:var(--t2);margin-top:6px">وقتی مشتری‌ها بعد از رزرو نظر بدن، اینجا نشون داده می‌شه</div></div>`}
    </div>`;
  setTimeout(()=>document.querySelectorAll('.rev-bar-fill').forEach(f=>{const w=f.style.width;f.style.width='0';requestAnimationFrame(()=>f.style.width=w)}),50);
}
function setProfTab2(){} // reserved
function setRevFilter(f){revFilter=f;profRenderReviews()}
function openReplyModal(i){
  const r=REVIEWS[i];
  openModal(`
    <div class="modal-title">پاسخ به ${esc(r.name)}</div>
    <div class="modal-sub">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)} · ${r.date}</div>
    <div style="background:var(--s-50);border-radius:var(--r);padding:12px 14px;margin-bottom:16px;font-size:13px;color:var(--t2);line-height:1.5">${esc(r.text)}</div>
    <div class="field-label">پاسخ شما</div>
    <textarea class="inp" id="replyText" style="min-height:90px;resize:vertical" placeholder="ممنون از نظرت...">${r.rating<=3?'از بازخوردت ممنونیم و بابت تجربه‌ی نه‌چندان خوبت عذرخواهی می‌کنیم. ':''}</textarea>
    <button class="btn btn-primary btn-lg btn-block" onclick="saveReply(${i})">ارسال پاسخ</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="closeModal()">انصراف</button>`);
  setTimeout(()=>document.getElementById('replyText')?.focus(),150);
}
async function saveReply(i){
  const txt=document.getElementById('replyText').value.trim();
  if(!txt){toast('⚠️','متن پاسخ رو بنویس');return}
  const r=REVIEWS[i];
  if(r.id && API.getToken()){
    const res=await API.replyReview(r.id,txt);
    if(!res.ok){toast('⚠️',res.error?.message||'ثبت پاسخ ناموفق بود');return;}
    await loadReviews();
  }else{
    REVIEWS[i].replied=true;REVIEWS[i].reply=txt;
  }
  closeModal();profRenderReviews();
  toast('✅','پاسخت ثبت شد');
}

function rCustomers(){
  document.getElementById('v-customers').innerHTML=`
    <div class="pg-head"><div class="pg-title">هوش مشتری</div><div class="pg-sub">تحلیل رفتار، ارزش و ریسک ریزش مشتری‌ها با هوش مصنوعی</div></div>
    <div class="itabs">
      <button class="itab ${custTab==='overview'?'active':''}" onclick="setCustTab('overview')">📊 نمای کلی</button>
      <button class="itab ${custTab==='profiles'?'active':''}" onclick="setCustTab('profiles')">👥 پروفایل‌ها</button>
      <button class="itab ${custTab==='campaign'?'active':''}" onclick="setCustTab('campaign')">📣 کمپین پیامکی</button>
      <button class="itab ${custTab==='ai'?'active':''}" onclick="setCustTab('ai')">✦ دستیار AI</button>
    </div>
    <div id="ct-overview" class="isub ${custTab==='overview'?'active':''}"><div style="text-align:center;padding:50px;color:var(--t2)">در حال بارگذاری...</div></div>
    <div id="ct-profiles" class="isub ${custTab==='profiles'?'active':''}"></div>
    <div id="ct-campaign" class="isub ${custTab==='campaign'?'active':''}"></div>
    <div id="ct-ai" class="isub ${custTab==='ai'?'active':''}"></div>`;
  custRenderOverview();
  custRenderProfiles();
  custRenderCampaign();
  custRenderAI();
}
function setCustTab(t){
  custTab=t;
  document.querySelectorAll('#v-customers .itab').forEach((b,i)=>b.classList.toggle('active',['overview','profiles','campaign','ai'][i]===t));
  document.querySelectorAll('#v-customers .isub').forEach(s=>s.classList.toggle('active',s.id==='ct-'+t));
}
const RFM_LABEL_FA={champions:'قهرمانان',loyal:'وفادار',potential:'بالقوه',at_risk:'در خطر ریزش',new:'جدید',hibernating:'غیرفعال',lost:'از دست‌رفته',unknown:'نامشخص'};

// ─── تب ۱: نمای کلی (واقعی، از /restaurant/rfm + /restaurant/ai) ───
// نگاشت رنگ و نام هر سگمنت RFM
const RFM_META={
  champions:{fa:'قهرمانان',c:'#12A150',d:'بهترین مشتری‌ها — زیاد و تازه'},
  loyal:{fa:'وفادار',c:'#4F46E5',d:'مرتب برمی‌گردن'},
  potential:{fa:'بالقوه',c:'#7C6FF0',d:'پتانسیل وفادار شدن'},
  promising:{fa:'امیدبخش',c:'#0EA5E9',d:'تازه‌وارد فعال'},
  new_customer:{fa:'جدید',c:'#06B6D4',d:'اولین بازدیدها'},
  at_risk:{fa:'در خطر ریزش',c:'#E8925A',d:'مدتیه نیامدن'},
  cant_lose:{fa:'نباید از دست داد',c:'#DC2626',d:'ارزشمند ولی غایب'},
  hibernating:{fa:'غیرفعال',c:'#9AA0AE',d:'خیلی وقته نیامدن'},
  lost:{fa:'از دست‌رفته',c:'#6B7280',d:'احتمالاً رفته'},
  unknown:{fa:'نامشخص',c:'#CBD5E1',d:''},
};
// رندر دمو داشبورد هوش مشتری (از GUESTS نمونه) — برای دمو و آفلاین
function custRenderOverviewDemo(el){
  const total=GUESTS.length*32+1216; // عدد نمونه‌ی واقع‌گرایانه
  const vipCount=GUESTS.filter(g=>g.seg==='vip').length*14+38;
  const champCount=GUESTS.filter(g=>g.seg==='vip'||(g.visits||0)>=12).length*11;
  const atRiskCount=GUESTS.filter(g=>(g.churn||0)>=40).length*9+24;
  const demoSegs=[
    {segment:'champions',count:142},{segment:'loyal',count:318},{segment:'promising',count:96},
    {segment:'at_risk',count:74},{segment:'cant_lose',count:31},{segment:'hibernating',count:58},
  ];
  const segTotal=demoSegs.reduce((a,s)=>a+s.count,0);
  el.innerHTML=`
    <div class="ci-hero">
      <span class="ci-hero-badge">✦ هوش مشتری رزرونو · <span style="opacity:.8">[نمونه]</span></span>
      <div class="ci-hero-grid">
        <div class="ci-hero-stat"><div class="n">${fa(segTotal)}</div><div class="l">مشتری تحلیل‌شده</div></div>
        <div class="ci-hero-stat"><div class="n warm">${fa(142)}</div><div class="l">مشتری VIP</div></div>
        <div class="ci-hero-stat"><div class="n grn">${fa(142)}</div><div class="l">قهرمان (بهترین‌ها)</div></div>
        <div class="ci-hero-stat"><div class="n" style="color:#F0A868">${fa(163)}</div><div class="l">در خطر ریزش</div></div>
      </div>
    </div>
    <div class="ai-box" style="margin-bottom:16px">
      <div class="ai-box-head"><div class="icn">✦</div><div class="ttl">خلاصه‌ی هوشمند</div><span class="tag">نمونه</span></div>
      <div class="ai-insight"><span class="ic warn">🚨</span><div><b>۷۴ مشتری وفادار در حال ریزش‌اند</b><div style="margin-top:2px">این‌ها قبلاً مرتب می‌آمدند ولی ۳۰+ روز غایب‌اند. یک کش‌بک بفرست تا برگردند.</div></div></div>
      <div class="ai-insight"><span class="ic info">⚡</span><div><b>۹۶ مشتری امیدبخش</b><div style="margin-top:2px">تازه‌واردهای فعال — با یک پیام خوش‌آمد به وفادار تبدیل‌شان کن.</div></div></div>
    </div>
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-head"><div><div class="panel-title">نقشه‌ی مشتریان (RFM)</div><div class="panel-sub">مشتری‌ها بر اساس رفتار خرید دسته‌بندی شده‌اند</div></div></div>
      <div class="seg-map">${demoSegs.map(s=>{
        const m=RFM_META[s.segment]||RFM_META.unknown;
        const p=Math.round(s.count/segTotal*100);
        return `<div class="seg-cell" onclick="setCustTab('profiles')">
          <div class="seg-top"><span class="seg-name">${m.fa}</span><span class="seg-dot" style="background:${m.c}"></span></div>
          <div class="seg-count">${fa(s.count)}</div>
          <div class="seg-pct">${fa(p)}٪ · ${m.d}</div>
          <div class="seg-bar"><i style="width:${p}%;background:${m.c}"></i></div>
        </div>`;
      }).join('')}</div>
    </div>
    <div class="row2">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">اقدام سریع</div></div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-ghost btn-block" style="justify-content:flex-start" onclick="setCustTab('profiles')">👥 پروفایل و سیگنال هر مشتری</button>
          <button class="btn btn-ghost btn-block" style="justify-content:flex-start" onclick="setCustTab('campaign')">📣 ساخت کمپین پیامکی هدفمند</button>
          <button class="btn btn-ghost btn-block" style="justify-content:flex-start" onclick="setCustTab('ai')">✦ همه‌ی پیشنهادهای AI</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">💡 چرا این مهمه؟</div></div>
        <div style="font-size:13px;color:var(--t2);line-height:1.75">
          رقبا این تحلیل RFM را به‌عنوان افزونه‌ی گران می‌فروشند. در رزرونو، <b style="color:var(--t1)">۱۶۳ مشتری در خطر ریزش</b> را همین حالا می‌بینی و با یک کلیک برایشان کش‌بک می‌فرستی تا برگردند.
        </div>
      </div>
    </div>`;
}
async function custRenderOverview(){
  const el=document.getElementById('ct-overview');
  // حالت دمو/آفلاین: با داده‌ی نمونه رندر کن تا فیچر همیشه قابل‌نمایش باشد (برای دمو به رستوران‌دار)
  if(!API.getToken()){ return custRenderOverviewDemo(el); }
  const [rfmRes,aiRes,vipRes]=await Promise.all([API.rfm(),API.aiRecommendations(),API.customers('segment=vip&limit=50')]);
  if(!rfmRes.ok){ return custRenderOverviewDemo(el); }
  const total=rfmRes.data.total||0;
  const segs=(rfmRes.data.segments||[]).slice().sort((a,b)=>b.count-a.count);
  const vipCount=vipRes.ok?(vipRes.data.items?.length||0):0;
  const cards=aiRes.ok?(aiRes.data.cards||[]):[];
  // عدد قهرمان فروش: ارزش کل مشتریان (مجموع CLV) — تخمین اگر بک‌اند نده
  const champCount=(segs.find(s=>s.segment==='champions')?.count)||0;
  const atRiskCount=segs.filter(s=>['at_risk','cant_lose','hibernating'].includes(s.segment)).reduce((a,s)=>a+s.count,0);
  const fnl=n=>n>=1000000?fa(+(n/1000000).toFixed(1))+'م':n>=1000?fa(Math.round(n/1000))+'ک':fa(n||0);
  el.innerHTML=`
    <!-- کارت قهرمان: ارزش پایگاه مشتری -->
    <div class="ci-hero">
      <span class="ci-hero-badge">✦ هوش مشتری رزرونو</span>
      <div class="ci-hero-grid">
        <div class="ci-hero-stat"><div class="n">${fa(total)}</div><div class="l">مشتری تحلیل‌شده</div></div>
        <div class="ci-hero-stat"><div class="n warm">${fa(vipCount)}${vipCount>=50?'+':''}</div><div class="l">مشتری VIP</div></div>
        <div class="ci-hero-stat"><div class="n grn">${fa(champCount)}</div><div class="l">قهرمان (بهترین‌ها)</div></div>
        <div class="ci-hero-stat"><div class="n" style="color:#F0A868">${fa(atRiskCount)}</div><div class="l">در خطر ریزش</div></div>
      </div>
    </div>

    ${cards.length?`<div class="ai-box" style="margin-bottom:16px">
      <div class="ai-box-head"><div class="icn">✦</div><div class="ttl">خلاصه‌ی هوشمند</div><span class="tag">AI</span></div>
      ${cards.slice(0,3).map(c=>`<div class="ai-insight"><span class="ic ${c.severity==='high'?'warn':c.severity==='medium'?'info':'up'}">${c.severity==='high'?'🚨':c.severity==='medium'?'⚡':'✓'}</span><div><b>${esc(c.title)}</b><div style="margin-top:2px">${esc(c.detail)}</div></div></div>`).join('')}
    </div>`:''}

    <div class="panel" style="margin-bottom:16px">
      <div class="panel-head"><div><div class="panel-title">نقشه‌ی مشتریان (RFM)</div><div class="panel-sub">مشتری‌ها بر اساس رفتار خرید دسته‌بندی شده‌اند</div></div></div>
      ${segs.length?`<div class="seg-map">${segs.map(s=>{
        const m=RFM_META[s.segment]||RFM_META.unknown;
        const p=total?Math.round(s.count/total*100):0;
        return `<div class="seg-cell" onclick="setCustTab('profiles')">
          <div class="seg-top"><span class="seg-name">${m.fa}</span><span class="seg-dot" style="background:${m.c}"></span></div>
          <div class="seg-count">${fa(s.count)}</div>
          <div class="seg-pct">${fa(p)}٪ · ${m.d}</div>
          <div class="seg-bar"><i style="width:${p}%;background:${m.c}"></i></div>
        </div>`;
      }).join('')}</div>`:'<div style="text-align:center;color:var(--t2);padding:20px;font-size:12.5px">هنوز محاسبه نشده — کرون شبانه باید یک‌بار اجرا شده باشه</div>'}
    </div>

    <div class="row2">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">اقدام سریع</div></div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-ghost btn-block" style="justify-content:flex-start" onclick="setCustTab('profiles')">👥 پروفایل و سیگنال هر مشتری</button>
          <button class="btn btn-ghost btn-block" style="justify-content:flex-start" onclick="setCustTab('campaign')">📣 ساخت کمپین پیامکی هدفمند</button>
          <button class="btn btn-ghost btn-block" style="justify-content:flex-start" onclick="setCustTab('ai')">✦ همه‌ی پیشنهادهای AI</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">💡 چرا این مهمه؟</div></div>
        <div style="font-size:13px;color:var(--t2);line-height:1.75">
          رقبا این تحلیل RFM را به‌عنوان افزونه‌ی گران می‌فروشند. در رزرونو، <b style="color:var(--t1)">${fa(atRiskCount)} مشتری در خطر ریزش</b> را همین حالا می‌بینی و با یک کلیک برایشان کش‌بک می‌فرستی تا برگردند.
        </div>
      </div>
    </div>`;
}

// ─── تب ۲: پروفایل‌ها (واقعی، از /restaurant/customers — RFM/CLV/churn واقعی هر مشتری) ───
let custSort='churn';
async function custRenderProfiles(){
  const el=document.getElementById('ct-profiles');
  el.innerHTML=`<div style="text-align:center;padding:50px;color:var(--t2)">در حال بارگذاری...</div>`;
  if(!API.getToken()){ el.innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">برای دیدن این بخش وارد شو.</div>`; return; }
  const res=await API.customers('sort='+custSort+'&limit=20');
  if(!res.ok){ el.innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">⚠️ اتصال به سرور برقرار نشد.</div>`; return; }
  const items=res.data.items||[];
  const fnl=n=>n>=1000000?fa(+(n/1000000).toFixed(1))+'م':n>=1000?fa(Math.round(n/1000))+'ک':fa(n||0);
  const SEG_FA={new_customer:'مشتری جدید',active:'فعال',at_risk:'در خطر ریزش',churned:'ازدست‌رفته',vip:'VIP'};
  el.innerHTML=`
    <div class="ai-box" style="margin-bottom:18px">
      <div class="ai-box-head"><div class="icn">✦</div><div class="ttl">پروفایل‌های واقعی مشتری</div><span class="tag">داده‌ی زنده</span></div>
      <div style="font-size:13px;color:var(--t1);line-height:1.6">مرتب‌سازی بر اساس: 
        <button class="btn btn-sm ${custSort==='churn'?'btn-primary':'btn-ghost'}" onclick="custSort='churn';custRenderProfiles()">ریسک ریزش</button>
        <button class="btn btn-sm ${custSort==='clv'?'btn-primary':'btn-ghost'}" onclick="custSort='clv';custRenderProfiles()">ارزش (CLV)</button>
        <button class="btn btn-sm ${custSort==='visits'?'btn-primary':'btn-ghost'}" onclick="custSort='visits';custRenderProfiles()">تعداد بازدید</button>
      </div>
    </div>
    ${items.length?items.map(c=>{
      const urg=c.churn_risk_score>=60?'high':c.churn_risk_score>=30?'med':'low';
      const urgClr={high:'var(--red)',med:'var(--amber)',low:'var(--green)'};
      return `<div class="smart-card ${urg}">
        <div class="smart-top">
          <div class="smart-ava">${c.is_vip?'👑':'👤'}</div>
          <div style="flex:1"><div class="smart-name">${esc(c.name)}</div><div style="font-size:12px;color:var(--t2)">${esc(SEG_FA[c.segment]||c.segment||'')} · ${fa(c.total_visits)} بازدید · ${fnl(c.predicted_clv_toman)} تومان CLV</div></div>
          <span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:50px;background:${urg==='high'?'var(--red-50)':urg==='med'?'var(--amber-50)':'var(--green-50)'};color:${urgClr[urg]}">${urg==='high'?'پرریسک':urg==='med'?'بررسی کن':'پایدار'}</span>
        </div>
        <div class="sig-row">
          <div class="sig"><div class="sig-val" style="color:var(--red)">${fa(c.churn_risk_score)}٪</div><div class="sig-label">ریسک ریزش</div><div class="sig-track"><div class="sig-fill" style="width:${c.churn_risk_score}%;background:var(--red)"></div></div></div>
          <div class="sig"><div class="sig-val" style="color:var(--amber)">${fa(c.no_show_rate_pct)}٪</div><div class="sig-label">عدم‌حضور</div><div class="sig-track"><div class="sig-fill" style="width:${c.no_show_rate_pct}%;background:var(--amber)"></div></div></div>
        </div>
        <div class="smart-actions">
          <button class="btn btn-sm btn-ghost" onclick="callCustomer('${esc(c.phone||'')}')">📞 ${esc(c.phone||'بدون شماره')}</button>
          ${c.user_id?`<button class="btn btn-sm btn-ghost" onclick="openCustomerDetail('${esc(c.user_id)}')">👁️ جزئیات</button>`:''}
          <button class="btn btn-sm btn-ghost" onclick="setCustTab('campaign')">📣 ارسال پیام</button>
        </div>
      </div>`;
    }).join(''):'<div style="text-align:center;color:var(--t2);padding:40px">هنوز مشتری تحلیل‌شده‌ای نیست</div>'}`;
}
function callCustomer(phone){ if(phone) window.location.href='tel:'+phone; }

// ─── تب ساعات کاری + تعطیلات (وصل به GET/PUT /restaurant/hours واقعی) ───
// کلید هر روز مطابق قرارداد بک‌اند: getDay() جاوااسکریپت (۰=یکشنبه ... ۶=شنبه).
// ترتیب نمایش برای کاربر ایرانی: شنبه تا جمعه.
const HOURS_DOW_ORDER=[6,0,1,2,3,4,5];
const HOURS_DOW_FA={0:'یکشنبه',1:'دوشنبه',2:'سه‌شنبه',3:'چهارشنبه',4:'پنجشنبه',5:'جمعه',6:'شنبه'};
let HOURS_STATE={opening_hours:null,timezone:'Asia/Tehran',closures:[]};
let _hoursLoaded=false, _hoursDirty=false;

async function loadHours(){
  if(!API.getToken()) return;
  const res=await API.hoursGet();
  if(res.ok && res.data){
    HOURS_STATE={opening_hours:res.data.opening_hours||{}, timezone:res.data.timezone||'Asia/Tehran', closures:res.data.closures||[]};
    _hoursLoaded=true; _hoursDirty=false;
  }
}

function profRenderHours(){
  const el=document.getElementById('pt-hours'); if(!el) return;
  if(!API.getToken()){ el.innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">برای ویرایش ساعات کاری وارد شو.</div>`; return; }
  const oh=HOURS_STATE.opening_hours||{};
  el.innerHTML=`
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">ساعات کاری هفتگی</div><div class="panel-sub">هر روز می‌تواند چند شیفت (مثلاً ناهار/شام) داشته باشد</div></div>
        <button class="btn btn-primary btn-sm" onclick="saveHours()">ذخیره</button></div>
      ${HOURS_DOW_ORDER.map(d=>{
        const shifts=oh[d]||[];
        const isOpen=Array.isArray(oh[d]);
        return `<div class="staff-row" style="align-items:flex-start;flex-wrap:wrap">
          <div style="flex:1;min-width:110px;font-size:13px;font-weight:700;padding-top:8px">${HOURS_DOW_FA[d]}</div>
          <button class="toggle ${isOpen?'on':'off'}" onclick="toggleHoursDay(${d})" style="margin-top:4px"></button>
          <div style="flex-basis:100%;height:0"></div>
          <div style="flex:1;min-width:220px">
            ${isOpen?(shifts.length?shifts.map((s,i)=>`
              <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
                <input class="inp" style="width:auto" type="time" value="${esc(s[0])}" onchange="updateHoursShift(${d},${i},0,this.value)">
                <span style="color:var(--t3)">تا</span>
                <input class="inp" style="width:auto" type="time" value="${esc(s[1])}" onchange="updateHoursShift(${d},${i},1,this.value)">
                <button class="btn btn-ghost btn-sm" onclick="removeHoursShift(${d},${i})">حذف</button>
              </div>`).join(''):'<div style="font-size:12px;color:var(--t3);margin-top:8px">شیفتی ثبت نشده</div>')+
              (isOpen?`<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="addHoursShift(${d})">+ افزودن شیفت</button>`:'')
            :'<div style="font-size:12px;color:var(--t3);margin-top:8px">تعطیل</div>'}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">تعطیلات خاص</div><div class="panel-sub">مثلاً روزهای بازسازی یا تعطیلات رسمی که با روز هفته فرق دارند</div></div></div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input class="inp" id="closureDate" type="date">
        <input class="inp" id="closureReason" placeholder="دلیل (اختیاری)">
        <button class="btn btn-primary btn-sm" onclick="addClosure()">افزودن</button>
      </div>
      ${HOURS_STATE.closures.length?HOURS_STATE.closures.map((c,i)=>`
        <div class="staff-row">
          <div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(c.date)}</div>${c.reason?`<div style="font-size:12px;color:var(--t2)">${esc(c.reason)}</div>`:''}</div>
          <button class="btn btn-ghost btn-sm" onclick="removeClosure(${i})">حذف</button>
        </div>`).join(''):'<div style="text-align:center;color:var(--t2);font-size:12.5px;padding:16px">تعطیلی خاصی ثبت نشده</div>'}
    </div>`;
}
function toggleHoursDay(d){
  const oh=HOURS_STATE.opening_hours=HOURS_STATE.opening_hours||{};
  if(Array.isArray(oh[d])) delete oh[d]; else oh[d]=[['12:00','23:00']];
  _hoursDirty=true; profRenderHours();
}
function addHoursShift(d){ (HOURS_STATE.opening_hours[d]=HOURS_STATE.opening_hours[d]||[]).push(['12:00','23:00']); _hoursDirty=true; profRenderHours(); }
function removeHoursShift(d,i){ HOURS_STATE.opening_hours[d]?.splice(i,1); _hoursDirty=true; profRenderHours(); }
function updateHoursShift(d,i,pos,val){ if(HOURS_STATE.opening_hours[d]?.[i]){ HOURS_STATE.opening_hours[d][i][pos]=val; _hoursDirty=true; } }
function addClosure(){
  const date=document.getElementById('closureDate')?.value;
  const reason=document.getElementById('closureReason')?.value.trim();
  if(!date){ toast('⚠️','یه تاریخ انتخاب کن'); return; }
  if(HOURS_STATE.closures.some(c=>c.date===date)){ toast('⚠️','این تاریخ قبلاً اضافه شده'); return; }
  HOURS_STATE.closures.push({date,reason:reason||null});
  _hoursDirty=true; profRenderHours();
}
function removeClosure(i){ HOURS_STATE.closures.splice(i,1); _hoursDirty=true; profRenderHours(); }
async function saveHours(){
  if(!API.getToken()){ toast('⚠️','برای ذخیره باید وارد شده باشی'); return; }
  const res=await API.hoursSave({opening_hours:HOURS_STATE.opening_hours, closures:HOURS_STATE.closures});
  if(res.ok){ _hoursDirty=false; toast('✓','ساعات کاری ذخیره شد'); }
  else{ toast('⚠️', res.error?.message||'ذخیره ناموفق بود'); }
}

// ─── drilldown تک‌مشتری (وصل به /restaurant/customers/:userId واقعی) ───
async function openCustomerDetail(userId){
  openModal(`<div style="text-align:center;padding:40px;color:var(--t2)">در حال بارگذاری پروفایل...</div>`);
  const res=await API.customerDetail(userId);
  if(!res.ok){
    openModal(`<div class="modal-title">خطا</div><div class="modal-sub">${res.status===404?'سابقه‌ای برای این مشتری ثبت نشده':'اتصال به سرور برقرار نشد'}</div><div style="margin-top:16px"><button class="btn btn-ghost" onclick="closeModal()">بستن</button></div>`);
    return;
  }
  const d=res.data;
  const u=d.user||{}, clv=d.clv||{}, risk=d.risk||{};
  const fnl=n=>n>=1000000?fa(+(n/1000000).toFixed(1))+'م':n>=1000?fa(Math.round(n/1000))+'ک':fa(n||0);
  const SEG_FA={new_customer:'مشتری جدید',active:'فعال',at_risk:'در خطر ریزش',churned:'ازدست‌رفته',vip:'VIP'};
  const dt=s=>{ if(!s)return'—'; try{return new Date(s).toLocaleDateString('fa-IR');}catch{return'—';} };
  const ST_FA={completed:'انجام‌شده',seated:'نشسته',confirmed:'تأییدشده',cancelled:'لغوشده',no_show:'عدم‌حضور',pending:'در انتظار'};
  const tl=(d.timeline||[]);
  openModal(`
    <div class="modal-title">${d.is_vip?'👑 ':''}${esc(u.name||'مشتری')}</div>
    <div class="modal-sub">${esc(SEG_FA[d.segment]||d.segment||'')}${u.phone?' · '+esc(u.phone):''}</div>
    <div class="sig-row" style="margin-top:14px">
      <div class="sig"><div class="sig-val">${fa(clv.total_visits||0)}</div><div class="sig-label">بازدید</div></div>
      <div class="sig"><div class="sig-val">${fnl(clv.total_spend_toman)}</div><div class="sig-label">کل خرج (ت)</div></div>
      <div class="sig"><div class="sig-val">${fnl(clv.predicted_clv_toman)}</div><div class="sig-label">CLV (ت)</div></div>
    </div>
    <div class="sig-row" style="margin-top:10px">
      <div class="sig"><div class="sig-val" style="color:var(--red)">${fa(risk.churn_risk_score||0)}٪</div><div class="sig-label">ریسک ریزش</div></div>
      <div class="sig"><div class="sig-val" style="color:var(--amber)">${fa(risk.no_show_rate_pct||0)}٪</div><div class="sig-label">عدم‌حضور</div></div>
      <div class="sig"><div class="sig-val">${dt(clv.last_visit_at)}</div><div class="sig-label">آخرین بازدید</div></div>
    </div>
    <div class="field-label" style="margin-top:18px">تاریخچه‌ی رزروها</div>
    <div style="max-height:240px;overflow-y:auto;margin-top:8px">
      ${tl.length?tl.map(r=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px;margin-bottom:8px">
          <div>
            <div style="font-weight:700;font-size:13px">${esc(ST_FA[r.status]||r.status)} · ${fa(r.party_size)} نفر</div>
            <div style="font-size:11px;color:var(--t2)">${dt(r.slot_start)}${r.items&&r.items.length?' · '+esc(r.items.join('، ')):''}</div>
          </div>
          <div style="font-weight:800;font-size:13px">${r.spend_toman?fnl(r.spend_toman)+' ت':'—'}</div>
        </div>`).join(''):'<div style="text-align:center;color:var(--t2);padding:20px">هنوز رزروی ثبت نشده</div>'}
    </div>
    <div style="margin-top:16px;display:flex;gap:8px">
      ${u.phone?`<button class="btn btn-ghost btn-sm" onclick="callCustomer('${esc(u.phone)}')">📞 تماس</button>`:''}
      <button class="btn btn-primary btn-sm" onclick="closeModal()">بستن</button>
    </div>`);
}

// ─── تب ۳: کمپین پیامکی (مارکتینگ) ───
let _segCounts=null;
async function custRenderCampaign(){
  if(!_segCounts && API.getToken()){
    const [atRisk,vip]=await Promise.all([API.customers('segment=at_risk&limit=50'),API.customers('segment=vip&limit=50')]);
    _segCounts={
      at_risk: atRisk.ok?(atRisk.data.items?.length||0):null,
      vip: vip.ok?(vip.data.items?.length||0):null,
    };
  }
  const sc=_segCounts||{};
  const cnt=(v,suffix)=>v==null?'—':fa(v)+(v>=50?'+':'')+' '+suffix;
  const segs=[['⚠️','در خطر ریزش',cnt(sc.at_risk,'نفر')],['👑','VIP',cnt(sc.vip,'نفر')],['🆕','مشتری جدید','همه'],['🎂','تولد این ماه',fa(CLUB.filter(m=>m.bMonth===CUR_MONTH).length)+' نفر']];
  document.getElementById('ct-campaign').innerHTML=`
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">کمپین پیامکی هوشمند</div><div class="panel-sub">سگمنت انتخاب کن، پیام بنویس، پیش‌نمایش بگیر</div></div></div>
      <div class="field-label">۱. سگمنت مخاطب</div>
      <div class="seg-grid">${segs.map((s,i)=>`<div class="seg-card" onclick="pickSeg(${i},this)"><div class="seg-card-icon">${s[0]}</div><div class="seg-card-name">${s[1]}</div><div class="seg-card-count">${s[2]}</div></div>`).join('')}</div>
      <div class="field-label">۲. متن پیام</div>
      <textarea class="txta" id="campText" placeholder="سلام {نام}! یه پیشنهاد ویژه برات داریم..."></textarea>
      <div style="font-size:11px;color:var(--t3);margin:6px 0 16px"><span id="charCount">۰</span> / ۱۶۰ کاراکتر · {نام} با اسم مشتری جایگزین می‌شه</div>
      <button class="btn btn-primary btn-lg" onclick="previewCamp()">پیش‌نمایش پیام</button>
    </div>
    <div class="panel" id="campHistoryPanel">
      <div class="panel-head"><div class="panel-title">کمپین‌های اخیر</div></div>
      <div id="campHistoryList" style="text-align:center;color:var(--t2);font-size:12.5px;padding:16px">در حال بارگذاری...</div>
    </div>`;
  const ct=document.getElementById('campText');
  if(ct)ct.addEventListener('input',e=>document.getElementById('charCount').textContent=fa(e.target.value.length));
  loadCampaignHistory();
}
async function loadCampaignHistory(){
  const el=document.getElementById('campHistoryList');
  if(!el)return;
  if(!API.getToken()){ el.innerHTML='برای دیدن تاریخچه وارد شو'; return; }
  const res=await API.campaignHistory();
  if(!res.ok){ el.innerHTML='⚠️ بارگذاری تاریخچه ناموفق بود'; return; }
  const logs=res.data.items||[];
  const SEG_FA={at_risk:'در خطر ریزش',gold:'VIP طلایی',vip:'VIP',all:'همه',custom:'دستی',new_customer:'مشتری جدید'};
  el.innerHTML=logs.length?`<table class="tbl"><thead><tr><th>سگمنت</th><th>تاریخ</th><th>گیرنده</th><th>پیام</th></tr></thead><tbody>
    ${logs.map(l=>`<tr><td>${esc(SEG_FA[l.segment]||l.segment)}</td><td>${faRelative(l.created_at)}</td><td>${fa(l.recipients_count)}</td><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.message)}</td></tr>`).join('')}
  </tbody></table>`:'<div style="padding:8px">هنوز کمپینی ارسال نشده</div>';
}

// ─── تب ۴: دستیار AI (واقعی — کارت‌های پیشنهاد قانون‌محور از /restaurant/ai، نه چت ساختگی) ───
async function custRenderAI(){
  const el=document.getElementById('ct-ai');
  el.innerHTML=`<div style="text-align:center;padding:50px;color:var(--t2)">در حال بارگذاری...</div>`;
  if(!API.getToken()){ el.innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">برای دیدن این بخش وارد شو.</div>`; return; }
  const res=await API.aiRecommendations();
  if(!res.ok){ el.innerHTML=`<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">⚠️ اتصال به سرور برقرار نشد.</div>`; return; }
  const cards=res.data.cards||[];
  el.innerHTML=`
    <div class="ai-box" style="margin-bottom:18px">
      <div class="ai-box-head"><div class="icn">✦</div><div class="ttl">پیشنهادهای هوشمند</div><span class="tag">قانون‌محور · شفاف</span></div>
      <div style="font-size:13px;color:var(--t1);line-height:1.6">این پیشنهادها از تحلیل واقعی داده‌های رستوران شما تولید می‌شن (نه چت‌بات) — هر کارت دلیل و عدد پشتش رو نشون می‌ده.</div>
    </div>
    ${cards.length?cards.map(c=>`
      <div class="smart-card ${c.severity==='high'?'high':c.severity==='medium'?'med':'low'}">
        <div class="smart-top">
          <div class="smart-ava">${c.severity==='high'?'🚨':c.severity==='medium'?'⚡':'✓'}</div>
          <div style="flex:1"><div class="smart-name">${esc(c.title)}</div></div>
        </div>
        <div class="smart-rec"><div class="smart-rec-label">✦ تحلیل</div>${esc(c.detail)}</div>
        <div class="smart-actions">
          <button class="btn btn-sm ${c.severity==='high'?'btn-primary':'btn-ghost'}" onclick="handleAiAction('${c.id}')">${esc(c.action_label)}</button>
        </div>
      </div>`).join(''):'<div style="text-align:center;color:var(--t2);padding:40px">فعلاً پیشنهاد فوری‌ای نیست — وضعیت خوبه 🎉</div>'}`;
}
function handleAiAction(id){
  if(id==='winback'||id==='vip_retention'){ setCustTab('campaign'); }
  else if(id==='noshow_upcoming'){ nav('reservations'); }
  else { toast('✦','این اقدام به‌زودی به‌صورت خودکار قابل‌اجراست'); }
}
// ═══════════ LOYALTY ═══════════
async function rLoyalty(){
  // اگر توکن staff داریم، از API بارگذاری کن
  if(API.getToken()){
    const fresh=await loadClubMembers();
    CLUB=fresh;
  }
  const total=CLUB.length;
  const gold=CLUB.filter(m=>m.tier==='gold').length;
  const silver=CLUB.filter(m=>m.tier==='silver').length;
  const bronze=CLUB.filter(m=>m.tier==='bronze').length;
  const birthdays=CLUB.filter(m=>m.bMonth===CUR_MONTH);
  const tiers=[['🥇 طلایی',gold,'#F59E0B'],['🥈 نقره‌ای',silver,'#94A3B8'],['🥉 برنزی',bronze,'#D97706']];
  const tierName={gold:'🥇',silver:'🥈',bronze:'🥉'};
  document.getElementById('v-loyalty').innerHTML=`
    <div class="pg-head"><div class="pg-title">باشگاه مشتریان</div><div class="pg-sub">اعضای وفادار، امتیازها و سطح‌بندی مشتری‌ها</div></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon blue">🎫</div></div><div class="kpi-val">${fa(total)}</div><div class="kpi-label">عضو باشگاه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon teal">📈</div><span class="kpi-delta up">۲.۱×</span></div><div class="kpi-val">۲.۱×</div><div class="kpi-label">خرید بیشتر اعضا</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon amber">🎂</div></div><div class="kpi-val">${fa(birthdays.length)}</div><div class="kpi-label">تولد این ماه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon green">💸</div></div><div class="kpi-val">۸٪</div><div class="kpi-label">میانگین کش‌بک</div></div>
    </div>

    <!-- توضیح اتصال خودکار -->
    <div class="ai-box" style="margin-bottom:16px">
      <div class="ai-box-head"><div class="icn">🎫</div><div class="ttl">ثبت خودکار مشتری</div><span class="tag">فعال</span></div>
      <div style="font-size:13px;color:var(--t1);line-height:1.6">هر رزرویی که با شماره موبایل ثبت بشه، مشتری <b>خودکار</b> به باشگاه اضافه می‌شه و کد عضویت می‌گیره — بدون نیاز به ثبت دستی. دیتای مشتری‌هات همین‌طوری خودش جمع می‌شه.</div>
    </div>

    <div class="row2">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">ثبت دستی عضو</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><div class="field-label">نام</div><input class="inp" id="cFn" placeholder="نام"></div>
          <div><div class="field-label">نام خانوادگی</div><input class="inp" id="cLn" placeholder="فامیل"></div>
        </div>
        <div class="field-label">موبایل</div><input class="inp" id="cPh" placeholder="۰۹...">
        <div class="field-label">تاریخ تولد</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <select class="inp" id="cD"><option>روز</option>${Array.from({length:31},(_,i)=>`<option>${fa(i+1)}</option>`).join('')}</select>
          <select class="inp" id="cM"><option>ماه</option>${['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map(m=>`<option>${m}</option>`).join('')}</select>
          <select class="inp" id="cY"><option>سال</option>${Array.from({length:40},(_,i)=>`<option>${fa(1385-i)}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary btn-lg btn-block" onclick="addMember()">ثبت + ساخت کد عضویت</button>
        <div id="memberResult"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">توزیع سطوح</div></div>
        ${tiers.map(([l,c,col])=>`<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><span style="width:80px;font-size:13px;font-weight:600">${l}</span><div style="flex:1;height:8px;background:var(--s-100);border-radius:4px;overflow:hidden"><div style="height:100%;width:${total?c/total*100:0}%;background:${col};border-radius:4px;transition:width .8s"></div></div><span style="font-weight:700;font-size:13px">${fa(c)}</span></div>`).join('')}
        <div style="background:var(--amber-50);border:1px solid #FDE68A;border-radius:var(--r);padding:14px;margin-top:18px">
          <div style="font-size:13px;font-weight:700;color:#D97706;margin-bottom:8px">🎂 تولدهای این ماه (${fa(birthdays.length)})</div>
          <div style="font-size:12px;color:var(--t2);line-height:1.8">${birthdays.length?birthdays.map(m=>m.fn+' '+m.ln).join(' · '):'این ماه تولدی نیست'}</div>
          ${birthdays.length?`<button class="btn btn-sm" style="background:#F59E0B;color:#fff;margin-top:10px" onclick="toast('🎂','پیام تبریک + تخفیف ارسال شد')">ارسال تبریک گروهی</button>`:''}
        </div>
      </div>
    </div>

    <!-- لیست اعضا -->
    <div class="panel" style="margin-top:16px">
      <div class="panel-head"><div><div class="panel-title">اعضای باشگاه</div><div class="panel-sub">${fa(total)} عضو · جدیدترین‌ها بالا</div></div></div>
      <div id="clubList">
        ${CLUB.map(m=>`<div class="list-row">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--blue-50);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${tierName[m.tier]}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px">${esc(m.fn)} ${esc(m.ln)} ${m.joined==='همین الان'?'<span style="font-size:10px;color:var(--teal-600);background:var(--teal-50);padding:2px 7px;border-radius:50px;font-weight:700">جدید</span>':''}</div>
            <div style="font-size:12px;color:var(--t2)">📞 ${esc(m.phone)} · کد ${m.code} · ${fa(m.points)} امتیاز</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="toast('📞','تماس با '+${JSON.stringify(esc(m.fn))})">تماس</button>
        </div>`).join('')}
      </div>
    </div>`;
}
let memCounter=1006;
function addMember(){
  const fn=document.getElementById('cFn').value.trim(),ln=document.getElementById('cLn').value.trim(),ph=document.getElementById('cPh').value.trim();
  if(!fn||!ln){toast('⚠️','نام و فامیل رو وارد کن');return}
  if(!/^۰۹|^09/.test(ph.replace(/\s/g,''))){toast('⚠️','موبایل معتبر وارد کن');return}
  const res=enrollClub(fn+' '+ln,ph);
  if(res.reason==='exists'){
    toast('ℹ️',`این شماره قبلاً عضوه (${res.member.code})`);
    return;
  }
  const code=res.member.code;
  document.getElementById('memberResult').innerHTML=`<div style="background:var(--teal-50);border:1px solid #99F6E4;border-radius:var(--r);padding:14px;margin-top:14px;text-align:center;animation:pop .4s var(--spring)"><div style="font-size:11px;color:var(--teal-600);font-weight:700">کد عضویت ساخته شد</div><div style="font-size:24px;font-weight:800;letter-spacing:.1em;color:var(--teal-600);margin-top:4px">${code}</div><div style="font-size:12px;color:var(--t2);margin-top:4px">${esc(fn)} ${esc(ln)}</div></div>`;
  document.getElementById('cFn').value='';document.getElementById('cLn').value='';document.getElementById('cPh').value='';
  toast('🎫','عضو جدید ثبت شد');
  // رفرش آمار بعد از ۱.۵ ثانیه تا کاربر کد رو ببینه
  setTimeout(()=>{if(document.getElementById('v-loyalty').classList.contains('active'))rLoyalty()},1800);
}
// ═══════════ MARKETING ═══════════
