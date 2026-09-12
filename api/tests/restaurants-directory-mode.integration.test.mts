import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

// ═══════════════════════════════════════════════════════════════════════
//  GET /restaurants?directory=1 — فهرستِ دایرکتوری برای صفحاتِ شهر/آشپزیِ SEO
//
//  ⚠️ باگ (ممیزیِ قراردادِ فرانت↔بک، ۲۰۲۶-۰۹-۱۳): apps/seo صفحه‌ی
//  /city/{c} را از همین endpoint می‌سازد و روی فهرستِ خالی notFound() می‌دهد
//  (ISR ۳۰۰ ثانیه). فهرستِ پیش‌فرض برای اپِ مشتری است و رستورانِ بدونِ
//  heartbeatِ ۹۰ ثانیه‌ی اخیر را پنهان می‌کند ⇒ شبی که هیچ پنلی روشن نیست،
//  صفحه‌ی شهر ۴۰۴ِ کش‌شده به خزنده می‌داد؛ و رستورانِ [DEMO] روی صفحه‌ی
//  عمومی می‌آمد. این فایل هر دو حالت را کنارِ هم می‌سنجد تا حالتِ directory
//  فهرستِ اپِ مشتری را شل نکند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const listRoute = await import('../src/app/api/v1/restaurants/route');
const { invalidatePattern } = await import('../src/lib/cache');

const SFX = Date.now().toString(36);
const CITY = `آزمون‌شهر-${SFX}`;
let tenantId = '';
const ids: Record<string, string> = {};

async function make(label: string, data: { name?: string; isOpen?: boolean; onlineGating?: boolean; lastSeenAt?: Date | null }) {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-dir-${SFX}-${label}`, name: data.name ?? `رستورانِ آزمونِ ${label} ${SFX}`,
      clubPrefix: 'DIR', city: CITY, isOpen: data.isOpen ?? true,
      onlineGating: data.onlineGating ?? true, lastSeenAt: data.lastSeenAt ?? null,
    },
    select: { id: true },
  });
  ids[label] = r.id;
}

async function list(qs: string): Promise<string[]> {
  await invalidatePattern('restaurants*').catch(() => {});
  const res = await listRoute.GET(new Request(`http://x/api/v1/restaurants?${qs}`, { headers: { 'x-real-ip': testIp() } }));
  assert.equal(res.status, 200);
  const body = await res.json();
  return (body.items as Array<{ id: string }>).map(i => i.id);
}

describe('GET /restaurants — حالتِ directory در برابرِ فهرستِ اپِ مشتری', () => {
  before(async () => {
    const t = await db.tenant.create({ data: { name: `[DEMO] dir-${SFX}` }, select: { id: true } });
    tenantId = t.id;
    await make('offline', { lastSeenAt: null });                                   // پنل خاموش
    await make('online', { lastSeenAt: new Date() });                              // پنل روشن
    await make('ungated', { onlineGating: false });
    await make('demo', { name: `[DEMO] آزمون ${SFX}`, onlineGating: false });
    await make('closed', { isOpen: false, onlineGating: false });
  });

  after(async () => {
    await db.restaurant.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
  });

  test('کنترل: فهرستِ پیش‌فرض (اپِ مشتری) هنوز رستورانِ آفلاین را پنهان می‌کند', async () => {
    const got = await list(`city=${encodeURIComponent(CITY)}`);
    assert.ok(got.includes(ids.online));
    assert.ok(got.includes(ids.ungated));
    assert.ok(!got.includes(ids.offline), 'حالتِ پیش‌فرض نباید شل شده باشد');
    assert.ok(!got.includes(ids.closed));
  });

  test('directory=1: آفلاین هست، دمو و بسته نیست', async () => {
    const got = await list(`city=${encodeURIComponent(CITY)}&directory=1`);
    assert.ok(got.includes(ids.offline), 'پیش از رفع، صفحه‌ی شهر وقتی پنل‌ها خاموش بودند ۴۰۴ می‌داد');
    assert.ok(got.includes(ids.online));
    assert.ok(got.includes(ids.ungated));
    assert.ok(!got.includes(ids.demo), 'رستورانِ [DEMO] نباید روی صفحه‌ی عمومیِ SEO بیاید (هم‌راستا با sitemap)');
    assert.ok(!got.includes(ids.closed), 'isOpen=false در دایرکتوری هم نیست');
  });

  test('مقدارِ نامعتبر برای directory ⇒ ۴۲۲، نه حالتِ بی‌صدای پیش‌فرض', async () => {
    const res = await listRoute.GET(new Request(`http://x/api/v1/restaurants?directory=yes`, { headers: { 'x-real-ip': testIp() } }));
    assert.equal(res.status, 422);
  });
});
