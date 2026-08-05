// ═══════════════════════════════════════════════════════════
//  رزرونو — Onboarding Wizard (بارِ اول) — C9
//  چند اسلایدِ مینیمالِ معرفی؛ فقط یک‌بار (localStorage rz_onboarded).
//  demo-safe و client-side. a11y: dialog، فوکوس، Enter=بعدی، Esc=رد شدن،
//  reduced-motion. تست‌های e2e با ست‌کردنِ rz_onboarded این را رد می‌کنند.
// ═══════════════════════════════════════════════════════════
import { lockAppSurfaces, unlockAppSurfaces } from '../auth.js';

const KEY = 'rz_onboarded';
const SLIDES = [
  { emoji:'🍽️', title:'بهترین رستوران‌های شهر', text:'کشف کن، ببین کجا شلوغه و چی محبوبه — با پیشنهادِ هوشمند بر اساس سلیقه‌ات.' },
  { emoji:'⚡', title:'رزرو، ساده مثل پیام دادن', text:'میز رزرو کن در چند ثانیه — بدون تماس، بدون معطلی.' },
  { emoji:'🎁', title:'امتیاز بگیر، کش‌بک ببر', text:'با هر رزرو امتیاز جمع کن و از باشگاهِ مشتریان کش‌بک بگیر.' },
];
let _i = 0;

function done(){
  try{ localStorage.setItem(KEY, '1'); }catch(e){}
  const ov = document.getElementById('onb');
  const wasOpen = !!ov && ov.classList.contains('show');
  if(ov) ov.classList.remove('show');
  if(wasOpen) unlockAppSurfaces();
}

function paint(){
  const s = SLIDES[_i];
  const ov = document.getElementById('onb'); if(!ov) return;
  ov.querySelector('.onb-emoji').textContent = s.emoji;
  ov.querySelector('.onb-title').textContent = s.title;
  ov.querySelector('.onb-text').textContent = s.text;
  ov.querySelectorAll('.onb-dot').forEach((d,i)=>d.classList.toggle('on', i===_i));
  ov.querySelector('.onb-next').textContent = _i===SLIDES.length-1 ? 'شروع کنیم' : 'بعدی';
}

function next(){ if(_i < SLIDES.length-1){ _i++; paint(); } else done(); }

function show(){
  let ov = document.getElementById('onb');
  if(!ov){
    ov = document.createElement('div');
    ov.id='onb'; ov.className='onb-overlay'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','معرفیِ رزرونو');
    ov.innerHTML =
      '<div class="onb-card" role="document">' +
        '<button class="onb-skip" type="button">رد شدن</button>' +
        '<div class="onb-emoji" aria-hidden="true"></div>' +
        '<div class="onb-title"></div>' +
        '<div class="onb-text"></div>' +
        '<div class="onb-dots" aria-hidden="true">' + SLIDES.map(()=> '<span class="onb-dot"></span>').join('') + '</div>' +
        '<button class="onb-next btn btn-primary btn-lg btn-block" type="button">بعدی</button>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.onb-skip').addEventListener('click', done);
    ov.querySelector('.onb-next').addEventListener('click', next);
    ov.addEventListener('keydown', e=>{
      if(e.key==='Escape'){ e.preventDefault(); done(); }
      else if(e.key==='Enter'){ e.preventDefault(); next(); }
    });
  }
  _i = 0; paint();
  const wasOpen = ov.classList.contains('show');
  ov.classList.add('show');
  if(!wasOpen) lockAppSurfaces();
  setTimeout(()=>{ const b=ov.querySelector('.onb-next'); if(b) try{b.focus()}catch(e){} }, 40);
}

function maybeShow(){
  try{ if(localStorage.getItem(KEY)) return; }catch(e){ return; }
  setTimeout(show, 500); // بعد از رندرِ اولیه‌ی اپ
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', maybeShow);
else setTimeout(maybeShow, 0);

// برای دیدنِ دوباره (اختیاری)
try{ window.showOnboarding = show; }catch(e){}
