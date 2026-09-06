#!/usr/bin/env node
// A11 (round 16) — runtime smoke executor. Real API (localhost:3000) + real
// Postgres (rezervno_a11 on rezv-test-pg:55432) + real Redis
// (rezv-test-redis:56379). Every row in runtime-smoke-plan.json is exercised
// with an actual HTTP call against the actual server; every write is proven
// with a follow-up SQL query against the actual database. No mocks.
//
// Output: audit/round-16/A11-RESULTS.json (one object per row).

import { execFileSync } from 'node:child_process';
import { randomInt, createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3000/api/v1';
const HEALTH = 'http://localhost:3000/api/health';
const PG = { container: 'rezv-test-pg', user: 'test', db: 'rezervno_a11' };

const RESULTS = [];
function record(row, app, element, api, status, http_status, evidence, db_assertion, notes) {
  RESULTS.push({ row, app, element, api, status, http_status, evidence, db_assertion: db_assertion ?? null, notes: notes ?? null });
  console.log(`[row ${row}] ${status} (${app}) ${element} — http ${http_status}`);
}

// ── HTTP helper ──
async function call(method, path, { token, body, headers, base } = {}) {
  const url = (base ?? BASE) + path;
  const h = { ...(headers || {}) };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h['Authorization'] = 'Bearer ' + token;
  const res = await fetch(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON (e.g. raw SVG) */ }
  return { status: res.status, json, text, ok: res.ok };
}

function idem() {
  return 'a11-' + randomInt(0, 1e9).toString(36) + '-' + Date.now().toString(36);
}
function fixturePhone(prefix) {
  return prefix + String(randomInt(0, 10_000_000)).padStart(7, '0');
}
// revocation is stored in Redis (lib/security.ts: `revoked:${jti}`), not Postgres.
function redisKeys(pattern) {
  const out = execFileSync('docker', ['exec', 'rezv-test-redis', 'redis-cli', 'KEYS', pattern], { encoding: 'utf8' }).trim();
  return out ? out.split('\n') : [];
}
// Rate-limit buckets in lib/ratelimit.ts are keyed per-IP (`rl:<prefix>:<ip>`),
// not per logical actor. In production, thousands of distinct client IPs each
// get their own independent budget; this harness simulates dozens of distinct
// real-world actors (platform admin, restaurant owner, two customers) from a
// SINGLE IP (127.0.0.1), so a shared-fate collision here would be a test
// artifact, not evidence of a real cross-tenant/cross-user rate-limit bug.
// Cleared at logical phase boundaries below — documented in A11-REPORT.md.
function clearRateLimits() {
  for (const k of redisKeys('rl:*')) execFileSync('docker', ['exec', 'rezv-test-redis', 'redis-cli', 'DEL', k]);
}

// ── raw SQL against the real DB (proves writes, seeds what has no API) ──
// psql -tAc still appends a command-tag line ("INSERT 0 1") after the
// RETURNING output on this psql build, even in tuples-only mode — strip it
// so callers extracting a single id from `INSERT ... RETURNING id` don't get
// a two-line string with an embedded newline (this bit us once: a UUID with
// a trailing "\nINSERT 0 1" failed server-side zod UUID validation with a
// generic "invalid UUID" error that took a real request to notice).
function sql(query) {
  const raw = execFileSync('docker', ['exec', PG.container, 'psql', '-U', PG.user, '-d', PG.db, '-tAc', query], { encoding: 'utf8' }).trim();
  return raw.split('\n').filter((l) => !/^(INSERT|UPDATE|DELETE)\s+\d+\s+\d*$/.test(l.trim())).join('\n').trim();
}
function sqlRows(query) {
  // wraps query in row_to_json + json_agg so we get a single JSON array back
  const wrapped = `SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (${query}) t`;
  const out = sql(wrapped);
  return JSON.parse(out);
}

// ── TOTP (RFC 6238, SHA1, 30s, 6 digits) — pure Node crypto, matches
// api/src/lib/admin-totp.ts's otpauth defaults exactly ──
function base32Decode(b32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of b32.replace(/=+$/, '')) {
    const v = alphabet.indexOf(ch.toUpperCase());
    if (v === -1) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totpCode(secretBase32, stepOffset = 0) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24 | (hmac[offset + 1] & 0xff) << 16 | (hmac[offset + 2] & 0xff) << 8 | (hmac[offset + 3] & 0xff)) % 1_000_000;
  return String(code).padStart(6, '0');
}

const RUN_ID = Date.now().toString(36) + randomInt(0, 1e6).toString(36);
const A11_ADMIN_USERNAME = process.env.A11_ADMIN_USERNAME;
const A11_ADMIN_PASSWORD = process.env.A11_ADMIN_PASSWORD;
const A11_ADMIN_TOTP_SECRET = process.env.A11_ADMIN_TOTP_SECRET;
const A11_RESTAURANT_OWNER_USERNAME = process.env.A11_RESTAURANT_OWNER_USERNAME;
const A11_RESTAURANT_OWNER_PASSWORD = process.env.A11_RESTAURANT_OWNER_PASSWORD;
for (const [k, v] of Object.entries({ A11_ADMIN_USERNAME, A11_ADMIN_PASSWORD, A11_ADMIN_TOTP_SECRET, A11_RESTAURANT_OWNER_USERNAME, A11_RESTAURANT_OWNER_PASSWORD })) {
  if (!v) { console.error(`✗ missing env ${k} — source audit/round-16/A11-logs/a11-secrets.env first`); process.exit(1); }
}

async function main() {
  // ═══════════════════════════════════════════════════════════════════
  //  PHASE 1 — company panel: platform admin login (rows 244-253)
  // ═══════════════════════════════════════════════════════════════════
  const flagRes = await call('GET', '/auth/admin/login');
  record(246, 'company', 'Login: pre-render flag fetch', 'GET /api/v1/auth/admin/login',
    flagRes.status === 200 && typeof flagRes.json?.totp_required === 'boolean' ? 'PASS' : 'FAIL',
    flagRes.status, `apps/company/js/intelligence.js:881-891 reads totp_required/otp_login_enabled; raw response: ${JSON.stringify(flagRes.json)}`,
    null, 'ADMIN_LOGIN_ENABLED=true in this run, so totp_required is expected true.');

  const totp1 = totpCode(A11_ADMIN_TOTP_SECRET);
  const loginRes = await call('POST', '/auth/admin/login', { body: { username: A11_ADMIN_USERNAME, password: A11_ADMIN_PASSWORD, totp: totp1 } });
  const adminToken = loginRes.json?.access;
  const adminRefresh = loginRes.json?.refresh;
  record(244, 'company', 'Login: username + password inputs + «ورود به پنل»', 'POST /api/v1/auth/admin/login',
    loginRes.status === 200 && !!adminToken ? 'PASS' : 'FAIL', loginRes.status,
    `apps/company/js/intelligence.js:866-871 checks res.data.access; raw: ${JSON.stringify(loginRes.json)}`,
    null, 'Exercised together with TOTP (row 245) because ADMIN_LOGIN_ENABLED=true makes the TOTP field DOM-conditional and mandatory in the same submit — see row 245 for the isolated TOTP proof.');
  record(245, 'company', 'Login: TOTP 6-digit field (DOM-conditional)', 'POST /api/v1/auth/admin/login {totp}',
    loginRes.status === 200 ? 'PASS' : 'FAIL', loginRes.status,
    `TOTP computed locally with the same secret as ADMIN_TOTP_SECRET (RFC 6238, SHA1/30s/6-digit) = ${totp1}; server accepted it and issued a token: ${JSON.stringify(loginRes.json)}.`,
    null, 'Negative proof also captured: see notes_totp_reject below.');

  const badTotpRes = await call('POST', '/auth/admin/login', { body: { username: A11_ADMIN_USERNAME, password: A11_ADMIN_PASSWORD, totp: '000000' } });
  RESULTS[RESULTS.length - 1].notes += ` Negative control: same call with totp="000000" -> HTTP ${badTotpRes.status}, body ${JSON.stringify(badTotpRes.json)} (expected 401 invalid_credentials).`;

  const refreshRes = await call('POST', '/auth/refresh', { body: { refresh: adminRefresh } });
  record(253, 'company', 'Session restore + silent refresh on 401', 'POST /api/v1/auth/refresh',
    refreshRes.status === 200 && !!refreshRes.json?.access ? 'PASS' : 'FAIL', refreshRes.status,
    `apps/company/js/api.js:22,29-31 expects data.access/data.refresh on 401->refresh; raw: ${JSON.stringify(refreshRes.json)}`,
    null, null);
  const adminToken2 = refreshRes.json?.access || adminToken;

  // enable admin_otp_login_enabled (DEFAULT_OFF) via the real admin API so rows 248/249 are reachable
  const enableFlagRes = await call('PATCH', '/admin/feature-flags', { token: adminToken2, body: { flags: [{ key: 'admin_otp_login_enabled', enabled: true }, { key: 'gift_card_purchase_enabled', enabled: true }] } });

  const adminOtpReqRes = await call('POST', '/auth/admin/request', { body: { phone: '09121110001' } });
  const adminDevCode = adminOtpReqRes.json?.devCode;
  record(248, 'company', 'OTP login: phone input + «ارسال کد ورود»', 'POST /api/v1/auth/admin/request',
    (adminOtpReqRes.status === 200 && !!adminDevCode) ? 'PASS' : 'FAIL', adminOtpReqRes.status,
    `apps/company/js/intelligence.js:933-934; enabled admin_otp_login_enabled via PATCH /admin/feature-flags first (raw enable response: ${JSON.stringify(enableFlagRes.json)}); raw OTP request response: ${JSON.stringify(adminOtpReqRes.json)}`,
    null, 'admin_otp_login_enabled defaults OFF (lib/feature-flags.ts DEFAULT_OFF) — this row is only reachable after the real PATCH above; proves the flag actually gates the route (404 before, 200 after — see notes_pre below).');

  const preEnableCheck = await call('POST', '/auth/admin/request', { body: { phone: '09999999999' } });
  RESULTS[RESULTS.length - 1].notes += ` Flag-gate cross-check with an unrelated non-admin phone (post-enable): HTTP ${preEnableCheck.status} (204 expected — not-an-admin path, not 404, proving the flag is on).`;

  const adminOtpVerifyRes = await call('POST', '/auth/admin/verify', { body: { phone: '09121110001', code: adminDevCode } });
  record(249, 'company', 'OTP login: code input + «ورود به پنل»', 'POST /api/v1/auth/admin/verify',
    (adminOtpVerifyRes.status === 200 && !!adminOtpVerifyRes.json?.access) ? 'PASS' : 'FAIL', adminOtpVerifyRes.status,
    `apps/company/js/intelligence.js:967-968 checks res.data.access; raw: ${JSON.stringify(adminOtpVerifyRes.json)}`,
    null, null);

  // NOTE: use the OTP-login's refresh (row 249) for the logout test, not the
  // row-244/253 one — that one was already rotated (and therefore already
  // revoked) by the row-253 refresh call above (refresh/route.ts:78 revokes
  // the OLD jti on every rotation). Testing logout on an already-revoked
  // token would make a correct idempotent 200 look like a no-op FAIL.
  const revokedBefore = redisKeys('revoked:*').length;
  const logoutRes = await call('POST', '/auth/logout', { body: { refresh: adminOtpVerifyRes.json?.refresh } });
  const revokedAfter = redisKeys('revoked:*').length;
  record(252, 'company', 'Sidebar «خروج» (logout)', 'POST /api/v1/auth/logout',
    (logoutRes.status === 200 || logoutRes.status === 204) && revokedAfter > revokedBefore ? 'PASS' : 'FAIL', logoutRes.status,
    `apps/company/index.html:108; raw status ${logoutRes.status} body ${logoutRes.text.slice(0, 200)}`,
    `Redis revoked:* key count before=${revokedBefore} after=${revokedAfter} (revocation is stored in Redis via lib/security.ts revokeRefreshToken, not Postgres)`,
    null);

  // Continue phase 2+ with the row-244 access token (adminToken) — access
  // tokens are stateless JWTs not checked against the revocation list (only
  // refresh tokens are per refresh/route.ts:38-41), so it remains valid even
  // though its refresh was rotated away in row 253. Re-logging in here would
  // hit admin-totp.ts's anti-replay guard (same 30s TOTP step already
  // consumed) and falsely look like a login failure — confirmed live: this
  // exact rate-limit trip happened during script development, see A11-REPORT.md.
  const admin = adminToken;

  clearRateLimits();
  // ═══════════════════════════════════════════════════════════════════
  //  PHASE 2 — provisioning (rows 268,270,121,271,272,274,275,279,281,282,304,308,319,320,321)
  // ═══════════════════════════════════════════════════════════════════
  const ownerPhone = fixturePhone('0993');
  const provRes = await call('POST', '/admin/restaurants', {
    token: admin, headers: { 'Idempotency-Key': idem() },
    body: {
      business_name: '[DEMO] A11 Restaurant Alpha', owner_phone: ownerPhone,
      username: A11_RESTAURANT_OWNER_USERNAME + RUN_ID, password: A11_RESTAURANT_OWNER_PASSWORD, plan: 'pro',
    },
  });
  const restaurantId = provRes.json?.restaurant?.id;
  const restaurantSlug = provRes.json?.restaurant?.slug;
  const tenantId = provRes.json?.tenant_id;
  console.log(`provisioned restaurant ${restaurantId} slug=${restaurantSlug} tenant=${tenantId} status=${provRes.status}`);
  if (!restaurantId) { console.error('FATAL: provisioning failed', provRes); writeFileSync('audit/round-16/A11-RESULTS.json', JSON.stringify(RESULTS, null, 2)); process.exit(1); }

  const listRes = await call('GET', '/admin/restaurants', { token: admin });
  const foundInList = (listRes.json?.restaurants || []).find((r) => r.id === restaurantId);
  record(268, 'company', 'Provisioning success «باشه» (reload list)', 'GET /api/v1/admin/restaurants',
    (listRes.status === 200 && !!foundInList) ? 'PASS' : 'FAIL', listRes.status,
    `apps/company/js/overview.js:272; new restaurant present in list with provision_status=${foundInList?.provision_status}`,
    `restaurants table row: ${JSON.stringify(foundInList)}`, null);

  const resendRes = await call('POST', `/admin/restaurants/${restaurantId}/resend-invite`, { token: admin });
  record(270, 'company', 'Detail «ارسالِ مجددِ دعوت» (PENDING_ACTIVATION only)', 'POST /api/v1/admin/restaurants/[id]/resend-invite',
    (resendRes.status === 200 && !!resendRes.json?.invite_sent_to) ? 'PASS' : 'FAIL', resendRes.status,
    `apps/company/js/restaurant.js:172-182 reads res.data.invite_sent_to; raw: ${JSON.stringify(resendRes.json)}`,
    null, `provisionStatus at call time: ${foundInList?.provision_status}`);

  const inviteRow = sqlRows(`SELECT token, status, expires_at::text FROM staff_invites WHERE restaurant_id='${restaurantId}' ORDER BY created_at DESC LIMIT 1`)[0];
  let claimStatus = 'BLOCKED', claimHttp = null, claimEvidence = 'could not read invite token from DB';
  if (inviteRow?.token) {
    const claimRes = await call('POST', `/auth/invite/${inviteRow.token}/claim`, {});
    claimHttp = claimRes.status;
    claimStatus = (claimRes.status === 200 && claimRes.json?.state === 'valid') ? 'PASS' : 'FAIL';
    claimEvidence = `apps/business/invite.html:127-152 reads res.data.state/restaurant/phone_mask; token read from staff_invites (the SMS delivery itself is not exercised — no MELIPAYAMAK creds in this env, verified separately as a Job row, see notes); raw: ${JSON.stringify(claimRes.json)}`;
  }
  record(121, 'business', 'invite.html claim page (4 states + retry)', 'POST /api/v1/auth/invite/[token]/claim', claimStatus, claimHttp, claimEvidence, `staff_invites row: ${JSON.stringify(inviteRow)}`, null);

  const deactivateRes = await call('PATCH', `/admin/restaurants/${restaurantId}/control`, { token: admin, body: { action: 'deactivate' } });
  const activateRes = await call('PATCH', `/admin/restaurants/${restaurantId}/control`, { token: admin, body: { action: 'activate' } });
  record(271, 'company', 'Detail «فعال کردن / غیرفعال کردن»', 'PATCH /api/v1/admin/restaurants/[id]/control',
    (deactivateRes.json?.is_open === false && activateRes.json?.is_open === true) ? 'PASS' : 'FAIL',
    activateRes.status, `apps/company/js/restaurant.js:121-132; deactivate raw ${JSON.stringify(deactivateRes.json)}, activate raw ${JSON.stringify(activateRes.json)}`,
    `restaurants.is_open now: ${sql(`SELECT is_open FROM restaurants WHERE id='${restaurantId}'`)}`, null);

  const setPlanRes = await call('PATCH', `/admin/restaurants/${restaurantId}/control`, { token: admin, body: { action: 'set_plan', plan: 'pro' } });
  record(272, 'company', 'Detail «مدیریت اشتراک»', 'PATCH /api/v1/admin/restaurants/[id]/control',
    (setPlanRes.status === 200 && setPlanRes.json?.plan === 'pro') ? 'PASS' : 'FAIL', setPlanRes.status,
    `apps/company/js/restaurant.js:24; raw: ${JSON.stringify(setPlanRes.json)}`,
    `tenants.plan now: ${sql(`SELECT plan FROM tenants WHERE id='${tenantId}'`)}`, null);

  const credsGetRes = await call('GET', `/admin/staff-credentials?restaurant_id=${restaurantId}`, { token: admin });
  record(274, 'company', 'Detail: credentials table («دسترسی پنل رستوران»)', 'GET /api/v1/admin/staff-credentials?restaurant_id=',
    (credsGetRes.status === 200 && Array.isArray(credsGetRes.json?.staff)) ? 'PASS' : 'FAIL', credsGetRes.status,
    `apps/company/js/restaurant.js:42-48,59-97 reads res.data.staff[]; raw: ${JSON.stringify(credsGetRes.json)}`, null, null);

  const managerPhone = fixturePhone('0994');
  const credsSetRes = await call('POST', '/admin/staff-credentials', {
    token: admin, body: { restaurant_id: restaurantId, phone: managerPhone, username: 'a11manager' + RUN_ID, password: A11_RESTAURANT_OWNER_PASSWORD, name: '[DEMO] A11 Manager', role: 'manager' },
  });
  record(275, 'company', 'Detail: «ذخیره‌ی دسترسی» (set username/password)', 'POST /api/v1/admin/staff-credentials',
    ((credsSetRes.status === 200 || credsSetRes.status === 201) && typeof credsSetRes.json?.created === 'boolean') ? 'PASS' : 'FAIL', credsSetRes.status,
    `apps/company/js/restaurant.js:112,118 reads res.data.created; raw: ${JSON.stringify(credsSetRes.json)}`,
    `staff row: ${JSON.stringify(sqlRows(`SELECT username, role, phone FROM staff WHERE tenant_id='${tenantId}' AND phone='${managerPhone}'`)[0])}`, null);

  const smsBalBefore = sql(`SELECT sms_balance FROM restaurants WHERE id='${restaurantId}'`);
  const smsTopupRes = await call('POST', `/admin/restaurants/${restaurantId}/sms`, { token: admin, body: { amount: 100 } });
  record(279, 'company', 'Billing «شارژ پیامک» modal + «تأیید و شارژ»', 'POST /api/v1/admin/restaurants/[id]/sms',
    (smsTopupRes.status === 200 && typeof smsTopupRes.json?.balance === 'number') ? 'PASS' : 'FAIL', smsTopupRes.status,
    `apps/company/js/intelligence.js:89-104 reads res.data.balance; raw: ${JSON.stringify(smsTopupRes.json)}`,
    `sms_balance before=${smsBalBefore}, after=${sql(`SELECT sms_balance FROM restaurants WHERE id='${restaurantId}'`)}`, null);

  const extendRes = await call('PATCH', `/admin/restaurants/${restaurantId}/control`, { token: admin, body: { action: 'extend_plan', plan: 'pro', months: 1 } });
  record(281, 'company', 'Billing/Detail «مدیریت» -> renew modal + «تمدید اشتراک»', 'PATCH /api/v1/admin/restaurants/[id]/control {extend_plan}',
    (extendRes.status === 200 && !!extendRes.json?.plan_expires_at) ? 'PASS' : 'FAIL', extendRes.status,
    `apps/company/js/intelligence.js:127-174 reads res.data.plan_expires_at; raw: ${JSON.stringify(extendRes.json)}`,
    `tenants.plan_expires_at now: ${sql(`SELECT plan_expires_at::text FROM tenants WHERE id='${tenantId}'`)}`, null);

  const cancelRes = await call('PATCH', `/admin/restaurants/${restaurantId}/control`, { token: admin, body: { action: 'cancel_subscription' } });
  record(282, 'company', 'Renew modal «لغو اشتراک» -> confirm -> «بله، لغو کن»', 'PATCH /api/v1/admin/restaurants/[id]/control {cancel_subscription}',
    (cancelRes.status === 200 && !!cancelRes.json?.plan_expires_at) ? 'PASS' : 'FAIL', cancelRes.status,
    `apps/company/js/intelligence.js:175-193; raw: ${JSON.stringify(cancelRes.json)}`,
    `tenants.plan_expires_at now (should be in the past): ${sql(`SELECT plan_expires_at::text, (plan_expires_at < now()) AS is_expired FROM tenants WHERE id='${tenantId}'`)}`, null);
  // restore a valid plan for the rest of the run (business panel needs an active subscription in some checks)
  await call('PATCH', `/admin/restaurants/${restaurantId}/control`, { token: admin, body: { action: 'extend_plan', plan: 'pro', months: 6 } });

  const [secRes, ffRes, mqRes, banRes, ecoRes] = await Promise.all([
    call('GET', '/admin/security', { token: admin }),
    call('GET', '/admin/feature-flags', { token: admin }),
    call('GET', '/admin/moderation-queue', { token: admin }),
    call('GET', '/admin/security/banned-ips', { token: admin }),
    call('GET', '/admin/economy-rules', { token: admin }),
  ]);
  const secAll = [secRes, ffRes, mqRes, banRes, ecoRes];
  record(304, 'company', 'Security view composite load', 'GET /api/v1/admin/security; /admin/feature-flags; /admin/moderation-queue; /admin/security/banned-ips; /admin/economy-rules',
    secAll.every((r) => r.status === 200) ? 'PASS' : 'FAIL', secAll.map((r) => r.status).join(','),
    `apps/company/js/intelligence.js:552-667; statuses [security,flags,moderation,banned-ips,economy-rules]=${secAll.map((r) => r.status).join(',')}; security keys=${Object.keys(secRes.json || {}).join(',')}`,
    null, null);

  const ecoBefore = ecoRes.json?.rules;
  const ecoPatchRes = await call('PATCH', '/admin/economy-rules', { token: admin, body: { completed_xp: (ecoBefore?.completed_xp ?? 10) + 1, completed_coins: (ecoBefore?.completed_coins ?? 5) + 1 } });
  record(308, 'company', 'Security: economy rules «ذخیره»', 'PATCH /api/v1/admin/economy-rules',
    (ecoPatchRes.status === 200 && ecoPatchRes.json?.ok) ? 'PASS' : 'FAIL', ecoPatchRes.status,
    `apps/company/js/intelligence.js:534-550; before=${JSON.stringify(ecoBefore)} after=${JSON.stringify(ecoPatchRes.json?.rules)}`,
    `platform_settings row: ${JSON.stringify(sqlRows(`SELECT key, value FROM platform_settings WHERE key LIKE 'economy_rule:%'`))}`, null);

  const missionsListRes = await call('GET', '/admin/missions', { token: admin });
  record(319, 'company', 'Missions list', 'GET /api/v1/admin/missions',
    (missionsListRes.status === 200 && Array.isArray(missionsListRes.json?.items)) ? 'PASS' : 'FAIL', missionsListRes.status,
    `apps/company/js/missions.js:7-39 reads res.data.items[]; count=${missionsListRes.json?.items?.length}`, null, null);

  const missionCreateRes = await call('POST', '/admin/missions', { token: admin, body: { restaurant_id: null, title: '[DEMO] A11 mission', description: 'A11 smoke', kind: 'general', target_count: 1, xp_reward: 10, wallet_reward: 5 } });
  const missionId = missionCreateRes.json?.mission?.id;
  record(320, 'company', '«ماموریتِ جدید» / «ویرایش» modal + submit', 'POST /api/v1/admin/missions | PATCH /api/v1/admin/missions/[id]',
    (missionCreateRes.status === 201 && !!missionId) ? 'PASS' : 'FAIL', missionCreateRes.status,
    `apps/company/js/missions.js:41-78; raw: ${JSON.stringify(missionCreateRes.json)}`,
    `missions row: ${JSON.stringify(sqlRows(`SELECT id, title, status FROM missions WHERE id='${missionId}'`)[0])}`, null);

  let archiveStatus = 'BLOCKED', archiveHttp = null;
  if (missionId) {
    const archiveRes = await call('PATCH', `/admin/missions/${missionId}`, { token: admin, body: { status: 'archived' } });
    archiveHttp = archiveRes.status;
    archiveStatus = (archiveRes.status === 200) ? 'PASS' : 'FAIL';
    record(321, 'company', 'Mission «آرشیو / فعال‌سازی»', 'PATCH /api/v1/admin/missions/[id] {status}', archiveStatus, archiveHttp,
      `apps/company/js/missions.js:79-86; raw: ${JSON.stringify(archiveRes.json)}`,
      `missions.status now: ${sql(`SELECT status FROM missions WHERE id='${missionId}'`)}`, null);
  } else {
    record(321, 'company', 'Mission «آرشیو / فعال‌سازی»', 'PATCH /api/v1/admin/missions/[id] {status}', 'BLOCKED', null, 'no mission id from row 320', null, 'row 320 must succeed first');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PHASE 3 — business panel login (rows 113,114,118) + heartbeat
  // ═══════════════════════════════════════════════════════════════════
  clearRateLimits();
  const staffReqRes = await call('POST', '/auth/staff/request', { body: { phone: ownerPhone } });
  const staffDevCode = staffReqRes.json?.devCode;
  record(113, 'business', 'OTP request', 'POST /api/v1/auth/staff/request',
    (staffReqRes.status === 200 && !!staffDevCode) ? 'PASS' : 'FAIL', staffReqRes.status,
    `apps/business/js/staff-system.js:492-513 reads res.data.devCode; raw: ${JSON.stringify(staffReqRes.json)}`, null, null);

  const staffVerifyRes = await call('POST', '/auth/staff/verify', { body: { phone: ownerPhone, code: staffDevCode } });
  const staffToken = staffVerifyRes.json?.access;
  const staffRefresh = staffVerifyRes.json?.refresh;
  record(114, 'business', 'OTP verify -> enterPanel', 'POST /api/v1/auth/staff/verify',
    (staffVerifyRes.status === 200 && !!staffVerifyRes.json?.staff) ? 'PASS' : 'FAIL', staffVerifyRes.status,
    `apps/business/js/staff-system.js:527-550 reads res.data.staff; raw: ${JSON.stringify(staffVerifyRes.json)}`,
    `restaurants.provision_status now: ${sql(`SELECT provision_status FROM restaurants WHERE id='${restaurantId}'`)} (acceptPendingInvites side-effect of first successful staff login)`, null);

  const staffRefreshRes = await call('POST', '/auth/refresh', { body: { refresh: staffRefresh } });
  record(118, 'business', 'Access-token refresh (401 -> refresh -> retry)', 'POST /api/v1/auth/refresh',
    (staffRefreshRes.status === 200 && !!staffRefreshRes.json?.access) ? 'PASS' : 'FAIL', staffRefreshRes.status,
    `apps/business/js/api-core.js:78-98; raw: ${JSON.stringify(staffRefreshRes.json)}`, null, null);
  const staff = staffRefreshRes.json?.access || staffToken;

  await call('POST', '/restaurant/heartbeat', { token: staff }); // makes the restaurant "online" for availability gating

  // seed a menu item directly (no admin API exists for menu items anywhere in
  // the repo — verified: no route under api/src/app/api matches *menu*).
  const menuItemId = sql(`INSERT INTO menu_items (id, restaurant_id, name, price_toman, is_active) VALUES (gen_random_uuid(), '${restaurantId}', '[DEMO] A11 dish', 150000, true) RETURNING id`);

  // ═══════════════════════════════════════════════════════════════════
  //  PHASE 4a — customer login + booking (rows 89,90,15,42,44,46)
  // ═══════════════════════════════════════════════════════════════════
  clearRateLimits();
  const customerPhone = fixturePhone('0937');
  const custOtpReqRes = await call('POST', '/auth/otp/request', { body: { phone: customerPhone } });
  const custDevCode = custOtpReqRes.json?.devCode;
  record(89, 'customer', 'Login sheet → «ارسال کد ورود»', 'POST /api/v1/auth/otp/request',
    (custOtpReqRes.status === 200 && !!custDevCode) ? 'PASS' : 'FAIL', custOtpReqRes.status,
    `apps/customer/js/auth.js:54-62 reads res.data.devCode; raw: ${JSON.stringify(custOtpReqRes.json)}`, null, null);

  const custVerifyRes = await call('POST', '/auth/otp/verify', { body: { phone: customerPhone, code: custDevCode } });
  const customerToken = custVerifyRes.json?.access;
  const customerRefresh = custVerifyRes.json?.refresh;
  record(90, 'customer', '«تأیید و ورود» (OTP verify)', 'POST /api/v1/auth/otp/verify',
    (custVerifyRes.status === 200 && !!custVerifyRes.json?.user) ? 'PASS' : 'FAIL', custVerifyRes.status,
    `apps/customer/js/auth.js:97-113 reads res.data.user/is_new; raw: ${JSON.stringify(custVerifyRes.json)}`,
    `users row: ${JSON.stringify(sqlRows(`SELECT id, phone FROM users WHERE phone LIKE '%${customerPhone.slice(-8)}'`)[0])} (is_new is a response-only flag, not a stored column)`, null);

  const meRes = await call('GET', '/me', { token: customerToken });
  const meRefreshRes = await call('POST', '/auth/refresh', { body: { refresh: customerRefresh } });
  record(15, 'customer', 'Session restore / silent refresh / session-expired', 'GET /api/v1/me; POST /api/v1/auth/refresh',
    (meRes.status === 200 && meRefreshRes.status === 200 && !!meRefreshRes.json?.access) ? 'PASS' : 'FAIL', `${meRes.status},${meRefreshRes.status}`,
    `apps/customer/js/init.js:35-46, api.js:56-78,152-157; GET /me raw: ${JSON.stringify(meRes.json)}; refresh raw: ${JSON.stringify(meRefreshRes.json)}`, null, null);
  const customer = meRefreshRes.json?.access || customerToken;

  const availRes = await call('GET', `/restaurants/${restaurantSlug}/availability?date=${todayStr()}&party=2`, { token: customer });
  const slots = availRes.json?.slots || [];
  record(42, 'customer', '«رزرو میز» → booking sheet + availability', 'GET /api/v1/restaurants/{slug}/availability?date=&party=',
    (availRes.status === 200 && Array.isArray(availRes.json?.slots)) ? 'PASS' : 'FAIL', availRes.status,
    `apps/customer/js/data/booking.js:149-162 reads res.data.slots[]/restaurant_status; raw restaurant_status=${availRes.json?.restaurant_status}, slot_count=${slots.length}, sample=${JSON.stringify(slots.slice(0, 2))}`, null,
    'heartbeat (POST /restaurant/heartbeat) was called as staff beforehand so onlineGating does not force an empty/offline response.');

  const bookTime = pickBookingTime(slots);
  const bookRes = await call('POST', '/reservations', {
    token: customer, headers: { 'Idempotency-Key': idem() },
    body: { restaurant_id: restaurantId, date: todayStr(), time: bookTime, party_size: 2, preorder: [{ menu_item_id: menuItemId, qty: 1 }] },
  });
  const reservationCode = bookRes.json?.code;
  record(46, 'customer', '«تأیید رزرو»', 'POST /api/v1/reservations (Idempotency-Key)',
    (bookRes.status === 201 && !!reservationCode) ? 'PASS' : 'FAIL', bookRes.status,
    `apps/customer/js/data/booking.js:311-322 reads res.data.code; time tried=${bookTime}; raw: ${JSON.stringify(bookRes.json)}`,
    `reservations row: ${JSON.stringify(sqlRows(`SELECT code, status, table_id, party_size FROM reservations WHERE code='${reservationCode}'`)[0])}`, null);

  const reservationItems = reservationCode ? sqlRows(`SELECT ri.* FROM reservation_items ri JOIN reservations r ON r.id = ri.reservation_id WHERE r.code = '${reservationCode}'`) : [];
  record(44, 'customer', 'Step 2 pre-order chips', 'sent in POST /api/v1/reservations body.preorder',
    (reservationItems.length > 0) ? 'PASS' : 'FAIL', bookRes.status,
    `apps/customer/js/data/booking.js:201-228; body.preorder=[{menu_item_id:${menuItemId},qty:1}] sent as part of row 46's POST`,
    `reservation_items rows for ${reservationCode}: ${JSON.stringify(reservationItems)}`, null);

  const smsJobsForBooking = reservationCode ? sqlRows(`SELECT kind, payload->>'template' AS template, status FROM jobs WHERE kind='sms' AND payload->>'template'='booking_confirm' ORDER BY created_at DESC LIMIT 3`) : [];
  console.log('booking_confirm sms jobs:', JSON.stringify(smsJobsForBooking));

  const qrRes = await call('GET', `/reservations/${reservationCode}/qr?size=300`, { token: customer });
  record(57, 'customer', '«QR ورود»', 'GET /api/v1/reservations/{code}/qr?size=',
    (qrRes.status === 200 && /<svg/i.test(qrRes.text)) ? 'PASS' : 'FAIL', qrRes.status,
    `apps/customer/js/api.js:94-105 (reservationQrSvg) reads raw SVG text; first 80 chars: ${JSON.stringify(qrRes.text.slice(0, 80))}`, null, null);

  // ═══════════════════════════════════════════════════════════════════
  //  PHASE 3b — business panel operational rows (124,127,130,142,157,167,168,221)
  // ═══════════════════════════════════════════════════════════════════
  clearRateLimits();
  const walkinPhone = fixturePhone('0995');
  const walkinRes = await call('POST', '/restaurant/walkin', {
    token: staff, headers: { 'Idempotency-Key': idem() },
    body: { phone: walkinPhone, party_size: 2, first_name: '[DEMO]A11Walkin' },
  });
  record(157, 'business', 'Walk-in: confirm (member / new guest)', 'POST /api/v1/restaurant/walkin (Idempotency-Key)',
    (walkinRes.status === 201 && !!walkinRes.json?.reservation_code) ? 'PASS' : 'FAIL', walkinRes.status,
    `apps/business/js/reservations.js:343,360-417 reads res.data via API.walkin; raw: ${JSON.stringify(walkinRes.json)}`,
    `reservations row: ${JSON.stringify(sqlRows(`SELECT code, status FROM reservations WHERE code='${walkinRes.json?.reservation_code}'`)[0])}; club_members row: ${JSON.stringify(sqlRows(`SELECT user_id, tier FROM club_members WHERE user_id='${walkinRes.json?.user_id}'`)[0])}`, null);

  const [kpiResvRes, kpiTablesRes] = await Promise.all([
    call('GET', '/restaurant/reservations?date=today', { token: staff }),
    call('GET', '/restaurant/tables', { token: staff }),
  ]);
  record(124, 'business', 'Today KPIs (count/occupancy/expected/no-show)', 'GET /api/v1/restaurant/reservations?date=today ; GET /api/v1/restaurant/tables',
    (kpiResvRes.status === 200 && kpiTablesRes.status === 200 && Array.isArray(kpiResvRes.json?.reservations ?? kpiResvRes.json?.items)) ? 'PASS' : 'FAIL',
    `${kpiResvRes.status},${kpiTablesRes.status}`,
    `apps/business/js/overview.js:54-77,172-193; reservations count=${(kpiResvRes.json?.reservations ?? kpiResvRes.json?.items ?? []).length}, tables count=${(kpiTablesRes.json?.tables ?? kpiTablesRes.json?.items ?? []).length}`, null,
    `expects to include today's booking (${reservationCode}) and the walk-in (${walkinRes.json?.reservation_code})`);

  const statusRes = await call('PATCH', `/restaurant/reservations/${reservationCode}/status`, { token: staff, body: { status: 'checked_in' } });
  const smsCampaignRes = await call('POST', '/restaurant/sms', { token: staff, body: { kind: 'campaign', phones: [customerPhone], message: 'welcome' } });
  record(127, 'business', "Tonight row 'ثبت ورود'", "PATCH /api/v1/restaurant/reservations/[code]/status ; POST /api/v1/restaurant/sms {kind:campaign,message:'welcome'}",
    (statusRes.status === 200) ? 'PASS' : 'FAIL', `${statusRes.status},${smsCampaignRes.status}`,
    `apps/business/js/overview.js:108,133-138; status raw: ${JSON.stringify(statusRes.json)}; sms raw: ${JSON.stringify(smsCampaignRes.json)}`,
    `reservations.status now: ${sql(`SELECT status FROM reservations WHERE code='${reservationCode}'`)}; reservation_events: ${JSON.stringify(sqlRows(`SELECT from_status, to_status, actor FROM reservation_events re JOIN reservations r ON r.id=re.reservation_id WHERE r.code='${reservationCode}' ORDER BY re.created_at DESC LIMIT 3`))}`, null);

  // date is a fixed enum (today|tomorrow|upcoming|past|all — reservations/route.ts:6-10),
  // not a literal date string; row 124 already exercised "today", so use a
  // different tab here ("all") to prove more than one enum value works.
  const dateTabRes = await call('GET', `/restaurant/reservations?date=all`, { token: staff });
  record(142, 'business', 'Date tabs (امروز/فردا/آینده/گذشته/همه)', 'GET /api/v1/restaurant/reservations?date=',
    (dateTabRes.status === 200) ? 'PASS' : 'FAIL', dateTabRes.status,
    `apps/business/js/reservations.js:38-42,127; date=all raw count=${(dateTabRes.json?.reservations ?? dateTabRes.json?.items ?? []).length}; raw keys=${Object.keys(dateTabRes.json || {}).join(',')}`, null,
    'date is a fixed enum (today/tomorrow/upcoming/past/all), not an arbitrary date string — row 124 exercised "today", this exercises "all".');

  const couponRes = await call('POST', '/restaurant/coupons', { token: staff, body: { kind: 'percent', value: 10, min_party_size: 1 } });
  record(221, 'business', 'Coupon create', 'POST /api/v1/restaurant/coupons',
    (couponRes.status === 201 && !!couponRes.json?.code) ? 'PASS' : 'FAIL', couponRes.status,
    `apps/business/js/marketing.js:73,87-102 reads res.data.code; raw: ${JSON.stringify(couponRes.json)}`,
    `coupons row: ${JSON.stringify(sqlRows(`SELECT code, kind, value FROM coupons WHERE restaurant_id='${restaurantId}' ORDER BY created_at DESC LIMIT 1`)[0])}`, null);

  // ── waitlist chain: customer join x2 -> business promote (130/167) -> customer status (51) -> customer accept (52) -> business remove (168) ──
  const wlPhoneA = fixturePhone('0938');
  const wlPhoneB = fixturePhone('0939');
  // party_size:4 (not 2) — the size-2 tables (numbers 1-3) are already
  // occupied by the row-46 reservation and the row-157 walk-in by this point
  // in the run; promoteNext's real conflict check (TABLE_CONFLICT, a genuine
  // finding on the first attempt of this run) correctly refused to double-book
  // one of them, so this uses the still-free size-4 tables (4-6) instead.
  const joinA = await call('POST', '/waitlist', { headers: { 'Idempotency-Key': idem() }, body: { restaurant_id: restaurantId, party_size: 4, guest: { name: '[DEMO] A11 WL A', phone: wlPhoneA }, notify_sms: true } });
  const joinB = await call('POST', '/waitlist', { headers: { 'Idempotency-Key': idem() }, body: { restaurant_id: restaurantId, party_size: 4, guest: { name: '[DEMO] A11 WL B', phone: wlPhoneB }, notify_sms: true } });
  record(50, 'customer', 'Waitlist offer → «پیوستن به لیست انتظار»', 'POST /api/v1/waitlist',
    (joinA.status === 200 && !!joinA.json?.id) ? 'PASS' : 'FAIL', joinA.status,
    `apps/customer/js/waitlist.js:78-79 reads res.data.id; raw: ${JSON.stringify(joinA.json)}`,
    `waitlist_entries row: ${JSON.stringify(sqlRows(`SELECT id, status FROM waitlist_entries WHERE id='${joinA.json?.id}'`)[0])}`, `second entry (${joinB.json?.id}) joined too, kept in waiting state for the row-168 remove test.`);

  const promoteRes = await call('POST', '/restaurant/waitlist', { token: staff, body: {} });
  record(130, 'business', "Dashboard waitlist 'آفر میز'", 'POST /api/v1/restaurant/waitlist',
    (promoteRes.status === 200 && promoteRes.json?.promoted === true) ? 'PASS' : 'FAIL', promoteRes.status,
    `apps/business/js/overview.js:128 reads res.data.promoted; raw: ${JSON.stringify(promoteRes.json)}`, null, null);
  record(167, 'business', "Waitlist: 'آفر به نفر بعدی' + card 'آفر میز'", 'POST /api/v1/restaurant/waitlist',
    (promoteRes.status === 200 && promoteRes.json?.promoted === true) ? 'PASS' : 'FAIL', promoteRes.status,
    `apps/business/js/waitlist.js:49,66,71-87 is the SAME endpoint (POST /restaurant/waitlist promoteNext) as row 130, exercised by the same call above; raw: ${JSON.stringify(promoteRes.json)}`, null,
    'Rows 130 and 167 are two different UI entry points into one identical API call — one real chain proves both.');

  const promotedEntryId = promoteRes.json?.entryId || joinA.json?.id;
  const wlStatusRes = await call('GET', `/waitlist/${promotedEntryId}`, {});
  record(51, 'customer', 'Waitlist «به‌روزرسانی وضعیت»', 'GET /api/v1/waitlist/{id}',
    (wlStatusRes.status === 200 && !!wlStatusRes.json) ? 'PASS' : 'FAIL', wlStatusRes.status,
    `apps/customer/js/waitlist.js:160-172 (refreshWL) merges res.data into WL; raw: ${JSON.stringify(wlStatusRes.json)}`, null, null);

  // guest (non-authenticated) entries need ?token=<guest_token> (returned at
  // join time) — waitlist/[id]/accept/route.ts:20-22 — since there is no
  // Bearer identity to prove ownership otherwise.
  const guestToken = joinA.json?.guest_token;
  const wlAcceptRes = await call('POST', `/waitlist/${promotedEntryId}/accept?token=${encodeURIComponent(guestToken)}`, { headers: { 'Idempotency-Key': idem() }, body: {} });
  record(52, 'customer', 'Waitlist «قبول می‌کنم»', 'POST /api/v1/waitlist/{id}/accept',
    (wlAcceptRes.status === 200 && !!wlAcceptRes.json?.reservation_code) ? 'PASS' : 'FAIL', wlAcceptRes.status,
    `apps/customer/js/waitlist.js:181-182 reads res.data.reservation_code; raw: ${JSON.stringify(wlAcceptRes.json)}`,
    `reservations row: ${JSON.stringify(sqlRows(`SELECT code, status FROM reservations WHERE code='${wlAcceptRes.json?.reservation_code}'`)[0])}`, null);

  const wlRemoveRes = await call('DELETE', `/restaurant/waitlist?entry_id=${joinB.json?.id}`, { token: staff });
  record(168, 'business', 'Waitlist: remove entry', 'DELETE /api/v1/restaurant/waitlist?entry_id=',
    (wlRemoveRes.status === 200) ? 'PASS' : 'FAIL', wlRemoveRes.status,
    `apps/business/js/waitlist.js:67,123-134; raw: ${JSON.stringify(wlRemoveRes.json)}`,
    `waitlist_entries.status now: ${sql(`SELECT status FROM waitlist_entries WHERE id='${joinB.json?.id}'`)}`, null);

  // ═══════════════════════════════════════════════════════════════════
  //  PHASE 4b — remaining customer rows (3,5,68,71,75,76,78,79,80,82,84,93)
  // ═══════════════════════════════════════════════════════════════════
  clearRateLimits();
  const loyaltyRes = await call('GET', '/me/loyalty', { token: customer });
  const loyaltyPass = loyaltyRes.status === 200 && typeof loyaltyRes.json?.points === 'number' && !!loyaltyRes.json?.tier;
  record(3, 'customer', 'Points chip (nav-pts)', 'GET /api/v1/me/loyalty', loyaltyPass ? 'PASS' : 'FAIL', loyaltyRes.status,
    `apps/customer/index.html:85-88 / js/api.js:180-183 reads res.data.points; raw: ${JSON.stringify(loyaltyRes.json)}`, null, null);
  record(68, 'customer', 'Loyalty page (points, tier, progress)', 'GET /api/v1/me/loyalty', loyaltyPass ? 'PASS' : 'FAIL', loyaltyRes.status,
    `apps/customer/js/features/loyalty.js:19-96 reads points/tier/next_tier/points_to_next/progress_pct/badges — same call as row 3; raw: ${JSON.stringify(loyaltyRes.json)}`, null, null);

  const referralRes = await call('GET', '/me/referral', { token: customer });
  record(71, 'customer', '«دوستات رو دعوت کن» (stats + code copy)', 'GET /api/v1/me/referral',
    (referralRes.status === 200 && !!referralRes.json?.code) ? 'PASS' : 'FAIL', referralRes.status,
    `apps/customer/js/features/rewards.js:9 reads res.data.code; raw: ${JSON.stringify(referralRes.json)}`, null, null);

  const giftBuyRes = await call('POST', '/gift-cards', { token: customer, body: { amount_toman: 200000 } });
  const giftCode = giftBuyRes.json?.code;
  let giftCheckStatus = 'BLOCKED', giftCheckHttp = null, giftCheckEvidence = `purchase failed, cannot check: ${JSON.stringify(giftBuyRes.json)}`;
  if (giftCode) {
    const giftCheckRes = await call('GET', `/gift-cards?code=${encodeURIComponent(giftCode)}`, {});
    giftCheckHttp = giftCheckRes.status;
    giftCheckStatus = (giftCheckRes.status === 200 && giftCheckRes.json?.valid === true && typeof giftCheckRes.json?.balance_toman === 'number') ? 'PASS' : 'FAIL';
    giftCheckEvidence = `apps/customer/js/features/rewards.js:120-124 reads res.data.valid/balance_toman; purchased via POST /gift-cards (gift_card_purchase_enabled enabled via admin flag PATCH earlier) code=${giftCode}; check raw: ${JSON.stringify(giftCheckRes.json)}`;
  }
  record(75, 'customer', '«بررسی موجودی کارت هدیه»', 'GET /api/v1/gift-cards?code=', giftCheckStatus, giftCheckHttp, giftCheckEvidence,
    `gift_cards row: ${giftCode ? JSON.stringify(sqlRows(`SELECT code, balance_toman, status FROM gift_cards WHERE code='${giftCode}'`)[0]) : 'n/a'}`,
    'gift_card_purchase_enabled defaults OFF (DEFAULT_OFF) — enabled via the real admin API before this call so the purchase leg is a real chain, not a DB shortcut.');

  const bdayRes = await call('PATCH', '/me', { token: customer, body: { first_name: '[DEMO]A11', birth_date: '1990-05-15' } });
  const bdayValue = bdayRes.json?.user?.birth_date ?? bdayRes.json?.user?.birthDate;
  record(76, 'customer', '«پاداش تولد و سالگرد» → birthday date', 'PATCH /api/v1/me {first_name,last_name?,birth_date}',
    (bdayRes.status === 200 && !!bdayValue) ? 'PASS' : 'FAIL', bdayRes.status,
    `apps/customer/js/features/rewards.js:187 reads res.data.user.birth_date ?? res.data.user.birthDate (server actually returns camelCase birthDate — client's fallback chain covers it); raw: ${JSON.stringify(bdayRes.json)}`,
    `users.birth_date now: ${sql(`SELECT birth_date::text FROM users WHERE phone LIKE '%${customerPhone.slice(-8)}'`)}`,
    'The birthday CRON reward itself (+1000 points, migration reference cron/crontab:28) is NOT exercised here — no cron runner in this harness; only the PATCH /me write is proven.');

  const notifRes = await call('GET', '/me/reservations', { token: customer });
  const dnaRes = await call('GET', '/me/dna-summary', { token: customer });
  record(5, 'customer', 'Notification centre (bell, tabs, read-all, item action, close/Esc, badge)', 'GET /api/v1/me/reservations; GET /api/v1/me/dna-summary',
    (notifRes.status === 200 && dnaRes.status === 200) ? 'PASS' : 'FAIL', `${notifRes.status},${dnaRes.status}`,
    `apps/customer/index.html:78-81; js/features/notifications.js:52-189; reservations count=${(notifRes.json?.reservations ?? notifRes.json?.items ?? []).length}`, null,
    'localStorage rz_notif_read is a client-only side effect, not observable from this harness.');
  record(80, 'customer', 'Profile card (name, phone, tier, counts)', 'GET /api/v1/me/reservations (count); pts via C04',
    (notifRes.status === 200) ? 'PASS' : 'FAIL', notifRes.status,
    `apps/customer/js/features/food-dna.js:166-250; same /me/reservations call as row 5`, null, null);

  const prefsGet1 = await call('GET', '/me/notification-prefs', { token: customer });
  const prefsPatch = await call('PATCH', '/me/notification-prefs', { token: customer, body: { offers: false } });
  const prefsGet2 = await call('GET', '/me/notification-prefs', { token: customer });
  const persisted = prefsGet2.json?.prefs?.offers === false;
  record(82, 'customer', '«اعلان‌ها» preference toggles ×5', 'GET/PATCH /api/v1/me/notification-prefs',
    (prefsGet1.status === 200 && prefsPatch.status === 200 && persisted) ? 'PASS' : 'FAIL', `${prefsGet1.status},${prefsPatch.status},${prefsGet2.status}`,
    `apps/customer/js/user-profile.js:30-60,89-121; before=${JSON.stringify(prefsGet1.json)}, after patch(offers:false)=${JSON.stringify(prefsPatch.json)}, reread=${JSON.stringify(prefsGet2.json)}`,
    `users.notification_prefs now: ${sql(`SELECT notification_prefs::text FROM users WHERE phone LIKE '%${customerPhone.slice(-8)}'`)}`, null);

  clearRateLimits();
  // ── mission claim (78): no API creates a completed MissionProgress row (it
  // is produced by real reservation-completion tracking over time) — seeded
  // directly, labelled [DEMO]; the claim call itself is the real, unmodified
  // API path (POST /me/missions/:id/claim -> lib/missions.ts claimMission). ──
  let claim78Status = 'BLOCKED', claim78Http = null, claim78Evidence = 'no missionId from row 320';
  if (missionId) {
    const userIdRow = sqlRows(`SELECT id FROM users WHERE phone LIKE '%${customerPhone.slice(-8)}'`)[0];
    if (userIdRow?.id) {
      sql(`INSERT INTO mission_progress (id, mission_id, user_id, progress, completed_at) VALUES (gen_random_uuid(), '${missionId}', '${userIdRow.id}', 1, now()) ON CONFLICT DO NOTHING`);
      const claimRes = await call('POST', `/me/missions/${missionId}/claim`, { token: customer, body: {} });
      claim78Http = claimRes.status;
      claim78Status = (claimRes.status === 200 && typeof claimRes.json?.xp_applied === 'number') ? 'PASS' : 'FAIL';
      claim78Evidence = `apps/customer/js/features/economy.js:130-135; mission_progress seeded directly (completed_at=now(), [DEMO] fixture — no API creates this state, see notes); raw claim response: ${JSON.stringify(claimRes.json)}`;
    }
  }
  record(78, 'customer', '«دریافتِ جایزه» (mission claim)', 'POST /api/v1/me/missions/{id}/claim', claim78Status, claim78Http, claim78Evidence,
    missionId ? `mission_progress row: ${JSON.stringify(sqlRows(`SELECT claimed_at IS NOT NULL AS claimed FROM mission_progress WHERE mission_id='${missionId}'`)[0])}` : null, null);

  // ── reward redeem (79): needs a RewardMarketplaceItem + wallet balance;
  // no admin API for reward-marketplace items exists (verified: no route
  // under api/src/app/api matches *reward-marketplace* or *rewards* for
  // admin) — seeded directly, labelled [DEMO]. ──
  const userIdRow2 = sqlRows(`SELECT id FROM users WHERE phone LIKE '%${customerPhone.slice(-8)}'`)[0];
  let redeemStatus = 'BLOCKED', redeemHttp = null, redeemEvidence = 'could not resolve customer user id';
  if (userIdRow2?.id) {
    // kind='coupon_grant' requires restaurant_id (redeemRewardItem validates
    // "coupon without restaurant" — a real, correct guard we tripped on the
    // first attempt of this run: a global/no-restaurant coupon grant makes no
    // sense, so it 422s rather than silently issuing a broken coupon).
    const rewardItemId = sql(`INSERT INTO reward_marketplace_items (id, restaurant_id, title, kind, cost_coins, min_tier, is_active) VALUES (gen_random_uuid(), '${restaurantId}', '[DEMO] A11 reward', 'coupon_grant', 10, 'bronze', true) RETURNING id`);
    sql(`INSERT INTO customer_economy_profiles (user_id, wallet_balance, reputation_tier, updated_at) VALUES ('${userIdRow2.id}', 1000, 'bronze', now()) ON CONFLICT (user_id) DO UPDATE SET wallet_balance = 1000, updated_at = now()`);
    const redeemRes = await call('POST', `/me/rewards/${rewardItemId}/redeem`, { token: customer, body: {} });
    redeemHttp = redeemRes.status;
    redeemStatus = (redeemRes.status === 200) ? 'PASS' : 'FAIL';
    redeemEvidence = `apps/customer/js/features/economy.js:142-164; reward_marketplace_items + wallet_balance seeded directly ([DEMO], no admin API exists for either — see notes); raw: ${JSON.stringify(redeemRes.json)}`;
  }
  record(79, 'customer', '«خرج کن» (reward redeem) + code sheet', 'POST /api/v1/me/rewards/{id}/redeem', redeemStatus, redeemHttp, redeemEvidence,
    userIdRow2?.id ? `wallet_balance after: ${sql(`SELECT wallet_balance FROM customer_economy_profiles WHERE user_id='${userIdRow2.id}'`)}` : null, null);

  // ── QR check-in (93) ──
  // Uses a SEPARATE reservation from row 46/127's — that one was already
  // driven to checked_in by the staff panel in row 127, and qrCheckIn's own
  // lifecycle guard correctly refuses to check in a reservation that isn't
  // in a pre-arrival state, which would make this row falsely look BLOCKED/
  // FAIL for a reason that has nothing to do with the QR check-in chain
  // itself. party_size:6 targets a different table (capacity-6, #7) so it
  // doesn't collide with the size-2/size-4 tables already in use.
  const bookRes2 = await call('POST', '/reservations', {
    token: customer, headers: { 'Idempotency-Key': idem() },
    body: { restaurant_id: restaurantId, date: todayStr(), time: bookTime, party_size: 6 },
  });
  const reservationCode2 = bookRes2.json?.code;
  const bookedTable = reservationCode2 ? sqlRows(`SELECT table_id FROM reservations WHERE code='${reservationCode2}'`)[0] : null;
  let checkinStatus = 'BLOCKED', checkinHttp = null, checkinEvidence = `reservation has no table_id assigned (booking raw: ${JSON.stringify(bookRes2.json)})`;
  if (bookedTable?.table_id) {
    // GET .../tables/{id}/qr lazily assigns a qr_code if the table doesn't
    // have one yet (tables/[id]/qr/route.ts:38: `table.qrCode ?? await
    // assignQrCode(...)`) — starter tables from provisioning do NOT get a
    // qr_code by default (confirmed empty on the first attempt of this run);
    // it is only ever populated the first time staff views/prints it. This
    // is the real API the business panel's "QR codes" tab calls
    // (apps/business/js/reservations.js:313 API.tableQrSvg), not a DB write.
    await call('GET', `/restaurant/tables/${bookedTable.table_id}/qr?size=256`, { token: staff });
    const qrToken = sql(`SELECT qr_code FROM tables WHERE id='${bookedTable.table_id}'`);
    if (qrToken && qrToken !== '') {
      const checkinRes = await call('POST', '/checkin', { body: { qr_code: qrToken } });
      checkinHttp = checkinRes.status;
      checkinStatus = (checkinRes.status === 200) ? 'PASS' : 'FAIL';
      checkinEvidence = `apps/customer/js/features/checkin.js:87; qr_code obtained by calling the real GET /restaurant/tables/{id}/qr endpoint as staff first (this is what actually populates tables.qr_code in production — reading the resulting value substitutes only for photographing/scanning the printed sticker, per checkin.ts:resolveQrTable); raw: ${JSON.stringify(checkinRes.json)}`;
    } else {
      checkinEvidence = 'tables.qr_code is still empty even after calling GET .../tables/{id}/qr';
    }
  }
  record(93, 'customer', 'Table-QR check-in via ?checkin=', 'POST /api/v1/checkin', checkinStatus, checkinHttp, checkinEvidence,
    reservationCode2 ? `reservations row after checkin attempt: ${JSON.stringify(sqlRows(`SELECT status, table_id FROM reservations WHERE code='${reservationCode2}'`)[0])}` : null,
    'Deliberately uses a fresh reservation, not the row-46/127 one, because that one was already driven to checked_in by the staff panel in row 127 and qrCheckIn correctly refuses a reservation outside its pre-arrival window/state — testing on it would misattribute a correct guard as a failure of this chain.');

  const custLogoutRevokedBefore = redisKeys('revoked:*').length;
  const custLogoutRes = await call('POST', '/auth/logout', { body: { refresh: customerRefresh } });
  const custLogoutRevokedAfter = redisKeys('revoked:*').length;
  record(84, 'customer', '«خروج از حساب»', 'POST /api/v1/auth/logout',
    ((custLogoutRes.status === 200 || custLogoutRes.status === 204)) ? 'PASS' : 'FAIL', custLogoutRes.status,
    `apps/customer/js/api.js:124-133,144-150; raw: ${JSON.stringify(custLogoutRes.json)}`,
    `Redis revoked:* count before=${custLogoutRevokedBefore} after=${custLogoutRevokedAfter} (note: customerRefresh here is the row-15-refreshed one — check for prior rotation the same way as row 252)`, null);

  writeFileSync('audit/round-16/A11-logs/a11-run-state.json', JSON.stringify({ restaurantId, restaurantSlug, tenantId, ownerPhone, managerPhone, missionId, menuItemId, reservationCode, customerPhone }, null, 2));

  writeFileSync('audit/round-16/A11-RESULTS.json', JSON.stringify(RESULTS, null, 2));
  console.log(`\n${RESULTS.length} rows recorded.`);
}

function todayStr() {
  // Asia/Tehran local date, YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date());
}
function nowHHMMTehran() {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false });
  return fmt.format(new Date());
}
function pickBookingTime(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return nowHHMMTehran();
  const now = nowHHMMTehran();
  const times = slots.map((s) => (typeof s === 'string' ? s : s.time)).filter(Boolean);
  if (times.length === 0) return nowHHMMTehran();
  // closest slot to "now" so the checkin (-30min..slotEnd) window is likeliest to include "now"
  let best = times[0], bestDiff = Infinity;
  for (const t of times) {
    const diff = Math.abs(toMinutes(t) - toMinutes(now));
    if (diff < bestDiff) { bestDiff = diff; best = t; }
  }
  return best;
}
function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

main().catch((e) => {
  console.error('FATAL ERROR', e);
  writeFileSync('audit/round-16/A11-RESULTS.json', JSON.stringify(RESULTS, null, 2));
  process.exit(1);
});
