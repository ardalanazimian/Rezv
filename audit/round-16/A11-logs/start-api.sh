#!/bin/sh
# A11 (round 16) — dev API server pointed at the isolated rezervno_a11 DB and
# the real test Redis container (rezv-test-redis, host port 56379).
#
# FIX 2026-09-04: the 2026-09-03 run had REDIS_URL=redis://localhost:56500,
# a port nothing listens on (docker ps shows rezv-test-redis on 56379).
# Redis being unreachable does NOT hard-fail requests — lib/ratelimit.ts's
# rateLimitWithFallback() catches the ioredis error and falls back to an
# in-memory cap (see ratelimit.ts:87-102) — so the 2026-09-03 run produced
# 16,507 ioredis error lines in api.log while *looking* alive. The fixed
# preflight (a11-preflight.mjs) now requires a real Redis PING+SET/GET
# round-trip before any row runs, so this class of failure is a hard,
# non-zero exit instead of a silent degraded pass.
BASE="$(cd "$(dirname "$0")" && pwd)"
SECRETS="$BASE/a11-secrets.env"
# ⚠️ credential-hygiene fix (2026-09-04): the 2026-09-03 run's bootstrap
# wrote a plaintext password into api/platform-fixture.json AND
# audit/round-16/A11-fixtures.json — one un-ignored, both duplicates of the
# same secret. Generated secrets now live in exactly ONE place, git-ignored,
# and everything else (including this script) reads from it instead of
# embedding its own copy. See A11-REPORT.md "Credential hygiene" section.
[ -f "$SECRETS" ] || { echo "✗ missing $SECRETS — run the a11-secrets generator first (see A11-REPORT.md)"; exit 1; }
set -a
. "$SECRETS"
set +a

export DATABASE_URL="postgresql://test:test@localhost:55432/rezervno_a11"
export REDIS_URL="redis://localhost:56379"
export JWT_ACCESS_SECRET="a11_test_access_secret_0123456789abcdef"
export JWT_REFRESH_SECRET="a11_test_refresh_secret_0123456789abcdef"
export JWT_SECRET="a11_test_access_secret_0123456789abcdef"
export ADMIN_LOGIN_ENABLED=true
export ADMIN_TOTP_USERNAME="$A11_ADMIN_USERNAME"
export ADMIN_TOTP_SECRET="$A11_ADMIN_TOTP_SECRET"
export OTP_DEV_MODE=true
export PLATFORM_ADMIN_TENANT_ID="cb9567a6-9264-4bb4-b211-110fca16d6bf"
export ALLOWED_ORIGINS="http://localhost:8080,http://localhost:8081,http://localhost:8082"
export NODE_ENV=development
cd "C:/Users/Asus/Desktop/rezv3/rezervnofullsource/api"
exec npm run dev
