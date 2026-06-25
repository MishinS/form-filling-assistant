import { describe, it, expect } from "vitest";
import { translate } from "./i18n";

describe("translate", () => {
  it("returns ru string for a known key", () => {
    expect(translate("nav_fills", "ru")).toBe("Заполнения");
  });
  it("falls back to ru when en missing, and to key when unknown", () => {
    expect(translate("___nope___" as never, "en")).toBe("___nope___");
  });
  it("has guest wizard presentation keys (ru + en)", () => {
    expect(translate("guest_hero_h", "ru")).toBe("Заполните документ за минуту");
    expect(translate("guest_hero_h", "en")).toBe("Fill a document in a minute");
    expect(translate("guest_again", "ru")).toBe("Заполнить ещё документ");
    expect(translate("guest_again", "en")).toBe("Fill another document");
    expect(translate("guest_hero_sub", "en")).not.toBe("guest_hero_sub");
    expect(translate("guest_hero_note", "en")).not.toBe("guest_hero_note");
  });
});
