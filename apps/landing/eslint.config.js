/** @type {import('eslint').Linter.FlatConfig} */
// ⚠️ ۲۰۲۶-۰۹-۰۸: تا امروز فقط قواعدِ Next فعال بود و هیچ ruleset پایه‌ای نه، پس
//    `npm run lint` سبز بود و کلیدِ تکراری را نمی‌دید. اثباتِ زنده: تزریقِ
//    `{ timezone: "A", timezone: "B" }` با exit 0 گذشت. همان کلاسی که در
//    api/eslint.config.mjs رفع شد — این‌ها نمونه‌ی دوم و سومش بودند.
//
// ⚠️ `.eslintrc.json` قبلاً کنارِ همین فایل بود و **خوانده نمی‌شد**: ESLint 9
//    وقتی flat config ببیند نسخه‌ی legacy را نادیده می‌گیرد. حذف شد، چون یک
//    فایلِ تنظیماتِ بی‌اثر که معتبر به‌نظر می‌رسد خودش تله است.
//
// ⚠️ چرا پلاگینِ typescript-eslint را خودمان require نمی‌کنیم:
//    نسخه‌ی اولِ این رفع `require('@typescript-eslint/eslint-plugin')` داشت —
//    وابستگی‌ای که در package.json اعلام نشده بود و فقط از راهِ
//    eslint-config-next → typescript-eslint به ما می‌رسید. اعلامش هم ممکن
//    نبود: `^8` به 8.70.0 می‌رسد که peerش `parser@^8.70.0` است، ولی درخت
//    parser@8.65.0 دارد (ERESOLVE). پس به‌جای پین‌کردنِ خودمان به نسخه‌ی
//    گذرایِ Next، بلاکِ قاعده **بعد از** spreadِ آن می‌آید و از ثبتِ خودش
//    استفاده می‌کند. یک وابستگیِ کمتر، و بدونِ جفت‌شدن با نسخه.
module.exports = [
  require('@eslint/js').configs.recommended,
  // no-undef و no-unused-vars پایه روی TypeScript مثبتِ کاذب‌اند؛ تایپ‌چکر و
  // نسخه‌ی TS-aware پوششش می‌دهند.
  { rules: { 'no-undef': 'off', 'no-unused-vars': 'off' } },
  ...require('eslint-config-next'),
  {
    // ⚠️ فقط .ts/.tsx: `--print-config` دو پارسرِ متفاوت نشان داد —
    //    typescript-eslint/parser روی این دو، و eslint-config-next/parser روی
    //    `.mts`، که importِ type-only را «بی‌استفاده» می‌بیند.
    // ⚠️ شکافِ شناخته‌شده: `.mts` پوششِ unused-vars ندارد. ساکت نشده، ثبت شده.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
