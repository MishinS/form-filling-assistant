import { describe, it, expect } from "vitest";
import { POST } from "./route";
import type { ExtractedValue } from "@/lib/types";
import { PT_FIELDS } from "@/lib/extract/fields";

const ev = (fieldId: string, value: string): ExtractedValue => ({
  fieldId, value, confidence: "high", source: { fileId: null, locator: "" },
});
const post = (body: unknown) =>
  POST(new Request("http://t/api/fill", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/fill", () => {
  it("returns a filled xlsx with download headers", async () => {
    const res = await post({ templateId: "pt", values: [ev("f1", 'ООО «Тест»'), ev("f4", "100 000,00")] });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type"))
      .toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(res.headers.get("Content-Disposition")).toContain("filename*=UTF-8''");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  it("400 on unknown templateId", async () => {
    const res = await post({ templateId: "nope", values: [] });
    expect(res.status).toBe(400);
  });

  it("400 on malformed body", async () => {
    const res = await POST(new Request("http://t/api/fill", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
  });
});

describe("/api/fill field validation", () => {
  const call = (body: unknown) =>
    POST(new Request("http://t/api/fill", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));

  it("400s on a malformed fields list", async () => {
    const res = await call({ templateId: "pt", values: [], fields: [{ id: "f1", cell: "9D" }] });
    expect(res.status).toBe(400);
  });
  it("200s with a valid fields list", async () => {
    const res = await call({ templateId: "pt", values: [], fields: PT_FIELDS });
    expect(res.status).toBe(200);
  });
});
