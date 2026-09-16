# فهرستِ حذفِ شاخه — ۲۰۲۶-۰۹-۱۶

**فهرستِ اجرایی برای CEO.** خودم چیزی حذف نکردم — این سند فقط می‌گوید حذفِ کدام شاخه هیچ کامیتی را نمی‌برد، و چطور خودتان قبلِ زدن تأییدش کنید.
نوشته‌ی `rezv-34 [617ab1]` · sessionId `ace570d0-…` · بی‌نقش.

- **تحلیلِ پین‌شده:** `main = 48fdcb3` در **2026-09-16T04:09:14Z** (`git ls-remote`، بعد پین‌شده در `refs/snap/*`).
- **سنجشِ دومِ زنده:** `main = 38e27c4` در **2026-09-16T04:18:52Z** — همان ۲۳ ردیف دوباره، این بار روی origin‌ِ لحظه.
- **معیارِ امن‌بودن:** `git rev-list --count origin/main..origin/<شاخه>` برابرِ **صفر** باشد؛ یعنی نوکِ شاخه جدِ main است و هر کامیتش از main قابلِ دسترس است.
- **این فهرست را کورکورانه اجرا نکنید.** هر ردیف دستورِ تأییدِ خودش را دارد که **لحظه‌ی حذف** دوباره می‌سنجد.

**و همین اتفاق در فاصله‌ی همین دو سنجش افتاد** — به‌عنوانِ نمونه‌ی زنده‌ی اینکه چرا تأییدِ لحظه‌ی حذف لازم است، نه تشریفات:

> `session/rezv-48` در تحلیلِ پین‌شده `ahead=0` بود (نوک `42ba301`). ده دقیقه بعد `7a3a3c0` شده و **6 کامیت جلوتر** است — روی آن push شد.
> از فهرستِ حذف بیرون آمد. اگر همان جدولِ اول را بی‌تأیید اجرا کرده بودید، یک شاخه‌ی فعال حذف می‌شد.

| | |
|---|---|
| کاندیدای `ahead=0` در تحلیلِ پین‌شده | **28** |
| امنِ حذف (هر دو سنجش) | **22** |
| نگه‌داشته — worktreeِ زنده یا کامیتِ بی‌نسخه | **5** |
| بیرون‌آمده چون بینِ دو سنجش جلو رفت | **1** |

---

## الف) 22 شاخه‌ی امنِ حذف

`sha`ی نوک را نگه داشته‌ام تا اگر لازم شد دقیقاً همان‌جا برگردد — کامیت تا وقتی از main قابلِ دسترس است gc نمی‌شود، ولی نامِ شاخه بدونِ این sha برنمی‌گردد.

| شاخه | نوک | عقب از main | آخرین کامیت | نکته |
|---|---|---|---|---|
| `claude/rezervno-public-website-dgu5rp` | `00c1201` | 669 | 2026-08-07 |  |
| `local/audit-2026-08-07` | `fde76c2` | 668 | 2026-08-07 |  |
| `claude/ai-customer-intelligence` | `a7cf3ce` | 648 | 2026-08-14 |  |
| `claude/ai-model-versioning` | `999d67d` | 648 | 2026-08-14 |  |
| `claude/booking-integrity-hardening` | `b821f5d` | 642 | 2026-08-14 |  |
| `docs/post-16-security-sync` | `bc74aaf` | 636 | 2026-08-14 |  |
| `feat/customer-desire-design-system` | `f9e27ea` | 632 | 2026-08-14 |  |
| `fix/acquisition-p0-hardening` | `d5544e6` | 638 | 2026-08-14 |  |
| `fix/residual-a1-a2-a3` | `0c11ea4` | 634 | 2026-08-14 |  |
| `fix/time-range-exclude-redis-evidence` | `3e483d4` | 632 | 2026-08-14 |  |
| `fix/waitlist-accept-race-timezone` | `dace8dc` | 623 | 2026-08-16 |  |
| `claude/rezv-ai-agency-os-bvk4e8` | `a499104` | 583 | 2026-08-22 |  |
| `docs/known-limitations-src-v2-stale-entry` | `325889f` | 580 | 2026-08-22 |  |
| `claude/claude-md-docs-1dkocg` | `bbff221` | 561 | 2026-08-25 |  |
| `claude/claude-md-docs-hpz1bw` | `a20a388` | 564 | 2026-08-25 |  |
| `claude/rezervno-product-audit-gk4sqp` | `eee5e44` | 544 | 2026-08-25 |  |
| `claude/test-coverage-analysis-3d2rfp` | `ef557b8` | 561 | 2026-08-25 |  |
| `claude/todo-implementation-arpe9t` | `f9bd385` | 562 | 2026-08-25 |  |
| `reconcile/audit-plus-features` | `b5553a3` | 486 | 2026-08-27 |  |
| `feat/admin-totp-login` | `fd00be1` | 444 | 2026-09-03 |  |
| `audit/launch-hardening` | `1f724c8` | 317 | 2026-09-07 |  |
| `fix/verified-findings-2026-09` | `5ea7631` | 19 | 2026-09-12 |  |

### تأییدِ تک‌خطی — یکی برای هر شاخه

هر خط **خودش می‌سنجد** و اگر شاخه دیگر `ahead=0` نباشد `STOP` می‌دهد. اول `git fetch --prune origin` بزنید.

```bash
b=claude/rezervno-public-website-dgu5rp; t=00c1201; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=local/audit-2026-08-07; t=fde76c2; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=claude/ai-customer-intelligence; t=a7cf3ce; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=claude/ai-model-versioning; t=999d67d; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=claude/booking-integrity-hardening; t=b821f5d; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=docs/post-16-security-sync; t=bc74aaf; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=feat/customer-desire-design-system; t=f9e27ea; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=fix/acquisition-p0-hardening; t=d5544e6; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=fix/residual-a1-a2-a3; t=0c11ea4; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=fix/time-range-exclude-redis-evidence; t=3e483d4; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=fix/waitlist-accept-race-timezone; t=dace8dc; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=claude/rezv-ai-agency-os-bvk4e8; t=a499104; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=docs/known-limitations-src-v2-stale-entry; t=325889f; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=claude/claude-md-docs-1dkocg; t=bbff221; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=claude/claude-md-docs-hpz1bw; t=a20a388; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=claude/rezervno-product-audit-gk4sqp; t=eee5e44; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=claude/test-coverage-analysis-3d2rfp; t=ef557b8; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=claude/todo-implementation-arpe9t; t=f9bd385; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=reconcile/audit-plus-features; t=b5553a3; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=feat/admin-totp-login; t=fd00be1; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=audit/launch-hardening; t=1f724c8; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
b=fix/verified-findings-2026-09; t=5ea7631; [ "$(git rev-list --count origin/main..origin/$b)" = 0 ] && echo "SAFE   $b   (بازگردانی: git push origin $t:refs/heads/$b)" || echo "STOP   $b"
```

### و اگر همه را یک‌جا خواستید

```bash
git fetch --prune origin
for b in \
  claude/rezervno-public-website-dgu5rp \
  local/audit-2026-08-07 \
  claude/ai-customer-intelligence \
  claude/ai-model-versioning \
  claude/booking-integrity-hardening \
  docs/post-16-security-sync \
  feat/customer-desire-design-system \
  fix/acquisition-p0-hardening \
  fix/residual-a1-a2-a3 \
  fix/time-range-exclude-redis-evidence \
  fix/waitlist-accept-race-timezone \
  claude/rezv-ai-agency-os-bvk4e8 \
  docs/known-limitations-src-v2-stale-entry \
  claude/claude-md-docs-1dkocg \
  claude/claude-md-docs-hpz1bw \
  claude/rezervno-product-audit-gk4sqp \
  claude/test-coverage-analysis-3d2rfp \
  claude/todo-implementation-arpe9t \
  reconcile/audit-plus-features \
  feat/admin-totp-login \
  audit/launch-hardening \
  fix/verified-findings-2026-09
do
  if [ "$(git rev-list --count origin/main..origin/$b)" = 0 ]; then
    echo "delete $b"; git push origin --delete "$b"
  else
    echo "SKIP $b — دیگر ahead=0 نیست"
  fi
done
```

---

## ب) 5 شاخه که `ahead=0` دارند ولی نگه داشته شده‌اند

طبقِ قیدِ خودِ سفارش: شاخه‌ای که worktreeِ زنده رویش چک‌اوت است یا کامیتِ بی‌نسخه دارد، حتی با `ahead=0` در فهرستِ حذف نمی‌آید.

| شاخه | نوک | چرا نگه داشته شد | refِ محلی جلوتر از origin |
|---|---|---|---|
| `audit/round-21-xss-truncation` | `da82092` | worktreeِ زنده رویش چک‌اوت است (`relay-wt`) | — |
| `session/rezv-02-founder` | `48fdcb3` | worktreeِ زنده رویش چک‌اوت است (`wt-rezv-02`) | — |
| `session/rezv-a0` | `5168251` | worktreeِ زنده رویش چک‌اوت است (`wt-rezv-a0`) | 92 کامیت |
| `session/rezv-d6` | `d01be8e` | worktreeِ زنده رویش چک‌اوت است (`wt-rezv-d6`) | 8 کامیت |
| `session/rezv-e6` | `9a553b8` | worktreeِ زنده رویش چک‌اوت است (`wt-rezv-e6`) | — |

**حذفِ شاخه‌ی ریموتِ یک worktreeِ زنده، کارِ آن نشست را از بین نمی‌برد، ولی refِ بالادستش را می‌شکند** و نشست وسطِ کار با یک `git push`ِ شکست‌خورده روبه‌رو می‌شود. ارزشش را ندارد؛ بگذارید صاحبش خودش ببندد.

### یک تغییر نسبت به گزارشِ چند ساعت پیش

در سیاهه سه شاخه کامیتِ بی‌نسخه روی origin داشتند. حالا فقط **1** مانده:

- `integration/launch-rc1` — 1 کامیت

سنجیده، نه استنتاج‌شده: `546306e` (RT-18) و `7a3a3c0` (DS-009 L3) حالا از `origin/backup/launch-rc4` و `origin/session/rezv-48` قابلِ دسترس‌اند و `git rev-list <sha> --not --remotes=origin` برای هر دو صفر می‌دهد. دیگر فقط روی دیسکِ این ماشین نیستند.
هیچ‌کدام از 22 شاخه‌ی فهرستِ «الف» کامیتِ بی‌نسخه ندارد — این را جداگانه سنجیدم (`git rev-list <شاخه> --not --remotes=origin` برای refِ محلیِ هم‌نامشان).

---

## ج) اگر شاخه‌ای اشتباه حذف شد

```bash
git push origin <sha-نوک>:refs/heads/<نامِ شاخه>
```

کامیت تا وقتی از `main` قابلِ دسترس است زنده می‌ماند (و هر ۲۸ کاندیدا `ahead=0` بودند، یعنی هستند)، پس بازگردانی فقط بازساختنِ **نام** است. shaهای جدولِ بالا برای همین هستند.
