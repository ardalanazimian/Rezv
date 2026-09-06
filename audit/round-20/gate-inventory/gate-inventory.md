> تولیدشده توسطِ `node tools/report-gate-status.mjs` در 2026-09-05T01:26:03.798Z روی DESKTOP-8DAJNO5 (win32 10.0.26200, node v24.20.0). **این جدول یک عکسِ لحظه‌ای است، نه یک ادعای دائمی — دوباره اجرا کن، اعتماد نکن.**

| Gate | Command | Exit | State | Note |
|---|---|---|---|---|
| Agent charter | `node tools/check-agent-charter.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/agent-charter.log` |
| Control bytes | `node tools/check-control-bytes.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/control-bytes.log` |
| Doc staleness | `node tools/check-doc-staleness.mjs` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/doc-staleness.log` |
| Classic scripts | `sh tools/check-classic-scripts.sh` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/classic-scripts.log` |
| Fonts | `python tools/check-fonts.py` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/fonts.log` |
| Schema drift | `sh tools/check-schema-drift.sh` | 2 | COULD_NOT_RUN | خودِ گیت اعلام کرد اجرا نشد (کدِ خروجِ ۲ — پیش‌نیازِ غایب/خراب، مثلِ psql). جزئیات در لاگِ خام. — evidence: `audit/round-20/gate-inventory/schema-drift.log` |
| A1 destructive (--scope local/rezervno_verify) | `node tools/gate-destructive.mjs --scope local/rezervno_verify` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/destructive-local_rezervno_verify.log` |
| A1 destructive (--scope production) | `node tools/gate-destructive.mjs --scope production` | 1 | RED | evidence: `audit/round-20/gate-inventory/destructive-production.log` |
| A2 deploy/DNS | `node tools/gate-deploy.mjs` | 1 | RED | evidence: `audit/round-20/gate-inventory/deploy.log` |
| A3 decision (--id D-001) | `node tools/gate-decision.mjs --id D-001` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/decision-D-001.log` |
| A3 decision (--id D-002) | `node tools/gate-decision.mjs --id D-002` | 0 | GREEN | evidence: `audit/round-20/gate-inventory/decision-D-002.log` |
| A3 decision (--id D-003) | `node tools/gate-decision.mjs --id D-003` | 1 | RED | evidence: `audit/round-20/gate-inventory/decision-D-003.log` |
| A4 real sends (--recipients 1) | `node tools/gate-send.mjs --recipients 1` | 1 | RED | evidence: `audit/round-20/gate-inventory/send.log` |
| A1 restore drill executor (tools/restore-drill.sh) | `(اجرا نشد)` | — | UNKNOWN | اجراکننده است، نه گیت: واقعاً pg_dump/CREATE DATABASE/pg_restore/DROP DATABASE انجام می‌دهد. خودِ فایل هم تصریح می‌کند اجراکننده و تفسیرکننده (gate-destructive.mjs) عمداً جدا نگه داشته شده‌اند. این ابزار طبقِ محدودیتِ صریحِ خودش («فقط ارزیابی») چنین چیزی را اجرا نمی‌کند. |
| boot-path (tools/check-boot-path.sh) | `(اجرا نشد)` | — | UNKNOWN | یک Postgresِ کاملاً خالی و دورانداختنی می‌سازد/می‌شکند و برایِ ۹ دقیقه یک سرورِ واقعی روی یک پورت بالا می‌آورد — یک jobِ سنگینِ CI است (ci.yml)، نه یک چکِ سبکِ محلی؛ به‌علاوه cwd را عوض می‌کند و روی وضعیتِ DB اثر می‌گذارد. |
| CI-only jobs (build, test, image-build, security, observability, e2e, design-system, standalone, seo, landing, base-freshness) | `(اجرا نشد)` | — | UNKNOWN | در .github/workflows/ci.yml تعریف شده‌اند، نیازمندِ سرویس‌های Postgres/Redisِ CI، Docker build، یا مرورگرهایِ Playwright‌اند. این‌ها jobِ CI‌اند نه گیتِ محلیِ سبک؛ اجرایشان اینجا محدودیتِ «بدونِ عملِ سنگین/بیرونی» را نقض می‌کند. |
