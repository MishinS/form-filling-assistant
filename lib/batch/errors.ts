/**
 * Stable failure vocabulary for the batch pipeline.
 *
 * `runBatch` carries a per-file failure as `Error.message` (a plain string), so
 * `run-one.ts` encodes a code — and optionally the originating HTTP status — into
 * that message instead of prose or a raw response body. The UI decodes it and
 * translates at render time (`batch_err_<code>` in `lib/seed/pt.ts`).
 *
 * Anything that does not decode is not ours: the UI must fall back to its generic
 * failure label, which is what keeps unbounded server output out of the batch rows.
 */
export const BATCH_ERROR_CODES = [
  "parse_failed",
  "parse_empty",
  "extract_failed",
  "extract_empty",
  "llm_failed",
  "fill_failed",
] as const;

export type BatchErrorCode = (typeof BATCH_ERROR_CODES)[number];

const CODES = new Set<string>(BATCH_ERROR_CODES);

/** Build a pipeline failure encoded as `code` or `code:status`. */
export function batchError(code: BatchErrorCode, status?: number): Error {
  return new Error(status === undefined ? code : `${code}:${status}`);
}

/** Decode a `batchError` message; null for any string this module did not produce. */
export function decodeBatchError(raw: string): { code: BatchErrorCode; status?: number } | null {
  const parts = raw.split(":");
  if (parts.length > 2) return null;
  const [code, rawStatus] = parts;
  if (!CODES.has(code)) return null;
  if (rawStatus === undefined) return { code: code as BatchErrorCode };
  if (!/^\d+$/.test(rawStatus)) return null;
  return { code: code as BatchErrorCode, status: Number(rawStatus) };
}

/**
 * Render a per-file failure for display: the localized message plus the status
 * when one is known. An error this module did not encode collapses to the
 * generic label — never to its own text.
 */
export function formatBatchError(raw: string | undefined, t: (key: string) => string): string {
  const d = raw ? decodeBatchError(raw) : null;
  if (!d) return t("batch_failed");
  const msg = t(`batch_err_${d.code}`);
  return d.status === undefined ? msg : `${msg} (${d.status})`;
}
