## Context

`isOwnBlobUrl` (`lib/upload/avatar.ts`, 11 lines, the file's only export) is the
allowlist four routes use to decide whether a URL is ours:

```ts
return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
```

That suffix is shared by every Vercel Blob store in existence, so the check
answers "is this *a* Vercel Blob URL", not "is this *our* Blob URL". The four
callers are `app/api/parse/route.ts` (fetch + guest cleanup `del`),
`app/api/templates/route.ts` (persisting a template `fileKey`),
`app/api/blob/template/route.ts`, and `app/api/account/avatar/route.ts` (save +
old-avatar `del`).

`fix-parse-ssrf` wrote the origin restriction into the `fill-pipeline` spec one
day before this change and listed the guard's relocation in its Non-goals as
belonging "in its own change". Its Risks section also recorded that the allowlist
is store-wide rather than tenant-scoped; this change makes it store-*exact*,
which is a different axis and does not close the tenant one.

Two adjacent items in the same perimeter are folded in because each is a
one-liner with no design tension: the Gemini key travels in the query string
(`lib/extract/llm/gemini.ts:45`), and `BYOK_ENCRYPTION_KEY` — which
`lib/crypto/secrets.ts` throws without — is missing from `.env.example`.

The full brainstormed design is
`../docs/superpowers/specs/2026-07-26-ssrf-perimeter-closeout-design.md`.

## Goals / Non-Goals

**Goals:**
- "Our blob store" means one specific store, and the definition cannot drift from
  the store actually written to.
- An indeterminate store identity rejects everything rather than widening the
  allowlist.
- The guard lives somewhere that admits what it is.
- No secret travels in a URL; every required env var is documented.
- Regression coverage naming each rejected shape, so the fix has a spec.

**Non-Goals:**
- Blob access mode and retention, rate limiting, a logging sink, BYOK key
  rotation, migrating legacy `templates.file_key` rows, path validation, and a
  redundant guard in `/api/fill` — see the proposal's Non-goals for why each is
  excluded.

## Decisions

### Derive the store id from `BLOB_READ_WRITE_TOKEN`, not a new env var

The token has the shape `vercel_blob_rw_<storeId>_<secret>`, and it is the
credential every write and delete already goes through. Deriving the expected
host from it makes drift between "the store we validate against" and "the store
we actually use" structurally impossible: change the token, and the allowlist
follows in the same breath.

The alternative — an explicit `BLOB_STORE_HOST` — was rejected on failure mode,
not on effort. It is a second thing to configure in every environment, and when
it disagrees with the token nothing complains: uploads land in one store while
the guard vouches for another. A hybrid (derive, allow override) was rejected for
giving a security guard two code paths and two ways to be misconfigured.

The cost is a dependency on a token format Vercel does not document. It is
mitigated, not ignored — see Risks.

### Fail closed when the store id cannot be determined

No token, wrong prefix, or a store id with illegal characters means every URL is
rejected. Without the token nothing can upload and nothing can be deleted, so no
legitimate blob URL can exist in that state; rejecting is the honest answer, and
it is the only answer that keeps a forgotten production variable from silently
restoring the exact hole this change closes.

The alternative — falling back to today's suffix check — inverts the risk: the
system would be least protected precisely when it is most misconfigured. That a
token-less local dev now breaks loudly at the first upload is the intended
trade, not a side effect.

The guard's contract stays "returns a boolean, never raises": the four callers
answer their existing `400` and nothing 500s, honoring the "never 500 the app"
rule.

### Exact hostname comparison, with the port checked separately

`URL#hostname` gives three properties for free that make an equality check
sufficient rather than a starting point: it is already lower-cased (so the
mixed-case store id in the token needs one `toLowerCase()`), it excludes
credentials (so `https://store.public.blob.vercel-storage.com@evil.example.com`
yields `evil.example.com`), and it excludes the port — which is why `u.port === ""`
is a separate condition, ruling out a request to an unusual port on the real
store host.

The secret half of the token may itself contain underscores, so the parse takes
`parts[3]` after a `length >= 5` check rather than assuming exactly five segments.

### Read the environment per call

Matches `masterKey()` in `lib/crypto/secrets.ts` and `geminiModel` in
`lib/extract/llm/gemini.ts`, and matches how the suite already stubs env values
(`vi.stubEnv`). A module-level constant computed at import would be marginally
faster and would cost every test a `resetModules`, while pinning the value at
whatever moment the module first loaded — an avoidable question in a serverless
runtime. An env read is free next to the network request the guard protects.

### Move the guard to `lib/upload/blob-url.ts`

`lib/upload/avatar.ts` contains nothing but `isOwnBlobUrl`, so it is deleted
rather than emptied. Four routes importing a security guard from a module named
after avatars was already odd; once the guard also reads an environment variable
and can fail closed, the name is misleading about what the module owns. The edit
is mechanical — four import lines and the test file's name.

### Leave `/api/fill` unguarded, deliberately

`app/api/fill/route.ts:79` fetches `tpl.fileKey` with no check. That value can
only enter the database through `app/api/templates/route.ts`, so pinning the
write boundary is what makes the unguarded read safe. Adding a check there would
imply the write boundary is untrusted and would invite the next reader to wonder
which of the two is authoritative. Recorded here so it is not "fixed" later by
accident.

## Risks / Trade-offs

- **The hostname may not be the token's store id lower-cased** → the assumption
  behind the whole change, evidenced only by the token shape in `.env.local`. If
  wrong, upload → parse fails on the first file with a `400`, so the failure is
  immediate and unmistakable rather than silent. Verified against a live blob URL
  during UAT before archiving, per the project's archive-after-UAT rule.
- **Vercel could change the token format** → the guard fails closed, which
  breaks uploads loudly rather than admitting foreign stores. The malformed-token
  test documents the shape being relied on, so the breakage points at its own
  cause.
- **A forgotten `BLOB_READ_WRITE_TOKEN` now breaks the app instead of degrading**
  → intended (see Decisions). The variable is already required for uploads to
  work at all, so the surface where this is newly fatal is narrow.
- **The allowlist is store-exact but still not tenant-scoped** — any blob in our
  store is fetchable by any session that knows its URL → unchanged by this fix,
  bounded by `addRandomSuffix`. The remedy is the separate blob-access/retention
  concern.
- **Legacy `templates.file_key` rows pointing at a foreign store would still be
  fetched by `/api/fill`** → not audited; invite-only single-operator install
  makes such a row unexpected. Recorded rather than assumed away.
- **Four route test files use invented blob hosts** that exact matching rejects →
  each stubs a token whose store id matches the host it already uses, keeping the
  diffs minimal and each file self-consistent.
- **The Gemini header swap could break authentication** if the endpoint version
  in use ignored the header → covered by a request-shape test and by one live
  extraction on the Gemini provider during UAT.

## Migration Plan

No schema, data, or dependency migration. Deployment order does not matter: the
guard reads an environment variable that is already set in every environment that
can upload.

Rollback is a revert of the code commit — the previous guard needs no
configuration that this change removes.

The one deploy-time precondition is that `BLOB_READ_WRITE_TOKEN` is present in the
target environment. It already is, everywhere uploads work; the fail-closed
branch exists for the case where that stops being true.
