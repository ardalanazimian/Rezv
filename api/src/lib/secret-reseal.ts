import { db } from './db';
import { invalidatePattern } from './cache';
import { createLogger } from './logger';
import { activeSecretKeyId, isSealed, openSecret, sealSecret, sealedKeyId } from './secret-box';
import { SEALED_SETTING_KEYS, settingSealContext } from './platform-settings';
import { WEBHOOK_SECRET_CONTEXT } from './events';

const log = createLogger('secret-reseal');

// ═══════════════════════════════════════════════════════════════════════
//  بازرمزنگاریِ رازهای ذخیره‌شده (S-05، حکمِ D-24) — هم مهاجرتِ داده، هم چرخشِ کلید
//
//  یک گذر روی هر ستونی که secret-box رمز می‌کند:
//   • رمزشده با کلیدِ فعال → دست‌نخورده (پس اجرای دوم no-op است)
//   • رمزشده با کلیدِ دیگر → باز و با کلیدِ فعال دوباره رمز (چرخش)
//   • متنِ ساده → فقط با `sealPlaintext` رمز می‌شود؛ وگرنه شمرده و رها می‌شود
//
//  چرا رمزکردنِ متنِ ساده خودکار/زمان‌بندی‌شده نیست: خواننده‌ها متنِ ساده را رد
//  می‌کنند تا کسی که فقط DB را می‌نویسد نتواند merchant_idِ خودش را بکارد. اگر یک
//  cron هر ساعت متنِ ساده را رمز می‌کرد، همان کاشت یک ساعت بعد معتبر می‌شد. پس
//  این شاخه یک اقدامِ صریحِ اپراتور است (یک‌بار پس از دیپلویِ ۰۹۴، یا پس از درجِ دستیِ وب‌هوک).
//
//  هر به‌روزرسانی شرطی است (WHERE مقدار = همانی که خواندیم): نوشتنِ همزمانِ پنل
//  بازنویسی نمی‌شود، و دو اجرای همزمان هیچ مقداری را دوبار رمز نمی‌کنند.
//  گزارش فقط شمارش و شناسه دارد — هیچ مقداری، نه ساده نه رمز.
// ═══════════════════════════════════════════════════════════════════════

export type ResealFailure = { target: string; id: string; reason: string };

export type ResealReport = {
  active_key_id: string;
  sealed_plaintext: number;
  rekeyed: number;
  unchanged: number;
  plaintext_skipped: number;
  raced: number;
  failed: ResealFailure[];
};

type Candidate = {
  target: string;
  id: string;
  context: string;
  value: string;
  write: (next: string) => Promise<number>;
};

export async function resealSecrets(opts: { sealPlaintext: boolean }): Promise<ResealReport> {
  const active = activeSecretKeyId();
  const report: ResealReport = {
    active_key_id: active, sealed_plaintext: 0, rekeyed: 0, unchanged: 0, plaintext_skipped: 0, raced: 0, failed: [],
  };

  const settings = await db.platformSettings.findMany({
    where: { key: { in: [...SEALED_SETTING_KEYS] } },
    select: { key: true, value: true },
  });
  const hooks = await db.webhook.findMany({
    where: { secret: { not: null } },
    select: { id: true, secret: true },
  });

  const candidates: Candidate[] = [
    ...settings.map((s): Candidate => ({
      target: 'platform_settings', id: s.key, context: settingSealContext(s.key), value: s.value,
      write: async (next) => {
        const r = await db.platformSettings.updateMany({ where: { key: s.key, value: s.value }, data: { value: next } });
        await invalidatePattern(`platform-settings:${s.key}`);
        return r.count;
      },
    })),
    ...hooks.map((h): Candidate => ({
      target: 'webhooks', id: h.id, context: WEBHOOK_SECRET_CONTEXT, value: h.secret as string,
      write: async (next) =>
        (await db.webhook.updateMany({ where: { id: h.id, secret: h.secret }, data: { secret: next } })).count,
    })),
  ];

  for (const c of candidates) {
    let next: string;
    let kind: 'sealed_plaintext' | 'rekeyed';
    if (!isSealed(c.value)) {
      if (!opts.sealPlaintext) { report.plaintext_skipped++; continue; }
      next = sealSecret(c.value, c.context);
      kind = 'sealed_plaintext';
    } else {
      let plaintext: string;
      try {
        plaintext = openSecret(c.value, c.context);
      } catch (e) {
        report.failed.push({ target: c.target, id: c.id, reason: (e as { reason?: string }).reason ?? 'error' });
        continue;
      }
      if (sealedKeyId(c.value) === active) { report.unchanged++; continue; }
      next = sealSecret(plaintext, c.context);
      kind = 'rekeyed';
    }
    if ((await c.write(next)) === 1) report[kind]++;
    else report.raced++;
  }

  log.info('بازرمزنگاریِ رازها', { ...report, failed: report.failed.length });
  return report;
}
