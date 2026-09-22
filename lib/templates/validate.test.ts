import { describe, it, expect } from "vitest";
import { parseFieldList } from "./validate";
import { PT_FIELDS } from "@/lib/extract/fields";

describe("parseFieldList", () => {
  it("rejects a field with a bad (non-empty) cell", () => {
    const bad = [{ ...PT_FIELDS[0], cell: "9D" }];
    expect(parseFieldList(bad)).toBeNull();
  });
  it("rejects a field missing required keys", () => {
    expect(parseFieldList([{ id: "fx" }])).toBeNull();
  });
  it("rejects an unknown rule key (would crash the regex pass)", () => {
    const bad = [{ ...PT_FIELDS[2], strategy: "rule", rule: "bogus" }]; // f3 is a rule field
    expect(parseFieldList(bad)).toBeNull();
  });

  it("отклоняет fillMode:date с кривым dateRule", () => {
    const input = [{
      id: "f10", group: "terms", label_ru: "Срок", label_en: "Due", cell: "ПТ!H16",
      kind: "date", strategy: "manual", required: false,
      fillMode: "date", dateRule: { offset: "WAT", format: "dmy" },
    }];
    expect(parseFieldList(input)).toBeNull();
  });
});

import { validateChoiceValues, parseUserNote, MAX_NOTE_LENGTH, isValueList, MAX_VALUE_LENGTH } from "./validate";
import { ED_FIELDS } from "@/lib/render/ed";

const EDSLOTS = ED_FIELDS.map((f) => f.cell);
const edField = (over: Record<string, unknown> = {}) => ({
  id: "e2", group: "order", label_ru: "Предмет", label_en: "Subject",
  kind: "text", required: true, strategy: "llm", cell: "subject", ...over,
});

describe("parseFieldList picks its address validator from the template format", () => {
  const opts = { format: "html" as const, allowedSlots: EDSLOTS, allowedGroups: ["order", "terms", "sign"] };

  it("rejects a spreadsheet cell reference on an HTML template", () => {
    expect(parseFieldList([edField({ cell: "ПТ!D9" })], opts)).toBeNull();
  });

  it("rejects a slot name on an XLSX template", () => {
    expect(parseFieldList([{ ...PT_FIELDS[0], cell: "subject" }])).toBeNull();
  });

  it("never carries render markup in from a request body", () => {
    const hostile = edField({
      paragraphHtml: '<p onclick="steal()">{}</p>',
      listSeparator: "<script>alert(1)</script>",
      slotMode: "paragraphs",
    });
    const out = parseFieldList([hostile], opts);
    expect(out).not.toBeNull();
    expect(out![0].paragraphHtml).toBeUndefined();
    expect(out![0].listSeparator).toBeUndefined();
  });
});

describe("choice values", () => {

  it("rejects a value outside the list", () => {
    expect(validateChoiceValues(ED_FIELDS, [{ fieldId: "e11", value: "Иванов" }])).toBe(false);
  });
});

describe("the run note", () => {

  it("rejects an oversized note rather than truncating it", () => {
    expect(parseUserNote("x".repeat(MAX_NOTE_LENGTH + 1))).toEqual({ ok: false });
  });
});

describe("value shape", () => {
  it("rejects a non-string value — trim() on a number is a 500, not a 400", () => {
    expect(isValueList([{ fieldId: "e2", value: 5 }])).toBe(false);
  });
  it("rejects an oversized value", () => {
    expect(isValueList([{ fieldId: "e2", value: "x".repeat(MAX_VALUE_LENGTH + 1) }])).toBe(false);
  });
});
