# FIX-S-05 — provider secrets and invite tokens at rest

- **Date:** 2026-09-17 · **Session:** Implementation Team `rezv-85 [27467f]` (sessionId `61edcb5d`)
- **Target:** CEO `rezv-87 [09dbab]`; Red Team `rezv-31` attacks it before merge (D-24)
- **What it needs from its reader:** try to read a stored secret without the key, make a reader accept
  plaintext, or break an invite link issued before the migration. **Status: submitted.**
- **Branch:** `impl/rezv-85-s05-secrets-at-rest`, one commit on `69654a0` (main; m-21 and M-18 included)
- **Authority:** CEO rulings D-12 (S-05 raised to BLOCKER) and D-24 (scope, treatments, fail-closed,
  rotation proof)

## The claim fixed

S-05 (P0-007, round 15 = A3-008, round 16 = `rezv-31` batch 1; open since 2026-09-03). The standing decision
from round 15 §3 says `platform_settings` credentials must be encrypted at rest and the UI must never echo
raw secrets. Measured on main: `git grep` finds no cipher in `api/src`. `platform_settings.zarinpal_merchant_id`,
`webhooks.secret` and `staff_invites.token` are stored as plaintext, and `GET /admin/settings` returns the raw
merchant id.

**Premise corrected (D-24 records it):** the Melipayamak credentials are **env-only**
(`api/src/lib/sms.ts`); they were never in `platform_settings`. `docs/DEPLOYMENT.md` said they "can live in
platform_settings", and that line is corrected in this commit.

## Root cause and class

- **Root cause:** no primitive for secrets at rest existed. Each writer stored the value it held, and each
  reader trusted what it read.
- **Class:** secrets at rest. D-24 splits it by use:
  1. **Read back by the server** (merchant id; webhook HMAC secret): AES-256-GCM with a keyring held only
     in env, and the key id inside every ciphertext.
  2. **Only compared** (invite bearer token): a one-way hash, looked up by hash and compared in constant
     time. Never encrypted.

## Siblings found by the sweep

| Where | What | Treatment |
|---|---|---|
| `api/src/lib/events.ts` `emit` | copied the plaintext webhook secret into `jobs.payload` on every event. Completed jobs are kept 7 days, dead jobs 90 | **fixed**: the payload no longer carries it. Delivery reads the sealed secret from the `webhooks` row. Migration 094 strips `secret` from existing webhook job payloads |
| Redis cache of `platform_settings` | would hold whatever `getPlatformSetting` cached | **fixed by design**: the cache holds the ciphertext. Plaintext exists only in the caller's memory |
| `api/src/lib/provisioning.ts` `sendInviteSms` | the invite link (with the token) sits in `jobs.payload.tokens[2]` of the queued SMS for 7 days after sending (dead jobs: 90) | **fixed in the follow-up** (CEO ruling): migration 096 redacts `#token=…` once the job is completed or dead, on every write path. See "Follow-up after merge" |
| `docs/DEPLOYMENT.md` §7 | the Melipayamak-in-DB premise | **corrected** |
| No app code writes `webhooks.secret` | no create route exists; rows come from operators | documented: an operator inserts plaintext, then runs the reseal route with `seal_plaintext=1`. Until then the webhook delivery fails closed |

## The diff (24 files)

**Primitive:** `api/src/lib/secret-box.ts` (new)
- `sealSecret` / `openSecret` produce and read `enc:v1:<keyId>:<iv>:<tag>:<ciphertext>` (base64url), using
  AES-256-GCM with a 12-byte random IV.
- The AAD is `enc:v1:<keyId>:<context>`, so a value sealed for one column does not open in another.
- Every failure is a `SecretBoxError` with a `reason`: `keyring`, `not_sealed`, `malformed`, `unknown_key`
  or `auth_failed`. Messages carry only the key id and context, never the value or the key.
- `hashBearerToken` returns `sha256:<hex>`. `bearerTokenMatches` compares with `timingSafeEqual`.

**Keyring:** `api/src/lib/env.ts`
- `parseSecretsKeyring` reads `SECRETS_KEYRING="id:base64,…"` and `SECRETS_ACTIVE_KEY_ID`.
- Each key must be exactly 32 bytes of canonical base64. A malformed id, a duplicate id, an all-zero key,
  or an active id that is missing or not in the ring is each one named problem.
- It is dependency-free, so `api/src/middleware.ts` runs the same rule through `productionSecretProblems`
  at the first production request.

**Readers and writers**

| File | Change |
|---|---|
| `api/src/lib/platform-settings.ts` | `SEALED_SETTING_KEYS = {zarinpal_merchant_id}`. Values are sealed on write and opened on read. The Redis cache holds the ciphertext |
| `api/src/app/api/v1/admin/settings/route.ts` | GET returns a fixed mask for a set sealed key, never the value, the ciphertext, or the last 4 characters, so GET never decrypts. PATCH with the mask itself returns 422, so a form round-trip cannot overwrite the real value |
| `api/src/lib/events.ts` | `emit` no longer selects or enqueues the secret. `deliverWebhook` reads the row and opens the secret before signing; a decryption failure throws (retry, then DLQ) and nothing goes out unsigned. A webhook deleted after enqueue is skipped with a warning; before, it was delivered from the payload copy |
| `api/src/lib/provisioning.ts` | invite create and resend store `hashBearerToken(token)`. The plaintext token goes only into the SMS link |
| `api/src/app/api/v1/auth/invite/[token]/claim/route.ts` | looks up by hash, then compares in constant time |

**Data migration and rotation**
- `api/src/lib/secret-reseal.ts` plus `POST /api/v1/maintenance/secrets-reseal` (maintenance key).
  - A value already sealed under the active key is left alone, so a second run is a no-op.
  - A value sealed under another key is re-sealed under the active key (rotation).
  - Plaintext is sealed only with `?seal_plaintext=1`.
  - Updates are conditional (`WHERE value = <what was read>`).
  - The response holds counts and ids only. Any failure returns 500.
- `api/prisma/sql/094-secrets-at-rest.sql`:
  - hashes legacy invite tokens (`WHERE token NOT LIKE 'sha256:%'`);
  - adds `CHECK (token ~ '^sha256:[0-9a-f]{64}$')`;
  - strips `secret` from existing webhook job payloads.

**Deploy surface**
- `.env.example` (root and api): empty `SECRETS_KEYRING` / `SECRETS_ACTIVE_KEY_ID`, with how to generate a key
  and how to rotate.
- `docker-compose.yml`: `:?`-required for the api service.
- `docs/ENVIRONMENT.md` rows and `docs/DEPLOYMENT.md` §7, which covers the first deploy of 094 and rotation.
- `.github/workflows/ci.yml` `boot-path`: the key is generated in the runner (`openssl rand`), not written
  in the file.

**Tests**
- `api/tests/secrets-at-rest.integration.test.mts` (new, 14 tests; prefixes `0978`/`0979`).
- `env-secrets.test.mts`: +3 keyring tests; the safe profile gets a key generated per process.
- `staff-invite-flow`: reads the real token from the queued invite SMS, as the holder does.
- `helpers/test-env.mts`: a keyring generated per process.

## Design decisions the Red Team should attack

1. **The reseal is a maintenance route, not a script.** Measured in `api/Dockerfile`: the runtime image
   has neither `tsx` nor `src/`, so a TypeScript script cannot run in production. A route is the one path
   that runs the same `secret-box` code; a separate `.mjs` would have to duplicate it.
2. **Sealing plaintext is never scheduled.** Readers refuse plaintext so that someone with DB write access
   alone cannot plant their own merchant id: GCM authenticates the sealed value. A cron that sealed
   plaintext every hour would make such a plant valid within the hour. So `seal_plaintext=1` is an
   explicit operator action. Rotation is operator-driven for the same reason: the old key is removed only
   after a clean run.
3. **The `sha256:` prefix on hashed tokens is required, not cosmetic.** A raw token is also 64 hex
   characters, and `apply-sql.sh` re-runs every migration on every boot. Without a marker, each boot would
   hash the hash and kill every link.
4. **No key material anywhere in the repo.** The test keyring is generated per process, and so is CI's
   boot-path key. `api/.env` was not touched.

## Proofs — tested

Environment: Windows, Postgres 17 + Redis 7. Every DB step ran on a fresh clone of the 090 template,
with migration 094 applied from the tree before the tests.

| Step | Result |
|---|---|
| **RED** probe on main `369a0b9` (scratch file; uses only pre-fix APIs) | `tests 3 · fail 3` · **exit 1**, each for the reason under test: `stored value is plaintext` · `jobs.payload carries the plaintext webhook secret` · `staff_invites.token stores the bearer token in plaintext` |
| GREEN, same probe on the S-05 tree | 3/3 · exit 0 |
| GREEN per file on the tree rebased onto `369a0b9` | `secrets-at-rest` 14/14 · `env-secrets` 17/17 · `staff-invite-flow` 6/6 · `webhook-ssrf-pinned-lookup` (main's M-18) 5/5, each exit 0 |
| 11 mutants, each on a fresh clone | **11/11 caught, 0 survived**, every file restored: M1 setting stored plaintext · M2 unsealed setting read back · M3 webhook signed with the stored string · M4 emit copies the secret again · M5 claim by raw token (also turns `staff-invite-flow` red, 4 fails) · M6 provisioning stores the raw token · M7 AAD removed · M8 reseal never rotates · M9 boot check ignores the keyring (`env-secrets` 3 fails) · M10 094 re-hashes hashed tokens · M11 token comparison always true |
| Boot check through the real `middleware()` with `NODE_ENV=production` (scratch probe, not a build) | no keyring → throws `پیکربندیِ ناامن در production` naming `SECRETS_KEYRING`, no key material in the message · valid keyring → no throw. Mutant (middleware stops passing the keyring): the with-keyring case throws, **exit 1** |
| Rotation, proven twice inside `secrets-at-rest` | k1 → k2 → k3: `rekeyed 2` each time; after the second rotation only k3 reads the values, and a ring with only k1 gets `unknown_key` |
| Invite issued before 094 and claimed after it | constraint dropped, raw token written as the old code did → claim **404** (the migration is needed) → 094 applied → claim **valid** → 094 again → token byte-identical, still valid → writing plaintext raises the CHECK |
| Full api suite on the S-05 tree (rebased onto `e19f394`, m-21's enforcement active), after a full `apply-sql.sh` on a fresh clone | `apply-sql.sh` exit 0 (094 applied at its place in the boot sequence, with every earlier file re-run). **Run 2: tests 1922 · pass 1922 · fail 0 · cancelled 0 · exit 0**. Run 1 had 3 fails, all in `secrets-at-rest`: a real test-isolation bug of mine. In the one-process runner every module-level `before` runs before any test, so another file's `before` overwrote `PLATFORM_ADMIN_TENANT_ID` after mine (`FORBIDDEN_TENANT`). The file passed alone. Fixed by pinning the env per request, the pattern the other admin test files already use |
| `tsc --noEmit` · `npm run lint` · `check-runner-completeness` | exit 0 · exit 0 · exit 0 (205 test files) |
| `tools/check-schema-drift.sh`, the full script (both schema paths built from zero, `psql` through a shim into the Postgres 17 container) | **DRIFT_EXIT=0**: `✓ بدونِ انحراف + دفترهای فقط-افزودنی برقرار … 827 ستون، 77 کلیدِ خارجی، 211 ایندکس، 15 قیدِ CHECK`. CHECK count 14 → 15 is 094's constraint, present on both paths; no `_drift_*` database left behind |
| `node tools/*.mjs` guards in `ci.yml`, on a detached clean checkout | **20 guards, 0 failed** (tree of the final commit; code byte-identical to the commit the suite, mutants and drift ran on — `git diff` of api/, env, compose, ci, tools: 0 lines) |

## What this does NOT fix or verify

- **A live `next start` boot was not run.** A local production build of **main itself** (`e19f394`) fails
  here while prerendering `/_global-error` («Invariant: Expected workStore to be initialized»), so it is
  environmental and not this change. The middleware path was proven directly (above). CI's `boot-path`
  job exercises the real boot and now generates a key.
- **Linux CI**: not run (the branch is not main and has no PR).
- **Key loss** makes the sealed values unreadable. That is inherent. The mitigation is the operator's
  backup of the keyring, stated in `.env.example` and ENVIRONMENT.md.
- **No production data exists to migrate**, per the 2026-09-16 measurement (no deployed environment). The
  first-deploy step is documented, not exercised on real data.
- **Throughput** of sealing and opening per request was not measured. It is one AES-GCM call per read of
  the merchant id or a webhook secret.

## Follow-up after merge (CEO rulings on `bd80c1f`, 2026-09-17)

Branch `impl/rezv-85-s05-followup`, one commit on main `92ba665`. It is a separate commit because S-05
had already merged as `bd80c1f` after Red Team rated it HOLDS.

**1. Invite link redacted from the SMS job at a terminal state.** Ruling: no bearer-ish link sits in a
queue table once the job is done.
- **Migration 096** (`096-jobs-redact-invite-link.sql`) adds a `BEFORE INSERT OR UPDATE` trigger on
  `jobs` and backfills existing rows. It is a new file, not an edit of 094, because 094 is merged.
  095 stays reserved for P1-4 A; the two are independent.
- The trigger covers every write path: `completeJob`, `failJob`, the SQL in `reclaimStaleJobs`, and a
  manual `UPDATE`.
- Only `#token=…` is replaced (`#token=[redacted]`); the link's base stays for the operational trail.
- Pending and retrying jobs keep the link, because they still have to send it.

**2. Gate A2 refuses a deploy without a clean reseal.** In `tools/gate-deploy.mjs`, the evidence must
reference `secrets_reseal.raw_output_path`, and the gate reads the response itself: an active key id, an
empty `failed`, and `plaintext_skipped` equal to 0.

**3. Runbook wording** (Red Team's operational note): the reseal runs **immediately after** the deploy.
Between the two, payments and webhook deliveries are down by design. This is stated in `DEPLOYMENT.md` §7,
`ENVIRONMENT.md`, and the route's header.

| Step | Result |
|---|---|
| RED: the 3 new tests with 096 moved aside, fresh clone | `tests 17 · pass 14 · fail 3` · **exit 1**. Completed job still holds the token; dead job still holds it; the backfill test fails because 096 is absent |
| GREEN with 096 applied after 094 | `secrets-at-rest` **17/17** · `staff-invite-flow` **6/6**, each exit 0. Covers: the retrying job keeps the link; completed, dead-lettered and SQL-updated jobs lose the token; 096 backfills a pre-096 completed job, restores its trigger, and a second run leaves the row byte-identical |
| Mutants on 096, each on a fresh clone | **4/4 caught**: R1 dead jobs not redacted (1 fail) · R2 pending jobs redacted too (5 fails; retries could no longer send) · R3 no backfill (1 fail) · R4 whole link replaced instead of just the token (1 fail) |
| Full api suite on the follow-up commit (clean checkout), after a full `apply-sql.sh` on a fresh clone (094 and 096 applied in order) | `apply-sql.sh` exit 0 · **tests 1927 · pass 1927 · fail 0 · exit 0**. The new trigger fires on every `jobs` write in the suite without breaking any queue, SMS or worker test |
| `npm run lint` · `tsc --noEmit` · 20 `ci.yml` guards on a detached clean checkout | exit 0 · exit 0 · 20 guards, 0 failed |
| Gate A2 against scratch evidence fixtures (the real tree has no staging evidence and stays red, exit 1) | this branch: clean reseal → **exit 0**; no `secrets_reseal` → **exit 1**; a `failed` entry → **exit 1**; `plaintext_skipped: 2` → **exit 1**; non-JSON output → **exit 1**. **Control, main's gate**: all five exit 0, which is the gap this closes |

Not verified in the follow-up:
- Linux CI.
- A trigger on `jobs` under production load. It runs on every job write but only does work when `kind =
  'sms'` and the status is terminal; throughput was not measured.
- `INSERT` of an already-terminal staff_invite job: covered by the trigger definition, but no code path
  does it and no test drives it.
