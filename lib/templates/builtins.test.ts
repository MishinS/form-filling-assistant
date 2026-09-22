import { describe, it, expect } from "vitest";
import { builtinTemplate, builtinInstruction } from "./builtins";

describe("builtinTemplate", () => {
  it("knows the payment request and lets the user's own mapping through", () => {
    const b = builtinTemplate("pt")!;
    expect(b.instruction).toContain("Платёжного требования");
    expect(b.fieldsLocked).toBe(false);
  });

  it("knows the order passport and locks its catalog to the repo", () => {
    const b = builtinTemplate("ed")!;
    expect(b.instruction).toContain("Паспорт Заказа и договора");
    expect(b.fieldsLocked).toBe(true);
    expect(b.fields).toHaveLength(11);
  });

  it("does not answer for a user template", () => {
    expect(builtinTemplate("tpl-abc")).toBeUndefined();
  });

  it("does not answer for an inherited property name", () => {
    for (const evil of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(builtinTemplate(evil)).toBeUndefined();
    }
  });

  it("does not answer for a non-string id", () => {
    expect(builtinTemplate(undefined)).toBeUndefined();
    expect(builtinTemplate({ pt: 1 })).toBeUndefined();
  });

  it("gives the instruction alone to paths that build their own prompt", () => {
    expect(builtinInstruction("ed")).toContain("Паспорт Заказа");
    expect(builtinInstruction("tpl-abc")).toBeUndefined();
  });
});
