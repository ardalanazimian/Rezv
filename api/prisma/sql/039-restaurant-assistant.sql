-- ═══════════════════════════════════════════════════════════════════════
--  ۰۳۹ — دستیارِ هوشمندِ رستوران (Offline Restaurant Assistant)
--
--  چت‌بات پرسش‌وپاسخِ آزادمتنِ فارسی برای پنلِ بیزنس — کاملاً آفلاین، بدونِ
--  هیچ فراخوانیِ AI/LLM بیرونی. طبقه‌بندِ نیت (lib/assistant-nlu.ts) یک
--  Naive Bayesِ دستی‌ست که با چند جمله‌ی seed شروع می‌شود و از تعاملِ واقعیِ
--  کارمندها خودآموزی می‌کند (lib/assistant.ts). این دو جدول همان حافظه‌ی
--  خودآموزی/شفافیت هستند:
--
--   • restaurant_assistant_vocab: شمارشِ کلمه→نیتِ یادگرفته‌شده‌ی هر رستوران.
--     هر بار که کارمند جوابِ اشتباه را اصلاح می‌کند (یا جوابِ کم‌اطمینان را
--     تأیید می‌کند)، شمارشِ کلماتِ همان سؤال برایِ نیتِ درست زیاد می‌شود —
--     دقیقاً یادگیریِ آنلاین، بدونِ نیازِ به آموزشِ دسته‌ای شبانه.
--   • restaurant_assistant_logs: هر سؤالِ پرسیده‌شده + نیتِ تشخیص‌داده‌شده +
--     اطمینان + آیا اصلاح شد — هم برایِ شفافیت (همون فلسفه‌ی
--     restaurant_no_show_models: «چقدر دقیقه، از کجا معلومه»)، هم منبعِ
--     دیتایِ یادگیری.
--
--  idempotent: CREATE TABLE/INDEX با IF NOT EXISTS محافظت شده‌اند.
--  RLS: طبقِ درسِ migration 037، از همون اول ENABLE می‌شود (بدونِ policy —
--  کنترلِ دسترسیِ واقعی در کدِ اپلیکیشن است، هم‌راستا با بقیه‌ی جدول‌ها).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS restaurant_assistant_vocab (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  intent        text NOT NULL,
  word          text NOT NULL,
  count         integer NOT NULL DEFAULT 1,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, intent, word)
);
CREATE INDEX IF NOT EXISTS restaurant_assistant_vocab_restaurant_idx
  ON restaurant_assistant_vocab (restaurant_id);

CREATE TABLE IF NOT EXISTS restaurant_assistant_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id         uuid, -- بدونِ FKِ سخت‌گیر، مثلِ staff_notes.author_staff_id — کارمند ممکنه بعداً حذف/غیرفعال بشه
  question         text NOT NULL,
  detected_intent  text,
  confidence       double precision NOT NULL DEFAULT 0,
  was_corrected    boolean NOT NULL DEFAULT false,
  final_intent     text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restaurant_assistant_logs_restaurant_created_idx
  ON restaurant_assistant_logs (restaurant_id, created_at DESC);

-- ── RLS: فعال روی هر دو جدولِ تازه‌ساز، از همون اول ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['restaurant_assistant_vocab', 'restaurant_assistant_logs'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
