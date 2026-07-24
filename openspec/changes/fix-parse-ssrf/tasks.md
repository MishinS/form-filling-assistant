## 1. Lock the attack shapes into tests first

- [x] 1.1 Update the existing `app/api/parse/route.test.ts` fixtures from
  `https://blob/ok` to real store URLs
  (`https://store123.public.blob.vercel-storage.com/…`) so they describe what the
  route actually accepts. **Test:** `app/api/parse/route.test.ts` — the isolation
  and auth cases stay green.
- [x] 1.2 Add failing rejection cases: a foreign host, an `http:` URL, a literal
  internal IP (`http://10.0.0.5/x.pdf`), and the metadata endpoint
  (`http://169.254.169.254/latest/meta-data/`) — plus a store-lookalike domain and
  credentials in the authority. Each asserts `400`, that `global.fetch` was not
  called, and that `del` was not called. **Test:** `app/api/parse/route.test.ts`
  (red — 8 failures, including the metadata endpoint being fetched).
- [x] 1.3 Add a failing mixed-array case: one valid store URL plus one foreign URL
  → `400` and no fetch at all (proves the guard runs before the fetch loop).
  **Test:** `app/api/parse/route.test.ts` (red), plus an accepted-store-URL case
  asserting exactly one fetch.
- [x] 1.4 Rewrite the guest "чужой URL не удаляется" case for the new contract:
  a foreign URL now never reaches the delete path because the request is rejected
  (200 → 400). **Test:** `app/api/parse/route.test.ts`.

## 2. Guard the route

- [x] 2.1 In `app/api/parse/route.ts`, after the `Array.isArray(sources)` check and
  before the fetch loop, reject with `400` when any `sources[].url` fails
  `isOwnBlobUrl`, with a localized error message in the shape the route already
  uses. **Test:** `app/api/parse/route.test.ts` — 13/13 green.

## 3. Strengthen the allowlist's own coverage

- [x] 3.1 Add bypass shapes to `lib/upload/avatar.test.ts`: credentials in the
  authority, a store-lookalike registrable domain, the bare apex without a store
  subdomain, and IP-literal hosts (`169.254.169.254`, `10.0.0.5`, `[::1]`).
  **Test:** `lib/upload/avatar.test.ts` — 6/6 green, all reject.

## 4. Verification

- [x] 4.1 Full suite, typecheck, lint: `npx vitest run` → 78 files / 531 tests
  pass; `npx tsc --noEmit` exits 0; `npm run lint` reports 0 errors.
- [x] 4.2 Confirm no legitimate caller regresses: `WizardModal` stores
  `uploadToBlob().url` as `blobUrl` and `Processing.tsx` forwards it;
  `lib/batch/run-one.ts` passes the same value. `uploadToBlob` returns the
  `@vercel/blob` upload result URL, which is a store URL. **Test:** call sites read.
- [x] 4.3 `npx openspec validate --strict fix-parse-ssrf` → valid.
- [ ] 4.4 Manual check against a deployment (not performed — no deployment in this
  session): a request with a foreign URL returns `400`, and the normal wizard +
  batch flows still parse.
