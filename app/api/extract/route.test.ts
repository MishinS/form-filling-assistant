import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/extract/extract", () => ({
  extractFields: vi.fn(async () => ({
    values: [{ fieldId: "f3", value: "Счёт №8 от 02.06.2026", confidence: "high", source: { fileId: "u1", locator: "стр. 1" } }],
    warnings: [],
  })),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://t/api/extract", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/extract", () => {
  it("returns values for a valid request", async () => {
    const res = await POST(req({ templateId: "pt", model: "gemini-2.0-flash", docs: [] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.values[0].fieldId).toBe("f3");
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(req({ model: 123, docs: "nope" }));
    expect(res.status).toBe(400);
  });
});
