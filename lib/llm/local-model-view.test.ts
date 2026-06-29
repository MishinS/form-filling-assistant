import { describe, it, expect } from "vitest";
import { localPickerRows } from "./local-model-view";

describe("localPickerRows", () => {
  it("maps runtime models to local:<slug> rows", () => {
    expect(localPickerRows({
      baseUrl: "http://127.0.0.1:11434/v1", kind: "ollama",
      models: [{ slug: "llama3.1:8b", name: "llama3.1:8b" }],
    })).toEqual([
      { id: "local:llama3.1:8b", name: "llama3.1:8b", provider: "Ollama", local: true },
    ]);
  });
  it("labels LM Studio models", () => {
    expect(localPickerRows({
      baseUrl: "http://127.0.0.1:1234/v1", kind: "lmstudio",
      models: [{ slug: "phi-4", name: "phi-4" }],
    })[0].provider).toBe("LM Studio");
  });
  it("returns [] for null", () => {
    expect(localPickerRows(null)).toEqual([]);
  });
});
