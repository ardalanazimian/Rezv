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
      'no-console': ['warn', { allow: ['warn', 'error'] }],
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
    // فایل‌های تولیدشده و وابستگی‌ها نادیده گرفته شوند
    ignores: ['node_modules/**', '.next/**', 'prisma/migrations/**', 'tests/**'],
  },
];
