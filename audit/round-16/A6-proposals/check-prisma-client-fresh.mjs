#!/usr/bin/env node
// Proposed as tools/check-prisma-client-fresh.mjs and wired as api/package.json "pretest".
// Fails when node_modules/.prisma/client was generated from a different prisma/schema.prisma
// (P0-006: a stale local client throws PrismaClientValidationError that CI — which runs
// `npm ci` → postinstall `prisma generate` — never sees).
//
// Prisma copies the schema it generated from into the client dir, RE-FORMATTED: comments are
// dropped, whitespace is re-aligned and back-relation fields are moved to the end of the
// model block. So the comparison must be (a) comment/whitespace-insensitive and
// (b) order-insensitive — a plain normalised string compare gave a FALSE POSITIVE on a client
// generated 6 days after the schema (A6 round 16, 2026-09-03). Compare sorted line multisets.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const api = existsSync('prisma/schema.prisma') ? '.' : 'api';
const src = resolve(api, 'prisma/schema.prisma');
const gen = resolve(api, 'node_modules/.prisma/client/schema.prisma');
const norm = (s) => s.split('\n')
  .map((l) => l.replace(/\/\/.*$/, '').trim().replace(/\s+/g, ' '))
  .filter(Boolean).sort();
if (!existsSync(gen)) { console.error(`✗ ${gen} missing — run: npx prisma generate`); process.exit(1); }
const a = norm(readFileSync(src, 'utf8')), b = norm(readFileSync(gen, 'utf8'));
const only = (x, y) => { const c = new Map(); for (const l of y) c.set(l, (c.get(l) ?? 0) + 1); return x.filter((l) => { const n = c.get(l) ?? 0; if (n > 0) { c.set(l, n - 1); return false; } return true; }); };
const missing = only(a, b), extra = only(b, a);
if (missing.length || extra.length) {
  console.error('✗ Prisma client is STALE: node_modules/.prisma/client was generated from a different prisma/schema.prisma.');
  for (const l of missing.slice(0, 5)) console.error(`    schema has, client lacks: ${l}`);
  for (const l of extra.slice(0, 5)) console.error(`    client has, schema lacks: ${l}`);
  console.error('  Run: npx prisma generate   (validation errors from a stale client are invisible in CI)');
  process.exit(1);
}
console.log(`✓ Prisma client matches prisma/schema.prisma (${a.length} normalised lines)`);
