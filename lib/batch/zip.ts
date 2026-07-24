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
  const used = new Set<string>();
  const files: Record<string, Uint8Array> = {};
  for (const e of entries) {
    const base = baseName(e.name);
    // Dedup on the FINAL entry name, not the base: a source named like a
    // previously generated suffix (e.g. "report (2)") must not overwrite it.
    let fname = `${base}.xlsx`;
    for (let n = 2; used.has(fname); n++) fname = `${base} (${n}).xlsx`;
    used.add(fname);
    files[fname] = e.bytes;
  }
  return zipSync(files);
}
