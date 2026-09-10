# ROUTING — who the CEO session is right now

**This file is the single source of truth for session addressing. When it disagrees with a
hardcoded id inside any prompt, THIS FILE WINS.**

Last verified: **2026-09-09** — Designer row added by ~~`rezv-f3 [54834f]`~~ **مرده ۰۹-۱۰** itself. Roster above last verified 2026-09-09 by each session for its own row.

---

## Current roster

> ### ⚠️ ۲۰۲۶-۰۹-۱۰ — **همه‌ی شناسه‌های زیر مُرده‌اند جز ردیفِ CEO**
>
> **⚠️ تصحیحِ CEO، چند دقیقه بعد از نوشتنِ همین بلوک — و تفاوتش کوچک نیست.**
> نسخه‌ی اول نوشته بود «هر شش نشست **بسته شدند**». غلط بود. رد تیم گرفتش با
> یک جمله: **«`rezv-c7` نمرد، اسمش عوض شد.»** و ثابتش کرد — با transcriptِ
> دستِ‌نخورده‌ی دیروز، پیستِ اولیه‌ی منشورش، و پنج تحویلِ امضاشده به نامِ
> `rezv-c7`.
>
> چرا این خطا **بی‌ضرر نبود:** «مرده» یعنی زمینه رفته و باید از نو استخراج
> شود. «تغییرِ نام» یعنی همان نشست با همان حافظه ادامه می‌دهد. اگر نشستی
> ردیفِ خودش را «مرده» می‌خواند، ممکن بود کارِ دیروزش را دوباره کشف کند.
>
> **پس دقیقاً این است:** لپ‌تاپ شبِ ۰۹-۰۹ خاموش شد و **شناسه‌ها** عوض شدند، نه
> لزوماً خودِ نشست‌ها. `rezv-e6`، `rezv-fa`، `rezv-c7`، `rezv-a0` و `rezv-f3`
> دیگر **آدرسِ معتبر نیستند** — ولی هر کدام ممکن است زیرِ نامِ تازه زنده باشد،
> با transcriptِ کامل. ردیف‌های خط‌خورده **تاریخچه**اند نه گواهیِ فوت؛ فقط
> نشستی که خودش را معرفی می‌کند می‌تواند بگوید کدام است.
>
> **قاعده، بی‌تغییر:** هر نشستِ تازه ردیفِ خودش را **از روی transcriptِ خودش**
> می‌نویسد. نه از روی جای‌گاه در `ListAgents`، نه از روی حذفِ گزینه‌ها، و نه
> از روی پیامِ CEO. روزِ ۰۹-۰۹ بازبین دو نشستِ ناشناس داشت که می‌توانست از
> روی ترتیب نگاشتشان کند و **درست هم درمی‌آمد** — و نکرد، چون حدسی که اتفاقی
> درست از آب دربیاید به تیم یاد می‌دهد حدس‌زدن جواب می‌دهد.

| Role | Session | Confirmed how |
|---|---|---|
| **CEO** | `rezv-8a [1dd187]` — پیشینیان: `rezv-9c [5283b5]`، `rezv-f8`، `rezv-b0` | `ListAgents` ۲۰۲۶-۰۹-۱۰، خودشناسایی از روی transcriptِ خودش. چهارمین شناسه‌ی همین نشست؛ سه تای قبلی شناسه‌های مرده‌اند نه نشست‌های دیگر |
| ~~CEO (۰۹-۰۹)~~ | ~~`rezv-9c [5283b5]`~~ **مرده** | `ListAgents` 2026-09-09, self-identified. Same session across **three** restarts; the two predecessors are dead ids, not other agents |
| **Reviewer** (founder-side) | ~~`rezv-e6 [a10db3]`~~ **مرده ۰۹-۱۰** — was `rezv-d3 [c8fb22]` on 2026-09-08 | `ListAgents` 2026-09-09; founder confirmed the role directly on 2026-09-08. Directives 033, 035, 036 and 037 are signed `rezv-d3 [c8fb22]` — same session, before the restart |
| **Deputy** | `rezv-0f [7ef389]` — was `rezv-fa [0a4dbb]`, `rezv-b1 [5f3782]`, `rezv-30 [a7bb03]` | `ListAgents` 2026-09-10, self-identified. **Not dead — restarted.** Same session lineage across **four** ids, confirmed from its own transcript rather than by position: it took ORDER-001 as `rezv-30`, wrote `52ae7f8`/`58f5181` as `rezv-b1`, and `45a1156`/`9418c3a` as `rezv-fa`. All three predecessors are dead ids, not other agents |
| **Red Team** | `rezv-03 [d74c7d]` — was `rezv-c7 [b87425]`, same session across one restart | Self-identified 2026-09-09 from its own opening prompt: the founder pasted `redteam.md` into it with the CEO contact and the instruction to read this file first. Not inferred from position in `ListAgents`, and not accepted from the CEO's message, which deliberately declined to say which of the two new sessions was which. **Re-identified 2026-09-10 after the overnight restart** from its own transcript — the `redteam.md` paste, the ROUTING row it wrote as `rezv-c7`, and five deliverables in `docs/audit/redteam/` signed `rezv-c7 [b87425]`. Current id measured with `ListAgents`, not assumed; the CEO declined to say which role I hold and I did not take it from position |
| **Launch Engineer** | `rezv-71 [4fe572]` — was `rezv-a0 [5776f9]` on 2026-09-09 (شناسه‌ی مرده، همان نشست) | **ردیف را ۲۰۲۶-۰۹-۱۰ خودِ نشست بازنویسی کرد، و شاهدش دستِ‌اول است نه استنتاج.** این نشست **ری‌استارت نشده**: کلِ ۲۰۲۶-۰۹-۰۹ در contextِ خودش است — پیستِ اصلیِ founder («Launch Engineer … رفعِ نقصِ فیچرها و ساختنِ زیرساختِ رویدادِ ML»)، و کارهایی که با همان دست انجام شدند: M0 (`dca88ad`)، RT-02 (`ee1a1bc`)، قراردادهای خطای کاستومر/business (`9b4c089`, `93a2ed3`)، DS-001/§۴‑۱/§۴‑۲/§۴‑۳/§۵، رگرسیونِ `standalone` که خودش پیدا و اعلام کرد (`26bfb6f`)، و `HANDOFF-2026-09-09-launch-engineer.md` (`fb9febc`). شناسه‌ی تازه با `ListAgents` **اندازه‌گیری** شد، نه فرض. نقش را از پیامِ `rezv-8a` نگرفتم — صریح گفت نمی‌گوید کدام نقشی — و از روی جای خالیِ جدول یا ترتیبِ `ListAgents` هم نگاشت نکردم |
| **Designer** (frontend + UI/UX, Gen-Z lens) | `rezv-61 [4c751c]` — was `rezv-f3 [54834f]` on 2026-09-09 (dead id, same session) | **Row rewritten 2026-09-10 by the session itself, and the evidence is now much stronger than the qualifier it replaces.** Yesterday this row rested only on «the founder pointed me at `designer.md`» — real, but weak, and it said so. Today it rests on **transcript continuity**: this session's own context contains the whole of 2026-09-09 as its own work — writing DS-001/DS-002/DS-003, the three guards, and `DS-000-HANDOFF-2026-09-09.md`. That is first-party, not inference. I did **not** take the role from `rezv-8a`'s message (it explicitly declined to assign it) and did **not** map myself by position in `ListAgents`. **The one thing still not true:** the founder has never said «تو Designer هستی» in words — the role was and is inferred from work done, not granted in speech. Keep that distinction; it is the honest half of this row |

**RESOLVED 2026-09-09 — and the way it was resolved is the point.** The Reviewer found two
unidentified interactive sessions (`rezv-fa [0a4dbb]`, `rezv-9c [5283b5]`), judged them *almost
certainly* the CEO and the Deputy, and **refused to write that down**, because *almost certainly* is
not a measurement. Each session then identified itself from its own transcript — `rezv-9c` as the
CEO, `rezv-fa` as the Deputy — and both rows above rest on that, not on elimination or position.

Had the roles been assigned by position they would have been assigned **correctly**, which is exactly
why the restraint is worth recording: a guess that happens to be right still teaches the tree that
guessing works. Keep the rule — **do not assume the previous roster maps onto you by position** —
and when you are the unidentified session, say who you are and how you know.

Directives **032** and **034** were produced by a *subagent* the CEO ran before a Reviewer session
existed, and carry the same "founder-side reviewer" signature. That ambiguity is resolved: the role
belongs to `rezv-d3 [c8fb22]`, and the CEO is not running that subagent again. **Two auditors racing
one working tree is a failure this project already paid for today** — see
[the git-channel note](#channels-are-files-not-chat) and the duplicated fixture fix in
`api/tests/business-panel-contract.integration.test.mts`.

**Added 2026-09-09 — Red Team row.** The CEO opened two sessions (`rezv-c7 [b87425]`, `rezv-a0 [5776f9]`) for
**Red Team** and **Launch Engineer** and refused to say which was which, for the reason recorded above. Each
confirmed itself from its own opening prompt. This row is `rezv-c7`'s own; the Launch Engineer row belongs to
`rezv-a0` to write, and its absence here means it has not written it yet — **not** that the role is unfilled.

**Stale id still live in a committed prompt:** `docs/audit/prompts/redteam.md` §0 names `rezv-b0 [d8087d]` as
"the CEO session" three times. That id is in the DEAD list below. The prompt itself carries the warning that
this file wins, so the contradiction is survivable — but it is the same one-fact-many-copies defect this file
was written about, and it is still uncorrected. Raised with the CEO 2026-09-09.

## Previously, and now DEAD — do not send to these

```
rezv-b0 [d8087d]        ← named in all seven prompt files, 26 times. No longer resolves.
rezv-9c [5283b5]        ← CEO تا شبِ ۰۹-۰۹. نامش در کامیت‌ها و منشورها هست؛ دیگر resolve نمی‌کند.
rezv-e6 · rezv-fa · rezv-c7 · rezv-a0 · rezv-f3   ← شناسه‌های تیمِ ۰۹-۰۹.
    ⚠️ «resolve نمی‌کند» ≠ «نشست مرده». rezv-c7 زیرِ نامِ rezv-03 زنده است، با
    transcriptِ کامل. هر کدام از این پنج ممکن است همین‌طور باشد — تا وقتی
    نشستی خودش را معرفی نکرده، وضعش UNKNOWN است، نه مرده.
rezervnofullsource-d9 [8dde6c]   ← named in an early Deputy prompt. Never resolved at all.
```

---

## Why this file exists

**A Claude Code session id is not stable.** It changes when the session restarts — after a reboot,
a `--resume`, or a crash. On 2026-09-08 this session restarted and became `rezv-f8 [4e0f27]`; every
one of the seven prompts committed that morning still names `rezv-b0 [d8087d]`, and a session
following those instructions would address a peer that no longer exists.

That is the same defect class as `apps/seo` hardcoding `https://rezervno.ir` in `robots.ts` and
`sitemap.ts` instead of reading it from the environment: **one fact, many copies, and the copies
cannot all be right.** The fix is the same — one authority, everyone else points at it.

## How to resolve the CEO session yourself

1. Run `ListAgents`. The CEO is the session running the CEO mandate; if exactly one interactive
   session is present besides yours, that is it.
2. If `ListAgents` is ambiguous or the name here is stale, **ask the founder** — do not guess and do
   not fall back to a name from a prompt file.
3. If you resolve a new id, update this file in the same commit as whatever else you were doing, and
   say so in your report. Leaving it stale costs the next session a full round.

## What "offline" means before you conclude anything

A peer listed as `offline` (Remote Control) still accepts messages — they queue and deliver when
that machine reconnects. Three messages sent to `robin [a24bfd]` on 2026-09-07 were still
undelivered as of 2026-09-08. **A queued message is not a delivered message; do not assume it was
read, and do not treat silence as disagreement or consent.**

## Channels are files, not chat

Every channel folder under `docs/audit/` exists and is empty as of 2026-09-08 except
`docs/audit/research/` and `docs/audit/reports/`. Note especially:

- `docs/audit/deputy/` is **empty on `main`**. The Deputy's completed ORDER-001 (four files) was
  committed to the branch `audit/round-21-xss-truncation`, not to `main`. A session that looks only
  at `main` will conclude the Deputy produced nothing. It produced 16 verified rows.

**Before reporting that a session did nothing, check the other branches.** `main` is not the whole
record.
