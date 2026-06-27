import { describe, it, expect } from "vitest";
import { escapeLike, extOf, fillHit, sourceHit } from "./search";

describe("escapeLike", () => {
  it("escapes LIKE wildcards and the escape char", () => {
    expect(escapeLike("50%_done\\")).toBe("50\\%\\_done\\\\");
  });
  it("leaves ordinary text untouched", () => {
    expect(escapeLike("Ромашка")).toBe("Ромашка");
  });
});

describe("extOf", () => {
  it("returns the lowercased extension", () => {
    expect(extOf("Schet.PDF")).toBe("pdf");
    expect(extOf("akt.final.docx")).toBe("docx");
  });
  it("returns '' when there is no extension or name", () => {
    expect(extOf("README")).toBe("");
    expect(extOf(null)).toBe("");
  });
});

describe("fillHit", () => {
  it("titles by counterparty, subtitles by primary file", () => {
    expect(fillHit({ id: "F1", primaryFile: "schet.pdf", counterparty: "ООО «Ромашка»" }))
      .toEqual({ fillId: "F1", title: "ООО «Ромашка»", subtitle: "schet.pdf", ext: "pdf", kind: "fill" });
  });
  it("falls back to the file name, then to a dash; no subtitle when title came from the file", () => {
    expect(fillHit({ id: "F2", primaryFile: "akt.docx", counterparty: null }))
      .toEqual({ fillId: "F2", title: "akt.docx", subtitle: null, ext: "docx", kind: "fill" });
    expect(fillHit({ id: "F3", primaryFile: null, counterparty: null }))
      .toEqual({ fillId: "F3", title: "—", subtitle: null, ext: "", kind: "fill" });
  });
});

describe("sourceHit", () => {
  it("titles by file name, subtitles by counterparty, links to the parent fill", () => {
    expect(sourceHit({ id: "S1", name: "akt.pdf", fillId: "F9", counterparty: "ИП Иванов" }))
      .toEqual({ fillId: "F9", title: "akt.pdf", subtitle: "ИП Иванов", ext: "pdf", kind: "source" });
  });
});
