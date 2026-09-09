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

// ── طرفِ خطر ۲: کرونی که امتیاز کم کند ───────────────────────────────
// انقضا لازم نیست ستون باشد؛ یک کرونِ «امتیازهای کهنه را صفر کن» هم همان اثر
// را دارد. پس مسیرِ maintenance هم اسکن می‌شود.
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

for (const f of walk('api/src/app/api/v1/maintenance')) {
  const src = read(f) ?? '';
  // فقط کم‌کردنِ امتیاز مهم است، نه هر اشاره‌ای به points.
  if (/addPoints\s*\(\s*\{[^}]*delta\s*:\s*-/s.test(src) || /spendPoints|deductPoints|expirePoints/.test(src)) {
    violations.push(`${f} — مسیرِ نگه‌داری امتیاز را کم می‌کند، ولی اپِ مشتری «منقضی نمی‌شن» می‌گوید.`);
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
console.log('  PointsLedger و ClubMember هیچ فیلدِ انقضا ندارند؛ هیچ مسیرِ نگه‌داری امتیاز کم نمی‌کند.');
process.exit(0);
