import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import type { ExtractedValue } from "@/lib/types";
import { planWrites, sheetFile, type CellWrite } from "./values";
import { writeCell, setFormulaCache } from "./cell";

/** Fill the ПТ образец with the given values, preserving everything else. Pure & sync. */
export function fillPtXlsx(templateBytes: Uint8Array, values: ExtractedValue[]): Uint8Array {
  const files = unzipSync(templateBytes);

  const byFile = new Map<string, CellWrite[]>();
  for (const w of planWrites(values)) {
    const file = sheetFile(w.sheet);
    const arr = byFile.get(file) ?? [];
    arr.push(w);
    byFile.set(file, arr);
  }

  for (const [file, ws] of byFile) {
    const entry = files[file];
    if (!entry) throw new Error(`Template missing ${file}`);
    let xml = strFromU8(entry);
    for (const w of ws) {
      xml =
        w.mode === "formulaCache"
          ? setFormulaCache(xml, w.ref, w.value as number)
          : writeCell(xml, w.ref, w.mode, w.value);
    }
    files[file] = strToU8(xml);
  }

  return zipSync(files);
}
