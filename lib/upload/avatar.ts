/** True iff the URL is a public Vercel Blob URL on our store host (https + a
 *  store-id subdomain of public.blob.vercel-storage.com). Guards the save route
 *  against persisting an arbitrary/foreign URL. */
export function isOwnBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}
