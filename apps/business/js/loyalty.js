// ═══════════════════════════════════════════════════════════
//  رزرونو (پنل کسب‌وکار) — باشگاه مشتریان (Loyalty)
//  از crm.js جدا شد (جداسازیِ مسئولیت). رفتار دقیقاً همان قبل است.
//  اسکریپتِ کلاسیک (global)، بدون import/export. وابسته به گلوبال‌های
//  data.js: CLUB, currentMonthFa, loadClubMembers — و
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
  // CUR_MONTH هاردکد ('خرداد') بود — یازده ماهِ سال عددِ غلط می‌داد (فازِ ۲).
  const birthdays=CLUB.filter(m=>m.bMonth===currentMonthFa());
  // ⚠️ رفعِ عددِ ساختگی (CLAUDE.md «دیتایِ فیک/هاردکد» + پروتکل §۱۰):
  // این ردیفِ KPI قبلاً دو عددِ کاملاً هاردکد داشت که کنارِ دو عددِ **واقعی**
  // (تعدادِ عضو، تولدهای این ماه) نشسته بودند و از هم قابلِ تشخیص نبودند:
  //   • «۲.۱× خرید بیشتر اعضا» — هیچ منبعِ داده‌ای در کلِ سیستم ندارد
  //     (نه endpoint، نه محاسبه‌ی کوهورت). حذف شد؛ ادعایِ اندازه‌گیری‌نشده.
  //   • «۸٪ میانگین کش‌بک» — عدد اتفاقاً با پیش‌فرضِ CB.base یکی بود ولی
  //     literal بود، نه خوانده‌شده. حالا مقدارِ **واقعیِ** رستوران است و تا
  //     وقتی از سرور نیامده «—» نشان می‌دهد (همان انضباطی که rCashback دارد).
  const cbLoaded = typeof _cbLoaded !== 'undefined' && _cbLoaded && typeof CB !== 'undefined';
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
      <div class="kpi"><div class="kpi-top"><div class="kpi-icon green">${icon('wallet',{size:16})}</div></div><div class="kpi-val">${cbLoaded?fa(CB.base)+'٪':'—'}</div><div class="kpi-label">کش‌بکِ پایه</div></div>
    </div>

    <!-- توضیح اتصال خودکار -->
    <div class="ai-box" style="margin-bottom:16px">
      <div class="ai-box-head"><div class="icn">${icon('ticket',{size:16})}</div><div class="ttl">ثبت خودکار مشتری</div><span class="tag">فعال</span></div>
      <div style="font-size:13px;color:var(--t1);line-height:1.6">هر رزرویی که با شماره موبایل ثبت بشه، مشتری <b>خودکار</b> به باشگاه اضافه می‌شه و کد عضویت می‌گیره — بدون نیاز به ثبت دستی. دیتای مشتری‌هات همین‌طوری خودش جمع می‌شه.</div>
    </div>

    <div class="row2">
      <div class="panel">
        <div class="panel-head"><div class="panel-title">عضویت در باشگاه</div></div>
        <!-- ⚠️ تاریخچه‌ی این پنل (مهم است، چون دو بار در دو جهت عوض شده):
             ۱) در ابتدا فرمِ «ثبت دستی عضو» بود که **کاملاً محلی** کار می‌کرد:
                کدِ ساختگیِ VIS-xxx می‌ساخت، «عضو جدید ثبت شد» می‌گفت و با اولین
                رفرش ناپدید می‌شد — چون endpointِ ساختِ عضو وجود نداشت
                (/restaurant/members فقط GET بود). درست بود که حذف شود (فازِ ۲، §۳/§۲۸).
             ۲) [merge ۰۸-۲۵] حالا آن پیش‌فرض دیگر برقرار نیست: POST /restaurant/members
                واقعاً وجود دارد (کامیتِ aa5e0e7، با تستِ یکپارچه) و عضویت را اتمیک
                (⚠️ در این کامنت backtick ننویس — داخلِ template literal است.)
                روی سرور می‌سازد. پس فرم برگشت — این‌بار وصل به مسیرِ واقعی، با
                کدِ برگشتی از سرور. متنِ جایگزینِ #68 («ثبتِ دستیِ جدا وجود ندارد»)
                از لحظه‌ی وجودِ آن endpoint یک ادعایِ نادرست در UI بود.
             نکته‌ای که از #68 **حفظ شد**: selectِ سالِ تولد برنگشت. بک‌اند فقط
             birth_day/birth_month دارد؛ گرفتنِ سال یعنی جمع‌کردنِ دادهٔ حساس و
             بی‌صدا دور ریختنش — همان ایرادِ درستِ #68.
             توضیحِ ثبتِ خودکار هم (که #68 اضافه کرده بود) نگه داشته شد. -->
        <div style="background:var(--blue-50);border:1px solid #BFDBFE;border-radius:var(--r);padding:12px;font-size:12.5px;line-height:1.8;color:var(--t2);margin-bottom:14px">
          ${icon('info',{size:14})} معمولاً نیازی به این فرم نیست: عضویت هنگامِ <b>ثبتِ ورود (واک‌این)</b> یا <b>رزرو</b> خودکار ساخته می‌شود. این فرم برای عضوگیریِ حضوری در محل است.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div><div class="field-label">نام</div><input class="inp" id="cFn" placeholder="نام"></div>
          <div><div class="field-label">نام خانوادگی</div><input class="inp" id="cLn" placeholder="فامیل"></div>
        </div>
        <div class="field-label">موبایل</div><input class="inp" id="cPh" placeholder="۰۹...">
        <div class="field-label">تاریخ تولد <span style="font-weight:400;color:var(--t2)">(اختیاری — برای پیامکِ تبریک)</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <select class="inp" id="cD" aria-label="روزِ تولد"><option>روز</option>${Array.from({length:31},(_,i)=>`<option>${fa(i+1)}</option>`).join('')}</select>
          <select class="inp" id="cM" aria-label="ماهِ تولد"><option>ماه</option>${_CLUB_FA_MONTHS.map(m=>`<option>${m}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary btn-lg btn-block" style="margin-top:14px" onclick="addMember()">ثبت + ساخت کد عضویت</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px" onclick="openWalkin()">${icon('users',{size:15})} یا ثبتِ ورودِ مهمان (واک‌این)</button>
        <div id="memberResult"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><div class="panel-title">توزیع سطوح</div></div>
        ${tiers.map(([l,c,col])=>`<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><span style="width:80px;font-size:13px;font-weight:600">${l}</span><div style="flex:1;height:8px;background:var(--s-100);border-radius:4px;overflow:hidden"><div style="height:100%;width:${total?c/total*100:0}%;background:${col};border-radius:4px;transition:width .8s"></div></div><span style="font-weight:700;font-size:13px">${fa(c)}</span></div>`).join('')}
        <div style="background:var(--amber-50);border:1px solid #FDE68A;border-radius:var(--r);padding:14px;margin-top:18px">
          <div style="font-size:13px;font-weight:700;color:var(--amber);margin-bottom:8px">${icon('calendar',{size:13})} تولدهای این ماه (${fa(birthdays.length)})</div>
          <div style="font-size:12px;color:var(--t2);line-height:1.8">${birthdays.length?birthdays.map(m=>m.fn+' '+m.ln).join(' · '):'این ماه تولدی نیست'}</div>
          ${birthdays.length?`<button class="btn btn-sm" id="bdaySendBtn" style="background:#F59E0B;color:#fff;margin-top:10px" onclick="sendBirthdayGreetings()">${icon('message',{size:13})} ارسالِ پیامکِ تبریک</button>`:''}
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
            <div style="font-size:12px;color:var(--t2)">${icon('phone',{size:12})} ${esc(m.phone)} · کد ${esc(m.code)} · ${fa(m.points)} امتیاز</div>
          </div>
          <!-- ⚠️ قبلاً یک <button> بود که تنها کارش toast «تماس با X» بود —
               دکمه‌ای بدونِ نتیجه‌ی واقعی (§۲۷). حالا یک لینکِ tel: واقعی است
               که روی موبایل شماره‌گیر را باز می‌کند. -->
          <a class="btn btn-ghost btn-sm" href="tel:${esc(String(m.phone||'').replace(/[^\d+]/g,''))}" aria-label="تماس با ${esc(m.fn)}">تماس</a>
        </div>`).join('')}
      </div>
    </div>`;
}
const _CLUB_FA_MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
// [merge ۰۸-۲۵] در PR #68 این تابع **حذف** شده بود، با این استدلالِ درست:
// «کاملاً محلی بود و کدِ عضویتِ ساختگی نشان می‌داد؛ مسیرِ واقعیِ ساختِ عضو
// واک‌این/رزرو است». آن ایراد این‌جا با حذف رفع نشده، بلکه **برطرف** شده:
// حالا endpointِ واقعیِ `POST /restaurant/members` وجود دارد (کامیتِ aa5e0e7)
// و این فرم به آن وصل است، پس دیگر نه محلی است و نه کدِ ساختگی می‌سازد.
// (فرمِ متناظر بالا در rLoyalty بازگردانده شد — بدونِ selectِ سال، طبقِ ایرادِ
// درستِ #68 که بک‌اند فقط birth_day/birth_month دارد.)
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

// ═══════════════════════════════════════════════════════════
//  ارسالِ پیامکِ تبریکِ تولد — وصل به `POST /restaurant/sms` واقعی
//
//  ⚠️ رفعِ جعلِ موفقیت (پروتکل §۳/§۱۰/§۲۷): این دکمه قبلاً **فقط** یک
//  `toast('','پیام تبریک + تخفیف ارسال شد')` بود — هیچ درخواستی نمی‌رفت، هیچ
//  پیامکی ارسال نمی‌شد، و رستوران‌دار باور می‌کرد مشتری‌هایش تبریک گرفته‌اند.
//  همین فایل، چند خط بالاتر، کامنتی دارد که افتخار می‌کند فرمِ جعلیِ «ثبت
//  دستی عضو» را حذف کرده — این دکمه از همان دست بود و جا مانده بود.
//
//  ادعایِ «+ تخفیف» هم حذف شد: قالبِ پیامکِ campaign در بک‌اند فقط
//  [نامِ مهمان، نامِ رستوران] را می‌گیرد و هیچ کدِ تخفیفی همراه ندارد
//  (lib/sms.ts). چیزی که ارسال می‌شود همان است که برچسبِ دکمه می‌گوید.
// ═══════════════════════════════════════════════════════════
async function sendBirthdayGreetings(){
  const btn=document.getElementById('bdaySendBtn');
  const targets=(CLUB||[]).filter(m=>m.bMonth===currentMonthFa() && m.phone);
  if(!targets.length){ toast('','شماره‌ی معتبری برای تولدهای این ماه نیست'); return; }
  if(!API.getToken()){ toast('','برای ارسالِ پیامک باید وارد شده باشی'); return; }
  if(btn){ btn.disabled=true; btn.textContent='در حال ارسال…'; }
  const restore=()=>{ if(btn){ btn.disabled=false; btn.innerHTML=icon('message',{size:13})+' ارسالِ پیامکِ تبریک'; } };
  const res=await API.sendSms({ kind:'campaign', phones:targets.map(m=>String(m.phone)), message:'تبریکِ تولد' });
  if(res.ok){
    // عددِ صف از خودِ سرور می‌آید — نه شمارشِ خوش‌بینانه‌ی کلاینت.
    toast('',`پیامکِ تبریک برای ${fa(res.data?.queued||0)} نفر در صفِ ارسال قرار گرفت`);
    restore();
    return;
  }
  toast('', res.offline ? 'اتصال برقرار نشد — هیچ پیامکی ارسال نشد'
                        : (res.error?.message||'ارسالِ پیامک ناموفق بود'));
  restore();
}
