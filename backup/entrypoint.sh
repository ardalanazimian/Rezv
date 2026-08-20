#!/bin/sh
# ═══════════════════════════════════════════════════════════
#  سرویس بک‌آپ خودکار — cron را با زمان‌بندی تنظیم‌شده اجرا می‌کند
# ═══════════════════════════════════════════════════════════
set -e

# زمان‌بندی پیش‌فرض: هر روز ساعت ۳ بامداد (قابل تغییر با BACKUP_CRON)
CRON_SCHEDULE="${BACKUP_CRON:-0 3 * * *}"

echo "═══════════════════════════════════════════"
echo " سرویس بک‌آپ رزرونو"
echo " زمان‌بندی: $CRON_SCHEDULE"
echo " مقصد: ${BACKUP_DIR:-/backups}"
echo " نگه‌داری: ${BACKUP_KEEP:-14} بک‌آپ آخر"
echo "═══════════════════════════════════════════"

# نوشتن متغیرها در فایل تا cron به آن‌ها دسترسی داشته باشد
# (cron محیط متغیرها را به ارث نمی‌برد)
env | grep -E '^(POSTGRES_|PGHOST|BACKUP_|S3_)' | sed 's/^/export /' > /etc/backup.env

# ساخت crontab
echo "$CRON_SCHEDULE . /etc/backup.env; /scripts/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

# یک بک‌آپ اولیه بزن (تا مطمئن شویم کار می‌کند و فوراً یک نسخه داریم)
if [ "$BACKUP_ON_START" = "true" ]; then
  echo "→ بک‌آپ اولیه..."
  . /etc/backup.env
  /scripts/backup.sh || echo "⚠️ بک‌آپ اولیه ناموفق (شاید دیتابیس هنوز آماده نیست)"
fi

# لاگ را به stdout هم بفرست تا در docker logs دیده شود
touch /var/log/backup.log
tail -F /var/log/backup.log &

echo "→ cron در حال اجرا (منتظر زمان‌بندی)..."
# crond در foreground
exec crond -f -l 2
