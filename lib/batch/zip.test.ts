import { describe, it, expect } from "vitest";
import { unzipSync, strToU8 } from "fflate";
import { zipOutputs } from "./zip";

describe("zipOutputs", () => {

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
});
