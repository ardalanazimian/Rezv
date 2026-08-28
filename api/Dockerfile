# ── مرحله ۱: build ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
# ⚠️ `--ignore-scripts` اجباری است، نه بهینه‌سازی (رفعِ ۲۰۲۶-۰۸-۲۸):
# `package.json` هوکِ `postinstall: prisma generate` دارد، ولی در این لایه
# هنوز فقط package.json کپی شده و `prisma/schema.prisma` وجود ندارد. بدونِ
# این پرچم `npm ci` با «Could not find Prisma Schema» می‌شکند و **کلِ ساختِ
# ایمیجِ تولید شکست می‌خورد**. از زمانِ افزودنِ آن هوک (9b0928f، ۲۰۲۶-۰۷-۰۸)
# این ساخت خراب بود و هیچ jobی در CI ایمیج نمی‌سازد تا معلوم شود.
RUN npm ci --ignore-scripts || npm install --ignore-scripts
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
# `--ignore-scripts` به همان دلیلِ مرحله‌ی build؛ کلاینتِ تولیدشده چند خط
# پایین‌تر مستقیماً از مرحله‌ی builder کپی می‌شود.
RUN npm ci --omit=dev --ignore-scripts && \
    npm install prisma@5.20.0 --no-save --ignore-scripts && \
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
