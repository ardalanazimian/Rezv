-- 031: وب‌سایتِ عمومی — جدول‌های CMS و قیفِ فروش (ADR 0002).
--
-- چه چیزی: محتوایِ قابل‌ویرایشِ سایت (صفحه/مقاله/سؤال/پلن/نظر/بنر/تغییرات) +
-- دو جدولِ قیف: site_orders (دموی رایگان و درخواستِ خرید) و site_inquiries
-- (تماس با فروش). مطابقِ schema.prisma — بخشِ «وب‌سایتِ عمومیِ رزرونو».
--
-- چرا: قیمت/متن/سئو باید بدونِ ری‌دیپلوی از استودیو ویرایش شود، و درخواستِ
-- خرید باید یک ردیفِ واقعیِ قابل‌ردیابی باشد که پنلِ شرکت فعالش کند.
--
-- ایمنی: فقط جدول/enum/index جدید — هیچ جدولِ موجودی تغییر نمی‌کند، پس
-- backward-compatible است. RLS مثلِ بقیه‌ی جدول‌ها فعال می‌شود (deny-by-default؛
-- بک‌اند با نقشِ owner دورش می‌زند) چون site_orders/site_inquiries داده‌ی
-- تماسِ سرنخ‌های فروش (PII) دارند و هرگز نباید با anon key خوانده شوند.
--
-- idempotent: همه IF NOT EXISTS / DO-block؛ اجرای دوباره بی‌خطر. بدونِ
-- CREATE INDEX CONCURRENTLY (داخلِ تراکنشِ ضمنیِ prisma db execute می‌شکند).
-- با apply-sql.sh (`prisma db execute`) اعمال می‌شود.

-- ── enumها (CREATE TYPE پشتیبانِ IF NOT EXISTS نیست → DO block) ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'site_status') THEN
    CREATE TYPE site_status AS ENUM ('draft', 'published');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'site_order_kind') THEN
    CREATE TYPE site_order_kind AS ENUM ('trial', 'purchase');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'site_order_status') THEN
    CREATE TYPE site_order_status AS ENUM ('pending', 'contacted', 'activated', 'rejected', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'site_inquiry_status') THEN
    CREATE TYPE site_inquiry_status AS ENUM ('open', 'in_progress', 'closed');
  END IF;
END $$;

-- ── محتوا ──

CREATE TABLE IF NOT EXISTS site_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        NOT NULL UNIQUE,
  title           text        NOT NULL,
  description     text,
  sections        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  seo_title       text,
  seo_description text,
  seo_keywords    text[]      NOT NULL DEFAULT '{}',
  og_image        text,
  noindex         boolean     NOT NULL DEFAULT false,
  structured_data jsonb,
  status          site_status NOT NULL DEFAULT 'draft',
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid
);
CREATE INDEX IF NOT EXISTS site_pages_status_slug_idx ON site_pages (status, slug);

CREATE TABLE IF NOT EXISTS site_articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        NOT NULL UNIQUE,
  title           text        NOT NULL,
  excerpt         text        NOT NULL,
  body            text        NOT NULL,
  cover_url       text,
  cover_alt       text,
  tags            text[]      NOT NULL DEFAULT '{}',
  author_name     text        NOT NULL DEFAULT 'تیم رزرونو',
  author_role     text,
  reading_minutes smallint    NOT NULL DEFAULT 5,
  seo_title       text,
  seo_description text,
  seo_keywords    text[]      NOT NULL DEFAULT '{}',
  og_image        text,
  noindex         boolean     NOT NULL DEFAULT false,
  status          site_status NOT NULL DEFAULT 'draft',
  featured        boolean     NOT NULL DEFAULT false,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid
);
CREATE INDEX IF NOT EXISTS site_articles_status_published_at_idx ON site_articles (status, published_at DESC);

CREATE TABLE IF NOT EXISTS site_faqs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL,
  answer     text        NOT NULL,
  scope      text        NOT NULL DEFAULT 'general',
  sort_order integer     NOT NULL DEFAULT 0,
  status     site_status NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE INDEX IF NOT EXISTS site_faqs_status_scope_sort_order_idx ON site_faqs (status, scope, sort_order);

CREATE TABLE IF NOT EXISTS site_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key              text              NOT NULL UNIQUE,
  name             text              NOT NULL,
  tagline          text,
  months           smallint          NOT NULL,
  price_toman      integer           NOT NULL,
  compare_at_toman integer,
  badge            text,
  features         text[]            NOT NULL DEFAULT '{}',
  highlight        boolean           NOT NULL DEFAULT false,
  tenant_plan      subscription_plan NOT NULL DEFAULT 'pro',
  sort_order       integer           NOT NULL DEFAULT 0,
  status           site_status       NOT NULL DEFAULT 'published',
  created_at       timestamptz       NOT NULL DEFAULT now(),
  updated_at       timestamptz       NOT NULL DEFAULT now(),
  updated_by       uuid
);
CREATE INDEX IF NOT EXISTS site_plans_status_sort_order_idx ON site_plans (status, sort_order);

CREATE TABLE IF NOT EXISTS site_testimonials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote      text        NOT NULL,
  author     text        NOT NULL,
  role       text,
  company    text,
  avatar_url text,
  rating     smallint    NOT NULL DEFAULT 5,
  sort_order integer     NOT NULL DEFAULT 0,
  status     site_status NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE INDEX IF NOT EXISTS site_testimonials_status_sort_order_idx ON site_testimonials (status, sort_order);

CREATE TABLE IF NOT EXISTS site_banners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message    text        NOT NULL,
  cta_label  text,
  cta_href   text,
  tone       text        NOT NULL DEFAULT 'brand',
  starts_at  timestamptz,
  ends_at    timestamptz,
  sort_order integer     NOT NULL DEFAULT 0,
  status     site_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE INDEX IF NOT EXISTS site_banners_status_sort_order_idx ON site_banners (status, sort_order);

CREATE TABLE IF NOT EXISTS site_release_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version     text        NOT NULL,
  title       text        NOT NULL,
  body        text        NOT NULL,
  tags        text[]      NOT NULL DEFAULT '{}',
  released_at timestamptz NOT NULL,
  status      site_status NOT NULL DEFAULT 'published',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);
CREATE INDEX IF NOT EXISTS site_release_notes_status_released_at_idx ON site_release_notes (status, released_at DESC);

-- ── قیفِ فروش ──

-- بدونِ FK به site_plans: پلن ممکن است بعداً حذف/بازنویسی شود ولی اسنپ‌شاتِ
-- قیمت/مدت روی سفارش باید تغییرناپذیر بماند (سندِ مالی).
CREATE TABLE IF NOT EXISTS site_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text              NOT NULL UNIQUE,
  kind            site_order_kind   NOT NULL,
  status          site_order_status NOT NULL DEFAULT 'pending',
  plan_key        text,
  plan_name       text,
  months          smallint,
  amount_toman    integer,
  business_name   text              NOT NULL,
  contact_name    text              NOT NULL,
  phone           text              NOT NULL,
  email           text,
  city            text,
  branch_count    smallint,
  note            text,
  tenant_id       uuid,
  restaurant_id   uuid,
  staff_id        uuid,
  trial_ends_at   timestamptz,
  activated_at    timestamptz,
  activated_by    uuid,
  plan_expires_at timestamptz,
  admin_note      text,
  rejected_reason text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  landing_path    text,
  referrer        text,
  ip              text,
  user_agent      text,
  created_at      timestamptz       NOT NULL DEFAULT now(),
  updated_at      timestamptz       NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_orders_status_created_at_idx ON site_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS site_orders_kind_status_idx    ON site_orders (kind, status);
CREATE INDEX IF NOT EXISTS site_orders_phone_idx          ON site_orders (phone);
CREATE INDEX IF NOT EXISTS site_orders_tenant_id_idx         ON site_orders (tenant_id);

CREATE TABLE IF NOT EXISTS site_inquiries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text                NOT NULL UNIQUE,
  name         text                NOT NULL,
  phone        text                NOT NULL,
  email        text,
  company      text,
  topic        text                NOT NULL DEFAULT 'sales',
  message      text                NOT NULL,
  status       site_inquiry_status NOT NULL DEFAULT 'open',
  admin_note   text,
  handled_by   uuid,
  handled_at   timestamptz,
  utm_source   text,
  landing_path text,
  ip           text,
  user_agent   text,
  created_at   timestamptz         NOT NULL DEFAULT now(),
  updated_at   timestamptz         NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_inquiries_status_created_at_idx ON site_inquiries (status, created_at DESC);

-- ── RLS (deny-by-default؛ هم‌راستا با migration 023) ──
-- محتوا هم RLS می‌گیرد: انتشار از استودیو و خواندنِ عمومی هر دو از بک‌اند
-- (نقشِ owner) انجام می‌شوند، نه مستقیم از anon key.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'site_pages', 'site_articles', 'site_faqs', 'site_plans', 'site_testimonials',
    'site_banners', 'site_release_notes', 'site_orders', 'site_inquiries'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
