import { describe, it, expect } from "vitest";
import { groupsOf } from "./groups";
import { PT_FIELDS } from "@/lib/extract/fields";
import { ED_FIELDS } from "@/lib/render/ed";

describe("groupsOf", () => {
  it("gives the payment request its own three groups", () => {
    expect(groupsOf(PT_FIELDS).map((g) => g.id)).toEqual(["req", "pay", "terms"]);
  });

  it("gives the order passport its own three groups", () => {
    expect(groupsOf(ED_FIELDS).map((g) => g.id)).toEqual(["order", "terms", "sign"]);
  });

  it("labels a known group in both languages", () => {
    const sign = groupsOf(ED_FIELDS).find((g) => g.id === "sign")!;
    expect(sign.ru).toBe("Подписи");
    expect(sign.en).toBe("Signatures");
  });

  it("falls back to the raw id for a group it does not know", () => {
    const fields = [{ ...PT_FIELDS[0], group: "custom" }];
    expect(groupsOf(fields)).toEqual([{ id: "custom", ru: "custom", en: "custom" }]);
  });

  it("returns nothing for no fields", () => {
    expect(groupsOf([])).toEqual([]);
  });
});
