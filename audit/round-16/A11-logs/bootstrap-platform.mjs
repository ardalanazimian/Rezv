// ⚠️ SUPERSEDED (2026-09-04, A11 credential-hygiene fix — see A11-REPORT.md):
// the 2026-09-03 run used this script, which wrote the generated plaintext
// password into platform-fixture.json next to itself; a hand-made copy of
// that file then ended up at api/platform-fixture.json (un-ignored, inside
// a production app directory) and a second copy in
// audit/round-16/A11-fixtures.json (also un-ignored) — the same secret in
// three places, one of them one `git add -A` away from being committed.
//
// The 2026-09-04 rerun does NOT use this script — it uses the repo's own
// idempotent `api/prisma/create-platform-admin.ts`, which never prints or
// writes the password anywhere (ADMIN_USERNAME/ADMIN_PASSWORD are read from
// the environment only). This file is kept only as a DEAD, superseded
// artifact of the abandoned run (classify, don't delete, per the audit
// constitution) and is patched below so that if anyone still runs it, the
// SAME CLASS of leak (password written to a file) cannot happen again: the
// password is now read from an env var and only ever printed to stdout,
// never written to disk.
import { PrismaClient } from '@prisma/client';
import { randomBytes, randomInt } from 'node:crypto';
import { scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { writeFileSync } from 'node:fs';

const scrypt = promisify(scryptCb);
async function hashPassword(plain) {
  const N = 32768, R = 8, P = 1, KEYLEN = 64, SALT_BYTES = 16, MAXMEM = 64 * 1024 * 1024;
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function fixturePhone(prefix) {
  return `${prefix}${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
}

const db = new PrismaClient();

const platformTenant = await db.tenant.create({
  data: { name: '[DEMO] A11 Platform Tenant', plan: 'enterprise' },
  select: { id: true },
});

const ownerPhone = fixturePhone('0991');
const ownerUsername = 'a11admin';
// ⚠️ was a hardcoded literal ('A11AdminPass123!') — the actual root cause of
// the leak this file is now flagged for: a fixed, guessable, committed-in-
// source password. Now required from the environment; the script refuses to
// run rather than fall back to a guessable default.
const ownerPassword = process.env.ADMIN_PASSWORD;
if (!ownerPassword) {
  console.error('✗ ADMIN_PASSWORD env var is required (no hardcoded fallback — see the note at the top of this file)');
  process.exit(1);
}
const ownerPasswordHash = await hashPassword(ownerPassword);

const owner = await db.staff.create({
  data: {
    tenantId: platformTenant.id,
    phone: ownerPhone,
    name: '[DEMO] A11 Platform Owner',
    role: 'owner',
    isActive: true,
    username: ownerUsername,
    passwordHash: ownerPasswordHash,
  },
  select: { id: true },
});

// ⚠️ the password is NEVER written to disk (that was the actual leak this
// file caused) — only non-secret identifiers go into the file; the password
// is echoed to stdout ONLY, exactly like api/prisma/create-platform-admin.ts
// masks it — actually create-platform-admin.ts doesn't even print it; this
// script prints it once, to the terminal, because the caller supplied it
// themselves via ADMIN_PASSWORD and already knows it.
const out = {
  platformTenantId: platformTenant.id,
  ownerStaffId: owner.id,
  ownerPhone,
  ownerUsername,
};
writeFileSync(new URL('./platform-fixture.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('(password not written to disk — it is exactly what you passed in ADMIN_PASSWORD)');
await db.$disconnect();
