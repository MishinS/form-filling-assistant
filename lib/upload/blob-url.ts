const HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * Host of the blob store this deployment writes to, derived from the credential
 * it writes with: `BLOB_READ_WRITE_TOKEN` has the shape
 * `vercel_blob_rw_<storeId>_<secret>`. Deriving it — rather than configuring a
 * second variable — makes the store we validate against and the store we
 * actually use impossible to tell apart. The secret half may itself contain
 * underscores, hence `>= 5` rather than an exact segment count.
 *
 * Returns null when the identity cannot be determined, which the caller treats
 * as "reject everything".
 */
function ownBlobHost(): string | null {
  const parts = (process.env.BLOB_READ_WRITE_TOKEN ?? "").split("_");
  if (parts.length < 5) return null;
  if (parts[0] !== "vercel" || parts[1] !== "blob" || parts[2] !== "rw") return null;
  if (!/^[a-z0-9]+$/i.test(parts[3])) return null;
  return parts[3].toLowerCase() + HOST_SUFFIX;
}

/** True iff the URL points at *our* blob store — https, our exact store host, no
 *  port. The allowlist behind the /api/parse SSRF guard, and the check that lets
 *  /api/templates persist a fileKey that /api/fill later fetches unguarded.
 *
 *  `URL#hostname` carries the weight here: it is already lower-cased, it drops a
 *  credentials segment (so `https://<store>@evil.example.com` reads as
 *  `evil.example.com`), and it excludes the port — which is why the port is
 *  checked separately.
 *
 *  Fails closed: no usable token means no legitimate blob URL can exist, so
 *  rejecting is the honest answer. Never throws — callers answer 400 on false. */
export function isOwnBlobUrl(url: string): boolean {
  const host = ownBlobHost();
  if (!host) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === host && u.port === "";
  } catch {
    return false;
  }
}
