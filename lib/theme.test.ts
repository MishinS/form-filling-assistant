import { describe, it, expect } from "vitest";
import { parseThemeMode, resolveTheme, THEME_COOKIE } from "./theme";

describe("parseThemeMode", () => {
  it("accepts known modes, defaults everything else to system", () => {
    expect(parseThemeMode("light")).toBe("light");
    expect(parseThemeMode("dark")).toBe("dark");
    expect(parseThemeMode("system")).toBe("system");
    expect(parseThemeMode("garbage")).toBe("system");
    expect(parseThemeMode(undefined)).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("follows the device preference when mode is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  it("uses the explicit mode otherwise", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("THEME_COOKIE", () => {
  it("is the cookie name", () => { expect(THEME_COOKIE).toBe("theme"); });
});
