import { describe, it, expect } from "vitest";
import { buildRows } from "./rows";
import { PT_FIELDS } from "@/lib/extract/fields";
import type { ParsedDoc } from "@/lib/parse/types";
import type { ExtractedValue } from "@/lib/types";

const docs: ParsedDoc[] = [
  { fileId: "u1", name: "Счёт №8.pdf", mime: "application/pdf", pages: 1, blocks: [], scannedPages: [], warnings: [] },
];

describe("buildRows", () => {
  it("resolves the source file name from docs by fileId", () => {
    const values: ExtractedValue[] = [
      { fieldId: "f3", value: "Счёт №8 от 02.06.2026", confidence: "high", source: { fileId: "u1", locator: "стр. 1" } },
    ];
    const rows = buildRows(PT_FIELDS, values, docs);
    const f3 = rows.find(r => r.id === "f3")!;
    expect(f3.value).toBe("Счёт №8 от 02.06.2026");
    expect(f3.src).toEqual({ file: "Счёт №8.pdf", loc: "стр. 1" });
  });

  it("renders a manual placeholder when no source", () => {
    const rows = buildRows(PT_FIELDS, [], docs);
    const f6 = rows.find(r => r.id === "f6")!; // strategy: manual
    expect(f6.value).toBe("");
    expect(f6.src.file).toBe("—");
    expect(f6.src.loc).toBe("проставьте вручную");
  });
});
