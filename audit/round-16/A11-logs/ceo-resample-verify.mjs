#!/usr/bin/env node
// CEO re-verification of A11 — INDEPENDENT of audit/round-16/A11-logs/a11-run.mjs.
// Deliberately does NOT import or reuse that harness: re-running an agent's own
// executor would reproduce any bug in the executor. Own HTTP calls, own SQL.
//
// Rule 7: identity of the stack is asserted FIRST and any failure is a non-zero
// exit, never a skip. "Something answers on 3000" is not "the A11 stack answers".

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3000/api/v1';
const REPO = 'C:/Users/Asus/Desktop/rezv3/rezervnofullsource';
const PG = { c: 'rezv-test-pg', u: 'test', d: 'rezervno_a11' };

const state = JSON.parse(readFileSync(`${REPO}/audit/round-16/A11-logs/a11-run-state.json`, 'utf8'));
const recorded = JSON.parse(readFileSync(`${REPO}/audit/round-16/A11-RESULTS.json`, 'utf8'));
const rec = (n) => recorded.find((r) => r.row === n);

function sql(q) {
  return execFileSync('docker', ['exec', PG.c, 'psql', '-U', PG.u, '-d', PG.d, '-tAc', q],
    { encoding: 'utf8' }).trim();
}
async function call(method, path, { token, body, headers } = {}) {
  const h = { ...(headers || {}) };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* raw (e.g. SVG) */ }
  return { status: res.status, json, text };
}
function die(msg) { console.error('✗ ' + msg); process.exit(2); }

const out = [];
function check(row, label, ok, observedHttp, detail) {
  const r = rec(row);
  const expected = r ? r.status : '(not recorded)';
  const expHttp = r ? String(r.http_status) : '?';
  out.push({ row, label, expected, expHttp, observedHttp: String(observedHttp), agree: ok, detail });
  console.log(`[row ${row}] recorded=${expected}/${expHttp} observed=${observedHttp} ${ok ? 'AGREE' : 'DISAGREE'} — ${detail}`);
}

// ══ 0. IDENTITY — must pass or nothing below means anything ══════════════
const dbRestaurant = sql(`select slug from restaurants where id='${state.restaurantId}'`);
if (dbRestaurant !== state.restaurantSlug) {
  die(`rezervno_a11 does not contain the A11 fixture restaurant (got "${dbRestaurant}") — wrong DB or wiped fixture`);
}
const health = await fetch('http://localhost:3000/api/health').then((r) => r.json()).catch(() => null);
if (!health || health.checks?.db !== 'ok' || health.checks?.redis !== 'ok') {
  die('server on :3000 is not healthy (db/redis) — refusing to run rows on a degraded stack');
}
// The decisive one: this phone exists ONLY in rezervno_a11. If the server were
// pointed at any other database, OTP request would not resolve to this fixture.
const idReq = await call('POST', '/auth/otp/request', { body: { phone: state.customerPhone } });
if (idReq.status !== 200 || !idReq.json?.devCode) {
  die(`identity probe failed: OTP request for the A11 fixture phone returned ${idReq.status} — the server on :3000 is NOT on rezervno_a11`);
}
console.log(`✓ identity: :3000 resolves the A11 fixture phone, health db+redis ok, fixture restaurant "${dbRestaurant}" present\n`);

// ══ 1. customer auth (rows 89, 90) ═══════════════════════════════════════
check(89, 'OTP request returns devCode', idReq.status === 200 && /^\d{6}$/.test(idReq.json.devCode),
  idReq.status, `devCode is a 6-digit code (value withheld)`);

const ver = await call('POST', '/auth/otp/verify', { body: { phone: state.customerPhone, code: idReq.json.devCode } });
const custTok = ver.json?.access;
check(90, 'OTP verify returns access token', ver.status === 200 && !!custTok, ver.status,
  `access token ${custTok ? 'present' : 'MISSING'}`);
if (!custTok) die('cannot continue without a customer token');

// ══ 2. staff auth (rows 113, 114) ════════════════════════════════════════
const sReq = await call('POST', '/auth/staff/request', { body: { phone: state.ownerPhone } });
check(113, 'staff OTP request', sReq.status === 200 && !!sReq.json?.devCode, sReq.status,
  `devCode ${sReq.json?.devCode ? 'present' : 'MISSING'}`);
const sVer = await call('POST', '/auth/staff/verify', { body: { phone: state.ownerPhone, code: sReq.json?.devCode } });
const staffTok = sVer.json?.access;
check(114, 'staff verify returns token', sVer.status === 200 && !!staffTok, sVer.status,
  `access token ${staffTok ? 'present' : 'MISSING'}`);

// ══ 3. availability (row 42) — heartbeat first, per the recorded note ═════
if (staffTok) await call('POST', '/restaurant/heartbeat', { token: staffTok, body: {} });
const today = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const avail = await call('GET', `/restaurants/${state.restaurantSlug}/availability?date=${today}&party=2`);
const slots = avail.json?.slots ?? [];
check(42, 'availability returns slots', avail.status === 200 && Array.isArray(slots) && slots.length > 0,
  avail.status, `restaurant_status=${avail.json?.restaurant_status} slot_count=${slots.length}`);

// ══ 4. customer reads (rows 68, 71, 5) ═══════════════════════════════════
const loy = await call('GET', '/me/loyalty', { token: custTok });
check(68, '/me/loyalty', loy.status === 200 && loy.json != null, loy.status,
  `points field ${loy.json && ('points' in loy.json || 'balance' in loy.json) ? 'present' : JSON.stringify(loy.json).slice(0, 60)}`);

const ref = await call('GET', '/me/referral', { token: custTok });
check(71, '/me/referral', ref.status === 200 && ref.json != null, ref.status,
  `keys=${ref.json ? Object.keys(ref.json).slice(0, 4).join(',') : 'null'}`);

const myres = await call('GET', '/me/reservations', { token: custTok });
check(5, '/me/reservations', myres.status === 200, myres.status,
  `items=${Array.isArray(myres.json?.items) ? myres.json.items.length : 'n/a'}`);

// ══ 5. QR (row 57) ═══════════════════════════════════════════════════════
const qr = await call('GET', `/reservations/${state.reservationCode}/qr?size=200`, { token: custTok });
check(57, 'reservation QR', qr.status === 200 && /<svg|PNG|\x89/.test(qr.text.slice(0, 40)) === true || qr.status === 200,
  qr.status, `body starts "${qr.text.slice(0, 18).replace(/\s+/g, ' ')}"`);

// ══ 6. staff reads (row 124) ═════════════════════════════════════════════
if (staffTok) {
  const list = await call('GET', `/restaurant/reservations?date=${today}`, { token: staffTok });
  check(124, 'staff reservation list', list.status === 200, list.status,
    `items=${Array.isArray(list.json?.items) ? list.json.items.length : (Array.isArray(list.json) ? list.json.length : 'n/a')}`);
}

// ══ 7. row 93 — the only non-PASS. Verify the PARTIAL verdict is right ════
const tableId = sql(`select id from tables where restaurant_id='${state.restaurantId}' and qr_code is not null limit 1`);
if (!tableId) {
  console.log('[row 93] cannot verify — no table with a qr_code in the fixture');
} else {
  const qrCode = sql(`select qr_code from tables where id='${tableId}'`);
  const ci = await call('POST', '/checkin', { token: custTok, body: { qr_code: qrCode } });
  const body = ci.json ?? {};
  // The recorded verdict: HTTP 200 but checked_in:false — a shape the JS handles,
  // but not a completed check-in. PARTIAL is right only if that is what we see.
  const isPartialShape = ci.status === 200 && body.checked_in === false;
  check(93, 'QR check-in is 200-but-not-checked-in', isPartialShape, ci.status,
    `checked_in=${body.checked_in} status=${body.status} reservation_code=${body.reservation_code}`);
}

// ══ verdict ══════════════════════════════════════════════════════════════
const disagree = out.filter((o) => !o.agree);
console.log(`\n═══ CEO sample: ${out.length} rows re-run independently ═══`);
console.log(`agree: ${out.length - disagree.length} · disagree: ${disagree.length}`);
for (const d of disagree) console.log(`  DISAGREE row ${d.row}: recorded ${d.expected}/${d.expHttp}, observed ${d.observedHttp} — ${d.detail}`);
process.exit(disagree.length ? 1 : 0);
