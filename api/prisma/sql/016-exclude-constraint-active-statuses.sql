-- 016: رفع باگ C1 — کانسترینت EXCLUDE و ایندکس عملکرد باید کل مجموعه‌ی
-- وضعیت‌های فعالِ اشغال‌کننده‌ی میز را پوشش دهند (نه فقط چهار وضعیت قبلی).
--
-- قبلاً فقط ('pending','confirmed','arrived','seated') پوشش داده می‌شد؛ وضعیت‌های
-- فعالِ auto_confirmed/preparing/checked_in/running_late/dining در آن نبودند، پس
-- یک میز می‌توانست در آن وضعیت‌ها دوباره رزرو شود (double-booking).
--
-- این مجموعه باید همیشه با ACTIVE_RESERVATION_STATUSES در
-- src/lib/reservation-status.ts یکی بماند. روی دیتابیس زنده اعمال شده
-- (apply_migration: fix_exclude_constraint_active_statuses) و با تست هم‌پوشانی
-- در وضعیت dining تأیید شده است.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS block_buffer_minutes SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='reservations' AND column_name='block_end'
  ) THEN
    ALTER TABLE reservations
      ADD COLUMN block_end TIMESTAMP
      GENERATED ALWAYS AS (slot_end + make_interval(mins => block_buffer_minutes)) STORED;
  END IF;
END $$;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS no_table_overlap;
ALTER TABLE reservations ADD CONSTRAINT no_table_overlap
  EXCLUDE USING gist (
    table_id WITH =,
    tsrange(slot_start, block_end) WITH &&
  )
  WHERE (
    status IN ('pending','confirmed','auto_confirmed','preparing','checked_in','running_late','arrived','seated','dining')
    AND table_id IS NOT NULL
  );

DROP INDEX IF EXISTS idx_resv_table_active_range;
CREATE INDEX idx_resv_table_active_range
  ON reservations USING gist (table_id, tsrange(slot_start, block_end))
  WHERE status IN ('pending','confirmed','auto_confirmed','preparing','checked_in','running_late','arrived','seated','dining');
