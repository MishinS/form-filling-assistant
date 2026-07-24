import { describe, it, expect } from "vitest";
import { translate } from "@/lib/i18n";
import { pluralForm } from "./plural";

describe("pluralForm", () => {
  it("picks the Russian form", () => {
    for (const n of [1, 21, 31, 101, 1001]) expect(pluralForm(n, "ru"), `n=${n}`).toBe("one");
    for (const n of [2, 3, 4, 22, 33, 104]) expect(pluralForm(n, "ru"), `n=${n}`).toBe("few");
    for (const n of [0, 5, 9, 10, 11, 12, 13, 14, 25, 100, 111, 112]) {
      expect(pluralForm(n, "ru"), `n=${n}`).toBe("many");
    }
  });

  it("collapses to singular/plural in English", () => {
    expect(pluralForm(1, "en")).toBe("one");
    for (const n of [0, 2, 5, 11, 21, 101]) expect(pluralForm(n, "en"), `n=${n}`).toBe("many");
  });

  it("has a files_* string for every form in both locales", () => {
    for (const form of ["one", "few", "many"] as const) {
      for (const lang of ["ru", "en"] as const) {
        const key = `files_${form}`;
        expect(translate(key, lang), `${key}/${lang} unresolved`).not.toBe(key);
      }
    }
  });

  it("agrees with the Russian counts the audit flagged", () => {
    const label = (n: number) => `${n} ${translate(`files_${pluralForm(n, "ru")}`, "ru")}`;
    expect(label(1)).toBe("1 файл");
    expect(label(3)).toBe("3 файла");
    expect(label(5)).toBe("5 файлов");
  });
});
