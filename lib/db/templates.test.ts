import { describe, it, expect } from "vitest";
import { isTemplateAccessible } from "./templates";
import type { TemplateRow } from "./templates";

const base: TemplateRow = {
  id: "tpl-1", code: "T", nameRu: "n", nameEn: "n", descRu: "", descEn: "",
  format: "xlsx", fileKey: "k", sheets: ["Лист1"], userId: "owner@x.ru",
  deletedAt: null, defaultFields: [],
};

describe("isTemplateAccessible", () => {
  it("allows a built-in template (userId null)", () => {
    expect(isTemplateAccessible({ ...base, userId: null }, "anyone@x.ru")).toBe(true);
  });
  it("allows the owner", () => {
    expect(isTemplateAccessible(base, "owner@x.ru")).toBe(true);
  });
  it("allows the owner regardless of email case", () => {
    expect(isTemplateAccessible(base, "Owner@X.ru")).toBe(true);
  });
  it("denies a foreign user", () => {
    expect(isTemplateAccessible(base, "other@x.ru")).toBe(false);
  });
  it("denies a soft-deleted template", () => {
    expect(isTemplateAccessible({ ...base, deletedAt: new Date() }, "owner@x.ru")).toBe(false);
  });
  it("denies a missing template (null row)", () => {
    expect(isTemplateAccessible(null, "owner@x.ru")).toBe(false);
  });
});
