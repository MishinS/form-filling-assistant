## Why

`fix-parse-ssrf` made `/api/parse` reject any URL outside "the application's own
blob store" before fetching it, but the allowlist backing that promise accepts
*any* Vercel Blob store: `isOwnBlobUrl` only checks that the hostname ends in
`.public.blob.vercel-storage.com` (`lib/upload/avatar.ts`). Anyone can create a
free Vercel account, upload a file to their own store, and hand us that URL — the
guard calls it "own". The origin restriction shipped one day earlier is therefore
weaker than its own spec text claims.

The reach is wider than parse: `app/api/templates/route.ts:33` uses the same
guard to decide whether a URL may be persisted as a template's `fileKey`, and
`app/api/fill/route.ts:79` later fetches that `fileKey` with no guard of its own,
correctly relying on the write boundary having validated it. A store-agnostic
guard admits a foreign URL into the database and gets it fetched by a route that
never sees the check.

## What Changes

- **`isOwnBlobUrl` pins the exact store.** The expected host is derived from
  `BLOB_READ_WRITE_TOKEN` (shape `vercel_blob_rw_<storeId>_<secret>`), so the
  store we validate against is by construction the store we write to and delete
  from — no second setting to configure and no way for the two to drift. A URL on
  a different store id is now rejected by all four routes that take a URL.
- **The guard fails closed.** With the token unset or unparseable, every URL is
  rejected. Nothing can upload or delete in that state, so no legitimate blob URL
  can exist — and a forgotten variable in production must not silently restore the
  hole this change closes. **BREAKING** for a token-less local dev: upload → parse
  stops working instead of degrading quietly.
- **The guard moves to `lib/upload/blob-url.ts`.** `lib/upload/avatar.ts` holds
  nothing else, so the file is deleted rather than emptied. Four routes currently
  import a security guard from a module named after avatars; now that it also
  reads an environment variable, the name is actively misleading. This is the
  relocation `fix-parse-ssrf` deferred to "its own change".
- **Exact-match hardening comes with the pin:** credentials in the authority and
  a non-default port on the real store host are both rejected, and the
  mixed-case store id in the token is matched against the lower-case hostname.
- **The Gemini API key moves out of the query string** into the documented
  `x-goog-api-key` header (`lib/extract/llm/gemini.ts:45`), where it cannot land
  in proxy, CDN, or server logs.
- **`BYOK_ENCRYPTION_KEY` is documented in `.env.example`** with its generator
  and its failure mode. `lib/crypto/secrets.ts` throws without it, so a fresh
  checkout currently gets a 500 on the settings page with no breadcrumb.
- **Tests pin all of it:** the foreign-store rejection, the fail-closed and
  malformed-token branches, the port and case cases, and the Gemini request
  shape — which no test asserts today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fill-pipeline`: the parse endpoint's origin restriction gains a precise
  definition of "the application's own blob store" — one specific store, derived
  from the write credential — plus the requirement that an indeterminate store
  identity rejects everything rather than widening the allowlist.

## Impact

- **Code:** `lib/upload/avatar.ts` deleted → `lib/upload/blob-url.ts` added with
  the pinned guard; import-only edits in `app/api/parse/route.ts`,
  `app/api/templates/route.ts`, `app/api/blob/template/route.ts`,
  `app/api/account/avatar/route.ts`; header swap in
  `lib/extract/llm/gemini.ts`.
- **Config:** `.env.example` gains `BYOK_ENCRYPTION_KEY`. No new variable is
  introduced — `BLOB_READ_WRITE_TOKEN` is already required and already set.
- **Tests:** `lib/upload/avatar.test.ts` → `lib/upload/blob-url.test.ts` with the
  new cases; `vi.stubEnv` added to four route test files whose invented blob
  hosts exact matching would now reject; one new case in
  `lib/extract/llm/gemini.test.ts`.
- **Behavior:** clients that upload through the app are unaffected — their URLs
  are on our store by construction. A caller passing another store's URL now gets
  `400` where it previously succeeded.
- **APIs / deps / data:** no schema, dependency, or response-shape change. No
  migration of existing `templates.file_key` rows (see Non-goals).

## Non-goals

- **Blob access mode and retention** — public URLs that live forever, and
  orphaned batch uploads. The largest remaining storage concern in CONCERNS.md,
  independent of this one.
- **Rate limiting** on register / login / extract / parse — its own CONCERNS.md
  item, unchanged by this work.
- **A logging sink** for the intentional catch blocks, including the new
  fail-closed branch. The codebase has no logging convention yet and "no console
  logging in production code" is a standing rule; introducing one for a single
  call site would prejudge that decision.
- **BYOK key rotation** — a key-version prefix in `keyCipher`, or the missing
  per-row `try/catch` around decryption in `GET /api/models`. This change adds the
  missing documentation line only.
- **Auditing or migrating existing `templates.file_key` rows** that might point at
  a foreign store. The installation is invite-only and single-operator, so no such
  row is expected; recorded rather than assumed away.
- **Path or pathname validation** on blob URLs. `addRandomSuffix` already makes
  keys unguessable and the host is now exact.
- **A redundant guard in `app/api/fill/route.ts`.** Its unguarded
  `fetch(tpl.fileKey)` is safe precisely because the write boundary is pinned;
  duplicating the check there would imply the write boundary is untrusted.
