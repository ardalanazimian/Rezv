import { randomBytes } from 'crypto';
import { db } from './db';
import { TableShape, TableZone } from '@prisma/client';
import { Err } from './errors';
import { audit } from './audit';
import { enqueueSms } from './sms';
import { normalizePhone } from './otp';
import { hashPassword, normalizeUsername, passwordPolicyError, usernamePolicyError } from './password';
import { clubPrefixFrom, slugSeed, uniqueRestaurantSlug } from './site-orders';
import { createLogger } from './logger';

const log = createLogger('provisioning');

// ═══════════════════════════════════════════════════════════════════════
//  SPEC-B — provisioningِ کسب‌وکار از پنلِ شرکت (منطقِ §۶، ترتیبِ اجباری)
//
//  چرا lib جدا و نه داخلِ route: سه مصرف‌کننده دارد (create / resend-invite /
//  branches) و قاعده‌ی §۶ برنامه «یک پیاده‌سازی» است. بلوک‌های سازنده عمداً
//  از مسیرِ trial (lib/site-orders.ts) reuse شده‌اند: slugSeed /
//  uniqueRestaurantSlug / clubPrefixFrom — نسخه‌ی دوم ساخته نشده.
//
//  ترتیبِ حیاتی (§۶ spec): پیامکِ دعوت **بیرونِ** تراکنش enqueue می‌شود —
//  rollback نباید پیامکِ یتیم بفرستد — و با idempotencyKey=invite.id محافظت
//  می‌شود تا retry هم دوباره نفرستد.
// ═══════════════════════════════════════════════════════════════════════

const INVITE_TTL_MS = 72 * 3600_000;      // §۶-۱۲: انقضای دعوت ۷۲ ساعت
const SLUG_RE = /^[a-z0-9-]{3,40}$/;      // §۵-۲

/** چیدمانِ میزهای شروع — عیناً الگویِ مسیرِ trial؛ پنلِ خالی عملاً مرده است. */
function starterTables(count: number) {
  const CAPS = [2, 2, 2, 4, 4, 4, 6, 8];
  return Array.from({ length: count }, (_, i) => {
    const capacity = CAPS[i % CAPS.length];
    return {
      number: i + 1,
      capacity,
      zone: i % 8 < 3 ? TableZone.window : i % 8 < 6 ? TableZone.indoor : i % 8 === 6 ? TableZone.vip : TableZone.outdoor,
      shape: capacity >= 6 ? TableShape.booth : i % 3 === 0 ? TableShape.round : TableShape.rectangle,
    };
  });
}

function maskPhone(p: string): string {
  const local = p.startsWith('+98') ? '0' + p.slice(3) : p;
  return local.length >= 7 ? `${local.slice(0, 4)}***${local.slice(-4)}` : '***';
}

function inviteUrl(token: string): string {
  const base = (process.env.INVITE_BASE_URL || 'https://rezervno.ir').replace(/\/$/, '');
  // توکن در fragment (نه query و نه /invite/{token}) — دو دلیلِ اثبات‌شده:
  //   ۱) صفحه‌ی دعوت فایلِ استاتیکِ پنلِ بیزنس است و هاست‌های استاتیکِ
  //      cleanUrls-دار (مثلِ `npx serve` که E2E هم با همان سرو می‌کند)
  //      /invite.html?token=x را 301 به /invite می‌کنند و **query را می‌اندازند**
  //      (با probe واقعاً دیده شد) — ولی fragment طبقِ استاندارد از redirect
  //      جان به در می‌برد.
  //   ۲) fragment هرگز به سرور نمی‌رسد، پس توکنِ دعوت واردِ access-log/proxy
  //      نمی‌شود (بهداشتِ لاگ برای magic-link).
  return `${base}/invite.html#token=${token}`;
}

export type ProvisionInput = {
  businessName: string;
  city?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  trialDays?: number;
  slug?: string;
  ownerPhone: string;
  ownerName?: string;
  username?: string;
  password?: string;
  seedTables?: number;
};

export type ProvisionResult = {
  tenantId: string;
  restaurant: { id: string; slug: string; name: string };
  owner: { staffId: string; phone: string; username: string | null };
  provisionStatus: 'PENDING_ACTIVATION';
  trialEndsAt: Date | null;
  inviteSentTo: string;
  inviteId: string;
};

/**
 * ساختِ اتمیکِ Tenant→Restaurant→ownerِ Staff→StaffInvite + audit، سپس
 * enqueueِ پیامکِ دعوت (بیرونِ تراکنش، idempotent).
 *
 * ⚠️ C7ِ برنامه: ردیفِ StaffPermission عمداً ساخته **نمی‌شود** — کد برای
 * role=owner همیشه دسترسیِ کامل می‌دهد و ردیف را نمی‌خواند
 * (lib/permissions.ts:56,74)؛ ساختنش دیتای مرده بود.
 */
export async function provisionBusiness(
  input: ProvisionInput,
  actor: { adminId: string; ip: string },
): Promise<ProvisionResult> {
  const phone = normalizePhone(input.ownerPhone);

  // ── §۶-۵: dup — C8ِ برنامه: attachExistingOwner پشتیبانی نمی‌شود؛ به‌خاطرِ
  // قاعده‌ی «قدیمی‌ترین ثبتِ شماره برنده است» (مهاجرتِ ۰۷۲)، ownerِ دوم با
  // همان شماره در تنانتِ دیگر هرگز نمی‌توانست با OTP وارد شود. مسیرِ درستِ
  // «شعبه‌ی دوم» endpoint جداگانه‌ی branches است.
  const existing = await db.staff.findFirst({ where: { phone }, select: { id: true } });
  if (existing) {
    throw Err.conflict(
      'duplicate_owner_phone',
      'این شماره از قبل حسابِ کسب‌وکار دارد. برای شعبه‌ی جدیدِ همان مالک از «افزودنِ شعبه» استفاده کنید.',
    );
  }

  // ── اعتبارنامه‌ی اختیاری — کاملِ کامل یا هیچ (همان قراردادِ staff-credentials) ──
  let credentials: { username: string; passwordHash: string; passwordUpdatedAt: Date } | null = null;
  if (input.username || input.password) {
    if (!input.username || !input.password) {
      throw Err.validation('برای ورود با رمز، هر دو فیلدِ username و password لازم است');
    }
    const uErr = usernamePolicyError(input.username);
    if (uErr) throw Err.validation(uErr);
    const pErr = passwordPolicyError(input.password);
    if (pErr) throw Err.validation(pErr);
    const username = normalizeUsername(input.username);
    const taken = await db.staff.findUnique({ where: { username }, select: { id: true } });
    if (taken) throw Err.conflict('username_taken', `نام کاربری «${username}» قبلاً گرفته شده است`);
    credentials = { username, passwordHash: await hashPassword(input.password), passwordUpdatedAt: new Date() };
  }

  // ── §۶-۶: slug — ورودیِ صریح یا تولیدِ خودکار ──
  let slug: string;
  if (input.slug) {
    if (!SLUG_RE.test(input.slug)) throw Err.validation('slug فقط حروفِ کوچکِ لاتین/رقم/خطِ تیره، ۳ تا ۴۰ کاراکتر');
    const slugTaken = await db.restaurant.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (slugTaken) throw Err.conflict('slug_unavailable', `slug «${input.slug}» قبلاً گرفته شده است`);
    slug = input.slug;
  } else {
    slug = await uniqueRestaurantSlug(slugSeed(input.businessName, phone.slice(-6)));
  }

  const trialEndsAt = input.trialDays && input.trialDays > 0
    ? new Date(Date.now() + input.trialDays * 86_400_000)
    : null;
  const token = randomBytes(32).toString('hex');

  // ── §۶-۷..۱۳: تراکنش — یا همه یا هیچ ──
  const created = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.businessName, plan: input.plan ?? 'free', trialEndsAt },
      select: { id: true, plan: true },
    });
    const restaurant = await tx.restaurant.create({
      data: {
        tenantId: tenant.id,
        slug,
        name: input.businessName,
        city: input.city || null,
        clubPrefix: clubPrefixFrom(input.businessName),
        provisionStatus: 'PENDING_ACTIVATION',
        smsBalance: 50,
        tables: { create: starterTables(input.seedTables ?? 8) },
      },
      select: { id: true, slug: true, name: true },
    });
    const staff = await tx.staff.create({
      data: {
        tenantId: tenant.id, phone, name: input.ownerName || input.businessName,
        role: 'owner', isActive: true,
        // restaurantId عمداً null: دسترسیِ همه‌شعبه‌ای (§۶-۹؛ سمنتیکِ Staff.restaurantId)
        ...(credentials ?? {}),
      },
      select: { id: true, username: true },
    });
    const invite = await tx.staffInvite.create({
      data: {
        tenantId: tenant.id, restaurantId: restaurant.id, staffId: staff.id,
        phone, token, expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: { id: true },
    });
    return { tenant, restaurant, staff, invite };
  });

  await audit({
    action: 'restaurant.provision', actorId: actor.adminId, actorType: 'admin',
    targetId: created.restaurant.id, restaurantId: created.restaurant.id, ip: actor.ip,
    detail: {
      business_name: input.businessName, plan: created.tenant.plan,
      slug: created.restaurant.slug, owner_phone_suffix: phone.slice(-4),
      with_credentials: !!credentials, trial_days: input.trialDays ?? 0,
    },
  });

  // ── §۶-۱۴: پیامکِ دعوت — بیرونِ تراکنش + idempotent روی invite.id ──
  await sendInviteSms({
    phone, ownerName: input.ownerName || input.businessName,
    restaurantName: created.restaurant.name, token, inviteId: created.invite.id,
  });

  return {
    tenantId: created.tenant.id,
    restaurant: created.restaurant,
    owner: { staffId: created.staff.id, phone, username: created.staff.username },
    provisionStatus: 'PENDING_ACTIVATION',
    trialEndsAt,
    inviteSentTo: maskPhone(phone),
    inviteId: created.invite.id,
  };
}

async function sendInviteSms(p: { phone: string; ownerName: string; restaurantName: string; token: string; inviteId: string }) {
  await enqueueSms({
    to: p.phone,
    template: 'staff_invite',
    tokens: [p.ownerName, p.restaurantName, inviteUrl(p.token)],
    idempotencyKey: `staff-invite:${p.inviteId}`,
  });
}

/**
 * هوکِ اولین ورودِ موفق (§۶-۱ spec): دعوت‌های PENDINGِ این شماره ACCEPTED و
 * رستورانِ PENDING_ACTIVATION → ACTIVE.
 *
 * ⚠️ C10ِ برنامه: side-effect است، هرگز throw نمی‌کند و **شکلِ پاسخِ**
 * verify/login را لمس نمی‌کند (آن پاسخ‌ها باید بایت‌به‌بایت ثابت بمانند).
 * از هر دو مسیرِ ورود (OTP و رمز) صدا زده می‌شود.
 */
export async function acceptPendingInvites(rawPhone: string): Promise<void> {
  try {
    const phone = normalizePhone(rawPhone);
    const invites = await db.staffInvite.findMany({
      where: { phone, status: 'PENDING', expiresAt: { gt: new Date() } },
      select: { id: true, restaurantId: true, staffId: true },
    });
    if (!invites.length) return;
    await db.$transaction(async (tx) => {
      await tx.staffInvite.updateMany({
        where: { id: { in: invites.map((i) => i.id) } },
        data: { status: 'ACCEPTED' },
      });
      await tx.restaurant.updateMany({
        where: { id: { in: invites.map((i) => i.restaurantId) }, provisionStatus: 'PENDING_ACTIVATION' },
        data: { provisionStatus: 'ACTIVE' },
      });
    });
    for (const i of invites) {
      await audit({
        action: 'staff.invite_accepted', actorId: i.staffId, actorType: 'staff',
        targetId: i.id, restaurantId: i.restaurantId, ip: 'n/a',
        detail: { via: 'first_login' },
      });
    }
  } catch (e) {
    // ورود نباید به‌خاطرِ حسابداریِ دعوت بشکند — ولی سکوتِ کامل هم ممنوع.
    log.error('پذیرشِ دعوت پس از ورود ناموفق ماند', { error: (e as Error).message });
  }
}

/** ارسالِ مجددِ دعوت (§۸): توکن و انقضای نو؛ PENDINGهای قبلی REVOKED. */
export async function resendInvite(
  restaurantId: string,
  actor: { adminId: string; ip: string },
): Promise<{ inviteSentTo: string; expiresAt: Date }> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, tenantId: true, provisionStatus: true },
  });
  if (!restaurant) throw Err.notFound('رستوران');

  const owner = await db.staff.findFirst({
    where: { tenantId: restaurant.tenantId, role: 'owner', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, phone: true, name: true },
  });
  if (!owner) throw Err.notFound('مالکِ فعال برای این رستوران');

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invite = await db.$transaction(async (tx) => {
    await tx.staffInvite.updateMany({
      where: { restaurantId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
    return tx.staffInvite.create({
      data: {
        tenantId: restaurant.tenantId, restaurantId, staffId: owner.id,
        phone: owner.phone, token, expiresAt,
      },
      select: { id: true },
    });
  });

  await audit({
    action: 'restaurant.invite_resent', actorId: actor.adminId, actorType: 'admin',
    targetId: invite.id, restaurantId, ip: actor.ip,
    detail: { phone_suffix: owner.phone.slice(-4) },
  });

  await sendInviteSms({
    phone: owner.phone, ownerName: owner.name || restaurant.name,
    restaurantName: restaurant.name, token, inviteId: invite.id,
  });

  return { inviteSentTo: maskPhone(owner.phone), expiresAt };
}

/**
 * شعبه‌ی جدید زیرِ **همان** tenant (§۸): staffِ جدید ساخته نمی‌شود —
 * ownerِ موجود با restaurantId=null همه‌ی شعبه‌ها را می‌بیند.
 * شعبه ACTIVE متولد می‌شود (مالک قبلاً فعال است؛ دعوتِ تازه بی‌معناست).
 */
export async function createBranch(
  sourceRestaurantId: string,
  input: { branchName: string; city?: string; slug?: string; seedTables?: number },
  actor: { adminId: string; ip: string },
): Promise<{ restaurant: { id: string; slug: string; name: string }; tenantId: string }> {
  const source = await db.restaurant.findUnique({
    where: { id: sourceRestaurantId },
    select: { tenantId: true, tenant: { select: { branchLimit: true } } },
  });
  if (!source) throw Err.notFound('رستوران');

  const count = await db.restaurant.count({ where: { tenantId: source.tenantId } });
  if (count >= source.tenant.branchLimit) {
    throw Err.conflict(
      'branch_limit_reached',
      `سقفِ شعبه‌های این تنانت (${source.tenant.branchLimit}) پر است؛ برای افزایش، پلن را ارتقا دهید.`,
    );
  }

  let slug: string;
  if (input.slug) {
    if (!SLUG_RE.test(input.slug)) throw Err.validation('slug فقط حروفِ کوچکِ لاتین/رقم/خطِ تیره، ۳ تا ۴۰ کاراکتر');
    const taken = await db.restaurant.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (taken) throw Err.conflict('slug_unavailable', `slug «${input.slug}» قبلاً گرفته شده است`);
    slug = input.slug;
  } else {
    slug = await uniqueRestaurantSlug(slugSeed(input.branchName, sourceRestaurantId.slice(0, 6)));
  }

  const restaurant = await db.restaurant.create({
    data: {
      tenantId: source.tenantId,
      slug,
      name: input.branchName,
      city: input.city || null,
      clubPrefix: clubPrefixFrom(input.branchName),
      provisionStatus: 'ACTIVE',
      smsBalance: 50,
      tables: { create: starterTables(input.seedTables ?? 8) },
    },
    select: { id: true, slug: true, name: true },
  });

  await audit({
    action: 'restaurant.branch_created', actorId: actor.adminId, actorType: 'admin',
    targetId: restaurant.id, restaurantId: restaurant.id, ip: actor.ip,
    detail: { tenant_id: source.tenantId, branch_name: input.branchName, slug },
  });

  return { restaurant, tenantId: source.tenantId };
}
