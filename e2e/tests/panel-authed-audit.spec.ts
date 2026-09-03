import { test, expect, type Page } from '@playwright/test';
import { mockAdminOtpFlag } from './helpers/mock-api';

// ═══════════════════════════════════════════════════════════════════════
//  ممیزیِ پنل در حالتِ **واردشده** (§۷ و §۱۷)
//
//  چرا این فایل لازم بود: ممیزیِ قبلی فقط صفحه‌ی اولِ هر پنل را می‌دید — و
//  صفحه‌ی اولِ business/company یک **دروازه‌ی ورود** است. یعنی تمامِ رابطِ
//  واقعیِ پنل (پلانِ سالن، گالری، لیستِ رزرو، لیستِ انتظار) هرگز سنجیده نشده
//  بود و «سبز»ِ آن ممیزی درباره‌ی این صفحه‌ها هیچ نمی‌گفت.
//
//  ورود از مسیرِ دموِ آفلاینِ خودِ محصول انجام می‌شود (کدِ ۱۲۳۴ وقتی بک‌اند
//  در دسترس نیست) — رفتارِ موجود، نه چیزی که برایِ تست ساخته باشیم.
// ═══════════════════════════════════════════════════════════════════════

const PANELS = [
  { name: 'business', url: 'http://localhost:8081/', phone: '#staffPhone', send: '#staffSendBtn', code: '#staffCode', verify: '#staffVerifyBtn' },
  { name: 'company',  url: 'http://localhost:8082/', phone: '#adminPhone', send: '#adminSendBtn',  code: '#adminCode',  verify: '#adminVerifyBtn' },
];

/** پاسخِ موفقِ OTPِ کارکنان/ادمین را mock می‌کنیم.
 *  چرا mock و نه مسیرِ دموِ آفلاین: سرورِ استاتیکِ تست برایِ `/api/...` یک
 *  ۴۰۴ِ HTML برمی‌گرداند، نه خطایِ شبکه — پس شرطِ `res.offline` هرگز true
 *  نمی‌شود و دروازه باز نمی‌ماند. اینجا هدف ممیزیِ **رابط** است نه احراز هویت،
 *  پس کوتاه‌ترین مسیرِ درست، پاسخِ واقعیِ سرور است. */
async function mockStaffAuth(page: Page) {
  await page.route('**/auth/*/request', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, dev_code: '1234' }) }));
  await page.route('**/auth/*/verify', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      access: 'demo-access', refresh: 'demo-refresh',
      staff: { role: 'owner', restaurant_name: 'کافه‌رستوران ویستا [DEMO]', permissions: null },
      admin: { role: 'admin', name: 'ادمین [DEMO]' },
    }) }));
  // بقیه‌ی APIها: پاسخِ خالیِ معتبر تا پنل بدونِ خطا رندر شود
  await page.route('**/api/v1/**', (r) => {
    if (/\/auth\//.test(r.request().url())) return r.fallback();
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[],"items":[],"total":0}' });
  });
}

async function loginDemo(page: Page, p: typeof PANELS[number]) {
  await mockStaffAuth(page);
  await mockAdminOtpFlag(page);
  await page.goto(p.url);
  // [هم‌ترازی با ورودِ جدید ۲۰۲۶-۰۸-۲۶] پیش‌فرض «نام کاربری و رمز» است؛ به فرمِ پیامکی سوییچ کن.
  { const _t = page.locator('button:has-text("ورود با پیامک")'); if (await _t.isVisible().catch(() => false)) await _t.click(); }
  await page.locator(p.phone).waitFor({ timeout: 15_000 });
  await page.locator(p.phone).fill('09123456789');
  await page.locator(p.send).click();
  await page.locator(p.code).waitFor({ timeout: 15_000 });
  await page.locator(p.code).fill('1234');
  await page.locator(p.verify).click();
  // دروازه باید واقعاً باز شده باشد
  await expect(page.locator('#loginOverlay')).toBeHidden({ timeout: 15_000 });
}

/** کنترل‌هایِ تعاملیِ زیرِ ۲۴×۲۴ (WCAG 2.2 §2.5.8) که واقعاً دیده می‌شوند. */
async function tinyTargets(page: Page) {
  return page.evaluate(() => {
    const SEL = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
    const out: string[] = []; const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(SEL))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.pointerEvents === 'none') continue;
      if (parseFloat(st.opacity) < 0.15) continue;
      if (r.width < 24 || r.height < 24) {
        const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
          + (typeof el.className === 'string' && el.className.trim()
              ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        if (seen.has(sel)) continue; seen.add(sel);
        out.push(`${sel} → ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return out;
  });
}

for (const p of PANELS) {
  test(`${p.name}: بعد از ورود، کنترلِ زیرِ ۲۴×۲۴ ندارد (۳۹۰px)`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 390, height: 844 });
    await loginDemo(page, p);
    await page.waitForTimeout(1000);

    // ⚠️ نسخه‌ی اولِ همین تست سبز شد ولی **هیچ‌چیز را ندیده بود**: سلکتورش
    // (`.sb-nav-item, .nav-item, [data-page]`) با هیچ عنصری مطابقت نداشت، پس
    // حلقه اصلاً اجرا نشد و فقط صفحه‌ی اول سنجیده شد. سلکتورِ واقعی
    // `.sb-item[data-v]` است. برای همین حالا **صریحاً assert می‌شود که چند
    // صفحه پیدا شده** — تستی که چیزی را نمی‌گردد نباید حق داشته باشد سبز شود.
    const views = await page.$$eval('.sb-item[data-v]', (els) =>
      els.map((e) => e.getAttribute('data-v')).filter(Boolean) as string[]);
    expect(views.length, 'هیچ آیتمِ ناوبری‌ای پیدا نشد — تست عملاً چیزی نمی‌سنجد').toBeGreaterThan(3);

    const bad: string[] = [];
    const first = await tinyTargets(page);
    if (first.length) bad.push(`[صفحه‌ی اول] ${first.join(' · ')}`);

    // به‌جای کلیک (که رویِ ۳۹۰px کشو بسته است و ناپایدار می‌شود) از خودِ تابعِ
    // ناوبریِ محصول استفاده می‌شود — همان چیزی که onclick صدا می‌زند.
    for (const v of views) {
      const ok = await page.evaluate((view) => {
        const w = window as unknown as { nav?: (v: string) => void };
        if (typeof w.nav !== 'function') return false;
        w.nav(view); return true;
      }, v);
      if (!ok) break;
      await page.waitForTimeout(500);
      const t = await tinyTargets(page);
      if (t.length) bad.push(`[${v}] ${t.join(' · ')}`);
    }
    expect(bad, `کنترل‌هایِ کوچک در حالتِ واردشده (${views.length} صفحه گشته شد):\n${bad.join('\n')}`).toEqual([]);
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  کنتراستِ WCAG AA در صفحه‌هایِ **واردشده‌ی** پنل
//  ممیزیِ کنتراستِ قبلی هم دقیقاً همین نقطه‌کور را داشت: برایِ business/company
//  فقط دروازه‌ی ورود را می‌سنجید. اینجا همان سنجه رویِ تمامِ صفحه‌هایِ داخلی
//  اجرا می‌شود. (عنصرِ رویِ گرادیان کنار گذاشته می‌شود — همان محافظه‌کاریِ
//  سنجه‌ی اصلی، تا مثبتِ کاذب نسازد.)
// ═══════════════════════════════════════════════════════════════════════
async function contrastFails(page: Page) {
  return page.evaluate(() => {
    const srgb=(v:number)=>{const s=v/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4)};
    const lum=(a:number[])=>0.2126*srgb(a[0])+0.7152*srgb(a[1])+0.0722*srgb(a[2]);
    const P=(s:string)=>{const m=s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);return m?[+m[1],+m[2],+m[3],m[4]===undefined?1:+m[4]]:null};
    const over=(f:number[],b:number[])=>[0,1,2].map(i=>f[i]*f[3]+b[i]*(1-f[3]));
    // ⚠️ نکته‌ی مهم (یافته‌ی ۲۰۲۶-۰۸-۲۴): «والدِ DOM» همیشه «پس‌زمینه‌ی دیداری»
    // نیست. `.bar-val` با `position:absolute;top:-22px` از کادرِ میله بیرون
    // می‌زند و عملاً روی زمینه‌ی نمودار می‌نشیند، نه روی خودِ میله. اسکنر
    // نخست همان میله را پس‌زمینه گرفت و یک شکستِ **کاذب** گزارش کرد.
    // پس هر جدی که کادرش عنصر را در بر نمی‌گیرد، رد می‌شود.
    // گارد فقط برایِ عنصرِ absolute/fixed اعمال می‌شود — نه همه. اگر روی همه
    // اعمال شود، فرزندِ یک ردیفِ اسکرولِ افقی هم رد می‌شود و تابع به سفیدِ
    // پیش‌فرض می‌افتد؛ یعنی مثبتِ کاذب می‌سازد به‌جای اینکه جلویش را بگیرد.
    const R=(e:Element)=>e.getBoundingClientRect();
    const hits=(a:DOMRect,b:DOMRect)=>
      a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
    const bgOf=(el:Element):number[]|null=>{const st:number[][]=[];const er=R(el);
      const ps=getComputedStyle(el).position; const esc=ps==='absolute'||ps==='fixed';
      let n:Element|null=el;
      while(n){
        if(esc && n!==el && !hits(R(n), er)){ n=n.parentElement; continue; }
        const cs=getComputedStyle(n); if(cs.backgroundImage&&cs.backgroundImage!=='none')return null;
        const c=P(cs.backgroundColor); if(c&&c[3]>0){st.push(c); if(c[3]===1)break;} n=n.parentElement;}
      if(!st.length)return [255,255,255]; let acc=st[st.length-1].slice(0,3);
      for(let i=st.length-1;i>=0;i--)acc=over(st[i],acc); return acc;};
    const out:string[]=[]; const seen=new Set<string>();
    for(const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))){
      const own=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>(n.textContent||'').trim()).join(' ').trim();
      if(!own) continue;
      if(!/\p{L}|\p{N}/u.test(own)) continue;
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.15) continue;
      const r=el.getBoundingClientRect(); if(!r.width||!r.height) continue;
      const f0=P(cs.color); if(!f0) continue;
      const bg=bgOf(el); if(!bg) continue;
      const fg=f0[3]<1?over(f0,bg):f0.slice(0,3);
      const ratio=(Math.max(lum(fg),lum(bg))+0.05)/(Math.min(lum(fg),lum(bg))+0.05);
      const size=parseFloat(cs.fontSize); const w=parseInt(cs.fontWeight,10)||400;
      if(ratio<((size>=24||(size>=18.66&&w>=700))?3:4.5)){
        const sel=el.tagName.toLowerCase()+(el.id?'#'+el.id:'')
          +(typeof el.className==='string'&&el.className.trim()?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'');
        if(seen.has(sel)) continue; seen.add(sel);
        out.push(`${sel} «${own.slice(0,22)}» ${Math.round(ratio*100)/100}:1 (${size}px) `
          + `fg=rgb(${fg.map(Math.round).join(',')}) bg=rgb(${bg.map(Math.round).join(',')})`);
      }
    }
    return out;
  });
}

for (const p of PANELS) {
  test(`${p.name}: بعد از ورود، کنتراستِ AA در همه‌ی صفحه‌ها`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 390, height: 844 });
    await loginDemo(page, p);
    await page.waitForTimeout(900);
    const views = await page.$$eval('.sb-item[data-v]', (els) =>
      els.map((e) => e.getAttribute('data-v')).filter(Boolean) as string[]);
    expect(views.length, 'هیچ صفحه‌ای پیدا نشد').toBeGreaterThan(3);

    const bad: string[] = [];
    for (const v of views) {
      const ok = await page.evaluate((view) => {
        const w = window as unknown as { nav?: (v: string) => void };
        if (typeof w.nav !== 'function') return false;
        w.nav(view); return true;
      }, v);
      if (!ok) break;
      await page.waitForTimeout(500);
      const t = await contrastFails(page);
      if (t.length) bad.push(`[${v}]\n    ` + t.join('\n    '));
    }
    expect(bad, `افتِ کنتراست در صفحه‌هایِ واردشده (${views.length} صفحه):\n${bad.join('\n')}`).toEqual([]);
  });
}
