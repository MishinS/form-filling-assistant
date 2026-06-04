import { describe, it, expect } from "vitest";
import { buildFillRecord, formatFillDate, type FillPayload } from "./map";

const payload: FillPayload = {
  templateId: "pt",
  values: [
    { fieldId: "f1", value: "ООО «Ромашка»", confidence: "high", source: { fileId: "u0", locator: "p1" } },
    { fieldId: "f4", value: "48 500,00", confidence: "high", source: { fileId: null, locator: "" } },
  ],
  sources: [
    { fileId: "u0", name: "schet.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: "12 КБ", pages: 1, blobKey: "https://blob/x" },
    { fileId: "u1", name: "akt.pdf", mime: "application/pdf", size: "40 КБ", pages: 2, blobKey: null },
  ],
};

describe("buildFillRecord", () => {
  const rec = buildFillRecord("FID", "user@x.ru", payload);

  it("builds the fill row with done status", () => {
    expect(rec.fill).toEqual({ id: "FID", userId: "user@x.ru", templateId: "pt", status: "done" });
  });

  it("ids source files by upload index (-s0, -s1) preserving order", () => {
    expect(rec.sources.map(s => s.id)).toEqual(["FID-s0", "FID-s1"]);
    expect(rec.sources[0]).toMatchObject({ fillId: "FID", name: "schet.docx", pages: 1, blobKey: "https://blob/x" });
    expect(rec.sources[1].blobKey).toBeNull();
  });

  it("ids values by fieldId and carries source fileId/locator", () => {
    expect(rec.values.map(v => v.id)).toEqual(["FID-f1", "FID-f4"]);
    expect(rec.values[0]).toMatchObject({ fillId: "FID", fieldId: "f1", value: "ООО «Ромашка»", confidence: "high", sourceFileId: "u0", locator: "p1" });
    expect(rec.values[1].sourceFileId).toBeNull();
  });
});

describe("formatFillDate", () => {
  it("formats an ISO timestamp with date and time", () => {
    const out = formatFillDate("2026-05-20T08:24:00.000Z", "ru");
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/:/); // has a time component
  });
});
