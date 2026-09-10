#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ C1 — «هیچ چیزی برایت پول، امتیاز یا اعتبار خرج نمی‌کند تا وقتی
//  نشانت داده نشده باشد.»
//
//  این تنها ادعایی است که در `docs/audit/research/MATRIX.md` برای ما `REAL`
//  و برای **چهار رقیب** `ABSENT` است — یعنی تنها خطی که برند رویش شرط بسته.
//  سلولش `REAL today, **UNPINNED**` بود: امروز راست، و هیچ‌چیز در CI مانعِ
//  غلط‌شدنش با یک کامیتِ آینده. این فایل همان پین است.
//
//  شرحِ کامل و اندازه‌گیری‌هایش: docs/audit/backend/BE-004-...md
//
//  ── شرطی که می‌سنجد ──────────────────────────────────────────────────
//      برای هر فیلدِ هزینه‌زا f:      enforced(f)  ⇒  exposed_to_diner(f)
//
//  ⚠️ **دوشرطی است، نه فهرست‌وار — و این کلِ طراحی است.** یک گاردِ ساده‌تر
//  می‌توانست بنویسد «امروز هیچ‌کدام از این فیلدها اجرا نمی‌شوند» و سبز بماند.
//  آن گارد با **اولین سیم‌کشی** هم سبز می‌ماند، یعنی دقیقاً همان لحظه‌ای را
//  از دست می‌دهد که برای گرفتنش ساخته شده. خطر **گذار** است نه وضعِ فعلی:
//  فیلدی که خواننده‌ی تازه‌ی اجراکننده پیدا می‌کند و هم‌زمان افشا پیدا نمی‌کند.
//
//  ── دامنه: سه نوع هزینه، نه دو ────────────────────────────────────────
//  جمله‌ی اولیه‌ی پوزیشنینگ «پول یا امتیاز» می‌گفت. اندازه‌گیریِ ۲۰۲۶-۰۹-۱۰
//  نشان داد **تنها کسرِ واقعاً اجراشونده‌ی امروز هیچ‌کدامِ آن دو نیست**:
//  `economy.ts` برای لغوِ دیرهنگام امتیازِ اعتبارِ ۳۵ (به‌جای ۸۵) و یک
//  `strike` می‌نویسد — در `customer_economy_profiles`، **نه** در
//  `points_ledger` (گرپ روی آن فایل کدِ ۱ می‌دهد). و آن strike جلوی سطحِ
//  platinum را می‌گیرد و به رستوران‌ها نشان داده می‌شود.
//
//  اگر دامنه «پول یا امتیاز» می‌ماند، این گارد باید عمداً یک کسرِ **واقعی**
//  را نادیده می‌گرفت — گاردی که می‌داند کجا نگاه نکند، همان جعلی‌سبزِ کلاسیک
//  است. پس دامنه با حکمِ CEO (۲۰۲۶-۰۹-۱۰) سه‌گانه شد و جمله هم گشاد می‌شود.
//
//  ── ثابتِ طراحی، همان قاعده‌ی check-status-label-binding ─────────────
//      **لنگرِ گم‌شده، فهرستِ خالی، یا فایلِ ناموجود ⇦ خطا. هرگز `continue`.**
//  گاردی که سوژه‌اش را پیدا نکند و سبز بماند بدتر از نبودنش است.
//
//  ── ⚠️ چیزی که این گارد **نمی‌سنجد** — و باید بلند گفته شود ──────────
//  این ابزار فقط می‌سنجد که **داده در دسترسِ اپ هست یا نه**. نمی‌سنجد که
//  اپ آن را صادقانه رندر می‌کند. یعنی سبزِ این گارد به‌تنهایی معنی‌اش
//  «ادعا راست است» **نیست**؛ معنی‌اش «اپ می‌تواند راست بگوید» است.
//  نیمه‌ی رندر مالِ `apps/customer` است (تصمیمِ CEO، ۲۰۲۶-۰۹-۱۰).
//  یک گاردِ سبز کنارِ یک متنِ دروغ از نبودِ گارد بدتر است، چون بعدش کسی
//  نگاه نمی‌کند.
//
//  اجرا:  node tools/check-diner-cost-disclosure.mjs
//  خروج:  0 = هم‌داستان · 1 = نقضِ C1 یا انحرافِ baseline · 2 = گارد اجرا نشد
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = join(REPO, 'api', 'src');
const SCHEMA = join(REPO, 'api', 'prisma', 'schema.prisma');

const GATE_DID_NOT_RUN = 2;

function bail(msg) {
  console.error('');
  console.error('⛔ گارد اجرا نشد — این «نقض» نیست.');
  console.error('   دلیل: ' + msg);
  console.error('   کدِ خروج: ' + GATE_DID_NOT_RUN + ' — متمایز از ۰ (سالم) و ۱ (نقضِ واقعی)');
  process.exit(GATE_DID_NOT_RUN);
}

// ═══════════════════════════════════════════════════════════════════════
//  سیاهه‌ی فیلدهای هزینه‌زا.
//
//  هر ردیف با اندازه‌گیری روی HEAD پر شده، نه با نقل از پانویس. اگر ردیفی
//  اضافه می‌کنی، `readers` را با یک گرپِ واقعی بگیر — نه از حافظه.
//
//  `mustDisclose: true`  یعنی این فیلد امروز کسری را تعیین می‌کند که به
//  مشتری می‌رسد، پس **باید** در یک پاسخِ روبه‌مشتری باشد.
//  `mustDisclose: false` یعنی امروز هیچ مسیری آن را به کسر تبدیل نمی‌کند.
//  آن ردیف‌ها با `readers` پین می‌شوند: خواننده‌ی تازه = گارد قرمز = یک
//  انسان تصمیم می‌گیرد «آیا این اجرا است؟».
// ═══════════════════════════════════════════════════════════════════════
const INVENTORY = [
  {
    id: 'payment_enabled',
    field: 'paymentEnabled',
    kind: 'پول',
    anchor: { file: 'api/prisma/schema.prisma', needle: 'paymentEnabled Boolean' },
    mustDisclose: true,
    exposedIn: [
      { file: 'api/src/app/api/v1/restaurants/route.ts', key: 'online_payment_enabled' },
      { file: 'api/src/app/api/v1/restaurants/[slug]/route.ts', key: 'online_payment_enabled' },
    ],
    readers: [
      'app/api/v1/reservations/[code]/pay/route.ts',
      'app/api/v1/restaurants/route.ts',
      'app/api/v1/restaurants/[slug]/route.ts',
    ],
    why:
      'درگاهِ واقعیِ Zarinpal پشتِ همین بولین است (pay/route.ts:35). تا ۲۰۲۶-۰۹-۱۰ ' +
      'در هیچ پاسخِ روبه‌مشتری‌ای نبود، در حالی که اپ صریح می‌گفت «آنلاین دریافت ' +
      'نمی‌شود» — یعنی اپ داده‌ی لازم برای راست‌گفتن را نداشت. همان نقصِ P1-3، یک فیلد جلوتر.',
  },
  {
    id: 'deposit_required',
    field: 'depositRequired',
    kind: 'پول',
    anchor: { file: 'api/prisma/schema.prisma', needle: 'depositRequired     Boolean' },
    mustDisclose: true,
    exposedIn: [
      { file: 'api/src/app/api/v1/restaurants/route.ts', key: 'deposit_required' },
      { file: 'api/src/app/api/v1/restaurants/[slug]/route.ts', key: 'deposit_required' },
    ],
    readers: [
      'app/api/v1/restaurant/cancellation-policy/route.ts',
      'app/api/v1/restaurants/route.ts',
      'app/api/v1/restaurants/[slug]/route.ts',
      'lib/cancellation-policy.ts',
    ],
    why:
      'رفعِ P1-3: اپ «رزرو رایگان · بدون پیش‌پرداخت» را هاردکد می‌کرد در حالی که ' +
      'این یک سیاستِ واقعیِ رستوران است. این ردیف همان رفع را پین می‌کند.',
  },
  {
    id: 'free_cancel_hours',
    field: 'freeCancelHours',
    kind: 'اعتبار',
    anchor: { file: 'api/prisma/schema.prisma', needle: 'freeCancelHours     Int' },
    mustDisclose: true,
    exposedIn: [
      { file: 'api/src/app/api/v1/restaurants/route.ts', key: 'free_cancel_hours' },
      { file: 'api/src/app/api/v1/restaurants/[slug]/route.ts', key: 'free_cancel_hours' },
    ],
    readers: [
      'app/api/v1/me/reservations/route.ts',
      'app/api/v1/restaurant/cancellation-policy/route.ts',
      'app/api/v1/restaurants/route.ts',
      'app/api/v1/restaurants/[slug]/route.ts',
      'lib/cancellation-policy.ts',
      'lib/economy.ts',
    ],
    why:
      '⚠️ تنها کسری که امروز **واقعاً اجرا می‌شود**. economy.ts لغوِ دیرتر از این ' +
      'پنجره را با امتیازِ اعتبارِ ۳۵ (به‌جای ۸۵) و یک strike ثبت می‌کند، و strike ' +
      'جلوی سطحِ platinum را می‌گیرد — نشانی که به رستوران‌ها هم نمایش داده می‌شود. ' +
      'همین ردیف است که دامنه را از «پول یا امتیاز» به سه‌گانه گشاد کرد.',
  },
  {
    id: 'partial_penalty_pct',
    field: 'partialPenaltyPct',
    kind: 'پول',
    anchor: { file: 'api/prisma/schema.prisma', needle: 'partialPenaltyPct   Int' },
    mustDisclose: false,
    exposedIn: null,
    readers: [
      'app/api/v1/restaurant/cancellation-policy/route.ts',
      'lib/cancellation-policy.ts',
    ],
    why:
      'امروز **اجرا نمی‌شود** — مالکِ رستوران می‌نویسدش و هیچ مسیری آن را به پول ' +
      'تبدیل نمی‌کند (docs/audit/CANCELLATION-POLICY.md §۱). پس افشا امروز لازم ' +
      'نیست. ولی این خطرناک‌ترین ردیفِ سیاهه است: پیش‌فرضش ۵۰ است و روزی که یک ' +
      'خواننده‌ی تازه پیدا کند، ۵۰٪ پولِ کسی در میان است. baseline دقیقاً برای ' +
      'همان روز نوشته شده.',
  },
];

// ── پیش‌نیازها ───────────────────────────────────────────────────────
if (INVENTORY.length === 0) bail('سیاهه خالی است — گاردِ بی‌موضوع همان fake-green است');
if (!existsSync(API_SRC)) bail(`پوشه‌ی ${API_SRC} پیدا نشد`);
if (!existsSync(SCHEMA)) bail(`${SCHEMA} پیدا نشد`);

// ── فهرستِ فایل‌ها ───────────────────────────────────────────────────
const EXT = new Set(['.ts', '.tsx', '.mts', '.cts']);
function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(p.slice(p.lastIndexOf('.')))) out.push(p);
  }
  return out;
}
const FILES = walk(API_SRC, []);

// ⚠️ گاردِ ضدِ «سبزِ توخالی»: فهرستِ اسکن که بی‌صدا به صفر حل شود، هر ادعای
// «هیچ خواننده‌ی تازه‌ای نیست» را بی‌معنا می‌کند. این مخزن صدها فایل دارد.
if (FILES.length < 50) {
  bail(`فهرستِ اسکن فقط ${FILES.length} فایل داد — یعنی مسیر خراب است، نه اینکه کد کوچک شده`);
}

const SRC = new Map(FILES.map((f) => [relative(API_SRC, f).replace(/\\/g, '/'), readFileSync(f, 'utf8')]));
const schemaText = readFileSync(SCHEMA, 'utf8');
const readRepo = (p) => (existsSync(join(REPO, p)) ? readFileSync(join(REPO, p), 'utf8') : null);

// ⚠️ **کلید باید در کد باشد، نه در کامنت** — و این را با یک شکستِ واقعیِ
// خودم یاد گرفتم (۲۰۲۶-۰۹-۱۰، همان روزِ نوشتنِ گارد).
//
// نسخه‌ی اول `text.includes(key)` بود. وقتی برای اثباتِ ابطال‌پذیری خطِ
// افشا را از `restaurants/route.ts` برداشتم، گارد **سبز ماند** — چون یک
// کامنت که خودم چند دقیقه قبل نوشته بودم رشته‌ی
// `booking_policy.online_payment_enabled` را داشت و `includes` آن را مچ کرد.
//
// یعنی گارد از همان آغاز با یک کامنت راضی می‌شد. این عیناً همان
// «طبقه‌بندِ substring» است که منشور §۳ به‌عنوان یکی از سه گاردِ
// سبزِ-بی‌اندازه‌گیریِ این مخزن نامش را می‌برد — و اگر چرخه‌ی قرمز را
// نمی‌دواندم، هرگز پیدا نمی‌شد.
//
// روشِ جایگزین عمداً خط‌محور است، نه regexِ حذفِ کامنت: حذفِ `/* */` و `//`
// با regex روی رشته‌هایی که خودشان `//` دارند خطا می‌کند. اینجا فقط خطوطی
// که با `//` یا `*` شروع می‌شوند کنار گذاشته می‌شوند، و کلید باید به‌شکلِ
// یک **کلیدِ آبجکت** (`key:`) در یک خطِ کدِ باقی‌مانده بیاید.
// ⚠️ **نسخه‌ی دوم — و حفره‌ی اولش را یک همتا پیدا کرد، نه من.**
//
// نسخه‌ی اول فقط خطی را رد می‌کرد که **با** `//` شروع شود. یعنی یک کامنتِ
// انتهای خط از فیلتر رد می‌شد:
//
//     reviews_count: total, // online_payment_enabled: عمداً برداشته شد
//
// با همین یک خط، افشای واقعی برداشته می‌شد و گارد **سبز می‌ماند**. اثباتش
// اجرا شد (۲۰۲۶-۰۹-۱۰): افشا حذف، کامنت کاشته، `EXIT=0`.
//
// `rezv-a0 [e6c5ba]` همان روز عیناً همین کلاس را در `check-loyalty-constant-binding`
// پیدا کرد، در جهتِ **معکوس**: ادعایی که از UI حذف شده ولی در کامنتی نقل
// شده بود، لنگرِ آن گارد را سبز نگه می‌داشت. دو گارد، دو جهت، یک ریشه:
// **کامنت می‌تواند گارد را خلع‌سلاح کند.**
//
// ⚠️ و `//`ِ وسطِ خط عمداً وقتی کامنت شمرده می‌شود که **پیش از آن `:` نباشد**
// — وگرنه `https://…` از همان‌جا بریده می‌شود و هرچه بعدش بیاید از دید
// می‌افتد. این را هم `rezv-a0` روی گاردِ خودش اندازه گرفت، پیش از آنکه من
// همین اشتباه را بکنم.
//
// شماره‌ی خط لازم نیست حفظ شود (این تابع فقط بله/خیر می‌دهد)، ولی خطوط
// جداگانه می‌مانند تا یک کلید که در کامنتِ یک خط و کدِ خطِ دیگری است قاطی نشود.
//
// ⚠️ **پیش از کپی‌کردنِ این تابع در گاردِ دیگری، این را بخوان.** `rezv-a0`
// همین مسئله را در گاردِ خودش با `blankComments()` بست و **عمداً `//`ِ
// وسطِ خط را دست نزد**. آن انتخاب برای او درست است و برای من نبود، و
// تفاوتش یک مبادله‌ی واقعی است نه سلیقه:
//
//   • این تابع کامنتِ انتهای خط را هم می‌برد. سودش: `foo(); // key:` دیگر
//     گارد را سبز نگه نمی‌دارد. هزینه‌اش: اگر روزی یک `//` را اشتباه
//     کامنت بشمارد، بخشی از خطِ **واقعی** از دید می‌افتد.
//   • گاردِ او متنِ فارسیِ روبه‌کاربر را می‌شمارد. آنجا از دست دادنِ یک خطِ
//     واقعی یعنی **یک ادعای نادیده‌مانده** — که از یک گزارشِ اضافه بدتر است.
//     پس او هرگز متن را قربانی نمی‌کند و به‌جایش یک مثبتِ کاذب را می‌پذیرد.
//
// یعنی جوابِ درست به **فایل** بستگی دارد: اینجا سوژه یک کلیدِ ASCII در
// یک فایلِ `.ts` است و از دست دادنش بی‌خطر است؛ آنجا سوژه یک جمله‌ی
// فارسی است و از دست دادنش خودِ نقص است.
//
// و این تابع فقط `//` و `/* */` را می‌شناسد. روی HTML یا JSXِ مخلوط
// (`<!-- -->`) **کور است** — گاردِ او دقیقاً به همین دلیل دو مثبتِ کاذب داد.
function codeOnly(text) {
  const out = [];
  let inBlock = false;
  for (const raw of text.split('\n')) {
    let s = raw;
    if (inBlock) {
      const end = s.indexOf('*/');
      if (end === -1) { out.push(''); continue; }
      s = s.slice(end + 2);
      inBlock = false;
    }
    for (;;) {
      const a = s.indexOf('/*');
      if (a === -1) break;
      const b = s.indexOf('*/', a + 2);
      if (b === -1) { s = s.slice(0, a); inBlock = true; break; }
      s = s.slice(0, a) + ' ' + s.slice(b + 2);
    }
    for (let j = 0; j + 1 < s.length; j++) {
      if (s[j] === '/' && s[j + 1] === '/' && s[j - 1] !== ':') { s = s.slice(0, j); break; }
    }
    out.push(s);
  }
  return out;
}

function exposesKeyInCode(text, key) {
  for (const line of codeOnly(text)) {
    const at = line.indexOf(key);
    if (at === -1) continue;
    if (line.slice(at + key.length).trimStart().startsWith(':')) return true;
  }
  return false;
}

const failures = [];
const notes = [];

for (const item of INVENTORY) {
  // ── الف) لنگرِ اسکیما ───────────────────────────────────────────────
  // اگر فیلد تغییرِ نام بدهد، این گارد باید **بلند** بشکند، نه اینکه بی‌صدا
  // یک ردیفِ بی‌سوژه را سبز رد کند.
  const anchorText = item.anchor.file === 'api/prisma/schema.prisma'
    ? schemaText
    : readRepo(item.anchor.file);
  if (anchorText === null) bail(`لنگرِ «${item.id}»: فایلِ ${item.anchor.file} نیست`);
  if (!anchorText.includes(item.anchor.needle)) {
    bail(
      `لنگرِ «${item.id}» در ${item.anchor.file} پیدا نشد (دنبالِ «${item.anchor.needle}»).\n` +
      '   یا فیلد تغییرِ نام داده یا قالبش عوض شده. سیاهه را به‌روز کن —\n' +
      '   ولی **پیش از آن** تصمیم بگیر که آیا هزینه‌ی جدید همچنان افشا می‌شود.',
    );
  }

  // ── ب) شرطِ C1: enforced ⇒ exposed ─────────────────────────────────
  // ⚠️ افشا **یک محل نیست** — و این را با یک اشتباهِ واقعیِ خودم یاد گرفتم
  // (۲۰۲۶-۰۹-۱۰). نسخه‌ی اولِ این گارد فقط endpointِ **جزئیات** را پین
  // می‌کرد و سبز بود. ولی کامنتِ خودِ `restaurants/route.ts:57-59` یک
  // واقعیتِ سنجیده‌شده را ثبت کرده: **اپِ مشتری هرگز `/restaurants/{slug}`
  // را صدا نمی‌زند** (grepِ کاملِ apps/customer: صفر) — کلِ آرایه‌ی R از
  // endpointِ فهرست ساخته می‌شود.
  //
  // یعنی فیلد «افشا شده» بود و به هیچ مشتری‌ای نمی‌رسید، و گارد آن را
  // تأیید می‌کرد. **سبزِ صوری، از دستِ همان کسی که گارد را نوشت.**
  // مهندسِ لانچ (`rezv-a0`) با یک سؤال پیدایش کرد، نه با یک تست.
  //
  // پس از این به بعد: هر مسیرِ روبه‌مشتری که قرارداد را می‌سازد باید
  // کلید را داشته باشد. `restaurants/route.ts` خودش این قرارداد را
  // «یک شکل، دو مسیر» می‌نامد؛ افشا در یکی و نبودن در دیگری همان
  // شکافی است که این حلقه می‌بندد.
  if (item.mustDisclose) {
    if (!Array.isArray(item.exposedIn) || item.exposedIn.length === 0) {
      bail(`«${item.id}» افشا لازم دارد ولی exposedIn خالی است — سیاهه ناسازگار است`);
    }
    for (const site of item.exposedIn) {
      const exposedText = readRepo(site.file);
      if (exposedText === null) bail(`فایلِ افشای «${item.id}» نیست: ${site.file}`);
      if (!exposesKeyInCode(exposedText, site.key)) {
        failures.push(
          `✗ نقضِ C1 — «${item.id}» (${item.kind}) کسر را تعیین می‌کند ولی در این مسیرِ روبه‌مشتری نیست.\n` +
          `    کلیدِ «${site.key}» در ${site.file} نیست.\n` +
          `    ⚠️ اگر در مسیرِ دیگری هست، کافی نیست: اپِ مشتری فقط از endpointِ\n` +
          `    **فهرست** می‌خواند، پس افشا در جزئیات به هیچ‌کس نمی‌رسد.\n` +
          `    چرا مهم است: ${item.why}\n` +
          `    رفع: کلید را به همان payload برگردان. اگر عمداً برداشتی، یعنی ادعای\n` +
          `    §۱ پوزیشنینگ دیگر راست نیست — آن‌وقت **ادعا** باید برداشته شود، نه این گارد.`,
        );
      }
    }
  }

  // ── ج) baselineِ خواننده‌ها ─────────────────────────────────────────
  const actual = [];
  for (const [rel, text] of SRC) {
    if (text.includes(item.field)) actual.push(rel);
  }
  actual.sort();

  if (actual.length === 0) {
    bail(
      `«${item.field}» در هیچ فایلی از api/src پیدا نشد.\n` +
      '   این یعنی ابزار خراب است یا فیلد حذف شده — نه اینکه انحرافی نیست.',
    );
  }

  const pinned = [...item.readers].sort();
  const added = actual.filter((f) => !pinned.includes(f));
  const gone = pinned.filter((f) => !actual.includes(f));

  if (added.length > 0) {
    failures.push(
      `✗ خواننده‌ی تازه برای «${item.id}» (${item.kind}) — و این همان لحظه‌ای است که\n` +
      `  این گارد برایش نوشته شده. یک انسان باید طبقه‌بندی کند:\n` +
      added.map((f) => `      + api/src/${f}`).join('\n') + '\n' +
      `    • اگر این خواننده مقدار را به یک **کسر** تبدیل می‌کند ⇒ فیلد باید در یک\n` +
      `      پاسخِ روبه‌مشتری باشد. mustDisclose را true کن و exposedIn را پر کن.\n` +
      `    • اگر نمی‌کند (نمایشِ پنلِ مالک، تست، تایپ) ⇒ خط را با **دلیل** به\n` +
      `      readers اضافه کن.\n` +
      `    چرا این ردیف حساس است: ${item.why}`,
    );
  }

  if (gone.length > 0) {
    // کم‌شدن نقض نیست: یک خواننده حذف شده، یعنی سطحِ خطر کوچک‌تر شده.
    // ولی baselineِ کهنه بی‌صدا می‌پوسد، پس بلند گفته می‌شود.
    notes.push(
      `ℹ baselineِ «${item.id}» کهنه شده — این خطوط دیگر خواننده نیستند و باید از\n` +
      `  سیاهه حذف شوند (بدهی کم شده):\n` +
      gone.map((f) => `      - api/src/${f}`).join('\n'),
    );
  }
}

for (const n of notes) console.log(n);

if (failures.length > 0) {
  console.error('');
  for (const f of failures) { console.error(f); console.error(''); }
  console.error(`  مرجع: docs/audit/backend/BE-004-brand-claim-testable-condition-2026-09-10.md`);
  process.exit(1);
}

const disclosed = INVENTORY.filter((i) => i.mustDisclose).length;
console.log(
  `✓ C1 برقرار است — ${INVENTORY.length} فیلدِ هزینه‌زا بررسی شد ` +
  `(${disclosed} افشا لازم دارند و دارند؛ ${INVENTORY.length - disclosed} امروز کسری نمی‌سازند)، ` +
  `${SRC.size} فایلِ api/src اسکن شد.`,
);
console.log(
  '  ⚠️ این سبز یعنی «اپ می‌تواند راست بگوید»، نه «ادعا راست است» — رندرِ صادقانه در apps/customer سنجیده نمی‌شود.',
);
