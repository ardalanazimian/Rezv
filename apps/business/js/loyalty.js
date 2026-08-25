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
  // ⚠️ `platinum` سطحِ چهارمِ بک‌اند است (lib/loyalty.ts، آستانه‌ی ۲۰۰۰ امتیاز).
  // تا ۲۰۲۶-۰۸-۲۵ اینجا وجود نداشت و بی‌خطر بود، چون هیچ کدی `tier` را
  // **نمی‌نوشت** و همه برای همیشه `bronze` می‌ماندند. حالا که سطح واقعاً
  // به‌روز می‌شود، نبودش یعنی وفادارترین اعضا از توزیعِ سطوح می‌افتند و
  // `tierName[m.tier]` برایشان `undefined` می‌دهد — یک دایره‌ی خالی در فهرست.
  const platinum=CLUB.filter(m=>m.tier==='platinum').length;
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
  const tiers=[['پلاتینیوم',platinum,'#7C93B8'],['طلایی',gold,'#F59E0B'],['نقره‌ای',silver,'#94A3B8'],['برنزی',bronze,'#D97706']];
  // نام‌ها عمداً با LOYALTY_TIERS در api/src/lib/loyalty.ts یکی‌اند.
  const tierName={platinum:'پلاتینیوم',gold:'طلایی',silver:'نقره‌ای',bronze:'برنزی'};
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
        <!-- ⚠️ رفعِ جعلِ موفقیت (فازِ ۲، پروتکل §۳ و §۲۸).
             این پنل قبلاً فرمِ «ثبت دستی عضو» بود که کاملاً محلی کار می‌کرد:
             یک کدِ ساختگیِ VIS-xxx می‌ساخت، «عضو جدید ثبت شد» می‌گفت، و با
             اولین رفرش ناپدید می‌شد. سه selectِ تاریخِ تولد هم دادهٔ حساس جمع
             می‌کردند و بی‌صدا دور می‌ریختند. عضویت در واقعیت **اتمیک** هنگامِ
             واک‌این/رزرو ساخته می‌شود (createWalkinTx). پس به‌جایِ فرمِ دروغین،
             همان مسیرِ واقعی. (تستِ رگرسیون: panels-batch8-regression.spec.ts)
             [merge ۰۸-۲۵] این تصمیم عمداً دست‌نخورده ماند. از کامیتِ aa5e0e7 یک
             مسیرِ واقعیِ POST /restaurant/members وجود دارد، پس ایرادِ «کدِ
             ساختگی» دیگر تکنیکاً برقرار نیست — ولی برگرداندنِ فرم یک تصمیمِ
             **محصولی** است («عضوی که هیچ‌وقت مهمانِ شما نبوده در سیستم معنا
             ندارد»)، نه یک رفعِ باگ، و کامیتِ merge جایِ بازکردنِ دوباره‌ی آن
             نیست. اگر لازم شد، PRِ جداگانه با بازبینی. جزئیات در
             docs/KNOWN_LIMITATIONS.md. -->
        <div style="background:var(--blue-50);border:1px solid #BFDBFE;border-radius:var(--r);padding:14px;font-size:13px;line-height:1.9;color:var(--t2)">
          ${icon('info',{size:14})} عضویتِ باشگاه هنگامِ <b>ثبتِ ورود (واک‌این)</b> یا <b>رزرو</b> به‌صورت خودکار و با کدِ واقعی ساخته می‌شود.
          <div style="margin-top:6px">ثبتِ دستیِ جدا وجود ندارد، چون عضوی که هیچ‌وقت مهمانِ شما نبوده در سیستم معنا ندارد.</div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" style="margin-top:14px" onclick="openWalkin()">${icon('users',{size:15})} رفتن به ثبتِ ورود</button>
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
// ⚠️ addMember حذف شد (فازِ ۲، §۳): کاملاً محلی بود و کدِ عضویتِ ساختگی
// نشان می‌داد. مسیرِ واقعیِ ساختِ عضو، واک‌این/رزرو است (createWalkinTx).
// [merge ۰۸-۲۵] این برنچ نسخه‌ای از آن را وصل به POST /restaurant/members
// واقعی برگردانده بود؛ در ادغام کنار گذاشته شد تا تصمیمِ محصولیِ #68 در یک
// کامیتِ merge بازنشود. خودِ endpoint و تست‌هایش می‌مانند (بدونِ مصرف‌کننده در
// پنل — در docs/KNOWN_LIMITATIONS.md ثبت شد).

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
