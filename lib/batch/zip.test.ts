import { describe, it, expect } from "vitest";
import { unzipSync, strToU8 } from "fflate";
import { zipOutputs } from "./zip";

describe("zipOutputs", () => {
  it("packs one entry per input, round-trips via unzipSync", () => {
    const zip = zipOutputs([
      { name: "invoice-1.pdf", bytes: strToU8("A") },
      { name: "invoice-2.pdf", bytes: strToU8("B") },
    ]);
    const out = unzipSync(zip);
    expect(Object.keys(out).sort()).toEqual(["invoice-1.xlsx", "invoice-2.xlsx"]);
    expect(strToU8("A")).toEqual(out["invoice-1.xlsx"]);
  });

  it("forces a .xlsx extension and sanitizes illegal characters", () => {
    const zip = zipOutputs([{ name: 'a/b:c*?.docx', bytes: strToU8("X") }]);
    expect(Object.keys(unzipSync(zip))).toEqual(["abc.xlsx"]);
  });

  it("de-duplicates colliding names with a numeric suffix", () => {
    const zip = zipOutputs([
      { name: "acme.pdf", bytes: strToU8("1") },
      { name: "acme.pdf", bytes: strToU8("2") },
      { name: "acme.pdf", bytes: strToU8("3") },
    ]);
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(["acme (2).xlsx", "acme (3).xlsx", "acme.xlsx"]);
  });

  it("keeps all entries when a source name collides with a generated dedup name", () => {
    const zip = zipOutputs([
      { name: "report.pdf", bytes: strToU8("1") },
      { name: "report.pdf", bytes: strToU8("2") },
      { name: "report (2).pdf", bytes: strToU8("3") },
    ]);
    const out = unzipSync(zip);
    // 3 inputs → 3 distinct entries; the third must not overwrite the second.
    expect(Object.keys(out).length).toBe(3);
    // Every original payload survives somewhere in the archive.
    const payloads = Object.values(out).map((b) => new TextDecoder().decode(b)).sort();
    expect(payloads).toEqual(["1", "2", "3"]);
  });

  it("preserves entry count for any mix of colliding names", () => {
    const names = ["a", "a", "a (2)", "a (2)", "a", "b/c", "b:c"];
    const zip = zipOutputs(names.map((name, i) => ({ name: `${name}.pdf`, bytes: strToU8(String(i)) })));
    expect(Object.keys(unzipSync(zip)).length).toBe(names.length);
  });
});
