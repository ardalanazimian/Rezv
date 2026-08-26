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

/** نوشتنِ حالتِ سراسری در بدنه‌ی یک هوک. خروجی مرتب‌شده تا کلید پایدار بماند. */
function globalWrites(node: ts.Node, sf: ts.SourceFile): string[] {
  const hits = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const t = n.left.getText(sf);
      if (/^(globalThis|global)\.|^process\.env\./.test(t)) hits.add(`set:${t}`);
    }
    if (ts.isDeleteExpression(n)) {
      const t = n.expression.getText(sf);
      if (/^process\.env\./.test(t)) hits.add(`del:${t}`);
    }
    if (ts.isCallExpression(n)) {
      const t = n.expression.getText(sf);
      if (/^redis\.(del|flushall|flushdb)$/.test(t)) hits.add(`redis:${t}`);
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
