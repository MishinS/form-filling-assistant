import { describe, it, expect } from "vitest";
import { parseExtractResult } from "./extract-result";

const RESULT = JSON.stringify({ type: "result", values: [{ fieldId: "f1", value: "42" }], warnings: [], llmFailed: false, usedModel: "x" });

describe("parseExtractResult", () => {
  it("returns the terminal result event, ignoring race/eta lines", () => {
    const ndjson = [
      JSON.stringify({ type: "attempt", model: "a" }),
      JSON.stringify({ type: "attempt-fail", model: "a" }),
      JSON.stringify({ type: "local-eta", ms: 1000 }),
      RESULT,
    ].join("\n");
    const r = parseExtractResult(ndjson);
    expect(r).not.toBeNull();
    expect(r!.values).toEqual([{ fieldId: "f1", value: "42" }]);
    expect(r!.llmFailed).toBe(false);
    expect(r!.usedModel).toBe("x");
  });

  it("tolerates blank and malformed lines", () => {
    const r = parseExtractResult(["", "not json", RESULT, ""].join("\n"));
    expect(r!.values.length).toBe(1);
  });

  it("returns null when there is no result event", () => {
    expect(parseExtractResult(JSON.stringify({ type: "attempt", model: "a" }))).toBeNull();
    expect(parseExtractResult("")).toBeNull();
  });
});
