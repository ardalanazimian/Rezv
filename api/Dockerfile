# ── مرحله ۱: build ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# ── مرحله ۲: ایمیج نهایی (سخت‌شده) ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# امنیت: حذف ابزارهای غیرضروری + به‌روزرسانی پکیج‌های امنیتی
RUN apk --no-cache upgrade && apk add --no-cache dumb-init

# امنیت: ساخت کاربر non-root اختصاصی (اجرا با root خطرناک است)
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# ── بهینه‌سازیِ اندازه: به‌جای کپیِ کلِ node_modules (شامل typescript/tsx/@types که
#    فقط برای build لازم بودند)، فقط وابستگی‌های production + prisma CLI نصب می‌شود.
#    prisma CLI در زمان اجرا برای `migrate deploy` در entrypoint لازم است. ──
COPY --chown=nextjs:nodejs package.json package-lock.json* ./
RUN npm ci --omit=dev && \
    npm install prisma@5.20.0 --no-save && \
    npm cache clean --force

# فایل‌های build و اسکیمای لازم برای اجرا
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Prisma Client تولیدشده (در مرحله‌ی build ساخته شد) — تا دوباره generate لازم نشود
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nextjs:nodejs docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# امنیت: اجرا با کاربر non-root
USER nextjs

EXPOSE 3000
# dumb-init: مدیریت صحیح سیگنال‌ها و جلوگیری از zombie process
ENTRYPOINT ["dumb-init", "--"]
CMD ["/docker-entrypoint.sh"]
