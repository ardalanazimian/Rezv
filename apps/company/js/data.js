// ═══ رزرونو — پنل company: داده‌ی نمونه + برچسب‌ها + مسیریابی (Vanilla JS، scope مشترک) ═══
const RESTAURANTS_SAMPLE=[
  {id:1,smsBalance:2400,name:'کافه‌رستوران ویستا',logo:'🌿',grad:'linear-gradient(135deg,#34D399,#059669)',city:'تهران، ولنجک',plan:'pro',status:'active',isOpen:true,daysLeft:218,members:1240,reservations:3420,sms:8600,rating:4.8,joined:'۱۴۰۳/۰۸'},
  {id:2,smsBalance:1150,name:'سفره‌خانه سنتی گرام',logo:'🍵',grad:'linear-gradient(135deg,#F59E0B,#D97706)',city:'اصفهان، چهارباغ',plan:'pro',status:'active',isOpen:true,daysLeft:142,members:890,reservations:2180,sms:5400,rating:4.6,joined:'۱۴۰۳/۰۹'},
  {id:3,smsBalance:60,name:'رستوران دریایی سارا',logo:'🦞',grad:'linear-gradient(135deg,#0EA5E9,#0369A1)',city:'بندرعباس، ساحل',plan:'basic',status:'expiring',isOpen:true,daysLeft:8,members:430,reservations:920,sms:1900,rating:4.4,joined:'۱۴۰۴/۰۱'},
  {id:4,smsBalance:820,name:'کافه هانا',logo:'☕',grad:'linear-gradient(135deg,#8B5CF6,#6D28D9)',city:'تهران، فرشته',plan:'pro',status:'active',isOpen:true,daysLeft:95,members:670,reservations:1540,sms:3200,rating:4.7,joined:'۱۴۰۳/۱۱'},
  {id:5,smsBalance:0,name:'پیتزا ایتالیا',logo:'🍕',grad:'linear-gradient(135deg,#EF4444,#B91C1C)',city:'شیراز، معالی‌آباد',plan:'basic',status:'expired',isOpen:false,daysLeft:-12,members:310,reservations:760,sms:1200,rating:4.2,joined:'۱۴۰۳/۱۲'},
  {id:6,smsBalance:140,name:'رستوران آوا',logo:'🍽️',grad:'linear-gradient(135deg,#EC4899,#BE185D)',city:'تهران، سعادت‌آباد',plan:'trial',status:'trial',isOpen:true,daysLeft:5,members:48,reservations:62,sms:140,rating:4.5,joined:'۱۴۰۴/۰۳'},
  {id:7,smsBalance:1900,name:'کبابسرای البرز',logo:'🔥',grad:'linear-gradient(135deg,#F97316,#C2410C)',city:'کرج، گوهردشت',plan:'pro',status:'active',isOpen:true,daysLeft:174,members:1020,reservations:2650,sms:6100,rating:4.5,joined:'۱۴۰۳/۰۷'},
  {id:8,smsBalance:75,name:'سوشی توکیو',logo:'🍣',grad:'linear-gradient(135deg,#14B8A6,#0F766E)',city:'تهران، زعفرانیه',plan:'basic',status:'active',isOpen:true,daysLeft:56,members:520,reservations:1180,sms:2400,rating:4.6,joined:'۱۴۰۳/۱۰'},
];
// RESTAURANTS متغیر زنده: اول نمونه (فقط تا قبل از بارگذاری اول)، بعد همیشه از API
let RESTAURANTS = RESTAURANTS_SAMPLE;
// ⚠️ رفعِ «پلن undefined» (فازِ ۲، §۲۶–۲۹): این نگاشت با enumِ واقعیِ بک‌اند
// (SubscriptionPlan = free | starter | pro | enterprise) هم‌خوان نبود — دو
// کلیدِ ناموجود داشت (trial/basic) و کلیدِ واقعیِ starter را نداشت. هر تنانتی
// که از مسیرِ فعال‌سازیِ همین پنل رویِ starter می‌رفت، «پلن undefined» می‌شد.
// کلیدهایِ قدیمی برایِ داده‌ی نمونه‌ی موجود نگه داشته شدند.
const PLAN_LABEL={free:'رایگان',starter:'شروع',pro:'حرفه‌ای',enterprise:'سازمانی',trial:'آزمایشی',basic:'پایه'};
const STATUS_LABEL={active:'فعال',expiring:'رو به اتمام',expired:'منقضی',trial:'دوره آزمایشی',trial_expired:'آزمایشی تمام‌شده'};

const TITLES={overview:'داشبورد',restaurants:'رستوران‌ها',detail:'جزئیات رستوران',analytics:'آنالیز پلتفرم',customers:'هوش تجاری مشتریان',billing:'اشتراک و پیامک',sales:'درخواست‌های سایت',photos:'بازبینی عکسِ گالری',hours:'تأییدِ ساعتِ کاری',systemhealth:'سلامت سیستم',aihealth:'سلامتِ مدل‌هایِ هوشِ مصنوعی',security:'امنیت پلتفرم',support:'مدیریت رستوران‌ها',badges:'نشان‌های پلتفرم',missions:'ماموریت‌های پلتفرم'};
let restFilter='all';
let currentRest=null; // رستوران انتخاب‌شده برای صفحه‌ی جزئیات

function nav(v){
  try{ if(window.rzTrack) window.rzTrack('page.viewed',{page:v}); }catch(e){}
  document.querySelectorAll('.sb-item[data-v]').forEach(b=>b.classList.toggle('active',b.dataset.v===v));
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.getElementById('v-'+v).classList.add('active');
  document.getElementById('pageTitle').textContent=TITLES[v]||'';
  // «درخواست‌های سایت» به‌جای رندرِ مستقیم، اول از API می‌خواند (rSales را خودش صدا می‌زند).
  // «درخواست‌های سایت» و «بازبینی عکس» اول از API می‌خوانند (رندر را خودشان صدا می‌زنند).
  ({overview:rOverview,restaurants:rRestaurants,detail:rDetail,analytics:rAnalytics,customers:rCustomers,billing:rBilling,sales:loadSales,photos:loadPhotos,hours:loadHoursChanges,systemhealth:rSystemHealth,aihealth:rModelHealth,security:rSecurity,support:rSupport,badges:rBadges,missions:rMissions})[v]();
  if(window.innerWidth<=900){document.getElementById('sidebar').classList.remove('open');document.getElementById('sbOverlay').classList.remove('show')}
}

// ════════ داشبورد کلی ════════
