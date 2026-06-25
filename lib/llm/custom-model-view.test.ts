import { describe, it, expect } from "vitest";
import { customPickerRows } from "./custom-model-view";

describe("customPickerRows", () => {
  it("maps DTOs to picker rows with custom:<id> ids", () => {
    expect(customPickerRows([{ id: "abc", label: "My GPT", provider: "openai" }])).toEqual([
      { id: "custom:abc", name: "My GPT", provider: "openai", custom: true },
    ]);
  });
  it("returns [] for an empty list", () => {
    expect(customPickerRows([])).toEqual([]);
  });
});
