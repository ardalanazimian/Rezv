/** @type {import('eslint').Linter.FlatConfig} */
// ⚠️ ۲۰۲۶-۰۹-۰۸: تا امروز فقط قواعدِ Next فعال بود و هیچ ruleset پایه‌ای نه، پس
//    `npm run lint` سبز بود و کلیدِ تکراری را نمی‌دید. اثباتِ زنده: تزریقِ
//    `{ timezone: "A", timezone: "B" }` با exit 0 گذشت. همان کلاسی که در
//    api/eslint.config.mjs رفع شد — این‌ها نمونه‌ی دوم و سومش بودند.
//
// ⚠️ `.eslintrc.json` قبلاً کنارِ همین فایل بود و **خوانده نمی‌شد**: ESLint 9
//    وقتی flat config ببیند نسخه‌ی legacy را نادیده می‌گیرد. حذف شد، چون یک
//    فایلِ تنظیماتِ بی‌اثر که معتبر به‌نظر می‌رسد خودش تله است — یک بار همان
//    ویرایشِ بی‌اثر انجام شد و «سبز» به‌نظر رسید.
module.exports = [
  require('@eslint/js').configs.recommended,
  // no-undef روی TypeScript همیشه مثبتِ کاذب است؛ تایپ‌چکر پوششش می‌دهد.
  { rules: { 'no-undef': 'off', 'no-unused-vars': 'off' } },
  {
    // ⚠️ فقط .ts/.tsx: `--print-config` نشان داد این دو پسوند با
    //    typescript-eslint/parser تجزیه می‌شوند ولی `.mts` با
    //    eslint-config-next/parser — و آن یکی importِ type-only را «بی‌استفاده»
    //    می‌بیند (سه مثبتِ کاذب در test/schema.test.mts که واقعاً در خطوطِ
    //    ۱۳/۲۰/۳۰/۷۶ استفاده شده‌اند). قاعده‌ی TS-aware فقط جایی اعمال می‌شود
    //    که پارسرِ TS واقعاً اجرا شود.
    // ⚠️ شکافِ شناخته‌شده: فایل‌های `.mts` پوششِ unused-vars ندارند. ساکت
    //    نشده — ثبت شده، چون اصلاحش به یکسان‌کردنِ پارسر نیاز دارد.
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': require('@typescript-eslint/eslint-plugin') },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  ...require('eslint-config-next'),
];
