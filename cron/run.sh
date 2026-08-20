#!/bin/sh
# صدا زدن endpoint نگهداری با کلید محرمانه
# API_URL و MAINTENANCE_KEY از محیط می‌آیند
JOB="$1"
URL="${API_URL:-http://api:3000}/api/v1/maintenance/${JOB}"
curl -sf -X POST "$URL" \
  -H "x-maintenance-key: ${MAINTENANCE_KEY}" \
  -H "Content-Type: application/json" \
  --max-time 30 \
  && echo "[$(date)] ✓ $JOB" \
  || echo "[$(date)] ✗ $JOB failed"
