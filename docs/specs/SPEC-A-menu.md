# SPEC-A — منوی آنلاین (Online Menu)

> وضعیت: آماده اجرا · اولویت: P0 · پیش‌نیاز: SPEC-B merge شده باشد
> اجرا در **دو فاز**. فاز ۱ را کامل و merge کن، بعد سراغ فاز ۲ برو.
>
> ⚠️ **نسخه‌ی reconcile‌شده (۲۰۲۶-۰۸-۲۷، به دستورِ مالک):** متنِ اولیه‌ی این spec
> با سورس تطبیق داده شد و ادعاهای غلطش اصلاح شدند — مهم‌ترین‌ها: زیرساختِ منو
> (CRUD، endpointِ عمومی، خطِ لوله‌ی عکس، صفحه‌ی QR) **از قبل موجود است** و فاز ۱
> فقط دلتاست؛ مدیریتِ عکس **Supabase نیست** (§۱-۶)؛ صفحه‌ی QR مسیرِ واقعی‌اش
> `/r/{slug}/menu` است (مسیرِ کوتاهِ پیشنهادیِ متنِ اولیه حذف شد)؛ مسیرِ migration پوشه‌ی `api/prisma/sql/`
> است. مرجعِ تصمیم‌ها: planِ تأییدشده‌ی فاز ۱.

---

## ۱. مسئله و جایگاه رقابتی

مدل `MenuItem` در schema وجود دارد و توسط `ReservationItem` برای pre-order استفاده می‌شود.
**[اصلاحِ reconcile]** برخلافِ متنِ اولیه‌ی این سند، API مدیریتی و UI منو **از قبل وجود
دارد** (ممیزیِ ۲۰۲۶-۰۸-۱۹ و مهاجرت‌های ۰۴۷/۰۵۲/۰۵۳): CRUD کامل در
`api/src/app/api/v1/restaurant/menu/`، صفحه‌ی ۴۶۷خطیِ `apps/business/js/menu.js` با
چهار حالت + آپلودِ عکس + QR + شخصی‌سازی، endpointِ عمومیِ کش‌دارِ
`GET /v1/restaurants/[slug]/menu`، و صفحه‌ی SSRِ `apps/seo/app/r/[slug]/menu/page.tsx`.
آنچه واقعاً کم است: **دسته‌بندیِ رابطه‌ای، وضعیتِ «ناموجود»، مرتب‌سازیِ دسته‌ای،
invalidationِ فعالِ کش در CRUD آیتم، غنی‌سازیِ نمایشِ مشتری، و تستِ E2E**.

رقبای ایرانی (menew.ir، mupra، caffemenu، menobuzz، softmenu) همگی منوی دیجیتال QR دارند — این «باید داشته باشد» است، نه تمایز.

**تمایز ما**: menew.ir سفارش‌گیری، پرداخت و باشگاه مشتریان ندارد. Rezervno هر سه را دارد (`ReservationItem`، Zarinpal، `ClubMember`/`PointsLedger`). پس منو باید **متصل به رزرو و pre-order** ساخته شود، نه یک کاتالوگ جدا.

## ۲. اصل طراحی — غیرقابل مذاکره

مدل `MenuItem` موجود **حفظ و گسترش** می‌شود، هرگز بازنویسی یا حذف نمی‌شود. دلیل: `ReservationItem` با PK مرکب `(reservationId, menuItemId)` به آن وابسته است و تاریخچه سفارش‌ها روی آن است (`onDelete: Restrict`).

---

# فاز ۱ — هسته منو

## ۱-۱. مدل داده

**[اصلاحِ reconcile]** فیلدهای `name` (از ابتدا NOT NULL)، `description`، `imageUrl`
(+متادیتای فایل)، `sortOrder` و ستونِ متنیِ `category` **از قبل روی MenuItem هستند**
(schema.prisma:307-342). دلتای فاز ۱ فقط دو چیز است: مدلِ `MenuCategory` و دو فیلدِ
`categoryId` / `isOutOfStock`. هیچ backfillی برای `name` لازم نیست.

```prisma
model MenuCategory {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  restaurantId String   @map("restaurant_id") @db.Uuid
  name         String
  sortOrder    Int      @default(0) @map("sort_order")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  items        MenuItem[]

  @@unique([restaurantId, name])
  @@index([restaurantId, sortOrder])
  @@map("menu_categories")
}

// روی MenuItem موجود فقط این‌ها اضافه می‌شود:
//   categoryId   String?  @map("category_id") @db.Uuid   (+رابطه onDelete: SetNull)
//   isOutOfStock Boolean  @default(false) @map("is_out_of_stock")
//   @@index([restaurantId, categoryId, sortOrder])
// ستونِ متنیِ category می‌ماند (میرورِ سازگاری برای مصرف‌کننده‌های موجود) و
// سرور در هر تغییرِ دسته سینکش می‌کند.
```

> چرا PK با `dbgenerated("gen_random_uuid()")` و نه `@default(uuid())`: backfillِ
> SQL (§۱-۲) با INSERT خام به DEFAULTِ سمتِ DB نیاز دارد — درسِ مهاجرتِ ۰۷۵.

## ۱-۲. Migration دستی

**[اصلاحِ reconcile]** پوشه‌ی `api/prisma/migrations/manual/` **وجود ندارد**. مسیرِ
واقعی: `api/prisma/sql/NNN-*.sql` با اجرای دومرحله‌ایِ `docker-entrypoint.sh`
(`migrate deploy` فقط برای `0_init`، سپس `sh prisma/apply-sql.sh`). فایلِ این فاز:
**`api/prisma/sql/077-menu-categories.sql`** — کاملاً idempotent (الگوی
`DO $$ … duplicate_object|duplicate_column`, `IF NOT EXISTS`)، FKها با
`ON UPDATE CASCADE` (هم‌خوان با emit پریزما — گاردِ drift)، نامِ unique-index دقیقاً
نامِ تولیدیِ Prisma، و **backfill دوباراجرایی‌پذیر**: رشته‌های distinct ستونِ
`category` → ردیف‌های `menu_categories` (`ON CONFLICT DO NOTHING`) → لینکِ
`category_id` فقط روی ردیف‌های NULL.

## ۱-۳. API — سمت رستوران

Wrapper: `withRestaurantAuth` · Permission: **`canManageSettings`** (همان مجوزِ هر ۶
routeِ موجودِ منو). فلگِ `canManageMenu` به فازِ بعد موکول شد — union مجوزها ۹کلیدی
است و گسترشش migration و UI جدا می‌خواهد.

| متد و مسیر | وضعیت |
|---|---|
| `GET /v1/restaurant/menu` | ✅ موجود — دلتا: `categories[]` + `category_id`/`is_out_of_stock` روی آیتم‌ها |
| `POST /v1/restaurant/menu` | ✅ موجود — دلتا: پذیرشِ `category_id` و `is_out_of_stock` |
| `PATCH /v1/restaurant/menu/[id]` | ✅ موجود — دلتا: همان دو فیلد |
| `DELETE /v1/restaurant/menu/[id]` | ✅ موجود (حذفِ هوشمند: با سابقه‌ی سفارش → بایگانی) |
| `GET/POST /v1/restaurant/menu/categories` | 🆕 جدید |
| `PATCH/DELETE /v1/restaurant/menu/categories/[id]` | 🆕 جدید (DELETE = نرم، `isActive=false`) |
| `PATCH /v1/restaurant/menu/reorder` | 🆕 جدید — مرتب‌سازی دسته‌ای |
| `POST/DELETE /v1/restaurant/menu/[id]/photo` | ✅ موجود — جایگزینِ `upload-url`ِ متنِ اولیه (§۱-۶) |

**قانون امنیتی مطلق**: `restaurantId` همیشه از context احراز هویت گرفته می‌شود، **هرگز از body یا query**. هر query باید به `restaurantId` scope شود. `categoryId` ورودی باید متعلق به همان رستوران باشد وگرنه ۴۲۲.

اعتبارسنجی: `name` آیتم ۱–۱۲۰ و دسته ۱–۶۰ کاراکتر · `priceToman` صحیح ≥ ۰ · `description` ≤ ۳۰۰ (سقفِ موجودِ سورس) · `sortOrder` ۰–۱۰۰٬۰۰۰ (سقفِ موجود).

## ۱-۴. API — عمومی

`GET /v1/restaurants/[slug]/menu` — **✅ موجود** (بدون auth، با rate-limit و کش).
دلتا (**فقط افزودنی؛ هیچ فیلدِ موجودی حذف/تغییرنام نمی‌شود**):

- `categories: [{id, name, sort_order}]` — فقط دسته‌های فعال، مرتب.
- روی هر آیتم: `is_out_of_stock` و `category_id`.
- `isOutOfStock` آیتم را مخفی نمی‌کند — نمایش با برچسبِ «ناموجود» (تجربه‌ی بهتر).
- آیتمِ دسته‌ی غیرفعال هم برمی‌گردد (در نمایش «دسته‌نشده» می‌شود).

صفحه‌ی جزئیاتِ `GET /v1/restaurants/[slug]` (مصرف‌کننده‌ی واقعیِ اپِ مشتری) هم همین
دو فیلد را در بلوکِ منویش می‌گیرد.

## ۱-۵. کش

**[اصلاحِ reconcile]** کش از قبل هست: کلیدِ `cache:restaurant-public-menu:{slug}` با
TTL **۶۰ ثانیه** (الگوی `lib/cache.ts` — `cached`/`invalidate`). کلید/TTL جدیدی
اختراع نمی‌شود. دلتای فاز ۱: **invalidation فعال** — helperِ مشترکِ
`invalidatePublicMenu(restaurantId)` (که امروز فقط داخلِ photo route است) به
`lib/menu-cache.ts` منتقل و بعد از **هر** mutation منو (آیتم/دسته/reorder/عکس) صدا
زده می‌شود؛ هر دو کلیدِ `restaurant-detail` و `restaurant-public-menu` را پاک می‌کند.

## ۱-۶. مدیریت عکس

**[بازنویسیِ کامل — تصمیمِ مالک ۲۰۲۶-۰۸-۲۷: خطِ لوله‌ی موجود می‌ماند؛ Supabase ساخته نمی‌شود.]**

متنِ اولیه Supabase Storage با signed upload URL می‌خواست با این استدلال که «همان
زیرساختِ DB» است. این استدلال برای این repo غلط بود: DB تولید **Postgresِ خودمیزبانِ
docker-compose** است (نه Supabase)، هیچ کدِ Supabase در repo نیست، و دسترسیِ
Supabase (روی AWS) از ایران همان ریسکِ Google Fonts را دارد.

آنچه واقعاً موجود است و **معیارِ این spec** است (مهاجرتِ ۰۵۳؛
`api/src/app/api/v1/restaurant/menu/[id]/photo/route.ts` + `lib/media.ts` + `lib/media-store.ts`):

- آپلودِ واقعیِ فایل: `POST /v1/restaurant/menu/{id}/photo` (multipart، فیلدِ `file`)؛ حذف: `DELETE` روی همان مسیر.
- اعتبارسنجی از روی **magic-byte** (نه content-type ادعایی): فقط `jpeg|png|webp`؛ سقفِ حجم **۸MB** (`MAX_BYTES`، media.ts:36) و سقفِ بُعد ۸۰۰۰px — چکِ Content-Length پیش از بافر شدن.
- ذخیره روی ولومِ `UPLOAD_DIR` (بایت‌ها عمداً در Postgres نیستند)؛ سرو از `/api/v1/media/<key>`.
- **`imageUrl` را فقط سرور می‌نویسد** — کلاینت هرگز نمی‌تواند آدرسِ دلخواه بگذارد (قانونِ امنیتیِ ۰۵۳).
- جایگزینیِ بی‌یتیم: اول فایلِ نو، بعد ردیف، در پایان حذفِ فایلِ قدیمی؛ حذفِ عکس اول ارجاع را قطع می‌کند بعد فایل را.
- بعد از هر تغییرِ عکس، هر دو کشِ عمومی invalidate می‌شوند.

مهاجرتِ آینده به object-storage اگر لازم شد، مسیرِ اعلام‌شده‌ی repo **S3-سازگارِ
ایرانی (آروان/لیارا)** است (`.env.example` بخشِ S3_*) — تصمیمِ جدا، بیرون از این spec.

## ۱-۷. فرانت‌اند

**`apps/business`** — صفحه‌ی مدیریت منو **✅ موجود** (`js/menu.js`؛ چهار حالت + گروه‌بندی + آپلود + QR + branding). دلتا:
- بخشِ مدیریتِ **دسته‌ها** (ساخت/تغییرنام/غیرفعال/ترتیب با دکمه‌های بالا/پایین → endpoint reorder).
- فرمِ آیتم: `<select>` دسته از سرور (به‌جای datalistِ پیشنهادیِ آزاد) + گزینه‌ی «بدونِ دسته».
- toggle سریع «ناموجود» روی هر ردیف (بدون باز کردن فرم) + chip.
- حالت‌های چهارگانه‌ی موجود دست‌نخورده می‌مانند.

**`apps/customer`**:
- بخشِ «منو» در صفحه‌ی جزئیات **✅ موجود** (`js/data/detail.js`). دلتا: سکشن‌بندی بر اساسِ دسته، نمایشِ توضیح، برچسبِ «ناموجود» (آیتم مخفی نشود)، و حذفِ آیتم‌های ناموجود از چیپ‌های پیش‌سفارشِ booking (enforcement سروری = فاز ۲). همه با `esc()`.
- **[اصلاحِ reconcile]** صفحه‌ی مستقلِ منو برای QR **از قبل موجود است**: `/r/{slug}/menu` روی سایتِ SEO (`apps/seo/app/r/[slug]/menu/page.tsx` — SSR بدونِ جاوااسکریپت، سریع، بدونِ لاگین؛ همان آدرسی که QRِ سروری encode می‌کند). صفحه‌ی جدیدی ساخته **نمی‌شود** و مسیرِ کوتاهِ جداگانه‌ای هم در کار نیست — این صفحه فقط از فیلدهای جدیدِ API (دسته‌ها/ناموجود) **غنی می‌شود** (سوییچِ گروه‌بندی‌اش به `category_id` هم به بعد موکول شد؛ میرورِ متنی سازگاری را نگه می‌دارد).

**همه‌جا**: RTL، فونت و توکن‌های design system موجود، `alt` روی عکس‌ها، `aria-label` روی دکمه‌ها، کنتراست کافی، سازگاری dark mode، ناوبری با کیبورد.

**بامپ `CACHE_VERSION`**: فقط `apps/customer/sw.js` (تنها service workerِ repo) — پنل‌ها sw ندارند و تازگی‌شان با گیتِ standalone تضمین می‌شود.

## ۱-۸. تست‌های فاز ۱

- CRUD دسته و آیتم (آیتم ✅ موجود — `menu-crud.integration.test.mts`؛ دسته 🆕)
- **cross-tenant**: staff رستوران A نتواند دسته/آیتم B را بخواند یا تغییر دهد (۴۰۴ با الگوی ضدِ IDOR موجود)
- `categoryId` متعلق به رستوران دیگر → ۴۲۲
- endpoint عمومی: آیتم غیرفعال برنگردد (✅ موجود)؛ ناموجود **برگردد** با فلگ (🆕)
- invalidation کش بعد از mutation (🆕 — بدونِ صبرِ TTL)
- عکس: نوع/حجم غیرمجاز رد شود (✅ موجود — magic-byte در `lib/media.ts`)
- E2E پنل و مشتری (🆕 — امروز پوششِ E2E منو صفر است)

---

# فاز ۲ — تمایز رقابتی

> ✅ **اجرا شد (۲۰۲۶-۰۸-۲۷) با reconcile — B1..B10 در planِ مصوب.** خلاصه‌ی
> انحراف‌های مستند نسبت به متنِ زیر:
> • کش: invalidationِ فعال از فاز ۱ موجود بود؛ TTL ‏۶۰→۳۰۰ شد ولی **نامِ کلیدِ
>   موجود** (`restaurant-public-menu`) ماند — rename فقط churn بود.
> • اعتبارسنجیِ pre-order: چکِ cross-restaurant و قیمت-از-DB از رفعِ امنیتیِ
>   ۰۸-۱۳ موجود بود؛ دلتای واقعی isActive/ناموجود/پنجره + جابه‌جاییِ اعتبارسنجی
>   به **قبل از** درج (idِ جعلی قبلاً خطای FK می‌گرفت). پنجره نسبت به
>   **slotStart** سنجیده می‌شود، نه «اکنون».
> • چیپ‌های pre-orderِ اپِ مشتری تا این فاز تزئینی بودند (payload خالی) — واقعاً
>   سیم‌کشی شدند.
> • فیلترِ پنجره‌ی endpointهای عمومی **پس از** خواندنِ کش اعمال می‌شود (وگرنه
>   مرزِ پنجره تا TTL دروغ می‌گفت).
> • modifier فقط ساختارِ منوست؛ انتخاب/ذخیره در سفارش طبق §۲-۴ بیرونِ این فاز.
> • شیمِ validate `z.enum` **دارد** (validate.ts:232) — حدسِ اولیه‌ی نبودنش غلط
>   بود؛ برچسب‌ها با whitelistِ صریحِ enumِ Prisma رد/قبول می‌شوند.

## ۲-۱. Modifier

```prisma
model MenuModifierGroup {
  id         String @id @default(uuid())
  menuItemId String @map("menu_item_id")
  name       String              // مثلاً «سایز»
  minSelect  Int    @default(0) @map("min_select")
  maxSelect  Int    @default(1) @map("max_select")
  sortOrder  Int    @default(0) @map("sort_order")

  menuItem   MenuItem @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  options    MenuModifierOption[]

  @@index([menuItemId, sortOrder])
  @@map("menu_modifier_groups")
}

model MenuModifierOption {
  id              String  @id @default(uuid())
  groupId         String  @map("group_id")
  name            String              // مثلاً «بزرگ»
  priceDeltaToman Int     @default(0) @map("price_delta_toman")
  isActive        Boolean @default(true) @map("is_active")
  sortOrder       Int     @default(0) @map("sort_order")

  group           MenuModifierGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@index([groupId, sortOrder])
  @@map("menu_modifier_options")
}
```

اعتبارسنجی: `maxSelect >= minSelect` · `maxSelect >= 1` · `priceDeltaToman` می‌تواند منفی باشد (تخفیف) اما قیمت نهایی نباید منفی شود.

## ۲-۲. برچسب‌ها

```prisma
enum MenuTag {
  VEGETARIAN
  VEGAN
  SPICY
  GLUTEN_FREE
  CONTAINS_NUTS
  CONTAINS_DAIRY
  HALAL
  NEW
  POPULAR

  @@map("menu_tag")
}

model MenuItemTag {
  menuItemId String  @map("menu_item_id")
  tag        MenuTag
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id], onDelete: Cascade)

  @@id([menuItemId, tag])
  @@map("menu_item_tags")
}
```

برچسب‌های حساسیت غذایی در بنچمارک جهانی (SevenRooms، OpenTable) جزو انتظارات پایه‌اند و در ایران فقط تیر بالای menew.ir آن را دارد.

## ۲-۳. بازه‌ی در دسترس بودن

فیلد `availability Json?` روی `MenuItem`:
```json
{ "days": [0,1,2,3,4,5,6], "startMin": 720, "endMin": 1380 }
```
`null` = همیشه در دسترس. اعتبارسنجی: `days ⊆ 0..6` · `0 ≤ startMin < endMin ≤ 1439`.
endpoint عمومی باید بر اساس زمان فعلی رستوران فیلتر کند.

## ۲-۴. اتصال به pre-order

`ReservationItem` با PK مرکب `(reservationId, menuItemId)` **دست‌نخورده** می‌ماند.

اعتبارسنجی سمت سرور هنگام ثبت رزرو با pre-order:
- آیتم باید `isActive === true` و `isOutOfStock === false` باشد
- `menuItem.restaurantId` باید با رستوران رزرو یکی باشد
- قیمت از **دیتابیس** خوانده شود، هرگز از body کاربر

اگر ذخیره‌سازی modifier در سفارش لازم شد، فیلد `modifiersJson jsonb` در یک migration **جداگانه** به `ReservationItem` اضافه شود — PK را تغییر نده.

## ۲-۵. تست‌های فاز ۲

- `minSelect`/`maxSelect` نامعتبر → ۴۲۲
- محدوده `availability` نامعتبر → ۴۲۲
- آیتم خارج از بازه در endpoint عمومی برنگردد
- pre-order با آیتم ناموجود → خطای دامنه
- pre-order با آیتم رستوران دیگر → ۴۲۲
- قیمت pre-order از DB خوانده شود، نه از body

---

## ۳. معیار پذیرش نهایی

- [ ] `tsc --noEmit` بدون خطا · کل تست‌ها سبز
- [ ] migration ۰۷۷ دو بار پشت‌سرهم اجرا شود بدون خطا (+ گاردِ drift سبز)
- [ ] یک منوی واقعی (دسته‌دار، با آیتمِ ناموجود) از پنل ساخته شود و روی **`/r/{slug}/menu`** (صفحه‌ی SSRِ موجود — فقط غنی‌شده، نه ساخته‌شده) و صفحه‌ی جزئیاتِ اپِ مشتری درست و RTL نمایش داده شود
- [ ] `MenuItem` موجود و `ReservationItem` هنوز کار می‌کنند (تست رگرسیون رزرو با pre-order)
- [ ] `CACHE_VERSION` در `apps/customer/sw.js` بامپ شده (تنها swِ repo)
- [ ] `DATABASE.md`، `API_REFERENCE.md`، `FRONTEND.md` بروزرسانی شده‌اند (+ اصلاحِ جمله‌های غلطِ مستندشده: Supabase/۰۶۴/DATABASE_DIRECT_URL/db push)
