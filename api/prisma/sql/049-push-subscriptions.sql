-- ═══════════════════════════════════════════════════════════════════════
--  ۰۴۹ — جدولِ push_subscriptions (شکاف‌سنجی لانچ، ۲۰۲۶-۰۸-۱۵)
--
--  فقط *ذخیره‌سازیِ* درخواستِ اشتراکِ push. ارسالِ واقعیِ push هنوز ساخته
--  نشده (نیازمندِ کلید FCM/APNs — رجوع کن به api/src/lib/notify.ts).
--  یک ردیف به‌ازایِ هر کاربر (userId هم PK هم FK)، دقیقاً هم‌الگو با
--  guest_profiles.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token      text,
  endpoint   text,
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
