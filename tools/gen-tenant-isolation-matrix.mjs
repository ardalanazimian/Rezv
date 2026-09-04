#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  تولیدکننده‌ی ماتریسِ ایزولاسیونِ tenant  (P0-021 / دستورِ سومِ مالک)
//
//  چرا وجود دارد: RLS در این دیتابیس بی‌اثر است (۶۱ جدول با RLSِ فعال و صفر
//  policy، اپ با نقشِ owner + SUPERUSER + BYPASSRLS). پس مرزِ بینِ مستأجرها
//  **فقط** لایه‌ی اپلیکیشن است. یک ماتریسِ نمونه‌گیری‌شده برای چنین مرزی کافی
//  نیست — این اسکریپت فهرست را از خودِ درختِ روت **ماشینی** می‌سازد تا
//  «یادمان رفت این روت را تست کنیم» ممکن نباشد.
//
//  خروجی: audit/round-20/tenant-isolation-matrix.json
//
//  ⚠️ این اسکریپت فقط *فهرست* می‌سازد. اجرا و اثباتِ FORBIDDEN_TENANT کارِ
//     تستِ زمانِ اجراست. یک ماتریسِ تولیدشده‌ی اجرانشده هیچ چیزی ثابت نمی‌کند.
//
//  ⚠️ هر روتی که guardش قابلِ تشخیص نباشد `UNGUARDED` علامت می‌خورد و
//     شکاف حساب می‌شود، نه عبور. «نمی‌دانیم» هرگز «امن است» گزارش نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Paths resolve from THIS file, never from cwd: the guard-coverage gate imports buildMatrix()
// while `npm test` runs with cwd=api/, and a cwd-relative root silently found zero routes —
// which would have made the gate pass by scanning nothing.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_ROOT = join(REPO, 'api/src/app/api');
const OUT = join(REPO, 'audit/round-20/tenant-isolation-matrix.json');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (entry === 'route.ts') acc.push(p);
  }
  return acc;
}

/** api/src/app/api/v1/restaurant/[id]/route.ts -> /api/v1/restaurant/:id */
function urlOf(file) {
  const rel = relative(API_ROOT, file).split(sep).slice(0, -1);
  return '/api/' + rel.map((s) => (s.startsWith('[') ? ':' + s.replace(/[[\].]/g, '') : s)).join('/');
}

/** Body of a named function/const, from its definition to the next top-level `export`/`function`/`const` at column 0. */
function bodyOf(src, name) {
  const def = new RegExp(
    `(?:async\\s+)?function\\s+${name}\\s*\\(|const\\s+${name}\\s*[:=]`,
    'm',
  );
  const m = def.exec(src);
  if (!m) return null;
  const rest = src.slice(m.index);
  const end = rest.slice(1).search(/\n(?:export\s|async function\s|function\s|const\s)/);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

// The real guard vocabulary of this repo, discovered from the imports rather than assumed:
//   withRestaurantAuth (54) · requireAdmin (39) · guardMaintenance (9) · withStaffAuth (2)
//   authFromRequest from '@/lib/jwt' — the per-USER boundary used by /me/*
// `boundary` says WHICH boundary the route sits on. Only `restaurant-tenant` rows are provable
// by a cross-tenant restaurant token; the others need their own negative test, and saying so is
// the point — a matrix that quietly drops them would look complete while proving less.
/** `export const GET = POST;` -> return the body the alias points at. */
function aliasBody(src, name) {
  const m = new RegExp(`^export\\s+const\\s+${name}\\s*=`, 'm').exec(src);
  if (!m) return null;
  const tail = src.slice(m.index);
  const stop = tail.slice(1).search(/\nexport\s/);
  return stop === -1 ? tail : tail.slice(0, stop + 1);
}

const GUARDS = [
  { re: /\bwithRestaurantAuth\s*\(/, guard: 'withRestaurantAuth', boundary: 'restaurant-tenant' },
  { re: /\bwithStaffAuth\s*\(/, guard: 'withStaffAuth', boundary: 'restaurant-tenant' },
  { re: /\brequireAdmin\s*\(/, guard: 'requireAdmin', boundary: 'platform-admin' },
  { re: /\bguardMaintenance\s*\(/, guard: 'guardMaintenance', boundary: 'maintenance-key' },
  { re: /\bauthFromRequest\s*\(/, guard: 'authFromRequest', boundary: 'user' },
  { re: /\brequireUser\s*\(/, guard: 'requireUser', boundary: 'user' },
];

// Some routes authenticate inline instead of through a named guard — /api/metrics checks
// METRICS_TOKEN itself, /v1/checkin reads the Authorization header, /v1/waitlist/:id accepts a
// hashed guest token via ?token=. Lumping those in with genuinely public routes would be a lie in
// BOTH directions: it hides that they are protected, and it hides that nothing verifies HOW.
// They get their own class so each one must be proven individually.
const INLINE_AUTH = /headers\.get\(\s*['"]authorization['"]|\bcallerId\s*\(|\btokensEqual\s*\(|METRICS_TOKEN|\bguestToken\b/i;

const EXPECTATION = {
  'restaurant-tenant':
    'cross-tenant restaurant token MUST yield FORBIDDEN_TENANT — this is the row the matrix exists to prove',
  'platform-admin':
    'a non-admin or cross-tenant token MUST be rejected; only a platform admin may pass',
  'maintenance-key':
    'no secret => 401; correct secret => 200. Not reachable with any tenant token',
  user: "another user's token MUST NOT read or mutate this user's rows (the per-user boundary, not the tenant one)",
  'inline-custom':
    'authenticates inline rather than via a named guard — each one must be proven individually with an executed request',
  UNGUARDED:
    'no recognised guard and no inline auth. Either deliberately public (must be named and justified individually) or a hole. UNKNOWN is a GAP, never a pass',
};

/**
 * Find the guard protecting an exported handler. Follows one level of wrapper
 * (e.g. `withApiMetrics('/path', GET_impl)`) and method aliases (`export const GET = POST`).
 * Returns null when nothing recognised is found — null is a GAP, never an implicit pass.
 */
function classify(src, expr, depth = 0, seen = new Set()) {
  if (depth > 3 || !expr) return null;
  for (const g of GUARDS) if (g.re.test(expr)) return g;
  for (const ident of expr.match(/\b[A-Za-z_$][\w$]*\b/g) ?? []) {
    // NOTE: method names are NOT skipped — `export const GET = POST;` is a real alias in this
    // repo (every maintenance route uses it) and skipping it left 18 routes wrongly unclassified.
    if (ident.startsWith('with') || ident === 'req' || ident === 'NextResponse') continue;
    if (seen.has(ident)) continue;
    seen.add(ident);
    const body = bodyOf(src, ident) ?? aliasBody(src, ident);
    if (body && body !== expr) {
      const found = classify(src, body, depth + 1, seen);
      if (found) return found;
    }
  }
  return null;
}

export function buildMatrix() {
const rows = [];
for (const file of walk(API_ROOT).sort()) {
  const src = readFileSync(file, 'utf8');
  const url = urlOf(file);
  for (const method of METHODS) {
    const decl = new RegExp(
      `^export\\s+(?:const\\s+${method}\\s*[:=]|(?:async\\s+)?function\\s+${method}\\s*\\()`,
      'm',
    );
    if (!decl.test(src)) continue;

    // the expression this method is assigned/defined as
    const at = decl.exec(src).index;
    const tail = src.slice(at);
    const stop = tail.slice(1).search(/\nexport\s/);
    const expr = stop === -1 ? tail : tail.slice(0, stop + 1);

    let hit = classify(src, expr);
    if (!hit && INLINE_AUTH.test(src)) hit = { guard: 'inline', boundary: 'inline-custom' };
    const permission = /permission\s*:\s*'([^']+)'/.exec(expr)?.[1] ?? null;

    rows.push({
      url,
      method,
      // repo-relative on purpose: an absolute path would bake this machine into a committed artifact
      file: relative(REPO, file).split(sep).join('/'),
      guard: hit?.guard ?? 'UNGUARDED',
      permission,
      boundary: hit?.boundary ?? 'UNGUARDED',
      expectation: EXPECTATION[hit?.boundary ?? 'UNGUARDED'],
    });
  }
}

  const byGuard = rows.reduce((a, r) => ((a[r.guard] = (a[r.guard] ?? 0) + 1), a), {});
  const byBoundary = rows.reduce((a, r) => ((a[r.boundary] = (a[r.boundary] ?? 0) + 1), a), {});
  const unclassified = rows.filter((r) => r.boundary === 'UNGUARDED');
  const tenantRows = rows.filter((r) => r.boundary === 'restaurant-tenant');

  return {
    generated_by: 'tools/gen-tenant-isolation-matrix.mjs',
    generated_at: new Date().toISOString().slice(0, 10),
    why: 'RLS is inert (P0-021), so the application layer is the SOLE tenant boundary. This matrix is machine-generated so no route can be forgotten.',
    route_files: new Set(rows.map((r) => r.file)).size,
    total_endpoints: rows.length,
    by_guard: byGuard,
    by_boundary: byBoundary,
    tenant_scoped_count: tenantRows.length,
    unguarded_count: unclassified.length,
    unguarded: unclassified.map((r) => `${r.method} ${r.url} (${r.file})`),
    note: 'Generating this list proves nothing on its own. Each row is proven only by an executed cross-tenant request with its raw status recorded.',
    rows,
  };
}

// ── CLI mode ────────────────────────────────────────────────────────────
// Importing this module must never write files or print; the guard-coverage
// gate imports buildMatrix() and would otherwise rewrite an audit artifact
// as a side effect of running the test suite.
if (process.argv[1] && process.argv[1].endsWith('gen-tenant-isolation-matrix.mjs')) {
const out = buildMatrix();
const byBoundary = out.by_boundary;
const unguarded_count = out.unguarded_count;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(
  `route files: ${out.route_files} | endpoints: ${out.total_endpoints}\n` +
    'by boundary: ' + Object.entries(byBoundary).map(([k, v]) => `${k}=${v}`).join(' ') + '\n' +
    `tenant-scoped rows to prove: ${out.tenant_scoped_count} | UNGUARDED (needs hand classification): ${unguarded_count}`,
);
console.log(`wrote ${OUT}`);
}
