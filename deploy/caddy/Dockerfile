# ── build Caddy با plugin ریت‌لیمیت ──
FROM caddy:2-builder AS builder
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit

# ── ایمیج نهایی ──
FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
