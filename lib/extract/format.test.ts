import { describe, it, expect } from "vitest";
import { locatorRu } from "./format";

describe("locatorRu", () => {
  it("formats each locator kind", () => {
    expect(locatorRu({ kind: "pdf", page: 1 })).toBe("стр. 1");
    expect(locatorRu({ kind: "xlsx", sheet: "Счёт", cell: "A1" })).toBe("Счёт · A1");
    expect(locatorRu({ kind: "docx", block: 0 })).toBe("блок 1");
  });
});
