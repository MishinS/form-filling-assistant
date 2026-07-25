## 1. Pin the guard to one store (TDD)

- [x] 1.1 Move `lib/upload/avatar.test.ts` → `lib/upload/blob-url.test.ts`, repoint
  its import at `./blob-url`, and add `vi.stubEnv("BLOB_READ_WRITE_TOKEN",
  "vercel_blob_rw_abc123_secretpart")` in `beforeEach` so the carried-over cases
  describe a real store — store id `abc123` to match the host the file's accept
  case already used, leaving every existing case untouched. Proven by:
  `lib/upload/blob-url.test.ts` fails to resolve the module (red on purpose).
- [x] 1.2 Add the new failing cases to `lib/upload/blob-url.test.ts`: a URL on a
  **different** store id → `false`; a non-default port on the real store host →
  `false`; a mixed-case store id in the token matching the lower-case hostname →
  `true`; no token → `false` even for a correct own-store URL; malformed token
  (wrong prefix, fewer than five segments, store id with illegal characters) →
  `false`. Proven by: `lib/upload/blob-url.test.ts` red on all five.
- [x] 1.3 Create `lib/upload/blob-url.ts` with `ownBlobHost()` deriving
  `<storeId>.public.blob.vercel-storage.com` from `BLOB_READ_WRITE_TOKEN` (split on
  `_`, require `length >= 5` and the `vercel`/`blob`/`rw` prefix, `[a-z0-9]+` store
  id, lower-cased) and `isOwnBlobUrl` returning `false` on a null host, otherwise
  requiring `https:`, exact `hostname` match, and empty `port`. Proven by:
  `lib/upload/blob-url.test.ts` green.
- [x] 1.4 Delete `lib/upload/avatar.ts`. Proven by: `npx tsc --noEmit` clean (no
  dangling import survives) plus `grep -r "upload/avatar"` returning nothing.

## 2. Repoint the callers

- [x] 2.1 Update the import in `app/api/parse/route.ts`,
  `app/api/templates/route.ts`, `app/api/blob/template/route.ts`, and
  `app/api/account/avatar/route.ts` from `@/lib/upload/avatar` to
  `@/lib/upload/blob-url`. No call-site changes — the signature is unchanged.
  Proven by: `npx tsc --noEmit` clean.
- [x] 2.2 Add `vi.stubEnv("BLOB_READ_WRITE_TOKEN", …)` in `beforeEach` to the four
  route tests that exercise the guard, using the store id each file's fixture host
  already uses: `app/api/parse/route.test.ts` (`store123`),
  `app/api/templates/route.test.ts`, `app/api/blob/template/route.test.ts`, and
  `app/api/account/avatar/route.test.ts` (`abc`). Proven by: those four Vitest
  files green with their existing assertions unchanged.
- [x] 2.3 Confirm `app/api/templates/[id]/route.test.ts` and
  `app/api/fill/route.test.ts` need no stub — they use blob URLs but never reach
  the guard. Proven by: both files green without edits.

## 3. Gemini key out of the query string

- [x] 3.1 Add a failing case to `lib/extract/llm/gemini.test.ts` asserting the
  request shape: the URL passed to `fetch` contains no `key=`, and the headers
  carry `x-goog-api-key` with the configured key. Proven by:
  `lib/extract/llm/gemini.test.ts` red.
- [x] 3.2 In `lib/extract/llm/gemini.ts`, drop `?key=${key}` from the endpoint URL
  and send `"x-goog-api-key": key` in `headers`. Leave `ModelNotConfigured`, the
  response schema, and the parse path untouched. Proven by:
  `lib/extract/llm/gemini.test.ts` green, including its existing cases.

## 4. Document the BYOK key

- [x] 4.1 Add `BYOK_ENCRYPTION_KEY` to `.env.example` with the generator
  (`openssl rand -base64 32`, exactly 32 bytes) and an honest note that without it
  custom models cannot be saved and `GET /api/models` throws for any user who
  already has one stored. Proven by: manual read of `.env.example` against
  `lib/crypto/secrets.ts` `masterKey()` — the documented constraints match the
  three errors it can throw.

## 5. Verify

- [x] 5.1 Full suite green (`npx vitest run`), 78 test files — the guard's test
  file is renamed, not added. Proven by: Vitest summary.
- [x] 5.2 `npx tsc --noEmit` clean. Proven by: empty output.
- [x] 5.3 `npx openspec validate --all --strict` green. Proven by: command output.

## 6. UAT (before archiving)

- [ ] 6.1 **Verify the load-bearing assumption**: upload one document through the
  wizard and compare the returned blob URL's hostname against the store id in
  `BLOB_READ_WRITE_TOKEN`. Proven by: manual check — the hostname equals the store
  id lower-cased, or the change is wrong and parse fails immediately.
- [ ] 6.2 Registered user: upload → parse → extract → review → fill downloads.
  Proven by: manual run.
- [ ] 6.3 Guest: upload → parse succeeds and the source blob is deleted afterwards.
  Proven by: manual run.
- [ ] 6.4 Register a custom template and change the avatar — both URL-taking routes
  still accept our own store. Proven by: manual run.
- [ ] 6.5 One extraction on the Gemini provider, confirming the header swap did not
  break authentication. Proven by: manual run.

The fail-closed branch is not UAT'd: blanking `BLOB_READ_WRITE_TOKEN` breaks the
upload in `/api/blob/upload` before the wizard can reach parse, so the branch is
unreachable from the UI. It is covered by six cases in `lib/upload/blob-url.test.ts`
(absent token plus five malformed shapes), which assert the guard returns `false`
rather than throwing — the property the routes rely on to answer `400`.
