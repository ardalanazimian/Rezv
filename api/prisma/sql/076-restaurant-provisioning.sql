-- ═══════════════════════════════════════════════════════════════════════
-- ۰۷۶ — SPEC-B: provisioningِ رستوران از پنلِ شرکت + دعوتِ owner
--
-- می‌سازد:
--   • enum restaurant_provision_status و staff_invite_status
--   • restaurants.provision_status  (DEFAULT 'ACTIVE' — تصمیمِ C11: ردیف‌های
--     موجود نباید یک‌شبه «در انتظارِ فعال‌سازی» شوند؛ مسیرِ provision خودش
--     صریح PENDING_ACTIVATION می‌نویسد و اولین ورودِ موفق ACTIVE می‌کند)
--   • tenants.branch_limit          (سهمیه سطحِ تنانت است — C4)
--   • جدولِ staff_invites (نامِ جمع طبق قراردادِ repo — C13) + FK + ایندکس
--
-- ⚠️ ON UPDATE CASCADE در هر سه FK عمدی است: پیش‌فرضِ emitِ Prisma همین است
-- و بدونش گاردِ drift (درسِ ۰۶۵) قرمز می‌شود — «هر دو مسیر یک اسکیما».
-- idempotent: هر بخش یا IF NOT EXISTS دارد یا DO $$ … duplicate_* THEN NULL.
-- «هر دو جا»: همه‌ی این‌ها عیناً در schema.prisma هم اعلام شده‌اند (گاردِ
-- schema-drift.integration.test.mts).
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE restaurant_provision_status AS ENUM
    ('PENDING_ACTIVATION','ACTIVE','SUSPENDED','OFFBOARDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_invite_status AS ENUM
    ('PENDING','ACCEPTED','EXPIRED','REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE restaurants ADD COLUMN provision_status restaurant_provision_status
    NOT NULL DEFAULT 'ACTIVE';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE tenants ADD COLUMN branch_limit int NOT NULL DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS staff_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  staff_id      uuid NOT NULL,
  phone         text NOT NULL,
  token         text NOT NULL,
  status        staff_invite_status NOT NULL DEFAULT 'PENDING',
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- نامِ ایندکسِ یکتا عمداً همانی است که Prisma برای @unique تولید می‌کند،
-- وگرنه db push (مسیرِ CI) یک ایندکسِ دومِ هم‌معنا می‌سازد (درسِ ۰۷۴).
CREATE UNIQUE INDEX IF NOT EXISTS staff_invites_token_key ON staff_invites (token);

DO $$ BEGIN
  ALTER TABLE staff_invites ADD CONSTRAINT staff_invites_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE staff_invites ADD CONSTRAINT staff_invites_restaurant_id_fkey
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE staff_invites ADD CONSTRAINT staff_invites_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS staff_invites_tenant_id_idx ON staff_invites (tenant_id);
CREATE INDEX IF NOT EXISTS staff_invites_phone_idx     ON staff_invites (phone);
