# سه پرامپتِ شکارِ باگ — ۲۰۲۶-۰۹-۰۴

هر سه از یافته‌های واقعیِ همین دور آمده‌اند، نه از حدس. به ترتیبِ احتمالِ پیدا کردنِ باگِ واقعی.
هر بلاکِ کد را **عیناً** در یک نشستِ تازه paste کن.

**زمینه‌ای که هر سه به آن تکیه دارند:** `tools/gen-tenant-isolation-matrix.mjs` روی ۱۶۴ فایلِ روت
اجرا شد و ۲۳۴ اندپوینت را طبقه‌بندی کرد (`audit/round-20/tenant-isolation-matrix.json`):

| مرز | تعداد | وضعیت |
|---|---|---|
| `restaurant-tenant` | ۹۵ | ادعای اصلی — **صفر ردیف اجرا شده** |
| `platform-admin` | ۵۲ | — |
| `user` (`/me/*`) | ۳۳ | **تا امروز اصلاً بررسی نشده** |
| `maintenance-key` | ۱۸ | — |
| `inline-custom` | ۶ | هرکدام باید جداگانه اثبات شود |
| عمدیِ عمومی | ۳۰ | دستی بررسی و توجیه شد |

چرا این مرز این‌قدر مهم شد: RLS **بی‌اثر** است (P0-021 — ۶۱ از ۷۳ جدول RLSِ فعال دارند با
**صفر policy**، و اپ با نقشِ owner + `SUPERUSER` + `BYPASSRLS` وصل می‌شود). پس لایه‌ی اپلیکیشن
**تنها** مرزِ بینِ مستأجرهاست. لایه‌ی دومی وجود ندارد.

---

## ۱. مرزِ per-user در `/me/*` — بهترین شانسِ باگِ واقعی

این ۳۳ اندپوینت `authFromRequest` را **درون‌خطی** صدا می‌زنند، نه از راهِ یک guardِ نام‌دار.
یعنی هیچ wrapperی تضمین نمی‌کند `userId` از توکن بیاید. هیچ‌کس تا حالا نپرسیده «آیا کاربر A
می‌تواند دیتای کاربر B را بخواند؟»

```
Read audit/round-20/tenant-isolation-matrix.json and take every row with
boundary == "user" (33 endpoints, all under /api/v1/me/*).

For each one, trace in source how the row it reads or writes is scoped to the
caller. The question is exactly one: does the userId come from the verified JWT
(authFromRequest), or can any part of it come from the body, query, or a path
param? Report file:line for each.

Then write ONE integration test that, for every one of the 33, seeds two users
and proves user B's token cannot read or mutate user A's row. Absence of the
subject must be an ERROR, not a pass — if a route can't be exercised, the test
fails and says why; it never skips silently.

Prove it falsifiable: break the scoping on ONE route so it trusts a body field,
watch the test go red with its exit code, revert, watch it go green. Record both.
Import the file in api/tests/_all.runner.mts or npm test never runs it.
```

---

## ۲. اجرای واقعیِ ۹۵ ردیفِ tenant

فهرست هست، اجرا نیست. **یک فهرستِ اجرانشده هیچ چیزی ثابت نمی‌کند.**

```
Execute the tenant-isolation matrix. Read audit/round-20/tenant-isolation-matrix.json,
take all 95 rows with boundary == "restaurant-tenant", start the API against a
CI-faithful DB (db push -> apply-sql.sh -> test-schema-fixups.sql; expect
tables=72 staff=0), seed TWO tenants, and fire every row with tenant B's token.

Every row must yield FORBIDDEN_TENANT. Record the raw status and body PER ROW into
audit/round-20/tenant-isolation-results.json. A row without its raw output is not
evidence. Any row that passes, any row you could not execute, and any route the
generator could not classify are all BLOCKERS — not majors, and never "skipped".

Then prove the harness can fail: pick one route, make it read restaurantId from
the body instead of ctx.restaurant.id, confirm that row goes red with a real exit
code, revert. A harness that has never gone red proves nothing.
```

---

## ۳. جهش روی مسیرِ پول

خطِ پایه‌ی مستندِ این مخزن **~۲۹٪ سوراخ** در تستِ جهش است. پول جایی است که سوراخ گران تمام می‌شود.

```
Run a mutation round on the money paths only: the loyalty points ledger, coupons,
gift cards, wallet balance, and lib/zarinpal.ts.

For each surviving mutant, write the killing test — never weaken an assertion to
make something pass. Start from these known landmines and prove each is actually
guarded: Zarinpal currency:'IRT' (drop it and amounts are 1/10th — does anything
go red?); the CHECK(... >= 0) backstops from migration 064 (can application code
still drive a balance negative inside a transaction?); ledger idempotency under a
double-tap (fire the same Idempotency-Key twice concurrently, not sequentially).

For every mutant you kill, record the exit code before and after. Report the hole
rate you measured against the ~29% baseline — measured, not quoted.
```

---

## قیدِ مشترکِ هر سه — عمدی است

**اول ثابت کن تست می‌تواند قرمز شود.** سه بار در این مخزن گیتی سبز بود بی‌آنکه چیزی بسنجد:
`--check`ِ گاردِ XSS فقط کهنگیِ آرتیفکت را می‌سنجید · jobِ `boot-path` بدونِ `npm run build`
هیچ سروری بالا نمی‌آورد · و طبقه‌بندیِ `escaped` یک تستِ زیررشته‌ای بود.
مرجع: `docs/audit/GATE-FALSIFIABILITY.md`.

سه دامِ عملیاتی که هر سه پرامپت باید از آن‌ها عبور کنند:

1. **فایلِ تستِ import‌نشده در `api/tests/_all.runner.mts` هرگز با `npm test` اجرا نمی‌شود.**
   یک‌بار سه فایل را نامرئی کرد در حالی که PR ادعای «۳۷۵/۳۷۵ پاس» داشت — عددِ واقعی ۳۵۲ بود.
2. **رانر همه‌ی تست‌ها را در یک process می‌آورد**، پس یک hookِ سراسریِ خراب همه‌ی بقیه را مسموم
   می‌کند و خطای *او* را نشان می‌دهد. وقتی سوئیت یک‌جا فرو ریخت، اول stack trace را بخوان.
3. **DBِ کاری (`rezervno`) آلوده است.** روی آن هر اجرای محلی گمراه‌کننده است. DBِ تازه بساز و
   `DATABASE_URL` را با متغیرِ محیطی override کن — `api/.env` را ویرایش نکن.
