import { describe,it,expect } from "vitest";
import { PT_FIELDS,newManualField } from "./fields";

describe("mapping helpers", () => {

  it("does not collide when fN ids already exist beyond the catalog", () => {
    const extended = [...PT_FIELDS, { ...PT_FIELDS[0], id: "f20" }];
    expect(newManualField(extended, { label_ru: "x", label_en: "x", kind: "date", cell: "" }).id).toBe("f21");
  });
});
