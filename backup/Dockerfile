FROM postgres:16-alpine

# postgres:alpine از قبل pg_dump و psql دارد.
# tzdata: برای زمان‌بندی درست. aws-cli: برای آپلود اختیاری به آبجکت‌استوریج.
RUN apk add --no-cache tzdata aws-cli

COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
