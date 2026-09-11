#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ وعده‌ی «امتیاز منقضی نمی‌شود»
//
//  چرا وجود دارد: در ۲۰۲۶-۰۹-۰۷ به صفحه‌ی وفاداریِ اپِ مشتری این خط اضافه شد:
//      «امتیازهات هیچ‌وقت منقضی نمی‌شن»
//  این یک **وعده به کاربر** است، نه یک توضیح. امروز درست است چون مدلِ
//  PointsLedger هیچ ستونِ انقضا ندارد و هیچ کرونی امتیاز کم نمی‌کند. ولی
//  اگر فردا کسی انقضا اضافه کند، آن خط بی‌صدا به دروغ تبدیل می‌شود و هیچ
//  تستی نمی‌گیردش — متن در اپِ وانیلا است و اسکیما در جای دیگر.
//
//  §۴c منشور: «گاردی که سوژه‌هایش را از یک مرجع می‌شمارد در حالی که خطر در
//  مرجعِ دیگری است، به دلیلِ ساختاری سبز است نه به دلیلِ امن بودن.» پس این
//  گارد **هر دو طرف** را می‌خواند و به هم می‌بندد:
//     طرفِ ادعا  → apps/customer/js/features/loyalty.js (و باندلِ standalone)
//     طرفِ خطر   → api/prisma/schema.prisma  +  api/src/app/api/v1/maintenance/
//                  +  api/src/lib/
//
//  ⚠️ گشادسازیِ ۲۰۲۶-۰۹-۱۱ — و اینکه چرا لازم بود: تا امروز فقط مسیرِ
//  `maintenance/**` اسکن می‌شد. ولی routeهای maintenance خودشان امتیاز کم
//  نمی‌کنند؛ آن‌ها `api/src/lib/*` را صدا می‌زنند، و `lib/loyalty.ts` **واقعاً**
//  یک نویسنده‌ی دلتایِ منفی دارد (`reverseReservationCashback`). یعنی گارد
//  دقیقاً همان الگوی §۴c را داشت: حکمش درست بود، ولی تصادفی — چون آن نویسنده
//  را اصلاً نمی‌دید، نه چون سنجیده و بی‌خطر یافته بودش.
//
//  و صرفِ گشادکردن کافی نیست: با رد شدنِ تخت روی هر دلتایِ منفی، گارد بلافاصله
//  قرمز می‌شد بابتِ دو نویسنده‌ی **مشروع** (برگشتِ کش‌بکِ لغو، و بازخریدِ خودِ
//  کاربر) — و یک گاردِ همیشه‌قرمز به همان سرعتِ یک گاردِ همیشه‌سبز خاموش
//  می‌شود. پس به‌جای رد شدن، **طبقه‌بندی** می‌کند:
//     · کسرِ سن/زمان‌محور (انقضا)      → شکستِ قطعی
//     · برگشت با پیشوندِ کلیدِ شناخته  → مجاز، و در خروجی نام‌برده می‌شود
//     · بازخریدِ کاربر (reason=redemption) → مجاز (خرج ≠ انقضا)
//     · هر چیز دیگر                     → شکست، «صریح طبقه‌بندی‌اش کن»
//
//  قاعده: وعده و مکانیزم باید هم‌داستان بمانند. اگر انقضا اضافه شد، یا وعده
//  برداشته شود یا گارد قرمز می‌ماند. هیچ‌کدام نباید بی‌صدا از دیگری جدا شود.
//
//  اجرا: node tools/check-loyalty-promise.mjs
//  خروج: 0 = هم‌داستان · 1 = تناقض (وعده هست، مکانیزم نقضش می‌کند)
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(REPO, p)) ? readFileSync(join(REPO, p), 'utf8') : null);

// ── طرفِ ادعا ────────────────────────────────────────────────────────
// عمداً روی یک عبارتِ کوتاه و پایدار مچ می‌شود، نه کلِ جمله: اگر کسی متن را
// بازنویسی کند ولی وعده را نگه دارد، گارد باید هنوز فعال بماند.
const PROMISE = 'منقضی نمی‌شن';
const CLAIM_FILES = [
  'apps/customer/js/features/loyalty.js',
  'standalone/customer.html',
];

const claimants = CLAIM_FILES.filter((f) => (read(f) ?? '').includes(PROMISE));

if (claimants.length === 0) {
  console.log('✓ وعده‌ی «امتیاز منقضی نمی‌شود» در هیچ سطحِ کاربری نیست — چیزی برای پاسداری نمانده.');
  console.log('  (اگر عمداً حذفش کردی، این گارد را هم بردار؛ گاردِ بی‌موضوع همان fake-green است.)');
  process.exit(0);
}

// ── طرفِ خطر ۱: اسکیما ───────────────────────────────────────────────
const schema = read('api/prisma/schema.prisma');
if (!schema) {
  console.error('✗ api/prisma/schema.prisma پیدا نشد — این گارد بدونِ آن نمی‌تواند چیزی اثبات کند.');
  process.exit(1);
}

const violations = [];

function modelBody(name) {
  const m = schema.match(new RegExp(`model\\s+${name}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`));
  return m ? m[1] : null;
}

for (const model of ['PointsLedger', 'ClubMember']) {
  const body = modelBody(model);
  if (body === null) {
    violations.push(`مدلِ ${model} در اسکیما نیست — ساختاری که وعده رویش ایستاده عوض شده.`);
    continue;
  }
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('@@')) continue;
    const field = t.split(/\s+/)[0];
    if (/expir|ttl|validUntil|valid_until/i.test(field)) {
      violations.push(`${model}.${field} — فیلدِ انقضا اضافه شده، ولی اپِ مشتری هنوز «منقضی نمی‌شن» می‌گوید.`);
    }
  }
}

// ── طرفِ خطر ۲: هر کدی که امتیاز کم کند ──────────────────────────────
// انقضا لازم نیست ستون باشد؛ یک کرونِ «امتیازهای کهنه را صفر کن» هم همان اثر
// را دارد. و چون خودِ routeها چیزی نمی‌نویسند و به lib تفویض می‌کنند، هر دو
// اسکن می‌شوند.
function walk(dir, out = []) {
  const abs = join(REPO, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs)) {
    const rel = `${dir}/${e}`;
    if (statSync(join(REPO, rel)).isDirectory()) walk(rel, out);
    else if (rel.endsWith('.ts')) out.push(rel);
  }
  return out;
}

const SCAN_DIRS = ['api/src/app/api/v1/maintenance', 'api/src/lib'];

// شکل‌های نوشتنِ دلتایِ منفی روی دفترِ امتیاز.
const DEDUCTION_SHAPES = [
  /delta\s*:\s*-/g,                        // شیءِ Prisma: { delta: -x }
  /\$\{\s*-\s*[\w.]+\s*\}\s*::\s*int/g,   // SQLِ خام: ${-points}::int
];
// نام‌هایی که خودشان اعلامِ کسرند (شکلشان مهم نیست).
const DEDUCTION_NAMES = /\bexpirePoints\b|\bdeductPoints\b|\bspendPoints\b|\bexpireStalePoints\b/g;

// نشانه‌های «سن/زمان‌محور» — همان چیزی که وعده را واقعاً نقض می‌کند.
const EXPIRY_SIGNALS = [
  /\bexpirePoints\b/, /\bexpireStalePoints\b/,
  /points[_A-Za-z]*[Ee]xpir/, /[Ee]xpir[A-Za-z]*[Pp]oints/,
  /\bexpiresAt\b/, /\bexpiredAt\b/, /\bexpires_at\b/,
  /\bolderThan\b/, /\bstalePoints\b/,
  /INTERVAL\s+'/,
  /created_?[Aa]t\s*(?:<|:\s*\{\s*lt)/,
];

// برگشت‌های مشروع، شناخته‌شده با **پیشوندِ کلیدِ idempotency** (نه با نام تابع:
// نام عوض می‌شود، کلید در دفتر می‌ماند). رجوع: CASHBACK_REVERSAL_KEY_PREFIX.
const REVERSAL_KEYS = ['cashback-reversal:', 'CASHBACK_REVERSAL_KEY_PREFIX'];

// بازخریدِ خودِ کاربر: خرج‌کردن ≠ منقضی‌شدن. وعده درباره‌ی گذرِ زمان است.
const REDEMPTION_SIGNALS = [/'redemption'/, /points_reason/];

// ⚠️ فیلترِ دامنه: فقط دلتایِ **دفترِ امتیاز**. بدونِ این، `sms-balance.ts`
// (`delta: -count` روی smsTransaction) یک مثبتِ کاذبِ دائمی می‌شد و گارد را
// بی‌اعتبار می‌کرد.
const POINTS_SCOPE = /pointsLedger|points_ledger|addPoints|addClubPoints/;

/** بلوکِ تابعی که این اندیس داخلش است (نام + متن) — دقیق‌تر از پنجره‌ی ثابت. */
const FN_RE = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm;
function enclosingFn(src, idx) {
  FN_RE.lastIndex = 0;
  let start = 0, name = '<سطحِ ماژول>', end = src.length, m;
  const starts = [];
  while ((m = FN_RE.exec(src))) starts.push({ at: m.index, name: m[1] });
  for (let i = 0; i < starts.length; i++) {
    if (starts[i].at <= idx) { start = starts[i].at; name = starts[i].name; end = starts[i + 1]?.at ?? src.length; }
  }
  return { name, body: src.slice(start, end) };
}

const allowed = [];   // نویسنده‌های منفیِ **سنجیده و مشروع** — در خروجی نام‌برده می‌شوند

for (const dir of SCAN_DIRS) {
  for (const f of walk(dir)) {
    const src = read(f) ?? '';
    const isMaintenance = f.startsWith('api/src/app/api/v1/maintenance');
    const hits = [];

    for (const re of DEDUCTION_SHAPES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) hits.push({ idx: m.index, text: m[0], scoped: true });
    }
    DEDUCTION_NAMES.lastIndex = 0;
    let n;
    while ((n = DEDUCTION_NAMES.exec(src))) hits.push({ idx: n.index, text: n[0], scoped: false });

    for (const h of hits) {
      const { name, body } = enclosingFn(src, h.idx);
      // دلتایِ منفیِ جدولِ دیگر (مثلاً موجودیِ پیامک) موضوعِ این وعده نیست.
      if (h.scoped && !POINTS_SCOPE.test(body)) continue;

      const where = `${f} · ${name}()`;

      // ۱) انقضا/کسرِ زمان‌محور — شکستِ قطعی، پیش از هر معافیتی.
      const expiry = EXPIRY_SIGNALS.find((r) => r.test(body) || r.test(name));
      if (expiry) {
        violations.push(`${where} — کسرِ سن/زمان‌محورِ امتیاز («${h.text}»)، ولی اپِ مشتری «منقضی نمی‌شن» می‌گوید.`);
        continue;
      }

      // ۲) کرونِ نگه‌داری که امتیاز کم می‌کند: هر کسری اینجا زمان‌محور است.
      if (isMaintenance) {
        violations.push(`${where} — مسیرِ نگه‌داری امتیاز را کم می‌کند، ولی اپِ مشتری «منقضی نمی‌شن» می‌گوید.`);
        continue;
      }

      // ۳) برگشتِ شناخته‌شده (با پیشوندِ کلیدِ idempotency).
      const rev = REVERSAL_KEYS.find((k) => body.includes(k));
      if (rev) { allowed.push(`${where} — برگشتِ idempotent با کلیدِ «${rev}» (لغو/عدم‌حضور)`); continue; }

      // ۴) بازخریدِ خودِ کاربر.
      if (REDEMPTION_SIGNALS.every((r) => r.test(body))) {
        allowed.push(`${where} — بازخریدِ خودِ کاربر (خرج ≠ انقضا)`);
        continue;
      }

      // ۵) طبقه‌بندی‌نشده: نه انقضا، نه برگشتِ شناخته‌شده، نه بازخرید.
      violations.push(
        `${where} — نویسنده‌ی دلتایِ منفیِ ناشناخته («${h.text}»). اگر مشروع است، `
        + 'کلیدِ idempotency‌اش را به REVERSAL_KEYS در همین گارد اضافه کن؛ اگر انقضاست، وعده را بردار.',
      );
    }
  }
}

// ── حکم ──────────────────────────────────────────────────────────────
if (violations.length) {
  console.error('✗ وعده و مکانیزم از هم جدا شده‌اند:');
  for (const v of violations) console.error(`   - ${v}`);
  console.error('');
  console.error('  یا انقضا را بردار، یا این جمله را از اپِ مشتری و باندلِ standalone حذف کن.');
  console.error(`  ادعا در: ${claimants.join('، ')}`);
  process.exit(1);
}

console.log(`✓ وعده‌ی «امتیاز منقضی نمی‌شود» با مکانیزم هم‌داستان است (${claimants.length} محلِ ادعا).`);
console.log('  PointsLedger و ClubMember هیچ فیلدِ انقضا ندارند؛ هیچ کسرِ سن/زمان‌محوری در');
console.log(`  ${SCAN_DIRS.join(' و ')} نیست.`);
if (allowed.length) {
  // ⚠️ عمداً چاپ می‌شود: «هیچ کسری نبود» و «کسرهایی بود و همه سنجیده شدند» دو
  // حکمِ متفاوت‌اند. سکوت درباره‌شان همان سبزیِ بی‌دلیل است.
  console.log(`  ${allowed.length} نویسنده‌ی دلتایِ منفیِ **مشروع** دیده و طبقه‌بندی شد:`);
  for (const a of allowed) console.log(`   · ${a}`);
}
process.exit(0);
