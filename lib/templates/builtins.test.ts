import { describe,it,expect } from "vitest";
import { builtinTemplate } from "./builtins";

describe("builtinTemplate", () => {

  it("knows the order passport and locks its catalog to the repo", () => {
    const b = builtinTemplate("ed")!;
    expect(b.instruction).toContain("Паспорт Заказа и договора");
    expect(b.fieldsLocked).toBe(true);
    expect(b.fields).toHaveLength(11);
  });

  it("does not answer for an inherited property name", () => {
    for (const evil of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(builtinTemplate(evil)).toBeUndefined();
    }
  });
});
