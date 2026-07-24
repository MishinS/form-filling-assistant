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

  it("skips a result event whose values is not an array", () => {
    for (const bad of [{}, { values: null }, { values: 42 }, { values: "x" }]) {
      expect(parseExtractResult(JSON.stringify({ type: "result", ...bad }))).toBeNull();
    }
  });

  it("keeps an earlier valid result when a later result line is malformed", () => {
    const r = parseExtractResult([RESULT, JSON.stringify({ type: "result" })].join("\n"));
    expect(r!.values).toEqual([{ fieldId: "f1", value: "42" }]);
  });

  it("normalises a partial result event", () => {
    const r = parseExtractResult(JSON.stringify({ type: "result", values: [] }));
    expect(r).toEqual({ values: [], warnings: [], llmFailed: false, usedModel: null });
  });

  it("normalises wrongly-typed optional fields", () => {
    const r = parseExtractResult(
      JSON.stringify({ type: "result", values: [], warnings: "nope", llmFailed: "yes", usedModel: 7 }),
    );
    expect(r).toEqual({ values: [], warnings: [], llmFailed: false, usedModel: null });
  });
});
