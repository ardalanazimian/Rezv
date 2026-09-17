import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, isBlockedWebhookHost, safeLookup } from '../src/lib/security';

// RT-31 (Red Team) — SSRF in the webhook sender. Three regressions, each red on main,
// green after the pinned-lookup fix, one mutation apart:
//   (1) IPv4-mapped IPv6 in hex form (::ffff:a9fe:a9fe = 169.254.169.254) bypassed isPrivateIp.
//   (2) startsWith('fc'|'fd') ran on hostnames → fcbarcelona.com was a false positive.
//   (3) the guard resolved the host, then fetch() re-resolved it → DNS-rebinding window.
//       The fix pins the connection to the validated resolution via safeLookup.

test('isPrivateIp — IPv4-mapped IPv6 in every notation is caught (regression 1)', () => {
  assert.equal(isPrivateIp('::ffff:a9fe:a9fe'), true, 'compressed hex-form mapped metadata IP');
  assert.equal(isPrivateIp('::ffff:169.254.169.254'), true, 'compressed dotted-form mapped metadata IP');
  assert.equal(isPrivateIp('::ffff:7f00:0001'), true, 'compressed hex-form mapped 127.0.0.1');
  // RT-31 follow-up (rezv-75): the UNCOMPRESSED mapped form used to slip through because it
  // never hit the `::ffff:` literal branch. getaddrinfo strings don't pass the URL parser.
  assert.equal(isPrivateIp('0:0:0:0:0:ffff:a9fe:a9fe'), true, 'uncompressed hex-form mapped metadata');
  assert.equal(isPrivateIp('0:0:0:0:0:ffff:169.254.169.254'), true, 'uncompressed dotted-form mapped metadata');
  assert.equal(isPrivateIp('169.254.169.254'), true);
  assert.equal(isPrivateIp('10.0.0.5'), true);
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('0:0:0:0:0:0:0:1'), true, 'uncompressed loopback');
  assert.equal(isPrivateIp('fd12::1'), true);
  assert.equal(isPrivateIp('fe80::1'), true);
});

test('isPrivateIp — 6to4 and NAT64 wrappers are judged by their embedded IPv4 (regression 1b)', () => {
  // 2002:AABB:CCDD::/16 embeds AABB.CCDD as IPv4
  assert.equal(isPrivateIp('2002:a9fe:a9fe::'), true, '6to4 wrapping 169.254.169.254');
  assert.equal(isPrivateIp('2002:7f00:0001::'), true, '6to4 wrapping 127.0.0.1');
  assert.equal(isPrivateIp('2002:0808:0808::'), false, '6to4 wrapping public 8.8.8.8 is allowed');
  // 64:ff9b::/96 NAT64 embeds the low 32 bits as IPv4
  assert.equal(isPrivateIp('64:ff9b::a9fe:a9fe'), true, 'NAT64 wrapping 169.254.169.254 (hex)');
  assert.equal(isPrivateIp('64:ff9b::169.254.169.254'), true, 'NAT64 wrapping 169.254.169.254 (dotted)');
  assert.equal(isPrivateIp('64:ff9b::8.8.8.8'), false, 'NAT64 wrapping public 8.8.8.8 is allowed');
});

test('isPrivateIp — hostnames are never treated as private IPs (regression 2)', () => {
  assert.equal(isPrivateIp('fcbarcelona.com'), false, 'a hostname starting with fc is NOT unique-local');
  assert.equal(isPrivateIp('fd-example.com'), false);
  assert.equal(isPrivateIp('feisty.example.org'), false);
  assert.equal(isPrivateIp('8.8.8.8'), false);
  assert.equal(isPrivateIp('93.184.216.34'), false); // example.com — a real public IP
});

test('isBlockedWebhookHost — names + literal private IPs blocked, public hosts allowed', () => {
  for (const h of ['localhost', 'x.localhost', 'metadata', 'metadata.google.internal',
                   'svc.internal', 'db.local', '169.254.169.254', '::ffff:a9fe:a9fe',
                   '[::ffff:a9fe:a9fe]', '127.0.0.1', '10.1.2.3']) {
    assert.equal(isBlockedWebhookHost(h), true, `${h} must be blocked`);
  }
  for (const h of ['hooks.example.com', 'fcbarcelona.com', 'api.stripe.com', '8.8.8.8']) {
    assert.equal(isBlockedWebhookHost(h), false, `${h} must be allowed`);
  }
});

test('safeLookup — validates the resolution used to connect (regression 3, pinned)', async () => {
  const run = (host: string) => new Promise<{ ok: boolean; addr?: unknown }>((resolve) => {
    safeLookup(host, {}, (err, address) => resolve({ ok: !err, addr: address }));
  });
  // literal IPs resolve to themselves offline → deterministic, no external DNS
  assert.equal((await run('169.254.169.254')).ok, false, 'metadata IP must be rejected at lookup');
  assert.equal((await run('127.0.0.1')).ok, false, 'loopback must be rejected at lookup');
  assert.equal((await run('10.0.0.7')).ok, false, 'private range must be rejected at lookup');
  const pub = await run('8.8.8.8');
  assert.equal(pub.ok, true, 'a public IP must be allowed');
  // NOTE: rebinding is closed structurally — deliverWebhook connects via { lookup: safeLookup },
  // so the resolution safeLookup validates IS the one the socket uses; there is no second
  // independent resolution for a TTL-0 attacker to win.
});
