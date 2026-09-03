# Supabase decommission protocol — project `zmyuvtpbchytqvtgyewt` (id 40563480)

**Ordered by:** founder directive 4, order 1 (2026-09-04)
**Rule:** the project is **NOT deleted** until an archived dump exists and its row counts are recorded.
**Absence of data must be PROVEN, never assumed.** "The DB looked empty" is not evidence; a manifest is.

**Context:** the founder chose Postgres inside the Docker stack (P0-014), so this project leaves the
critical path. Leaving the path is not the same as being safe to delete.

---

## Checklist — every row needs evidence, not a tick

| # | Step | Owner | Evidence required | Status |
|---|------|-------|-------------------|--------|
| D1 | Restore the project from its paused state | founder | the restore completes and a **real query** (`SELECT 1`) succeeds — control-plane `ACTIVE_HEALTHY` is **not** evidence (it was stale on 2026-09-03) | ☐ |
| D2 | Reset the DB password and record that it is stored, not pasted into a chat | founder | written confirmation | ☐ |
| D3 | `pg_dump` the whole database to a file, kept **off** the Supabase host | founder | file path + size + sha256 | ☐ |
| D4 | Produce the **row-count manifest**: every table → row count | founder or CEO | `supabase-dump-manifest.json` in this folder, filled and committed | ☐ |
| D5 | CEO reviews the manifest against `schema.prisma` — any table with rows that the Docker DB will not have is an explicit **migrate-or-discard decision by the founder**, recorded | CEO + founder | decision line per non-empty table | ☐ |
| D6 | Verify the dump actually restores — load it into a scratch Postgres and compare row counts to the manifest | CEO | restore exit code + per-table diff = zero | ☐ |
| D7 | Only then: delete / release the Supabase project | founder | — | ☐ |

**D6 is not optional.** A dump that has never been restored is a file, not a backup — the same
rule that makes gate (a) of the launch checklist an *executed* restore drill rather than a
documented one.

## Why the manifest, and not a glance

The last three findings in this audit all had the same shape: a status that looked authoritative
(`get_project` said `ACTIVE_HEALTHY`, `RLS is enabled` read as protection, a `tail` of a test log
said `passed`) while the underlying fact was different. A row-count manifest is falsifiable —
someone can re-run the counts and disagree with it. "It was empty" is not.

## Live-query note

While the project is paused, **no** row count can be obtained — `execute_sql` returns `28P01`, which
on 2026-09-03 was misread as a credential fault and is in fact the pause presenting itself. So D1
must complete before D3/D4 are even attempted; nothing about the data can be asserted before then.
