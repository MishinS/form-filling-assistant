import { describe,it,expect } from "vitest";
import { missingRequired } from "./rows";
import type { ExtractField } from "@/lib/extract/fields";

describe("missingRequired", () => {
  const fields = [
    { id: "a", required: true } as ExtractField,
    { id: "b", required: true } as ExtractField,
    { id: "c", required: false } as ExtractField,
  ];

  it("returns required fields whose value is empty or whitespace", () => {
    const out = missingRequired(fields, { a: "", b: "   ", c: "" });
    expect(out.map(f => f.id)).toEqual(["a", "b"]);
  });
});

describe("режимы заполнения на Review", () => {
  const f = (over: Partial<ExtractField>): ExtractField => ({
    id: "x", group: "req", label_ru: "L", label_en: "L", cell: "ПТ!A1",
    kind: "string", required: false, strategy: "manual", ...over,
  });
  it("missingRequired игнорирует constant/date поля", () => {
    const fields = [f({ id: "b", required: true, fillMode: "constant" })];
    expect(missingRequired(fields, {})).toEqual([]);
  });
});
