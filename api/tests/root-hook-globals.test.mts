import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import ts from 'typescript';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ ساختاری — هوکِ ریشه‌ای که حالتِ **سراسری** را می‌نویسد
//
//  چرا: `npm test` همه‌ی فایل‌ها را در **یک process** اجرا می‌کند
//  (`_all.runner.mts`). هوکی که بیرونِ هر `describe` نوشته شود به سوئیتِ
//  **ریشه** می‌چسبد، نه به فایلِ خودش — پس `before` در ابتدای کلِ رانْ یک‌بار،
//  `after` در انتهای کلِ رانْ یک‌بار، و `beforeEach` قبل از **هر تستِ کلِ
//  سوئیت** اجرا می‌شود.
//
//  ⚠️ خودِ هوکِ ریشه ممنوع نیست و این گارد آن را ممنوع نمی‌کند: ۱۵۸ هوکِ ریشه
//  در این ریپو هست و درست‌اند، چون فقط فیکسچرِ خودشان را می‌سازند/پاک می‌کنند
//  (به `restaurantId`/`tenantId`ِ خودشان مقید). خطرناک فقط آن‌هایی‌اند که
//  چیزِ **مشترک** را می‌نویسند: `globalThis.*`, `process.env.*`, یا
//  `redis.del/flush`.
//
//  اندازه‌گیریِ واقعی که این فایل را ساخت (۲۰۲۶-۰۸-۲۶، با شمارنده روی اجرای
//  کامل، نه تخمین): `sms-transport-failclosed` یک `beforeEach`ِ ریشه‌ای داشت
//  که همه‌ی کلیدهای `*otp*` و `*rl:*` را پاک می‌کرد و **۱۳۸۲ بار** در یک رانِ
//  ۱۳۸۷ تستی اجرا شد — یعنی سطلِ ریت‌لیمیتِ کلِ سوئیت قبل از تقریباً هر تست
//  خالی می‌شد و یک گاردِ امنیتیِ واقعی از سنجش بیرون می‌افتاد (همان چیزی که
//  کامنتِ `helpers/test-ip.mts` صریحاً ممنوع می‌کند). بعد از انتقال به داخلِ
//  describe: **۴ بار** (= تعدادِ تست‌های همان فایل).
//  همچنین `payments` و `zarinpal` بازیابیِ `globalThis.fetch` را در `after`ِ
//  ریشه داشتند، یعنی stub تا **پایانِ کلِ ران** روی جا می‌ماند.
//
//  الگویِ خط‌مبنا عمداً همان الگویِ `tools/schema-drift-fk-baseline.txt` است:
//  وضعِ فعلی پین می‌شود و گارد فقط روی **مورد تازه** می‌شکند.
//  ✅ کوچک‌شدنِ فایلِ خط‌مبنا پیشرفت است.
// ═══════════════════════════════════════════════════════════════════════

const HOOKS = new Set(['before', 'after', 'beforeEach', 'afterEach']);
const TESTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const BASELINE = join(TESTS_DIR, 'root-hook-globals-baseline.txt');

/** هوک‌هایی که مستقیماً فرزندِ SourceFile‌اند — یعنی داخلِ هیچ describe نیستند. */
function rootHooks(src: string, fileName: string) {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  const out: Array<{ hook: string; node: ts.Node; sf: ts.SourceFile }> = [];
  for (const stmt of sf.statements) {
    if (!ts.isExpressionStatement(stmt)) continue;
    let e: ts.Expression = stmt.expression;
    if (ts.isAwaitExpression(e)) e = e.expression;
    if (!ts.isCallExpression(e)) continue;
    if (!ts.isIdentifier(e.expression) || !HOOKS.has(e.expression.text)) continue;
    out.push({ hook: e.expression.text, node: e, sf });
  }
  return out;
}

// ⚠️ نسخه‌ی اولِ این آشکارساز فقط *متنِ خام* را با پیشوند مچ می‌کرد
// (`^globalThis\.` و …). بازبینیِ ۲۰۲۶-۰۸-۲۷ درست گفت که این سوراخ دارد:
// `process.env['X']`، `Object.assign(process.env, …)`، `process.env.X ??= …`
// و نامِ دیگری برای کلاینتِ Redis همگی از کنارش رد می‌شدند — یعنی گارد
// می‌توانست سبز بماند در حالی که آلودگیِ بینِ تست‌ها اضافه شده است.
// حالا مسیرها روی AST نرمال می‌شوند (`a['b']` ⇒ `a.b`)، هر عملگرِ انتساب
// شمرده می‌شود، و نامِ کلاینتِ Redis از importها استخراج می‌گردد.
//
// 🔬 حدِّ صادقانه (ادعا نمی‌کنم کامل است): aliasِ **یک‌سطحیِ مستقیم** دنبال
// می‌شود (`const env = process.env; env.X = 1`)، ولی نه ارجاعِ غیرمستقیم —
// مثلاً وقتی `process.env` به یک تابعِ کمکی پاس داده شود و آن تابع بنویسد.
// تشخیصِ آن به type-checkerِ کامل و dataflow نیاز دارد و از دامنه‌ی این گارد
// بیرون است. این گارد «شبکه‌ی ایمنیِ الگوهای رایج» است، نه اثبات.

/** مسیرِ نقطه‌ایِ نرمال‌شده‌ی یک دسترسی به property (یا null اگر مسیر نباشد). */
function pathOf(n: ts.Node): string | null {
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isPropertyAccessExpression(n)) {
    const base = pathOf(n.expression);
    return base ? `${base}.${n.name.text}` : null;
  }
  if (ts.isElementAccessExpression(n)) {
    const base = pathOf(n.expression);
    if (!base) return null;
    const arg = n.argumentExpression;
    // `process.env['X']` ⇒ `process.env.X` تا کلیدِ خط‌مبنا با فرمِ نقطه‌ای یکی شود.
    if (ts.isStringLiteralLike(arg)) return `${base}.${arg.text}`;
    return `${base}.[expr]`; // ایندکسِ پویا — ریشه همان است و همان‌قدر خطرناک
  }
  if (ts.isParenthesizedExpression(n)) return pathOf(n.expression);
  return null;
}

const GLOBAL_ROOTS = ['globalThis', 'global', 'process.env'];
function isGlobalPath(p: string): boolean {
  return GLOBAL_ROOTS.some((r) => p === r || p.startsWith(`${r}.`));
}

/** aliasِ یک‌سطحی: `const env = process.env` / `const g = globalThis`. */
function aliasMap(sf: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isIdentifier(n.name)) {
      const init = pathOf(n.initializer);
      if (init && GLOBAL_ROOTS.includes(init)) out.set(n.name.text, init);
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  return out;
}

/** ریشه‌ی مسیر را اگر alias بود به مسیرِ سراسریِ واقعی بازمی‌نویسد. */
function deAlias(p: string | null, aliases: Map<string, string>): string | null {
  if (!p) return null;
  const dot = p.indexOf('.');
  const root = dot === -1 ? p : p.slice(0, dot);
  const mapped = aliases.get(root);
  if (!mapped) return p;
  return dot === -1 ? mapped : mapped + p.slice(dot);
}

/** نام‌هایی که از یک ماژولِ Redis import شده‌اند (هر aliasی که import داده باشد). */
function redisBindings(sf: ts.SourceFile): Set<string> {
  const out = new Set<string>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const spec = stmt.moduleSpecifier;
    if (!ts.isStringLiteralLike(spec) || !/redis/i.test(spec.text)) continue;
    const c = stmt.importClause;
    if (!c) continue;
    if (c.name) out.add(c.name.text);
    const nb = c.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) out.add(nb.name.text);
    else if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) out.add(el.name.text);
  }
  return out;
}

/** متدهایی که حالتِ مشترکِ Redis را **پاک** می‌کنند (خواندن مهم نیست). */
const REDIS_DESTRUCTIVE = new Set(['del', 'unlink', 'flushall', 'flushdb']);

function isRedisRef(recv: string, bindings: Set<string>): boolean {
  const root = recv.split('.')[0];
  return bindings.has(root) || /redis/i.test(root) || /redis/i.test(recv);
}

/** آیا این عملگر، انتساب است؟ (شاملِ `=`، `+=`، `||=`، `??=` و …) */
function isAssignmentOperator(k: ts.SyntaxKind): boolean {
  return k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment;
}

/** نوشتنِ حالتِ سراسری در بدنه‌ی یک هوک. خروجی مرتب‌شده تا کلید پایدار بماند. */
function globalWrites(node: ts.Node, sf: ts.SourceFile): string[] {
  const hits = new Set<string>();
  const aliases = aliasMap(sf);
  const redisNames = redisBindings(sf);
  const visit = (n: ts.Node) => {
    if (ts.isBinaryExpression(n) && isAssignmentOperator(n.operatorToken.kind)) {
      const t = deAlias(pathOf(n.left), aliases);
      if (t && isGlobalPath(t)) hits.add(`set:${t}`);
    }
    if (ts.isDeleteExpression(n)) {
      const t = deAlias(pathOf(n.expression), aliases);
      if (t && isGlobalPath(t)) hits.add(`del:${t}`);
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const callee = n.expression;
      const method = callee.name.text;

      // `Object.assign(process.env, {...})` — نوشتنِ دسته‌جمعی
      if (method === 'assign' && pathOf(callee.expression) === 'Object' && n.arguments.length > 0) {
        const target = deAlias(pathOf(n.arguments[0]), aliases);
        if (target && isGlobalPath(target)) hits.add(`set:${target}.*`);
      }

      // پاک‌کردنِ کلیدهای Redis — با هر نامی که کلاینت import شده باشد
      const recv = pathOf(callee.expression);
      if (recv && REDIS_DESTRUCTIVE.has(method.toLowerCase()) && isRedisRef(recv, redisNames)) {
        hits.add(`redis:${recv}.${method}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(node, visit);
  return [...hits].sort();
}

/** کلیدِ پایدار: بدونِ شماره‌ی خط، تا ویرایشِ بی‌ربط خط‌مبنا را نشکند. */
function scan(): { keys: Set<string>; rootHookCount: number; fileCount: number } {
  const files = readdirSync(TESTS_DIR).filter((f) => f.endsWith('.test.mts')).sort();
  const keys = new Set<string>();
  let rootHookCount = 0;
  for (const f of files) {
    const src = readFileSync(join(TESTS_DIR, f), 'utf8');
    for (const h of rootHooks(src, f)) {
      rootHookCount++;
      const w = globalWrites(h.node, h.sf);
      if (w.length) keys.add(`${f} :: ${h.hook} :: ${w.join(' ')}`);
    }
  }
  return { keys, rootHookCount, fileCount: files.length };
}

function readBaseline(): Set<string> {
  return new Set(
    readFileSync(BASELINE, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
}

describe('گاردِ ساختاری — هوکِ ریشه‌ای که حالتِ سراسری می‌نویسد', () => {
  test('کنترلِ مثبتِ خودِ اسکنر: فایل‌ها واقعاً پارس و هوک‌های ریشه پیدا می‌شوند', () => {
    // بدونِ این، یک اسکنرِ خرابِ «همیشه صفر» هم سبز می‌شد و گارد بی‌اثر می‌ماند.
    const { rootHookCount, fileCount } = scan();
    assert.ok(fileCount > 100, `انتظار >۱۰۰ فایلِ تست، دیده شد ${fileCount}`);
    assert.ok(rootHookCount > 100,
      `انتظار >۱۰۰ هوکِ ریشه (الگویِ رایجِ این ریپو)، دیده شد ${rootHookCount} — ` +
      'عددِ خیلی کم یعنی اسکنر شکسته، نه اینکه ریپو تمیز شده');
  });

  test('کنترلِ مثبت: هوکِ ریشه‌ای که سراسری می‌نویسد تشخیص داده می‌شود', () => {
    const src = "before(() => { globalThis.fetch = x; });";
    const hooks = rootHooks(src, 'synthetic.ts');
    assert.equal(hooks.length, 1, 'هوکِ ریشه باید پیدا شود');
    assert.deepEqual(globalWrites(hooks[0].node, hooks[0].sf), ['set:globalThis.fetch']);
  });

  test('کنترلِ منفی: همان هوک داخلِ describe اصلاً هوکِ ریشه نیست', () => {
    // بدونِ این، یک اسکنرِ «همه‌چیز را بگیر» هم سبز می‌شد و ۱۵۸ هوکِ درست را
    // هم قرمز می‌کرد — یعنی گارد غیرقابلِ‌استفاده می‌شد.
    const src = "describe('d', () => { before(() => { globalThis.fetch = x; }); });";
    assert.equal(rootHooks(src, 'synthetic.ts').length, 0);
  });

  test('کنترلِ منفی: هوکِ ریشه‌ای که فقط فیکسچرِ خودش را می‌سازد آزاد است', () => {
    const src = "before(async () => { await db.tenant.create({ data: { name: 'x' } }); });";
    const hooks = rootHooks(src, 'synthetic.ts');
    assert.equal(hooks.length, 1);
    assert.deepEqual(globalWrites(hooks[0].node, hooks[0].sf), [],
      'ساختِ فیکسچرِ خودی نباید خطرناک شمرده شود');
  });

  // ── کنترل‌های مثبتِ فرم‌هایی که نسخه‌ی اولِ آشکارساز از دستشان می‌داد ──
  // هرکدام یک باگِ واقعیِ گارد بود، نه فرضِ نظری: دو موردِ اولْ همان روزی که
  // اضافه شدند دو هوکِ ریشه‌ایِ واقعی را در همین ریپو لو دادند
  // (`auth-guards` و `sms-queue-fallback-balance`).
  const detect = (src: string) => {
    const hooks = rootHooks(src, 'synthetic.ts');
    assert.equal(hooks.length, 1, 'هوکِ ریشه باید پیدا شود');
    return globalWrites(hooks[0].node, hooks[0].sf);
  };

  test('کنترلِ مثبت: نوشتن با براکت (`process.env[k]`) هم دیده می‌شود', () => {
    assert.deepEqual(detect("after(() => { process.env['SMS_KEY'] = 'x'; });"),
      ['set:process.env.SMS_KEY']);
    // ایندکسِ پویا هم همان‌قدر خطرناک است و نباید بی‌صدا رد شود.
    assert.deepEqual(detect('after(() => { process.env[k] = v; });'),
      ['set:process.env.[expr]']);
  });

  test('کنترلِ مثبت: `delete` با براکت هم دیده می‌شود', () => {
    assert.deepEqual(detect('before(() => { delete process.env[k]; });'),
      ['del:process.env.[expr]']);
  });

  test('کنترلِ مثبت: عملگرهای انتسابِ دیگر (`??=`, `+=`) هم انتساب‌اند', () => {
    assert.deepEqual(detect("before(() => { process.env.FLAG ??= '1'; });"),
      ['set:process.env.FLAG']);
  });

  test('کنترلِ مثبت: `Object.assign(process.env, …)` نوشتنِ دسته‌جمعی است', () => {
    assert.deepEqual(detect("before(() => { Object.assign(process.env, { A: '1' }); });"),
      ['set:process.env.*']);
  });

  test('کنترلِ مثبت: aliasِ یک‌سطحیِ مستقیم دنبال می‌شود', () => {
    const src = "const env = process.env;\nbefore(() => { env.SMS_KEY = 'x'; });";
    assert.deepEqual(detect(src), ['set:process.env.SMS_KEY']);
  });

  test('کنترلِ مثبت: کلاینتِ Redis با هر نامی که import شده باشد', () => {
    const src = "import { redis as r } from '../src/lib/redis.ts';\nafter(() => { r.flushall(); });";
    assert.deepEqual(detect(src), ['redis:r.flushall']);
  });

  test('کنترلِ منفی: پاک‌کردنِ فیکسچرِ خودی هنوز آزاد است', () => {
    // بدونِ این، سخت‌گیریِ تازه ۱۵۸ هوکِ درست را قرمز می‌کرد.
    assert.deepEqual(detect("after(async () => { await db.tenant.deleteMany({ where: { id } }); });"), []);
    assert.deepEqual(detect('before(() => { const v = process.env.NODE_ENV; use(v); });'), [],
      '**خواندنِ** متغیرِ محیطی نوشتن نیست');
  });

  test('🔴 هیچ موردِ تازه‌ای بیرون از خط‌مبنا اضافه نشده', () => {
    const { keys } = scan();
    const baseline = readBaseline();
    const added = [...keys].filter((k) => !baseline.has(k)).sort();
    assert.deepEqual(added, [],
      'هوکِ ریشه‌ای که حالتِ سراسری می‌نویسد اضافه شده است. رانرِ ما تک-process ' +
      'است، پس این هوک روی **کلِ** سوئیت اثر می‌گذارد نه فقط فایلِ خودت.\n' +
      'راهِ درست: هوک را داخلِ `describe`ِ همان فایل ببر.\n' +
      'مواردِ تازه:\n  ' + added.join('\n  '));
  });

  test('⚠️ خط‌مبنا کهنه نیست — هر خطش هنوز در کد وجود دارد', () => {
    // وگرنه خط‌مبنا بی‌صدا رشد می‌کند و مجوزِ دائمی می‌شود.
    const { keys } = scan();
    const stale = [...readBaseline()].filter((b) => !keys.has(b)).sort();
    assert.deepEqual(stale, [],
      'این خطوطِ خط‌مبنا دیگر در کد نیستند — حذفشان کن (کوچک‌شدنِ خط‌مبنا ' +
      'پیشرفت است):\n  ' + stale.join('\n  '));
  });
});
