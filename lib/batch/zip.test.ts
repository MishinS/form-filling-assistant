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
});
