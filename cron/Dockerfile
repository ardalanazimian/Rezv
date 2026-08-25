FROM alpine:3.19
RUN apk add --no-cache curl
COPY crontab /etc/crontabs/root
COPY run.sh /run.sh
RUN chmod +x /run.sh
# اجرا با کاربر non-root
RUN adduser -D -u 1001 cronuser
USER cronuser
CMD ["crond", "-f", "-l", "8"]
