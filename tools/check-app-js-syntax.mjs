#!/usr/bin/env node
// گاردِ نحوِ جاوااسکریپتِ اپ‌ها — نوشته ۲۰۲۶-۰۹-۱۰، پس از یک نقصِ واقعی.
//
// چرا وجود دارد: سه فایل در apps/customer با بک‌تیکِ داخلِ template literal
// شکسته بودند و کلِ اپِ مشتری در مرورگر بالا نمی‌آمد. مالک خودش دیدش.
// هیچ گاردی نگرفته بود: `npm test` فقط api/ را می‌آزماید، و گاردِ freshnessِ
// standalone می‌گوید فایل کهنه نیست — نه اینکه پارس می‌شود.
//
// ⚠️ درسِ گران‌ترِ همان روز، که علتِ شکلِ این فایل است:
//     node --check <path>                      → EXIT=0  روی فایلِ خراب
//     node --input-type=module --check <stdin> → EXIT=1  روی همان فایل
// `--check` با مسیرِ فایل، فایل را CommonJS فرض می‌کند. این‌ها ماژول‌اند.
// یک جاروی ۳۱۵ فایلی «صفر خطا» گزارش کرد در حالی که سه فایل خراب بود —
// سبزی که هیچ چیزی اندازه نگرفته بود. پس اینجا هرگز از مسیرِ فایل استفاده
// نکن؛ همیشه stdin + --input-type=module.
//
// EXIT 0 = همه پارس می‌شوند · 1 = نقضِ واقعی · 2 = گارد اجرا نشد (دامنه‌ی خالی)

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';


const ROOT = 'apps';
const EXT = /\.(js|mjs)$/;
const IGNORE = /(^|\/)(node_modules|dist|\.next|build)(\/|$)/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + e.name;
    if (IGNORE.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (EXT.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT).sort();

// ضدِ سبزِ توخالی: دامنه‌ی خالی یعنی گارد اجرا نشده، نه اینکه پاک است.
if (files.length === 0) {
  console.error('✖ گارد اجرا نشد: هیچ فایلی برای اسکن پیدا نشد.');
  console.error('  ریشه: ' + ROOT);
  console.error('  «صفر فایل» یعنی ابزار خراب است، نه اینکه چیزی نیست.');
  process.exit(2);
}

const broken = [];
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--input-type=module', '--check'], {
      input: readFileSync(f), stdio: ['pipe', 'ignore', 'pipe'],
    });
  } catch (e) {
    const err = String(e.stderr || '');
    const msg = err.split('\n').find(l => /Error/.test(l)) || 'parse failed';
    const loc = err.match(/\[stdin\]:(\d+)/);
    broken.push({ f, msg: msg.trim(), line: loc ? loc[1] : '?' });
  }
}

console.log('فایلِ اسکن‌شده: ' + files.length);
console.log('محدوده: فقط **نحو**. رفتار، ایمپورتِ حل‌نشده و خطای زمانِ اجرا');
console.log('سنجیده **نمی‌شوند** — این پوششِ کامل نیست.\n');

if (broken.length === 0) {
  console.log('✓ هر فایل به‌عنوانِ ماژول پارس می‌شود');
  process.exit(0);
}

console.error('❌ فایلِ نحو‌شکسته — ' + broken.length + ' مورد:\n');
for (const b of broken) console.error('  • ' + b.f + ':' + b.line + ' → ' + b.msg);
console.error('\nیک فایلِ نحو‌شکسته در مرورگر **بی‌صدا** می‌میرد: هیچ چیزی از آن');
console.error('ماژول اجرا نمی‌شود. رایج‌ترین علت در این مخزن، بک‌تیک داخلِ یک');
console.error('template literal است — معمولاً در کامنتی که نامِ فایلی را نقل می‌کند.');
process.exit(1);
