#!/usr/bin/env node
// A11 (round 16) — preflight for the runtime-smoke pass.
//
// Why this exists: the 2026-09-03 A11 run pointed REDIS_URL at a dead port
// (56500; the real test-redis container is on 56379). Redis being down does
// NOT hard-fail requests — lib/ratelimit.ts's rateLimitWithFallback() catches
// the ioredis error and falls back to an in-memory cap — so that run produced
// a plausible-looking pass on a degraded stack while api.log filled with
// 16,507 ioredis error lines. This script makes "a dependency is missing"
// impossible to mistake for "everything is fine": every check below does a
// REAL round-trip against the actual dependency, never a socket-open or a
// control-plane status, and any failure is a non-zero exit, never a skip.
//
// Modes:
//   node a11-preflight.mjs pre
//     Run BEFORE starting anything. Asserts:
//       1. port 3000 is UNBOUND (active HTTP probe, not just a TCP connect)
//       2. Postgres reachable at the target DATABASE_URL, via TWO checks:
//          (a) raw TCP connect to the host-mapped port (proves the docker
//              port-forward is actually up — the thing the API itself will
//              use), and
//          (b) a real query executed inside the container (`docker exec ...
//              psql`) against the SAME database, asserting the expected
//              table count — proves it is not just "a postgres", but OUR
//              migrated schema.
//       3. Redis reachable at REDIS_URL via a raw RESP round-trip
//          (PING, then SET+GET+DEL a probe key) over the real TCP socket —
//          not a socket-open, and not routed through `docker exec` (that
//          would test the container's loopback, not the host port the API
//          actually dials).
//
//   node a11-preflight.mjs post <expectedPid>
//     Run AFTER starting the API. Asserts:
//       1. exactly one process is LISTENING on :3000, and its PID matches
//          <expectedPid> (netstat -ano, parsed) — "something answers on
//          3000" is not "my server answers on 3000".
//       2. a real HTTP GET http://localhost:3000/api/health returns 200
//          with checks.db === 'ok' AND checks.redis === 'ok' — proves the
//          running process is actually using a live DB + Redis, from the
//          server's own vantage point, not just from this script's.
//
// Every failure prints a clear reason to stderr and exits non-zero. There is
// no code path that returns 0 when a dependency could not be verified.

import net from 'node:net';
import { execFileSync } from 'node:child_process';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REDIS_URL = process.env.REDIS_URL || '';
const PG_CONTAINER = process.env.A11_PG_CONTAINER || 'rezv-test-pg';
const PG_USER = process.env.A11_PG_USER || 'test';
const EXPECTED_MIN_TABLES = Number(process.env.A11_EXPECTED_TABLES || '72');
const API_PORT = Number(process.env.A11_API_PORT || '3000');

function fail(msg) {
  console.error(`✗ PREFLIGHT FAIL: ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

function parsePgUrl(url) {
  // postgresql://user:pass@host:port/dbname
  const m = url.match(/^postgresql:\/\/([^:]+):([^@]*)@([^:/]+):(\d+)\/([^?]+)/);
  if (!m) fail(`DATABASE_URL is not a parseable postgresql:// URL: "${url.replace(/:[^:@]*@/, ':***@')}"`);
  return { user: m[1], pass: m[2], host: m[3], port: Number(m[4]), db: m[5] };
}

function parseRedisUrl(url) {
  const m = url.match(/^redis:\/\/(?:[^@]*@)?([^:/]+):(\d+)/);
  if (!m) fail(`REDIS_URL is not a parseable redis:// URL: "${url}"`);
  return { host: m[1], port: Number(m[2]) };
}

function tcpConnect(host, port, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`timeout after ${timeoutMs}ms connecting to ${host}:${port}`));
    }, timeoutMs);
    sock.once('connect', () => { clearTimeout(timer); resolve(sock); });
    sock.once('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function httpProbe(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    return { ok: true, status: res.status, text };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── minimal RESP client for a real Redis round-trip (no dependency needed) ──
function redisRoundTrip(host, port, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    let buf = '';
    const steps = ['PING', 'SET a11_preflight_probe alive', 'GET a11_preflight_probe', 'DEL a11_preflight_probe'];
    const expected = [/^\+PONG/, /^\+OK/, /^\$5\r\nalive/, /^:1/];
    let stepIndex = 0;
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`timeout after ${timeoutMs}ms waiting for Redis reply (last step: ${steps[stepIndex] ?? 'connect'})`));
    }, timeoutMs);

    function sendNext() {
      if (stepIndex >= steps.length) {
        clearTimeout(timer);
        sock.end();
        resolve(true);
        return;
      }
      sock.write(steps[stepIndex] + '\r\n');
    }

    sock.once('connect', sendNext);
    sock.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      if (!buf.includes('\r\n')) return;
      const re = expected[stepIndex];
      if (!re.test(buf)) {
        clearTimeout(timer);
        sock.destroy();
        reject(new Error(`Redis step "${steps[stepIndex]}" got unexpected reply: ${JSON.stringify(buf)}`));
        return;
      }
      buf = '';
      stepIndex += 1;
      sendNext();
    });
    sock.once('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`${e.code || 'ERROR'}${e.message ? ': ' + e.message : ''} (${host}:${port})`));
    });
  });
}

async function runPre() {
  if (!DATABASE_URL) fail('DATABASE_URL is not set in the environment running preflight');
  if (!REDIS_URL) fail('REDIS_URL is not set in the environment running preflight');

  // ── 1. port 3000 must be free — active probe, not a skip ──
  const probe = await httpProbe(`http://localhost:${API_PORT}/`, 2000);
  if (probe.ok) {
    fail(`port ${API_PORT} is already answering HTTP requests (status ${probe.status}) — ` +
      `a stale server must be killed before this run starts, or row calls will silently hit it instead of the fresh instance.`);
  }
  // A connection failure (refused/reset/access-denied-on-unbound-port — all
  // observed as valid "nothing is listening" signals on this Windows host)
  // is the success case here; anything else (DNS failure, etc.) is suspicious.
  if (!/ECONNREFUSED|ECONNRESET|EACCES|fetch failed|other side closed/i.test(probe.error || '')) {
    fail(`port ${API_PORT} probe returned an unexpected error (not a clean refusal): ${probe.error}`);
  }
  ok(`port ${API_PORT} is free (connection refused, as required before start)`);

  // ── 2a. Postgres host port reachable (docker port-forward is up) ──
  const pg = parsePgUrl(DATABASE_URL);
  try {
    const sock = await tcpConnect(pg.host, pg.port, 3000);
    sock.destroy();
    ok(`Postgres host port ${pg.host}:${pg.port} accepts TCP connections`);
  } catch (e) {
    fail(`cannot open a TCP connection to Postgres at ${pg.host}:${pg.port}: ${e.message}`);
  }

  // ── 2b. Postgres real query: table count on the target DB ──
  let out;
  try {
    out = execFileSync('docker', [
      'exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', pg.db, '-tAc',
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';",
    ], { encoding: 'utf8', timeout: 10000 });
  } catch (e) {
    fail(`docker exec psql query against database "${pg.db}" failed: ${e.message}`);
  }
  const tableCount = Number(String(out).trim());
  if (!Number.isFinite(tableCount)) fail(`could not parse table count from psql output: ${JSON.stringify(out)}`);
  if (tableCount < EXPECTED_MIN_TABLES) {
    fail(`database "${pg.db}" has ${tableCount} public tables, expected >= ${EXPECTED_MIN_TABLES} — schema not migrated (or wrong DB)`);
  }
  ok(`Postgres database "${pg.db}" has ${tableCount} public tables (>= ${EXPECTED_MIN_TABLES} expected) — real query, not a status flag`);

  // ── 3. Redis real round-trip ──
  const rd = parseRedisUrl(REDIS_URL);
  try {
    await redisRoundTrip(rd.host, rd.port, 4000);
    ok(`Redis at ${rd.host}:${rd.port} answered PING + SET/GET/DEL correctly (real round-trip)`);
  } catch (e) {
    fail(`Redis round-trip against ${rd.host}:${rd.port} failed: ${e.message}`);
  }

  console.log('\n✓ ALL PREFLIGHT CHECKS PASSED — safe to start the API and run rows.');
  process.exit(0);
}

async function runPost() {
  const expectedPid = process.argv[3];
  if (!expectedPid) fail('usage: node a11-preflight.mjs post <expectedPid>');

  // ── 1. exactly one LISTENING process on :3000, and it must be ours ──
  let netstatOut;
  try {
    netstatOut = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 10000 });
  } catch (e) {
    fail(`could not run netstat -ano: ${e.message}`);
  }
  const lines = netstatOut.split(/\r?\n/).filter((l) => {
    const m = l.match(/^\s*TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    return m && Number(m[1]) === API_PORT;
  });
  if (lines.length === 0) fail(`no LISTENING socket found on port ${API_PORT} — the API did not start`);
  const pids = new Set(lines.map((l) => l.match(/(\d+)\s*$/)[1]));
  if (pids.size > 1) fail(`more than one PID is LISTENING on port ${API_PORT}: ${[...pids].join(', ')} — ambiguous identity, cannot trust which server answers`);
  const actualPid = [...pids][0];
  if (actualPid !== String(expectedPid)) {
    fail(`port ${API_PORT} is owned by PID ${actualPid}, but this run started PID ${expectedPid} — ` +
      `"something answers on ${API_PORT}" is not "my server answers on ${API_PORT}". A stale process is still bound.`);
  }
  ok(`port ${API_PORT} is owned by PID ${actualPid}, matching the process this run started`);

  // ── 2. real HTTP health check from the server's own vantage point ──
  const health = await httpProbe(`http://localhost:${API_PORT}/api/health`, 4000);
  if (!health.ok) fail(`GET /api/health did not respond: ${health.error}`);
  let body;
  try { body = JSON.parse(health.text); } catch { fail(`GET /api/health returned non-JSON: ${JSON.stringify(health.text)}`); }
  if (health.status !== 200 || body?.checks?.db !== 'ok' || body?.checks?.redis !== 'ok') {
    fail(`GET /api/health reported unhealthy (status ${health.status}): ${JSON.stringify(body)}`);
  }
  ok(`GET /api/health returned 200 with checks.db=ok and checks.redis=ok (raw: ${JSON.stringify(body)})`);

  console.log('\n✓ ALL POST-START CHECKS PASSED — PID confirmed, health confirmed. Safe to run rows.');
  process.exit(0);
}

const mode = process.argv[2];
if (mode === 'pre') await runPre();
else if (mode === 'post') await runPost();
else { console.error('usage: node a11-preflight.mjs <pre|post> [expectedPid]'); process.exit(2); }
