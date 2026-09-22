import { describe, it, expect } from "vitest";
import { toLayers } from "./mappings";

const field = { id: "e2", group: "order", cell: "subject", label_ru: "Предмет", label_en: "Subject", kind: "text", required: true, strategy: "llm" } as const;

describe("toLayers", () => {
  it("no row → null (nothing customized)", () => {
    expect(toLayers(undefined)).toBeNull();
  });

  it("keeps each layer independently, null staying null", () => {
    expect(toLayers({ fields: null, instruction: "своя", skeleton: null }))
      .toEqual({ fields: null, instruction: "своя", skeleton: null });
    expect(toLayers({ fields: [field], instruction: null, skeleton: "<p><!--slot:subject--></p>" }))
      .toEqual({ fields: [field], instruction: null, skeleton: "<p><!--slot:subject--></p>" });
  });
});
