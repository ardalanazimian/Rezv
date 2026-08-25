// ═══════════════════════════════════════════════════════════
//  رزرونو (پنل کسب‌وکار) — باشگاه مشتریان (Loyalty)
//  از crm.js جدا شد (جداسازیِ مسئولیت). رفتار دقیقاً همان قبل است.
//  اسکریپتِ کلاسیک (global)، بدون import/export. وابسته به گلوبال‌های
//  data.js: CLUB, CUR_MONTH, loadClubMembers, enrollClub — و
//  fa/icon/esc/toast/API. بعد از crm.js و data.js بارگذاری می‌شود.
//  توجه: memCounter عمداً در crm.js می‌ماند (data.js آن را mutate می‌کند).
// ═══════════════════════════════════════════════════════════
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
  const tiers=[['طلایی',gold,'#F59E0B'],['نقره‌ای',silver,'#94A3B8'],['برنزی',bronze,'#D97706']];
  const tierName={gold:'طلایی',silver:'نقره‌ای',bronze:'برنزی'};
  // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴): دو KPIِ ثابتِ «۲.۱× خرید بیشتر» و «۸٪
  // میانگین کش‌بک» حذف شدند — هیچ‌جا اندازه‌گیری نمی‌شدند و کنارِ اعدادِ
  // واقعیِ باشگاه، ادعای اندازه‌گیری‌نشده بودند (قاعده‌ی ML_CONTRACT).
  document.getElementById('v-loyalty').innerHTML=`
    <div class="pg-head"><div class="pg-title">باشگاه مشتریان</div><div class="pg-sub">اعضای وفادار، امتیازها و سطح‌بندی مشتری‌ها</div></div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon blue">${icon('ticket',{size:16})}</div></div><div class="kpi-val">${fa(total)}</div><div class="kpi-label">عضو باشگاه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon amber">${icon('calendar',{size:16})}</div></div><div class="kpi-val">${fa(birthdays.length)}</div><div class="kpi-label">تولد این ماه</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon teal">${icon('trending',{size:16})}</div></div><div class="kpi-val">${fa(gold+silver)}</div><div class="kpi-label">عضو نقره‌ای به بالا</div></div>
    </div>

    <!-- توضیح اتصال خودکار -->
    <div class="ai-box" style="margin-bottom:16px">
      <div class="ai-box-head"><div class="icn">${icon('ticket',{size:16})}</div><div class="ttl">ثبت خودکار مشتری</div><span class="tag">فعال</span></div>
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
          <div style="font-size:13px;font-weight:700;color:#D97706;margin-bottom:8px">${icon('calendar',{size:13})} تولدهای این ماه (${fa(birthdays.length)})</div>
          <div style="font-size:12px;color:var(--t2);line-height:1.8">${birthdays.length?birthdays.map(m=>m.fn+' '+m.ln).join(' · '):'این ماه تولدی نیست'}</div>
          ${birthdays.length?`<button class="btn btn-sm" style="background:#F59E0B;color:#fff;margin-top:10px" onclick="toast('','پیام تبریک + تخفیف ارسال شد')">ارسال تبریک گروهی</button>`:''}
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
            <div style="font-size:12px;color:var(--t2)">${icon('phone',{size:12})} ${esc(m.phone)} · کد ${m.code} · ${fa(m.points)} امتیاز</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="toast('','تماس با '+${JSON.stringify(esc(m.fn))})">تماس</button>
        </div>`).join('')}
      </div>
    </div>`;
}
const _CLUB_FA_MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
// ⚠️ ارتقا (ممیزیِ آمادگیِ لانچ، ۲۰۲۶-۰۸-۲۵): «ثبتِ دستیِ عضو» حالا به
// endpointِ واقعیِ POST /restaurant/members وصل است — عضویت روی سرور پایدار
// می‌شود و کدِ *واقعیِ* برگشتی از سرور نشان داده می‌شود (نه کدِ VIS-ِ جعلیِ
// حافظه‌ای که با رفرش محو می‌شد). تولد از شمسی به میلادی تبدیل می‌شود
// (jalaliMdToGregMd از reservations.js، scope مشترکِ پنل) تا پیامکِ تولدِ
// بک‌اند در روزِ درست ارسال شود. فقط در حالتِ کاملاً آفلاین به پیامِ صادقِ
// «اتصال برقرار نشد» می‌افتد.
async function addMember(){
  const fn=document.getElementById('cFn').value.trim(),ln=document.getElementById('cLn').value.trim(),ph=document.getElementById('cPh').value.trim();
  if(!fn||!ln){toast('','نام و فامیل رو وارد کن');return}
  if(!/^۰۹|^09/.test(ph.replace(/\s/g,''))){toast('','موبایل معتبر وارد کن');return}
  const phoneLatin=ph.replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\s/g,'');
  const dRaw=(document.getElementById('cD')?.value||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const jDay=parseInt(dRaw,10);
  const jMonth=_CLUB_FA_MONTHS.indexOf(document.getElementById('cM')?.value||'')+1;
  let birth={};
  if(jDay>=1&&jDay<=31&&jMonth>=1&&typeof jalaliMdToGregMd==='function'){
    const g=jalaliMdToGregMd(jMonth,jDay);
    if(g) birth={birth_day:g.gDay,birth_month:g.gMonth};
  }
  const btn=document.querySelector('#v-loyalty [onclick="addMember()"]');
  if(btn) btn.disabled=true;
  const res=await API.createMember({phone:phoneLatin,first_name:fn,last_name:ln,...birth});
  if(btn) btn.disabled=false;
  if(res.ok && res.data?.code){
    const code=res.data.code, already=res.data.enrolled_now===false;
    document.getElementById('memberResult').innerHTML=`<div style="background:var(--teal-50);border:1px solid #99F6E4;border-radius:var(--r);padding:14px;margin-top:14px;text-align:center"><div style="font-size:11px;color:var(--teal-600);font-weight:700">${already?'این شماره از قبل عضو است':'عضو در باشگاه ثبت شد'}</div><div style="font-size:24px;font-weight:800;letter-spacing:.1em;color:var(--teal-600);margin-top:4px">${esc(code)}</div><div style="font-size:12px;color:var(--t2);margin-top:4px">${esc(fn)} ${esc(ln)}</div></div>`;
    document.getElementById('cFn').value='';document.getElementById('cLn').value='';document.getElementById('cPh').value='';
    toast('',already?`از قبل عضو بود (${code})`:'عضو در باشگاه ثبت شد');
    // rLoyalty خودش هر بار از سرور تازه می‌کند؛ عضو جدید واقعاً در لیست می‌آید
    setTimeout(()=>{if(document.getElementById('v-loyalty')?.classList.contains('active'))rLoyalty()},900);
    return;
  }
  if(res.offline){
    document.getElementById('memberResult').innerHTML=`<div style="background:var(--amber-50);border:1px solid #FDE68A;border-radius:var(--r);padding:14px;margin-top:14px;line-height:1.7;font-size:12.5px;color:var(--t1)">${icon('info',{size:14})} اتصال به سرور برقرار نشد. «${esc(fn)} ${esc(ln)}» ثبت نشد — با وصل‌شدنِ اینترنت دوباره تلاش کن.</div>`;
    return;
  }
  toast('', res.error?.message || 'ثبتِ عضو ناموفق بود، دوباره تلاش کن');
}
