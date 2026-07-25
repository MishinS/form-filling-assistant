## Context

`/api/parse` takes `sources[]` and, for each, does `await fetch(s.url)` and hands
the bytes to `parseDocument`. Authentication is `session?.user` — which a guest
has, since the guest Credentials provider issues a session with no credentials at
all. So the fetch is attacker-controlled and effectively unauthenticated.

The codebase already contains both shapes of URL defense:

- `isOwnBlobUrl` (`lib/upload/avatar.ts`) — an **allowlist**: `https` + hostname
  ending in `.public.blob.vercel-storage.com`. Used as a hard `400` guard by
  `/api/templates`, `/api/blob/template`, and `/api/account/avatar`.
- `assertSafeBaseUrl` (`lib/extract/llm/providers.ts`) — a **blocklist**: literal-IP
  ranges plus a DNS resolution check, with a documented DNS-rebinding TOCTOU
  residual risk.

`/api/parse` uses the first one already — but only to decide which blobs to delete
for guests, never to decide what to fetch.

## Goals / Non-Goals

**Goals:**
- No user-supplied host is ever contacted by this route.
- The rejection happens before any network I/O, for the whole request.
- Regression coverage that names the attack shapes, so the fix has a spec.

**Non-Goals:**
- Rate limiting, blob access mode, and the `isOwnBlobUrl` module move (all separate
  CONCERNS.md items).

## Decisions

### Allowlist, not blocklist

Every legitimate caller uploads to the app's blob store first
(`components/wizard/Processing.tsx`, `lib/batch/run-one.ts`) and passes back the
returned URL, so the set of valid hosts is exactly one. An allowlist of that host
rejects `http:`, IP literals, internal names, and the metadata endpoint without
enumerating any of them — and unlike the blocklist path, there is no DNS
resolution step to be raced, because the check is on the name, not on where the
name currently points. An attacker cannot make `*.public.blob.vercel-storage.com`
resolve into the deployment's private network.

The blocklist approach would be the wrong tool here: it exists for custom LLM
endpoints, where accepting an arbitrary user-chosen host *is* the feature.

### Guard the whole array before fetching anything

The check runs as a single pass over `sources` and returns `400` if any URL fails,
before the `Promise.all` that does the fetching. Validating inside the per-source
loop would let the valid URLs be fetched while the foreign one is rejected —
partial execution of a request that was already known to be malformed. It would
also make the response shape depend on attacker input.

`400` (not a per-source warning doc) matches all three sibling routes and keeps the
violation loud. The per-source `try/catch` that isolates *parse* failures stays as
it is: a corrupt PDF is a user's problem, a foreign URL is not the same class of
event.

### The guest-delete filter stays

After the guard, `sources.filter(isOwnBlobUrl)` in the deletion path is redundant —
every URL has already been validated. It stays anyway: it costs one call, and it
keeps the `del` path safe on its own terms if the guard is ever moved or an early
return is added above it. Defense in depth on a path that deletes things is worth
the redundancy.

### Redirects are left at the default

`fetch` follows redirects, so in principle a 3xx from the blob store could take the
request off-host. `redirect: "error"` would close that, but the blob store's
serving behavior (direct 200 vs CDN redirect) is not verified here, and breaking
every upload to close a hop the attacker does not control is a bad trade. Recorded
as accepted residual risk below rather than silently ignored.

## Risks / Trade-offs

- **A redirect from the blob store could leave the allowlisted host** → accepted:
  the attacker controls the blob's *content*, not the store's response headers.
  Revisit with `redirect: "manual"` if the store's behavior is ever confirmed to be
  a direct 200.
- **The allowlist is store-wide, not tenant-scoped** — any blob in the deployment's
  store is fetchable by any session that knows its URL → unchanged by this fix, and
  bounded by `addRandomSuffix` making URLs unguessable. The real remedy is the
  separate "public blob URLs live forever" concern.
- **A future caller that legitimately needs a foreign URL would break** → it would
  be reintroducing the vulnerability; the spec now says so explicitly.
- **Existing tests pass `https://blob/ok`** and would fail against the guard →
  updated to real store URLs in this change, which also makes the fixtures honest
  about what the route accepts.
