import { describe, it, expect } from "vitest";
import { translate } from "./i18n";

describe("translate", () => {
  it("returns ru string for a known key", () => {
    expect(translate("nav_fills", "ru")).toBe("Заполнения");
  });
  it("falls back to ru when en missing, and to key when unknown", () => {
    expect(translate("___nope___" as never, "en")).toBe("___nope___");
  });
});
