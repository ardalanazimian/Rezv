// ═══ رزرونو — پنل business: مدیریتِ منو (Vanilla JS، بدون build، scope مشترک) ═══
//
// چرا این صفحه ساخته شد (ممیزیِ ۲۰۲۶-۰۸-۱۹): مدلِ MenuItem از ابتدا وجود داشت
// و در صفحه‌ی عمومیِ رستوران، پیش‌سفارشِ رزرو و گزارشِ پرفروش‌ها *خوانده*
// می‌شد، ولی هیچ راهی برایِ ساختنش نبود جز seedِ توسعه. یعنی رستورانِ واقعی
// برایِ همیشه منوی خالی داشت و چون تنها منبعِ مبلغ در رزرونو پیش‌سفارش از
// منوست، زنجیره‌ی پیش‌سفارش→مبلغ→CLV هرگز داده‌ای نمی‌گرفت.
//
// حالتِ خالی در برابرِ خطا عمداً از هم جدا نگه داشته می‌شوند: «منو خالی است»
// یک واقعیت است، «بارگیری نشد» یک شکست — هرگز دومی به‌شکلِ اولی نشان داده
// نمی‌شود.

let MENU_ITEMS = [];
let _menuLoaded = false;
/** آدرسِ عمومیِ منو — از سرور می‌آید، نه ساختِ رشته اینجا. null = رستوران slug ندارد. */
let MENU_PUBLIC_URL = null;

/** دسته‌هایِ پیشنهادی. متنِ آزاد است — رستوران می‌تواند دسته‌ی دلخواه بنویسد. */
const MENU_CATEGORY_SUGGESTIONS = ['پیش‌غذا', 'غذای اصلی', 'دسر', 'نوشیدنی', 'صبحانه'];

async function rMenu(){
  const el = document.getElementById('v-menu');
  if(!API.getToken()){
    el.innerHTML = `<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">
      ${icon('info',{size:24})}
      <div style="margin-top:8px">مدیریتِ منو به اتصالِ بک‌اند نیاز دارد — در حالتِ دمو در دسترس نیست.</div>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="panel" style="text-align:center;padding:40px;color:var(--t2)">در حال بارگیریِ منو…</div>`;

  const res = await API.menuList();
  if(!res.ok){
    // شکستِ واقعی — نه «منو خالی است». پیامِ سرور عیناً نشان داده می‌شود.
    const msg = res.offline ? 'اتصال به سرور برقرار نیست.' : (res.error?.message || 'بارگیریِ منو ناموفق بود.');
    el.innerHTML = `<div class="panel" style="text-align:center;padding:40px">
      <div style="margin-bottom:8px">${icon('alert',{size:28})}</div>
      <div style="font-weight:700;margin-bottom:6px">منو بارگیری نشد</div>
      <div style="color:var(--t2);font-size:13px;margin-bottom:16px">${esc(msg)}</div>
      <button class="btn btn-primary" onclick="rMenu()">تلاش دوباره</button>
    </div>`;
    return;
  }
  MENU_ITEMS = res.data.items || [];
  MENU_PUBLIC_URL = res.data.public_menu_url || null;
  _menuLoaded = true;
  menuRender();
}

function menuRender(){
  const el = document.getElementById('v-menu');
  const active = MENU_ITEMS.filter(i=>i.is_active).length;

  // گروه‌بندی بر اساسِ دسته، با «دسته‌بندی‌نشده» در انتها
  const groups = {};
  MENU_ITEMS.forEach(i=>{ const k = i.category || ''; (groups[k] = groups[k] || []).push(i); });
  const keys = Object.keys(groups).filter(k=>k).sort((a,b)=>a.localeCompare(b,'fa'));
  if(groups['']) keys.push('');

  el.innerHTML = `
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-head">
        <div>
          <div class="panel-title">منویِ رستوران</div>
          <div class="panel-sub">${fa(MENU_ITEMS.length)} آیتم · ${fa(active)} فعال</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="menuOpenForm()">${icon('plus',{size:15})} آیتمِ جدید</button>
      </div>
      <div class="cash-note" style="margin-top:4px">${icon('info',{size:13})}
        منو تنها منبعِ مبلغ در رزرونوست: مهمان از همین فهرست پیش‌سفارش می‌دهد و
        گزارشِ «خرج» و CLV از روی همان ساخته می‌شود. تا وقتی منو خالی باشد، مبلغ
        برایِ مشتریانِ شما «نامعلوم» می‌ماند.
      </div>
    </div>

    ${menuPublicCardHTML(active)}

    ${MENU_ITEMS.length === 0 ? `
      <div class="panel" style="text-align:center;padding:40px">
        <div style="margin-bottom:10px">${icon('menu',{size:30})}</div>
        <div style="font-weight:700;margin-bottom:6px">هنوز آیتمی در منو نیست</div>
        <div style="color:var(--t2);font-size:13px;margin-bottom:16px">اولین آیتم را اضافه کن تا مهمان‌ها بتوانند پیش‌سفارش بدهند.</div>
        <button class="btn btn-primary" onclick="menuOpenForm()">افزودنِ اولین آیتم</button>
      </div>` :
      keys.map(k=>`
        <div class="panel" style="margin-bottom:14px">
          <div class="panel-head"><div class="panel-title" style="font-size:15px">${k ? esc(k) : 'دسته‌بندی‌نشده'}</div></div>
          ${groups[k].map(menuRowHTML).join('')}
        </div>`).join('')
    }`;
}

// ═══════════════════════════════════════════════════════════════════════
//  کارتِ «منویِ عمومی / QR»
//
//  همان آدرسی که اینجا کپی می‌شود، داخلِ QR هم هست — چون هر دو از سرور
//  می‌آیند (`public_menu_url` و `X-Menu-Url`)، نه از رشته‌سازیِ اینجا.
// ═══════════════════════════════════════════════════════════════════════
function menuPublicCardHTML(activeCount){
  if(!MENU_PUBLIC_URL){
    // رستوران بدونِ slug صفحه‌ی عمومی ندارد. صریح گفته می‌شود، نه اینکه
    // کارت بی‌صدا غیب شود و رستوران‌دار فکر کند فیچر وجود ندارد.
    return `<div class="panel" style="margin-bottom:16px">
      <div class="panel-head"><div class="panel-title">منویِ عمومی و QR</div></div>
      <div style="color:var(--t2);font-size:13px">
        برای این رستوران هنوز نشانیِ عمومی (slug) ثبت نشده، پس صفحه‌ی منو و QR ساخته نمی‌شود.
        با پشتیبانی تماس بگیر تا نشانی را فعال کنیم.
      </div>
    </div>`;
  }

  return `<div class="panel" style="margin-bottom:16px">
    <div class="panel-head">
      <div>
        <div class="panel-title">منویِ عمومی و QR</div>
        <div class="panel-sub">مهمان با اسکنِ این کد، منو را روی موبایلش می‌بیند — بدونِ نصبِ اپ و بدونِ ورود.</div>
      </div>
    </div>

    ${activeCount === 0 ? `
      <div class="cash-note" style="margin-bottom:10px;border-color:var(--amber,#d97706)">
        ${icon('alert',{size:13})}
        هیچ آیتمِ <b>فعالی</b> در منو نیست، پس صفحه‌ی عمومی فعلاً خالی نشان داده می‌شود.
        قبل از چاپِ QR دستِ‌کم یک آیتم را فعال کن.
      </div>` : ''}

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
      <input class="inp" id="menuPubUrl" readonly value="${esc(MENU_PUBLIC_URL)}" style="flex:1;min-width:200px;direction:ltr;text-align:left">
      <button class="btn btn-sm btn-ghost" onclick="menuCopyUrl()">${icon('copy',{size:14})} کپی</button>
      <a class="btn btn-sm btn-ghost" href="${esc(MENU_PUBLIC_URL)}" target="_blank" rel="noopener">پیش‌نمایش</a>
    </div>

    <div id="menuQrBox" style="text-align:center;padding:12px 0">
      <button class="btn btn-primary btn-sm" onclick="menuLoadQr()">ساختنِ QR</button>
    </div>
  </div>`;
}

async function menuCopyUrl(){
  const el = document.getElementById('menuPubUrl');
  if(!el) return;
  try{
    await navigator.clipboard.writeText(el.value);
    toast('✓','آدرس کپی شد');
  }catch{
    // clipboard API روی http یا مرورگرِ قدیمی کار نمی‌کند — انتخابِ متن
    // دستِ‌کم کپیِ دستی را یک کلیدِ ترکیبی می‌کند.
    el.select();
    toast('','کپیِ خودکار ممکن نشد — با Ctrl+C کپی کن');
  }
}

/** SVGِ QR را از سرور می‌گیرد و همراهِ دکمه‌های دانلود نشان می‌دهد. */
async function menuLoadQr(){
  const box = document.getElementById('menuQrBox');
  if(!box) return;
  box.innerHTML = `<div style="color:var(--t2);font-size:13px">در حال ساختِ QR…</div>`;

  const res = await API.menuQrSvg(512);
  if(!res.ok){
    box.innerHTML = `<div style="color:var(--t2);font-size:13px;margin-bottom:8px">
        ${esc(res.offline ? 'اتصال به سرور برقرار نیست.' : (res.error?.message || 'ساختِ QR ناموفق بود.'))}
      </div>
      <button class="btn btn-sm btn-ghost" onclick="menuLoadQr()">تلاش دوباره</button>`;
    return;
  }

  // SVG از APIِ خودمان می‌آید (نه ورودیِ کاربر) و متنِ داخلش را هم سرور از
  // slug ساخته، نه از چیزی که کلاینت فرستاده باشد.
  _menuQrSvg = res.data.svg;
  // SVG با عرضِ ثابتِ ۵۱۲ می‌آید (همان اندازه‌ای که برایِ دانلود می‌خواهیم)، ولی
  // در پنلِ موبایل باید کوچک شود وگرنه از کارت بیرون می‌زند و صفحه را افقی
  // اسکرول می‌کند — در تستِ مرورگر روی ۴۲۰px دقیقاً همین رخ داد.
  // `max-width` روی خودِ svg اعمال می‌شود، نه فقط قاب.
  box.innerHTML = `
    <div style="background:#fff;display:inline-block;padding:12px;border-radius:12px;max-width:100%">
      <div style="max-width:260px;margin:0 auto">
        <style>#menuQrBox svg{width:100%;height:auto;display:block}</style>
        ${_menuQrSvg}
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap">
      <button class="btn btn-sm btn-ghost" onclick="menuDownloadQr('svg')">دانلودِ SVG</button>
      <button class="btn btn-sm btn-ghost" onclick="menuDownloadQr('png')">دانلودِ PNG</button>
    </div>
    <div style="color:var(--t2);font-size:12px;margin-top:8px">
      SVG برایِ چاپ (هر اندازه، بدونِ افتِ کیفیت) · PNG برایِ شبکه‌های اجتماعی
    </div>`;
}

let _menuQrSvg = null;

/** دانلودِ QR. PNG در خودِ مرورگر از SVG رندر می‌شود — بدونِ رفت‌وبرگشتِ اضافه. */
function menuDownloadQr(fmt){
  if(!_menuQrSvg) return;
  const name = 'rezervno-menu-qr';
  if(fmt === 'svg'){
    menuTriggerDownload(new Blob([_menuQrSvg], { type:'image/svg+xml' }), name + '.svg');
    return;
  }
  // SVG → canvas → PNG. اندازه‌ی ۱۰۲۴ عمدی است: QR در چاپ اغلب بزرگ‌تر از
  // نمایشِ صفحه لازم می‌شود و بزرگ‌کردنِ PNGِ کوچک آن را ناخوانا می‌کند.
  const SIZE = 1024;
  const img = new Image();
  const svgUrl = URL.createObjectURL(new Blob([_menuQrSvg], { type:'image/svg+xml' }));
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d');
    // پس‌زمینه‌ی سفیدِ صریح: PNGِ شفاف روی تمِ تیره‌ی نمایشگر/چاپ سیاه‌روی‌سیاه
    // می‌شود و اسکنر نمی‌خواندش.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    URL.revokeObjectURL(svgUrl);
    c.toBlob(b => { if(b) menuTriggerDownload(b, name + '.png'); });
  };
  img.onerror = () => { URL.revokeObjectURL(svgUrl); toast('','ساختِ PNG ناموفق بود — SVG را دانلود کن'); };
  img.src = svgUrl;
}

function menuTriggerDownload(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function menuRowHTML(i){
  return `<div class="top-cust" style="cursor:default;${i.is_active?'':'opacity:.55'}">
    <span class="top-ava">${i.emoji ? esc(i.emoji) : icon('menu',{size:16})}</span>
    <div class="top-body">
      <div class="top-name">${esc(i.name)}${i.is_active?'':' <span class="seg-vip" style="background:var(--t3)">غیرفعال</span>'}</div>
      <div class="top-meta">${fnMoney(i.price_toman)} تومان${i.sold_count?` · ${fa(i.sold_count)} فروش`:''}</div>
    </div>
    <button class="btn btn-sm btn-ghost" onclick="menuOpenForm('${esc(i.id)}')">ویرایش</button>
    <button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="menuDelete('${esc(i.id)}')">حذف</button>
  </div>`;
}

function fnMoney(n){ return fa((n||0).toLocaleString('en-US')); }

/** فرمِ ساخت/ویرایش. بدونِ id یعنی ساختِ آیتمِ تازه. */
function menuOpenForm(id){
  const it = id ? MENU_ITEMS.find(x=>x.id===id) : null;
  openModal(`
    <div class="modal-title">${it ? 'ویرایشِ آیتم' : 'آیتمِ جدیدِ منو'}</div>
    <div class="field-label" style="margin-top:12px">نام</div>
    <input class="inp" id="miName" maxlength="120" value="${it?esc(it.name):''}" placeholder="مثلاً پاستا کربونارا">
    <div class="field-label">قیمت (تومان)</div>
    <input class="inp" id="miPrice" type="number" min="0" value="${it?it.price_toman:''}" placeholder="۱۸۵۰۰۰">
    <div class="field-label">دسته</div>
    <input class="inp" id="miCat" maxlength="60" list="miCatList" value="${it&&it.category?esc(it.category):''}" placeholder="اختیاری">
    <datalist id="miCatList">${MENU_CATEGORY_SUGGESTIONS.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
    <div class="field-label">ایموجی</div>
    <input class="inp" id="miEmoji" maxlength="16" value="${it&&it.emoji?esc(it.emoji):''}" placeholder="اختیاری — مثلاً 🍝">
    <div class="field-label">توضیح</div>
    <input class="inp" id="miDesc" maxlength="300" value="${it&&it.description?esc(it.description):''}" placeholder="اختیاری — مثلاً «با سسِ قارچ و پنیرِ پارمزان»">
    <div class="field-label">آدرسِ عکس</div>
    <input class="inp" id="miImg" maxlength="500" value="${it&&it.image_url?esc(it.image_url):''}" placeholder="اختیاری — با https:// شروع شود" style="direction:ltr;text-align:left">
    <div class="field-label">ترتیبِ نمایش</div>
    <input class="inp" id="miSort" type="number" min="0" value="${it&&it.sort_order!=null?it.sort_order:0}" placeholder="۰">
    <div style="color:var(--t2);font-size:12px;margin-top:4px">
      عددِ کوچک‌تر بالاتر نشان داده می‌شود. آیتم‌هایِ هم‌عدد بر اساسِ نام مرتب می‌شوند.
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin:12px 0">
      <input type="checkbox" id="miActive" ${!it || it.is_active ? 'checked' : ''}>
      <span>در منو نمایش داده شود</span>
    </label>
    <button class="btn btn-primary btn-block" onclick="menuSave(${id?`'${esc(id)}'`:'null'})">${it?'ذخیره':'افزودن'}</button>`);
}

async function menuSave(id){
  const name = (document.getElementById('miName').value||'').trim();
  const price = parseInt(document.getElementById('miPrice').value, 10);
  if(!name){ toast('','نامِ آیتم لازم است'); return; }
  if(!Number.isFinite(price) || price < 0){ toast('','قیمت را درست وارد کن'); return; }

  const img = (document.getElementById('miImg').value||'').trim();
  // همان قیدی که سرور اعمال می‌کند — اینجا فقط برایِ بازخوردِ فوری، نه به‌جایِ آن.
  if(img && !/^https?:\/\//i.test(img)){ toast('','آدرسِ عکس باید با http:// یا https:// شروع شود'); return; }
  const sort = parseInt(document.getElementById('miSort').value, 10);

  const body = {
    name,
    price_toman: price,
    category: (document.getElementById('miCat').value||'').trim() || null,
    emoji: (document.getElementById('miEmoji').value||'').trim() || null,
    is_active: document.getElementById('miActive').checked,
    description: (document.getElementById('miDesc').value||'').trim() || null,
    image_url: img || null,
    sort_order: Number.isFinite(sort) && sort >= 0 ? sort : 0,
  };
  const res = id ? await API.menuUpdate(id, body) : await API.menuCreate(body);
  if(!res.ok){
    toast('', res.offline ? 'اتصال به سرور برقرار نیست' : (res.error?.message || 'ذخیره نشد'));
    return;
  }
  closeModal();
  toast('✓', id ? 'آیتم به‌روزرسانی شد' : 'آیتم به منو اضافه شد');
  rMenu();
}

async function menuDelete(id){
  const it = MENU_ITEMS.find(x=>x.id===id);
  if(!confirm(`«${it?it.name:'این آیتم'}» از منو حذف شود؟`)) return;
  const res = await API.menuDelete(id);
  if(!res.ok){
    toast('', res.offline ? 'اتصال به سرور برقرار نیست' : (res.error?.message || 'حذف نشد'));
    return;
  }
  // سرور ممکن است به‌جایِ حذف، بایگانی کرده باشد (آیتمی که در پیش‌سفارشِ
  // ثبت‌شده به‌کار رفته حذف نمی‌شود تا سابقه‌ی مبلغ سالم بماند). پیامِ خودِ
  // سرور نشان داده می‌شود تا رستوران‌دار دقیقاً بداند چه شد.
  toast(res.data?.archived ? '' : '✓', res.data?.message || 'آیتم حذف شد');
  rMenu();
}
