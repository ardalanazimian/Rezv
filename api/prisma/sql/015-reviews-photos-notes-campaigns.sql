-- 015: نظرات، گالری عکس، یادداشت پرسنل، لاگ کمپین
-- این چهار جدول قبلاً در پنل رستوران فقط به‌صورت آرایه‌ی محلی JS بودند (با رفرش پاک می‌شدند).
-- رویدادها (special_events) از قبل وجود داشت. روی دیتابیس زنده‌ی Supabase اعمال شده.

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  food_rating smallint CHECK (food_rating BETWEEN 1 AND 5),
  service_rating smallint CHECK (service_rating BETWEEN 1 AND 5),
  atmosphere_rating smallint CHECK (atmosphere_rating BETWEEN 1 AND 5),
  body text, reply text, replied_at timestamptz,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_restaurant_idx ON reviews(restaurant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_reservation ON reviews(reservation_id) WHERE reservation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS restaurant_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  url text NOT NULL, caption text,
  category text NOT NULL DEFAULT 'food',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restaurant_photos_idx ON restaurant_photos(restaurant_id, sort_order);

CREATE TABLE IF NOT EXISTS staff_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  author_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  author_name text, body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_notes_idx ON staff_notes(restaurant_id, pinned DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS campaign_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  segment text NOT NULL, message text NOT NULL,
  recipients_count int NOT NULL DEFAULT 0,
  sent_by_staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_logs_idx ON campaign_logs(restaurant_id, created_at DESC);
