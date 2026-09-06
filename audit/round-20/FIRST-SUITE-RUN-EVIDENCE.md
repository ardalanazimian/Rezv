# شواهدِ خامِ اولین اجرای سوئیت روی audit/launch-hardening

استخراج از لاگِ خامِ نشست (`suite.log`، ۴۰۴۲ خط، ۲۹۳KB) که در scratchpadِ
نشست بود و با پایانِ نشست از بین می‌رفت. `*.log` در .gitignore است، پس
به‌جای force-add، بخش‌های تصمیم‌ساز اینجا آورده شده‌اند.

```
commit  : f624912
db      : rezervno_branch_verify @ 55432
redis   : 56379
started : 2026-09-05T01:55:56Z
---
```

## خلاصه‌ی node:test (خامِ کپی‌شده)

```
ℹ tests 1550
ℹ suites 368
ℹ pass 1550
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 322846.4165
```

## کدِ خروج و زمان‌بندی

```
---
finished: 2026-09-05T02:01:21Z
EXIT_CODE=0
```

## شمارشِ مستقلِ نشانه‌های شکست

خطوطِ منطبق بر `^ *✖` یا `not ok `: **0**

این شمارش جدا از خلاصه‌ی خودِ رانر است، چون خلاصه‌ای که خودِ ابزار
می‌سازد و کدِ خروجی که همان ابزار برمی‌گرداند دو شاهدِ مستقل نیستند.

## فیکسچر — سنجیده **پیش از** اجرا

```
tables 72 · staff 0 · rls 61 · policies 0    (مطابقِ خطِ پایه‌ی handoff)
db: rezervno_branch_verify @ localhost:55432 (تازه‌ساخته، ۱۵MB)
redis: localhost:56379
```

## قید

درخت هنگام اجرا کارِ commitنشده‌ی نشستِ دیگری در `api/tests/` داشت
(`_all.runner.mts`، `slot-lock-failopen-double-booking.test.mts`، و
`waitlist-merge-occupancy.test.mts`ِ untracked که رانر در خطِ ۲۱۱
importش می‌کرد). پس ۱۵۵۰ عددِ خالصِ `f624912` نیست.
