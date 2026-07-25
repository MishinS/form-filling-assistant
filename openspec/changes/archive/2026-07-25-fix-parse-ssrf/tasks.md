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
- [x] 4.4 Manual check — performed 2026-07-25 against a local dev server rather
  than a deployment, which exercises the same route code. Negative half: nine
  hostile URL shapes were driven through a real guest session — cloud-metadata
  endpoint, internal https host, `file:`, `http:` on the blob host, the lookalike
  registrable domain `…vercel-storage.com.evil.tld`, the bare apex without a store
  subdomain, credentials in the authority (`…@evil.tld`), a missing `url`, and a
  mixed array pairing a valid store URL with a foreign one — all rejected `400`;
  an empty array still returned `200`. Additionally a listener on
  `127.0.0.1:9911` received **no connection** for a request naming that URL,
  proving the guard rejects before any fetch. Positive half: the normal wizard and
  batch flows parsed real documents throughout the wider UAT session.
