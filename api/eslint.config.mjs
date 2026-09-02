// پیکربندی ESLint (flat config برای ESLint 9+)
// اجرا: npm run lint  (نیاز به نصب: npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin)
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'prisma/**/*.ts'],  // middleware.ts داخلِ src/ است
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // قواعدِ منطقی برای پروژه‌ی production — نه سخت‌گیرانه‌ی آزاردهنده
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // ⚠️ `error` نه `warn`: «`console.log` در کدِ تحویلی ممنوع» یک قاعده‌ی
      // صریحِ پروژه است. تا وقتی warn بود، CI اجرایش نمی‌کرد و فقط به این
      // دلیل نقض نشده بود که کسی ننوشته — نه چون گیتی جلویش را می‌گرفت.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],
    },
  },
  {
    // مصرف‌کننده‌های مشروعِ console: اسکریپت‌های seed (خروجیِ CLI) و خودِ ماژولِ logger.
    files: ['prisma/seed.ts', 'prisma/seed-site.ts', 'prisma/create-platform-admin.ts', 'src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // ── تست‌ها: همان پارسر، قواعدِ سبک‌تر ──
    // تا ۲۰۲۶-۰۸-۲۸ کلِ `tests/**` از lint خارج بود؛ یعنی ۱۲۲ فایلِ تست هیچ
    // بررسیِ ایستایی نمی‌دیدند. بدونِ بلوکِ زیر eslint این فایل‌ها را با پارسرِ
    // پیش‌فرضِ JS می‌خواند و روی هر کدام «Unexpected token :» می‌داد.
    files: ['tests/**/*.mts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-var': 'error',
      // خروجیِ تشخیصی در تست مشروع است — برخلافِ کدِ تحویلی.
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['warn', 'smart'],
    },
  },
  {
    // فایل‌های تولیدشده و وابستگی‌ها نادیده گرفته شوند
    ignores: ['node_modules/**', '.next/**', 'prisma/migrations/**'],
  },
];
