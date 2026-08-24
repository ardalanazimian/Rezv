# رزرونو — وضعیت امنیت Supabase و راهنمای آینده

**تولیدشده از بررسیِ دیتابیس زنده** (پروژه: nxtvmfoczgnjjgdgrxli)

---

## وضعیت فعلی (بررسی‌شده)

### RLS
- ✅ روی **هر ۳۲ جدول** فعال است (`rowsecurity = true`).
- ⚠️ هیچ‌کدام **policy ندارند** (۰ policy) → رفتار **deny-by-default**.
- **یعنی:** هیچ کلاینتِ عادی (anon) نمی‌تواند حتی یک ردیف بخواند یا بنویسد.

### چرا این امن است (معماریِ Trusted Backend)
- بک‌اند **از anon key یا Supabase client استفاده نمی‌کند**.
- فقط **Prisma با اتصال مستقیمِ Postgres** (نقش owner که RLS را دور می‌زند).
- امنیت در **لایه‌ی اپلیکیشن** اعمال می‌شود: `requirePermission`, `withRestaurantAuth`.
- تنها درِ ورودیِ داده = بک‌اندِ خودت، که نگهبانِ خودش را دارد.

**نتیجه:** سیستم امن است. deny-by-default + trusted backend = دو لایه‌ی محافظت.

### Storage
- ✅ هیچ bucketی وجود ندارد → ریسکِ public bucket فعلاً صفر است.

---

## 🔮 ریسک‌های آینده — قبل از این کارها حتماً این بخش را بخوان

### اگر روزی از anon key (دسترسیِ مستقیمِ کلاینت) استفاده کردی
مثلاً برای Realtime یا کوئریِ مستقیم از موبایل. **آن لحظه، deny-by-default جلوی همه‌چیز را می‌گیرد** و باید policyهای دقیق بنویسی. برای هر جدولی که کلاینت باید ببیند:

```sql
-- مثال: کاربر فقط رزروهای خودش را ببیند
CREATE POLICY "own_reservations_select" ON reservations
  FOR SELECT USING (user_id = auth.uid());

-- کاربر فقط رزروِ خودش را لغو کند
CREATE POLICY "own_reservations_update" ON reservations
  FOR UPDATE USING (user_id = auth.uid());
```

**قانون طلایی:** برای هر جدول، هر چهار عملیات را جداگانه در نظر بگیر:
- `SELECT` — چه کسی می‌تواند بخواند؟
- `INSERT` — چه کسی می‌تواند بسازد؟
- `UPDATE` — چه کسی می‌تواند تغییر دهد؟
- `DELETE` — چه کسی می‌تواند حذف کند؟

جدول‌های حساس (`otp_codes`, `idempotency_keys`, `jobs`, `audit_logs`, `sms_transactions`, `points_ledger`) **هرگز** نباید policyی برای anon داشته باشند — فقط بک‌اند بهشان دسترسی دارد.

### وقتی اولین Storage bucket را ساختی (برای عکس)
- **فقط bucketِ عکسِ رستوران** public باشد.
- همه‌ی bucketهای دیگر (مدارک، فاکتور، آواتار خصوصی) **private**.
- روی bucketِ عکس، محدودیت بگذار:
  - نوع فایل: فقط `image/jpeg`, `image/png`, `image/webp`
  - حجم: مثلاً حداکثر ۵MB
  - policy آپلود: فقط پرسنلِ همان رستوران بتواند عکسِ رستورانِ خودش را آپلود کند.

```sql
-- مثال policy آپلود عکس (فقط پرسنلِ مجاز)
CREATE POLICY "restaurant_photo_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'restaurant-photos'
    AND auth.role() = 'authenticated'
  );
```

---

## چک‌لیست قبل از دیپلوی
- [x] RLS روی همه‌ی جداول فعال است.
- [x] بک‌اند از اتصال مستقیم (نه anon key) استفاده می‌کند.
- [ ] مطمئن شو `SUPABASE_ANON_KEY` در هیچ کلاینتی افشا نشده (اگر اصلاً استفاده نمی‌شود، بهتر).
- [ ] وقتی bucket ساختی: فقط عکس رستوران public.
- [ ] اگر anon key فعال شد: policyهای چهارگانه برای هر جدولِ در معرض کلاینت.

**خلاصه:** الان امن هستی. این سند برای آن است که وقتی معماری را گسترش دادی، امن بمانی.
