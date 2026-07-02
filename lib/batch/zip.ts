import { zipSync } from "fflate";

/** Strip the extension, remove filesystem-illegal chars, collapse whitespace. */
function baseName(name: string): string {
  const noExt = name.replace(/\.[^.]+$/, "");
  return noExt.replace(/[\/\\:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "output";
}

/**
 * Build a .zip (as bytes) from filled outputs. Each entry becomes `<base>.xlsx`;
 * colliding bases get a ` (n)` suffix so no entry overwrites another.
 */
export function zipOutputs(entries: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const used = new Map<string, number>();
  const files: Record<string, Uint8Array> = {};
  for (const e of entries) {
    const base = baseName(e.name);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const fname = seen === 0 ? `${base}.xlsx` : `${base} (${seen + 1}).xlsx`;
    files[fname] = e.bytes;
  }
  return zipSync(files);
}
