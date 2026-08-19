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

  const body = {
    name,
    price_toman: price,
    category: (document.getElementById('miCat').value||'').trim() || null,
    emoji: (document.getElementById('miEmoji').value||'').trim() || null,
    is_active: document.getElementById('miActive').checked,
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
