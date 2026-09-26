import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { pushTransportReady, vapidPublicKey } = await import('../src/lib/push-transport.ts');

describe('Web Push transport gate', () => {
  const prev = {
    pub: process.env.VAPID_PUBLIC_KEY,
    priv: process.env.VAPID_PRIVATE_KEY,
    sub: process.env.VAPID_SUBJECT,
  };
  beforeEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });
  afterEach(() => {
    if (prev.pub === undefined) delete process.env.VAPID_PUBLIC_KEY; else process.env.VAPID_PUBLIC_KEY = prev.pub;
    if (prev.priv === undefined) delete process.env.VAPID_PRIVATE_KEY; else process.env.VAPID_PRIVATE_KEY = prev.priv;
    if (prev.sub === undefined) delete process.env.VAPID_SUBJECT; else process.env.VAPID_SUBJECT = prev.sub;
  });

  test('بدون کلید — ready نیست و کلید عمومی null است', () => {
    assert.equal(pushTransportReady(), false);
    assert.equal(vapidPublicKey(), null);
  });

  test('فقط public — هنوز ready نیست', () => {
    process.env.VAPID_PUBLIC_KEY = 'Bxxxx';
    assert.equal(pushTransportReady(), false);
  });

  test('هر سه کلید — ready است', () => {
    process.env.VAPID_PUBLIC_KEY = 'Bxxxx';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:ops@rezervno.ir';
    assert.equal(pushTransportReady(), true);
    assert.equal(vapidPublicKey(), 'Bxxxx');
  });
});
