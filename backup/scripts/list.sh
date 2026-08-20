#!/bin/sh
BACKUP_DIR="${BACKUP_DIR:-/backups}"
echo "بک‌آپ‌های موجود در $BACKUP_DIR:"
echo ""
if ls -1 "$BACKUP_DIR"/rezervno_*.sql.gz >/dev/null 2>&1; then
  ls -lht "$BACKUP_DIR"/rezervno_*.sql.gz | awk '{print "  "$5"\t"$6" "$7" "$8"\t"$9}'
  echo ""
  echo "تعداد کل: $(ls -1 "$BACKUP_DIR"/rezervno_*.sql.gz | wc -l)"
else
  echo "  (هنوز بک‌آپی ساخته نشده)"
fi
