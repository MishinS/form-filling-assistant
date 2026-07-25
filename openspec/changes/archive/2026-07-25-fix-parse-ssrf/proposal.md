## Why

`POST /api/parse` fetches every user-supplied `sources[].url` server-side with no
check on where that URL points (`app/api/parse/route.ts:30`). The guest provider
issues a session with zero credentials, so the route is effectively
unauthenticated: anyone can make the deployment fetch `http://169.254.169.254/…`,
an internal service, or any host reachable from the serverless function. Response
bytes are only interpreted as PDF/XLSX/DOCX, which limits but does not prevent
exfiltration — and blind SSRF (port/host probing via timing and warning text)
needs no parseable response at all.

Every sibling route that takes a URL already guards it — `/api/templates`,
`/api/blob/template`, and `/api/account/avatar` all reject a non-own-blob URL with
`400` before touching it. `/api/parse` is the one that does not, and it is the one
reachable without credentials.

## What Changes

- **`/api/parse` validates every source URL before any fetch.** A request whose
  `sources` contain a URL outside the app's own Vercel Blob store is rejected with
  `400` and nothing is fetched — the guard runs over the whole array first, so a
  single foreign URL cannot ride along with valid ones.
- **The existing `isOwnBlobUrl` allowlist is the check**, the same helper the three
  sibling routes use: `https` plus a store-id subdomain of
  `public.blob.vercel-storage.com`. Legitimate callers already satisfy it —
  both `components/wizard/Processing.tsx` and `lib/batch/run-one.ts` upload to
  the app's blob store and pass back that URL.
- **The route's tests move to real blob-store URLs** (they currently pass
  `https://blob/ok`, which the guard would reject) and gain the rejection cases:
  foreign host, `http:`, a literal internal IP, and the cloud metadata endpoint —
  each asserting `400`, no outbound `fetch`, and no `del`.
- **`isOwnBlobUrl`'s own tests gain the bypass shapes** that matter for a
  host-pinned allowlist: credentials in the authority (`https://x@evil.com`), an
  IP-literal host, and a store-lookalike registrable domain.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fill-pipeline`: the document-parsing requirement gains an origin restriction —
  the parse endpoint accepts only URLs in the application's own blob store, and
  MUST reject anything else before performing a request.

## Non-goals

- **No IP/DNS-level blocklist** (`assertSafeBaseUrl` in `lib/extract/llm/providers.ts`).
  That exists because arbitrary user endpoints are the *feature* for custom LLM
  providers; here they never are, and an allowlist is both stronger and immune to
  the DNS-rebinding TOCTOU that the blocklist path documents as residual risk.
- **No rate limiting** on the route — a separate CONCERNS.md item covering
  register/login/extract/parse together.
- **No change to blob access mode or retention** (public URLs, orphaned batch
  uploads) — the other open storage concern, independent of this one.
- **`isOwnBlobUrl` is not moved** out of `lib/upload/avatar.ts`, despite that being
  an odd home for a security guard used by four routes; renaming it touches every
  caller and belongs in its own change.

## Impact

- **Code:** `app/api/parse/route.ts` (guard added before the fetch loop).
- **Tests:** `app/api/parse/route.test.ts` (updated URLs + four rejection cases),
  `lib/upload/avatar.test.ts` (three bypass shapes).
- **Behavior:** clients that upload through the app are unaffected. Any caller
  passing a non-blob URL now gets `400` instead of a parsed document — a break only
  for a caller that should never have existed.
- **APIs / deps / data:** no schema, dependency, or response-shape change for
  valid requests.
