import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { parseSecretsKeyring } from './env';

// ═══════════════════════════════════════════════════════════════════════
//  رازها در حالتِ سکون (S-05، حکمِ D-24 ی CEO، ۲۰۲۶-۰۹-۱۷) — دو درمان، بر اساسِ کلاس
//
//  ۱) رازی که سرور باید **دوباره بخواند** (merchant_idِ زرین‌پال، secretِ HMACِ وب‌هوک):
//     AES-256-GCM با کلیدی که فقط در env است (`SECRETS_KEYRING`، تجزیه در env.ts).
//     قالب:  enc:v1:<keyId>:<iv>:<tag>:<ciphertext>   (base64url)
//     AAD = «enc:v1:<keyId>:<context>» — متنِ رمزِ یک ستون در ستونِ دیگر باز نمی‌شود.
//
//  ۲) توکنِ حاملی که سرور فقط **مقایسه** می‌کند (`staff_invites.token`): هشِ یک‌طرفه،
//     هرگز رمزنگاری. قالب: sha256:<hex> — همان عبارتی که مهاجرتِ ۰۹۴ در SQL می‌سازد.
//
//  قواعدِ fail-closed:
//   • نبودِ کلید = خطا، نه ذخیره/خواندنِ متنِ ساده.
//   • مقدارِ رمزنشده جایی که رمزشده لازم است = خطا (`not_sealed`)، نه «همان را برگردان».
//     وگرنه کسی که فقط به DB دسترسیِ نوشتن دارد merchant_idِ خودش را می‌کارد.
//   • پیامِ هیچ خطایی متنِ ساده یا کلید را نمی‌آورد؛ فقط شناسه‌ی کلید و context.
// ═══════════════════════════════════════════════════════════════════════

const SEALED_PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const TOKEN_HASH_PREFIX = 'sha256:';

export type SecretBoxFailure = 'keyring' | 'not_sealed' | 'malformed' | 'unknown_key' | 'auth_failed';

export class SecretBoxError extends Error {
  readonly reason: SecretBoxFailure;
  constructor(reason: SecretBoxFailure, message: string) {
    super(message);
    this.name = 'SecretBoxError';
    this.reason = reason;
  }
}

type Keyring = { keys: Map<string, Buffer>; activeId: string };
let memo: { raw: string; active: string; ring: Keyring } | null = null;

function keyring(): Keyring {
  const raw = process.env.SECRETS_KEYRING ?? '';
  const active = process.env.SECRETS_ACTIVE_KEY_ID ?? '';
  if (memo && memo.raw === raw && memo.active === active) return memo.ring;
  const parsed = parseSecretsKeyring(raw, active);
  if (parsed.problems.length) {
    throw new SecretBoxError('keyring', 'حلقه‌ی کلیدِ رازها نامعتبر است: ' + parsed.problems.join(' · '));
  }
  const ring: Keyring = {
    keys: new Map(parsed.entries.map((e) => [e.id, Buffer.from(e.keyBase64, 'base64')])),
    activeId: parsed.activeId,
  };
  memo = { raw, active, ring };
  return ring;
}

const aad = (keyId: string, context: string) => Buffer.from(`${SEALED_PREFIX}${keyId}:${context}`, 'utf8');
const b64u = (b: Buffer) => b.toString('base64url');

export function isSealed(value: string): boolean {
  return value.startsWith(SEALED_PREFIX);
}

/** شناسه‌ی کلیدِ یک متنِ رمز، یا null اگر رمزشده نیست. */
export function sealedKeyId(value: string): string | null {
  if (!isSealed(value)) return null;
  const id = value.slice(SEALED_PREFIX.length).split(':', 1)[0];
  return id || null;
}

/** شناسه‌ی کلیدِ فعال — همان که رازِ تازه با آن رمز می‌شود. */
export function activeSecretKeyId(): string {
  return keyring().activeId;
}

/** رمزکردن با کلیدِ فعال. `context` جای ذخیره است (مثلاً «webhooks.secret»). */
export function sealSecret(plaintext: string, context: string): string {
  const ring = keyring();
  const key = ring.keys.get(ring.activeId) as Buffer;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(ring.activeId, context));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${SEALED_PREFIX}${ring.activeId}:${b64u(iv)}:${b64u(cipher.getAuthTag())}:${b64u(ct)}`;
}

/** بازکردن. هر شکستی SecretBoxError است — هرگز متنِ ساده‌ی جایگزین برنمی‌گردد. */
export function openSecret(sealed: string, context: string): string {
  if (!isSealed(sealed)) {
    throw new SecretBoxError('not_sealed', `مقدارِ ${context} رمزشده نیست — خواندنِ متنِ ساده ممنوع است`);
  }
  const parts = sealed.slice(SEALED_PREFIX.length).split(':');
  if (parts.length !== 4) {
    throw new SecretBoxError('malformed', `قالبِ متنِ رمزِ ${context} نامعتبر است`);
  }
  const [keyId, ivText, tagText, ctText] = parts;
  const iv = Buffer.from(ivText, 'base64url');
  const tag = Buffer.from(tagText, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new SecretBoxError('malformed', `قالبِ متنِ رمزِ ${context} نامعتبر است`);
  }
  const key = keyring().keys.get(keyId);
  if (!key) {
    throw new SecretBoxError('unknown_key', `کلیدِ «${keyId}» برای ${context} در SECRETS_KEYRING نیست`);
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aad(keyId, context));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ctText, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new SecretBoxError('auth_failed', `رمزگشاییِ ${context} با کلیدِ «${keyId}» ناموفق بود (دست‌کاری یا context/کلیدِ غلط)`);
  }
}

/** هشِ یک‌طرفه‌ی توکنِ حامل برای ذخیره و جست‌وجو. */
export function hashBearerToken(token: string): string {
  return TOKEN_HASH_PREFIX + createHash('sha256').update(token, 'utf8').digest('hex');
}

/** مقایسه‌ی زمان-ثابتِ توکنِ ارائه‌شده با هشِ ذخیره‌شده. */
export function bearerTokenMatches(presented: string, storedHash: string): boolean {
  const a = Buffer.from(hashBearerToken(presented), 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
