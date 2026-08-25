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
function addMember(){
  const fn=document.getElementById('cFn').value.trim(),ln=document.getElementById('cLn').value.trim(),ph=document.getElementById('cPh').value.trim();
  if(!fn||!ln){toast('','نام و فامیل رو وارد کن');return}
  if(!/^۰۹|^09/.test(ph.replace(/\s/g,''))){toast('','موبایل معتبر وارد کن');return}
  const res=enrollClub(fn+' '+ln,ph);
  if(res.reason==='exists'){
    toast('',`این شماره قبلاً عضوه (${res.member.code})`);
    return;
  }
  // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): بک‌اند endpointی برای ساختِ مستقیمِ عضو
  // ندارد (فقط auto-enroll هنگامِ رزرو/walk-in). قبلاً این‌جا یک کدِ VIS-ِ
  // کلاینتی به‌عنوانِ «کد عضویت ساخته شد» + توستِ «عضو جدید ثبت شد» نشان داده
  // می‌شد — ادعای عضویتِ دائمِ سروری، در حالی که با رفرش (loadClubMembers از
  // سرور) محو می‌شد. حالا صادقانه می‌گوییم فقط در این جلسه اضافه شده و عضویتِ
  // دائم خودکار با اولین رزروِ همین شماره ساخته می‌شود (همان‌طور که بالای فرم
  // نوشته). پیامدِ باز: نیازِ به endpointِ ساختِ عضو در KNOWN_LIMITATIONS ثبت شد.
  document.getElementById('memberResult').innerHTML=`<div style="background:var(--amber-50);border:1px solid #FDE68A;border-radius:var(--r);padding:14px;margin-top:14px;line-height:1.7;font-size:12.5px;color:var(--t1)">${icon('info',{size:14})} «${esc(fn)} ${esc(ln)}» فعلاً فقط در همین جلسه اضافه شد. عضویتِ دائم و کدِ رسمی، خودکار وقتی این شماره اولین رزرو را ثبت کند ساخته می‌شود.</div>`;
  document.getElementById('cFn').value='';document.getElementById('cLn').value='';document.getElementById('cPh').value='';
  toast('','در این جلسه اضافه شد — عضویتِ دائم با اولین رزرو');
  // عمداً rLoyalty را دوباره صدا نمی‌زنیم: چون عضو فقط محلی است، رفرشِ آمار از
  // سرور آن را حذف می‌کند و کاربر گیج می‌شود. پیامِ صادق بالا کافی است.
}
