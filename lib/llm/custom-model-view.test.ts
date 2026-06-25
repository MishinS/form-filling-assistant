import { describe, it, expect } from "vitest";
import { customPickerRows, errorLabelKey } from "./custom-model-view";

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

describe("errorLabelKey", () => {
  it("maps known probe codes to cm_err_* keys", () => {
    expect(errorLabelKey("auth")).toBe("cm_err_auth");
    expect(errorLabelKey("model_not_found")).toBe("cm_err_model_not_found");
    expect(errorLabelKey("bad_endpoint")).toBe("cm_err_bad_endpoint");
  });
  it("falls back to provider_error for unknown codes", () => {
    expect(errorLabelKey("weird")).toBe("cm_err_provider_error");
    expect(errorLabelKey(undefined as unknown as string)).toBe("cm_err_provider_error");
  });
});
