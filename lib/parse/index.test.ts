import { describe,it,expect } from "vitest";
import { parseDocument } from "./index";

describe("parseDocument", () => {

  it("returns a warning (no throw) for an unsupported mime", async () => {
    const doc = await parseDocument(Buffer.from("x"), "text/plain", { fileId: "f2", name: "a.txt" });
    expect(doc.blocks).toEqual([]);
    expect(doc.warnings[0]).toContain("Неподдерживаемый тип");
  });
});
