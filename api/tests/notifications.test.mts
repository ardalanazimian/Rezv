import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { buildActivityFeed } = await import('../src/lib/notifications.ts');

// ═══════════════════════════════════════════════════════════════════════
//  فیدِ فعالیتِ اخیر (زنگوله‌یِ اعلان) — این تست‌ها فقط ریاضیاتِ خالصِ
//  ادغام/مرتب‌سازی/برش را می‌سنجند (بدونِ DB). یافته‌ی ریویوی Copilot روی
//  PR: منطقِ ادغامِ سه منبع (رزرو/نظر/ریسک) هیچ پوششِ تستی نداشت.
// ═══════════════════════════════════════════════════════════════════════

const guest = (first: string, last = ''): { firstName: string | null; lastName: string | null } => ({ firstName: first, lastName: last || null });

describe('buildActivityFeed', () => {
  test('آرایه‌های خالی → فیدِ خالی', () => {
    assert.deepEqual(buildActivityFeed([], [], [], 10), []);
  });

  test('یک رزرو → متنِ فارسیِ درست با نامِ کاربر', () => {
    const items = buildActivityFeed(
      [{ id: 'r1', createdAt: new Date('2026-08-01T10:00:00Z'), partySize: 3, guestName: null, user: guest('امیر', 'حسینی') }],
      [], [], 10,
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].id, 'resv:r1');
    assert.equal(items[0].ic, 'green');
    assert.equal(items[0].text, 'امیر حسینی برایِ 3 نفر رزرو کرد');
  });

  test('رزروِ بدونِ حسابِ کاربری → از guestName استفاده می‌کند', () => {
    const items = buildActivityFeed(
      [{ id: 'r2', createdAt: new Date('2026-08-01T10:00:00Z'), partySize: 2, guestName: 'رضا محمدی', user: null }],
      [], [], 10,
    );
    assert.equal(items[0].text, 'رضا محمدی برایِ 2 نفر رزرو کرد');
  });

  test('نه کاربر نه guestName → به «مهمان» بازمی‌گردد', () => {
    const items = buildActivityFeed(
      [{ id: 'r3', createdAt: new Date('2026-08-01T10:00:00Z'), partySize: 4, guestName: null, user: null }],
      [], [], 10,
    );
    assert.ok(items[0].text.startsWith('مهمان '));
  });

  test('نظر با متن → نقل‌قولِ کوتاه‌شده در text', () => {
    const items = buildActivityFeed([], [
      { id: 'v1', createdAt: new Date('2026-08-01T09:00:00Z'), rating: 5, body: 'عالی بود، حتماً برمی‌گردم', user: guest('نیلوفر', 'رضایی') },
    ], [], 10);
    assert.equal(items[0].ic, 'blue');
    assert.match(items[0].text, /نیلوفر رضایی 5 ستاره داد: «عالی بود، حتماً برمی‌گردم»/);
  });

  test('نظرِ بدونِ متن → بدونِ نقل‌قول (نه «: «»»)', () => {
    const items = buildActivityFeed([], [
      { id: 'v2', createdAt: new Date('2026-08-01T09:00:00Z'), rating: 4, body: null, user: guest('کیان') },
    ], [], 10);
    assert.equal(items[0].text, 'کیان 4 ستاره داد');
  });

  test('نظرِ بلند (بیش از ۶۰ کاراکتر) → با … بریده می‌شود', () => {
    const longBody = 'الف'.repeat(30); // ۹۰ کاراکتر
    const items = buildActivityFeed([], [
      { id: 'v3', createdAt: new Date('2026-08-01T09:00:00Z'), rating: 3, body: longBody, user: guest('سارا') },
    ], [], 10);
    assert.ok(items[0].text.includes('…'));
    assert.ok(!items[0].text.includes(longBody)); // نسخه‌ی کاملِ بریده‌نشده نباید باشد
  });

  test('هشدارِ ریزش → درصدِ ریسک در text', () => {
    const items = buildActivityFeed([], [], [
      { userId: 'u1', updatedAt: new Date('2026-08-01T08:00:00Z'), churnRiskScore: 82, user: guest('مریم', 'احمدی') },
    ], 10);
    assert.equal(items[0].ic, 'amber');
    assert.equal(items[0].id, 'risk:u1');
    assert.equal(items[0].text, 'مریم احمدی — ریسکِ ریزش 82٪');
  });

  test('ادغامِ هر سه منبع، مرتب‌شده بر اساسِ زمان (نزولی)', () => {
    const items = buildActivityFeed(
      [{ id: 'r1', createdAt: new Date('2026-08-01T08:00:00Z'), partySize: 2, guestName: null, user: guest('امیر') }],
      [{ id: 'v1', createdAt: new Date('2026-08-01T12:00:00Z'), rating: 5, body: null, user: guest('نیلوفر') }],
      [{ userId: 'u1', updatedAt: new Date('2026-08-01T10:00:00Z'), churnRiskScore: 70, user: guest('مریم') }],
      10,
    );
    assert.deepEqual(items.map((i) => i.id), ['rev:v1', 'risk:u1', 'resv:r1']); // ۱۲ > ۱۰ > ۸
  });

  test('در تساویِ دقیقِ زمان، ترتیبِ ورودی حفظ می‌شود (sort پایدار)', () => {
    const t = new Date('2026-08-01T10:00:00Z');
    const items = buildActivityFeed(
      [{ id: 'r1', createdAt: t, partySize: 2, guestName: null, user: guest('امیر') }],
      [{ id: 'v1', createdAt: t, rating: 5, body: null, user: guest('نیلوفر') }],
      [{ userId: 'u1', updatedAt: t, churnRiskScore: 70, user: guest('مریم') }],
      10,
    );
    // ترتیبِ ورودیِ تابع: رزرو، نظر، ریسک — همان ترتیب باید حفظ شود
    assert.deepEqual(items.map((i) => i.id), ['resv:r1', 'rev:v1', 'risk:u1']);
  });

  test('بیشتر از limit → فقط تازه‌ترین‌ها نگه داشته می‌شوند', () => {
    const reservations = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`, createdAt: new Date(2026, 7, 1, i), partySize: 2, guestName: null, user: guest('کاربر'),
    }));
    const items = buildActivityFeed(reservations, [], [], 3);
    assert.equal(items.length, 3);
    // تازه‌ترین سه‌تا: r4, r3, r2 (ساعت‌های ۴،۳،۲ از میانِ ۰..۴)
    assert.deepEqual(items.map((i) => i.id), ['resv:r4', 'resv:r3', 'resv:r2']);
  });

  test('limit صفر → فیدِ خالی حتی با داده‌ی موجود', () => {
    const items = buildActivityFeed(
      [{ id: 'r1', createdAt: new Date(), partySize: 2, guestName: null, user: guest('امیر') }],
      [], [], 0,
    );
    assert.deepEqual(items, []);
  });
});
